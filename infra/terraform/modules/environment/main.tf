data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

data "aws_route53_zone" "root" {
  name         = var.root_domain
  private_zone = false
}

data "aws_ecr_repository" "api" {
  name = "${var.name}-api"
}

data "aws_iam_openid_connect_provider" "github" {
  url = "https://token.actions.githubusercontent.com"
}

locals {
  prefix     = "${var.name}-${var.environment}"
  account_id = data.aws_caller_identity.current.account_id
  region     = data.aws_region.current.region

  # production: api.example.com · staging: api.staging.example.com
  base_domain = var.environment == "production" ? var.root_domain : "${var.environment}.${var.root_domain}"

  api_domain = "api.${local.base_domain}"
  site_domains = {
    learner = "app.${local.base_domain}"
    teach   = "teach.${local.base_domain}"
    support = "support.${local.base_domain}"
  }

  api_url     = "https://${local.api_domain}"
  learner_url = "https://${local.site_domains.learner}"
  teach_url   = "https://${local.site_domains.teach}"
  support_url = "https://${local.site_domains.support}"

  param_prefix = "/${var.name}/${var.environment}"
  mail_from    = coalesce(var.mail_from, "Elevate <hello@${var.root_domain}>")
}
