# Goldfish Review Report

**Target:** `docs/designs/learner-chinese.md` (`1-1116`)

Stage 5, Initial Zoom Out Review. Mode: REVIEW.

## Reviewer Status

| Reviewer                 | Status    |
| ------------------------ | --------- |
| `egm-zoom-out`           | completed |
| `egm-inventive-catalyst` | completed |

**Severity breakdown (after deduplication):** 0 Blocker, 9 Major, 8 Nit.

Neither reviewer found a Blocker. Both say the core is sound and fits the codebase: the `system`
value, a single resolver, `users.locale`, the `email` catalog area, the switcher, translating the
whole app, and the rejection of Alternatives A, B, C, H, I, K and L. Most of the Majors have one
root cause. The precedence order says "chosen beats guessed", but in several places the design
writes a guess into storage, where it then counts as a choice. Majors 1-4 are four views of that
problem. Fix them together.

The synthesizer checked these claims against the code: item 31 (lines 916-923),
`apps/learner/src/lib/session.tsx:57-59` (`refreshUser()` runs on every mount),
`apps/learner/src/lib/preferences.tsx:43-46` (defaults are written back once loaded) and
`preferences.tsx:51,63` (`preferences.locale` is used directly as a `Locale`), and PR 1 items 1-2
(lines 627-669).

## Prioritized Findings (Blockers -> Major -> Nits)

### 1. The account-sync effect flips the account between devices, which brings back the failure Alternative B was rejected for - Severity: Major

- **Reviewer Lens:** `egm-zoom-out`, `egm-inventive-catalyst` (both found this; zoom-out says it could be argued up to Blocker)
- **Affected Scope:** Lines 316-318 (§3 "On a switch"), 916-923 (item 31), 1037-1038 (test); compare Alternative B at 466-471.
- **Discrepancy Description:**
  - §3 says the app sends `PATCH /me` when a signed-in learner _picks_ a language. Item 31 does something else. An effect watches the stored preference and sends a PATCH whenever the value is `en` or `zh` and differs from `user.locale`, and "the next change or refresh retries".
  - `session.tsx:57-59` calls `refreshUser()` on every launch. Suppose device A switches to `en` while device B stores `zh`. When B launches, it sees `en ≠ zh` and PATCHes `zh`. When A next refreshes, it PATCHes `en`.
  - The rule in practice is "the last device to launch wins", not "the latest change wins". Receipt and refund email language changes without anyone choosing anything. Major 3 makes this worse: every existing install stores `en`, so the first launch of any old install overwrites a `zh` account.
- **Rationale & Recommendation:**
  - Send the PATCH only from the switch action itself (`LanguageSwitch` and the Profile chip `onPress`), never from a reconciliation effect.
  - State what a device does when a refresh finds a different account value: leave it alone, or adopt it, but never push.
  - Optionally, to retry a failed PATCH, keep a durable `localeSyncPending` flag that is cleared on success and retried on refresh. A refresh then never pushes a value the user did not just pick.
  - Rewrite the test at 1037-1038 as "a press sends PATCH", not "storing sends PATCH".

### 2. Adopting the account's language into device storage turns guesses into choices, undoes "Follow device", and doesn't match the stated precedence - Severity: Major

- **Reviewer Lens:** `egm-zoom-out`, `egm-inventive-catalyst` (both found this)
- **Affected Scope:** Lines 73-80 (precedence), 176-183 (CUJ 3), 232-233, 255-257, 272-277 (resolver inputs), 281, 313-315 (§3 after verify), 389 (Profile "Follow device"), 409-415, 656 (item 2 signature), 903-905 and 916-917 (items 30-31).
- **Discrepancy Description:**
  - The precedence list makes "what their account has stored" step 2, but `resolveLocale({ stored, deviceLanguages, param })` (line 656) has no account input. Instead, item 31 writes `user.locale` into storage when the stored value is `system`, and from then on it "counts as chosen".
  - An account value that was filled from a guess (the rule at 232-233) therefore becomes a choice on every device that signs in. The live device-language following (line 292) stops applying. The next sign-in sends `localeChosen: true`, which feeds Major 1.
  - When a signed-in learner picks "Follow device" (line 389), that choice is overwritten by `user.locale` at the next launch.
  - This contradicts the design's own reason for never storing `?lang` (lines 412-413, "storing it would turn a guess into a lasting choice"). The same `?lang` value comes back through the account and is stored anyway.
- **Rationale & Recommendation:**
  - Derive the account's language instead of copying it. Make the account a resolver input: `resolveLocale({ stored, account, param, deviceLanguages })` with the order `stored(en|zh) > account > param > device > en`. The session injects it the way screens inject `setParamLocale`, and the "adopt" write in item 31 goes away.
  - Consider renaming the Profile option to "Automatic" (account, then device) so the label is honest for signed-in users.
  - A minimal alternative: adopt only on the `signIn` event, never on `refreshUser`.
  - Document the side effects:
    - Signing out reverts to the device guess.
    - On native, the account value arrives only after `/me`, so there may be one re-render.
    - The pre-paint scripts cannot see the account.

### 3. A legacy stored `en` counts as a choice, so the target audience never sees Chinese - Severity: Major

- **Reviewer Lens:** `egm-inventive-catalyst`
- **Affected Scope:** Lines 50-53 (The Problem), 185-192 (CUJ 4), 227-228 (decision 1), 486-506 (Alternatives D and E).
- **Discrepancy Description:**
  - Two pieces of code mean a stored `en` almost never records a real choice:
    - `apps/learner/src/lib/preferences.tsx:43-46` writes the parsed preferences back to storage once loaded, so every install and browser that has opened the app stores `locale: 'en'`.
    - `preferences.tsx:54-56` and `packages/web-ui/src/preferences/PreferencesProvider.tsx:60-64,75-77` make `setPreference` a no-op when the value is unchanged, so picking English while English is the default leaves no trace.
  - Before this release, the learner app's only language control sat behind sign-in. The only stored `en` that reflects a choice belongs to someone who switched to `zh` and back.
  - The doc treats "we can't tell chose-English from never-chose" (line 52) as unavoidable and decides it in favour of that tiny group. The cost falls on the Chinese-reading visitors the Problem section is about: anyone who opened the English page before this release stays in English. Alternative D's objection ("a second field every reader must check") assumes the marker would be read everywhere.
- **Rationale & Recommendation:**
  - Add a one-time migration inside `parseStoredPreferences`. Add a version marker (for example `v: 2`) to the stored shape. A legacy record without `v` and with `locale: 'en'` becomes `system`, a legacy `zh` stays `zh`, and new writes carry `v`. No other code reads the marker.
  - Optionally, limit the migration to the learner app, so Teach users who have worked in English for months are not switched.
  - Costs: the rare user who switched to `zh` and back to `en` on a Chinese-language device is switched once, and each pre-paint script needs the same rule (see Major 6).

### 4. A stale stored value in another browser beats `?lang` on hand-off pages, which breaks Goal 5 - Severity: Major

- **Reviewer Lens:** `egm-inventive-catalyst`
- **Affected Scope:** Lines 64-67, 110-113 (Goal 5), 281-283 (§1 "`?lang` is never stored"), 343-344 (sign-in link), 352-354 (return pages), 409-415.
- **Discrepancy Description:**
  - "A choice always beats `?lang`" conflicts with "the language survives leaving the app". The emailed link and native checkout's return pages open in the system browser, which has its own storage.
  - Because of the write-back in Major 3, any browser that has ever opened learner web stores `en` and ignores `lang=zh`.
  - On these pages, `?lang` is a minutes-old signal from the same person, fresher than whatever that browser stored.
- **Rationale & Recommendation:** choose one.
  - Treat `?lang` on the hand-off pages (`/verify`, `/checkout/success`, the cancelled-course return) as a page-scoped override above the stored value. It is still never stored.
  - Or carry the chosen bit in the link (`lang=zh&lc=1`), mirroring `localeChosen`, so only a chosen hand-off beats the stored value.
  - Whichever you choose, add the exception to the precedence list. Fixing Major 3 removes most stale `en` values, which makes this smaller but does not remove it.

### 5. The Teach/Support `?lang` hand-off is out of scope here, and as designed it stores a possibly guessed language as a lasting choice - Severity: Major

- **Reviewer Lens:** `egm-zoom-out` (scope / YAGNI), `egm-inventive-catalyst` (guess becomes a choice)
- **Affected Scope:** Lines 28-29 (Overview dependency), 129-133 (Non-Goals), 202-221 (CUJ 6, CUJ 7), 234-237, 401-417 (§7; line 416: "Nothing sends Teach a `?lang` yet"), 1069-1089 (items 48-49).
- **Discrepancy Description:**
  - **Scope:** the Non-Goals give the Teach banner to the Teach banner design, and nothing sends Teach a `?lang` yet. PR 5 still adds a write-to-storage path for `?lang` in two init scripts that are synced by hand and not tested (item 49 says they are checked by hand). Its rule differs from the learner app's, and lines 409-415 have to explain why.
  - **Contradiction:** the banner sends the learner's _resolved_ language, which may be a device guess. Teach stores it, so its picker shows 中文 instead of "Follow device", and a later `?lang=en` is ignored (CUJ 7, line 220). This is the "guess becomes a lasting choice" outcome the doc rejects for the learner app. The stated reason, surviving Teach's redirects and sign-in, is about how long the value lasts, not about storing it for good.
- **Rationale & Recommendation:**
  - Preferred (zoom-out): keep only the part PR 5 cannot avoid. The shared `preferencesSchema` change forces web-ui and both init scripts to resolve `system` and to stop writing `lang="system"`. Move the `?lang` hand-off, CUJ 7 and the explanation of the difference into the Teach banner design, its only consumer, which can also decide Open Question 8. Remove the Overview's dependency line.
  - If it stays (inventive catalyst): the init script writes `?lang` to `sessionStorage` (`elevate.langHint`), which survives redirects and sign-in within the tab. The resolver reads it as `param`, and `localStorage` stays `system`. This means web-ui's provider must read `sessionStorage` (it reverses lines 407-408).

### 6. The resolver rule is copied by hand into up to three init scripts, and none of the copies is tested - Severity: Major

- **Reviewer Lens:** `egm-inventive-catalyst` (Major), `egm-zoom-out` (Nit, on the learner copy)
- **Affected Scope:** Lines 279-280, 287-290 (§1), 396-408 (§7), 1016-1023 (item 41), 1069-1089 (items 48-49).
- **Discrepancy Description:**
  - Today `apps/teach/public/preferences-init.js` and `apps/support/public/preferences-init.js` are kept identical only by a comment. The design adds a third copy for the learner app that deliberately differs (it does not store `?lang`), and item 49 says the portal copies are checked only by hand. Majors 3-5 would each add more logic to these copies.
  - The learner copy has no job to do:
    - `apps/learner/app.json:26` sets `"output": "single"`, and `apps/learner/public/index.html:42` is an empty `#root`, so nothing is painted before JS runs.
    - The learner theme is applied from TypeScript, not from CSS `data-theme` (ADR 008, line 25).
    - Web preferences are already read synchronously (`preferences.tsx:26`).
- **Rationale & Recommendation:**
  - Drop item 41. Set `document.documentElement.lang` synchronously in the learner `PreferencesProvider`'s state initializer on web.
  - For the two portal scripts, either:
    - add a vitest that loads each script's text and runs it with stubbed `localStorage`, `navigator.languages`, `location` and `history` against the same case table as `locale.test.ts` (cheaper); or
    - generate each `public/preferences-init.js` at build time from `packages/core` `resolveLocale` as an IIFE. The output is still a file, so `script-src 'self'` still holds.

### 7. Open Question 5 decides whether this work reaches its audience, but stays open while the whole build is committed - Severity: Major

- **Reviewer Lens:** `egm-zoom-out`
- **Affected Scope:** Lines 125, 141-143, 563-564, 69 ("a wall of English"); the brief, `docs/designs/learner-main-page-improvements.md` lines 78-80 ("decides whether Feature 1 reaches its audience").
- **Discrepancy Description:** The design commits to translating every route (about 135 strings plus plurals), four emails, and cross-portal changes. It does not yet know whether any Chinese-taught course exists. If none does, the user meets a Chinese interface over an all-English catalog, which may not fix the problem it states.
- **Rationale & Recommendation:** Answer Q5 before approval (a catalog query plus asking the pilot teachers) and record the answer. If it is zero, either bring a course-language field into scope or state why the interface alone is still worth shipping. This does not reopen Alternative J.

### 8. PR 1 cannot pass typecheck on its own - Severity: Major

- **Reviewer Lens:** `egm-zoom-out`
- **Affected Scope:** Lines 627-628 (the claim "Each passes ... typecheck ... on its own"), 642-650 (item 1), 666-669. The consumers change only in PR 4 (items 30, 41) and PR 5 (items 45-48).
- **Discrepancy Description:**
  - Item 1 changes `preferencesSchema.locale` to `localePreferenceSchema.default('system')` (`'system' | 'en' | 'zh'`). Four existing call sites use it as a `Locale`:
    - `packages/web-ui/src/preferences/PreferencesProvider.tsx:45,81`: `root.lang = preferences.locale` and `createTranslator(preferences.locale)`;
    - `apps/learner/src/lib/preferences.tsx:51,63`: the same two uses.
  - `createTranslator` takes a `Locale` (`packages/i18n/src/index.ts:44`), so the change fails typecheck in learner and web-ui.
  - If it were forced through, a stored `system` would render `lang="system"` and fall back to English at runtime.
- **Rationale & Recommendation:** Do one of the following:
  - Put the schema change in the same PR as the minimum resolver wiring in both providers and both init scripts.
  - Or keep the default at `en` and the enum unchanged until PR 4.

### 9. `magic_links.locale` and `locale_chosen` add schema the design doesn't need - Severity: Major

- **Reviewer Lens:** `egm-zoom-out`
- **Affected Scope:** Lines 249-256, 299-301, 308-312, 742-753, 760-765; Alternative F at 518-519.
- **Discrepancy Description:**
  - `apps/api/src/services/auth.service.ts:45-84` (`requestMagicLink`) already has the request's locale when it sends the email.
  - `apps/learner/src/app/(auth)/verify.tsx:15-30` shows that verify is a client-made API call.
  - The new columns exist only so `verify` can apply the chosen-or-guessed rule later. The Problem section (line 82) already names sign-in itself as a request that can carry the language.
- **Rationale & Recommendation:**
  - Keep `locale` on `magicLinkRequestSchema`, used only for the email language and the link's `lang` parameter.
  - Put `locale` and `localeChosen` on the verify request and apply the rule there. This drops two columns and the extra writes.
  - The device that completes sign-in speaks for itself. That is arguably more correct when a native user opens the emailed link in a browser.

### 10. The sign-in code email ignores a known account's language - Severity: Nit

- **Reviewer Lens:** `egm-inventive-catalyst` (leaning Major for returning Chinese learners)
- **Affected Scope:** Lines 182-183 (CUJ 3), 338 (§4 email table), 759-762 (item 13).
- **Discrepancy Description:** `auth.service.ts:45-80` does no user lookup, so every new device of a Chinese account gets an English sign-in email unless the device happens to guess `zh`.
- **Rationale & Recommendation:**
  - At `requestMagicLink`, apply the doc's own rule: `localeChosen ? request.locale : (users.locale ?? request.locale ?? 'en')`.
  - The cost is one indexed read by email. The response does not change, so it leaks nothing about which addresses have accounts.
  - This fits with Major 9: the email-time choice stays at request time, and the account write moves to verify.

### 11. Checkout's language source is stale, and Goal 6's wording doesn't match the events - Severity: Nit

- **Reviewer Lens:** `egm-inventive-catalyst`, `egm-zoom-out` (merged)
- **Affected Scope:** Lines 69-71, 82, 114-116 (Goal 6), 348-354 (§5), 421-423, 795-798 (item 18), 921-923.
- **Discrepancy Description:**
  - The Stripe `locale`, the return-URL `lang` and `checkout_started` all read `users.locale`. That value can be stale, because PATCH failures are ignored (`apps/api/src/services/payments.service.ts:198-210`). Stripe can then open in a different language from the UI.
  - Goal 6 says events carry "the language the learner was using", which is not what the checkout events record.
  - Server events on sign-in and checkout cannot count visitors who leave before signing in, which is the gap the Problem section names.
- **Rationale & Recommendation:**
  - Add `locale` to the checkout-start request body and use it for Stripe, the return URLs and `checkout_started`. Keep `users.locale` for the receipt the webhook sends and for `checkout_completed`.
  - Reword Goal 6 to match.
  - State that arrival and bounce counts stay unmeasured until the client-events Future Improvement.

### 12. `users.locale` isn't scoped to the learner audience - Severity: Nit

- **Reviewer Lens:** `egm-inventive-catalyst`
- **Affected Scope:** Lines 134-135, 308-312, 479-484 (Alternative C); the brief's open question 10.
- **Discrepancy Description:** Alternative C was rejected because portals would overwrite each other's values. The verify rule, though, writes for any audience that sends `locale`, so the same coupling returns once Teach sends it.
- **Rationale & Recommendation:** Do one of the following:
  - Gate the verify write and the PATCH on `audience === 'learner'`.
  - Or state in ADR 010 that `users.locale` is account-wide and that Teach may write it.

### 13. Learner `?lang` handling covers more than it needs to - Severity: Nit

- **Reviewer Lens:** `egm-zoom-out`
- **Affected Scope:** Lines 281-283, 905 (`setParamLocale`), 939-940 (native deep-link `?lang`), item 33.
- **Discrepancy Description:** `?lang` matters only on web pages opened before the account value is known. A native install always has a stored value or a device guess, so passing `?lang` through native deep links and per-screen `setParamLocale` is a second mechanism that changes almost nothing.
- **Rationale & Recommendation:**
  - Read `?lang` once from `window.location` on web inside the provider, and drop `setParamLocale` and the per-screen pass-through.
  - This is compatible with Major 4: the override for hand-off pages also lives in that one web read.
  - If Major 2's account input is adopted, the session needs its own injection point for the account value.

### 14. The `fillSlots` reasoning is wrong - Severity: Nit

- **Reviewer Lens:** `egm-zoom-out`
- **Affected Scope:** Lines 1009-1014.
- **Discrepancy Description:** `packages/web-ui/src/preferences/rich.tsx:15-21` returns `createElement(Fragment, null, ...children)`. That is platform-neutral React and works inside a React Native `<Text>`, so no new counterpart is needed.
- **Rationale & Recommendation:**
  - Fix the description, then either copy the six lines as they are or move `fillSlots` to a shared package.
  - `@elevate/i18n` has no React dependency today (`packages/i18n/package.json:13-15`), so moving it there means adding React as a peer dependency.

### 15. Build one language control, not two - Severity: Nit

- **Reviewer Lens:** `egm-zoom-out`
- **Affected Scope:** Lines 385-389, 943-951, 957.
- **Discrepancy Description:** `apps/learner/src/app/(tabs)/profile.tsx:116-130` is already a radio group of `Chip`s labelled from `localeNames`. The plan adds a separate `LanguageSwitch` on top of extending it.
- **Rationale & Recommendation:** Build `LanguageSwitch` once, with an optional "Follow device" chip, and use it on Explore, sign-in and Profile.

### 16. The placeholder-parity check is duplicated - Severity: Nit

- **Reviewer Lens:** `egm-zoom-out`
- **Affected Scope:** Lines 873-874.
- **Discrepancy Description:** ADR 008 (line 73) and `packages/i18n/test/catalog.test.ts` already fail on mismatched placeholders.
- **Rationale & Recommendation:** Drop that part of `apps/api/test/emails.test.ts`. Keep the rendering and escaping assertions.

### 17. Server-side behaviour has no cheap off switch - Severity: Nit

- **Reviewer Lens:** `egm-inventive-catalyst`
- **Affected Scope:** Lines 434-443 (Rollout and rollback).
- **Discrepancy Description:** The only way to turn it off is to revert the deploy, yet the riskiest effects (Chinese emails, Stripe `locale`) all live in the API.
- **Rationale & Recommendation:** Consider one API environment setting that makes the API ignore incoming `locale`. Weigh it against the spec's "no feature flags" boundary and the cost of an untested code path. The per-key English fallback in the catalog already protects clients from missing strings.

## Cross-finding notes

- **Fix together:** Majors 1-4 share a root cause. With the account as a resolver input (Major 2), PATCH only on press (Major 1), the legacy `en` migration (Major 3) and the hand-off override (Major 4), "chosen beats guessed" holds everywhere.
- **Tension between reviewers:** zoom-out wants `?lang` narrowed to one web read (Nit 13); the inventive catalyst wants it strengthened on hand-off pages (Major 4). Both fit in one place: the provider's single web read of `window.location`.
- **Order of work:** if Major 5 moves the Teach/Support hand-off out of this design, most of the init-script logic in Major 6 goes with it. Only `system` resolution remains, and only the two portal scripts need it.
