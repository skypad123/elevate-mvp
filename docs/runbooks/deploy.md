# Deploying

Elevate is four deployables plus Postgres. Everything is configured by environment variables listed
in `.env.example`; nothing reads a config file at runtime.

| Piece                        | What it is                                                                | Suggested host                        |
| ---------------------------- | ------------------------------------------------------------------------- | ------------------------------------- |
| `apps/api`                   | Node 24 Hono server (`npm run build` → `dist/server.js`), port `API_PORT` | Fly.io / Railway / any container host |
| Postgres 17                  | `citext` + `pg_trgm` extensions, migrations in `packages/db/drizzle`      | Neon / Supabase Postgres / RDS        |
| `apps/teach`, `apps/support` | Static Vite builds (`dist/`)                                              | Cloudflare Pages / Netlify / S3+CDN   |
| `apps/learner` (web)         | Static Expo export (`dist/`, `web.output: single`)                        | Same as above, with SPA rewrites      |
| `apps/learner` (iOS/Android) | EAS Build (`eas build`), EAS Update for JS                                | Expo Application Services             |

## API

1. `npm ci && npm run build -w apps/api` (also builds `packages/*` it imports). Run with
   `node apps/api/dist/server.js`; the Dockerfile is left to the host (Node 24 base image, copy the
   repo, `npm ci --omit=dev` after building).
2. Required env: `DATABASE_URL`, `SESSION_SECRET` (32+ random chars), `API_URL`, `LEARNER_URL`,
   `TEACH_URL`, `SUPPORT_URL` (these three are also the CORS allow-list in production),
   `MAIL_DRIVER=resend` + `RESEND_API_KEY` + `MAIL_FROM`, `STORAGE_DRIVER=s3` + the `S3_*` keys
   (R2 works: set `S3_ENDPOINT`), `VIDEO_DRIVER=mux` + `MUX_*`, `STRIPE_SECRET_KEY` +
   `STRIPE_WEBHOOK_SECRET` + `STRIPE_CONNECT_WEBHOOK_SECRET`, `NODE_ENV=production`.
3. Migrations: `npm run db:migrate` against the production `DATABASE_URL` before the new API
   version takes traffic (migrations are additive so far). Seed only on staging.
4. Webhooks: a Stripe endpoint for `checkout.session.completed`, `checkout.session.async_payment_*`,
   `charge.refunded` on the account, and a **Connect** endpoint for `account.updated`, both pointing
   at `https://<api>/api/webhooks/stripe`; a Mux endpoint for `video.*` at `/api/webhooks/mux`.
5. Certificates: copy Noto Sans SC / Noto Sans Tamil into `apps/api/assets/fonts/fallback/` in the
   image (or set `CERTIFICATE_FALLBACK_FONTS`) so non-Latin names render.
6. The rate limiter is per instance and in memory; run one instance, or put a shared limiter at the
   edge before scaling out.

## Web portals and learner web

- `npm run build` at the root builds all three. Serve each `dist/` as a static site with a rewrite
  of every path to `index.html` (React Router and expo-router are client-side routers; the public
  certificate URL `/c/{token}` depends on it).
- `VITE_API_URL` (portals) and `EXPO_PUBLIC_API_URL` (learner) must be the public API URL at build
  time. `EXPO_PUBLIC_WEB_URL` is the learner web origin used for native → web hand-offs.
- Security headers for the static hosts: `X-Frame-Options: DENY` (the apps are never framed),
  `Referrer-Policy: strict-origin-when-cross-origin`, and a CSP that allows the API origin,
  `stream.mux.com`/`image.mux.com`, Stripe (`js.stripe.com`, `checkout.stripe.com`) and Google
  Fonts.

## Native

- `eas build --platform all` from `apps/learner` (CNG: `ios/` and `android/` are generated from
  `app.json`; the `expo-video`, `expo-audio`, `expo-secure-store` plugins and the Atelier icons are
  configured there). Add `eas.json` with `production` (store) and `preview` (internal) profiles.
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
