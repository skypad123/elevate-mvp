# One-time, account-level resources shared by every environment:
# the Terraform state bucket, GitHub's OIDC identity provider, and the API image repository.

terraform {
  required_version = ">= 1.10"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }

  # State starts local. After the first apply, uncomment, then run
  #   terraform init -migrate-state -backend-config="bucket=$(terraform output -raw state_bucket)"
  # backend "s3" {
  #   key          = "bootstrap/terraform.tfstate"
  #   region       = "ap-southeast-1"
  #   encrypt      = true
  #   use_lockfile = true
  # }
}

provider "aws" {
  region = var.region

  default_tags {
    tags = {
      Project   = var.name
      ManagedBy = "terraform"
      Stack     = "bootstrap"
    }
  }
}

variable "name" {
  description = "Project prefix for resource names."
  type        = string
  default     = "elevate"
}

variable "region" {
  description = "AWS region for the state bucket and image repository."
  type        = string
  default     = "ap-southeast-1"
}

variable "create_github_oidc_provider" {
  description = "Set to false if this AWS account already has the token.actions.githubusercontent.com provider."
  type        = bool
  default     = true
}

data "aws_caller_identity" "current" {}

# ── Terraform state ─────────────────────────────────────────────────────────

resource "aws_s3_bucket" "state" {
  bucket = "${var.name}-tfstate-${data.aws_caller_identity.current.account_id}"

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_s3_bucket_versioning" "state" {
  bucket = aws_s3_bucket.state.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "state" {
  bucket = aws_s3_bucket.state.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "state" {
  bucket                  = aws_s3_bucket.state.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ── GitHub Actions → AWS without long-lived keys ────────────────────────────

resource "aws_iam_openid_connect_provider" "github" {
  count = var.create_github_oidc_provider ? 1 : 0

  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]
}

# ── API image repository (one image is promoted through both environments) ──

resource "aws_ecr_repository" "api" {
  name                 = "${var.name}-api"
  image_tag_mutability = "IMMUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_ecr_lifecycle_policy" "api" {
  repository = aws_ecr_repository.api.name

  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep the 50 most recent images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 50
      }
      action = { type = "expire" }
    }]
  })
}

output "state_bucket" {
  description = "Pass to `terraform init -backend-config=\"bucket=…\"` in envs/*."
  value       = aws_s3_bucket.state.bucket
}

output "ecr_repository_url" {
  value = aws_ecr_repository.api.repository_url
}
