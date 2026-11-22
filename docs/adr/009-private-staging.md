# ADR 009 — Staging reachable only over Tailscale

**Status:** accepted · 2026-11-15

## Context

Staging (ADR 005) was on the public internet: anyone who found `staging.<domain>` could open the
sites, sign up and poke at the API. It is for the team only. The team already uses a personal
Tailscale tailnet. Two things on staging must stay reachable from outside it: Stripe and Mux post
webhooks to the API, and the Deploy workflow checks `/api/health` from a GitHub runner.

## Decision

- **Keep staging's shape identical to production** (CloudFront for the sites, a public ALB for the
  API) and put an IP allowlist in front of it, switched on by the environment module's
  `private_access` flag. A fully private staging (internal ALB, private DNS, no CloudFront) was
  rejected: staging would no longer exercise what production runs, and webhooks would need a
  separate public path anyway.
- **One fixed source IP for the tailnet**: a Tailscale App Connector on a `t4g.micro` with an
  Elastic IP, in staging's VPC. Only traffic for staging's hostnames goes through it, so devices
  need nothing beyond Tailscale being on. An exit node was rejected because it routes all of a
  device's traffic and has to be switched on by hand.
- **CloudFront: a viewer-request CloudFront Function** answers 403 to other IPs. It runs before the
  cache and costs almost nothing. A WAF block is a 403 that the SPA fallback (origin 403 →
  `index.html`) would likely turn into the app; a function's own response should not be, which
  infra/README.md has you check after applying. WAF was also rejected for cost.
- **ALB: deny by default**, with listener rules forwarding `/api/webhooks/*`, `/api/health` and
  the allowed IPs. The security group stays open so webhooks arrive.
- **IPv6 off on staging's distributions**, because the connector only carries IPv4.
- The connector's auth key sits in SSM outside `/elevate/staging/`, which the API can read.

## Consequences

- The connector is a single point of failure for reaching staging. `private_access_extra_cidrs`
  is the fallback, and turning the flag off reopens staging.
- Roughly US$11 a month more for staging. (A `t4g.nano` was tried first; it runs out of memory
  installing Tailscale.)
- Hostnames stay in public DNS; presigned S3 links and Mux playback stay public, as on production.
- Production does not set the flag, so its resources keep their current settings.
