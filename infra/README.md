# Elevate infrastructure

Terraform for the two AWS environments, plus the steps to stand them up from nothing.

| Environment | Branch       | Where it runs                                  | How it deploys                                                   |
| ----------- | ------------ | ---------------------------------------------- | ---------------------------------------------------------------- |
| dev         | `main`       | your machine (`docker compose`, `npm run dev`) | nothing is deployed; CI runs on every push and pull request      |
| staging     | `staging`    | AWS, `*.staging.<domain>`                      | automatically on every push to `staging`                         |
| production  | `production` | AWS, `*.<domain>`                              | on every push to `production`, after a reviewer approves the run |

Code moves forward by pull request: feature branch → `main` → `staging` → `production`.

## What gets created

Per environment, in one AWS account, region `ap-southeast-1`:

| Piece           | AWS                                                                                            | Hostname                               |
| --------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------- |
| API             | ECS Fargate, one task, behind an HTTPS Application Load Balancer; logs in CloudWatch           | `api.`                                 |
| Database        | RDS Postgres 17 in private subnets, reachable only from the API's tasks; two database users    | –                                      |
| Uploads         | Private S3 bucket (presigned uploads and downloads), accessed through the task's IAM role      | –                                      |
| Learner web     | S3 + CloudFront, single-page-app fallback                                                      | `<domain>`                             |
| Teach, Support  | S3 + CloudFront, single-page-app fallback                                                      | `teach.`, `support.`                   |
| DNS and TLS     | Route 53 records, ACM certificates (regional for the API, `us-east-1` for CloudFront)          | under `<domain>` or `staging.<domain>` |
| Release job     | EventBridge Scheduler starts a Fargate task every 15 minutes; dead-letter queue; email alarms  | –                                      |
| Configuration   | SSM Parameter Store under `/elevate/<environment>/`                                            | –                                      |
| Deploy identity | An IAM role that only GitHub Actions jobs in the matching GitHub Environment can assume (OIDC) | –                                      |
| Private access  | Staging only: a Tailscale App Connector (EC2 `t4g.micro` + Elastic IP); see "Private staging"  | –                                      |

Shared by both (the `bootstrap` stack): the Terraform state bucket, GitHub's OIDC provider, and
the `elevate-api` image repository in ECR.

Expect very roughly US$55–65 a month per environment at idle (load balancer, one small Fargate
task, a `t4g` database, public IPv4 addresses), plus about US$11 for staging's Tailscale connector.
This is an estimate, not a quote.

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
- The AWS CLI pointed at `ap-southeast-1`. Terraform and the Deploy workflow set the region
  themselves, but the `aws` commands below (SSM parameters, logs, one-off tasks) use your default
  region, and an account can default to another one, such as Sydney. Set it once:

  ```bash
  aws configure set region ap-southeast-1
  ```

  or export `AWS_REGION=ap-southeast-1` in the shell you run them from.

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
cp terraform.tfvars.example terraform.tfvars    # set root_domain and alarm_email; the file is gitignored
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

1. checks that the commit's Terraform has been applied to the environment, and stops before
   changing anything if it has not (see "Terraform before deploy" below);
2. builds the API image and pushes it to ECR, tagged with the commit SHA (a commit that already
   has an image, such as one promoted from staging, reuses it);
3. registers a new revision of each of the three task definitions, the API's, the migration
   task's and the release task's, with that image;
4. runs the database migrations as a one-off task from the migration task definition, and stops if
   they fail, leaving the running API untouched;
5. starts the new API task, waits for it to pass health checks, then stops the old one;
6. points the release job's schedule at the release revision it registered (see "The release
   job"), so a scheduled run never starts new code before the migrations have run;
7. checks that the database refuses the API's user an update of an attendance row (see "Database
   users");
8. builds the three web apps with that environment's URLs, uploads them to S3 and invalidates
   CloudFront.

#### Terraform before deploy

Every `terraform apply` stores a hash of the Terraform it applied in the SSM parameter
`/elevate/<environment>/deploy/terraform-fingerprint`. The hash covers `envs/<environment>/`
(the `.tf` files and the provider lock file) and everything under `modules/`. The deploy hashes the
same files at the commit it is deploying, using `infra/scripts/terraform-fingerprint.sh`. If the
two hashes differ, that commit changed the environment's Terraform and nobody has applied it yet,
so the deploy fails at its first step with a message saying which directory to apply. Then:

```bash
git switch staging && git pull           # the commit the failed run deployed
cd infra/terraform/envs/staging
terraform plan
terraform apply
gh run rerun <run-id> --failed           # or re-run the failed jobs from the run's page
```

Some things to know:

- Apply from a clean checkout of a commit with the same Terraform as the one being deployed. That
  can be the branch after the merge, or the pull request's head commit before it. Terraform hashes
  the files on disk, so applying with uncommitted edits records a hash that no commit has, and the
  next deploy stops again.
- `terraform.tfvars` and the `bootstrap` stack are not covered. Changes to them still need their
  own apply, as before.
- To see whether an environment is up to date without deploying, compare
  `infra/scripts/terraform-fingerprint.sh staging` with
  `aws ssm get-parameter --name /elevate/staging/deploy/terraform-fingerprint --query Parameter.Value --output text`.
- The check arrived in a commit that also adds the parameter and the deploy role's permission to
  read it. Each environment therefore needs one apply from that commit, or a later one, before its
  next deploy will pass.

### 7. Check it

```bash
curl https://api.staging.<domain>/api/health
```

Open `https://staging.<domain>`, `https://teach.staging.<domain>` and
`https://support.staging.<domain>` (on staging, with Tailscale on: see "Private staging"). With Resend off, the sign-in link and code are in the API log:

```bash
aws logs tail "$(terraform output -raw api_log_group)" --follow
```

The sites send their Content-Security-Policy in report-only mode at first. Click through each
site with the browser console open; when it reports no violations, set `csp_report_only = false`
in `terraform.tfvars` and apply.

## Private staging (Tailscale)

Staging answers only to devices on the tailnet. Its module call sets `private_access = true`;
production leaves it off.

- A Tailscale **App Connector** (`t4g.micro`, Amazon Linux, Elastic IP) runs in staging's VPC.
  Tailnet devices send traffic for `staging.<domain>` and `*.staging.<domain>` through it, so it
  arrives at AWS from the connector's Elastic IP. Everything else on those devices is untouched.
- The three CloudFront sites run a viewer-request function that answers 403 unless the viewer is
  that IP (or one of `private_access_extra_cidrs`). IPv6 is off on them, because the connector only
  carries IPv4.
- The API load balancer answers 403 by default and forwards only the connector's IP, plus two
  public paths: `/api/webhooks/*` (Stripe and Mux, signature-checked) and `/api/health` (the
  Deploy workflow checks it from a GitHub runner).
- Still public, as before: presigned S3 links and Mux playback. The DNS names stay public too;
  outsiders just get 403.

### Setting it up

1. **Tailscale policy file** (admin console → Access controls). Add the connector's tag, the app,
   and auto-approval of the routes it advertises. Use your domain; `terraform output
   tailscale_connector` shows the exact tag and domains.

   ```jsonc
   "tagOwners": {
     "tag:elevate-staging-connector": ["autogroup:admin"]
   },
   "nodeAttrs": [
     {
       "target": ["*"],
       "app": {
         "tailscale.com/app-connectors": [
           {
             "name": "elevate-staging",
             "connectors": ["tag:elevate-staging-connector"],
             "domains": ["staging.<domain>", "*.staging.<domain>"]
           }
         ]
       }
     }
   ],
   "autoApprovers": {
     "routes": {
       "0.0.0.0/0": ["tag:elevate-staging-connector"],
       "::/0": ["tag:elevate-staging-connector"]
     }
   }
   ```

   Merge these into the keys you already have. With the default allow-all policy nothing else is
   needed; with custom ACLs or grants, make sure your devices may reach the routed addresses.
2. **Auth key** (admin console → Settings → Keys): one-off (not reusable), not ephemeral,
   pre-approved, tagged `tag:elevate-staging-connector`. It is used once, to join; tagged nodes do
   not expire afterwards.
3. **Apply** in `envs/staging`. From this point outsiders get 403, and so does everyone until the
   connector has joined.
4. **Hand the key to the connector.** It checks every 30 seconds and joins within a minute:

   ```bash
   aws ssm put-parameter --overwrite --type SecureString \
     --name /elevate/staging-connector/TAILSCALE_AUTH_KEY --value 'tskey-auth-…'
   ```

   The key lives outside `/elevate/staging/` so the API cannot read it.
5. **Check it**, with Tailscale on and then off:

   | Request                                            | Tailscale on | Tailscale off                                  |
   | -------------------------------------------------- | ------------ | ---------------------------------------------- |
   | `https://staging.<domain>` (and teach, support)    | the app      | `403` with the plain-text message, not the app |
   | `curl -i https://api.staging.<domain>/api/auth/me` | `401`        | `403`                                          |
   | `curl https://api.staging.<domain>/api/health`     | `200`        | `200`                                          |

   Then send a test webhook (`stripe trigger …`, or a Mux test upload) and run
   `gh workflow run deploy.yml --ref staging`; both should still succeed.

Devices need Tailscale's DNS (the default "Use Tailscale DNS" setting), because the connector
learns which addresses to route from the DNS lookups. Linux devices also need
`tailscale set --accept-routes`. Phones running the EAS `preview` build just need Tailscale on.

### Running it

- **Connector down?** Open a shell without SSH and look at the join service:

  ```bash
  aws ssm start-session --target <instance_id from `terraform output tailscale_connector`>
  sudo journalctl -u tailscale-join -u tailscaled --no-pager | tail -50
  ```

- **Fallback addresses**: list up to four IPv4 CIDRs in `private_access_extra_cidrs` in
  `terraform.tfvars` and apply; they are let in alongside the connector.
- **Replacing the connector** (a new AMI, or the instance is gone): put a new one-off auth key in
  the parameter first, then
  `terraform apply -replace='module.environment.aws_instance.connector[0]'`. The Elastic IP stays,
  so nothing else changes. Remove the old machine from the Tailscale admin console.
- **Opening staging to everyone again**: set `private_access = false` in `envs/staging/main.tf`
  and apply.

## Day to day

- **Ship to staging**: open a pull request into `staging` and merge it.
- **Ship to production**: open a pull request from `staging` into `production`, merge, then approve
  the waiting Deploy run.
- **Change infrastructure or configuration**: edit `infra/terraform`, open a pull request (the
  **Infra** workflow checks formatting and validity), then `terraform plan` and `apply` from
  `envs/<environment>` yourself. Apply before you merge into the environment's branch: a deploy
  whose Terraform has not been applied stops at its first step ("Terraform before deploy").
  Changes to the API's environment variables take effect on the next deploy.
- **Roll back**: `git revert` the commit on the environment's branch and push. The deploy builds
  and rolls out the reverted code like any other commit. Database migrations are not reversed, so
  keep them additive. The one-time reset below is the exception: it cannot be rolled back. Once a
  class has been sold, no version older than the scheduled-classes release (Part 1) may be
  deployed: an older version treats a class enrollment as a self-paced one
  ([ADR 012](../docs/adr/012-class-records-and-attendance.md)). Once classes are sold, the API goes
  back to Part 1's version only after `class_sales` has been off for 35 minutes, and the release
  task stays on a version that has the job ("The release job", "Ways back").
- **Logs**: `aws logs tail /ecs/elevate-<environment>/api --follow`.
- **Native apps**: `apps/learner/eas.json` has a `preview` profile pointing at staging and a
  `production` profile. Replace the `example.com` URLs in it with your domain. Builds run on EAS,
  not AWS.

## Database users

Each environment's database has two users
([ADR 012](../docs/adr/012-class-records-and-attendance.md)):

| User          | Connects as it                                                         | SSM parameters under `/elevate/<environment>/` |
| ------------- | ---------------------------------------------------------------------- | ---------------------------------------------- |
| `elevate`     | the migration task only; it is the RDS master user and owns the tables | `DATABASE_URL`                                 |
| `elevate_api` | the running API, and every one-off task from the API's task definition | `DATABASE_URL_API`, `API_DATABASE_PASSWORD`    |

Terraform generates `elevate_api`'s password. Each run of the migrations creates the user if it is
missing, sets its password, and sets its grants: select, insert, update and delete on every table,
except that it cannot update, delete or truncate `attendance_events`, and cannot update or truncate
`attendance_event_locations`. Default privileges give it the same on tables that later migrations
create.

### Three task definitions

All three run the same image, with the same roles, sizing, log group and container name. The
deploy registers a new revision of each.

| Task definition | GitHub variable           | Database user                          | What runs from it                                          |
| --------------- | ------------------------- | -------------------------------------- | ---------------------------------------------------------- |
| API             | `ECS_TASK_FAMILY`         | `elevate_api`, as `DATABASE_URL`       | the service, `seed.js`, `previews.js`, `check-api-role.js` |
| Migration       | `ECS_MIGRATE_TASK_FAMILY` | `elevate`, as `MIGRATION_DATABASE_URL` | `migrate.js` and `reset-schema.js`, nothing else           |
| Release         | `ECS_RELEASE_TASK_FAMILY` | `elevate_api`, as `DATABASE_URL`       | `release.js`, its built-in command; see "The release job"  |

The release task has the API's whole environment and secrets and no port. Its command is part of
the task definition because a schedule cannot change the command of the task it starts.

The migration task holds only `MIGRATION_DATABASE_URL`, `API_DATABASE_USER` and
`API_DATABASE_PASSWORD`, none of the API's other configuration, so the running API never holds the
owner's credential.

### Checking the API's user

After rolling the service, the deploy runs `["node", "dist/check-api-role.js"]` once from the new
API revision. It tries an update of `attendance_events` that matches no row, so it changes nothing
even where the update is allowed.

| Exit code | Meaning                                                                      |
| --------- | ---------------------------------------------------------------------------- |
| 0         | The database refused the update (`42501`), as intended.                      |
| 1         | The update was allowed: the API's user has a grant it must not have.         |
| 2         | Any other error, such as no `DATABASE_URL` or no connection to the database. |

Any code but 0 fails the run. By then the new version is already serving, and the error says so.
The step is skipped while `api_uses_restricted_database_user` is false. To run the check by hand,
use the `run-task` call under "Seeding" with the command `["node", "dist/check-api-role.js"]`.

### Settings

These are Terraform variables, set in the environment's `terraform.tfvars`.

- **`classes`** (default `false`) is the API's `CLASSES` setting. Off, every class route answers
  404, a learner's class list is empty, and the demo seed creates no class data. Staging sets it
  to `true`; its `terraform.tfvars` is not tracked, so add the line by hand. Production turns it
  on in the rollout of class sales ("The first deploy with the release job"). A change takes
  effect on the next deploy.
- **`class_sales`** (default `false`) is the API's `CLASS_SALES` setting. Off, no class is on sale
  and class checkout answers `class_not_on_sale`; seats already sold, withdrawals, refunds, the
  release job and check-in keep working. This is the switch that stops selling. A change takes
  effect on the next deploy.
- **`release_schedule_enabled`** (default `false`) turns the release job's schedule on, and with it
  the alarm on runs that did not finish. Never set it back to `false` while any profile is opted
  in (see "The release job"): that stops the job and deletes the alarm that would say so. A
  change takes effect on `terraform apply`.
- **`alarm_email`** (required) is the one address the release job's alarms email. A plan or apply
  fails without it.
- **`api_uses_restricted_database_user`** (default `true`) is the way back. If `elevate_api`
  breaks a path, set it to `false`, `terraform apply`, copy `github_environment_variables` into
  the GitHub Environment again (step 3 of Setup), and run Deploy. The API then connects as
  `elevate`, and the deploy skips its check, because `API_USES_RESTRICTED_DATABASE_USER` is now
  `false`. The same steps with `true` return to `elevate_api`. The migrations keep the user and its
  grants either way.

### The first deploy with two users

Do staging first, and production after staging has been checked. Before the first deploy of the
commit that adds the migration task:

1. On staging, add `classes = true` to `envs/staging/terraform.tfvars`.
2. From a clean checkout of the commit being deployed, `terraform plan` and `terraform apply` in
   `envs/<environment>`. This creates the two parameters, the migration task definition and the
   deploy role's permission to run it. The running service does not restart.
3. Copy `github_environment_variables` into the GitHub Environment again (step 3 of Setup), so
   `ECS_MIGRATE_TASK_FAMILY` and `API_USES_RESTRICTED_DATABASE_USER` exist. Without
   `ECS_MIGRATE_TASK_FAMILY` the deploy stops at "Register the task definition".
4. Deploy. The migrations, run from the migration task, create `elevate_api`; the service then
   rolls onto it, and the check runs.
5. On staging, run the demo seed (see "Seeding").

Between steps 2 and 4, run no one-off task from the API's task definition: its newest revision
connects as `elevate_api`, which does not exist until the deploy's migrations create it.

## Seeding

The API image has a seed command, run as a one-off task from the API's task definition:

```bash
# The newest revision of the family is the one the last deploy registered.
TASK_DEFINITION=$(aws ecs describe-task-definition --task-definition "$ECS_TASK_FAMILY" \
  --query taskDefinition.taskDefinitionArn --output text)

aws ecs run-task \
  --cluster "$ECS_CLUSTER" \
  --task-definition "$TASK_DEFINITION" \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$ECS_SUBNETS],securityGroups=[$ECS_SECURITY_GROUP],assignPublicIp=ENABLED}" \
  --overrides "$(jq -cn --arg name "$ECS_CONTAINER" '{containerOverrides: [{name: $name,
    command: ["node", "dist/seed.js", "--demo"]}]}')"
```

The values come from `terraform output github_environment_variables` in `envs/<environment>`.

- `["node", "dist/seed.js", "--demo"]` for staging: the super admin, a support agent, demo
  teachers with their courses, a writer on the first demo profile, a demo company with a manager
  (no courses), two promo codes and a learner.
  The demo teachers have no payout account, so their paid courses cannot be bought until someone
  connects Stripe.
- `["node", "dist/seed.js", "--admin-only"]` for production: the super admin and nothing else.

Both need `SEED_SUPER_ADMIN_EMAIL` in the task's environment and write course thumbnails through
the API's own storage, so they land in the environment's S3 bucket. Running a seed twice is safe.

With `classes` on, `--demo` also creates a demo class on the first demo profile: published, in
person, on that profile's first course on sale, taught by the demo writer, with three blocks from
09:00 to 17:00 Singapore time on the day of the run and the two days after. It has 20 class
enrollments: the demo learner and 19 made-up class learners. A later run reuses the newest demo
class while any of its blocks has not ended, and only adds enrollments that are missing, so a
second run within one class's dates adds no class. Once the last block has ended, the next run
creates a fresh class. The class has no venue position: its instructor sets one on the roster
screen ("Set the venue location here") before a code can be shown.

To put testers in the demo class, pass their addresses, comma-separated, as an environment
override on the seed task, as the reset passes `ALLOW_SCHEMA_RESET`:

```bash
  --overrides "$(jq -cn --arg name "$ECS_CONTAINER" '{containerOverrides: [{name: $name,
    command: ["node", "dist/seed.js", "--demo"],
    environment: [{name: "SEED_CLASS_LEARNER_EMAILS", value: "<address>,<address>"}]}]}')"
```

An address nobody has gets a new user; an existing user's name is not changed.

## Hover previews

A course card's hover preview is a 4-second clip of the course's video, fetched once from Mux and
stored under `public/previews/` ([ADR 011](../docs/adr/011-course-preview-clips.md)). Clips are
made when Support approves a course, when a change set is approved, and when someone saves the
preview in Teach. They need `integrations.mux`; with the local video driver none is made. The API
image has three commands for them, run as one-off tasks like the seed (the same `run-task` call,
with a different command):

- `["node", "dist/previews.js", "backfill"]` makes or repairs the clip of every live course and
  prints a count of each outcome. Run it after a Mux outage, and after previews are switched back
  on. A second run asks Mux only for courses whose clip is not what the rule wants.
- `["node", "dist/previews.js", "count"]` prints the number of live courses and how many have a
  clip.
- `["node", "dist/previews.js", "check", "<mediaId>"]` (optionally `"--start", "<seconds>"`)
  asks Mux for one clip of that video and prints whether it came back, its size and how long it
  took. It stores nothing. Run it after a Mux SDK upgrade or a change to the clip's shape. Each
  run uses one of the video's 5 clips for good and is not stopped at 5, so run it on a video
  Elevate uploaded, not on a teacher's.

**Switching previews off** everywhere: set `course_previews = false` in the environment's
`terraform.tfvars`, `terraform apply`, and run Deploy again. That is a pause, not a takedown: the
catalog stops returning clips and none is made, but stored files stay and are still served to
anyone who has an address. A teacher deletes one course's clip by turning its preview off in
Teach.

Clips that are hidden or switched off with a file still stored (a delete that failed is retried
at the next refresh of that course):

```sql
select id from courses where preview_key is not null and (preview_source_media_id is null or not preview_enabled)
```

## The release job

The release job sends seat refunds, releases held class money and pays the profiles that sell
classes ([ADR 013](../docs/adr/013-class-sales-and-held-payouts.md)). It is `node dist/release.js`,
the built-in command of the release task definition, started every 15 minutes by an EventBridge
Scheduler schedule. It connects as `elevate_api` and logs to the API's log group. A run takes a
database lock, so two runs never overlap: a run that finds the lock held logs
`release_run_locked` and exits. Every step works from stored state, so a run that stops part-way
is followed by one that sends nothing twice.

| Piece             | Name                                      | Notes                                                                                                                                                       |
| ----------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Task definition   | `elevate-<environment>-release`           | `ECS_RELEASE_TASK_FAMILY`; see "Three task definitions"                                                                                                     |
| Schedule          | `elevate-<environment>-release`           | `RELEASE_SCHEDULE_NAME`; `rate(15 minutes)`, no flexible window. A start that fails is retried for up to 900 seconds, then goes to the queue                |
| Dead-letter queue | `elevate-<environment>-release-dlq`       | Starts that failed after their retries, kept 14 days                                                                                                        |
| Scheduler role    | `elevate-<environment>-release-scheduler` | May run the release family in this cluster and pass the API's two roles; trusts this account only                                                           |
| Alarm topic       | `elevate-<environment>-release-alarms`    | Emails `alarm_email`. Not encrypted: CloudWatch alarms cannot publish to a topic under the AWS-managed SNS key. The emails hold only alarm and metric names |

Terraform creates the schedule once, pointing at its own revision of the task definition (the
placeholder image) and disabled until `release_schedule_enabled` is set. After that Terraform
ignores which revision the schedule starts, so an apply cannot point it back at the placeholder.
Only the deploy changes it, after the migrations and the roll; a deploy that fails earlier leaves
the schedule on the previous revision.

**The schedule must not be disabled while any profile is opted in.** Without the job no seat
refund is sent and no opted-in profile is paid, self-paced money included. To stop selling, set
`class_sales = false` instead. A profile is opted in while its payout account is not on automatic
payouts:

```sql
select count(*) from payout_accounts where payout_mode <> 'automatic'
```

### Reading a run

- **Support → Payouts** (shown while classes are on): the last finished run, with a warning when
  none has finished recently; recent runs with their counts and errors; classes under review;
  refunds that wait or failed; cancellations not yet complete; payments released by the 85-day
  limit; failed payouts; and money no row names.
- **The logs.** Each run that gets the lock ends with one JSON line whose `event` is
  `release_run_finished`, with `runId`, `refundsSent`, `classesReleased`, `payoutsCreated` and
  `needingAttention`. A step that fails logs `release run step failed` with the step's name, and
  the run carries on. A run that fails before its last line logs `release_run_failed` and exits 1.

  ```bash
  aws logs tail /ecs/elevate-<environment>/api --since 1h \
    --filter-pattern '{ $.event = "release_run_finished" }'
  ```

### Starting a run by hand

When the schedule cannot start the job, start the revision the schedule points at, as a one-off
task. The command is part of the task definition, so there is no override. Use the schedule's
revision, not the family's newest: a deploy registers the newest before its migrations run.

```bash
TASK_DEFINITION=$(aws scheduler get-schedule --name "$RELEASE_SCHEDULE_NAME" \
  --query Target.EcsParameters.TaskDefinitionArn --output text)

aws ecs run-task \
  --cluster "$ECS_CLUSTER" \
  --task-definition "$TASK_DEFINITION" \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$ECS_SUBNETS],securityGroups=[$ECS_SECURITY_GROUP],assignPublicIp=ENABLED}"
```

The values come from `terraform output github_environment_variables` in `envs/<environment>`; the
deploy role may run both calls. A run started while another holds the lock does nothing.

### Pointing the schedule back

For a fault in the job's code, point the schedule at an earlier revision, or fix forward. Older
revisions stay registered, and the API service can stay on the new version. List them, choose
one, and write the schedule back with that revision and everything else as read, as the deploy
does:

```bash
aws ecs list-task-definitions --family-prefix "$ECS_RELEASE_TASK_FAMILY" --sort DESC \
  --query 'taskDefinitionArns[:5]'

PREVIOUS=<the revision's ARN>
aws scheduler get-schedule --name "$RELEASE_SCHEDULE_NAME" > schedule-current.json
jq --arg arn "$PREVIOUS" '
  {Name, GroupName, Description, ScheduleExpression, ScheduleExpressionTimezone,
   StartDate, EndDate, State, KmsKeyArn, FlexibleTimeWindow, ActionAfterCompletion, Target}
  | .Target.EcsParameters.TaskDefinitionArn = $arn
  | walk(if type == "object" then with_entries(select(.value != null and .value != [])) else . end)
' schedule-current.json > schedule-next.json
aws scheduler update-schedule --cli-input-json file://schedule-next.json
```

The next deploy points it at the revision it registers.

### Alarms

Four alarms email `alarm_email`. Each emails once when it goes into alarm and stays there until
its cause is gone; nothing is sent when it clears.

| Alarm                                             | Fires when                                                                                                                                                                                        | What to do                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `elevate-<environment>-release-not-finished`      | No run finished in 30 minutes. It exists only while the schedule is on.                                                                                                                           | Refunds and payouts have stopped. Check that the schedule is enabled and its revision exists, look in the logs for `release_run_failed` and `release_run_locked`, and look at the dead-letter queue. A task stuck holding the lock: `aws ecs list-tasks --cluster "$ECS_CLUSTER" --family "$ECS_RELEASE_TASK_FAMILY"`, then `aws ecs stop-task`. Then start a run by hand.      |
| `elevate-<environment>-release-needing-attention` | A run's `needingAttention` was above 0: a seat refund row that failed, or is ready and unsent for a day; a payout that failed in the last day, or has been `sending` for a day; or a failed step. | Open Support → Payouts. A super admin retries or closes a failed refund row. A refund Stripe accepted and then failed cannot be retried: refund the learner another way and close the row. A failed payout is chosen again the next day; check the profile's bank details in Stripe. A failed step is in the recent runs' errors and in the `release run step failed` log line. |
| `elevate-<environment>-release-failed`            | A run logged `release_run_failed`: it failed before its last line, for example with no database connection.                                                                                       | Read the `error` on that log line and fix it. The next scheduled run tries again.                                                                                                                                                                                                                                                                                               |
| `elevate-<environment>-release-dead-letter`       | The schedule could not start the task after its retries.                                                                                                                                          | See below.                                                                                                                                                                                                                                                                                                                                                                      |

**A message in the dead-letter queue** is a start that failed. Read why, fix it (a revision that
no longer exists, a missing permission, no Fargate capacity), start a run by hand, then empty the
queue; the alarm clears when it is empty. A missed run loses nothing: the next run does all the
missed one would have done.

```bash
QUEUE_URL=$(aws sqs get-queue-url --queue-name elevate-<environment>-release-dlq \
  --query QueueUrl --output text)
aws sqs receive-message --queue-url "$QUEUE_URL" --max-number-of-messages 10 \
  --message-attribute-names All
aws sqs purge-queue --queue-url "$QUEUE_URL"
```

### Ways back

- **Selling**: set `class_sales = false`, apply and deploy. No new seat is sold; seats already
  sold, withdrawals, refunds, check-in and the job keep working.
- **The job's code**: point the schedule back (above), or fix forward.
- **The API's code**: back to Part 1's version only after `class_sales` has been off for 35
  minutes, so no reservation is open. The schedule stays on a revision that has `release.js`; no
  version older than Part 1's may be deployed.
- **Paying a profile when the job cannot run**, the last resort. If the job has not run for more
  than a day, start a run by hand first. If that fails too and a profile must be paid, pay it from
  the Stripe dashboard: open the profile's connected account and pay out no more than its
  available balance less the class money it holds (the held total on the profile's Earnings page
  in Teach, which a super admin can open). Then a super admin records the payout as a correction of
  minus the amount paid, with the Stripe payout's id in the reason. Without it, the next payout
  pays the same payments again. Support → Payouts offers "Add correction" only on a row of money
  no row names; for any other profile, the same correction is
  `POST /api/support/payout-accounts/<payoutAccountId>/corrections` with
  `{ "amountCents": -<amount>, "reason": "<why>" }`, as a super admin.

### The first deploy with the release job

Do staging first, and production only after staging has been checked. Before the first deploy of
the commit that adds the release task:

1. Add `alarm_email = "<address>"` to the environment's `terraform.tfvars`. Leave `class_sales`
   and `release_schedule_enabled` off.
2. In Stripe (the sandbox for staging, live mode for production), work through "Checklist before
   the first class is sold" in [`docs/runbooks/deploy.md`](../docs/runbooks/deploy.md): the two
   Express dashboard features off, and the four new event types on the two endpoints.
3. From a clean checkout of the commit being deployed, `terraform plan` and `terraform apply` in
   `envs/<environment>`. Expect the release task definition, the queue, the scheduler role, the
   disabled schedule, the topic and its subscription, the metric filters, three alarms, the deploy
   role's new permissions, and a new revision of the API's task definition with `CLASS_SALES`.
4. Confirm the subscription from the email AWS sends to `alarm_email`.
5. Copy `github_environment_variables` into the GitHub Environment again (step 3 of Setup), so
   `ECS_RELEASE_TASK_FAMILY` and `RELEASE_SCHEDULE_NAME` exist. Without them the deploy stops at
   "Register the task definition".
6. Deploy. It registers the release task with the real image and points the schedule, still
   disabled, at it.
7. Set `release_schedule_enabled = true` and apply. This also creates the fourth alarm. Expect a
   `release_run_finished` line within 15 minutes, and the run on Support → Payouts. With no
   profile opted in, a run does nothing and finishes.

Do not enable the schedule before step 6: until then it points at the placeholder image.

Then the rollout of class sales:

8. On staging, set `class_sales = true`, apply and deploy. Opt in one profile whose Stripe account
   has passed the liveness check, and rehearse the design's staging steps
   ([`scheduled-classes-selling.md`](../docs/designs/scheduled-classes-selling.md), Verification
   Plan, steps 12 to 15): a class payment page offers Card and PayNow only, each refund kind
   matches the amounts table, and each way back works. To rehearse the not-finished alarm,
   disable the schedule outside Terraform (the `update-schedule` call under "Pointing the schedule
   back", with `.State = "DISABLED"` in place of the new ARN), expect the email within 45 minutes,
   and enable it again the same way. Setting `release_schedule_enabled = false` would delete that
   alarm with the schedule's state.
9. On production, only after Stripe's support has answered how the 90 days are counted, a lawyer
   has read both sets of terms, the author has signed off the Chinese text, and the staging
   amounts matched: email every teacher 30 days before the Express dashboard features go off in
   live mode, then do steps 1 to 7. Then turn on `classes`, then `class_sales` (each an apply and a
   deploy), and invite the beta profiles.

## Resetting an environment

One time only, for the teacher profiles change. That change replaced the earlier migrations with
a single new one, so a database that already has the old tables cannot be migrated: it has to be
emptied. **Everything in the database is lost, and `git revert` cannot bring it back.** Do staging
first; do production only after staging has been checked.

The values used below come from `terraform output github_environment_variables` in
`envs/<environment>`.

1. **Push the commit to the environment's branch.** Deploy builds the image and registers the task
   definitions, then fails at "Run database migrations". That is expected: the database lists two
   old migrations and the image holds one new one, so the migration command stops with
   `we found 2 migrations (ids: 1, 2) in the database that do not match any local migration`. It
   changes nothing, and the running API stays on the old version. On production, the run first
   waits for the required reviewer.
2. **Empty the database** with the migration task definition that run registered. The reset needs
   the database owner, so it runs from the migration task, not the API's (see "Database users"):

   ```bash
   # The newest revision of the family is the one the failed run registered.
   TASK_DEFINITION=$(aws ecs describe-task-definition --task-definition "$ECS_MIGRATE_TASK_FAMILY" \
     --query taskDefinition.taskDefinitionArn --output text)

   aws ecs run-task \
     --cluster "$ECS_CLUSTER" \
     --task-definition "$TASK_DEFINITION" \
     --launch-type FARGATE \
     --network-configuration "awsvpcConfiguration={subnets=[$ECS_SUBNETS],securityGroups=[$ECS_SECURITY_GROUP],assignPublicIp=ENABLED}" \
     --overrides "$(jq -cn --arg name "$ECS_CONTAINER" '{containerOverrides: [{name: $name,
       command: ["node", "dist/reset-schema.js"],
       environment: [{name: "ALLOW_SCHEMA_RESET", value: "yes"}]}]}')"
   ```

   The command refuses to run without `ALLOW_SCHEMA_RESET=yes`. The variable is set only in this
   one call and never in Terraform, so a normal deploy cannot empty the database. The task's log
   ends with `schema reset on <host>/<database>`.
3. **Run Deploy again** for the branch: `gh workflow run deploy.yml --ref <branch>`. It reuses the
   image, applies the new migration and rolls the service. Between step 2 and this step the old
   API answers with errors; that is accepted because there are no users yet.
4. **Seed** (see "Seeding" above): the `run-task` call there, from the API's task definition, with
   `command: ["node", "dist/seed.js", "--demo"]` on staging or `"--admin-only"` on production,
   and without `ALLOW_SCHEMA_RESET`.

An environment whose database was never migrated has nothing to reset: step 1 succeeds, and only
step 4 remains.

Stripe test accounts created before the reset have no row in the new database. Their
`account.updated` events are stored as `unknown_account` errors in `webhook_events`; ignore them,
or close those accounts in the Stripe test dashboard.

## Known gaps

- **Staging runs with `NODE_ENV=production`** so that it behaves like production (strict CORS,
  JSON logs). Two things key off that flag and are therefore wrong on staging: Mux assets are not
  created in Mux's test mode, and Support's "open in Stripe" link always points at the Stripe test
  dashboard (also wrong on production with live keys). Both need a small code change.
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
