output "urls" {
  description = "Public URLs of this environment."
  value = {
    api     = local.api_url
    learner = local.learner_url
    teach   = local.teach_url
    support = local.support_url
  }
}

output "parameter_prefix" {
  description = "SSM path holding this environment's secrets."
  value       = local.param_prefix
}

output "manual_parameters" {
  description = "Parameters created with a placeholder that you fill in by hand."
  value       = sort([for p in aws_ssm_parameter.manual : p.name])
}

output "api_log_group" {
  value = aws_cloudwatch_log_group.api.name
}

output "tailscale_connector" {
  description = "The App Connector that private_access lets in (null when private_access is off)."
  value = var.private_access ? {
    public_ip          = aws_eip.connector[0].public_ip
    instance_id        = aws_instance.connector[0].id
    hostname           = local.connector_name
    tag                = local.connector_tag
    auth_key_parameter = aws_ssm_parameter.tailscale_auth_key[0].name
    domains            = [local.base_domain, "*.${local.base_domain}"]
  } : null
}

output "github_environment_variables" {
  description = "Copy these into the GitHub Environment of the same name; the Deploy workflow reads them as vars.*."
  value = {
    AWS_REGION            = local.region
    AWS_ROLE_ARN          = aws_iam_role.deploy.arn
    ECR_REPOSITORY        = data.aws_ecr_repository.api.name
    ECS_CLUSTER           = aws_ecs_cluster.main.name
    ECS_SERVICE           = aws_ecs_service.api.name
    ECS_TASK_FAMILY       = aws_ecs_task_definition.api.family
    ECS_CONTAINER         = local.api_container
    ECS_SUBNETS           = join(",", aws_subnet.public[*].id)
    ECS_SECURITY_GROUP    = aws_security_group.api.id
    API_LOG_GROUP         = aws_cloudwatch_log_group.api.name
    API_URL               = local.api_url
    LEARNER_URL           = local.learner_url
    TEACH_URL             = local.teach_url
    SUPPORT_URL           = local.support_url
    LEARNER_BUCKET        = module.site["learner"].bucket
    TEACH_BUCKET          = module.site["teach"].bucket
    SUPPORT_BUCKET        = module.site["support"].bucket
    LEARNER_CLOUDFRONT_ID = module.site["learner"].distribution_id
    TEACH_CLOUDFRONT_ID   = module.site["teach"].distribution_id
    SUPPORT_CLOUDFRONT_ID = module.site["support"].distribution_id

    # The migration task (owner-only programs), and whether the deploy checks the API's user.
    ECS_MIGRATE_TASK_FAMILY           = aws_ecs_task_definition.migrate.family
    API_USES_RESTRICTED_DATABASE_USER = tostring(var.api_uses_restricted_database_user)

    # The release job's task, and the schedule the deploy points at each new revision of it.
    ECS_RELEASE_TASK_FAMILY = aws_ecs_task_definition.release.family
    RELEASE_SCHEDULE_NAME   = aws_scheduler_schedule.release.name
  }
}
