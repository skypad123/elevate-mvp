# Goldfish Annotated Review Report

Status: resolved (auto accept, 2026-11-16). 58 fixes applied; Issue 19 (who writes and reviews the Chinese text) is still escalated to the author; Issue 61 contested; Issues 60 and 62 declined.

**Target:** `docs/designs/learner-chinese.md` (DetailedRange, lines 625–1116)

**Source:** the 62 findings of
[implementation_readiness_report.md](implementation_readiness_report.md) (Stage 9).

**Wider edits:** where a fix can't be made inside DetailedRange, the proposed edit names the
FeatureRange lines it also changes. Stage 8's Blocker Z1
([intermediate_zoom_out_report.md](intermediate_zoom_out_report.md)) is the root cause of
several Stage 9 Majors, so Fix Set A addresses Z1 and those Majors together.

**Tally:**

| Category    | Count |
| ----------- | ----- |
| PROPOSE FIX | 58    |
| ESCALATE    | 1     |
| CONTEST     | 1     |
| DECLINE     | 2     |

## Fix sets (shared rewrites)

Several findings need the same rewrite, so it is written once here. The per-finding entries
below point to these sets.

### Fix Set A: one language-sync model (Z1; Stage 9 1-4, 1-5, style-1-5, style-1-6; Stage 5 Majors 1, 2, 9; Stage 6 Majors 1, 2; Stage 7 design-1-3 to 1-6)

The flag that says whether a language was chosen moves from the sign-in link to the account.
The language is then carried by the requests that come from the device showing it.

1.  **The resolver.**
    `resolveLocale({ stored, account, param, deviceLanguages }): Locale` checks, in order:
    1.  a stored `en` or `zh`;
    2.  `account`, the user's `locale` when `localeChosen` is true;
    3.  a valid `param`;
    4.  `zh` if the first device language's primary subtag is `zh`;
    5.  `en`.

    This is the brief's order: choice, then account, then `?lang`, then device, then English.
    Nothing ever copies the account's value into device storage, so "Follow device" keeps its
    meaning and no guess is stored as a choice.
2.  **Columns.**
    -   `users.locale` (nullable `locale` enum) and `users.locale_chosen boolean not null default
        false`.
    -   `magic_links` gets no new columns.
3.  **The sign-in request** (`requestMagicLink`).
    -   `locale` is optional. The code email is in `locale ?? 'en'`.
    -   The emailed link gains `&lang=<locale>` only when `locale` was sent. That fixes Blocker
        codebase-details-1-1.
    -   `localeChosen` is dropped from this request.
4.  **The verify request.** `verifyRequestSchema` (both branches) gains optional `locale` and
    `localeChosen`, from the device doing the verifying. Before `buildAuthUser`:
    -   if `localeChosen` is true, set `users.locale = locale` and `locale_chosen = true`;
    -   if it is false, set them only `WHERE locale IS NULL OR locale_chosen = false`.
5.  **`PATCH /me { locale?, localeChosen? }`** is sent only from a press, never from an
    effect:
    -   pressing `English` or `中文` sends `{ locale, localeChosen: true }`;
    -   pressing "Follow device" sends `{ localeChosen: false }`, which leaves the stored
        language for emails.

    A failure is ignored. Offline, the press still changes the device and nothing is retried.
6.  **One fill for existing sessions.** After `refreshUser`, once preferences are `ready`, and
    only when `user.locale` is null, the app sends `{ locale: <resolved>, localeChosen: false }`
    once. This fills accounts signed in before release. It never overwrites a set value, so
    devices can't flip it.
7.  **`AuthUser`** gains `locale: Locale | null` and `localeChosen: boolean`.
8.  **Checkout uses the language on screen** (Z4).
    -   The checkout start request gains `locale` (the resolved UI language).
    -   `PaymentsService` passes it to Stripe and writes it into the session `metadata`.
    -   It appends `&lang=<locale>` to both return URLs, which already have a query string.
    -   The `checkout_started` event records it.
    -   Both `checkout_completed` paths (the webhook and `sync`) read `metadata.locale`. The free
        path, which has no Stripe session, uses the request's `locale`.
9.  **The `sign_in` event** records the verify request's `locale ?? null`. It's sent after the
    Support `forbidden` check, so a refused Support sign-in isn't counted.

**Edits:**

-   FeatureRange: Decisions 2–4 (lines 225–237), the data-flow diagram (240–265), §1 (267–283),
    §3 (298–318), §5 (347–356), §8 (419–423), CUJs 2 and 3 (176–196) and Alternative F
    (508–519). Alternative F keeps its rejection; only its mechanism text changes.
-   DetailedRange: items 2, 4, 11, 13, 14, 18, 19, 20, 30 and 31.

### Fix Set B: PRs that typecheck on their own (Blockers 1-1, 1-2; style-1-1; style-1-14)

Four PRs replace the five:

1.  **PR 1: language plumbing, with no new text.**
    -   Core: the contracts and the resolver.
    -   The database migration.
    -   API: auth, `/me`, checkout and Stripe `locale`.
    -   The minimum wiring that keeps everything typechecking: `buildAuthUser` returns
        `locale`/`localeChosen`, and both providers and all three init scripts resolve `system`.
    -   ADR 010.
2.  **PR 2: emails.**
    -   The `email` area and the `locale` parameters on `layout`, `magicLinkEmail` and
        `simpleEmail`.
    -   The four learner emails.
    -   ADR 008's email pointer and the AGENTS.md email line.
3.  **PR 3: the learner app.**
    -   `expo-localization` and the switcher.
    -   Every learner screen.
    -   The `prefs.language.system` key, ADR 008's "Translated today" and the AGENTS.md learner
        rule.
4.  **PR 4: Teach and Support.** The picker's "Follow device" and the `?lang` hand-off.

PR 3 ships only after PR 1's API is deployed. It doesn't depend on PR 2.

**Edits:** lines 627–637 and every "#### PR n" header. The items move to their new PR, and the
numbering stays 1–n in order.

## Prioritized Findings & AI Suggestions

### [Issue 1] [`egm-implementation-readiness`] - Severity: Blocker

-   **Affected Scope:** [Lines 627–678](../../learner-chinese.md#L627-L678) (PR 1, items
    1 and 4)
-   **Discrepancy Description:** PR 1 changes `Preferences['locale']` to `LocalePreference`, and
    four consumers still pass it where a `Locale` is required. `AuthUser.locale` is required
    before `buildAuthUser` returns it.
-   **Rationale:** the plan's rule that each PR typechecks on its own is broken.
-   _**AI Suggestion:**_ PROPOSE FIX
-   _**Justification:**_ confirmed against `PreferencesProvider.tsx:45,81`, web-ui `format.ts:8`
    and learner `preferences.tsx:63`.
-   _**Proposed Edit:**_ Fix Set B, PR 1.

### [Issue 2] [`egm-implementation-readiness`] - Severity: Blocker

-   **Affected Scope:** [Lines 759–762](../../learner-chinese.md#L759-L762) against
    848–853
-   **Discrepancy Description:** PR 2 passes `locale` to `magicLinkEmail` before PR 3 adds the
    parameter.
-   **Rationale:** the excess-property check fails.
-   _**AI Suggestion:**_ PROPOSE FIX
-   _**Justification:**_ valid.
-   _**Proposed Edit:**_ Fix Set B. The sign-in email's language, the email `lang` rule and its
    test move into the new PR 2 (emails), next to the template change.

### [Issue 3] [`egm-codebase-details`] - Severity: Blocker

-   **Affected Scope:** [Lines 759–762](../../learner-chinese.md#L759-L762) and 1069–1079
-   **Discrepancy Description:** every sign-in link gets `lang`, so Teach and Support links
    carry `lang=en`, which item 48 then stores as a choice.
-   **Rationale:** it contradicts line 343.
-   _**AI Suggestion:**_ PROPOSE FIX
-   _**Justification:**_ confirmed. I wrote "add `lang=<it>`", where "it" is the language after
    the fallback.
-   _**Proposed Edit:**_ item 13 becomes "add `&lang=<input.locale>` only when the request sent
    `locale`". Add an `auth.test.ts` case: a Teach sign-in link has no `lang` parameter.

### [Issue 4] [all three] - Severity: Major

-   **Affected Scope:** [Lines 666–669](../../learner-chinese.md#L666-L669) (item 3)
-   **Discrepancy Description:** the wrong barrel file.
-   **Rationale:** `src/index.ts` re-exports `./domain`.
-   _**AI Suggestion:**_ PROPOSE FIX
-   _**Justification:**_ confirmed, `packages/core/src/index.ts:2`.
-   _**Proposed Edit:**_ item 3 becomes "`packages/core/src/domain/index.ts` (Modify): add
    `export * from './locale'`". `localePreferenceSchema` is already exported through
    `contracts/index.ts`.

### [Issue 5] [all three] - Severity: Major

-   **Affected Scope:** [Lines 911–923](../../learner-chinese.md#L911-L923) (item 31)
-   **Discrepancy Description:** the PATCH effect fires on any mismatch, including at launch and
    offline.
-   **Rationale:** the account flips between devices, which is Alternative B's failure.
-   _**AI Suggestion:**_ PROPOSE FIX
-   _**Justification:**_ confirmed. `refreshUser` runs on every mount.
-   _**Proposed Edit:**_ Fix Set A, points 5 and 6.

### [Issue 6] [`egm-implementation-readiness`, `egm-codebase-details`] - Severity: Major

-   **Affected Scope:** [Lines 899–917](../../learner-chinese.md#L899-L917)
-   **Discrepancy Description:** adopting the account's value on every `refreshUser` breaks
    "Follow device", and it races the storage read.
-   **Rationale:** a guess is stored as a choice.
-   _**AI Suggestion:**_ PROPOSE FIX
-   _**Justification:**_ valid. Fix Set A drops adoption altogether: the account is a resolver
    input. The one fill-in waits for `ready`.
-   _**Proposed Edit:**_ Fix Set A, points 1 and 6.

### [Issue 7] [all three] - Severity: Major

-   **Affected Scope:** [Lines 899–941](../../learner-chinese.md#L899-L941)
-   **Discrepancy Description:** `setParamLocale` is undefined, and the native deep-link path
    doesn't exist.
-   **Rationale:** `app.json` has only `scheme`.
-   _**AI Suggestion:**_ PROPOSE FIX
-   _**Justification:**_ valid.
-   _**Proposed Edit:**_
    -   Drop `setParamLocale` and the native `?lang` path.
    -   Web reads `lang` from `window.location` once, at first mount. It's held in memory for
        the tab's life and never stored, so it survives in-app redirects such as success to
        sign-in.
    -   Native has no `param` input.
    -   §1 line 281 changes to match: any landing URL, not three named pages.

### [Issue 8] [`egm-codebase-details`] - Severity: Major

-   **Affected Scope:** [Lines 933–958](../../learner-chinese.md#L933-L958)
-   **Discrepancy Description:** the native hand-offs to the web course page drop the language.
-   **Rationale:** the system browser has its own storage.
-   _**AI Suggestion:**_ PROPOSE FIX
-   _**Justification:**_ confirmed at `course/[slug].tsx:86` and `checkout/[courseId].tsx:100`.
-   _**Proposed Edit:**_ a new bullet in item 35: both hand-off URLs append `?lang=<resolved
    locale>`. Add CUJ 2's step "tap Enrol on the web → the browser page is Chinese".

### [Issue 9] [`egm-implementation-readiness`, `egm-codebase-details`] - Severity: Major

-   **Affected Scope:** [Lines 969, 989–992](../../learner-chinese.md#L969-L992)
-   **Discrepancy Description:** ``t(`category.${slug}`)`` doesn't compile with `string`
    slugs.
-   **Rationale:** the contracts type the category as `string`.
-   _**AI Suggestion:**_ PROPOSE FIX
-   _**Justification:**_ valid.
-   _**Proposed Edit:**_
    -   Add `categoryKey(slug: string): MessageKey | null` in a new
        `apps/learner/src/lib/categories.ts`. It returns `` `category.${slug}` `` only for slugs
        in `COURSE_CATEGORIES`.
    -   Call sites show `categoryLabel(slug)` (the English label, or the raw slug) when it
        returns null.
    -   The contracts stay as they are.

### [Issue 10] [`egm-codebase-details`] - Severity: Major

-   **Affected Scope:** [Lines 994–1000](../../learner-chinese.md#L994-L1000) and 380
-   **Discrepancy Description:** `formatSgd` returns `'Free'`.
-   **Rationale:** English on the purchase screens.
-   _**AI Suggestion:**_ PROPOSE FIX
-   _**Justification:**_ confirmed at `money.ts:117`.
-   _**Proposed Edit:**_
    -   The three learner call sites (`course/[slug].tsx:104`, `checkout/[courseId].tsx:203`,
        `CourseCard.tsx:45`) and `learning.tsx:124` render `t('learnerCommon.price.free')` when
        the price is 0, and otherwise `formatSgd(cents)` without `showFree`.
    -   `formatSgd` itself doesn't change.
    -   The money bullet in the Problem (line 48) says money needs only the "Free" label.

### [Issue 11] [`egm-codebase-details`] - Severity: Major

-   **Affected Scope:** [Lines 994–1000](../../learner-chinese.md#L994-L1000)
-   **Discrepancy Description:** `Trail` joins its list with `', '`.
-   **Rationale:** ADR 008's rule on lists.
-   _**AI Suggestion:**_ PROPOSE FIX
-   _**Justification:**_ confirmed at `Trail.tsx:114`.
-   _**Proposed Edit:**_
    -   Item 38 adds `formatList(items, t)`, which joins with `t('learnerCommon.list.separator')`
        (`", "` in English, `"、"` in Chinese).
    -   `Trail`'s "after {list}" becomes one message, `learnerLearn.trail.after`, with a `{list}`
        placeholder.

### [Issue 12] [`egm-codebase-details`] - Severity: Major

-   **Affected Scope:** [Lines 961–965](../../learner-chinese.md#L961-L965)
-   **Discrepancy Description:** `RootError` renders outside `PreferencesProvider`.
-   **Rationale:** `t()` would throw there.
-   _**AI Suggestion:**_ PROPOSE FIX
-   _**Justification:**_ confirmed. It's exported as the router's `ErrorBoundary` (`_layout.tsx:37`).
-   _**Proposed Edit:**_
    -   `RootError` builds its own translator:
        `createTranslator(resolveLocale({ stored: preferencesStorage.readSync()?.locale ??
        'system', account: null, deviceLanguages: getDeviceLanguages() }))`. Item 29 exports the
        plain function `getDeviceLanguages()` beside the hook.
    -   Its strings go in `learnerCommon`.
    -   Area map: `EmptyState`, `RootError`, `+not-found` → `learnerCommon`; `Trail` →
        `learnerLearn`; `CertificateCard` → `learnerCertificate`.

### [Issue 13] [`egm-implementation-readiness`, `egm-codebase-details`] - Severity: Major

-   **Affected Scope:** [Lines 943–951](../../learner-chinese.md#L943-L951)
-   **Discrepancy Description:** `Chip` has no `lang` or `testID` prop.
-   **Rationale:** strict React Native types.
-   _**AI Suggestion:**_ PROPOSE FIX
-   _**Justification:**_ confirmed at `Chip.tsx:5-14`.
-   _**Proposed Edit:**_
    -   Add `apps/learner/src/ui/Chip.tsx` (Modify): `testID?: string` on the `Pressable`, and
        `lang?: string`, passed to `Text` on web only, through a typed spread with a one-line
        comment, because React Native Web renders `lang`.
    -   `LanguageSwitch` renders `role="radio"` chips inside a labelled `radiogroup`, as
        `profile.tsx` does.

### [Issue 14] [all three] - Severity: Major

-   **Affected Scope:** [Lines 966–967, 1043–1048](../../learner-chinese.md#L1043-L1048)
-   **Discrepancy Description:** the Maestro flows have no `testID`s to tap.
-   **Rationale:** only `app-root-*` exists.
-   _**AI Suggestion:**_ PROPOSE FIX
-   _**Justification:**_ valid.
-   _**Proposed Edit:**_
    -   Item 44 names the IDs:
        -   in `TopNav` and `PillTabBar`: `nav-sign-in`, `nav-profile`;
        -   in `sign-in.tsx`: `sign-in-email`, `sign-in-request`;
        -   in `LanguageSwitch` and the Profile rows: `lang-en`, `lang-zh`, `lang-system`, and
            `theme-system`, `theme-light`, `theme-dark`.
    -   `TopNav.tsx` and `PillTabBar.tsx` move from "stay as they are" to Modify, for the IDs
        only.
    -   The "Restore defaults" step taps `lang-system`.
    -   `.maestro/scripts/request-code.js` sends `locale`.

### [Issue 15] [all three] - Severity: Major

-   **Affected Scope:** [Lines 1025–1041](../../learner-chinese.md#L1025-L1041)
-   **Discrepancy Description:** the jest tests have no harness.
-   **Rationale:** they need API, token-storage and router mocks.
-   _**AI Suggestion:**_ PROPOSE FIX
-   _**Justification:**_ valid.
-   _**Proposed Edit:**_
    -   **Item 42:**
        -   the `expo-localization` mock's default is `['en-SG']`, so existing tests stay
            English;
        -   it adds `jest.mock('@/lib/api')`, with `api.me.$patch` and `api.auth.*` as
            `jest.fn`;
        -   it adds `jest.mock('@/lib/token-storage')`.
    -   **Item 43 splits into three files:**
        -   `preferences.test.tsx`: the resolver wiring and stored values;
        -   `session-locale.test.tsx`: the press-only PATCH, the one fill when null, and no PATCH
            offline;
        -   `sign-in.test.tsx`: uses `renderRouter` from `expo-router/testing-library` and checks
            that the typed email survives a switch.
    -   This drops the `locale.test.tsx` name, which clashed with the core test.

### [Issue 16] [`egm-codebase-details`] - Severity: Major

-   **Affected Scope:** [Lines 857–882](../../learner-chinese.md#L857-L882)
-   **Discrepancy Description:** refunds made in the Stripe dashboard put the English text
    `'Refunded in Stripe'` into the email.
-   **Rationale:** that text is system-written, not typed by a person.
-   _**AI Suggestion:**_ PROPOSE FIX
-   _**Justification:**_ confirmed at `transactions.service.ts:298,316`.
-   _**Proposed Edit:**_
    -   Item 25: export `STRIPE_REFUND_REASON` in `transactions.service.ts`.
    -   When the reason equals it, the learner email uses `email.refund.reasonStripe`. The stored
        value is unchanged.
    -   Add a test.

### [Issue 17] [all three] - Severity: Major

-   **Affected Scope:** [Line 957, lines 1058–1067](../../learner-chinese.md#L1058-L1067)
-   **Discrepancy Description:** the "Follow device" key is unnamed on Profile and in the wrong
    area for the portals.
-   **Rationale:** the existing preference labels are `prefs.*` keys in `chrome`.
-   _**AI Suggestion:**_ PROPOSE FIX
-   _**Justification:**_ confirmed (`chrome.en.ts:25-35`).
-   _**Proposed Edit:**_
    -   One key, `prefs.language.system` in `chrome.en.ts`/`chrome.zh.ts`, added in the learner
        PR. Profile and `PreferenceRows` both use it.
    -   Item 47 is replaced by the chrome edit.
    -   The Profile change gets its own item.
    -   `prefs.language.description` is reworded (Nit codebase-details-1-14).

### [Issue 18] [`egm-implementation-readiness`] - Severity: Major

-   **Affected Scope:** [Lines 1052–1056](../../learner-chinese.md#L1052-L1056)
-   **Discrepancy Description:** web-ui's `format.ts` isn't listed, and the context shape isn't
    stated.
-   **Rationale:** `useIntlLocale` reads `preferences.locale`.
-   _**AI Suggestion:**_ PROPOSE FIX
-   _**Justification:**_ valid.
-   _**Proposed Edit:**_ item 45 says that `PreferencesContextValue` gains `locale: Locale`, and
    that `applyToDocument`, `t` and `format.ts` read it. Add
    `packages/web-ui/src/preferences/format.ts` (Modify). This moves to PR 1 under Fix Set B.

### [Issue 19] [`egm-implementation-readiness`, `egm-style`] - Severity: Major

-   **Affected Scope:** [Lines 825–835, 986–987](../../learner-chinese.md#L986-L987)
-   **Discrepancy Description:** nobody is named to write or review the Chinese text.
-   **Rationale:** the parity test blocks merging without Chinese strings.
-   _**AI Suggestion:**_ ESCALATE
-   _**Justification:**_ who writes and checks the Chinese is a staffing fact that no file
    records. Only you know it.
-   _**Proposed Edit:**_ none until you answer. Once named, items 21 and 36 would say who
    supplies the `.zh.ts` strings, and that a fluent Simplified Chinese reviewer named in the PR
    approves every `.zh.ts` change, including the email area.

### [Issue 20] [`egm-implementation-readiness`, `egm-style`] - Severity: Major

-   **Affected Scope:** [Lines 1107–1108](../../learner-chinese.md#L1107-L1108)
-   **Discrepancy Description:** the Goal 1 "text diff" has no procedure.
-   **Rationale:** no tool, and no baseline to compare with.
-   _**AI Suggestion:**_ PROPOSE FIX
-   _**Justification:**_ valid.
-   _**Proposed Edit:**_ replace it with a manual audit in four steps:
    1.  set the language to 中文 on learner web;
    2.  open each route in item 35's list, plus the signed-out and empty states;
    3.  list every visible Latin-script word and `aria-label`, using the browser's accessibility
        tree;
    4.  check each against Goal 1's four exceptions, and record the result in the PR.

### [Issue 21] [`egm-implementation-readiness`] - Severity: Major

-   **Affected Scope:** [Lines 776–799](../../learner-chinese.md#L776-L799)
-   **Discrepancy Description:** the Stripe idempotency key ignores `locale` and the return URLs.
-   **Rationale:** a reused key with different parameters is rejected.
-   _**AI Suggestion:**_ PROPOSE FIX
-   _**Justification:**_ confirmed. The key is `checkout:enrollment:amount:payoutAccount`
    (`types.ts:46-52`).
-   _**Proposed Edit:**_ item 15 adds `locale` to `checkoutIdempotencyKey`'s input and string,
    so a retry after a switch makes a new session. Test: the same enrollment with two locales
    gives two keys.

### [Issue 22] [`egm-implementation-readiness`, `egm-codebase-details`] - Severity: Major

-   **Affected Scope:** [Lines 931, 956](../../learner-chinese.md#L931-L956)
-   **Discrepancy Description:** where the switcher goes is left open. The hero hides during a
    search, and a stored error stays in the old language.
-   **Rationale:** Goal 3 needs the switcher on both the email and code steps.
-   _**AI Suggestion:**_ PROPOSE FIX
-   _**Justification:**_ valid.
-   _**Proposed Edit:**_
    -   **Sign-in:** the switcher sits directly under `Logo`, outside both cards, so it shows on
        both steps.
    -   **Explore:** it goes in a row above the search field, so it stays visible while
        searching, and not inside the hero.
    -   **Errors:** `sign-in.tsx` stores the error object (`setError(e)`) and words it at render
        with `useErrorMessage()`, so a switch rewords it.

### [Issue 23] [`egm-style`] - Severity: Major

-   **Affected Scope:** [Lines 714–728](../../learner-chinese.md#L714-L728)
-   **Discrepancy Description:** the PR 1 records describe work that lands in later PRs.
-   **Rationale:** the docs would be wrong between PRs.
-   _**AI Suggestion:**_ PROPOSE FIX
-   _**Justification:**_ valid.
-   _**Proposed Edit:**_ Fix Set B: PR 1 adds only ADR 010 and the "Amended by" pointers. The
    email edits go in PR 2 and the learner edits in PR 3.

### [Issue 24] [`egm-style`] - Severity: Major

-   **Affected Scope:** [Lines 722–728](../../learner-chinese.md#L722-L728)
-   **Discrepancy Description:** the planned AGENTS.md line contradicts the email table.
-   **Rationale:** agents follow AGENTS.md as a rule.
-   _**AI Suggestion:**_ PROPOSE FIX
-   _**Justification:**_ valid.
-   _**Proposed Edit:**_ the AGENTS.md text becomes: "Learner emails: the receipt, certificate
    and refund emails use `users.locale ?? 'en'`; the sign-in code email uses the request's
    `locale`. See ADR 010. A new string on a learner screen or in a learner email is a key in a
    `learner*` or `email` area."

### [Issue 25] [`egm-style`] - Severity: Major

-   **Affected Scope:** [Lines 718–719](../../learner-chinese.md#L718-L719)
-   **Discrepancy Description:** the ADR 008 marker sits on a sentence that is only partly
    amended.
-   **Rationale:** API errors stay English.
-   _**AI Suggestion:**_ PROPOSE FIX
-   _**Justification:**_ valid.
-   _**Proposed Edit:**_ "Learner emails: amended by ADR 010. API error messages still stay
    English."

### [Issue 26] [`egm-style`, `egm-codebase-details`] - Severity: Major

-   **Affected Scope:** [Lines 773–774](../../learner-chinese.md#L773-L774)
-   **Discrepancy Description:** the `PATCH /me` response is described wrongly.
-   **Rationale:** it returns `{ user }`.
-   _**AI Suggestion:**_ PROPOSE FIX
-   _**Justification:**_ confirmed (`me.ts:34`).
-   _**Proposed Edit:**_ "It still returns `{ user }` (the rebuilt `AuthUser`, now with `locale`
    and `localeChosen`) with status 200. The session replaces its cached user with it."

### [Issue 27] [all three] - Severity: Major

-   **Affected Scope:** [Lines 763–768](../../learner-chinese.md#L763-L768)
-   **Discrepancy Description:** `verify` leaves the event and the update underspecified.
-   **Rationale:** the value is unbound, and the update's position matters.
-   _**AI Suggestion:**_ PROPOSE FIX
-   _**Justification:**_ valid.
-   _**Proposed Edit:**_
    -   Fix Set A, points 4 and 9.
    -   The update sits between `findOrCreateUser` and `buildAuthUser`.
    -   The call is `trackEvent(this.deps, { userId: user.id, name: ANALYTICS_EVENTS.signIn,
        properties: { audience: link.audience, locale: input.locale ?? null } })`, after the
        Support check.

### [Issue 28] [all three] - Severity: Major

-   **Affected Scope:** [Lines 795–821](../../learner-chinese.md#L795-L821)
-   **Discrepancy Description:** the return-URL `lang` rule is muddled, misses null-locale
    users, and doesn't name the `checkout_completed` paths.
-   **Rationale:** both URLs already have a query string.
-   _**AI Suggestion:**_ PROPOSE FIX
-   _**Justification:**_ valid.
-   _**Proposed Edit:**_ Fix Set A, point 8: the checkout request carries `locale`, so `&lang`
    is always present. Item 20 asserts the URLs, `metadata.locale`, and `checkout_completed` on
    both the webhook and `sync` paths.

### [Issue 29] [all three] - Severity: Major

-   **Affected Scope:** [Lines 1039–1041, 1105](../../learner-chinese.md#L1105)
-   **Discrepancy Description:** the walkthrough misses CUJ 7, Support and Android.
-   **Rationale:** item 49 relies on them.
-   _**AI Suggestion:**_ PROPOSE FIX
-   _**Justification:**_ valid.
-   _**Proposed Edit:**_ "CUJs 1–5 on learner web (a `zh-CN` browser profile), the iOS simulator
    and an Android emulator; CUJs 6–7 in Teach and in Support."

### [Issue 30] [`egm-style`] - Severity: Major

-   **Affected Scope:** [Lines 1005–1007](../../learner-chinese.md#L1005-L1007)
-   **Discrepancy Description:** the `useErrorMessage()` return shape is wrong.
-   **Rationale:** web-ui's returns a callback.
-   _**AI Suggestion:**_ PROPOSE FIX
-   _**Justification:**_ confirmed (`errors.ts`).
-   _**Proposed Edit:**_ "returning `(error: unknown) => errorMessage(error,
    t('learnerCommon.error.generic'), t('learnerCommon.error.unreachable'))`, memoised on `t`".

### Nits

| #   | ID                            | Lines        | Suggestion  | Proposed edit                                                                                                                                                                     |
| --- | ----------------------------- | ------------ | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 31  | codebase-details-1-7          | 753          | PROPOSE FIX | Drop "so `migration-guard.test.ts` passes".                                                                                                                                       |
| 32  | codebase-details-1-8          | 786–789      | PROPOSE FIX | Item 17 becomes "no code change: `FakePaymentsProvider` stores `...input`, so it records `locale` once the type has it".                                                          |
| 33  | codebase-details-1-9          | 340, 862     | PROPOSE FIX | Rename to `issueForEnrollment`. Drop "add `locale: true`", because the queries already load `user: true`.                                                                         |
| 34  | codebase-details-1-10         | 802–813      | PROPOSE FIX | Item 19: extend the `t.signIn` helper (`test/helpers/test-app.ts`) with optional `locale` and `localeChosen`, and add the file to the list.                                       |
| 35  | codebase-details-1-11         | 1009–1014    | PROPOSE FIX | Delete item 40. Move web-ui's `fillSlots` (plain React) into `@elevate/i18n/react` as a sub-export with a `react` peer dependency, and import it in both places.                  |
| 36  | codebase-details-1-12         | 1002–1007    | PROPOSE FIX | `ApiError.fromResponse` stores an empty message when the body has none, so `useErrorMessage` falls back to the translated generic sentence.                                       |
| 37  | codebase-details-1-13         | 680–698      | PROPOSE FIX | Name the `'klingon'` → `'system'` change at `preferences.test.ts:41-44`, and add `isChosen` cases.                                                                                |
| 38  | codebase-details-1-14         | —            | PROPOSE FIX | Reword `prefs.language.description` in the learner PR (Issue 17).                                                                                                                 |
| 39  | codebase-details-1-15         | 886–896, 291 | PROPOSE FIX | Add `apps/learner/app.json` (Modify only if `npx expo install` writes a plugin entry: keep what it writes). Use `languageTag` in §2 too.                                          |
| 40  | codebase-details-1-16         | 963          | PROPOSE FIX | Remove `ui/Logo.tsx` from the list.                                                                                                                                               |
| 41  | codebase-details-1-17         | 876–882      | PROPOSE FIX | Item 27 points at `certificates-earnings.test.ts` for refunds and adds the receipt mail assertion to `checkout.test.ts`. Drop `money-loop.test.ts` and `webhooks-stripe.test.ts`. |
| 42  | style-1-9                     | 855          | PROPOSE FIX | "Values inserted into HTML go through `para()` or `escapeHtml`; the subject and text part are plain text."                                                                        |
| 43  | style-1-10                    | 735–736      | PROPOSE FIX | "…changes the Drizzle schema; the Postgres enum changes when `npm run db:generate` emits a migration."                                                                            |
| 44  | implementation-readiness-1-17 | 825–835      | PROPOSE FIX | Item 21: the English email messages reproduce today's text word for word, because the existing tests match them.                                                                  |
| 45  | implementation-readiness-1-18 | 831–832, 998 | PROPOSE FIX | Name the keys: `email.signIn.text.*`, and `learnerCommon.duration.minutes`, `.hours`, `.hoursMinutes`.                                                                            |
| 46  | implementation-readiness-1-19 | 1073–1079    | PROPOSE FIX | Item 48 always strips `lang` from the address bar, stored or not, and keeps `location.hash`.                                                                                      |
| 47  | style-1-11                    | 363–370      | PROPOSE FIX | Add `learnerCommon` to the §6 area table.                                                                                                                                         |
| 48  | style-1-12                    | 971–972      | PROPOSE FIX | "Candidate list (paths checked)". The search pattern is JSX text, `accessibilityLabel=`, `placeholder=`, and string literals passed to `Text` or to state.                        |
| 49  | style-1-13                    | 873–874      | PROPOSE FIX | Drop the placeholder-parity case from item 26 (the catalog test covers it).                                                                                                       |
| 50  | style-1-14                    | 636          | PROPOSE FIX | Covered by Fix Set B.                                                                                                                                                             |
| 51  | style-1-15                    | 650          | PROPOSE FIX | "`system`: not chosen on this device; resolved from the account, `?lang`, then the device."                                                                                       |
| 52  | style-1-16                    | 659–664      | PROPOSE FIX | Add verbs to the sub-bullets, and type it as `isChosen(stored: LocalePreference): boolean`.                                                                                       |
| 53  | style-1-17                    | 703          | PROPOSE FIX | "record:".                                                                                                                                                                        |
| 54  | style-1-18                    | 840–841      | PROPOSE FIX | Split it into two bullets, one for each PR.                                                                                                                                       |
| 55  | style-1-19                    | 843, 886     | PROPOSE FIX | "root `package-lock.json`" in both places.                                                                                                                                        |
| 56  | style-1-20                    | 861–863      | PROPOSE FIX | "pass `locale` to `simpleEmail`".                                                                                                                                                 |
| 57  | style-1-21                    | 957          | PROPOSE FIX | Rewrap to 100 columns.                                                                                                                                                            |
| 58  | style-1-22                    | 969          | PROPOSE FIX | Use a double-backtick span.                                                                                                                                                       |
| 59  | style-1-23                    | 1084         | PROPOSE FIX | "Type / Scope: test coverage note". "No new tests" moves to Proposed Changes.                                                                                                     |
| 60  | style-1-24                    | 1094–1096    | DECLINE     | Wording only, and the meaning is clear.                                                                                                                                           |
| 61  | style-1-25                    | 1114–1116    | CONTEST     | The EGM template (`references/design_doc.md`, lines 175–177) has both the comment and the line.                                                                                   |
| 62  | (none)                        | —            | DECLINE     | Three Nits overlap Issues above (style N6, N7, N14), so they are recorded there and not as separate edits.                                                                        |
