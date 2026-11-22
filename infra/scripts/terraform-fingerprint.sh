#!/usr/bin/env bash
# Prints the hash of one environment's Terraform: the value that `terraform apply` stores in
# /elevate/<environment>/deploy/terraform-fingerprint (modules/environment/fingerprint.tf).
# The Deploy workflow runs it on the commit it deploys. Keep the file list in step with that file.
#
#   infra/scripts/terraform-fingerprint.sh staging
#
# It hashes the tracked files as they are on disk (in CI, the checked-out commit).
set -euo pipefail

environment=${1:?usage: terraform-fingerprint.sh <staging|production>}
cd "$(git rev-parse --show-toplevel)/infra/terraform"

git ls-files -z -- \
  ":(glob)envs/$environment/*.tf" \
  ":(glob)envs/$environment/.terraform.lock.hcl" \
  ':(glob)modules/**/*.tf' \
  ':(glob)modules/**/*.tftpl' |
  LC_ALL=C sort -z |
  xargs -0 sha256sum |
  sha256sum | cut -d' ' -f1
