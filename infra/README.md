# Elevate infrastructure

Terraform for the two AWS environments, plus the steps to stand them up from nothing.

| Environment | Branch       | Where it runs                                  | How it deploys                                                   |
| ----------- | ------------ | ---------------------------------------------- | ---------------------------------------------------------------- |
| dev         | `main`, `v0` | your machine (`docker compose`, `npm run dev`) | nothing is deployed; CI runs on every push and pull request      |
| staging     | `staging`    | AWS, `*.staging.<domain>`                      | automatically on every push to `staging`                         |
| production  | `production` | AWS, `*.<domain>`                              | on every push to `production`, after a reviewer approves the run |

Code moves forward by pull request: feature branch → `main` (or `v0`) → `staging` → `production`.

## What gets created

Per environment, in one AWS account, region `ap-southeast-1`:

| Piece           | AWS                                                                                            | Hostname                               |
| --------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------- |
| API             | ECS Fargate, one task, behind an HTTPS Application Load Balancer; logs in CloudWatch           | `api.`                                 |
| Database        | RDS Postgres 17 in private subnets, reachable only from the API task                           | –                                      |
| Uploads         | Private S3 bucket (presigned uploads and downloads), accessed through the task's IAM role      | –                                      |
| Learner web     | S3 + CloudFront, single-page-app fallback                                                      | `app.`                                 |
| Teach, Support  | S3 + CloudFront, single-page-app fallback                                                      | `teach.`, `support.`                   |
| DNS and TLS     | Route 53 records, ACM certificates (regional for the API, `us-east-1` for CloudFront)          | under `<domain>` or `staging.<domain>` |
| Configuration   | SSM Parameter Store under `/elevate/<environment>/`                                            | –                                      |
| Deploy identity | An IAM role that only GitHub Actions jobs in the matching GitHub Environment can assume (OIDC) | –                                      |

Shared by both (the `bootstrap` stack): the Terraform state bucket, GitHub's OIDC provider, and
the `elevate-api` image repository in ECR.

Expect very roughly US$55–65 a month per environment at idle (load balancer, one small Fargate
task, a `t4g` database, public IPv4 addresses). This is an estimate, not a quote.

```
infra/terraform/
  bootstrap/              state bucket · GitHub OIDC provider · ECR repository   (apply once)
  modules/environment/    everything one environment needs
  modules/static_site/    S3 + CloudFront for one single-page app
  envs/staging/           staging's settings and state
  envs/production/        production's settings and state
```

## Prerequisites

- An AWS account and credentials with administrator access for the first apply
  (`aws sts get-caller-identity` should work).
- A public Route 53 hosted zone for your domain in that account.
- [Terraform](https://developer.hashicorp.com/terraform/install) 1.10 or newer, the
  [AWS CLI](https://docs.aws.amazon.com/cli/) v2, the [GitHub CLI](https://cli.github.com/) and `jq`.
- Admin rights on the GitHub repository.

## Setup

### 1. Bootstrap (once per AWS account)

```bash
cd infra/terraform/bootstrap
terraform init
terraform apply
export TF_STATE_BUCKET=$(terraform output -raw state_bucket)
```

If the account already has an IAM identity provider for `token.actions.githubusercontent.com`,
add `-var create_github_oidc_provider=false`.

The bootstrap state is a local file at first. To keep it in the bucket it just created, uncomment
the `backend "s3"` block in `bootstrap/main.tf` and run
`terraform init -migrate-state -backend-config="bucket=$TF_STATE_BUCKET"`.

### 2. Create an environment

Do staging first, then repeat with `production`.

```bash
cd infra/terraform/envs/staging
cp terraform.tfvars.example terraform.tfvars    # set root_domain; the file is gitignored
terraform init -backend-config="bucket=$TF_STATE_BUCKET"
terraform plan
terraform apply
```

The first apply takes 10–15 minutes (database, certificates, CloudFront). When it finishes the API
service exists but has nothing to run yet: its tasks fail to start until the first deploy pushes an
image (step 6). That is expected.

### 3. Connect GitHub

Create the GitHub Environment and copy Terraform's outputs into it as variables. They are
identifiers, not secrets; AWS access comes from the OIDC role.

```bash
ENV=staging
gh api --method PUT "repos/{owner}/{repo}/environments/$ENV" >/dev/null
terraform output -json github_environment_variables \
  | jq -r 'to_entries[] | "\(.key)\t\(.value)"' \
  | while IFS=$'\t' read -r key value; do gh variable set "$key" --env "$ENV" --body "$value"; done
```

Then, in the repository settings on GitHub:

- **Environments → production → Required reviewers**: add the people who may approve a
  production deploy. Under **Deployment branches**, allow only `production` (and only `staging`
  for the staging environment).
- **Branches**: protect `staging` and `production` (require a pull request and the `CI` check).

### 4. Add third-party keys

Terraform generates the database URL and session secret itself. Keys from Resend, Stripe and Mux
are yours to supply: each has a parameter holding the word `placeholder`
(`terraform output manual_parameters` lists them). Use separate keys per environment: Stripe test
mode and a separate Mux environment for staging.

```bash
aws ssm put-parameter --overwrite --type SecureString \
  --name /elevate/staging/RESEND_API_KEY --value 're_…'
```

| Integration | Parameters                                                                                     | Where the values come from                              |
| ----------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `resend`    | `RESEND_API_KEY`                                                                               | Resend, after verifying your sending domain             |
| `stripe`    | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_CONNECT_WEBHOOK_SECRET`                  | [`docs/runbooks/stripe.md`](../docs/runbooks/stripe.md) |
| `mux`       | `MUX_TOKEN_ID`, `MUX_TOKEN_SECRET`, `MUX_WEBHOOK_SECRET`, `MUX_SIGNING_KEY`, `MUX_PRIVATE_KEY` | [`docs/runbooks/mux.md`](../docs/runbooks/mux.md)       |

Once an integration's parameters hold real values, set its flag to `true` under `integrations` in
`terraform.tfvars`, run `terraform apply`, and re-run the Deploy workflow (step 6) so the API
restarts with the new configuration. Until then that integration is off: sign-in emails are
written to the API log instead of being sent, video uploads are stored as plain files, and payment
endpoints answer 503.

Webhook endpoints to register, per environment:

- Stripe, account events and Connect events: `https://api.<base>/api/webhooks/stripe`
- Mux: `https://api.<base>/api/webhooks/mux`

### 5. Create the branches

```bash
git push origin main:staging
git push origin main:production
```

### 6. Deploy

Every push to `staging` or `production` runs the **Deploy** workflow. To deploy without a new
commit (for example after changing configuration), run it by hand:

```bash
gh workflow run deploy.yml --ref staging
```

A deploy:

1. builds the API image and pushes it to ECR, tagged with the commit SHA (a commit that already
   has an image, such as one promoted from staging, reuses it);
2. runs the database migrations as a one-off task, and stops if they fail, leaving the running API
   untouched;
3. starts the new API task, waits for it to pass health checks, then stops the old one;
4. builds the three web apps with that environment's URLs, uploads them to S3 and invalidates
   CloudFront.

### 7. Check it

```bash
curl https://api.staging.<domain>/api/health
```

Open `https://app.staging.<domain>`, `https://teach.staging.<domain>` and
`https://support.staging.<domain>`. With Resend off, the sign-in link and code are in the API log:

```bash
aws logs tail "$(terraform output -raw api_log_group)" --follow
```

The sites send their Content-Security-Policy in report-only mode at first. Click through each
site with the browser console open; when it reports no violations, set `csp_report_only = false`
in `terraform.tfvars` and apply.

## Day to day

- **Ship to staging**: open a pull request into `staging` and merge it.
- **Ship to production**: open a pull request from `staging` into `production`, merge, then approve
  the waiting Deploy run.
- **Change infrastructure or configuration**: edit `infra/terraform`, open a pull request (the
  **Infra** workflow checks formatting and validity), then `terraform plan` and `apply` from
  `envs/<environment>` yourself. Changes to the API's environment variables take effect on the
  next deploy.
- **Roll back**: `git revert` the commit on the environment's branch and push. The deploy builds
  and rolls out the reverted code like any other commit. Database migrations are not reversed, so
  keep them additive.
- **Logs**: `aws logs tail /ecs/elevate-<environment>/api --follow`.
- **Native apps**: `apps/learner/eas.json` has a `preview` profile pointing at staging and a
  `production` profile. Replace the `example.com` URLs in it with your domain. Builds run on EAS,
  not AWS.

## Known gaps

- **Staging runs with `NODE_ENV=production`** so that it behaves like production (strict CORS,
  JSON logs). Two things key off that flag and are therefore wrong on staging: Mux assets are not
  created in Mux's test mode, and Support's "open in Stripe" link always points at the Stripe test
  dashboard (also wrong on production with live keys). Both need a small code change.
- **Seeding**: `npm run db:seed` writes its sample media to local disk, so it cannot seed an
  environment that stores files in S3 yet.
- **Private file links**: downloads are presigned with the API task's temporary credentials, so a
  link can stop working before its stated lifetime if those credentials rotate first. Clients
  should request a fresh link on failure.
- **One API task**: the rate limiter counts per process. Keep `api_desired_count = 1` until it has
  a shared store.
- **Universal links** (AASA / assetlinks) for the native apps are not configured.
- **Non-Latin certificate names** need fallback fonts copied into
  `apps/api/assets/fonts/fallback/` before the image is built.

## Tearing down

```bash
cd infra/terraform/envs/staging
terraform destroy
```

Production refuses until you set `protect_data = false` in `envs/production/main.tf` and apply;
that switch guards the database, its final snapshot, the load balancer and the uploads bucket.
