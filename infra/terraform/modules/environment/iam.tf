data "aws_iam_policy_document" "ecs_tasks_assume" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

# ── Execution role: pulls the image, writes logs, reads this environment's parameters ──

resource "aws_iam_role" "api_execution" {
  name               = "${local.prefix}-api-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume.json
}

resource "aws_iam_role_policy_attachment" "api_execution" {
  role       = aws_iam_role.api_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

data "aws_iam_policy_document" "api_execution_params" {
  statement {
    actions   = ["ssm:GetParameters"]
    resources = ["arn:aws:ssm:${local.region}:${local.account_id}:parameter${local.param_prefix}/*"]
  }
}

resource "aws_iam_role_policy" "api_execution_params" {
  name   = "read-parameters"
  role   = aws_iam_role.api_execution.id
  policy = data.aws_iam_policy_document.api_execution_params.json
}

# ── Task role: what the running API may do ──────────────────────────────────

resource "aws_iam_role" "api_task" {
  name               = "${local.prefix}-api-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume.json
}

data "aws_iam_policy_document" "api_task" {
  statement {
    actions   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
    resources = ["${aws_s3_bucket.uploads.arn}/*"]
  }

  # Lets HeadObject on a missing key answer 404 instead of 403.
  statement {
    actions   = ["s3:ListBucket"]
    resources = [aws_s3_bucket.uploads.arn]
  }
}

resource "aws_iam_role_policy" "api_task" {
  name   = "uploads-bucket"
  role   = aws_iam_role.api_task.id
  policy = data.aws_iam_policy_document.api_task.json
}

# ── Deploy role: assumed by GitHub Actions jobs running in this GitHub Environment ──

data "aws_iam_policy_document" "github_assume" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [data.aws_iam_openid_connect_provider.github.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["${coalesce(var.github_oidc_subject_prefix, "repo:${var.github_repo}")}:environment:${var.environment}"]
    }
  }
}

resource "aws_iam_role" "deploy" {
  name               = "${local.prefix}-github-deploy"
  assume_role_policy = data.aws_iam_policy_document.github_assume.json
}

data "aws_iam_policy_document" "deploy" {
  statement {
    sid       = "ReadTerraformFingerprint"
    actions   = ["ssm:GetParameter"]
    resources = [aws_ssm_parameter.terraform_fingerprint.arn]
  }

  statement {
    sid       = "EcrLogin"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }

  statement {
    sid = "EcrPush"
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:BatchGetImage",
      "ecr:CompleteLayerUpload",
      "ecr:DescribeImages",
      "ecr:GetDownloadUrlForLayer",
      "ecr:InitiateLayerUpload",
      "ecr:PutImage",
      "ecr:UploadLayerPart",
    ]
    resources = [data.aws_ecr_repository.api.arn]
  }

  # These two actions do not support resource-level permissions.
  statement {
    sid       = "EcsTaskDefinitions"
    actions   = ["ecs:DescribeTaskDefinition", "ecs:RegisterTaskDefinition"]
    resources = ["*"]
  }

  # The migrate family runs migrations; the API family runs check-api-role, the seed and previews;
  # the release family is started by hand when the schedule cannot run it.
  statement {
    sid     = "EcsRunMigration"
    actions = ["ecs:RunTask"]
    resources = [
      "arn:aws:ecs:${local.region}:${local.account_id}:task-definition/${aws_ecs_task_definition.api.family}:*",
      "arn:aws:ecs:${local.region}:${local.account_id}:task-definition/${aws_ecs_task_definition.migrate.family}:*",
      "arn:aws:ecs:${local.region}:${local.account_id}:task-definition/${aws_ecs_task_definition.release.family}:*",
    ]

    condition {
      test     = "ArnEquals"
      variable = "ecs:cluster"
      values   = [aws_ecs_cluster.main.arn]
    }
  }

  statement {
    sid       = "EcsWatchTasks"
    actions   = ["ecs:DescribeTasks"]
    resources = ["arn:aws:ecs:${local.region}:${local.account_id}:task/${aws_ecs_cluster.main.name}/*"]
  }

  statement {
    sid       = "EcsDeployService"
    actions   = ["ecs:DescribeServices", "ecs:UpdateService"]
    resources = [aws_ecs_service.api.arn]
  }

  statement {
    sid       = "PassTaskRoles"
    actions   = ["iam:PassRole"]
    resources = [aws_iam_role.api_execution.arn, aws_iam_role.api_task.arn]

    condition {
      test     = "StringEquals"
      variable = "iam:PassedToService"
      values   = ["ecs-tasks.amazonaws.com"]
    }
  }

  # The deploy points the release schedule at the revision it registered (scheduler.tf). Writing
  # the schedule back passes its role again.
  statement {
    sid       = "ReleaseSchedule"
    actions   = ["scheduler:GetSchedule", "scheduler:UpdateSchedule"]
    resources = [aws_scheduler_schedule.release.arn]
  }

  statement {
    sid       = "PassSchedulerRole"
    actions   = ["iam:PassRole"]
    resources = [aws_iam_role.release_scheduler.arn]

    condition {
      test     = "StringEquals"
      variable = "iam:PassedToService"
      values   = ["scheduler.amazonaws.com"]
    }
  }

  statement {
    sid       = "ReadApiLogs"
    actions   = ["logs:GetLogEvents"]
    resources = ["${aws_cloudwatch_log_group.api.arn}:*"]
  }

  statement {
    sid       = "SiteBucketsList"
    actions   = ["s3:ListBucket"]
    resources = [for site in module.site : site.bucket_arn]
  }

  statement {
    sid       = "SiteBucketsSync"
    actions   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
    resources = [for site in module.site : "${site.bucket_arn}/*"]
  }

  statement {
    sid       = "SiteInvalidations"
    actions   = ["cloudfront:CreateInvalidation", "cloudfront:GetInvalidation"]
    resources = [for site in module.site : site.distribution_arn]
  }
}

resource "aws_iam_role_policy" "deploy" {
  name   = "deploy"
  role   = aws_iam_role.deploy.id
  policy = data.aws_iam_policy_document.deploy.json
}
