# Goldfish Review Report

EGM Stage 9 (Implementation Readiness Test), round 1, REVIEW mode.

**Target:** `docs/designs/learner-chinese.md` (lines 625-1116, "## Detailed Implementation Plan" to the end)

## Reviewer Status

| Reviewer                       | Status    | Raw findings reported       |
| ------------------------------ | --------- | --------------------------- |
| `egm-implementation-readiness` | completed | 2 Blocker, 15 Major, 13 Nit |
| `egm-codebase-details`         | completed | 2 Blocker, 15 Major, 14 Nit |
| `egm-style`                    | completed | 0 Blocker, 14 Major, 26 Nit |

All three reviewers ran once and none needed a retry. After deduplication there are **3 Blockers, 27 Majors and 32 Nits** (62 findings).

**Verdict:** not ready. Two Blockers break the plan's own rule (lines 627-628) that every PR passes `npx turbo run typecheck test` by itself. The third would make every Teach and Support user who signs in from an email link stuck on English.

**Not verified:** `expo-localization` is not installed in `<main checkout>/node_modules`, so `useLocales`, `getLocales`, `languageTag` and the package's config plugin were not checked against types (codebase-details).

Finding IDs use the form `<reviewer>-1-<n>`. When reviewers overlapped, the finding keeps the ID of its primary reviewer, the others are listed under "Also reported as", and it takes the highest severity any of them gave.

---

## Blockers

### PR 1 does not typecheck on its own, and it ships `lang="system"` - Severity: Blocker

- **ID:** `implementation-readiness-1-1`. Also reported as: codebase-details B1.
- **Reviewer Lens:** `egm-implementation-readiness`, `egm-codebase-details`
- **Affected Scope:** lines 627-628, 642-650, 671-678 (items 1 and 4)
- **Discrepancy Description:**
  - Item 1 changes `Preferences['locale']` to `LocalePreference` (`'system' | 'en' | 'zh'`). Several places still pass `preferences.locale` where a `Locale` is required, and none of them changes before PR 4 or PR 5:
    - `packages/web-ui/src/preferences/PreferencesProvider.tsx:81`: `createTranslator(preferences.locale)`;
    - `packages/web-ui/src/preferences/PreferencesProvider.tsx:45`: `root.lang = preferences.locale`;
    - `packages/web-ui/src/preferences/format.ts:8`: `intlLocale(...)`;
    - `apps/learner/src/lib/preferences.tsx:63`: `createTranslator(preferences.locale)`.

    `createTranslator` and `intlLocale` take a `Locale` (`packages/i18n/src/index.ts:19,44`).
  - Item 4 adds a required `AuthUser.locale`. `buildAuthUser` (`apps/api/src/services/auth.service.ts:232-244`) only returns it from PR 2, and the `users.locale` column also arrives in PR 2, so `apps/api` fails typecheck in PR 1.
  - Even if PR 1 were forced through, both providers write the normalised preferences back to storage, so `system` would be stored. Then:
    - `apps/teach/public/preferences-init.js:15` and the Support copy would set `<html lang="system">`;
    - so would `applyToDocument` and the learner `preferences.tsx:51`.

    This would stay wrong until PR 4 (learner) and PR 5 (Teach and Support) land.
- **Rationale & Recommendation:** Do one of these:
  - Add `system` in the PR that also updates its consumers. Ship `AuthUser.locale` in the same PR as the column and `buildAuthUser`.
  - Or put the minimal wiring into PR 1: `resolveLocale` in both providers and in `preferences-init.js`, and `buildAuthUser` returning `locale: null`.

### PR 2 passes `locale` to `magicLinkEmail` before PR 3 adds the parameter - Severity: Blocker

- **ID:** `implementation-readiness-1-2`
- **Reviewer Lens:** `egm-implementation-readiness`
- **Affected Scope:** lines 759-762 (item 13, PR 2) against lines 848-853 (item 24, PR 3)
- **Discrepancy Description:**
  - Item 13 says to pass the language to `magicLinkEmail`, but `magicLinkEmail` only gains `locale` in item 24. TypeScript's excess-property check on the object literal fails PR 2.
  - The PR 2 test "the code email is English" (line 807) means nothing until PR 3 lands.
- **Rationale & Recommendation:** Move the bullet and its test into PR 3, or add the parameter in PR 2.

### The sign-in link always carries `lang`, so Teach and Support users get pinned to English - Severity: Blocker

- **ID:** `codebase-details-1-1`. Also reported as: implementation-readiness M12 (sign-in half), style N6.
- **Reviewer Lens:** `egm-codebase-details`, `egm-implementation-readiness`, `egm-style`
- **Affected Scope:** lines 759-762 (item 13) and 1069-1079 (item 48)
- **Discrepancy Description:**
  - Item 13 says: "Pick the email language: the request's `locale`, else `en` … add `lang=<it>` to the emailed URL". So every link gets `lang`.
  - Teach and Support never send `locale` (`packages/web-ui/src/portal/SignInPage.tsx:43-44`), so every Teach link becomes `TEACH_URL/verify?token=…&lang=en`.
  - Item 48's script stores `?lang` whenever the stored value is `system` or missing. The web-ui provider writes `system` back on its first mount (`PreferencesProvider.tsx:61-64`).
  - Result: every Teach or Support user who signs in from the email link is pinned to English as if they had chosen it. That breaks CUJ 6 after sign-in and Decision 3.
  - The plan's own design text (line 343) says the link gains `lang` only "when the request has a `locale`".
  - The placeholder `lang=<it>` also differs from `lang=<locale>` at lines 343 and 797.
- **Rationale & Recommendation:** Add `lang=<locale>` only when `input.locale` is present. Add a test that a Teach sign-in link has no `lang`.

---

## Major

### Item 3 edits the wrong barrel file - Severity: Major

- **ID:** `implementation-readiness-1-3`. Also reported as: codebase-details M1, style M1.
- **Reviewer Lens:** all three
- **Affected Scope:** lines 666-669
- **Discrepancy Description:**
  - `packages/core/src/index.ts` contains only `export * from './contracts'` and `export * from './domain'`.
  - The new module has to be exported from `packages/core/src/domain/index.ts`, which is not in the file list.
  - `localePreferenceSchema` is already re-exported, through `contracts/index.ts:7` (`export * from './preferences'`).
- **Rationale & Recommendation:** Replace item 3 with "`packages/core/src/domain/index.ts` (Modify): add `export * from './locale'`." As written, a write allowlist would block the edit that is actually needed.

### The "push a switch" effect writes to the account on any mismatch, not only on a switch - Severity: Major

- **ID:** `implementation-readiness-1-4`. Also reported as: codebase-details M2, style M9.
- **Reviewer Lens:** all three
- **Affected Scope:** lines 911-923 (item 31)
- **Discrepancy Description:**
  - The effect sends `PATCH /me` whenever the stored value is `en` or `zh` and differs from `user.locale`. `refreshUser` runs on every mount (`apps/learner/src/lib/session.tsx:57-59`), so the effect fires at launch as well as after a switch.
  - Two devices with different stored choices flip the account back and forth. That is the failure the plan used to reject Alternative B, and it contradicts "On a switch…" and "the latest change wins" (lines 316-318).
  - Every pre-release install with a stored `en` writes `en` to a `zh` account without anyone choosing anything (CUJ 4).
  - In the offline branch (`session.tsx:50-52`) the status is `signed_in` while `user` is null, so the mismatch test is true and the effect sends a PATCH that will fail.
- **Rationale & Recommendation:**
  - Send the PATCH only from the user's own pick, for example a `chooseLocale` called by `LanguageSwitch` and the Profile screen, or from `setPreference('locale', …)` while signed in.
  - Name the call: `api.me.$patch({ json: { locale } })`.
  - Specify what happens offline.

### Adopting the account's language on every `refreshUser` breaks "Follow device" and races the storage read - Severity: Major

- **ID:** `implementation-readiness-1-5`. Also reported as: codebase-details M3.
- **Reviewer Lens:** `egm-implementation-readiness`, `egm-codebase-details`
- **Affected Scope:** lines 899-917 (items 30-31)
- **Discrepancy Description:**
  - Item 31 adopts `user.locale` "after `signIn` and after `refreshUser`", and `refreshUser` runs on every launch. A signed-in learner who picks "Follow device" while their account has a locale is switched back to the account's language on the next launch.
  - This contradicts lines 313-315, which adopt the account's language after verify only.
  - `SessionProvider` mounts while `PreferencesProvider` is still `ready=false`. The splash screen gates rendering only (`apps/learner/src/app/_layout.tsx:56-61, 73-81`), and `preferences` holds the defaults until the read finishes (`preferences.tsx:27, 30-41`).
  - If `refreshUser` resolves first, the app adopts the account's language and `setPreferences(stored)` then overwrites it, or it adopts based on a `system` value that is not really stored.
- **Rationale & Recommendation:** Adopt only in `signIn`, and make both adoption and any PATCH wait for `ready`.

### `setParamLocale` is undefined, and the native `?lang` path does not exist - Severity: Major

- **ID:** `implementation-readiness-1-6`. Also reported as: codebase-details M5, codebase-details M6, style M8.
- **Reviewer Lens:** all three
- **Affected Scope:** lines 899-909 (item 30), 933-941 (item 33)
- **Discrepancy Description:**
  - Item 30 reads `lang` once on web from `window.location` and also adds a `setParamLocale` that screens call. The context's listed additions contain only `locale: Locale`.
  - The plan gives no signature for `setParamLocale` and doesn't say:
    - which of the two mechanisms wins;
    - whether the value lasts across in-app navigation (`success.tsx:31-34` redirects to `/sign-in` and drops `lang`);
    - whether it is cleared on unmount.
  - Item 33 says "On native, `?lang` arrives in the deep link". But `apps/learner/app.json` has only `scheme: "elevate"`, with no associated domains and no intent filters. The emailed link and the Stripe return URLs are https `LEARNER_URL` pages, so the native app never receives them.
- **Rationale & Recommendation:**
  - Either drop the native path and `setParamLocale`, or specify both. That means a signature (for example `setParamLocale(lang: string | null)`), its lifetime and precedence, the call site in item 33, and universal links with `app.json` added to the file list.

### Native hand-offs to the web lose the language - Severity: Major

- **ID:** `codebase-details-1-2`
- **Reviewer Lens:** `egm-codebase-details`
- **Affected Scope:** lines 933-941, 953-958 (items 33, 35)
- **Discrepancy Description:**
  - The native app never opens Stripe directly. It opens the web course page in the system browser from two places:
    - `apps/learner/src/app/course/[slug].tsx:86`;
    - `apps/learner/src/app/checkout/[courseId].tsx:100`.
  - That browser has its own storage, so the course page, web sign-in and checkout all open in the browser's guessed language. That defeats Goal 5 on native.
- **Rationale & Recommendation:** Append `?lang=<resolved>` to both hand-off URLs and list that change in items 33 and 35.

### Category keys do not compile against the current types - Severity: Major

- **ID:** `implementation-readiness-1-7`. Also reported as: codebase-details M7.
- **Reviewer Lens:** `egm-implementation-readiness`, `egm-codebase-details`
- **Affected Scope:** lines 969, 989-992
- **Discrepancy Description:**
  - These are all typed `string` in `packages/core/src/contracts/catalog.ts`:
    - `CourseCard.category` (line 20);
    - `CoursePublicView.category` (line 51);
    - `CategoryCount.slug` (line 76).
  - `courses.category` is `text()` (`packages/db/src/schema/courses.ts:33`).
  - So ``t(`category.${slug}`)`` has the type `category.${string}`, which is not a `MessageKey`, and fails to compile.
- **Rationale & Recommendation:**
  - Either retype the contracts to `CourseCategory`, adding `catalog.ts` and possibly `catalog.service.ts` to the file list, or add a guarded helper.
  - Either way, state what an unknown slug shows.

### `formatSgd` still writes English "Free" - Severity: Major

- **ID:** `codebase-details-1-3`
- **Reviewer Lens:** `egm-codebase-details`
- **Affected Scope:** lines 994-1000 (item 38), and line 380
- **Discrepancy Description:**
  - `packages/core/src/domain/money.ts:117` returns `'Free'` when `showFree` is set. Three learner call sites use it:
    - `course/[slug].tsx:104`;
    - `checkout/[courseId].tsx:203`;
    - `components/CourseCard.tsx:45`.
  - So "`formatSgd` stays as it is" leaves English on the key purchase screens.
- **Rationale & Recommendation:** Render "Free" from a learner key at those call sites, or give `formatSgd` a label parameter. Name the key either way.

### Lists in `Trail` are not localised - Severity: Major

- **ID:** `codebase-details-1-4`
- **Reviewer Lens:** `egm-codebase-details`
- **Affected Scope:** lines 994-1000 (item 38)
- **Discrepancy Description:**
  - `apps/learner/src/components/Trail.tsx:114` renders `· after {item.requires.join(', ')}`.
  - ADR 008 and AGENTS.md require lists to follow the language (web-ui `useFormatList` gives `、` in Chinese).
  - Item 38 adds learner date and duration formatters only.
- **Rationale & Recommendation:** Add a learner list formatter, or state a rule for this case.

### `RootError` has no `PreferencesProvider` to translate with - Severity: Major

- **ID:** `codebase-details-1-5`. Also reported as: an implementation-readiness Nit.
- **Reviewer Lens:** `egm-codebase-details`, `egm-implementation-readiness`
- **Affected Scope:** lines 961, 965 (item 35)
- **Discrepancy Description:**
  - `apps/learner/src/components/RootError.tsx:7-11` is the expo-router root `ErrorBoundary`. It wraps only `SafeAreaProvider` and `ThemeProvider`, so a `t()` from `usePreferences()` would throw there (`preferences.tsx:71-74`).
  - The same fault already exists, because `ThemeProvider` calls `usePreferences()` (`theme/ThemeProvider.tsx:12`).
- **Rationale & Recommendation:**
  - Specify how `RootError` gets a translator: its own `PreferencesProvider`, or `createTranslator` with the device language.
  - Map each shared component to an area: `EmptyState`, `RootError`, `+not-found`, `Trail` and `CertificateCard`.

### `Chip` cannot take `lang` or `testID` - Severity: Major

- **ID:** `implementation-readiness-1-8`. Also reported as: codebase-details M11.
- **Reviewer Lens:** `egm-implementation-readiness`, `egm-codebase-details`
- **Affected Scope:** lines 943-951 (item 34)
- **Discrepancy Description:**
  - `apps/learner/src/ui/Chip.tsx:5-14` takes no `lang` and no `testID`. React Native 0.88's strict types have no `lang` prop on `Text` or `Pressable`.
  - Item 34's "`lang` attribute on web" therefore needs a file that is not in the list, and a typing approach for a web-only prop.
- **Rationale & Recommendation:**
  - Add `ui/Chip.tsx` to the file list, or have `LanguageSwitch` render its own control.
  - Say how the web-only `lang` is typed.
  - Require `role="radio"` chips inside a labelled `radiogroup`, as `profile.tsx:116-129` already does.

### The Maestro "tap by `testID`" change has no `testID`s to tap - Severity: Major

- **ID:** `implementation-readiness-1-9`. Also reported as: codebase-details M12, style N22.
- **Reviewer Lens:** all three
- **Affected Scope:** lines 966-967, 1043-1048 (items 35, 44)
- **Discrepancy Description:**
  - The only `testID` in the learner app today is at `_layout.tsx:101`. The flows tap English text (`sign-in.yaml:10,12,15,16`; `learner-preferences.yaml:23-72`).
  - Item 35 says `TopNav.tsx` and `PillTabBar.tsx` "stay as they are", yet the flows tap their "Sign in" and "Profile".
  - The "Restore defaults" step (`learner-preferences.yaml:64-72`) does not account for the new "Follow device" chip.
  - `.maestro/scripts/request-code.js:2-5` asks for a second link with no `locale`. Verify uses the newest link (`auth.service.ts:98-101`), so the flow's 中文 choice never reaches `users.locale`.
- **Rationale & Recommendation:**
  - List the `testID` names and their files: `TopNav`, `PillTabBar`, `Chip`, the email input, the request button, and the Appearance and Language chips.
  - Update the "Restore defaults" step.
  - Make `request-code.js` send `locale`.

### The learner jest tests have no harness - Severity: Major

- **ID:** `implementation-readiness-1-10`. Also reported as: codebase-details M13, style N21.
- **Reviewer Lens:** all three
- **Affected Scope:** lines 1025-1041 (items 42-43)
- **Discrepancy Description:**
  - "Storing `zh` while signed in sends `PATCH /me`" needs mocks of `@/lib/api` (the Hono client) and of `token-storage` (expo-secure-store).
  - "The sign-in screen keeps the typed email" renders an expo-router screen that uses `useRouter`, `useLocalSearchParams` and `Link`.
  - `jest.setup.ts` mocks only AsyncStorage, and item 42 adds only an `expo-localization` mock.
  - The plan doesn't split the cases between `preferences.test.tsx` and the new `locale.test.tsx`. That filename also repeats `packages/core/test/locale.test.ts`.
  - It doesn't give item 42's default mocked device list. That default decides whether existing assertions such as `preferences.test.tsx:84-89` still see English.
- **Rationale & Recommendation:**
  - Specify the API, token-storage and router mocks, or use `expo-router/testing-library`.
  - Give the default device list.
  - Assign each case to a file.

### Refunds made in the Stripe dashboard put an English reason into the learner email - Severity: Major

- **ID:** `codebase-details-1-6`
- **Reviewer Lens:** `egm-codebase-details`
- **Affected Scope:** lines 857-864, 876-882 (items 25, 27)
- **Discrepancy Description:**
  - A refund made in the Stripe dashboard passes the literal `reason = 'Refunded in Stripe'` (`apps/api/src/services/transactions.service.ts:298, 316`) into the email as `Reason: ${reason}` (`:216`).
  - No person typed that text, so a `zh` refund email would contain English.
  - The stored reason is asserted in `apps/api/test/certificates-earnings.test.ts:293`.
- **Rationale & Recommendation:** Translate it when the email is sent, using a key such as `email.refund.reasonStripe`, and keep the stored value as it is.

### The "Follow device" key is missing on Profile and in the wrong area for the portals - Severity: Major

- **ID:** `implementation-readiness-1-11`. Also reported as: codebase-details M15, style M14.
- **Reviewer Lens:** all three
- **Affected Scope:** line 957 (item 35), lines 1058-1067 (item 47)
- **Discrepancy Description:**
  - The learner Profile chip row gains "Follow device" in PR 4, but no key is named. That change is also tucked into a parenthesis in a file list.
  - The portal key, `ui.preferences.language.system`, only arrives in PR 5.
  - Every existing preference label is `prefs.*` in the `chrome` area, including `prefs.theme.system` (`packages/i18n/src/messages/areas/chrome.en.ts:25-35`).
- **Rationale & Recommendation:** Use one key, for example `chrome` `prefs.language.system`, for both portals and the Profile tab. Add it in PR 4 or earlier, and give the Profile change its own bullet.

### web-ui needs a changed context shape and a file that is not listed - Severity: Major

- **ID:** `implementation-readiness-1-12`
- **Reviewer Lens:** `egm-implementation-readiness`
- **Affected Scope:** lines 1052-1056 (item 45)
- **Discrepancy Description:**
  - Item 45 says the format hooks use the resolved value. `useIntlLocale` lives in `packages/web-ui/src/preferences/format.ts`, which is not in the file list (and breaks after item 1).
- **Rationale & Recommendation:** State that `PreferencesContextValue` gains `locale: Locale`, and that `format.ts` and `applyToDocument` read it. Add `format.ts` to the file list.

### Nobody is named to write or check the Chinese text - Severity: Major

- **ID:** `implementation-readiness-1-13`. Also reported as: style M12.
- **Reviewer Lens:** `egm-implementation-readiness`, `egm-style`
- **Affected Scope:** lines 825-835 (item 21), 986-987 (item 36)
- **Discrepancy Description:**
  - Item 36 requires Chinese "written by a person, not machine-translated", reviewed by "a Chinese reader".
  - The catalog parity test fails without every `zh` key, so the implementer, possibly an agent, cannot merge without Chinese strings.
  - No role, timing or record of review is given.
  - PR 3's `email.zh.ts` has no such rule at all.
- **Rationale & Recommendation:** Name who supplies the strings and when, or allow drafts. Require a fluent Simplified Chinese reviewer, named in the PR, to approve every `.zh.ts` change, including PR 3's.

### The main Goal 1 check has no procedure - Severity: Major

- **ID:** `implementation-readiness-1-14`. Also reported as: style M11.
- **Reviewer Lens:** `egm-implementation-readiness`, `egm-style`
- **Affected Scope:** lines 1107-1108
- **Discrepancy Description:** "A text diff of every learner route in `zh` that lists any remaining Latin-script strings" doesn't say what is compared with what, or what tool produces the list.
- **Rationale & Recommendation:** Name a script and its path, for example one that renders each route with `locale: 'zh'` and prints text nodes and accessibility labels matching `[A-Za-z]`, checked against the Goal 1 exceptions. Or call it a manual audit and give its steps.

### The Stripe idempotency key ignores the new parameters - Severity: Major

- **ID:** `implementation-readiness-1-15`
- **Reviewer Lens:** `egm-implementation-readiness`
- **Affected Scope:** lines 776-799 (items 15-18)
- **Discrepancy Description:**
  - `checkoutIdempotencyKey` (`providers/payments/types.ts:46-52`) is `enrollmentId:amountCents:payoutAccountId`. A retry after a language switch reuses the key with a different `locale` and success URL.
  - The fake returns the old session (`fake.ts:134-138`). Real Stripe rejects a reused key whose parameters differ.
  - Caveat from the reviewer: `expires_at` already changes on every request, so retries may already conflict today. This was not confirmed.
- **Rationale & Recommendation:** Decide whether `locale` joins the key, and record the decision.

### Where the switcher goes is left open - Severity: Major

- **ID:** `implementation-readiness-1-16`. Also reported as: codebase-details N14 (Explore hero).
- **Reviewer Lens:** `egm-implementation-readiness`, `egm-codebase-details`
- **Affected Scope:** lines 931, 956 (items 32, 35)
- **Discrepancy Description:**
  - The plan doesn't say where `LanguageSwitch` sits on the sign-in screen. Goal 3 requires it to survive the code step, so it must be on both the email card and the code card.
  - "In the Explore hero" gives no position, and the hero is hidden while searching or filtering (`(tabs)/index.tsx:36`).
  - `sign-in.tsx` stores errors already worded (`setError(errorMessage(e))`), so after a switch an error stays in the old language.
- **Rationale & Recommendation:** Give the exact positions, and say whether a stale-language error is acceptable or should be stored unworded.

### The PR 1 records describe work that lands in PRs 3 and 4 - Severity: Major

- **ID:** `style-1-1`
- **Reviewer Lens:** `egm-style`
- **Affected Scope:** lines 714-728 (items 8-9)
- **Discrepancy Description:** PR 1 adds the learner app to ADR 008's "Translated today" list and extends AGENTS.md's "Translated pages" rule to the learner app and its emails. The emails are translated in PR 3 and the app in PR 4. Until then, both documents call English-literal pages translated.
- **Rationale & Recommendation:** Move the "Translated today" and AGENTS.md edits to PR 4, and the email part to PR 3. Keep only ADR 010 and the "Amended by" pointers in PR 1.

### The planned AGENTS.md line contradicts the email table - Severity: Major

- **ID:** `style-1-2`
- **Reviewer Lens:** `egm-style`
- **Affected Scope:** lines 722-728 (item 9), against line 338
- **Discrepancy Description:**
  - "A learner email's language comes from `users.locale`" is wrong for the sign-in code email, which uses the request's `locale`. Agents follow AGENTS.md as a rule, so this would teach the wrong one.
  - "via ADR 010" should read "see ADR 010".
  - "a new string there" has no clear antecedent.
- **Rationale & Recommendation:** Write: "The receipt, certificate and refund emails use `users.locale ?? 'en'`; the sign-in code email uses the request's `locale`. See ADR 010."

### The ADR 008 amendment marker sits on a sentence that ADR 010 only partly amends - Severity: Major

- **ID:** `style-1-3`
- **Reviewer Lens:** `egm-style`
- **Affected Scope:** lines 718-719 (item 8)
- **Discrepancy Description:** "…as do error messages from the API and emails" also covers API errors, and those stay English (line 709).
- **Rationale & Recommendation:** Write "Learner emails: amended by ADR 010. API error messages still stay English."

### The `PATCH /me` response is described wrongly - Severity: Major

- **ID:** `style-1-4`. Also reported as: codebase-details N2.
- **Reviewer Lens:** `egm-style`, `egm-codebase-details`
- **Affected Scope:** lines 773-774 (item 14)
- **Discrepancy Description:** "It still returns `c.json(body, 200)`" reads as echoing the request body back. `apps/api/src/routes/me.ts:34` returns `c.json({ user: await auth.buildAuthUser(user.id) }, 200)`.
- **Rationale & Recommendation:** Write "It still returns `{ user }` (the rebuilt `AuthUser`, now with `locale`) with status 200." Item 31 should use that response to update the cached user.

### `verify` leaves the `sign_in` event and the locale update underspecified - Severity: Major

- **ID:** `style-1-5`. Also reported as: codebase-details N7, an implementation-readiness Nit (item 13), style N7.
- **Reviewer Lens:** all three
- **Affected Scope:** lines 763-768 (item 13)
- **Discrepancy Description:**
  - `trackEvent(sign_in, { audience, locale })` leaves `locale` unbound. Line 421 gives `link.locale ?? users.locale`.
  - The real call is `trackEvent(this.deps, { userId, name: ANALYTICS_EVENTS.signIn, properties })` (`audit.service.ts:46-49`).
  - The plan doesn't say whether the event is recorded before or after the Support `forbidden` throw (`auth.service.ts:141-146`).
  - "update `users.locale`" has no target value.
  - The update must sit between `findOrCreateUser` and `buildAuthUser` (`:138-139`), or the returned `AuthUser.locale` is stale.
- **Rationale & Recommendation:**
  - Write "set `users.locale` to `link.locale`".
  - Use `WHERE locale IS NULL` for the guessed case.
  - Store `localeChosen ?? false`.
  - Place the update before `buildAuthUser`.
  - Spell out the `trackEvent` call and its position relative to the `forbidden` check.

### The checkout return-URL `lang` rule is muddled and misses null-locale users - Severity: Major

- **ID:** `style-1-6`. Also reported as: implementation-readiness M12 (checkout half), codebase-details N5, codebase-details N6, an implementation-readiness Nit (item 18).
- **Reviewer Lens:** all three
- **Affected Scope:** lines 795-799 (item 18), 815-821 (item 20)
- **Discrepancy Description:**
  - Both URLs already have a query string (`?session_id=…`; `?checkout=cancelled` at `payments.service.ts:210`), so only `&lang=` applies. "`?lang=` / `&lang=`" gives no condition for choosing.
  - Nothing says what the URLs carry when `users.locale` is null, yet item 20 asserts they "carry `lang`".
  - "Both `checkout_completed` calls … from the enrollment's user": the free path (`payments.service.ts:152-156`) has no loaded enrollment user and should use `user.locale` from `SessionUser`. Item 20 has no `checkout_completed` assertion.
- **Rationale & Recommendation:**
  - Write "append `&lang=<locale>` to both URLs when `users.locale` is set; omit it when it is null", and make item 20 match.
  - Name the two event paths: webhook and sync.
  - Add an event assertion.

### The verification walkthrough doesn't match item 49 - Severity: Major

- **ID:** `style-1-7`. Also reported as: an implementation-readiness Nit, codebase-details N14.
- **Reviewer Lens:** all three
- **Affected Scope:** lines 1039-1041 and 1105, against lines 1087-1088
- **Discrepancy Description:** The walkthrough covers "CUJs 1–6" on learner web, the iOS simulator and Teach. But item 49 relies on CUJ 7 and on Support being checked by hand, and Android, a shipping platform (line 12), is never mentioned.
- **Rationale & Recommendation:** Write "CUJs 1-5 on learner web (`zh-CN` profile), the iOS simulator and an Android emulator; CUJs 6-7 in Teach and in Support."

### The `useErrorMessage()` return shape is wrong - Severity: Major

- **ID:** `style-1-8`
- **Reviewer Lens:** `egm-style`
- **Affected Scope:** lines 1005-1007 (item 39)
- **Discrepancy Description:** "returning `errorMessage(error, …)`" leaves `error` unbound. web-ui's `useErrorMessage()` (`packages/web-ui/src/preferences/errors.ts`) returns a callback.
- **Rationale & Recommendation:** Write "returning `(error: unknown) => errorMessage(error, t('learnerCommon.error.generic'), t('learnerCommon.error.unreachable'))`, memoised on `t`."

---

## Nits

### Accuracy against the code

- **`codebase-details-1-7`** (line 753; also implementation-readiness). `migration-guard.test.ts:12-88` checks only the `_init` migration and never checks that a migration is additive. Drop the causal claim.
- **`codebase-details-1-8`** (lines 786-789; also implementation-readiness). `FakePaymentsProvider` already stores `...input` (`fake.ts:142-150`), so it records `locale` with no change beyond the type.
- **`codebase-details-1-9`** (lines 862-863 and 340; also implementation-readiness).
  - All three email queries already load `user: true` (`payments.service.ts:278`, `certificates.service.ts:50`, `transactions.service.ts:206`), so "add `locale: true`" doesn't apply.
  - The method is `issueForEnrollment`, not `CertificatesService.issue`.
- **`codebase-details-1-10`** (lines 802-813). `t.signIn` (`apps/api/test/helpers/test-app.ts:70-81`) sends no `locale` or `localeChosen`. Say whether to extend it or call `t.api` directly.
- **`codebase-details-1-11`** (lines 1009-1014; also implementation-readiness, style N20).
  - web-ui's `fillSlots` (`packages/web-ui/src/preferences/rich.tsx:15-21`) is plain React and does not render DOM nodes. Correct the claim, and consider hoisting it to a shared place rather than copying it.
  - A new `lib/rich.tsx` is easy to confuse with the existing `components/RichText.tsx`.
- **`codebase-details-1-12`** (lines 1002-1007). `ApiError.fromResponse` falls back to the English literal `'Something went wrong'` (`apps/learner/src/lib/api-error.ts:30`), and `useErrorMessage` would show it as the API's message, for example on a 502 with no body.
- **`codebase-details-1-13`** (lines 680-698; also implementation-readiness).
  - `packages/core/test/preferences.test.ts:41-44` expects `'klingon'` → `'en'`. Name it as the assertion that changes to `'system'`.
  - `isChosen` has no test.
- **`codebase-details-1-14`**. `prefs.language.description` (`chrome.en.ts:34-35`, "More of Elevate is translated over time") becomes untrue for the learner app and is not updated.
- **`codebase-details-1-15`** (lines 886-896; also implementation-readiness, style N14, style N15).
  - `npx expo install` may add a config-plugin entry to `apps/learner/app.json`, which is not in the file list. Check the SDK 58 docs on whether the plugin's Android locale-change setting is needed for `useLocales()` to re-render, and cite them for "No config plugin entry is needed".
  - Item 29 uses `languageTag` but line 291 says `languageCode`. Pick one: `languageTag` keeps the region subtags that item 6 tests.
- **`codebase-details-1-16`** (line 963). `ui/Logo.tsx` contains only the name "Elevate" and a `suffix` prop, so there is nothing to translate.
- **`codebase-details-1-17`** (lines 876-882).
  - The refund email tests live in `certificates-earnings.test.ts:249-252`, not `money-loop.test.ts`.
  - `webhooks-stripe.test.ts` has no mail assertions today.
- **`style-1-9`** (line 855). "Every placeholder value still goes through `para()` and `escapeHtml`" overclaims:
  - `prettyCode` in `magicLinkEmail` is inserted into the HTML without them;
  - the subject and the text part are not HTML.

  Write "values inserted into HTML go through `para()`/`escapeHtml`; the subject and text part are plain text."
- **`style-1-10`** (lines 735-736). Adding a language to `supportedLocales` changes the Drizzle schema. The Postgres enum changes only after `npm run db:generate` emits a migration.

### Completeness and specification

- **`implementation-readiness-1-17`**. Say that the English catalog reproduces today's strings word for word, because existing tests match them:
  - "You're enrolled" (`checkout.test.ts:139`);
  - "Refund issued" (`payout-accounts.test.ts`, `certificates-earnings.test.ts`);
  - "Your certificate" (`certificates-earnings.test.ts:109`).
- **`implementation-readiness-1-18`** (lines 831-832, 998; also style N8).
  - "the text-part variants" and `learnerCommon.duration.*` leave the key names to the implementer. Name them, including the hours-only case (`{h} h`).
  - "every sentence … as whole sentences" is redundant.
- **`implementation-readiness-1-19`** (lines 1073-1079; also style N23). Say whether `?lang` is removed from the address bar when a stored choice blocks it (the last step of CUJ 7). `replaceState` should keep `location.hash`.
- **`style-1-11`** (lines 951, 978, area table at 363-370). `learnerCommon` first appears in item 34 and is missing from the Technical Plan's area table.
- **`style-1-12`** (lines 971-972). The files are marked "Modify" but "the implementer confirms each file". Call it a candidate list or say it was checked, and give a search pattern: "string literals in JSX" misses `accessibilityLabel` values and strings built outside JSX.
- **`style-1-13`** (lines 873-874). Item 26's placeholder-parity case repeats `packages/i18n/test/catalog.test.ts:36-44` (also codebase-details N14). Drop it or say what it adds.

### Wording and formatting

- **`style-1-14`** (line 636). "The learner app needs PR 2 deployed first" has an unclear subject. Write "PR 4 ships only after PR 2's API is deployed", and state whether PR 4 depends on PR 3.
- **`style-1-15`** (line 650). The definition of `system` is too narrow. Write "not chosen; resolved from `?lang`, the account, then the device".
- **`style-1-16`** (lines 659-664).
  - The `system` sub-bullets have no verb. Write "returns `param` if…".
  - `isChosen(stored)` has no parameter type. Write `isChosen(stored: LocalePreference): boolean`.
- **`style-1-17`** (line 703). "the decisions made while drafting" points at the four-item list at lines 225-237, but nine items follow. Write "record:".
- **`style-1-18`** (lines 840-841). "add the `email` area, and the learner areas from PR 4 in that PR" puts two PRs in one clause. Split it.
- **`style-1-19`** (lines 843, 886). Write "root `package-lock.json`" in both places.
- **`style-1-20`** (lines 861-863). "and pass `locale`" is missing its object. Write "pass `locale` to `simpleEmail`".
- **`style-1-21`** (line 957). The line runs far past the document's wrap of about 100 columns.
- **`style-1-22`** (line 969). ``"`t(\`category.${slug}\`)`"`` renders broken, because backslash escapes don't work inside code spans. Use a double-backtick span, as ADR 008 does.
- **`style-1-23`** (line 1084). "**Type / Scope**: none added." misuses the field. Write "test coverage note" and move "No new tests" into Proposed Changes.
- **`style-1-24`** (lines 1094-1096). A command is said to "cover" another command. Write "…and the learner jest-expo suite".
- **`style-1-25`** (lines 1114-1116). The HTML comment and "_Drafted with EGM_" repeat each other. Keep one, unless the template needs both.

---

## Points confirmed accurate (codebase-details)

- `sign_in` is in `ANALYTICS_EVENTS` and nothing sends it.
- There are ten `COURSE_CATEGORIES`.
- Stripe 23.1.0's `Checkout.SessionCreateParams.Locale` includes `zh`, `zh-HK` and `zh-TW`.
- `pgEnum` accepts `readonly ['en','zh']`, and `@elevate/db` already depends on `@elevate/core`.
- tsup bundles `@elevate/*`, so the API can import `@elevate/i18n`.
- `PreferencesProvider` wraps `SessionProvider`.
- `packages/web-ui` has no test runner.
- All three sites send `script-src 'self'`.
- ADR number 010 is free.
- `parseStoredPreferences` falls back field by field.
- Every route and component path listed in item 35 exists.
