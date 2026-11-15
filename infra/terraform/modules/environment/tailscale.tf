# Private access: a Tailscale App Connector in this VPC, created only when var.private_access is on.
#
# Devices on the tailnet send traffic for this environment's hostnames through the connector, so
# CloudFront and the load balancer see it arrive from the connector's Elastic IP. sites.tf and
# api.tf let that IP (plus var.private_access_extra_cidrs) in and answer 403 to everyone else.
#
# The connector joins the tailnet with a one-off auth key that you put in SSM after the first
# apply (infra/README.md, "Private staging"). Until then it waits, and nobody can reach the sites.

locals {
  connector_name = "${local.prefix}-connector"
  connector_tag  = "tag:${local.prefix}-connector"

  private_access_cidrs = var.private_access ? concat(
    ["${aws_eip.connector[0].public_ip}/32"],
    var.private_access_extra_cidrs,
  ) : []
}

data "aws_ami" "connector" {
  count = var.private_access ? 1 : 0

  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-2023.*-arm64"]
  }

  filter {
    name   = "architecture"
    values = ["arm64"]
  }
}

# Kept outside local.param_prefix on purpose: the API's execution role reads everything under that
# path, and has no business with this key.
resource "aws_ssm_parameter" "tailscale_auth_key" {
  count = var.private_access ? 1 : 0

  name  = "/${var.name}/${var.environment}-connector/TAILSCALE_AUTH_KEY"
  type  = "SecureString"
  value = "placeholder"

  lifecycle {
    ignore_changes = [value]
  }
}

# ── Instance role: Session Manager for a shell, and read access to the auth key ──

data "aws_iam_policy_document" "ec2_assume" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "connector" {
  count = var.private_access ? 1 : 0

  name               = local.connector_name
  assume_role_policy = data.aws_iam_policy_document.ec2_assume.json
}

resource "aws_iam_role_policy_attachment" "connector_ssm" {
  count = var.private_access ? 1 : 0

  role       = aws_iam_role.connector[0].name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

data "aws_iam_policy_document" "connector" {
  count = var.private_access ? 1 : 0

  statement {
    actions   = ["ssm:GetParameter"]
    resources = [aws_ssm_parameter.tailscale_auth_key[0].arn]
  }
}

resource "aws_iam_role_policy" "connector" {
  count = var.private_access ? 1 : 0

  name   = "read-auth-key"
  role   = aws_iam_role.connector[0].id
  policy = data.aws_iam_policy_document.connector[0].json
}

resource "aws_iam_instance_profile" "connector" {
  count = var.private_access ? 1 : 0

  name = local.connector_name
  role = aws_iam_role.connector[0].name
}

# ── Network: outbound anywhere, inbound only Tailscale's UDP port (direct connections) ──

resource "aws_security_group" "connector" {
  count = var.private_access ? 1 : 0

  name_prefix = "${local.connector_name}-"
  description = "Tailscale App Connector"
  vpc_id      = aws_vpc.main.id

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_vpc_security_group_ingress_rule" "connector_tailscale" {
  count = var.private_access ? 1 : 0

  security_group_id = aws_security_group.connector[0].id
  description       = "Tailscale direct connections (otherwise traffic goes through DERP relays)"
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "udp"
  from_port         = 41641
  to_port           = 41641
}

resource "aws_vpc_security_group_egress_rule" "connector_all" {
  count = var.private_access ? 1 : 0

  security_group_id = aws_security_group.connector[0].id
  description       = "Outbound (Tailscale coordination, the sites and API of this environment, package updates)"
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
}

# ── The connector ───────────────────────────────────────────────────────────

resource "aws_instance" "connector" {
  count = var.private_access ? 1 : 0

  ami = data.aws_ami.connector[0].id
  # Not t4g.nano: with 0.5 GiB, installing Tailscale with dnf runs the instance out of memory.
  instance_type          = "t4g.micro"
  subnet_id              = aws_subnet.public[0].id
  vpc_security_group_ids = [aws_security_group.connector[0].id]
  iam_instance_profile   = aws_iam_instance_profile.connector[0].name

  user_data = templatefile("${path.module}/templates/connector-user-data.sh.tftpl", {
    region        = local.region
    key_parameter = aws_ssm_parameter.tailscale_auth_key[0].name
    hostname      = local.connector_name
    tag           = local.connector_tag
  })

  metadata_options {
    http_endpoint = "enabled"
    http_tokens   = "required"
  }

  root_block_device {
    volume_type = "gp3"
    encrypted   = true
  }

  tags = { Name = local.connector_name }

  # A newer AMI or an edited startup script must not quietly replace the instance: a new one has to
  # join the tailnet again with a fresh auth key. Replace it deliberately with
  # `terraform apply -replace='module.environment.aws_instance.connector[0]'`.
  lifecycle {
    ignore_changes = [ami, user_data]
  }

  # The startup script downloads Tailscale on first boot, and runs only once: the instance must not
  # start before its security group allows outbound traffic.
  depends_on = [aws_vpc_security_group_egress_rule.connector_all]
}

# The address CloudFront and the load balancer let in. It outlives instance replacements.
resource "aws_eip" "connector" {
  count = var.private_access ? 1 : 0

  domain   = "vpc"
  instance = aws_instance.connector[0].id

  tags = { Name = local.connector_name }
}
