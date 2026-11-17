# Goldfish Annotated Review Report — Stage 9, round 2

**Status:** resolved. The author chose "auto accept" on 2026-11-16, and all 45 fixes are applied to `docs/designs/learner-chinese.md`. The plan's items were renumbered (now 59), and every heading is a short name with a **Files** bullet.

**Target:** `docs/designs/learner-chinese.md` (DetailedRange, lines 713–1383)

**Source:** the 46 findings of
[implementation_readiness_report_round2.md](implementation_readiness_report_round2.md).

**Wider edits:** where a fix needs a matching Technical Plan edit, the proposed edit names those
lines too.

**Re-audit:** this is the last pass on Stage 9. The re-audit cap is reached, so no reviewer round
will check these fixes.

**Tally:**

| Category    | Count |
| ----------- | ----- |
| PROPOSE FIX | 45    |
| ESCALATE    | 0     |
| CONTEST     | 0     |
| DECLINE     | 1     |

## Prioritized Findings & AI Suggestions

### [Issue 1] [`egm-implementation-readiness`] - Severity: Blocker

-   **Affected Scope:** [Lines 852–921](../../learner-chinese.md#L852-L921) (items 13,
    15, 19)
-   **Discrepancy Description:** the new idempotency key breaks
    `payout-accounts.test.ts:95`, and that file is in no list. Item 15 says `PaymentsService`
    calls the key function.
-   **Rationale:** PR 1 fails `npx turbo run test`.
-   _**AI Suggestion:**_ PROPOSE FIX
-   _**Justification:**_ confirmed. Line 95 asserts `'checkout:enr_1:8000:acc_1'`, and the
    function is called from `stripe.ts:114` and `fake.ts:133`.
-   _**Proposed Edit:**_
    -   **Item 13:** `checkoutIdempotencyKey`'s parameter gains `locale?: Locale`. The key
        appends `:<locale>`, or `:none` when unset.
    -   **Item 15:** drop "and to `checkoutIdempotencyKey`", and add that both providers already
        pass the whole `CheckoutSessionInput`.
    -   **New item in PR 1:** `apps/api/test/payout-accounts.test.ts` (Modify). The expected
        string becomes `'checkout:enr_1:8000:acc_1:none'`, and a new case checks that `locale:
        'zh'` gives a different key.

### [Issue 2] [all three] - Severity: Major

-   **Affected Scope:** [Lines 718–941](../../learner-chinese.md#L718-L941) against
    1315–1319
-   **Discrepancy Description:** between PR 1 and PR 4, the Teach and Support `<select>` has no
    `system` option, so it shows "English" on a Chinese page. On Profile, no chip is selected.
-   **Rationale:** each PR must be releasable on its own.
-   _**AI Suggestion:**_ PROPOSE FIX
-   _**Justification:**_ confirmed (`PreferencesCard.tsx:79-92`). Of the three remedies, moving
    the option is the only one that doesn't add a temporary behaviour that must be removed
    later.
-   _**Proposed Edit:**_ move all of these into PR 1:
    -   item 55 (the `system` option in `PreferenceRows`);
    -   the `chrome` `prefs.language.system` key, in both languages;
    -   the learner Profile "Follow device" chip.

    PR 1's summary then says it adds that one key. PR 4 keeps only the `?lang` hand-off and the
    test note.

### [Issue 3] [`egm-codebase-details`] - Severity: Major

-   **Affected Scope:** [Lines 1224–1226](../../learner-chinese.md#L1224-L1226) and 463–465
-   **Discrepancy Description:** `RootError` still wraps `ThemeProvider`, which needs
    `PreferencesProvider`.
-   **Rationale:** the error screen throws.
-   _**AI Suggestion:**_ PROPOSE FIX
-   _**Justification:**_ confirmed (`RootError.tsx:11`, `ThemeProvider.tsx:12`).
-   _**Proposed Edit:**_
    -   `RootError` wraps its content in its own `<PreferencesProvider>`, which gives both `t`
        and the theme. On native it renders with the defaults until the storage read finishes.
    -   This drops the hand-built translator, and `getDeviceLanguages()` is no longer needed by
        it.
    -   The Technical Plan's `RootError` bullet changes to match.

### [Issue 4] [all three] - Severity: Major

-   **Affected Scope:** [Lines 1160–1211](../../learner-chinese.md#L1160-L1211)
-   **Discrepancy Description:** about 17 `errorMessage(` call sites keep English fallbacks.
    `profile.tsx:32` is unlisted, and an empty `ApiError` message would show blank.
-   **Rationale:** it contradicts Goal 1 and the Technical Plan.
-   _**AI Suggestion:**_ PROPOSE FIX
-   _**Justification:**_ confirmed (`api-error.ts:46-54`).
-   _**Proposed Edit:**_
    -   **Item 44:** `errorMessage` returns `error.message || fallback` for an `ApiError`.
    -   **Item 46:** every `errorMessage(` call in `apps/learner/src` moves to
        `useErrorMessage()`. A screen that keeps an error in state stores the error object, and
        words it at render.
    -   **Item 46's list:** add `(tabs)/profile.tsx`.

### [Issue 5] [`egm-codebase-details`] - Severity: Major

-   **Affected Scope:** [Lines 1266–1294](../../learner-chinese.md#L1266-L1294)
-   **Discrepancy Description:** the jest harness still can't run the session tests:
    -   the `auth.me.$get` and `sign-out` mocks are missing;
    -   no response shape is given;
    -   no provider wrapper is given;
    -   the tests have no paths.
-   **Rationale:** the tests can't pass.
-   _**AI Suggestion:**_ PROPOSE FIX
-   _**Justification:**_ confirmed (`session.tsx:42,69`).
-   _**Proposed Edit:**_
    -   **Item 51:**
        -   the mock adds `api.auth.me.$get` and `api.auth['sign-out'].$post`;
        -   `jsonResponse(body, status = 200)` returns `{ ok: status < 400, status, json: async
            () => body }`;
        -   offline is simulated by rejecting with `new Error('Network request failed')`;
        -   the `expo-localization` mock returns `[{ languageTag: 'en-SG', languageCode: 'en' }]`,
            and `setMockDeviceLanguages(tags)` overrides it.
    -   **Item 52:**
        -   the paths are `apps/learner/src/lib/__tests__/session-locale.test.tsx` and
            `apps/learner/src/app/__tests__/sign-in.test.tsx`;
        -   a shared `apps/learner/src/test-utils/providers.tsx` exports `TestProviders`
            (`PreferencesProvider`, `ThemeProvider`, `QueryClientProvider`, `SessionProvider`);
        -   `renderRouter` takes it as `wrapper`.

### [Issue 6] [all three] - Severity: Major

-   **Affected Scope:** [Lines 977–981, 1134–1141, 1212–1214](../../learner-chinese.md#L1212-L1214)
    and 451–458
-   **Discrepancy Description:** the Profile row has two selection rules, and its English and
    中文 chips have no `testID`s. The Technical Plan puts `LanguageSwitch` on Profile.
-   **Rationale:** the contradiction leaves the Maestro flow nothing to tap.
-   _**AI Suggestion:**_ PROPOSE FIX
-   _**Justification:**_ valid.
-   _**Proposed Edit:**_
    -   **Item 46:** Profile keeps its own chip row and doesn't use `LanguageSwitch`. Its chips
        are `profile-lang-en`, `profile-lang-zh` and `profile-lang-system`, and the selected
        chip is the stored value.
    -   **The Technical Plan's switcher bullet:** `LanguageSwitch` sits in two places, Explore
        and sign-in. Profile has its own three-chip row.
    -   **Item 53:** it uses the `profile-lang-*` IDs.

### [Issue 7] [all three] - Severity: Major

-   **Affected Scope:** [Lines 1296–1303](../../learner-chinese.md#L1296-L1303)
-   **Discrepancy Description:** the new 中文 Maestro step names no file, and it breaks the text
    matches that follow it.
-   **Rationale:** `sign-in.yaml` runs as a subflow.
-   _**AI Suggestion:**_ PROPOSE FIX
-   _**Justification:**_ valid.
-   _**Proposed Edit:**_
    -   **The new step goes in a new flow,** `.maestro/sign-in-zh.yaml`: launch, then
        `lang-zh` on sign-in, then assert the code step's title has no Latin text, then
        `lang-en`.
    -   **`sign-in.yaml` and `learner-preferences.yaml`** change only their selectors to
        `testID`s.
    -   **`request-code.js`** sends `locale: 'zh'` when the flow passes `LOCALE=zh`, and no
        `locale` otherwise.

### [Issue 8] [`egm-codebase-details`] - Severity: Major

-   **Affected Scope:** [Lines 991–995](../../learner-chinese.md#L991-L995)
-   **Discrepancy Description:** item 27 misses the free-course `startCheckout(c.id)` call at
    `course/[slug].tsx:70`.
-   **Rationale:** those enrolments record a null locale.
-   _**AI Suggestion:**_ PROPOSE FIX
-   _**Justification:**_ confirmed.
-   _**Proposed Edit:**_
    -   The signature becomes `startCheckout(courseId, { locale, promoCode })`, with `locale`
        required.
    -   Add `course/[slug].tsx` to item 27.

### [Issue 9] [`egm-codebase-details`] - Severity: Major

-   **Affected Scope:** [Lines 872–880](../../learner-chinese.md#L872-L880)
-   **Discrepancy Description:** Stripe metadata has no rule for a missing locale.
-   **Rationale:** `''` would be stored instead of `null`.
-   _**AI Suggestion:**_ PROPOSE FIX
-   _**Justification:**_ confirmed (`types.ts:38`, `payments.service.ts:217`).
-   _**Proposed Edit:**_
    -   Write `...(locale ? { locale } : {})` into the metadata.
    -   `fulfilCheckout` reads it as `localeSchema.safeParse(m.locale).success ? m.locale :
        null`.

### [Issue 10] [`egm-style`] - Severity: Major

-   **Affected Scope:** [Lines 718–730](../../learner-chinese.md#L718-L730)
-   **Discrepancy Description:** PR 1's summary leaves out its behaviour changes, and the reason
    PR 3 waits for PR 1's deploy is wrong.
-   **Rationale:** a reader misjudges the risk of releasing PR 1.
-   _**AI Suggestion:**_ PROPOSE FIX
-   _**Justification:**_ valid. Zod strips unknown keys.
-   _**Proposed Edit:**_
    -   **PR 1's summary lists its behaviour changes:**
        -   the request fields;
        -   the `PATCH /me` writes and the fill-in;
        -   learner web guessing from the browser;
        -   Teach and Support resolving `system`;
        -   the "Follow device" option (Issue 2).
    -   **The dependency sentence becomes:** "PR 1's API deploys before or with its web builds.
        No native store build ships before PR 3, because native has no device languages until
        then. PR 3's native build needs PR 1's API in production."

### Nits

| #   | ID                                     | Suggestion  | Proposed edit                                                                                                                                                                                                 |
| --- | -------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 11  | codebase-details-2-5                   | PROPOSE FIX | Covered by Issue 10's sentence: no native store build before PR 3.                                                                                                                                            |
| 12  | codebase-details-2-6                   | PROPOSE FIX | Service: `startCheckout(user, courseId, { promoCode, locale })`. Test helper: `t.signIn(email, audience = 'learner', opts?: { locale?, localeChosen? })`.                                                     |
| 13  | codebase-details-2-7                   | PROPOSE FIX | Item 19 names three cases: free (`payments.service.ts:152`), webhook and sync (the shared `fulfilCheckout`).                                                                                                  |
| 14  | codebase-details-2-8                   | PROPOSE FIX | Item 42 adds an `isCourseCategory(slug): slug is CourseCategory` guard, so the key type checks without a cast.                                                                                                |
| 15  | codebase-details-2-9                   | PROPOSE FIX | Item 45 adds `react` and `@types/react` as dev dependencies, plus `peerDependenciesMeta.react.optional: true`.                                                                                                |
| 16  | codebase-details-2-10                  | PROPOSE FIX | Item 8 inlines `pgEnum('locale', ['en', 'zh'] as const satisfies typeof supportedLocales)`, using a type-only import. This keeps the schema's runtime imports type-only, and a mismatch fails typecheck.      |
| 17  | codebase-details-2-11                  | PROPOSE FIX | Item 54 also updates the `en.ts:9-11` header comment and ADR 008 lines 84–85 (`fillSlots`'s new home).                                                                                                        |
| 18  | codebase-details-2-12                  | PROPOSE FIX | Sign-in error state becomes `{ kind: 'invalidEmail' } \| { kind: 'api'; error: unknown } \| null`.                                                                                                            |
| 19  | codebase-details-2-13                  | PROPOSE FIX | Item 29's list of English-matching tests adds `money-loop.test.ts:295` and `payout-accounts.test.ts:268,279`.                                                                                                 |
| 20  | implementation-readiness-2-5           | PROPOSE FIX | Items 22 and 50: a stored value other than `en` or `zh` is treated as `system`.                                                                                                                               |
| 21  | implementation-readiness-2-6           | PROPOSE FIX | Item 55: the `onChange` cast widens to `LocalePreference`.                                                                                                                                                    |
| 22  | implementation-readiness-2-7           | PROPOSE FIX | Item 35: in `zh`, assert `simpleEmail`'s footer and `lang`. The `<script>` case applies only to `simpleEmail`.                                                                                                |
| 23  | implementation-readiness-2-8           | PROPOSE FIX | Item 38: "add the plugin's locale-change setting if the SDK 58 page says Android needs it". The heading says `app.json` changes only if `expo install` writes to it.                                          |
| 24  | implementation-readiness-2-9           | PROPOSE FIX | Covered by Issue 5.                                                                                                                                                                                           |
| 25  | implementation-readiness-2-10          | PROPOSE FIX | `email.refund.reasonStripe` replaces the `{reason}` value. Rewrite the sentence without the ambiguous "it"s.                                                                                                  |
| 26  | style-2-3                              | PROPOSE FIX | `prefs.language.description`: "Applies to every screen of the learner app, and to the translated pages of Teach and Support." / "适用于学员应用的所有页面，以及 Teach 和 Support 中已翻译的页面。"            |
| 27  | style-2-4                              | PROPOSE FIX | Item 40: the comment is in `Chip.tsx`. The spread is `{...(Platform.OS === 'web' ? ({ lang } as object) : {})}`.                                                                                              |
| 28  | style-2-5                              | PROPOSE FIX | Item 46 states the base `apps/learner/src/`. The §6 table maps `media/*`, `QuizRunner` and `learn/[enrollmentId]/index.tsx` to `learnerLearn`.                                                                |
| 29  | style-2-6                              | PROPOSE FIX | The audit covers each route under `apps/learner/src/app`. Native-only strings are checked in CUJ 2's walkthrough. The wording becomes "every Latin-script word in visible text or in an accessibility label". |
| 30  | style-2-7                              | PROPOSE FIX | The Technical Plan reads "never from an effect that watches the stored language".                                                                                                                             |
| 31  | style-2-8                              | PROPOSE FIX | The Technical Plan's ADR 010 list matches item 28's ten entries.                                                                                                                                              |
| 32  | style-2-9                              | PROPOSE FIX | The Technical Plan says AGENTS.md gains a "Learner emails" rule (item 37) and extends "Translated pages" to the learner app (item 54).                                                                        |
| 33  | style-2-10                             | PROPOSE FIX | `isChosen(preferences.locale)`.                                                                                                                                                                               |
| 34  | style-2-11                             | PROPOSE FIX | `enrollment.user.locale` and `p.user.locale`.                                                                                                                                                                 |
| 35  | style-2-12                             | PROPOSE FIX | "`<locale>`, or `none` when unset".                                                                                                                                                                           |
| 36  | style-2-13                             | PROPOSE FIX | "`chooseLocale`, added to the `Session` type and returned by `useSession()`".                                                                                                                                 |
| 37  | style-2-14                             | PROPOSE FIX | "`lang` set to the chip's own locale".                                                                                                                                                                        |
| 38  | style-2-15                             | PROPOSE FIX | Item 49 says `enAreas`/`zhAreas`.                                                                                                                                                                             |
| 39  | style-2-16                             | PROPOSE FIX | Shorten the long `#####` headings to short names, and list the files in a **Files** bullet.                                                                                                                   |
| 40  | style-2-17                             | PROPOSE FIX | Item 46's candidate list moves to a **Files** bullet.                                                                                                                                                         |
| 41  | style-2-18                             | PROPOSE FIX | Fenced `ts` blocks for the `resolveLocale` signature, the `trackEvent` call, the `$patch` call and the `RootError` wrapper.                                                                                   |
| 42  | style-2-19                             | PROPOSE FIX | Item 11 uses one notation: the Drizzle `where: or(isNull(users.locale), eq(users.localeChosen, false))`.                                                                                                      |
| 43  | implementation-readiness Nit (item 15) | PROPOSE FIX | Covered by Issue 9.                                                                                                                                                                                           |
| 44  | style Nit 8                            | PROPOSE FIX | Covered by Nit 13.                                                                                                                                                                                            |
| 45  | style Nit 4                            | PROPOSE FIX | Covered by Issue 4.                                                                                                                                                                                           |
| 46  | style Nit 16                           | DECLINE     | A duplicate of Issue 7.                                                                                                                                                                                       |
