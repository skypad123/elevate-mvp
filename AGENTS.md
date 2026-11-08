# Elevate — agent notes

## Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any Expo code.
npm `latest` for `expo` is SDK 58. This repo is on **SDK 57**: inside `apps/learner`, add packages only
with `npx expo install <pkg>` so versions come from SDK 57's bundled module list.

## Repo map

- `apps/learner` — Expo (expo-router) learner app: web + iOS + Android.
- `apps/teach` — Vite + React teacher portal. `apps/support` — Vite + React internal portal.
- `apps/api` — Hono API (Drizzle, Stripe, Mux, pdf-lib). Exports `@elevate/api/client` for typed RPC.
- `packages/core` — zod contracts + pure domain logic (DAG, money, grading, lesson states).
- `packages/db` — Drizzle schema, migrations, seed. `packages/tokens` — design tokens → CSS.
- `packages/web-ui` — Radix + Tailwind components for the two web portals.
- `docs/spec.md` is the product spec; `docs/adr/` records the architecture decisions.

## Rules

- One copy of `react`, `react-dom`, `hono`, `zod`: pinned via root `overrides`; `npm run check:dupes` verifies.
- `react-router` stays on 7.x (8.x needs a newer React than Expo ships). `typescript` stays `~6.0.3`.
- Every API handler returns `c.json(body, 200)` with an explicit status so RPC response types narrow.
- Money is integer cents; the only fee computation lives in `packages/core/src/domain/money.ts`.
- Course status can reach `live` only through the Support approve route.
- Run `npm run lint` (Biome) and `npx turbo run typecheck test` before committing.

## Expo conventions (apps/learner)

- Routes live in `src/app/`; keep components, hooks and lib code outside it (`src/ui`, `src/lib`, `src/features`).
- Import `Link`, `router`, `useLocalSearchParams`, `ThemeProvider`, `Stack`, `Tabs` from `expo-router`; never from `@react-navigation/*`.
- `npx expo install <pkg>` for anything Expo/React Native; `npx expo install --fix` and `npx expo-doctor` to diagnose.
- `ios/` and `android/` are generated (CNG). Configure native behaviour in `app.json` and config plugins only.
- Expo Go only has its bundled native modules; a library with native code needs a dev build.
