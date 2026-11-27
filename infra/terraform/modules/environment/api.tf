# The API: one Fargate task behind an HTTPS load balancer.
#
# Terraform owns the task definition's configuration (environment, secrets, sizing). The deploy
# workflow copies the latest revision, swaps in the image it just built, registers that as a new
# revision and points the service at it, which is why the service ignores task_definition here.
# A configuration change therefore takes effect on the next deploy (re-run the Deploy workflow).
#
# A second task definition, `migrate`, runs the programs that need the database owner
# (`migrate.js`, `reset-schema.js`). The deploy workflow registers a new revision of it the same
# way. The API's own task definition connects as the restricted user (ADR 012).
#
# A third, `release`, runs the release job (`release.js`) on a schedule (scheduler.tf). It has the
# API's environment and secrets, and its command built in, because a schedule cannot change the
# command of the task it starts. The deploy registers a new revision of it too, then points the
# schedule at that revision.

locals {
  api_port      = 4400
  api_container = "api"

  # Used only until the first deploy registers a real image.
  bootstrap_image = "${data.aws_ecr_repository.api.repository_url}:bootstrap"

  api_environment = merge(
    {
      NODE_ENV        = "production"
      API_PORT        = tostring(local.api_port)
      API_URL         = local.api_url
      LEARNER_URL     = local.learner_url
      TEACH_URL       = local.teach_url
      SUPPORT_URL     = local.support_url
      STORAGE_DRIVER  = "s3"
      S3_BUCKET       = aws_s3_bucket.uploads.bucket
      S3_REGION       = local.region
      MAIL_DRIVER     = var.integrations.resend ? "resend" : "console"
      MAIL_FROM       = local.mail_from
      VIDEO_DRIVER    = var.integrations.mux ? "mux" : "local"
      COURSE_PREVIEWS = tostring(var.course_previews)
      CLASSES         = tostring(var.classes)
      CLASS_SALES     = tostring(var.class_sales)
    },
    var.seed_super_admin_email == null ? {} : { SEED_SUPER_ADMIN_EMAIL = var.seed_super_admin_email },
  )

  api_secrets = merge(
    {
      # false is the way back to the owner, should the restricted user break a path (ADR 012).
      DATABASE_URL   = var.api_uses_restricted_database_user ? aws_ssm_parameter.database_url_api.arn : aws_ssm_parameter.database_url.arn
      SESSION_SECRET = aws_ssm_parameter.session_secret.arn
    },
    { for name in local.enabled_secret_names : name => aws_ssm_parameter.manual[name].arn },
  )
}

resource "aws_ecs_cluster" "main" {
  name = local.prefix
}

resource "aws_cloudwatch_log_group" "api" {
  name              = "/ecs/${local.prefix}/api"
  retention_in_days = var.log_retention_days
}

resource "aws_ecs_task_definition" "api" {
  family                   = "${local.prefix}-api"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.api_cpu
  memory                   = var.api_memory
  execution_role_arn       = aws_iam_role.api_execution.arn
  task_role_arn            = aws_iam_role.api_task.arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "X86_64"
  }

  container_definitions = jsonencode([{
    name      = local.api_container
    image     = local.bootstrap_image
    essential = true

    portMappings = [{ containerPort = local.api_port, protocol = "tcp" }]

    environment = [for k in sort(keys(local.api_environment)) : { name = k, value = local.api_environment[k] }]
    secrets     = [for k in sort(keys(local.api_secrets)) : { name = k, valueFrom = local.api_secrets[k] }]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.api.name
        "awslogs-region"        = local.region
        "awslogs-stream-prefix" = "api"
      }
    }
  }])
}

# The owner-only programs. Same image, roles, sizing and container name as the API, so the deploy
# workflow's image swap and the log stream name work for both. It reads only the owner's
# connection string and what applyApiRole needs.
resource "aws_ecs_task_definition" "migrate" {
  family                   = "${local.prefix}-migrate"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.api_cpu
  memory                   = var.api_memory
  execution_role_arn       = aws_iam_role.api_execution.arn
  task_role_arn            = aws_iam_role.api_task.arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "X86_64"
  }

  container_definitions = jsonencode([{
    name      = local.api_container
    image     = local.bootstrap_image
    essential = true

    environment = [{ name = "API_DATABASE_USER", value = local.api_database_user }]
    secrets = [
      { name = "API_DATABASE_PASSWORD", valueFrom = aws_ssm_parameter.api_database_password.arn },
      { name = "MIGRATION_DATABASE_URL", valueFrom = aws_ssm_parameter.database_url.arn },
    ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.api.name
        "awslogs-region"        = local.region
        "awslogs-stream-prefix" = "api"
      }
    }
  }])
}

# The release job. Same image, roles, sizing, environment, secrets and container name as the API
# (release.js loads the API's whole environment and connects as the API's database user), no
# port, and its command built in.
resource "aws_ecs_task_definition" "release" {
  family                   = "${local.prefix}-release"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.api_cpu
  memory                   = var.api_memory
  execution_role_arn       = aws_iam_role.api_execution.arn
  task_role_arn            = aws_iam_role.api_task.arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "X86_64"
  }

  container_definitions = jsonencode([{
    name      = local.api_container
    image     = local.bootstrap_image
    essential = true
    command   = ["node", "dist/release.js"]

    environment = [for k in sort(keys(local.api_environment)) : { name = k, value = local.api_environment[k] }]
    secrets     = [for k in sort(keys(local.api_secrets)) : { name = k, valueFrom = local.api_secrets[k] }]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.api.name
        "awslogs-region"        = local.region
        "awslogs-stream-prefix" = "api"
      }
    }
  }])
}

resource "aws_ecs_service" "api" {
  name            = "api"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = var.api_desired_count
  launch_type     = "FARGATE"

  # A deploy starts the new task, waits for it to pass health checks, then stops the old one.
  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200
  health_check_grace_period_seconds  = 30

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  network_configuration {
    subnets          = aws_subnet.public[*].id
    security_groups  = [aws_security_group.api.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = local.api_container
    container_port   = local.api_port
  }

  lifecycle {
    ignore_changes = [task_definition]
  }

  # With private_access the target group is reached only through listener rules.
  depends_on = [aws_lb_listener.https, aws_lb_listener_rule.public_paths, aws_lb_listener_rule.tailnet]
}

# ── Load balancer ───────────────────────────────────────────────────────────

resource "aws_lb" "api" {
  name               = "${local.prefix}-api"
  load_balancer_type = "application"
  subnets            = aws_subnet.public[*].id
  security_groups    = [aws_security_group.alb.id]

  drop_invalid_header_fields = true
  enable_deletion_protection = var.protect_data
}

resource "aws_lb_target_group" "api" {
  name                 = "${local.prefix}-api"
  vpc_id               = aws_vpc.main.id
  target_type          = "ip"
  protocol             = "HTTP"
  port                 = local.api_port
  deregistration_delay = 30

  health_check {
    path                = "/api/health"
    matcher             = "200"
    interval            = 15
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }
}

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.api.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = aws_acm_certificate_validation.api.certificate_arn

  # With private_access, anything the rules below do not let through is refused. Each action type
  # has its own block so a fixed response never carries a target group.
  dynamic "default_action" {
    for_each = var.private_access ? [] : [1]

    content {
      type             = "forward"
      target_group_arn = aws_lb_target_group.api.arn
    }
  }

  dynamic "default_action" {
    for_each = var.private_access ? [1] : []

    content {
      type = "fixed-response"

      fixed_response {
        content_type = "text/plain"
        message_body = "This environment is only reachable over Tailscale."
        status_code  = "403"
      }
    }
  }
}

# Private access: what stays public. Stripe and Mux post webhooks (signature-checked by the API),
# and the Deploy workflow checks /api/health from a GitHub runner.
resource "aws_lb_listener_rule" "public_paths" {
  count = var.private_access ? 1 : 0

  listener_arn = aws_lb_listener.https.arn
  priority     = 10

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }

  condition {
    path_pattern {
      values = ["/api/webhooks/*", "/api/health"]
    }
  }
}

# Private access: everything else, from the Tailscale connector (see tailscale.tf).
resource "aws_lb_listener_rule" "tailnet" {
  count = var.private_access ? 1 : 0

  listener_arn = aws_lb_listener.https.arn
  priority     = 20

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }

  condition {
    source_ip {
      values = local.private_access_cidrs
    }
  }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.api.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"

    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}
