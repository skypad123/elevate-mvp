# Goldfish Review Report: Stage 8, Intermediate Zoom Out

**Target:** `docs/designs/learner-chinese.md` (lines 1-1116, not edited since Stage 5)

**Mode:** REVIEW. **Reviewers:** `egm-zoom-out`, run once (instance A).

## Reviewer Status

| Reviewer       | Status    |
| -------------- | --------- |
| `egm-zoom-out` | completed |

**Severity breakdown:** 1 Blocker, 5 Major, 1 Nit. There is also a status table for the Stage 5 findings and a list of mitigations judged to be at the wrong altitude or out of scope.

**Verdict:** the design should not go to implementation as written. These parts are still sound:

- the `system` value;
- one resolver;
- `users.locale`;
- the `email` catalog area;
- translating the whole learner app.

The Stage 6 and 7 findings do not change the feature's scope. They do change its shape in one place: the language-sync model. Three stages each found holes there, and the holes share one root cause. Stages 6 and 7 also give new evidence that the Teach/Support `?lang` work is out of scope. Several Critic mitigations would add mechanisms where the right fix removes one.

**Synthesizer spot-checks against code (all confirmed):**

- The native "Enrol on the web" and "Continue on the web" links carry no `lang`: `apps/learner/src/app/course/[slug].tsx:86` and `apps/learner/src/app/checkout/[courseId].tsx:100`.
- `packages/web-ui/src/portal/SignInPage.tsx` has no `useT` or i18n import.
- `PreferencesProvider.tsx:60-64` writes the preferences back to storage on mount, which normalises whatever was stored before.

## Prioritized Findings (Blockers -> Major -> Nits)

### Z1. The chosen-or-guessed marker lives on the sign-in link instead of the account - Severity: Blocker

- **Reviewer Lens:** `egm-zoom-out`
- **Affected Scope:** Lines 225-237 (decisions), 239-262 (data flow), 297-318 (§3), 508-519 (Alternative F), 738-768 (items 11-13), 802-813 (item 19), 911-923 (item 31), 1037-1040 (item 43).
- **Discrepancy Description:** "Chosen beats guessed" is carried through three separate places: the request field, the `magic_links.locale` and `locale_chosen` columns, and a reconciliation effect in `session.tsx`. The account itself records no marker. Every later stage found another hole:
  - **Stage 5 Major 1 and Comprehension Major 1:** the account value flips between devices on refresh.
  - **Stage 5 Major 2:** adopting the account's value turns a guess into a choice.
  - **Critic design-1-3:** switching language at the code step leaves the account stale, because the language was captured when the code was requested.
  - **Critic design-1-4:** learners who stay signed in never get `users.locale`. Sessions slide (`auth.service.ts:197`), so they never verify again.
  - **Critic design-1-5:** an English browser's guess fills the account, and a Chinese phone then adopts it as a choice.
  - **Critic design-1-17:** a forged sign-in request (`localeChosen: true`) changes the victim's account language when they use the link.

  Each Critic fix adds its own mechanism: a PATCH after verify, a reconcile on `GET /me`, a `users.locale_chosen` column. Stacked on the current design, that makes six paths writing one value.
- **Rationale & Recommendation:** replace the paths with one state model. State it in the Technical Plan as a short table: device stored value × account value and its source → outcome.
  - **The account records whether its value was chosen.** Use `users.locale` plus `users.locale_chosen`, or one source enum. Drop both `magic_links` columns. `requestMagicLink` already has the request's language when it sends the email and builds the link.
  - **The verify request carries the device's resolved locale and `isChosen(stored)`.** This is Stage 5 Major 9. Code entry verifies from the device that asked for the code, so a switch at the code step is captured (design-1-3).
  - **Writes:**
    - A press while signed in sends `PATCH` as a choice.
    - At verify, a choice made on the device overwrites the account value.
    - At verify or refresh, a guess, or a choice first seen on refresh, only fills an account value that is empty or guessed.
    - A refresh never overwrites a chosen account value.

    This fixes design-1-4 without bringing back Stage 5 Major 1.
  - **Reads:** when a device's stored value is `system`, it uses the account value as a resolver input only if that value was chosen (Stage 5 Major 2). A guessed account value feeds only the emails, Stripe and analytics (design-1-5).
  - **Only a press on this device counts as a choice.** Anything that arrives in a URL (`?lang`) or from another device is a guess. This closes design-1-17: a forged link can only fill an empty account value.
  - **Prerequisite:** the legacy-`en` migration from Stage 5 Major 3. Without it, every upgraded install reports a chosen `en`.

  The schema gets smaller (two columns, not three), and the reconciliation effect goes away.

### Z2. The Teach/Support `?lang` hand-off has no visible effect in this design - Severity: Major

- **Reviewer Lens:** `egm-zoom-out`. This strengthens Stage 5 Major 5.
- **Affected Scope:** Lines 26-29, 129-133, 202-221 (CUJ 6, CUJ 7), 234-237, 401-417, 1069-1089.
- **Discrepancy Description:**
  - `packages/web-ui/src/portal/SignInPage.tsx` does not use `useT`, so the Teach sign-in page is in English. A signed-out visitor who follows `TEACH_URL/?lang=zh` lands on that page (`apps/teach/src/router.tsx:29`).
  - Critic design-1-19 holds (`PreferencesProvider.tsx:60-64`): every browser that has already opened Teach stores `en`, so the hand-off reaches only browsers that have never opened Teach.
  - The Teach banner design that would send `?lang` does not exist in `docs/designs/`. This design also settles brief Q8 ("does `?lang` override Teach's stored setting") on that design's behalf.
- **Rationale & Recommendation:** adopt Stage 5 Major 5's preferred option.
  - Keep only what the shared schema change forces: web-ui and both portal init scripts resolve `system` and never write `lang="system"`.
  - Move the `?lang` storage path, CUJ 7, decision 4 and the "Why Teach stores `?lang`" passage to the Teach banner design. That design also owns translating the Teach sign-in page.
  - Remove the dependency line from the Overview.

### Z3. `?lang` is read on a fixed list of pages and misses the main native purchase entry - Severity: Major

- **Reviewer Lens:** `egm-zoom-out`. This upgrades Stage 5 Nit 13 and absorbs Critic design-1-2.
- **Affected Scope:** Lines 64-67, 110-113, 281-283, 343-344, 352-354, 903-905, 935-941.
- **Discrepancy Description:** on native, paid checkout leaves the app through "Enrol on the web" and "Continue on the web". Both open `${webBaseUrl()}/course/<slug>` with no `lang` (`course/[slug].tsx:86`, `checkout/[courseId].tsx:100`). The learner then signs in and pays in an English browser. The design reads `?lang` on that course page only after a cancelled checkout.
- **Rationale & Recommendation:** replace the page list with one rule at design altitude:
  - every URL that the app or API builds into learner web carries `lang`;
  - the learner web provider reads `?lang` once at load, on any route, keeps it in memory for the life of the tab, and never stores it.

  This removes `setParamLocale`, the pass-through on each screen and the native deep-link handling. It also makes the Critic's "carry `lang` through the `redirect` param" unnecessary, because those redirects stay inside the single-page app.

### Z4. The server reads the account value where it should read the language on screen - Severity: Major

- **Reviewer Lens:** `egm-zoom-out`. This upgrades Stage 5 Nit 11.
- **Affected Scope:** Lines 114-116, 346-354, 419-423, 791-800.
- **Discrepancy Description:** three stages raised this independently: Stage 5 Nit 11, Comprehension Major 2 (a concrete case where Chinese is on screen and Stripe gets no language) and Critic design-1-6. It is a source-of-truth problem in the data flow, not a wording problem. `users.locale` is right only for emails that no learner request triggered.
- **Rationale & Recommendation:**
  - `POST /checkout` carries the resolved UI locale. Use it for Stripe, the return URLs and `checkout_started`.
  - `checkout_completed` records the account value. Reword Goal 6 to say so.
  - Storing the locale in Checkout Session metadata (design-1-6) is optional.

### Z5. One root cause sits under three findings: values the user never set are written back to storage - Severity: Major

- **Reviewer Lens:** `egm-zoom-out`. This folds into Stage 5 Major 3.
- **Affected Scope:** Lines 50-53, 185-192, 227-228, 434-443, 486-496.
- **Discrepancy Description:** the design treats each of these as a separate problem:
  - Stage 5 Major 3: the learner app writes `en` on load.
  - Critic design-1-19: web-ui does the same (confirmed at `PreferencesProvider.tsx:60-64`).
  - Critic design-1-11: after a revert, the old code normalises `system` to `en`, which then counts as a choice.
- **Rationale & Recommendation:** use Stage 5 Major 3's version-marker migration in all three portals. A legacy record with no `v` and `locale: 'en'` becomes `system`.
  - Old code drops unknown keys when it parses. A rollback therefore writes back a record without `v`, and a re-deploy treats it as legacy again. The rollback stops being lossy, and no two-phase deploy is needed.
  - Optionally, write storage only from `setPreference`, not on mount, so that "stored means chosen" holds from now on.
  - List the one lossy case left as an accepted risk: someone who really chose `en` and then hit a rollback.

### Z6. The case for the build is still unproven - Severity: Major

- **Reviewer Lens:** `egm-zoom-out`. Stage 5 Major 7 still stands, and later stages add evidence.
- **Affected Scope:** Lines 33-34, 69-71, 114-116, 139-145, 1109-1110.
- **Discrepancy Description:** three later findings add to Stage 5 Major 7:
  - Critic style-1-1: demand is not quantified.
  - Critic design-1-8: the success measure cannot observe the problem as the design states it (visitors lost before sign-in).
  - Q7: there is no success target.

  Q5 is also still open: no Chinese-taught courses are known. The largest of the four features is committed without evidence of demand, content or a way to measure it.
- **Rationale & Recommendation:**
  - Answer Q5 before approval.
  - Call the measure "adoption".
  - As a proxy for visitors before sign-in, add a `trackEvent` with `locale` in `requestMagicLink`. It needs no new endpoint.

### Z7. Add the Risks & Mitigations section after simplifying, not before - Severity: Nit

- **Reviewer Lens:** `egm-zoom-out`. This covers Critic Blocker design-1-1.
- **Affected Scope:** Lines 434-443.
- **Discrepancy Description:** the section is required (Critic design-1-1). Several risks on its list exist only because of complexity that can be removed:
  - drift between three init scripts;
  - the `PATCH /me` race;
  - the divergence cases in design-1-3 to design-1-6;
  - the Teach `?lang` handling;
  - the forged-language link.
- **Rationale & Recommendation:** remove those risks through Z1-Z3. Then write a short section covering what is left:
  - how Chinese text renders in email clients;
  - who owns and reviews the Chinese copy (item 36 partly covers this);
  - the Postgres enum's migration step for new languages (design-1-14);
  - what each revert leaves in place (design-1-11);
  - Stripe's own receipt staying English (design-1-18), noted as a limitation.

## Stage 5 findings: current status

| Stage 5 finding                                     | Status at Stage 8                                                                                                                |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Major 1: account value flips between devices        | Stands. Comprehension Major 1 confirmed it independently. Folded into Z1.                                                        |
| Major 2: adopting the account value                 | Stands. Refined by design-1-5: adopt only chosen account values (Z1).                                                            |
| Major 3: legacy `en`                                | Stands. Strengthened by design-1-19 and design-1-11. Its migration also fixes the lossy rollback (Z5).                           |
| Major 4: a stale stored value beats `?lang`         | Partly stands. Mostly absorbed by Z3 and the migration. Reject its option 2 (`lang=zh&lc=1`): a URL can be forged (design-1-17). |
| Major 5: Teach `?lang` is out of scope              | Stands, strengthened (Z2).                                                                                                       |
| Major 6: copies of the resolver in init scripts     | Stands. Dropping the learner script still holds.                                                                                 |
| Major 7: Q5                                         | Stands, strengthened (Z6).                                                                                                       |
| Major 8: PR 1 fails typecheck                       | Stands unchanged. Critic design-1-20 raises the same finding as a Nit.                                                           |
| Major 9: drop the `magic_links` columns             | Stands, strengthened by design-1-3 and design-1-17. Now part of Z1.                                                              |
| Nit 10: the sign-in email ignores the account value | Stands. Under Z1, use the account value only when it was chosen.                                                                 |
| Nit 11                                              | Upgraded to Major (Z4).                                                                                                          |
| Nit 12                                              | Stands. Critic design-1-7's audience filter on `sign_in` is the same concern, applied to analytics.                              |
| Nit 13                                              | Upgraded and folded into Z3.                                                                                                     |
| Nits 14, 15, 16                                     | Stand unchanged.                                                                                                                 |
| Nit 17                                              | Stands. Adopt design-1-11's list of what each revert leaves in place, not an off switch.                                         |

## Earlier findings that matter at the zoom-out level

- **Comprehension (Stage 6):**
  - Major 1 → Z1. Major 2 → Z4.
  - Nit 4: the doc never explains the code path and the link path. Z1 depends on code entry verifying from the device that requested the code, so the doc should say this in one sentence.
  - Nits 8 and 9 reinforce Z3 and Stage 5 Major 6.
- **Critic (Stage 7):**
  - design-1-1 → Z7. design-1-2 → Z3. design-1-3, 1-4, 1-5 and 1-17 → Z1. design-1-6 → Z4.
  - design-1-8 and style-1-1 → Z6. design-1-11 and design-1-19 → Z5 and Z2.
  - structural-1-5 raises a real problem, but its fix points the wrong way (next section).
- **Correct, but implementation-level:** these should be fixed but don't change the shape of the design.
  - design-1-9: for "Free", reuse the existing `common.free` key.
  - design-1-10: pick the device-language rule once. It is a product decision and adds no mechanism.
  - design-1-13.
- **No zoom-out impact (wording or structure only):** structural-1-2, 1-4, 1-6 to 1-13; style-1-3 to 1-19; Comprehension Nits 3, 5-7 and 10-18.

## Mitigations judged at the wrong altitude or out of scope

- **Critic structural-1-5 (add a Goal for Teach/Support `?lang`):** this writes scope creep into the Goals. Shrink the Teach/Support work first (Z2), then describe the small piece that is left.
- **Critic design-1-3, option 2 (PATCH after verify when the values differ):** another reconciliation path. Use the fields on the verify request instead (Z1).
- **Critic design-1-4 as written (PATCH from `GET /me` whenever the stored choice differs):** this brings back the device flip-flop from Stage 5 Major 1. It is acceptable only as fill-when-empty or fill-when-guessed.
- **Critic design-1-5 (`users.locale_chosen`):** endorse it only as a replacement for the `magic_links` columns, never as an extra column.
- **Critic design-1-2 (carry `lang` through `redirect`):** unnecessary once `?lang` is kept in memory for the life of the tab (Z3).
- **Critic design-1-8 (move the anonymous client event out of Future Improvements):** scope creep. A client event endpoint is brief Q14, which is deferred. Use the server-side proxy (Z6).
- **Critic design-1-11 (ship schema tolerance first):** this is a two-phase deploy. The version marker gives the same result (Z5).
- **Critic style-1-2 (pseudo-locale render test):** this needs a new test harness. Prefer one Biome config line scoped to `apps/learner`, if Biome 2.6.6 has a JSX-literals rule. The reviewer believes `noJsxLiterals` exists but could not check it, because Biome is not installed in this checkout. Otherwise keep the manual pass already at line 1107.
- **Critic design-1-21 (listen for the web `languagechange` event):** not needed. The web app reads the language once, and this adds live tracking nobody asked for.
- **Critic design-1-18 (set the Stripe Customer's `preferred_locales`):** scope creep. Note the English Stripe receipt as a limitation.
- **Critic structural-1-3 (add more alternatives):** the doc already lists 13. Settle the new options in the Technical Plan rather than adding alternative entries: reconcile on `/me`, locale on the verify and checkout requests, and scanning every device language.
- **Critic design-1-1:** handling the listed risks with mitigations instead of simplification would keep complexity that can be removed (Z7).
- **Stage 5 Major 6, the build-time generation option (generate init scripts from core):** this adds to the build pipeline and is more than needed once Z2 removes the Teach `?lang` logic. Two minimal portal scripts are enough.
- **Stage 5 Major 5, the sessionStorage `langHint` option:** a new mechanism for a feature that is out of scope here.
- **Stage 5 Major 4, option 2 (`lc=1`):** rejected under Z1.
- **Stage 5 Major 1, the optional `localeSyncPending` flag:** no longer needed for presses made while signed out, because the verify request carries the device's state. Keep it only if signed-in overwrites that fail must survive a restart.
