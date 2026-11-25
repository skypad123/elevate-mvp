# Alarms on the release job (scheduler.tf). They email one person, alarm_email, through an SNS
# topic; the subscription waits until that person clicks the link in AWS's confirmation email.
#
# The job writes JSON lines to the API's log group. Every run that gets the lock ends with one
# whose `event` is `release_run_finished`, carrying `needingAttention`: refund rows that are ready
# and unsent for a day, failed refund rows, failed payouts, and steps of the run that failed. A run
# that throws before that line logs `release_run_failed` instead.

locals {
  release_metric_namespace = "${var.name}/${var.environment}"
}

# Not encrypted with the AWS-managed SNS key: CloudWatch alarms cannot publish to a topic that
# uses it. The messages name an alarm and a metric, nothing else.
resource "aws_sns_topic" "release_alarms" {
  name = "${local.prefix}-release-alarms"
}

resource "aws_sns_topic_subscription" "release_alarms_email" {
  topic_arn = aws_sns_topic.release_alarms.arn
  protocol  = "email"
  endpoint  = var.alarm_email
}

# ── What the job logs ───────────────────────────────────────────────────────

resource "aws_cloudwatch_log_metric_filter" "release_runs_finished" {
  name           = "${local.prefix}-release-runs-finished"
  log_group_name = aws_cloudwatch_log_group.api.name
  pattern        = "{ $.event = \"release_run_finished\" }"

  metric_transformation {
    namespace = local.release_metric_namespace
    name      = "ReleaseRunsFinished"
    value     = "1"
    unit      = "Count"
  }
}

resource "aws_cloudwatch_log_metric_filter" "release_needing_attention" {
  name           = "${local.prefix}-release-needing-attention"
  log_group_name = aws_cloudwatch_log_group.api.name
  pattern        = "{ $.event = \"release_run_finished\" }"

  metric_transformation {
    namespace = local.release_metric_namespace
    name      = "ReleaseNeedingAttention"
    value     = "$.needingAttention"
    unit      = "Count"
  }
}

resource "aws_cloudwatch_log_metric_filter" "release_runs_failed" {
  name           = "${local.prefix}-release-runs-failed"
  log_group_name = aws_cloudwatch_log_group.api.name
  pattern        = "{ $.event = \"release_run_failed\" }"

  metric_transformation {
    namespace = local.release_metric_namespace
    name      = "ReleaseRunsFailed"
    value     = "1"
    unit      = "Count"
  }
}

# ── Alarms ──────────────────────────────────────────────────────────────────

# No run finished in 30 minutes: the schedule stopped starting it, or every run failed or found
# the lock held. No data counts as breaching, since no data is what a stopped job looks like.
# Only while the schedule is on: a disabled schedule would keep it in alarm.
resource "aws_cloudwatch_metric_alarm" "release_not_finished" {
  count = var.release_schedule_enabled ? 1 : 0

  alarm_name          = "${local.prefix}-release-not-finished"
  alarm_description   = "No release run finished in 30 minutes. Refunds and payouts are stopped. See infra/README.md."
  namespace           = local.release_metric_namespace
  metric_name         = aws_cloudwatch_log_metric_filter.release_runs_finished.metric_transformation[0].name
  statistic           = "Sum"
  period              = 1800
  evaluation_periods  = 1
  threshold           = 1
  comparison_operator = "LessThanThreshold"
  treat_missing_data  = "breaching"
  alarm_actions       = [aws_sns_topic.release_alarms.arn]
}

resource "aws_cloudwatch_metric_alarm" "release_needing_attention" {
  alarm_name          = "${local.prefix}-release-needing-attention"
  alarm_description   = "A release run reported needingAttention above 0: a refund row unsent for a day, a failed refund row, a failed payout, or a failed step. See the Support payouts page."
  namespace           = local.release_metric_namespace
  metric_name         = aws_cloudwatch_log_metric_filter.release_needing_attention.metric_transformation[0].name
  statistic           = "Maximum"
  period              = 900
  evaluation_periods  = 1
  threshold           = 0
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.release_alarms.arn]
}

resource "aws_cloudwatch_metric_alarm" "release_failed" {
  alarm_name          = "${local.prefix}-release-failed"
  alarm_description   = "A release run failed before its release_run_finished line (release_run_failed in the API log group)."
  namespace           = local.release_metric_namespace
  metric_name         = aws_cloudwatch_log_metric_filter.release_runs_failed.metric_transformation[0].name
  statistic           = "Sum"
  period              = 900
  evaluation_periods  = 1
  threshold           = 0
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.release_alarms.arn]
}

# A start of the release task that failed after the schedule's retries.
resource "aws_cloudwatch_metric_alarm" "release_dead_letter" {
  alarm_name          = "${local.prefix}-release-dead-letter"
  alarm_description   = "The release schedule could not start the release task; the failed start is in ${aws_sqs_queue.release_dlq.name}."
  namespace           = "AWS/SQS"
  metric_name         = "ApproximateNumberOfMessagesVisible"
  dimensions          = { QueueName = aws_sqs_queue.release_dlq.name }
  statistic           = "Maximum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 0
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.release_alarms.arn]
}
