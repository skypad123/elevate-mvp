# Goldfish Review Report

EGM Stage 9 (Implementation Readiness Test), round 2 (the one allowed re-audit), REVIEW mode.

**Target:** `docs/designs/learner-chinese.md` (lines 713-1383, "## Detailed Implementation Plan" to the end)

## Reviewer Status

| Reviewer                       | Status    | Raw findings reported      |
| ------------------------------ | --------- | -------------------------- |
| `egm-implementation-readiness` | completed | 1 Blocker, 6 Major, 15 Nit |
| `egm-codebase-details`         | completed | 0 Blocker, 7 Major, 13 Nit |
| `egm-style`                    | completed | 0 Blocker, 4 Major, 25 Nit |

All three reviewers ran once. None needed a retry.

After deduplication there are **1 Blocker, 9 Majors and 36 Nits** (46 findings).

**Verdict:** not ready, but close. Most round-1 issues are fixed, including all three round-1 Blockers. One new Blocker remains: PR 1 fails `npx turbo run test` because an existing test asserts the old idempotency key, and that test is in no file list.

Of the 9 Majors:

- 6 are new.
- 3 are round-1 issues that the rewrite resolved only in part: `codebase-details-1-5`, `implementation-readiness-1-10` and `implementation-readiness-1-9`.

**Not verified:** `expo-localization` is still not installed in `<main checkout>/node_modules`. So `getLocales()`, `useLocales()`, `languageTag` and the package's config plugin were not checked against types.

**IDs and severity:** IDs use the form `<reviewer>-2-<n>`. When reviewers overlapped, the finding keeps the ID of its primary reviewer and lists the others under "Also reported as". It takes the highest severity any of them gave.

---

## Blockers

### The new idempotency key breaks an existing test that is in no PR's file list - Severity: Blocker

- **ID:** `implementation-readiness-2-1`. Also reported as: codebase-details M1 (as Major), plus Nits from implementation-readiness and style (item 15 wording).
- **Status:** NEW. It was introduced by the fix for round-1 `implementation-readiness-1-15`.
- **Reviewer Lens:** `egm-implementation-readiness`, `egm-codebase-details`, `egm-style`
- **Affected Scope:** lines 852-859 (item 13), 868-874 (item 15), 913-921 (item 19)
- **Discrepancy Description:**
  - Item 13 changes `checkoutIdempotencyKey` to `checkout:<enrollment>:<amount>:<payoutAccount>:<locale|none>`.
  - `apps/api/test/payout-accounts.test.ts:95` asserts the old string exactly: `expect(checkoutIdempotencyKey(base)).toBe('checkout:enr_1:8000:acc_1')`. After item 13 the key ends in `:none`, so PR 1 fails `npx turbo run test`.
  - The test also calls the function without `locale` (lines 85-89), so a required `locale` would fail typecheck as well.
  - `payout-accounts.test.ts` appears nowhere in the document, so an implementer working from the file list cannot fix it. That breaks the plan's own rule at lines 715-716.
  - Item 15 also says `PaymentsService` passes the locale "to `checkoutIdempotencyKey`". The service never calls that function. Both providers call `checkoutIdempotencyKey(input)` with the whole `CheckoutSessionInput` (`providers/payments/stripe.ts:114`, `fake.ts:133`).
- **Rationale & Recommendation:**
  - Add `apps/api/test/payout-accounts.test.ts` (Modify) to PR 1. Give the new expected string and add a case where a different locale gives a different key.
  - State that `locale` is an optional field of the parameter object (`locale?: Locale`).
  - In item 15, drop "and to `checkoutIdempotencyKey`". Say instead that adding `locale` to `CheckoutSessionInput` is enough, because both providers already pass the whole input.

---

## Major

### Between PR 1 and PR 4, the Teach and Support language picker shows "English" on a Chinese page and cannot pick English - Severity: Major

- **ID:** `implementation-readiness-2-2`. Also reported as: codebase-details M4, style M2.
- **Status:** NEW.
- **Reviewer Lens:** all three
- **Affected Scope:** lines 718-724, 923-941 (items 20-22, PR 1), against lines 1315-1319 (item 55, PR 4) and 1240-1250 (item 48)
- **Discrepancy Description:**
  - From PR 1, web-ui stores `system` by default and resolves it from `navigator.languages`, so a `zh` browser sees Teach and Support in Chinese.
  - The `<select>` still binds `value={preferences.locale}` (`packages/web-ui/src/preferences/PreferencesCard.tsx:79-92`), and its options stay `supportedLocales` until PR 4. A controlled select whose value matches no option shows its first option, so the picker reads "English" on a Chinese page.
  - Choosing "English" then fires no `change` event, so the visitor cannot get to English without going through 中文 first. That contradicts CUJ 6, and the plan says each PR can be released on its own (line 715).
  - On the learner side, Profile's chips select by the stored value (`profile.tsx:126`), so no chip shows as selected from PR 1 until PR 3 adds "Follow device".
- **Rationale & Recommendation:** Do one of these:
  - Move item 55, together with the `prefs.language.system` key and the learner "Follow device" chip, into PR 1.
  - Or keep web-ui (and the learner app) resolving `system` to `en` until the option exists.
  - Or bind the select to the resolved `locale` until item 55 lands, and add `PreferencesCard.tsx` to PR 1.

### `RootError` still cannot render - Severity: Major

- **ID:** `codebase-details-2-1`. Also reported as: implementation-readiness finding 3.
- **Status:** round-1 `codebase-details-1-5`, not resolved.
- **Reviewer Lens:** `egm-codebase-details`, `egm-implementation-readiness`
- **Affected Scope:** lines 1224-1226 (item 46). The Technical Plan says the same at lines 463-465.
- **Discrepancy Description:**
  - The plan gives `RootError` its own translator, `createTranslator(resolveLocale(...))`, but keeps its existing `ThemeProvider` wrapper (`apps/learner/src/components/RootError.tsx:11`).
  - `ThemeProvider` calls `usePreferences()` (`apps/learner/src/theme/ThemeProvider.tsx:12`). That throws outside `PreferencesProvider` (`apps/learner/src/lib/preferences.tsx:71-74`), and the boundary is exported from the root layout (`_layout.tsx:37`).
  - So the error screen still crashes, and its translated text never shows. The Goal 1 audit of error states cannot see it.
- **Rationale & Recommendation:**
  - Wrap `RootError` in its own `<PreferencesProvider>`. That reuses existing code, gives both `t` and the theme, and removes the need for the hand-built translator. On native it renders with defaults until the storage read finishes, which is acceptable for an error screen.
  - Or give `ThemeProvider` a fallback that works without the context, and add `ThemeProvider.tsx` to the file list.

### Only sign-in gets translated errors; the other call sites stay English or go blank - Severity: Major

- **ID:** `implementation-readiness-2-3`. Also reported as: codebase-details M6, style Nit 4.
- **Status:** NEW.
- **Reviewer Lens:** all three
- **Affected Scope:** lines 1160-1169 (item 44), 1181-1211 (item 46), against Technical Plan lines 444-450 ("Screens store the error object and word it when they render")
- **Discrepancy Description:**
  - Item 46 moves only sign-in to stored error objects and `useErrorMessage()`. About 17 other `errorMessage(` call sites keep its English default fallbacks (`api-error.ts:46-54`). They include:
    - `checkout/[courseId].tsx:36,45,64`;
    - `verify.tsx:36`;
    - `checkout/success.tsx:69`;
    - `course/[slug].tsx:47,76`;
    - `QuizRunner.tsx:64,79`;
    - `(tabs)/index.tsx:138`;
    - `learning.tsx:48`;
    - `c/[token].tsx:31`;
    - `(tabs)/profile.tsx:32`.
  - `(tabs)/profile.tsx:32` is in none of item 46's lists, and it stores the worded string in state.
  - Item 44 removes the `'Something went wrong'` fallback from `ApiError.fromResponse` (`api-error.ts:30`) and says an empty API message falls back to the generic sentence. But `errorMessage` returns `error.message` unchanged for any `ApiError` (`api-error.ts:50`). A 5xx with no body would then show an empty error everywhere.
- **Rationale & Recommendation:**
  - Say that every `errorMessage(` call in `apps/learner/src` moves to `useErrorMessage()`.
  - Say that screens which keep an error in state store the error object instead of a string.
  - Change `errorMessage` to return `error.message || fallback` for an `ApiError`.
  - Add `(tabs)/profile.tsx` to item 46.

### The jest harness cannot run the session tests as written - Severity: Major

- **ID:** `codebase-details-2-2`. Also reported as: implementation-readiness finding 4, plus Nits from codebase-details and style (test paths, providers).
- **Status:** round-1 `implementation-readiness-1-10`, only partly resolved.
- **Reviewer Lens:** `egm-codebase-details`, `egm-implementation-readiness`, `egm-style`
- **Affected Scope:** lines 1266-1294 (items 51-52)
- **Discrepancy Description:**
  - **Missing mocks.** Item 51 mocks `api.me.$patch`, `api.auth['magic-link'].$post` and `api.auth.verify.$post`. But `refreshUser` calls `api.auth.me.$get()` (`apps/learner/src/lib/session.tsx:42`) on every signed-in launch, and `signOut` calls `api.auth['sign-out'].$post()` (`:69`).
  - **Why that matters.** If `$get` is not mocked, it throws a TypeError, and the provider falls into the offline branch (`:50-52`): `signed_in` with `user` null. So the cases "a launch with `user.locale` null sends one fill-in" and "a launch with it set sends none" cannot pass.
  - **No response shape.** The mocks must return what `unwrap` accepts, an object with `ok`, `status` and `json()` (`api-error.ts:39-44`). The plan doesn't say so, or how the offline case is simulated.
  - **No providers.** `sign-in.test.tsx` renders through `renderRouter`, but the plan doesn't say how `PreferencesProvider`, `ThemeProvider`, `QueryClientProvider` and `SessionProvider` are supplied, either as a `wrapper` option or as a test `_layout`. The real `_layout.tsx` (`:56-62`) also needs fonts and the splash screen.
  - **No paths.** The two new tests have no directories. Jest matches only `**/__tests__/**` (`apps/learner/package.json:69-71`).
- **Rationale & Recommendation:**
  - Add `api.auth.me.$get` and `api.auth['sign-out'].$post` to the mock.
  - Specify a response helper, for example `jsonResponse(body, status = 200)` returning `{ ok, status, json: async () => body }`.
  - Simulate offline by rejecting with `new Error('Network request failed')`.
  - Name the provider wrapper for `renderRouter`.
  - Give full paths under `apps/learner/src/**/__tests__/`.

### The Profile language row has two selection rules, no `testID`s for its English and 中文 chips, and contradicts the Technical Plan - Severity: Major

- **ID:** `style-2-1`. Also reported as: implementation-readiness finding 6, codebase-details Nit (Profile selection).
- **Status:** round-1 `implementation-readiness-1-9`, partly unresolved (Profile `testID`s), plus a NEW contradiction.
- **Reviewer Lens:** all three
- **Affected Scope:** lines 977-981 (item 25), 1134-1141 (item 41), 1212-1214 (item 46, Profile), 1300-1302 (item 53), against Technical Plan lines 451-458
- **Discrepancy Description:**
  - **Placement.** The Technical Plan says `LanguageSwitch` "sits in three places", Profile included. The plan instead keeps Profile's own chips (item 25) and adds a third one, "Follow device" (item 46).
  - **Selection.**
    - `LanguageSwitch` selects by the resolved locale (item 41), while Profile's chips select by the stored value (`profile.tsx:126`).
    - If Profile used `LanguageSwitch` plus "Follow device", two radios in one `radiogroup` could be checked at once.
    - The plan doesn't say which rule Profile follows.
  - **`testID`s.**
    - `lang-en` and `lang-zh` exist only on `LanguageSwitch`. Profile gets only `lang-system` and the theme IDs.
    - But `.maestro/learner-preferences.yaml:56,68` taps 中文 and English on Profile, and item 53 says the flows tap only the `testID`s from items 41 and 46.
- **Rationale & Recommendation:**
  - In item 46, write: "Profile keeps its own chip row, not `LanguageSwitch`. Its chips get `testID`s `lang-en`, `lang-zh` and `lang-system` (or `profile-lang-*` to avoid duplicates across screens). The selected chip is the stored value (`system`, `en` or `zh`)."
  - Change Technical Plan lines 451-458 to say the switcher sits in two places and that Profile has its own row.
  - Alternatively, give `LanguageSwitch` a `withSystem` prop that selects by the stored value.

### The new 中文 step in the Maestro flows breaks the text matches after it - Severity: Major

- **ID:** `implementation-readiness-2-4`. Also reported as: codebase-details Nit (item 53), style Nit 16.
- **Status:** NEW. The round-1 asks in `implementation-readiness-1-9` were met, but this step is new.
- **Reviewer Lens:** all three
- **Affected Scope:** lines 1296-1303 (item 53)
- **Discrepancy Description:**
  - "Switch to 中文 on the sign-in screen" names no file and no position in the flow.
  - `sign-in.yaml` runs as a subflow of `learner-preferences.yaml` (`:20`). If the step goes in `sign-in.yaml`, every later English text match fails:
    - `sign-in.yaml:16` "Enter the 6-digit code";
    - `sign-in.yaml:25` "Profile";
    - `learner-preferences.yaml:25` "Appearance";
    - `learner-preferences.yaml:30-31` "Dark" selected;
    - `learner-preferences.yaml:55` "Language".
  - The existing 中文 step at `learner-preferences.yaml:56-57` would also become a no-op.
  - "It sends `locale`" (about `request-code.js`) gives no value. Under the new design this value affects only the email, because verify takes the language from its own request.
  - The flows are manual and not run in CI, which limits the impact.
- **Rationale & Recommendation:**
  - Name the file and the step's position.
  - Either replace the remaining text matches with `testID`s, or switch back to English before the theme section.
  - Write `locale: 'zh'` for `request-code.js`.

### The free-course enrol call on the course page is left out - Severity: Major

- **ID:** `codebase-details-2-3`. Also reported as: style M4.
- **Status:** NEW.
- **Reviewer Lens:** `egm-codebase-details`, `egm-style`
- **Affected Scope:** lines 991-995 (item 27), against line 880 (item 15) and Technical Plan lines 401-402, 498-499
- **Discrepancy Description:**
  - Free courses are enrolled straight from the course page with `startCheckout(c.id)` (`apps/learner/src/app/course/[slug].tsx:70`). Item 27 updates only `checkout/[courseId].tsx:56`.
  - `locale` is a trailing optional parameter, so the missed call still compiles. The free path's `checkout_completed` (`payments.service.ts:152-156`) then records `locale: null` for these enrolments, which undermines Goal 6.
  - It also contradicts the Technical Plan: "The learner app sends its resolved language as `locale` when it starts checkout."
  - With the positional signature `startCheckout(courseId, promoCode, locale)`, that caller would have to pass `undefined` for the promo code.
- **Rationale & Recommendation:**
  - Add `course/[slug].tsx` to item 27.
  - Use a signature the compiler enforces at every call site: a required `locale`, as in `startCheckout(courseId, locale, promoCode?)`, or an options object `startCheckout(courseId, { promoCode, locale })` with `locale` required.

### Stripe metadata has no rule for a missing locale - Severity: Major

- **ID:** `codebase-details-2-4`. Also reported as: implementation-readiness Nit (item 15).
- **Status:** NEW.
- **Reviewer Lens:** `egm-codebase-details`, `egm-implementation-readiness`
- **Affected Scope:** lines 872-880 (item 15)
- **Discrepancy Description:**
  - `CheckoutSessionInput.metadata` is `Record<string, string>` (`providers/payments/types.ts:38`), so `locale: undefined` doesn't typecheck.
  - The pattern already used in the same object writes empty strings: `promoCodeId: promoRow?.id ?? ''` (`payments.service.ts:217`). An implementer who follows it gets `''`, and `metadata.locale ?? null` then gives `''` rather than `null`. That contradicts "null when it's unknown" (line 494).
- **Rationale & Recommendation:**
  - Write `...(locale ? { locale } : {})` into the metadata.
  - In `fulfilCheckout`, read it as `localeSchema.safeParse(m.locale).success ? m.locale : null`, or at least `m.locale || null`.

### The PR summaries and the dependency sentence put changes in the wrong PRs - Severity: Major

- **ID:** `style-2-2`. Also reported as: implementation-readiness Nit (lines 729-730).
- **Status:** NEW.
- **Reviewer Lens:** `egm-style`, `egm-implementation-readiness`
- **Affected Scope:** lines 718-730, against items 22 and 24-27 (lines 937-995)
- **Discrepancy Description:**
  - PR 1 is summarised as "the minimum provider and init-script wiring that keeps every consumer typechecking". But PR 1 also changes how the learner app behaves:
    - `chooseLocale` sends `PATCH /me`, and there is the one-time fill-in (item 24);
    - sign-in, verify and checkout send `locale` and `localeChosen` (items 26-27);
    - Teach and Support start resolving `system` from the browser (item 22).
  - Line 729 says "PR 3 ships only after PR 1's API is deployed, because the app sends the new request fields". The app sends those fields from PR 1 on, and PR 3 adds none. Zod also strips unknown keys, so an older API ignores them anyway.
- **Rationale & Recommendation:**
  - Add the behaviour changes to PR 1's summary: the request fields, the `PATCH /me` writes, and Teach and Support resolving `system`.
  - Replace line 729 with the real constraint. For example: "PR 1's API deploys before or with its learner web build. PR 3 needs PR 1 merged, and its native build needs PR 1's API in production."

---

## Nits

### Accuracy against the code

- **`codebase-details-2-5`** (lines 943-955, 1123; items 23, 39).
  - Until PR 3, native has `deviceLanguages = []` and resolves `en`. A store build cut from PR 1 or PR 2 would write a guessed `en` at verify and in the fill-in, and the fill-in never overwrites it later.
  - Say that no native build ships before PR 3, or leave `locale` out of native requests until device languages are known.
- **`codebase-details-2-6`** (lines 868-891; items 15-17).
  - Give the new service signature, for example `startCheckout(user, courseId, promoCode?, locale?)` (today `payments.service.ts:100-104`).
  - Give the `t.signIn` shape. Today it is `signIn(email, audience = 'learner')` (`test/helpers/test-app.ts:70`). Say whether the new fields are positional or an options object. Also reported by implementation-readiness.
- **`codebase-details-2-7`** (line 921; item 19). "Both `checkout_completed` paths" is ambiguous, because item 15 names three: webhook, sync and free.
  - The webhook and sync paths share the one `trackEvent` in `fulfilCheckout` (`payments.service.ts:361-365`), and the free path is separate (`:152-156`).
  - Name the free, webhook and sync cases to test. Also reported by implementation-readiness and style (Nit 8).
- **`codebase-details-2-8`** (lines 1143-1148; item 42). With `slug: string`, `` `category.${slug}` `` has the type `` `category.${string}` ``, which is not a `MessageKey`.
  - Specify a type guard that narrows to `CourseCategory` (`packages/core/src/domain/categories.ts:16`), so the ten keys are checked at compile time without a cast.
- **`codebase-details-2-9`** (lines 1171-1179; item 45). `packages/i18n` has no `react` or `@types/react` (`packages/i18n/package.json`), so it relies on root hoisting (root `package.json:38`).
  - Add the dev dependency, or say that hoisting is relied on.
  - Consider `peerDependenciesMeta.react.optional`, so `npm ci --omit=dev --workspace @elevate/api` (`apps/api/Dockerfile:20`) doesn't pull in React.
  - Also reported by implementation-readiness.
- **`codebase-details-2-10`** (lines 807-813; item 8). `pgEnum('locale', supportedLocales)` is the first runtime import from `@elevate/core` in `packages/db/src/schema`; today those files use only `import type`, e.g. `courses.ts:1`.
  - Confirm that drizzle-kit's loader handles it and `npm run db:generate` still works, or inline `['en', 'zh'] as const satisfies readonly Locale[]`.
  - Not verified. Also reported by implementation-readiness.
- **`codebase-details-2-11`** (lines 1305-1311; items 49, 54). These become stale and are not updated:
  - the "Translated today" header comment in `packages/i18n/src/messages/en.ts:9-11`;
  - ADR 008 line 84 (`fillSlots` from `@elevate/web-ui/preferences`);
  - ADR 008 line 85 (`useFormatDate` and `useFormatList`), after item 45.

  Add those edits. Also reported by implementation-readiness.
- **`codebase-details-2-12`** (lines 1207-1211; item 46, sign-in). The client-side `'Enter a valid email address'` (`sign-in.tsx:31`) shares the `error` state that becomes an error object. Give the new state type.
- **`codebase-details-2-13`** (lines 1028-1030; item 29). The list of tests that match English text leaves out `money-loop.test.ts:295` and `payout-accounts.test.ts:268, 279`. This is harmless if the English stays word for word.
- **`implementation-readiness-2-5`** (lines 940-941, 1260-1262; items 22, 50). Say that a stored value other than `en`/`zh` is treated as `system`. Today `preferences-init.js:15` writes any string into `lang`.
- **`implementation-readiness-2-6`** (line 1318; item 55). The `onChange` cast (`PreferencesCard.tsx:84`) must widen to `LocalePreference`.
- **`implementation-readiness-2-7`** (lines 1077-1079; item 35).
  - `simpleEmail`'s subject is whatever the caller passes, so in `zh` only its footer and `lang` can be asserted.
  - `magicLinkEmail` has no course title, so the "`<script>` in a course title" case applies only to `simpleEmail`.
  - Also reported by style (Nit 17).

### Completeness and specification

- **`implementation-readiness-2-8`** (lines 1110-1112; item 38).
  - Whether Android needs the config plugin's locale-change setting for `useLocales()` to re-render is still left to the implementer. Settle it in the plan, or add "and adds the setting if needed".
  - The heading should say that `app.json` changes only if `expo install` writes to it.
  - Also reported by style (Nit 12).
- **`implementation-readiness-2-9`** (line 1270; item 51). `getLocales` and `useLocales` return objects, so write the mock as `[{ languageTag: 'en-SG', … }]`, and say how a test overrides it. Also reported by style (Nit 15).
- **`implementation-readiness-2-10`** (lines 1068-1070; item 34).
  - Say whether `email.refund.reasonStripe` replaces the `{reason}` value inside `email.refund.reason`, or the whole sentence.
  - "uses it where it records … When the reason equals it" has three "it"s with two antecedents.
  - Also reported by style (Nit 9).
- **`style-2-3`** (lines 1248-1249; item 48). The reworded `prefs.language.description` has no proposed English or Chinese text. Give both.
- **`style-2-4`** (lines 1131-1132; item 40).
  - "a one-line comment says so" doesn't say where. Write "in `Chip.tsx`".
  - "Typed spread" is vague. Name the cast or the helper type.
- **`style-2-5`** (lines 1194-1199; item 46).
  - The component paths mix `src/components/` and `src/` bases. State the base.
  - `media/AudioArtefact.tsx`, `VideoArtefact*.tsx`, `QuizRunner.tsx` and `learn/[enrollmentId]/index.tsx` are not mapped to an area in the §6 table. Map them, for example to `learnerLearn`.
- **`style-2-6`** (lines 1369-1375, Goal 1 audit).
  - Step 2 covers only item 46's routes, which omit `(tabs)/profile.tsx`. Write "each route under `apps/learner/src/app`".
  - The audit runs on web only, so native-only strings never appear, for example `course/[slug].tsx:95` "Enrol on the web" and `checkout/[courseId].tsx:95` "Continue on the web". Add a native pass, or name the CUJ 2 walkthrough as the check for them.
  - Step 3, "every visible Latin-script word and accessibility label", can be read two ways. Write "every Latin-script word in visible text or in an accessibility label".

### Consistency with the Technical Plan

- **`style-2-7`** (lines 971-975, against Technical Plan lines 351-352).
  - The Technical Plan says `PATCH /me` is "never from an effect that watches state". The fill-in waits for `ready` and `user`, so it is effectively such an effect.
  - The plan's wording, "No effect watches the stored value", is the precise one. Change the Technical Plan to "never from an effect that watches the stored language".
  - Also reported by implementation-readiness.
- **`style-2-8`** (lines 1001-1011, against Technical Plan lines 505-511). The plan lists 10 ADR 010 contents and the Technical Plan lists 6. Align the two lists.
- **`style-2-9`** (items 37 and 54, against Technical Plan lines 514-515). The Technical Plan says the "Translated pages" rule grows to cover the four emails, but item 37 adds a separate "Learner emails:" rule. Align the Technical Plan with the plan.

### Unbound names and placeholders

- **`style-2-10`** (line 988). `isChosen(stored)` has no `stored` in scope. Write `isChosen(preferences.locale)`.
- **`style-2-11`** (line 1065). `translate(user.locale ?? 'en', …)` leaves `user` unbound. Use the Technical Plan's names: `enrollment.user.locale` and `p.user.locale`.
- **`style-2-12`** (line 858). `<locale|none>` reads as one placeholder. Write "`<locale>`, or `none` when unset".
- **`style-2-13`** (line 965). "A new `chooseLocale`" doesn't say where callers get it. Write "added to the `Session` type and returned by `useSession()`".
- **`style-2-14`** (line 1140). "with `lang` set" doesn't give the value. Write "`lang` set to the chip's own locale".
- **`style-2-15`** (line 1254 against line 1035). Item 49 says "the area lists"; item 30 says `enAreas`/`zhAreas`. Use the same names in both.

### Markdown and formatting

- **`style-2-16`**. These headings run past about 100 columns, and headings cannot wrap: lines 937, 991, 997, 1060, 1105, 1171, 1240, 1276, 1296 and 1321.
  - Shorten each to a short name and list the files in a "Files" bullet.
- **`style-2-17`** (line 1183). The candidate file list sits under "Type / Scope", the same misuse as round-1 `style-1-23`. Move it to its own "Files" bullet.
- **`style-2-18`**. Code spans are broken across lines at lines 751-752, 840-841, 967-969, 1167-1168 and 1224-1226.
  - They render, but they are hard to read, and line 752 starts with `| null;`, which looks like a table row in the source.
  - Use fenced `ts` blocks for the `resolveLocale` signature, the `trackEvent` call, the `$patch` call and the `RootError` translator.
- **`style-2-19`** (line 838). Drizzle keys (`localeChosen`) and a SQL `WHERE` (`locale_chosen`) are mixed in one instruction.
  - Write it in one notation, for example a Drizzle `where` with `or(isNull(users.locale), eq(users.localeChosen, false))`.

---

## Round-1 Blockers and Majors

**Confirmed resolved (by at least two reviewers, none disputing):**

- Blockers:
  - `implementation-readiness-1-1`;
  - `implementation-readiness-1-2`;
  - `codebase-details-1-1`.
- Majors:
  - `implementation-readiness-1-3`, `-1-4`, `-1-5`, `-1-6`, `-1-7`, `-1-8`, `-1-11`, `-1-12`, `-1-14`, `-1-16`;
  - `codebase-details-1-2`, `-1-3`, `-1-4`, `-1-6`;
  - `style-1-1` to `style-1-8`.
- `implementation-readiness-1-15`: the decision is recorded. Its implementation causes the new Blocker `implementation-readiness-2-1`.

**Partly resolved (carried into this round):**

- `codebase-details-1-5`, see `codebase-details-2-1`.
- `implementation-readiness-1-10`, see `codebase-details-2-2`.
- `implementation-readiness-1-9`, see `style-2-1`. The new `implementation-readiness-2-4` comes from the fix.

**Not raised again, as settled:**

- the HTML provenance comment together with "_Drafted with EGM_";
- who writes and reviews the Chinese text (`implementation-readiness-1-13`, escalated to the author);
- the wording of the Verification Plan's "covers" sentence.

## Points confirmed accurate (codebase-details, implementation-readiness)

- **Cited lines.** These are correct:
  - `course/[slug].tsx:86, 104`;
  - `checkout/[courseId].tsx:100, 203`;
  - `CourseCard.tsx:45`;
  - `Trail.tsx:114`;
  - `preferences.test.ts:41-44`;
  - `transactions.service.ts:298` (`'Refunded in Stripe'`).

  `learning.tsx:124` is a literal `'Free'`, not `showFree`, but the rule still applies.
- **API code.**
  - In `auth.service.ts:138-146` the order is `findOrCreateUser`, then `buildAuthUser`, then the Support check.
  - `trackEvent(deps, { userId, name, properties })` matches `audit.service.ts:46-49`.
  - `ANALYTICS_EVENTS.signIn` exists and nothing sends it.
  - `PATCH /me` returns `{ user }` (`me.ts:34`), and `api.me.$patch` is already used (`profile.tsx:28`).
  - The fake payments provider stores `...input` (`fake.ts:142-150`).
  - All three learner-email queries load `user: true`.
  - `apps/api` does not depend on `@elevate/i18n` yet. The API Dockerfile copies the whole repo.
- **Learner app.**
  - `fillSlots` is plain React.
  - `expo-router/testing-library` exports `renderRouter` (58.0.30) and accepts render options.
  - `Chip` has no `testID` or `lang`; `Input` and `Button` pass `testID` through.
  - `TopNav` and `PillTabBar` already use `t()`.
  - The learner `index.html` hard-codes `lang="en"`, with web output `single`.
  - Jest `testMatch` covers `src/lib/__tests__`.
  - Every path in item 46 exists.
- **Repo and docs.**
  - The anchor sentences in ADR 008 and AGENTS.md exist.
  - `prefs.language.description` holds the "translated over time" text.
  - There are no `category.*` keys yet, and `COURSE_CATEGORIES` has ten entries.
  - `db:generate` passes `--name` through.
  - Turbo `typecheck` depends on `^build:types`.
