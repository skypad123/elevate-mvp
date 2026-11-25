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
    key          = "envs/production/terraform.tfstate"
    region       = "ap-southeast-1"
    encrypt      = true
    use_lockfile = true
  }
}

locals {
  tags = {
    Project     = "elevate"
    Environment = "production"
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

variable "github_oidc_subject_prefix" {
  description = "From `gh api repos/<owner>/<repo>/actions/oidc/customization/sub` (sub_claim_prefix)."
  type        = string
  default     = null
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

variable "course_previews" {
  type    = bool
  default = true
}

variable "classes" {
  description = "Scheduled classes (the API's CLASSES setting)."
  type        = bool
  default     = false
}

variable "class_sales" {
  description = "Selling classes (the API's CLASS_SALES setting)."
  type        = bool
  default     = false
}

variable "release_schedule_enabled" {
  description = "The schedule starts the release job every 15 minutes. Keep true while any profile is opted in."
  type        = bool
  default     = false
}

variable "alarm_email" {
  description = "Email address the release job's alarms are sent to."
  type        = string
}

variable "api_uses_restricted_database_user" {
  description = "The API connects as elevate_api; false is the way back to the owner (ADR 012)."
  type        = bool
  default     = true
}

module "environment" {
  source = "../../modules/environment"

  providers = {
    aws           = aws
    aws.us_east_1 = aws.us_east_1
  }

  environment                = "production"
  root_domain                = var.root_domain
  github_repo                = var.github_repo
  github_oidc_subject_prefix = var.github_oidc_subject_prefix
  vpc_cidr                   = "10.30.0.0/16"

  integrations           = var.integrations
  seed_super_admin_email = var.seed_super_admin_email
  csp_report_only        = var.csp_report_only
  course_previews        = var.course_previews
  classes                = var.classes
  class_sales            = var.class_sales

  release_schedule_enabled = var.release_schedule_enabled
  alarm_email              = var.alarm_email

  api_uses_restricted_database_user = var.api_uses_restricted_database_user

  # Data is protected: deletion protection, a final snapshot, 35 days of backups (the most RDS keeps;
  # learners' attendance and payments need a restore window), versioned uploads.
  # Turn on db_multi_az when downtime during an AZ failure or maintenance is no longer acceptable.
  db_instance_class        = "db.t4g.small"
  db_backup_retention_days = 35
  db_multi_az              = false
  protect_data             = true
  log_retention_days       = 90
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
