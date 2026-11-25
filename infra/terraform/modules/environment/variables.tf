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

variable "github_oidc_subject_prefix" {
  description = "Start of the sub claim in GitHub's OIDC token for this repository. With immutable subjects it is repo:<owner>@<owner_id>/<repo>@<repo_id> (see `gh api repos/<owner>/<repo>/actions/oidc/customization/sub`). Defaults to repo:<github_repo>."
  type        = string
  default     = null
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

variable "classes" {
  description = "Whether the API serves scheduled classes (the CLASSES setting). Off: every class route answers 404, and the learner's class list is empty."
  type        = bool
  default     = false
}

variable "class_sales" {
  description = "Whether classes are sold (the CLASS_SALES setting). Off: no class is on sale and class checkout answers \"not on sale\"; seats already sold, withdrawals, refunds, the release job and check-in keep working."
  type        = bool
  default     = false
}

variable "release_schedule_enabled" {
  description = "Whether the schedule starts the release job every 15 minutes, and the alarm on runs that did not finish exists. Must stay true while any profile is opted in to class sales: off stops every seat refund and every payout to an opted-in profile."
  type        = bool
  default     = false
}

variable "alarm_email" {
  description = "Email address the release job's alarms are sent to. AWS sends it a confirmation link first."
  type        = string

  validation {
    condition     = can(regex("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$", var.alarm_email))
    error_message = "alarm_email must be one email address, such as ops@example.com."
  }
}

variable "api_uses_restricted_database_user" {
  description = "Whether the API connects as the restricted database user elevate_api (ADR 012). false is the way back: the API connects as the owner again, and the deploy skips its check of the user."
  type        = bool
  default     = true
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

# ── Private access (Tailscale) ──────────────────────────────────────────────

variable "private_access" {
  description = <<-EOT
    Serve the three sites and the API only to the tailnet: a Tailscale App Connector instance in
    this VPC gives the tailnet one fixed public IP, and CloudFront and the load balancer answer 403
    to everyone else. Stripe and Mux webhooks and /api/health stay public. See infra/README.md.
  EOT
  type        = bool
  default     = false
}

variable "private_access_extra_cidrs" {
  description = "IPv4 CIDRs let in besides the connector, e.g. an office IP as a fallback when the connector is down. At most 4: a load balancer rule holds 5 addresses, one of them the connector's."
  type        = list(string)
  default     = []

  validation {
    condition     = length(var.private_access_extra_cidrs) <= 4 && alltrue([for c in var.private_access_extra_cidrs : can(cidrnetmask(c))])
    error_message = "private_access_extra_cidrs takes at most 4 IPv4 CIDRs, such as 203.0.113.7/32."
  }
}

# ── Static sites ────────────────────────────────────────────────────────────

variable "csp_report_only" {
  description = "Send the Content-Security-Policy as Report-Only. Start with true, check the browser console on each site, then switch to false."
  type        = bool
  default     = true
}

variable "course_previews" {
  description = "Whether the API makes and returns hover-preview clips for course cards."
  type        = bool
  default     = true
}
