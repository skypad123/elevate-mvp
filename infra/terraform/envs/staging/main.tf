terraform {
  required_version = ">= 1.10"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # The bucket comes from infra/terraform/bootstrap:
  #   terraform init -backend-config="bucket=<state_bucket>"
  backend "s3" {
    key          = "envs/staging/terraform.tfstate"
    region       = "ap-southeast-1"
    encrypt      = true
    use_lockfile = true
  }
}

locals {
  tags = {
    Project     = "elevate"
    Environment = "staging"
    ManagedBy   = "terraform"
  }
}

provider "aws" {
  region = var.region

  default_tags {
    tags = local.tags
  }
}

# CloudFront only accepts certificates issued in us-east-1.
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"

  default_tags {
    tags = local.tags
  }
}

variable "region" {
  type    = string
  default = "ap-southeast-1"
}

variable "root_domain" {
  description = "Domain with a public Route 53 hosted zone in this account, e.g. elevate.sg."
  type        = string
}

variable "github_repo" {
  description = "GitHub repository allowed to deploy, as owner/name."
  type        = string
}

variable "integrations" {
  description = "Switch on Resend, Stripe and Mux once their SSM parameters hold real keys."
  type = object({
    resend = optional(bool, false)
    stripe = optional(bool, false)
    mux    = optional(bool, false)
  })
  default = {}
}

variable "seed_super_admin_email" {
  type    = string
  default = null
}

variable "csp_report_only" {
  type    = bool
  default = true
}

module "environment" {
  source = "../../modules/environment"

  providers = {
    aws           = aws
    aws.us_east_1 = aws.us_east_1
  }

  environment = "staging"
  root_domain = var.root_domain
  github_repo = var.github_repo
  vpc_cidr    = "10.20.0.0/16"

  integrations           = var.integrations
  seed_super_admin_email = var.seed_super_admin_email
  csp_report_only        = var.csp_report_only

  # Small and disposable: no deletion protection, one day of backups.
  db_instance_class        = "db.t4g.micro"
  db_backup_retention_days = 1
  protect_data             = false
  log_retention_days       = 14
}

output "urls" {
  value = module.environment.urls
}

output "parameter_prefix" {
  value = module.environment.parameter_prefix
}

output "manual_parameters" {
  value = module.environment.manual_parameters
}

output "api_log_group" {
  value = module.environment.api_log_group
}

output "github_environment_variables" {
  value = module.environment.github_environment_variables
}
