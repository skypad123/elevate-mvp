# Runtime configuration lives in SSM Parameter Store under /<name>/<environment>/ and is injected
# into the API task as environment variables.

resource "random_password" "session_secret" {
  length  = 48
  special = false
}

resource "aws_ssm_parameter" "database_url" {
  name  = "${local.param_prefix}/DATABASE_URL"
  type  = "SecureString"
  value = local.database_url
}

resource "aws_ssm_parameter" "session_secret" {
  name  = "${local.param_prefix}/SESSION_SECRET"
  type  = "SecureString"
  value = random_password.session_secret.result
}

locals {
  # Keys issued by third parties. Terraform creates each parameter with a placeholder and never
  # touches the value again; set the real one with `aws ssm put-parameter --overwrite`.
  integration_secrets = {
    resend = ["RESEND_API_KEY"]
    stripe = ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "STRIPE_CONNECT_WEBHOOK_SECRET"]
    mux    = ["MUX_TOKEN_ID", "MUX_TOKEN_SECRET", "MUX_WEBHOOK_SECRET", "MUX_SIGNING_KEY", "MUX_PRIVATE_KEY"]
  }

  manual_secret_names = toset(flatten(values(local.integration_secrets)))

  # Only the integrations that are switched on reach the task: a placeholder key would otherwise
  # look like a configured (and broken) integration to the API.
  enabled_secret_names = flatten([
    for integration, names in local.integration_secrets : names if var.integrations[integration]
  ])
}

resource "aws_ssm_parameter" "manual" {
  for_each = local.manual_secret_names

  name  = "${local.param_prefix}/${each.key}"
  type  = "SecureString"
  value = "placeholder"

  lifecycle {
    ignore_changes = [value]
  }
}
