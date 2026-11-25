# The release job's schedule: EventBridge Scheduler starts the `release` task (api.tf) every 15
# minutes. A start that still fails after its retries goes to a dead-letter queue, which raises an
# alarm (alarms.tf). The retries cover a task that fails to start, not one that starts and fails;
# the log alarms cover that.
#
# Terraform creates the schedule once, pointing at its own revision of the task definition (the
# placeholder image) and disabled until release_schedule_enabled is set. After that only the
# Deploy workflow changes which revision it starts, so the target's task definition is ignored
# here and a later apply cannot point it back at the placeholder.

resource "aws_sqs_queue" "release_dlq" {
  name                      = "${local.prefix}-release-dlq"
  message_retention_seconds = 1209600 # 14 days, the most SQS keeps
  sqs_managed_sse_enabled   = true
}

data "aws_iam_policy_document" "scheduler_assume" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["scheduler.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [local.account_id]
    }
  }
}

resource "aws_iam_role" "release_scheduler" {
  name               = "${local.prefix}-release-scheduler"
  assume_role_policy = data.aws_iam_policy_document.scheduler_assume.json
}

data "aws_iam_policy_document" "release_scheduler" {
  statement {
    sid       = "RunReleaseTask"
    actions   = ["ecs:RunTask"]
    resources = ["arn:aws:ecs:${local.region}:${local.account_id}:task-definition/${aws_ecs_task_definition.release.family}:*"]

    condition {
      test     = "ArnEquals"
      variable = "ecs:cluster"
      values   = [aws_ecs_cluster.main.arn]
    }
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

  statement {
    sid       = "DeadLetterQueue"
    actions   = ["sqs:SendMessage"]
    resources = [aws_sqs_queue.release_dlq.arn]
  }
}

resource "aws_iam_role_policy" "release_scheduler" {
  name   = "run-release-task"
  role   = aws_iam_role.release_scheduler.id
  policy = data.aws_iam_policy_document.release_scheduler.json
}

resource "aws_scheduler_schedule" "release" {
  name                = "${local.prefix}-release"
  description         = "Starts the release job (node dist/release.js) every 15 minutes."
  schedule_expression = "rate(15 minutes)"
  state               = var.release_schedule_enabled ? "ENABLED" : "DISABLED"

  flexible_time_window {
    mode = "OFF"
  }

  target {
    arn      = aws_ecs_cluster.main.arn
    role_arn = aws_iam_role.release_scheduler.arn

    ecs_parameters {
      task_definition_arn = aws_ecs_task_definition.release.arn
      launch_type         = "FARGATE"
      task_count          = 1

      # As the migration task runs: public subnets with a public address, no NAT gateway.
      network_configuration {
        subnets          = aws_subnet.public[*].id
        security_groups  = [aws_security_group.api.id]
        assign_public_ip = true
      }
    }

    # A start more than 15 minutes late would overlap the next run, so it goes to the queue.
    retry_policy {
      maximum_retry_attempts       = 2
      maximum_event_age_in_seconds = 900
    }

    dead_letter_config {
      arn = aws_sqs_queue.release_dlq.arn
    }
  }

  lifecycle {
    ignore_changes = [target[0].ecs_parameters[0].task_definition_arn]
  }

  depends_on = [aws_iam_role_policy.release_scheduler]
}
