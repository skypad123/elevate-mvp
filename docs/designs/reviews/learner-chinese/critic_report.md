# Goldfish Review Report

**Target:** `docs/designs/learner-chinese.md` (lines 1-624, everything before "## Detailed Implementation Plan")

**Stage:** 7 (Critic Review), egm-review-loop round 1. **Mode:** REVIEW.

## Reviewer Status

| Reviewer         | Status    |
| ---------------- | --------- |
| `egm-design`     | completed |
| `egm-structural` | completed |
| `egm-style`      | completed |

Each reviewer ran once, as a single instance, and none needed a retry. Findings raised by more than one reviewer are merged into one entry. The entry keeps the first id and lists the other reviewers under "Also raised by".

**Severity breakdown after deduplication:** 1 Blocker, 21 Major, 28 Nit.

**Checked against code by the synthesizer:**

- `formatSgd(0, { showFree: true })` returns `'Free'` (`packages/core/src/domain/money.ts:117`). `apps/learner/src/app/(tabs)/learning.tsx:124` also has a hard-coded `'Free'`.
- No `trackEvent` call in `apps/api/src` emits `sign_in`.
- The certificate method is `issueForEnrollment` (`apps/api/src/services/certificates.service.ts:44`).
- The web-ui `PreferencesProvider` writes preferences back on mount (`packages/web-ui/src/preferences/PreferencesProvider.tsx:60-64`).

## Prioritized Findings (Blockers -> Major -> Nits)

### design-1-1: No Risks & Mitigations section - Severity: Blocker

- **Reviewer Lens:** `egm-design` (also raised by `egm-structural`)
- **Affected Scope:** Whole scope. The nearest content is "Rollout and rollback", lines 434-443.
- **Discrepancy Description**: The feature-spec standard requires the spec to name its failure modes, security implications and scalability limits, and how each is mitigated. The doc has no such section. The only related text is "Rollout and rollback", which covers migration safety and older clients. Risks the chosen design introduces and never names:
  - Drift between the three hand-copied `preferences-init.js` resolver scripts (lines 279-280).
  - No owner or review step for the Chinese copy, including payment, refund and app-store wording.
  - Nothing enforces "no English literals" across more than 135 strings (see style-1-2).
  - The `?lang` security posture in Teach and Support (lines 401-405), and sign-in requests sent in a forced language (design-1-23).
  - How email clients render CJK text.
  - The `PATCH /me` race across devices ("latest change wins" is stated, but not as a risk).
  - The silent divergence cases in design-1-3 to design-1-6.
  - Lossy rollback (design-1-11).
  - No rollback path for the Teach/Support web-ui changes.
- **Rationale & Recommendation**: Without this section a reader cannot tell whether these risks were weighed. Add an H2 "Risks & Mitigations" after the Technical Plan or after Alternatives. List each risk with its mitigation. Fold "Rollout and rollback" into it, or cross-reference it.

### design-1-2: The native purchase path loses the language - Severity: Major

- **Reviewer Lens:** `egm-design`
- **Affected Scope:** Lines 64-67, 110-113, 281-283, 346-354
- **Discrepancy Description**: On native, both `course/[slug].tsx:86` and `checkout/[courseId].tsx:100` open `${webBaseUrl()}/course/${slug}` with no `?lang`. The design adds none, and it reads `?lang` on the course page only after a cancelled checkout. The in-app browser is not signed in, so `/checkout/success` replaces the route with `/sign-in` and the `redirect` drops `lang`. The flow the doc says "matters on native" therefore lands on an English course page and an English sign-in on en-SG phones.
- **Rationale & Recommendation**:
  - Add `?lang` to the native "Enrol on the web" and "Continue on the web" links.
  - Read `?lang` on any route, not a fixed list of three.
  - Say how long a `?lang` value lasts, for example in memory for the life of the tab.
  - Carry `lang` through the `redirect` param.

### design-1-3: Switching language at the code step leaves the account stale - Severity: Major

- **Reviewer Lens:** `egm-design`
- **Affected Scope:** Lines 82, 104-105, 249-257, 302-312
- **Discrepancy Description**: Goal 3 lets the visitor switch language on the code step. But the locale is captured on `magic_links` when the code is requested, and the verify request gains no locale, despite line 82 ("sign-in itself"). Suppose a visitor requests the code in English, switches to 中文 and enters the code. `users.locale` becomes a chosen `en`, the device stores `zh`, and nothing sends a PATCH. Every later email and Stripe page is English.
- **Rationale & Recommendation**: Either add `locale` and `localeChosen` to the verify request, with the request taking precedence over the link row, or PATCH after verify whenever the app's chosen value differs from `AuthUser.locale`.

### design-1-4: Learners who stay signed in never get `users.locale` - Severity: Major

- **Reviewer Lens:** `egm-design`
- **Affected Scope:** Lines 259, 313-318, 434-440
- **Discrepancy Description**: Sessions slide, because `getSessionUser` extends `expiresAt`. The design writes `users.locale` only at verify or on an explicit switch. A learner who chose 中文 in Profile before launch and stays signed in keeps `users.locale = null` indefinitely, and gets English emails and an English Stripe Checkout. The same gap opens if the switch's `PATCH /me` fails (offline), since there is no retry (design N12).
- **Rationale & Recommendation**: Reconcile once when the user is loaded (`GET /me`). If the stored preference is a choice and differs from `user.locale`, PATCH. If it is `system` and `user.locale` is set, adopt it. Weigh this against Alternative B, which the doc dismisses only as a write on every request.

### design-1-5: A guessed language is promoted to the account, then to other devices as a choice - Severity: Major

- **Reviewer Lens:** `egm-design`
- **Affected Scope:** Lines 229-233, 255-257, 313-315, CUJ 3 (174-183)
- **Discrepancy Description**: A first sign-in from an English browser stores a guessed `en` in an empty `users.locale`. Later, a Chinese phone (stored `system`, guessed `zh`) signs in, the guess yields to the account, and the phone stores `en` as chosen. One device's guess permanently switches a Chinese reader's phone to English, which works against Goal 2.
- **Rationale & Recommendation**: Record where the account value came from, for example `users.locale_chosen`. Then either let a guessed account value fill only emails, or keep the device at `system` with a runtime account override.

### design-1-6: Stripe locale, return pages and analytics read `users.locale`, not the language in use - Severity: Major

- **Reviewer Lens:** `egm-design` (also raised by `egm-style`, M6 second half)
- **Affected Scope:** Lines 114-116, 348-354, 421-423
- **Discrepancy Description**: Goal 6 says events carry "the language the learner was using". But Sections 5 and 8 read `users.locale` (or `link.locale ?? users.locale`) for Stripe `locale`, `success_url`/`cancel_url` and the checkout events. These diverge from the screen whenever devices differ or the account is null. In CUJ 3, for example, the event records `en` while the learner ends up in Chinese. This contradicts the doc's own principle at line 82.
- **Rationale & Recommendation**: Send the UI locale on `POST /checkout` and use it for Stripe, the return URLs and `checkout_started`. Store it in session metadata so `checkout_completed` can read it. Otherwise, reword Goal 6 to state exactly what each event records.

### design-1-7: The `sign_in` analytics event is not emitted today - Severity: Major

- **Reviewer Lens:** `egm-design` (also raised by `egm-style`). Verified by the synthesizer.
- **Affected Scope:** Lines 114-116, 419-423
- **Discrepancy Description**: `ANALYTICS_EVENTS.signIn` is defined in `packages/core/src/domain/analytics.ts`, but no `trackEvent` call in `apps/api/src` emits it, and `AuthService.verify` tracks nothing. Line 421 reads as "add a `locale` property" to existing calls.
- **Rationale & Recommendation**: Say that a new `sign_in` emission is added in `AuthService.verify`. Filter it by `link.audience === 'learner'`, or record the audience, so Teach and Support sign-ins don't dilute the share of Chinese sign-ins with `null`.

### design-1-8: The success measure can't evaluate the stated problem - Severity: Major

- **Reviewer Lens:** `egm-design`
- **Affected Scope:** Lines 69-71, 114-116, 144-145
- **Discrepancy Description**: The problem is visitors lost at the first screen, about whom there is "no record". Server events fire only after sign-in, and none carried a locale before launch, so there is no denominator and no before/after.
- **Rationale & Recommendation**: State that the measure covers adoption, not first-visit bounce. Alternatively, define a proxy that exists before sign-in, such as the share of magic-link requests with `locale = zh`, or move the minimal anonymous event out of Future Improvements.

### design-1-9: "Free" stays English, and the money-formatting claim is wrong - Severity: Major

- **Reviewer Lens:** `egm-design` (also raised by `egm-style` M2, and design N1). Verified by the synthesizer.
- **Affected Scope:** Lines 48-49, 87-97 (Goal 1), 377-380
- **Discrepancy Description**:
  - `lib/format.ts` hard-codes `en-SG` only in `formatDate`. Money comes from core's `formatSgd`.
  - `formatSgd(cents, { showFree: true })` returns the literal `'Free'` (`money.ts:117`). It is used in `CourseCard.tsx`, `course/[slug].tsx` and `checkout/[courseId].tsx`. `(tabs)/learning.tsx:124` has its own `'Free'` literal.
  - "`formatSgd` stays as it is" (line 380) therefore leaves English on screen, which breaks Goal 1.
- **Rationale & Recommendation**: Move the `en-SG` note to dates. Render the free label from the catalog (`common.free` already exists) and stop using `showFree` in the learner app, or list "Free" as an explicit exception.

### design-1-10: Two different rules for picking Chinese from the device languages - Severity: Major

- **Reviewer Lens:** `egm-design` (also raised by `egm-style`)
- **Affected Scope:** Lines 98-101, 276, 287, 291, 600
- **Discrepancy Description**: Goal 2 and the web and native reads use only the first preferred language (`navigator.languages[0]`, `getLocales()[0]`). Line 276 ("the first device language whose primary subtag is `zh`") and line 600 ("any device language") imply scanning the whole list. The difference decides the outcome for en-SG-first, zh-second devices, which are common in Singapore.
- **Rationale & Recommendation**: Pick one rule, use the same wording in all places, and make the unit tests pin it. Weigh scanning the whole list as an alternative and reject it with a reason, or adopt it.

### design-1-11: The rollback section is incomplete and the rollback loses state - Severity: Major

- **Reviewer Lens:** `egm-design` (also raised by `egm-style` M8, and `egm-structural` within F1)
- **Affected Scope:** Lines 434-443
- **Discrepancy Description**: Two gaps:
  - **Old code on new data.** After a web revert, the old `parseStoredPreferences` rejects `locale: 'system'`, falls back to `en` and writes that back, in both the learner and web-ui providers. Under decision 1 the written `en` counts as a choice, so a later re-deploy can never guess for those visitors. Old Teach and Support tabs open during a deploy also normalise through the `storage` event.
  - **What a revert leaves on.** "Reverting the web deploy" does not stop the API sending Chinese emails to `users.locale = 'zh'` accounts. It does not stop Stripe receiving `locale: 'zh'`, or the Teach/Support `?lang` and `system` behaviour.
- **Rationale & Recommendation**: List what each revert (learner web, Teach/Support web, API) turns off and what stays on. Either ship schema tolerance first (accept `system`, and don't write back unchanged defaults) or state the lossy downgrade as an accepted risk.

### structural-1-2: Rejections are attributed to people or reviews without links - Severity: Major

- **Reviewer Lens:** `egm-structural` (also raised by `egm-design` M11)
- **Affected Scope:** Lines 457-458, 470-471, 482, 495, 505, 518, 528, 540, 551, 563, 575, 589, 600
- **Discrepancy Description**: The Alternatives Rule forbids attributing a rejection to a maintainer without linking the issue, discussion or PR. A and B say "Rejected in the brainstorm review". C-G and I-M say "Rejected by author". H says "Rejected during drafting". None is linked. C and J are "Not chosen yet" in the brief (lines 231-233 and 244-245 there), and there is no record of when they were decided.
- **Rationale & Recommendation**: Link A and B to `learner-main-page-improvements.md#alternatives-weighed`. For the rest, link the decision record, or drop the attribution and let the technical trade-off carry the rejection.

### structural-1-3: Rejection rationales restate the decision, and alternatives are missing - Severity: Major

- **Reviewer Lens:** `egm-structural` (also raised by `egm-design` M11)
- **Affected Scope:** Lines 505-506 (E), 528-529 (G), 551-552 (I), 563-564 (J), 600-601 (M)
- **Discrepancy Description**: Several reasons only restate the chosen design: "a stored `en` counts as a choice", "all three portals resolve `system`", "the API … stay English", "the whole learner app is translated in one release", "any … `zh` gets Simplified". The deciding trade-off is often already in the Cons. For example, J's Cons say a buyer meets English after paying. Alternatives that the design findings raise are also absent: reconcile on `/me` (design-1-4), locale on the checkout and verify requests (design-1-3, design-1-6), and scanning the whole device-language list (design-1-10).
- **Rationale & Recommendation**: Rewrite each reason to name the trade-off that decided it, and add the missing alternatives.

### structural-1-4: Heading hierarchy puts trailing sections under Alternatives - Severity: Major

- **Reviewer Lens:** `egm-structural`
- **Affected Scope:** Lines 605, 613
- **Discrepancy Description**: "### Additional Resources" and "### Future Improvements" follow "### Alternative M", so in the outline and any generated table of contents they nest under Alternatives Considered. The horizontal rule at line 603 is only visual and does not end the H2. Future Improvements is deferred scope, not an alternative.
- **Rationale & Recommendation**: Promote both headings to H2.

### structural-1-5: Overview and Goals leave out the Teach and Support work - Severity: Major

- **Reviewer Lens:** `egm-structural`
- **Affected Scope:** Lines 15-21, 86-116, compared with 202-221, 234-237, 394-417
- **Discrepancy Description**: The Overview's "three things" and Goals 1-6 are all about the learner app. CUJ 6, CUJ 7, Decisions 3-4 and Technical Plan §7 specify Teach and Support behaviour. Non-Goals (129-133) mention it only in passing, so CUJs 6 and 7 trace to no Goal.
- **Rationale & Recommendation**: Add a Goal, for example "Teach and Support resolve `system` from the browser and accept a one-time `?lang`", and mention it in the Overview.

### structural-1-6: Open Questions numbering has gaps and clashes with the brief - Severity: Major

- **Reviewer Lens:** `egm-structural` (also raised by `egm-style` M7)
- **Affected Scope:** Lines 125-126, 141-145, 615-616
- **Discrepancy Description**: Only "Question 5" and "Question 7" appear. Q5 matches the brief, but the brief's Q7 is "The banner's intro" while this doc's Q7 is the success target. The cross-references point at `#open-questions`, which is the section, not the question.
- **Rationale & Recommendation**: Renumber locally (Q1, Q2), or say the numbers follow the brief and fix Q7. Note which brief questions this doc answers (1, 2, 3, 4, 8, 10, 14, 15).

### style-1-1: The opening framing is uncalibrated - Severity: Major

- **Reviewer Lens:** `egm-style`
- **Affected Scope:** Lines 33-34 (also line 50)
- **Discrepancy Description**: "A large share of the people it wants to reach read Chinese more easily than English" gives no number and no source. "Today the app turns them away at the first screen" overstates: the app shows English and nothing turns anyone away, and line 70 admits there is no data on who leaves. Line 50 ("stays there") ignores the Profile setting.
- **Rationale & Recommendation**: Cite a figure, such as census language data, or narrow the claim. Write "shows them only English until they sign in".

### style-1-2: Goal 1's evidence does not prove Goal 1 - Severity: Major

- **Reviewer Lens:** `egm-style` (related: `egm-design` B1, "nothing enforces no English literals")
- **Affected Scope:** Lines 87-97
- **Discrepancy Description**: Goal 1 says every route "shows no English", but the only check named is the catalog parity test. That test proves every key exists in the Chinese catalog. It cannot find an English literal left in a component, and design-1-9 shows such literals exist today.
- **Rationale & Recommendation**: Name a check that detects literals: a lint rule, a CI grep, a pseudo-locale render test, or a manual pass per route. Otherwise narrow the goal to what the test verifies.

### style-1-3: The number of pre-paint scripts and their behaviour are misdescribed - Severity: Major

- **Reviewer Lens:** `egm-style` (also raised by `egm-design` N2)
- **Affected Scope:** Lines 279-281, 287-290, 397, 401-405, 409-413
- **Discrepancy Description**: Line 279 says "both `preferences-init.js` scripts", but line 288 adds a third (`apps/learner/public/preferences-init.js`). Line 288 calls it "the same pre-paint script Teach has", yet the learner script must not store `?lang`, while the Teach and Support scripts do.
- **Rationale & Recommendation**: Say there are three scripts. Specify the learner one separately: it applies `system` and `?lang` to `<html lang>` without writing storage. Mention the drift risk in design-1-1.

### style-1-4: The area table does not cover every file in scope - Severity: Major

- **Reviewer Lens:** `egm-style`
- **Affected Scope:** Lines 358-373
- **Discrepancy Description**: "Every hard-coded string", including `src/components` and `src/ui`, is in scope. But several files fit no row: `RootError.tsx`, `TopNav.tsx`, `PillTabBar.tsx`, `+not-found.tsx`, `EmptyState.tsx`, the `media/*` artefacts, and `Logo`, which line 360 names.
- **Rationale & Recommendation**: Add a shared row such as `learnerCommon`, or assign each of these files to an area.

### style-1-5: `localeChosen` names two different things - Severity: Major

- **Reviewer Lens:** `egm-style`
- **Affected Scope:** Line 486 (Alternative D), compared with lines 249-251 and 303-304
- **Discrepancy Description**: Alternative D's heading calls the rejected device-side flag "a `localeChosen` flag". The accepted design uses `localeChosen` on the sign-in request and `magic_links.locale_chosen`.
- **Rationale & Recommendation**: Rename the rejected idea, for example "a stored `chosen` marker in preferences".

### style-1-6: "Home" and "Explore" are used for the same screen - Severity: Major

- **Reviewer Lens:** `egm-style`
- **Affected Scope:** Lines 20, 42, 104, 192, 365, 387
- **Discrepancy Description**: The doc says "home page", "home (`(tabs)/index.tsx`)", "Explore page" and "home and Explore" (in the `learnerExplore` row), which reads as two screens.
- **Rationale & Recommendation**: Pick one name, tie it to `(tabs)/index.tsx` once, and use it everywhere.

### structural-1-7: Bullet markers are inconsistent - Severity: Nit

- **Reviewer Lens:** `egm-structural`
- **Affected Scope:** Lines 36-67, 120-137, 230-233, 266-277, 401-405, 409-413
- **Discrepancy Description**: `-` and `*` are mixed at the same nesting levels.
- **Rationale & Recommendation**: Use one marker per nesting level.

### structural-1-8: Technical Plan H3s mix numbered and unnumbered headings - Severity: Nit

- **Reviewer Lens:** `egm-structural`
- **Affected Scope:** Lines 225, 239, 264-425, 434
- **Discrepancy Description**: "Decisions made while drafting", "Data flow" and "Rollout and rollback" are unnumbered, while §1-9 are numbered.
- **Rationale & Recommendation**: Number all of them or none.

### structural-1-9: A CUJ 3 "Then" item is not an outcome - Severity: Nit

- **Reviewer Lens:** `egm-structural` (also raised by `egm-style` N7)
- **Affected Scope:** Lines 176-183
- **Discrepancy Description**: "The sign-in email was English" happens before the "When", and it switches tense.
- **Rationale & Recommendation**: Move it into Given/When, or label it as context, and use the present tense.

### structural-1-10: The claim about feature flags has no link - Severity: Nit

- **Reviewer Lens:** `egm-structural`
- **Affected Scope:** Line 441
- **Discrepancy Description**: "(the spec puts flags out of scope)" is correct (`docs/spec.md:63`) but unlinked.
- **Rationale & Recommendation**: Link `../spec.md`.

### structural-1-11: The certificate method name is wrong, and refund notices have a second sender - Severity: Nit

- **Reviewer Lens:** `egm-structural` (also raised by `egm-style` N10 and `egm-design` N3). Verified by the synthesizer.
- **Affected Scope:** Lines 57-60, 340-341
- **Discrepancy Description**: The method is `CertificatesService.issueForEnrollment`, not `issue`. Refund notices are also sent from the `charge.refunded` webhook path, not only from Support.
- **Rationale & Recommendation**: Fix the method name and list both refund senders.

### structural-1-12: The data-flow diagram is incomplete - Severity: Nit

- **Reviewer Lens:** `egm-structural`
- **Affected Scope:** Lines 241-262
- **Discrepancy Description**: The `navigator.languages` and `expo-localization` arrows never reach `resolveLocale`. The diagram also leaves out the Teach/Support `?lang` storage path and the checkout-return `&lang`.
- **Rationale & Recommendation**: Complete the diagram, or caption it as learner-only.

### structural-1-13: ADR 010 is referenced as if it exists - Severity: Nit

- **Reviewer Lens:** `egm-structural`
- **Affected Scope:** Line 427
- **Discrepancy Description**: The number is correct (`docs/adr` ends at 009), but the file doesn't exist yet.
- **Rationale & Recommendation**: Mark it as pending.

### design-1-12: "System browser" is the wrong term for native - Severity: Nit

- **Reviewer Lens:** `egm-design`
- **Affected Scope:** Lines 66, 353-354
- **Discrepancy Description**: `openBrowserAsync` opens an in-app browser (SFSafariViewController or Custom Tabs), not "the system browser". The conclusion that it has separate storage still holds.
- **Rationale & Recommendation**: Correct the term.

### design-1-13: Category labels have a type gap and a second English source - Severity: Nit

- **Reviewer Lens:** `egm-design` (also raised by `egm-style` N11)
- **Affected Scope:** Lines 374-376
- **Discrepancy Description**: `CoursePublicView.category` is typed `string`, so ``t(`category.${slug}`)`` won't type-check under ADR 008's enum-key pattern. Badges also use core's `categoryLabel()` (`CourseCard.tsx:29`, `course/[slug].tsx:197`), not only the API's `label`.
- **Rationale & Recommendation**: Narrow the contract to `CourseCategory`, and name both English sources.

### design-1-14: The Postgres `locale` enum adds a migration step for new languages - Severity: Nit

- **Reviewer Lens:** `egm-design`
- **Affected Scope:** Lines 299-301
- **Discrepancy Description**: Adding a language will now also need an `ALTER TYPE` migration, and the zod and Postgres enums must stay in sync.
- **Rationale & Recommendation**: Say this in ADR 008's "How to extend" section and in ADR 010.

### design-1-15: `?lang` overwriting a stored `system` contradicts "never overwritten" - Severity: Nit

- **Reviewer Lens:** `egm-design`
- **Affected Scope:** Lines 401-402, 415
- **Discrepancy Description**: The picker now offers "Follow device", so a stored `system` can be an explicit choice, yet `?lang` overwrites it.
- **Rationale & Recommendation**: Accept this explicitly, or distinguish a default `system` from a chosen one.

### design-1-16: `<html lang="zh">` on English Teach and Support pages - Severity: Nit

- **Reviewer Lens:** `egm-design`
- **Affected Scope:** Lines 207-208, 528-529
- **Discrepancy Description**: The tag misleads screen readers and changes font fallback on untranslated pages.
- **Rationale & Recommendation**: List this among Alternative G's accepted costs.

### design-1-17: Sign-in emails in a forced language (security) - Severity: Nit

- **Reviewer Lens:** `egm-design`
- **Affected Scope:** Lines 249-257, 302-312 (belongs in design-1-1)
- **Discrepancy Description**: Anyone can request a sign-in email for any address with `locale: zh, localeChosen: true`. The owner may take the result for phishing, and if they use the link their account language flips. The rate limit of 5 per 15 minutes bounds this.
- **Rationale & Recommendation**: State the risk and the bound in the risks section.

### design-1-18: Stripe's own receipt stays English - Severity: Nit

- **Reviewer Lens:** `egm-design`
- **Affected Scope:** Lines 110-113
- **Discrepancy Description**: The `receipt_url` page and Stripe-sent receipts follow the Customer's `preferred_locales`, which is unset.
- **Rationale & Recommendation**: Note that the receipt stays English, or set `preferred_locales`.

### design-1-19: The web-ui provider already wrote `en` for existing Teach and Support browsers - Severity: Nit

- **Reviewer Lens:** `egm-design`. Verified by the synthesizer (`PreferencesProvider.tsx:60-64`).
- **Affected Scope:** Lines 202-221, 409-417
- **Discrepancy Description**: The provider writes defaults back on mount, so every browser that has opened Teach or Support already stores `en`, which decision 1 treats as a choice. CUJ 6, CUJ 7 and the Teach banner's `?lang` hand-off therefore reach only browsers that have never opened Teach.
- **Rationale & Recommendation**: State this limit. The synthesizer notes that it narrows the Teach banner flow in `learner-main-page-improvements.md`, and the author may want to treat it as Major.

### design-1-20: Widening `Preferences['locale']` breaks code that reads it as a `Locale` - Severity: Nit

- **Reviewer Lens:** `egm-design`
- **Affected Scope:** Lines 266-269
- **Discrepancy Description**: These readers break: `createTranslator(preferences.locale)` in both providers, web-ui `applyToDocument` (which would set `lang="system"`), the learner `<html lang>` effect, and `intlLocale` callers.
- **Rationale & Recommendation**: Name the resolved-locale field the contexts will expose.

### design-1-21: Live device-language changes on the web, and an unsourced claim - Severity: Nit

- **Reviewer Lens:** `egm-design`
- **Affected Scope:** Lines 291-295
- **Discrepancy Description**: The web side doesn't mention the `languagechange` event to match native's `useLocales()` re-render. The claim about Hermes and the iOS region has no source.
- **Rationale & Recommendation**: Mention the event, and source the claim or soften it.

### style-1-7: The Overview says the same thing twice - Severity: Nit

- **Reviewer Lens:** `egm-style`
- **Affected Scope:** Lines 17-18
- **Discrepancy Description**: "Translates every screen … That covers every learner screen" repeats itself.
- **Rationale & Recommendation**: Keep the list of emails and drop the repeat.

### style-1-8: Wording in the Problem section - Severity: Nit

- **Reviewer Lens:** `egm-style`
- **Affected Scope:** Lines 42, 69
- **Discrepancy Description**: "The pages … are English literals" should say the pages "contain" them. "A wall of English" is figurative.
- **Rationale & Recommendation**: Write "contain English literals" and "an English-only first visit".

### style-1-9: Facts repeated across sections - Severity: Nit

- **Reviewer Lens:** `egm-style`
- **Affected Scope:** Lines 113, 158, 349-351, and 294-295 compared with 536-539
- **Discrepancy Description**: The Stripe `locale: 'zh'` fact appears three times, and the Hermes `Intl` reasoning appears twice.
- **Rationale & Recommendation**: Keep each in one place and point to it from the others.

### style-1-10: Line 310 doesn't match the field it describes - Severity: Nit

- **Reviewer Lens:** `egm-style`
- **Affected Scope:** Line 310
- **Discrepancy Description**: "The choice was a guess" doesn't name the field.
- **Rationale & Recommendation**: Write "`link.localeChosen` is false", mirroring line 309.

### style-1-11: The AGENTS.md citation doesn't match the rule - Severity: Nit

- **Reviewer Lens:** `egm-style`
- **Affected Scope:** Line 333
- **Discrepancy Description**: AGENTS.md says typed text goes into email only through `simpleEmail`, and `magicLinkEmail` is not `simpleEmail`.
- **Rationale & Recommendation**: Say that typed text still goes through `simpleEmail`, or cite the escaping rule itself.

### style-1-12: "Switching only changes the context value" overstates - Severity: Nit

- **Reviewer Lens:** `egm-style`
- **Affected Scope:** Lines 391-392
- **Discrepancy Description**: A switch also writes storage and, when signed in, sends `PATCH /me`.
- **Rationale & Recommendation**: Say instead that the screen is not remounted.

### style-1-13: "No language of its own yet" contradicts §7 - Severity: Nit

- **Reviewer Lens:** `egm-style`
- **Affected Scope:** Line 410
- **Discrepancy Description**: §7 has Teach resolve `system` from the browser, so the site does have a language.
- **Rationale & Recommendation**: Write "no stored language".

### style-1-14: The note that `?lang` "can be typed or shared by hand" leads to no decision - Severity: Nit

- **Reviewer Lens:** `egm-style`
- **Affected Scope:** Lines 416-417
- **Discrepancy Description**: The note doesn't change anything a reader decides.
- **Rationale & Recommendation**: Drop it, or move it to the test plan.

### style-1-15: ADR 008 is quoted loosely - Severity: Nit

- **Reviewer Lens:** `egm-style`
- **Affected Scope:** Line 429
- **Discrepancy Description**: ADR 008 says "Not synced to the account for now". "Emails stay English" is not a verbatim quote.
- **Rationale & Recommendation**: Quote exactly, or paraphrase without quotation marks.

### style-1-16: The claim about older builds is too broad - Severity: Nit

- **Reviewer Lens:** `egm-style`
- **Affected Scope:** Lines 438-440
- **Discrepancy Description**: "Their users' `users.locale` stays null" holds only for users who use nothing but older builds.
- **Rationale & Recommendation**: Narrow the claim to those users.

### style-1-17: Internal process terms - Severity: Nit

- **Reviewer Lens:** `egm-style`
- **Affected Scope:** Lines 457, 470, 607
- **Discrepancy Description**: "Brainstorm review" and "Goldfish review" mean nothing to a new reader.
- **Rationale & Recommendation**: Say "the review in learner-main-page-improvements.md".

### style-1-18: Alternative E lists a con without its consequence - Severity: Nit

- **Reviewer Lens:** `egm-style`
- **Affected Scope:** Line 504
- **Discrepancy Description**: "If dismissed, it never appears again" doesn't say why that is a drawback.
- **Rationale & Recommendation**: State the consequence.

### style-1-19: Vague or uncalibrated phrases in the alternatives - Severity: Nit

- **Reviewer Lens:** `egm-style`
- **Affected Scope:** Lines 513, 550, 587, 620
- **Discrepancy Description**:
  - `en-SG` is not in backticks here, though it is elsewhere.
  - "Keep growing" is vague, and it overstates: a client-side code map doesn't touch handlers.
  - "Makes the API image larger" gives no figure.
  - "If server events prove too coarse" gives no test for when that is true.
- **Rationale & Recommendation**: Calibrate each phrase or drop it.

## Reviewer notes

- `egm-style` could not check the Stripe locale list at lines 349-351, because the Stripe package is not installed in this checkout.
- `egm-design` found no scalability or cost issues. It confirmed the Problem statement's claims about the code (the Profile tab is behind `Tabs.Protected`, preferences default to `en` and write back, `users` has no language column, and the sign-in request carries only email, audience and redirect). It also confirmed that new request fields are rollback-safe, because `validate` uses non-strict zod and strips unknown keys.
