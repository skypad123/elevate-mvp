# Elevate — MVP Build Spec

**Product:** learning platform connecting learners with teachers. Teachers author courses; the platform handles commerce and (later) SkillsFuture / SG Culture Pass compliance. A teacher sells through a **teaching profile**: personal (an individual or sole proprietor) or corporate (a registered company).

**MVP goal:** prove the money loop end-to-end on real Stripe test-mode money:

> Teacher onboards → builds course → Support approves → course live → learner pays (Stripe) → consumes lessons → passes quiz → gets certificate with public verify URL → teacher sees payout.

**Strategy:** Stripe-first wedge. No scheme integrations in MVP, but scheme-capable schema from day one.

**Product decision (2026-11-11):** corporate profiles are in the MVP because they are a market requirement, beside the pilot of freelance teachers. The design is `docs/designs/teacher-profiles.md`; the decisions are in ADR 006 and ADR 007.

---

## Portal Depth

| Portal                         | Platform                                        | MVP depth                                                                                                                                                                    |
| ------------------------------ | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Elevate** (Learner)          | Web (responsive)                                | Full depth — flagship surface                                                                                                                                                |
| **Elevate** (Learner)          | Cross-platform mobile (React Native or Flutter) | Consumption only: login → explore → detail → player → certificate. **No checkout on mobile** (deep-link to web payment — also avoids app-store commission on digital goods). |
| **Elevate Teach** (Teacher)    | Web                                             | Enough depth to author a real course end-to-end                                                                                                                              |
| **Elevate Support** (Internal) | Web, separate app                               | Thin: 2 roles (`Support Agent`, `Super Admin`), 3 pages                                                                                                                      |

---

## Data Model (get this right first)

- **Artefact** — atomic learning unit: `video | audio | text | quiz`. Timeline-ordered within a lesson.
- **Lesson** — ordered collection of artefacts; prerequisites = other lesson IDs (a course is a **flowchart/DAG**, not a list).
- **Teaching profile** — what learners buy from; its own record, separate from the users who run it. `personal` or `corporate`. Exactly one owner; managers (corporate only) and writers are members. A writer's edits to a live course wait for an owner or manager to approve them.
- **Payout account** — the Stripe account a profile is paid through. Every payment records the account it paid.
- **Course** — collection of lessons; belongs to a profile; price, status (`draft → pending_review → live → rejected`), scheme fields **present but null**: `scheme_status`, `scheme_type`.
- **Enrollment** — learner↔course; mode `self_directed | class_based` (class-based unused in MVP); `attendance_records[]` empty-array field.
- **Commission** — per-profile rate field (15–20% default), **not a constant**.
- **Auth** — email magic link. Design user identity so an external provider (Singpass) can be linked later; do not build it now.

---

## Core Build Steps (dependency order)

1. **Foundation** — repo + CI, Postgres schema above, design system, auth (magic link).
2. **Media pipeline** — direct-to-storage uploads, transcoding via Mux or Cloudflare Stream (no custom pipeline), signed URLs for playback.
3. **Stripe scaffold** — Stripe Connect (destination charges); application fee = per-profile commission field (~2.9% + S$0.50 netted from gross first). Test mode from the start.
4. **Teacher onboarding** — application form (credentials, bio, teaching sample) → pending/approved status of the profile; in-app Stripe Connect onboarding link. A company applies as a corporate profile with its UEN and registry document.
5. **Course Builder** (Teach) — create course → lessons → artefacts; video upload, rich-text artefact, reorder, prerequisite config, quiz authoring (MCQ, single attempt window, teacher-set pass mark); submit → `pending_review`. The owner can invite writers by email (and managers, on a corporate profile); a writer builds courses but cannot price, publish or see earnings, and a writer's edits to a live course wait for the owner or a manager to approve them.
6. **Support: Review Queue** — preview pending course, approve / reject-with-reason. Approval is the only path to `live`.
7. **Explore + Course detail** (Learner) — card grid, search, category filters, newest/most-enrolled ranking (no recommendation engine); detail = syllabus tree, instructor bio, net-fee price, enrol CTA.
8. **Checkout** — Stripe Checkout / Payment Element, promo code field, receipt email. Web only.
9. **Lesson player + progress** (Web) — artefact timeline, per-artefact progress, prerequisite gating at lesson level, resume position. My Learning = continue-watching + enrolments.
10. **Quiz runtime** — take quiz, grade, pass/fail recorded on enrollment.
11. **Certification** — on completion (lessons done + quiz passed): generate PDF + **public verify URL** (`elevate.xx/c/{token}`, no auth). Single tier.
12. **Teach: Earnings** — gross / commission / net per course, derived from real Stripe events; may be computed rather than settled, but must reconcile to the Stripe dashboard.
13. **Support: Profiles, People + Transactions** — profile approvals, learner search; payments list, manual refund trigger, payout ledger.
14. **Mobile app** — shared auth; Explore → course detail → **player with progress** (video + text) → certificate view. Read-only; no authoring, no payment.
15. **Hardening** — empty/error/loading states; audit log on approve/reject/refund; analytics events: course completion rate, drop-off lesson index, checkout conversion, time-to-first-payout.

**Scope guard:** steps **1–12 are the fundable core — never thin them to save a later step.** If scope pressure hits, cut bottom-up: mobile (14) degrades to a responsive-web WebView shell; Support ledger (13) ships as a table with manual refund only.

---

## Out of Scope (Phase 2+)

SkillsFuture claims + SSG-registration-dependent flows · Culture Pass credits + ATP integration · class scheduling, QR/GPS attendance, Compliance Register · tiered certification · stats/streaks · Singpass · native iOS/Android · AI-assisted drafting · reviews/ratings/cohorts/discussions · offline download, DRM, auto-captions · multi-currency/GST/invoicing · ticketing/CRM, chargeback tooling, feature flags.

---

## Acceptance Criteria

1. A real teacher authors a real course in Elevate Teach unaided.
2. Support approves it through the review queue.
3. A new user pays via Stripe test mode and completes lessons + a quiz.
4. Certificate verify URL opens on a clean, logged-out device.
5. Teacher's earnings view reconciles to Stripe's dashboard.

---

_Non-code, in parallel: SSG training-provider registration; Culture Pass authorised-ticketing-partner conversation (NAC directory); recruit 3–5 pilot teachers to author real content (their courses are the demo); teacher agreement drafted with ownership clause — teacher owns content, Elevate holds non-exclusive hosting license while listed._
