# ADR 005 — AWS hosting and three environments

**Status:** accepted · 2026-11-11

## Context

The rebuild shipped without a deployment target; `docs/runbooks/deploy.md` listed candidate hosts.
We need a place for the team to try changes before learners see them, and a repeatable way to
create both that place and production.

## Decision

- **Three environments, mapped to branches.** `main` and `v0` are development branches and run
  only locally. `staging` and `production` are long-lived branches; a push to either deploys the
  AWS environment of the same name. Production deploys wait for a reviewer in GitHub.
- **AWS, one account, `ap-southeast-1`.** Teachers, learners, the currency and the Stripe country
  are Singaporean. The two environments are separate stacks (VPC, database, buckets, IAM roles)
  with separate Terraform state. Splitting into two accounts later means moving state, not
  rewriting the module.
- **Terraform** (`infra/terraform`): a `bootstrap` stack for account-level pieces and one
  `environment` module instantiated twice.
- **API on ECS Fargate behind an ALB**, one task. The API is a plain long-running Node server with
  an in-memory rate limiter, which rules out scale-to-zero and multi-instance options for now.
  The task runs in a public subnet with a public IP so no NAT gateway is needed; only the load
  balancer can reach it.
- **RDS Postgres 17** in private subnets. Migrations run from the API image as a one-off ECS task
  before each rollout.
- **S3 for uploads**, through a new `S3Storage` driver that uses the task role rather than static
  keys. `public/` keys keep being served by the API so the bucket stays fully private.
- **S3 + CloudFront for the three web apps**, with the SPA fallback and security headers set at
  the CDN.
- **GitHub Actions deploys through OIDC.** Each environment has its own role, assumable only from
  the GitHub Environment of the same name. No AWS keys are stored in GitHub.
- **Terraform owns configuration, the pipeline owns versions.** Terraform defines the task
  definition's environment and secrets; the Deploy workflow copies the latest revision and swaps
  the image. `terraform apply` therefore never redeploys the API by itself.

## Consequences

- Staging uses `NODE_ENV=production`; behaviour that should differ between the two (Mux test
  mode, Stripe dashboard links) needs its own switch rather than `isProd`.
- A fixed monthly cost per environment even when idle (load balancer, database, one task).
- Infrastructure changes are applied by a person from a laptop. CI only validates them.
- Email stays on Resend; the SMTP driver has no authentication, so SES would need code changes.
