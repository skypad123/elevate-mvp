# ADR 001 — Monorepo layout and per-portal stacks

**Status:** accepted · 2026-11-08

## Context

The spec defines three portals (Learner web + mobile, Teach web, Support web) plus a backend that
owns Postgres, Stripe Connect, media and certificates. The previous repo was a single Expo app with
no backend.

## Decision

- npm workspaces + Turborepo monorepo: `apps/{learner,teach,support,api}`, `packages/{core,db,tokens,web-ui,tsconfig}`.
- **Learner** is one Expo SDK 57 app (expo-router) targeting web, iOS and Android. Checkout is web-only;
  native deep-links to the web course page.
- **Teach** and **Support** are Vite + React 19 + React Router 7 web apps. The course builder needs
  web-native libraries (Tiptap, dnd-kit, React Flow, Mux uploader) that do not fit react-native-web.
- Shared code is consumed as TypeScript source. The API additionally emits `dist/types/client.d.ts`
  so the Hono RPC client type is pre-instantiated for the frontends.
- Biome for lint/format, Vitest for tests, GitHub Actions for CI.

## Consequences

- One React version across the workspace, enforced with root `overrides` and `scripts/check-dupes.mjs`.
- Expo packages are installed only with `npx expo install` (npm `latest` is already SDK 58).
- `react-router` stays on 7.x until Expo ships a React ≥ 19.2.7.
