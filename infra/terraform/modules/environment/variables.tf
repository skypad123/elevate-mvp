variable "name" {
  description = "Project prefix for resource names."
  type        = string
  default     = "elevate"
}

variable "environment" {
  description = "Environment name: staging or production. Also the GitHub Environment and branch name."
  type        = string

  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "environment must be staging or production."
  }
}

variable "root_domain" {
  description = "Domain with a public Route 53 hosted zone in this account, e.g. elevate.sg."
  type        = string
}

variable "github_repo" {
  description = "GitHub repository allowed to deploy, as owner/name."
  type        = string
}

variable "vpc_cidr" {
  description = "CIDR block for the environment's VPC."
  type        = string
}

# ── API ─────────────────────────────────────────────────────────────────────

variable "api_cpu" {
  description = "Fargate CPU units for the API task."
  type        = number
  default     = 256
}

variable "api_memory" {
  description = "Fargate memory (MiB) for the API task."
  type        = number
  default     = 512
}

variable "api_desired_count" {
  description = "Number of API tasks. Keep at 1: the rate limiter is in memory per instance."
  type        = number
  default     = 1
}

variable "log_retention_days" {
  type    = number
  default = 30
}

variable "mail_from" {
  description = "From header for transactional email. Defaults to hello@<root_domain>."
  type        = string
  default     = null
}

variable "seed_super_admin_email" {
  description = "Email granted super_admin by the seed script (optional)."
  type        = string
  default     = null
}

variable "integrations" {
  description = <<-EOT
    Third-party integrations to switch on. Each one reads its keys from SSM parameters that are
    created with a placeholder value: fill them first (see infra/README.md), then set the flag.
    Off means: email is printed to the API log, video uses plain file storage, payments return 503.
  EOT
  type = object({
    resend = optional(bool, false)
    stripe = optional(bool, false)
    mux    = optional(bool, false)
  })
  default = {}
}

# ── Database ────────────────────────────────────────────────────────────────

variable "db_instance_class" {
  type    = string
  default = "db.t4g.micro"
}

variable "db_allocated_storage" {
  description = "Initial storage in GiB (gp3). Autoscaling may grow it to db_max_allocated_storage."
  type        = number
  default     = 20
}

variable "db_max_allocated_storage" {
  type    = number
  default = 100
}

variable "db_multi_az" {
  type    = bool
  default = false
}

variable "db_backup_retention_days" {
  type    = number
  default = 1
}

variable "protect_data" {
  description = "Production safety: deletion protection and a final snapshot on the database, and buckets that refuse to be destroyed while they hold objects."
  type        = bool
  default     = false
}

# ── Static sites ────────────────────────────────────────────────────────────

variable "csp_report_only" {
  description = "Send the Content-Security-Policy as Report-Only. Start with true, check the browser console on each site, then switch to false."
  type        = bool
  default     = true
}
