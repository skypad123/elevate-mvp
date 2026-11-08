# Local development

## Prerequisites

- Node 22.12+ (Node 24 is what CI uses; `.nvmrc` says 24)
- npm 11
- Docker Desktop (Postgres + Mailpit)
- Optional: Stripe CLI (`brew install stripe/stripe-cli/stripe`) for webhooks, Expo Go on a phone

## First run

```bash
cp .env.example .env            # edit SEED_SUPER_ADMIN_EMAIL at minimum
docker compose up -d            # Postgres on :5432, Mailpit UI on http://localhost:8025
npm install
npm run db:migrate
npm run db:seed
npm run dev                     # api :4400 · learner web :8081 · teach :5173 · support :5174
```

## Signing in

Magic links are delivered to Mailpit (http://localhost:8025). Each email carries a link (web) and a
6-digit code (mobile). The seeded super admin can sign in to Elevate Support.

## Ports

| Service            | URL                              |
| ------------------ | -------------------------------- |
| API                | http://localhost:4400/api/health |
| Learner (Expo web) | http://localhost:8081            |
| Teach              | http://localhost:5173            |
| Support            | http://localhost:5174            |
| Mailpit            | http://localhost:8025            |

## Mobile

Open the learner app in Expo Go from the Metro QR code. The app targets the API on the same host as
Metro (port 4000) by default, so a phone on the same Wi-Fi works without configuration. To override,
create `apps/learner/.env` with `EXPO_PUBLIC_API_URL=http://<lan-ip>:4400`.

## Useful commands

```bash
npm run lint                 # Biome
npx turbo run typecheck test # all packages
npm run check:dupes          # one React / hono copy
npm run db:reset             # drop + migrate + seed (local only)
```

## Verifying on a phone with Expo Go

The learner app is one codebase for web, iOS and Android. Expo Go (App Store / Play Store) runs it
without a native build as long as only Expo's bundled modules are used, which is the case here.

1. `npm -w apps/learner start` (or `npm run dev` at the root) and make sure the phone is on the same
   Wi-Fi as this machine. The API and Metro are reached through the machine's LAN address: the app
   rewrites `localhost` API URLs to the host that served the bundle, so nothing to configure.
2. Scan the QR code with Expo Go. Sign in with the 6-digit code from the email (Mailpit at
   http://localhost:8025, or the real inbox).
3. Explore → course → Enrol on a free course, or "Continue on web" for a paid one → My Learning →
   trail → lesson (video through `expo-video`, audio through `expo-audio`, text, quiz) → certificate
   (Download PDF opens the system browser; Share uses the native share sheet).
4. Dark mode follows the system setting; the pill tab bar respects the home-indicator inset.

`npx expo-doctor` in `apps/learner` checks the dependency set against SDK 57, and
`npm run build -w apps/learner` exports the iOS and Android bundles as well as web, so a
native-only bundling error fails CI even though CI has no simulator.
