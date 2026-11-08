# Elevate

A learning platform that connects learners with freelance teachers. Teachers author courses in
**Elevate Teach**, the internal team approves them in **Elevate Support**, and learners buy and take
them in **Elevate** (web, iOS, Android). Payments run on Stripe Connect; completion earns a
certificate with a public verification URL.

The product spec is in [`docs/spec.md`](docs/spec.md); architecture decisions are in
[`docs/adr/`](docs/adr/).

## Repository

```
apps/learner    Elevate — Expo SDK 57 (expo-router) · web + iOS + Android
apps/teach      Elevate Teach — Vite + React 19 + React Router 7 + Tailwind v4
apps/support    Elevate Support — Vite + React 19 (review queue · people · transactions)
apps/api        Hono API — Drizzle ORM · Postgres · Stripe Connect · Mux · certificates
packages/core   zod contracts + pure domain logic (course DAG, fee math, grading, lesson states)
packages/db     Drizzle schema · migrations · seed
packages/tokens design tokens → CSS (Tailwind v4 theme) and TS (React Native)
packages/web-ui Radix + Tailwind component library for the web portals
```

## Quick start

```bash
cp .env.example .env
docker compose up -d        # Postgres + Mailpit
npm install
npm run db:migrate && npm run db:seed
npm run dev
```

| App           | URL                              |
| ------------- | -------------------------------- |
| Learner       | http://localhost:8081            |
| Teach         | http://localhost:5173            |
| Support       | http://localhost:5174            |
| API           | http://localhost:4400/api/health |
| Mailpit inbox | http://localhost:8025            |

Everything runs locally without third-party accounts (`VIDEO_DRIVER=local`, `STORAGE_DRIVER=local`,
Mailpit for email). Stripe test keys are needed for the real money loop — see
[`docs/runbooks/`](docs/runbooks/).

## Scripts

| Command                                                       | What it does                                          |
| ------------------------------------------------------------- | ----------------------------------------------------- |
| `npm run dev`                                                 | all apps + API via Turborepo                          |
| `npm run lint` / `npm run lint:fix`                           | Biome                                                 |
| `npx turbo run typecheck test build`                          | what CI runs                                          |
| `npm run check:dupes`                                         | fails if more than one React / hono copy is installed |
| `npm run db:generate` / `db:migrate` / `db:seed` / `db:reset` | Drizzle migrations and seed                           |

## Status

Rebuild in progress on `rebuild/elevate-mvp`. Phase 1 (restructure + tooling) lands without a runnable
app; Phase 2 adds the schema, API, auth and the three portal shells.
