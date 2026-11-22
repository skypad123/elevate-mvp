# A hash of the Terraform that this environment was last applied from. The Deploy workflow
# computes the same hash from the commit it is deploying (infra/scripts/terraform-fingerprint.sh)
# and stops when the two differ, so code never ships ahead of the infrastructure it needs.
#
# The hash covers envs/<environment>/ (*.tf and the provider lock file) and every module's *.tf
# and *.tftpl. It reads the files on disk, so applying uncommitted edits records a hash that no
# commit has, and the next deploy stops until the edits are committed and applied again.
# terraform.tfvars is not covered: it is gitignored, so there is nothing to compare it against.
#
# Both sides hash the same listing, one "<sha256>  <path>\n" line per file (the format of
# `sha256sum`), sorted by path, with paths relative to infra/terraform.

locals {
  terraform_root = "${path.module}/../.."

  fingerprint_files = sort(concat(
    tolist(fileset(local.terraform_root, "envs/${var.environment}/*.tf")),
    tolist(fileset(local.terraform_root, "envs/${var.environment}/.terraform.lock.hcl")),
    tolist(fileset(local.terraform_root, "modules/**/*.tf")),
    tolist(fileset(local.terraform_root, "modules/**/*.tftpl")),
  ))

  terraform_fingerprint = sha256(join("", [
    for f in local.fingerprint_files : "${filesha256("${local.terraform_root}/${f}")}  ${f}\n"
  ]))
}

# Not read by the API: its task definition names each parameter it receives (api.tf).
resource "aws_ssm_parameter" "terraform_fingerprint" {
  name        = "${local.param_prefix}/deploy/terraform-fingerprint"
  description = "Hash of the Terraform last applied to ${var.environment}; checked by the Deploy workflow."
  type        = "String"
  value       = local.terraform_fingerprint
}
