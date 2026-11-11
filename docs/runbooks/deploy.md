# Deploying

Elevate is four deployables plus Postgres. Everything is configured by environment variables listed
in `.env.example`; nothing reads a config file at runtime.

Staging and production run on AWS and are created with Terraform. **Setup, the deploy pipeline and
day-to-day operations are in [`infra/README.md`](../../infra/README.md)**; the reasoning is in
[ADR 005](../adr/005-aws-hosting-and-environments.md). This page keeps the application-level facts
that hold on any host.

| Piece                        | What it is                                                           | Where it runs             |
| ---------------------------- | -------------------------------------------------------------------- | ------------------------- |
| `apps/api`                   | Node 24 Hono server, image built from `apps/api/Dockerfile`          | ECS Fargate behind an ALB |
| Postgres 17                  | `citext` + `pg_trgm` extensions, migrations in `packages/db/drizzle` | RDS                       |
| `apps/teach`, `apps/support` | Static Vite builds (`dist/`)                                         | S3 + CloudFront           |
| `apps/learner` (web)         | Static Expo export (`npm run build:web`, `web.output: single`)       | S3 + CloudFront           |
| `apps/learner` (iOS/Android) | EAS Build (`eas build`), EAS Update for JS                           | Expo Application Services |

Branches: `main` and `v0` are development (local only), `staging` and `production` deploy on push.

## API

1. Image: `docker build -f apps/api/Dockerfile -t elevate-api .` from the repo root. It contains
   `dist/server.js` (the default command) and `dist/migrate.js`, with the workspace packages
   bundled in. Outside Docker: `npm run build -w @elevate/api`, then `npm run start:prod`.
2. Required env: `DATABASE_URL`, `SESSION_SECRET` (32+ random chars), `API_URL`, `LEARNER_URL`,
   `TEACH_URL`, `SUPPORT_URL` (these three are also the CORS allow-list in production),
   `NODE_ENV=production`, and `STORAGE_DRIVER=s3` + `S3_BUCKET` + `S3_REGION`. On AWS leave the S3
   keys unset so the task role is used; for R2 or MinIO set `S3_ENDPOINT` and the two keys.
   Optional integrations: `MAIL_DRIVER=resend` + `RESEND_API_KEY` + `MAIL_FROM`,
   `VIDEO_DRIVER=mux` + `MUX_*`, `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` +
   `STRIPE_CONNECT_WEBHOOK_SECRET`.
3. Migrations: `node dist/migrate.js` (in the image) against the target `DATABASE_URL` before the
   new API version takes traffic; the Deploy workflow does this. Migrations are additive so far.
   `MIGRATIONS_DIR` points the bundle at the SQL files. Seed only on staging.
4. Webhooks: a Stripe endpoint for `checkout.session.completed`, `checkout.session.async_payment_*`,
   `charge.refunded` on the account, and a **Connect** endpoint for `account.updated`, both pointing
   at `https://<api>/api/webhooks/stripe`; a Mux endpoint for `video.*` at `/api/webhooks/mux`.
5. Certificates: copy Noto Sans SC / Noto Sans Tamil into `apps/api/assets/fonts/fallback/` before
   building the image (or set `CERTIFICATE_FALLBACK_FONTS`) so non-Latin names render.
6. The rate limiter is per instance and in memory; run one instance, or put a shared limiter at the
   edge before scaling out.

## Web portals and learner web

- Serve each `dist/` as a static site with a rewrite of every path to `index.html` (React Router
  and expo-router are client-side routers; the public certificate URL `/c/{token}` depends on it).
  CloudFront does this through its error responses.
- `VITE_API_URL` and `VITE_LEARNER_URL` (portals) and `EXPO_PUBLIC_API_URL` and
  `EXPO_PUBLIC_WEB_URL` (learner) are compiled in at build time; the Deploy workflow sets them from
  the GitHub Environment.
- Security headers (`X-Frame-Options: DENY`, `Referrer-Policy`, HSTS and a CSP allowing the API,
  the uploads bucket, Mux, Stripe and Google Fonts) are set by the CloudFront response headers
  policy in `infra/terraform/modules/static_site`.

## Native

- `eas build --platform all` from `apps/learner` (CNG: `ios/` and `android/` are generated from
  `app.json`; the `expo-video`, `expo-audio`, `expo-secure-store` plugins and the Atelier icons are
  configured there). `eas.json` has `preview` (internal, staging API) and `production` (store)
  profiles; replace its `example.com` URLs with the real domain.
- JS-only changes ship with `eas update`; native module changes need a new build.
- Universal links for `elevate://verify?token=` are handled by `(auth)/verify.tsx`; associate the
  learner web domain with the app (AASA / assetlinks) once the domain is final.

## Checklist before the first real transaction

- [ ] Stripe Connect platform profile completed and the `losses.payments: 'application'`
  acknowledgement accepted (`docs/runbooks/stripe.md`).
- [ ] `DEFAULT_COMMISSION_BPS` set; per-teacher rates are edited by a super admin in Support.
- [ ] `STRIPE_FEE_BPS` / `STRIPE_FEE_FIXED_CENTS` match the negotiated Stripe pricing.
- [ ] A `super_admin` exists (`SEED_SUPER_ADMIN_EMAIL` on the first migration+seed, or grant via
  Support → People → Roles).
- [ ] Run the manual money loop (`docs/runbooks/money-loop.md`) against the production build in
  Stripe test mode before switching to live keys.
