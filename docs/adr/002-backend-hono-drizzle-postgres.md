# ADR 002 — Own API on Hono + Drizzle + Postgres

**Status:** accepted · 2026-11-08

## Context

Alternatives considered: Supabase (hosted Postgres + auth + Edge Functions) and Expo Router API routes.

## Decision

A single Node service (`apps/api`) built with Hono, Drizzle ORM and Postgres 17 owns all business
rules: magic-link auth with a provider-linkable identity model, role checks, the course approval
state machine, fee computation, Stripe and Mux webhooks, progress/quiz logic and certificate issuance.

## Rationale

- The spec says "get the data model right first" and demands a scheme-capable schema, a per-teacher
  commission field and Stripe-reconcilable earnings. That logic is easiest to test in one typed codebase.
- The invariant "approval is the only path to live" is enforced in one route, not in RLS policies.
- Hono's `hc` client gives end-to-end types to all three frontends.
- Tests run on PGlite with the same generated SQL migrations as production Postgres.

## Consequences

- Local dev needs Docker (Postgres + Mailpit). CI needs neither (PGlite).
- Auth is ~200 lines we own (hashed tokens, 6-digit codes, sliding sessions) instead of a vendor SDK.
