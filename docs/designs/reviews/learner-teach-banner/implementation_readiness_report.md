# Goldfish Review Report: Stage 9 (Implementation Readiness Test)

**Target:** `docs/designs/learner-teach-banner.md` (DetailedRange, lines 520-846)

**Stage:** 9 (Implementation Readiness Test), uninterrupted full flow. **Mode:** REVIEW.

Three reviewers ran, each once and in a fresh context: `egm-implementation-readiness` and
`egm-codebase-details` against the implementation-readiness standard, and `egm-style`.

Findings raised by more than one reviewer are merged into one entry: the entry keeps the first
reviewer's id, takes the highest severity given, and lists the others under "Also raised by".

## Reviewer Status

| Reviewer                       | Status    | Findings | Checked |
| ------------------------------ | --------- | -------- | ------- |
| `egm-implementation-readiness` | completed | 10       | yes     |
| `egm-codebase-details`         | completed | 12       | yes     |
| `egm-style`                    | completed | 16       | yes     |

**Severity breakdown** (findings that stood up to checking): 1 Blocker, 9 Major, 14 Nit. 0
finding(s) were refuted on checking and are listed at the end.

**How findings were checked:** after each reviewer finished, a separate agent re-read the cited
lines of the document and opened the cited code. Each finding carries that check's verdict and
evidence.

## Prioritized Findings (Blockers -> Major -> Nits)

### implementation-readiness-1. No Chinese text and no process for it, so neither PR can pass its own checks - Severity: Blocker

-   **Reviewer Lens:** `egm-implementation-readiness`
-   **Affected Scope:** Detailed Implementation Plan: item 5 'Sign-in messages' (lines 579-602,
    files at 581-582, 'written by a person' at 602) and item 21 'Learner messages' (lines
    766-779); Open Questions, Question 1 (lines 108-110); the pass requirement at lines 522-523.
-   **Discrepancy Description:** Both PRs create `.zh.ts` area files (`portalAuth.zh.ts` in item
    5, `learnerTeach.zh.ts` in item 21), but the plan supplies no Chinese text. It says only
    that it "is written by a person" (line 602), and who that is remains Open Question 1. The
    reviewer says the zh files cannot be left empty: ADR 008 says a Chinese area is checked
    against its English file with `satisfies`, and `packages/i18n/test/catalog.test.ts` fails on
    untranslated keys. So neither PR can meet lines 522-523 ("each passes `npm run lint` and
    `npx turbo run typecheck test`") unless the implementer asks someone or translates the text
    themselves, and learner-chinese.md item 50 forbids machine translation.
-   **Rationale & Recommendation:** Resolve Question 1 in the plan. Either include the zh
    strings beside the English ones, or state the process: who drafts, who signs off, and that
    sign-off gates merge, as learner-chinese.md's risk table does for its PR 2 and PR 3.
-   **Check (confirmed):** Target: docs/designs/learner-teach-banner.md:522-523 "Each passes
    `npm run lint` and `npx turbo run typecheck test` on its own"; :581-582 creates
    `portalAuth.en.ts` and `portalAuth.zh.ts`; :602 "The Chinese text is written by a person
    ([Question 1](#open-questions))"; :768 creates `learnerTeach.zh.ts`; :108-110 Question 1 is
    still open; :336 the risk row names only "the same reviewer" and has no merge gate. Code:
    docs/adr/008-theming-preferences-i18n.md:64-65 "A Chinese area is checked against its
    English file with `satisfies`, so a missing or unknown key is a compile error";
    packages/i18n/src/messages/areas/invitation.zh.ts last line `} satisfies Record<keyof typeof
    invitationEn, string>`; packages/i18n/test/catalog.test.ts:30-34 fails when
    `missingKeys(locale)` is not empty, and :46-51 fails on empty strings;
    packages/i18n/src/index.ts:49-52 `missingKeys`. Other document:
    docs/designs/learner-chinese.md:1498 (item 50) "Chinese text is written by a person, not
    machine-translated"; :556 risk table "PR 2 and PR 3 don't merge without that reviewer's
    sign-off"; :154-155 its Question 3 is also open.
-   **Also raised by `egm-codebase-details` (codebase-details-2, Major, confirmed):** Neither PR
    can pass its own gate without Chinese text that has no named author. The plan says each PR
    passes `npm run lint` and `npx turbo run typecheck test` on its own.
    `packages/i18n/test/catalog.test.ts:30-34` fails on any missing `zh` key, and each `*.zh.ts`
    area is checked with `satisfies`. So `portalAuth.zh.ts` (23 keys) and `learnerTeach.zh.ts`
    must be complete in the PR that adds them. The plan gives no Chinese text and defers it to
    "a person" whom Open Question 1 leaves unnamed. `learner-chinese.md` item 24 shows the
    pattern of writing the Chinese inline ("跟随设备"). Correction to the reviewer's count:
    `learnerTeach` has 19 keys (4 banner + 15 screen), not 18. Its recommendation: Give the
    Chinese text in the plan (inline, as `learner-chinese.md` item 24 does), or name who writes
    it, so that each PR can pass the parity test and the `satisfies` check.
-   **Also raised by `egm-style` (style-5, Major, confirmed):** "reviewed with the Chinese" has
    an ambiguous referent and names no reviewer. The reviewer says "reviewed with the Chinese"
    can mean the Chinese text or people, and names no reviewer. Its only anchor is Question 1
    (lines 108-110), which is still open. The banner strings are given verbatim (lines 772-774),
    but the screen's roughly 15 strings are deferred by this one passive sentence. Its
    recommendation: Name the object ("the Chinese text"), the reviewer, and whether sign-off
    gates PR 2.

### implementation-readiness-2. The /teach screen's English copy is not in the plan, and the back link has no key - Severity: Major

-   **Reviewer Lens:** `egm-implementation-readiness`
-   **Affected Scope:** Detailed Implementation Plan: item 19 'The /teach screen' (lines
    744-757; content at 749-751, back link at 757) and item 21 'Learner messages' (lines
    766-779; screen keys at 775-777, line 779).
-   **Discrepancy Description:** Fourteen keys have names but no English text:
    `learnerTeach.screen.title`, `.intro`, `.who.title`, `.who.body`, `.how.title`, `.how.step1`
    to `.how.step6`, `.fee.title`, `.fee.body`, `.signInNote`. Line 779 leaves the writing to
    the implementer ("written in this PR"). The reviewer says this is product copy that makes
    claims about who may teach, the review steps and the commission, so it is a content decision
    and not a coding one. Item 5 and the banner keys in item 21 give their text word for word.
    The key list also has no key for the back link's label (line 757), so the implementer must
    invent one or borrow a not-yet-named key from the Chinese design's `learnerCourse` area.
-   **Rationale & Recommendation:** Give the screen's English text word for word in the plan, as
    item 5 and the banner keys in item 21 do, and name a key for the back link's label.
-   **Check (confirmed):** Target: docs/designs/learner-teach-banner.md:775-777 lists
    `learnerTeach.screen.title`, `.intro`, `.who.title`, `.who.body`, `.how.title`, `.how.step1`
    to `.how.step6`, `.fee.title`, `.fee.body`, `.signInNote` with no text (14 keys by count);
    only `.action` ("Go to Elevate Teach") has text; :779 "The English text of the screen is
    written in this PR and reviewed with the Chinese"; :772-774 the banner keys do carry their
    text, and :585-599 item 5 gives every string. :757 "A back link to Explore, as
    `course/[slug]` has" and no back-link key appears in item 21. Code:
    apps/learner/src/app/course/[slug].tsx:165-174 the back link is the English literal
    "Explore" (line 171). Other document: docs/designs/learner-chinese.md:450 lists
    `learnerCourse` as "course detail and the course card" and names no key for that back link
    (only `learnerCourse.lessons.one` at :1448 is named).
-   **Also raised by `egm-codebase-details` (codebase-details-1, Major, confirmed):** English
    text of the /teach screen is not in the plan. Item 21 gives English text only for the four
    banner keys (`learnerTeach.banner.title`, `.body`, `.action`, `.close`) and for
    `learnerTeach.screen.action` ("Go to Elevate Teach"). The other screen keys (`.title`,
    `.intro`, `.who.title`, `.who.body`, `.how.title`, `.how.step1` to `.how.step6`,
    `.fee.title`, `.fee.body`, `.signInNote`) have no text; line 779 says the English text of
    the screen "is written in this PR". The implementer therefore has to write product copy,
    including the commission sentence, which is an independent choice under the Zero-Decision
    Rule. Item 5 does this correctly by giving every sign-in string word for word. Correction to
    the reviewer's count: the keys without text number 14, not 13 (2 + 2 + 1 + 6 steps + 2 + 1).
    Its recommendation: Write the English text of every `learnerTeach.screen.*` key into item
    21, word for word, as item 5 does for the sign-in strings (the reviewer gives no proposed
    wording).

### implementation-readiness-3. Item 23 puts a test file inside Expo Router's app directory - Severity: Major

-   **Reviewer Lens:** `egm-implementation-readiness`
-   **Affected Scope:** Detailed Implementation Plan: item 23 'Learner tests' (lines 794-809;
    the path at 796-797); Verification Plan line 823.
-   **Discrepancy Description:** Item 23 creates
    `apps/learner/src/app/__tests__/teach.test.tsx`, a test file inside Expo Router's `app/`
    directory. The reviewer says Expo's testing guidance forbids test files there because every
    file under `app/` is treated as a route. The likely effects are a stray
    `/__tests__/teach.test` route and jest-only imports reaching the `npx expo export --platform
    web` bundle that the Verification Plan runs (line 823). The reviewer did not run a build to
    confirm. Today the only learner test is
    `apps/learner/src/lib/__tests__/preferences.test.tsx`, outside `app/`. The same placement is
    inherited from learner-chinese.md item 55 (`app/__tests__/sign-in.test.tsx`).
-   **Rationale & Recommendation:** Name a location outside `app/`, for example
    `apps/learner/src/__tests__/teach.test.tsx`; the jest `testMatch`
    `**/__tests__/**/*.test.ts?(x)` still finds it. Fix learner-chinese.md item 55 the same way.
    Also say how the screen is rendered: `renderRouter` with `TestProviders`, as the Chinese
    design's sign-in test does, or a direct render of the default export.
-   **Check (confirmed):** Target: docs/designs/learner-teach-banner.md:796-797 names
    `apps/learner/src/app/__tests__/teach.test.tsx` (Create); :798-799 says only "using the
    Chinese design's `TestProviders` and its `api.auth.me.$get` mock" and does not say how the
    screen is rendered; :823 `npx expo export --platform web`. Expo docs
    (https://docs.expo.dev/router/reference/testing/): "When using Expo Router, do not put your
    test files inside the app directory" and "All files inside your app directory must be either
    routes or layout files". Code: the only test file under apps/learner is
    apps/learner/src/lib/**tests**/preferences.test.tsx; apps/learner/package.json:69-71
    `testMatch: ["**/__tests__/**/*.test.ts?(x)"]`; AGENTS.md says routes live in `src/app/` and
    other code stays outside it. Other document: docs/designs/learner-chinese.md:1554
    `apps/learner/src/app/__tests__/sign-in.test.tsx (Create)`; :1573-1574 that test uses
    `renderRouter` with `TestProviders` as `wrapper`. Not checked: the stray route and the
    bundle effect. The reviewer said they were not built, and this worktree has no node_modules,
    so I could not build either.
-   **Also raised by `egm-codebase-details` (codebase-details-4, Major, confirmed):** The /teach
    test file sits inside the Expo Router route directory. `AGENTS.md:70` says "Routes live in
    `src/app/`; keep components, hooks and lib code outside it". No test exists under
    `apps/learner/src/app/` today; the only learner test is
    `apps/learner/src/lib/__tests__/preferences.test.tsx`. The reviewer recalled, without being
    able to confirm against expo-router's source, that Expo's Jest guide says not to put tests
    in the app directory because every file there becomes a route; if so, `expo export
    --platform web` (line 823) would ship a `/__tests__/teach.test` route that imports jest
    code. The same pattern comes from `learner-chinese.md` item 55
    (`src/app/__tests__/sign-in.test.tsx`). Its recommendation: Name a path outside `src/app/`
    for the test, for example `apps/learner/src/__tests__/`.

### implementation-readiness-4. The spec relies on a language picker at sign-in that item 8 does not add - Severity: Major

-   **Reviewer Lens:** `egm-implementation-readiness`
-   **Affected Scope:** Detailed Implementation Plan: item 8 'Sign-in page' (lines 623-635),
    against the Risks table row at line 339 and Alternative L's reason for rejection at lines
    483-484 (also line 277, "Support staff can switch language").
-   **Discrepancy Description:** The spec's mitigation for a wrongly guessed language says the
    Support sign-in page's "picker switches language" (line 339) and that "a Support agent can
    choose English in the picker" (line 484). `packages/web-ui/src/portal/SignInPage.tsx` has no
    language control today, and item 8 adds none. The reviewer says `PreferencesButton` appears
    only on pages behind sign-in. As planned, a visitor whose browser guesses wrong gets the
    sign-in page and the code email in that language, with no way to change it until after
    signing in. The spec sentences may mean the Settings picker after sign-in; then nothing
    needs building, but the wording at 339 and 484 misleads.
-   **Rationale & Recommendation:** Decide and state it: either item 8 adds `PreferencesButton`
    to `SignInPage` (and say whether `VerifyPage` gets it), or the plan says explicitly that no
    picker is added before sign-in.
-   **Check (partly confirmed):** Holds: docs/designs/learner-teach-banner.md:339 "Accepted; the
    Support sign-in page is translated too, and its picker switches language"; :483-484 "a
    Support agent can choose English in the picker"; :623-635 item 8 lists text, errors, the
    blurb, the request and the code verify, and no language control; :633 it sends the resolved
    `locale`, so the code email follows the guess.
    packages/web-ui/src/portal/SignInPage.tsx:1-163 and VerifyPage.tsx:1-52 hold no language
    control. Support has the picker only at apps/support/src/routes/settings.tsx:17
    (`PreferencesCard`), which sits behind `RequireAuth` (apps/support/src/router.tsx:33-50).
    Does not hold: "`PreferencesButton` appears only on pages behind sign-in".
    apps/teach/src/routes/invitation.tsx:70-71 renders `<PreferencesButton />` under the comment
    "An invitee may not be signed in, and has no Settings page yet", and that route,
    `/invitations/:token`, is outside `RequireAuth` (apps/teach/src/router.tsx:40). The other
    use, apps/teach/src/routes/gate.tsx:76, is behind sign-in. The false detail does not change
    the gap; the invitation page is an existing example of the button on a signed-out page.

### codebase-details-3. An owner whose launch request fails sees the banner - Severity: Major

-   **Reviewer Lens:** `egm-codebase-details`
-   **Affected Scope:** Lines 716-722 (item 16, Banner rule); spec lines 222-227 (The banner >
    When it shows); Goal 2 at lines 74-75; risk table line 335
-   **Discrepancy Description:** In `apps/learner/src/lib/session.tsx:45-53`, when
    `api.auth.me.$get()` fails for any reason other than 401 (offline, API down), the session
    becomes `status: 'signed_in'` with `user: null`. `isLoading` is then false and
    `user?.profiles.some(...)` is `undefined`, so the rule in item 16 returns visible. The spec
    says "Owners don't see it" (Goal 2) and "an owner never sees it flash" (line 224). The risk
    table accepts only the signed-out owner (line 335).
-   **Rationale & Recommendation:** The plan must say whether `isSignedIn && user === null`
    hides the banner, and add a test for that state.
-   **Check (confirmed):** apps/learner/src/lib/session.tsx:32 `useState<AuthUser |
    null>(null)`; :45-53 the non-401 branch only calls `setStatus('signed_in')` ("Offline or API
    down: keep the session"), leaving `user` null; :83 `isLoading: status === 'loading'`.
    docs/designs/learner-teach-banner.md:719-721 lists the hiding conditions (session loading,
    flag unread, dismissed, searching, owner) with nothing for a signed-in session without a
    user; :74-75 Goal 2 "Owners don't see it"; :224 "so an owner never sees it flash"; :335
    accepts only "Owners who are signed out see it". learner-chinese.md:1144-1171 (item 27) does
    not change this branch of the session.

### codebase-details-5. Banner and screen composition leave choices to the implementer - Severity: Major

-   **Reviewer Lens:** `egm-codebase-details`
-   **Affected Scope:** Lines 726-732 (item 17, Banner), 738-742 (item 18, Explore), 746-757
    (item 19, The /teach screen), 775-777 (item 21, Learner messages)
-   **Discrepancy Description:** Four choices are left open. (1) Close button: the plan says "a
    close button" without naming a component or icon; `apps/learner/src/ui/IconButton.tsx`
    already takes `icon`, `label` (as `accessibilityLabel`) and `testID` through its rest props,
    and the plan does not name it. (2) Back link label: item 19 adds "a back link to Explore, as
    `course/[slug]` has", but item 21 lists no key for it; `nav.explore` exists in
    `packages/i18n/src/messages/areas/chrome.en.ts:13` and is not named either. (3) Banner
    placement in the JSX: `apps/learner/src/app/(tabs)/index.tsx:121-172` is a four-way ternary;
    the plan does not say whether the banner goes inside the list branch's wrapper (155-171) and
    again beside the empty state (142-153), or once after the ternary behind a not-pending,
    not-error check. (4) `/teach` container: the plan does not say whether it uses `Screen` or
    which `bottomInset`; `course/[slug].tsx:163` uses `Screen bottomInset={isWideWeb ? 0 :
    TAB_BAR_HEIGHT}`.
-   **Rationale & Recommendation:** Name the close-button component and icon (for example
    `IconButton`), the message key for the back-link label (a new key or `nav.explore`), where
    exactly the banner is rendered relative to the ternary in Explore, and the `/teach` screen's
    container and `bottomInset`.
-   **Check (confirmed):** docs/designs/learner-teach-banner.md:730-731 "a close button
    (`accessibilityLabel` from `.close`, `testID` `teach-banner-close`)" with no component or
    icon; :757 "A back link to Explore, as `course/[slug]` has."; :772-777 has no back-link key;
    :740-742 "after the course list and 'Load more'. It shows in the list branch and in the 'No
    courses match' branch"; item 19 (:746-757) names no container.
    apps/learner/src/ui/IconButton.tsx:5-11 props `icon`, `label` plus `PressableProps`; :27
    `accessibilityLabel={label}`; :29 `{...rest}`.
    packages/i18n/src/messages/areas/chrome.en.ts:13 `'nav.explore': 'Explore'`.
    apps/learner/src/app/(tabs)/index.tsx:121 (`isPending`), :134 (`isError`), :141-153 (empty
    state), :154-172 (list wrapper). apps/learner/src/app/course/[slug].tsx:163 `<Screen
    bottomInset={isWideWeb ? 0 : TAB_BAR_HEIGHT}>`, back link at :165-174 with a literal
    "Explore".
-   **Also raised by `egm-implementation-readiness` (implementation-readiness-5, Nit,
    confirmed):** The banner and the /teach screen name their content but leave the structure
    open. The reviewer lists six open points. (1) Close button: `@/ui` already has `IconButton`
    (takes `icon`, `label`, spreads `testID`); the plan names neither it nor the icon. (2) The
    "Find out more" button has no `variant`. (3) The `/teach` screen has no `Screen` props, no
    text variants, and does not say how the six steps render (numbered or not). (4) The platform
    branch is not stated as `Platform.OS === 'web'` in the one file, as
    `checkout/[courseId].tsx:61` does. (5) A `Linking.openURL` rejection is unhandled as
    written; `RichText.tsx:35` swallows it with `.catch(() => {})`. (6) The back link:
    `course/[slug].tsx:160-174` is a `Link` wrapping a `Pressable` with `ArrowLeft` and the text
    "Explore"; the plan does not say whether `/teach` uses `href="/"` or `router.back()`. Its
    recommendation: Name `IconButton` and its icon; give the button's `variant`; give the
    screen's `Screen` props, text variants and step layout; say the branch is `Platform.OS ===
    'web'` in the one file; state whether a `Linking.openURL` rejection is swallowed; say
    whether the back link uses `href="/"` or `router.back()`.

### codebase-details-6. The plan's own coverage requirement is not met by its test list - Severity: Major

-   **Reviewer Lens:** `egm-codebase-details`
-   **Affected Scope:** Lines 829-830 (Verification Plan > Test Coverage Requirement) against
    800-809 (item 23, Learner tests) and 566-577 (item 4, Sign-in tests)
-   **Discrepancy Description:** Line 829 requires a test for "every branch of
    `useTeachBanner`'s rule". Item 23 has none for "the flag is unread" (line 719). It also has
    none for the two failure rules in item 15 (lines 709-710): a failed read counts as not
    dismissed, and a failed write is ignored. Nothing tests `teachUrl()` (env value, trailing
    slash, localhost rule, dev-host fallback). Nothing tests the web branch of the button
    (`window.location.assign`); `apps/learner/jest.setup.ts:1` runs iOS resolution only. Nothing
    tests that Explore hides the banner while loading and after an error (741-742). Item 4's
    last case ("a Teach verify sends no `locale`") and its token-verify case cannot use
    `signIn()`: that helper sends `locale` on both requests (`learner-chinese.md` item 17) and
    verifies by code only (`apps/api/test/helpers/test-app.ts:70-81`).
-   **Rationale & Recommendation:** Add tests for the unread-flag branch, the failed read and
    failed write, `teachUrl()`, the web branch of the button, and Explore's loading and error
    states (or narrow the coverage requirement). Say that item 4's no-locale verify case and its
    token-verify case use raw `api()` calls with `dev.link`.
-   **Check (confirmed):** docs/designs/learner-teach-banner.md:829-830 "every branch of
    `useTeachBanner`'s rule has a test"; :719 "while the flag is unread"; :709-710 the two
    failure rules; :801-809 lists only: signed-out and writer visible, two owner cases, session
    loading, searching, dismiss, and one `Linking.openURL` test. No `teachUrl`,
    `window.location.assign` or Explore test is listed. apps/learner/jest.setup.ts:1 "Jest runs
    the iOS platform resolution (jest-expo default)". apps/api/test/helpers/test-app.ts:70-81:
    `signIn` verifies with `{ email, code }` only (:75).
    docs/designs/learner-chinese.md:1037-1039: "It sends `opts.locale` on the magic-link
    request, and both fields on the verify request." apps/api/test/auth.test.ts:141 already uses
    `r.body.dev.link` for a token verify, so the suggested route exists.
-   **Also raised by `egm-style` (style-1, Major, confirmed):** "Every branch of
    useTeachBanner's rule has a test" outruns the listed tests. The reviewer says the coverage
    claim "every branch of `useTeachBanner`'s rule has a test" is stronger than the tests item
    23 lists. Item 16 gives five conditions that make `visible` false: session loading, flag
    unread, dismissed, searching, owner. Item 23 has no case for "while the flag is unread".
    Item 15's "a failed read counts as not dismissed" (line 709) has no test case either. Its
    recommendation: CALIBRATE: add the unread-flag case to item 23, or narrow the claim to the
    branches listed.
-   **Also raised by `egm-implementation-readiness` (implementation-readiness-9, Nit,
    confirmed):** The banner tests miss branches the coverage rule requires, and one session
    edge is undecided. Line 829 requires a test for every branch of `useTeachBanner`'s rule, but
    the list at 801-806 has none for "the flag is unread". Also untested: a failed read counting
    as not dismissed, a failed write being ignored, the web storage file, and the web branch of
    the button (`window.location.assign`). One edge is undecided:
    `apps/learner/src/lib/session.tsx:50-52` sets `signed_in` with `user` null when `/me` fails
    for a reason other than 401, so `user?.profiles.some(...)` is falsy and an owner sees the
    banner. Its recommendation: Add the missing tests or narrow the coverage requirement, and
    say whether an owner seeing the banner when `/me` fails is accepted or the banner is hidden
    in that case.

### style-2. One catalog area has two names: `portalAuth` in the plan, `auth` in the specification - Severity: Major

-   **Reviewer Lens:** `egm-style`
-   **Affected Scope:** Lines 581, 609, 628, 642, 826 (items 5, 6, 8, 9 and Verification Plan;
    also 585-598 and 651-652), against specification lines 269 (Teach's sign-in step) and 505
    (References)
-   **Discrepancy Description:** The reviewer says the plan calls the new catalog area
    `portalAuth` throughout, while the specification says "a new `auth` area" (line 269) and
    "the new `auth` and `learnerTeach` areas" (line 505). A reader cannot tell which name is
    authoritative.
-   **Rationale & Recommendation:** Use one term in both halves of the document.
-   **Check (confirmed):** learner-teach-banner.md:269 "to the catalog, in a new `auth` area";
    :505 "the catalog patterns the new `auth` and `learnerTeach` areas follow". Plan: :581
    `portalAuth.en.ts`, :609 "Add the `portalAuth` area", :628 "with a `portalAuth` key", :642
    "`portalAuth.verify` key", :826 "parity test for `portalAuth` and `learnerTeach`".
    packages/i18n/src/messages/areas/ has neither an `auth` nor a `portalAuth` file today, so
    neither name is settled by the code.
-   **Also raised by `egm-implementation-readiness` (implementation-readiness-8, Nit,
    confirmed):** The area is `portalAuth` in the plan and `auth` in the spec. The plan names
    the area `portalAuth`; the spec calls it "a new `auth` area" in both places. No existing key
    uses either prefix, so there is no collision, but the two names should agree. Its
    recommendation: Make the names agree. `portalAuth` is the better one, since the Chinese
    design already adds `learnerAuth`.
-   **Also raised by `egm-codebase-details` (codebase-details-9, Nit, confirmed):** Spec calls
    the new catalog area `auth`; the plan creates `portalAuth`. The spec half of the document
    calls the new catalog area `auth`; the plan creates `portalAuth` (file names and key
    prefix). The plan is explicit, so an implementer can follow it, but the two halves of the
    document disagree. Its recommendation: Make the two halves agree: change the spec's `auth`
    to `portalAuth` (the reviewer gives no wording).

### style-3. Support check attributed to CUJ 1, which does not cover Support - Severity: Major

-   **Reviewer Lens:** `egm-style`
-   **Affected Scope:** Lines 685-686 (item 13 Teach and Support checks) and line 833
    (Verification Plan, manual walkthrough), against CUJ 1 (lines 117-127)
-   **Discrepancy Description:** The reviewer says "checked by hand in CUJ 1, in Teach and in
    Support" cites a journey that covers learner web and Teach only; Support does not appear in
    it. Line 833 repeats the stretch: "CUJs 1, 3, 4 and 5 on learner web, against local Teach
    and Support". CUJs 3, 4 and 5 touch neither portal, and CUJ 1 touches Teach only. The only
    Support check is lines 836-837.
-   **Rationale & Recommendation:** CALIBRATE: state the Support check as its own step (which
    URL, what is asserted) and stop attributing it to CUJ 1.
-   **Check (confirmed):** learner-teach-banner.md:685-686 "checked by hand in CUJ 1, in Teach
    and in Support: Chinese text, `from` gone from the address bar, `elevate.from` in session
    storage". :117-127 CUJ 1 names the learner web app and Teach only; the word Support does not
    occur. :137-157 CUJs 3-5 are the owner rule, dismissal and searching, all inside the learner
    app (CUJ 4's "`/teach` still opens" is the learner screen). :833 "CUJs 1, 3, 4 and 5 on
    learner web, against local Teach and Support". :836-837 is the only step that names
    Support's pages, and it lists language and error cases, not the `from` / `elevate.from`
    assertions.

### style-4. Two "as X does" comparisons in the `teachUrl()` item each match only part of the sentence - Severity: Major

-   **Reviewer Lens:** `egm-style`
-   **Affected Scope:** Lines 696-698 (item 14 Teach address)
-   **Discrepancy Description:** The reviewer says: (a) `webBaseUrl()`
    (apps/learner/src/lib/web-url.ts) has no `localhost`/`127.0.0.1` rule, returns
    `window.location.origin` on web, and uses port 8081; only the native `hostUri` lookup
    matches. (b) Support's `teachUrl()` (apps/support/src/lib/urls.ts) matches the env,
    localhost and port 5173 rule on web, but has no native branch, and takes the scheme from
    `window.location.protocol`, which the plan does not state.
-   **Rationale & Recommendation:** CALIBRATE: attach each comparison to the clause it covers,
    and state the scheme.
-   **Check (confirmed):** learner-teach-banner.md:696-698 "A missing value, or one pointing at
    `localhost` or `127.0.0.1`, uses port 5173 on the dev host: `window.location.hostname` on
    web, and `Constants.expoConfig?.hostUri` on native, as `webBaseUrl()` does. This mirrors
    Support's `teachUrl()`." No scheme is stated. apps/learner/src/lib/web-url.ts:6-10: env
    value returned if set (no localhost test), `window.location.origin` on web,
    `Constants.expoConfig?.hostUri?.split(':')[0]` with `http://${host}:8081` on native.
    apps/support/src/lib/urls.ts:6-10: `fromEnv && !/localhost|127\.0\.0\.1/.test(fromEnv) ?
    fromEnv : `${window.location.protocol}//${window.location.hostname}:5173``; web only, no
    native branch.
-   **Also raised by `egm-implementation-readiness` (implementation-readiness-7, Nit,
    confirmed):** Item 14's fallback cites two models that differ. The fallback cites two models
    that differ. Support's `teachUrl()` (`apps/support/src/lib/urls.ts`) uses
    `window.location.protocol`. `webBaseUrl()` hard-codes `http://` and ends in
    `http://localhost:8081` when there is no `hostUri`. The plan does not say which protocol the
    web fallback uses, nor what native falls back to when `hostUri` is missing. Its
    recommendation: State the web protocol and the last native fallback
    (`http://localhost:5173`).
-   **Also raised by `egm-codebase-details` (codebase-details-7, Nit, confirmed):** teachUrl()
    fallback is described by analogy and leaves details open. Support's version
    (`apps/support/src/lib/urls.ts:5-12`) builds
    `${window.location.protocol}//${window.location.hostname}:5173`; the plan names only
    `hostname`. `webBaseUrl()` (`apps/learner/src/lib/web-url.ts:9-10`) ends in
    `http://localhost:8081` when `hostUri` is absent; the plan does not state the matching last
    resort (`http://localhost:5173`) or the native protocol. `apps/learner/eas.json` has three
    build profiles; the plan sets `preview` and `production` and does not say `development` is
    left on the fallback on purpose. Spec line 261 says "both `eas.json` build profiles". Its
    recommendation: State the protocol used on web and native, the last resort when `hostUri` is
    absent (`http://localhost:5173`), and that the `development` profile is left on the fallback
    on purpose.

### implementation-readiness-6. Item 18 allows two placements for the banner in Explore - Severity: Nit

-   **Reviewer Lens:** `egm-implementation-readiness`
-   **Affected Scope:** Detailed Implementation Plan: item 18 'Explore' (lines 734-742; Proposed
    Changes at 738-742).
-   **Discrepancy Description:** "After the course list and Load more, in the list branch and
    the No-courses branch" has two reasonable placements in
    `apps/learner/src/app/(tabs)/index.tsx`: inside each branch (the list branch's inner `View`,
    gap `space[5]`), or once as a sibling after the ternary in the outer `View` (gap `space[6]`)
    guarded by `!courses.isPending && !courses.isError`.
-   **Rationale & Recommendation:** Pick one placement and state it.
-   **Check (confirmed):** Target: docs/designs/learner-teach-banner.md:740-742 "Render
    `<TeachBanner onDismiss={dismiss} />` when `visible`, after the course list and \"Load
    more\". It shows in the list branch and in the \"No courses match\" branch, and not while
    loading or after a load error". Code: apps/learner/src/app/(tabs)/index.tsx:35 outer `<View
    style={{ gap: theme.space[6] }}>`; :121-172 one ternary: `courses.isPending` (121),
    `courses.isError` (134), `items.length === 0` (141, "No courses match"), else the list
    (154); :155 the list branch's inner `<View style={{ gap: theme.space[5] }}>` holds the
    `Grid` and "Load more" (161-170). Both placements the reviewer describes fit this structure.
-   **Also raised by `egm-style` (style-10, Nit, confirmed):** Banner placement is imprecise
    against the Explore screen's branches. The reviewer says "after the course list and "Load
    more"" and "in the "No courses match" branch" are imprecise against
    apps/learner/src/app/(tabs)/index.tsx. The `items.length === 0` arm has no list or "Load
    more". That arm is mostly reached while searching, when `visible` is already false. Its
    recommendation: State the condition as the specification does (lines 220-221): the first
    page has loaded and no filter is active, including an empty catalog.

### implementation-readiness-10. ADR 008's 'Translated today' paragraph and .maestro/README.md are missing from the file list - Severity: Nit

-   **Reviewer Lens:** `egm-implementation-readiness`
-   **Affected Scope:** Detailed Implementation Plan: item 6 'Catalog assembly (sign-in)' (lines
    604-611), item 12 'Records (sign-in)' (lines 666-676) and item 24 'Device flow' (lines
    811-817).
-   **Discrepancy Description:** Two records are missed. ADR 008's own "Translated today"
    paragraph (ADR lines 66-71) is not updated for the sign-in and verify pages, though the
    `en.ts` header comment and AGENTS.md are. `.maestro/README.md` documents the flows and their
    run command, and is not in the file list for the new `teach-banner.yaml`.
-   **Rationale & Recommendation:** Add both files to the plan, or state that they are left
    alone, so the write allowlist is complete.
-   **Check (confirmed):** Target: docs/designs/learner-teach-banner.md:610-611 updates the
    "Translated today" header comment in `en.ts`; :668-669 item 12's files are ADR 010,
    `AGENTS.md` and `docs/designs/learner-chinese.md`, with no ADR 008; :813 item 24's only file
    is `.maestro/teach-banner.yaml`. Code: docs/adr/008-theming-preferences-i18n.md:66-72
    "Translated today: navigation, the Settings/Preferences/Profile screens, and the
    teaching-profile screens ... Other pages stay English until they are translated whole" (the
    paragraph runs to line 72, not 71) and does not list the sign-in or verify pages;
    .maestro/README.md exists, with a "Run" section at :15-19 (`maestro test
    .maestro/learner-preferences.yaml`) and "What is asserted" at :23-30. It names only the
    learner-preferences flow, not `sign-in.yaml`, so "documents the flows" is slightly broad.
    Other document: docs/designs/learner-chinese.md:1596-1606 (item 57) does update ADR 008's
    "Translated today" for the learner app, which shows the record is meant to be kept current.
-   **Also raised by `egm-codebase-details` (codebase-details-8, Nit, confirmed):** Some
    documents that describe the changed things are not in the file list, and record wording is
    not given. `docs/adr/008-theming-preferences-i18n.md:66-72` has its own "Translated today"
    list; the plan updates the `en.ts` header and `AGENTS.md:36-40` but not this, while
    `learner-chinese.md` item 57 updates all three. `docs/runbooks/deploy.md:55-57` lists the
    build-time variables; `EXPO_PUBLIC_TEACH_URL` is not added there. `.maestro/README.md` lists
    the flows; the new flow is not added. The ADR 010 line, the `AGENTS.md` wording and the
    "pointer" text in `learner-chinese.md` are not written out, whereas `learner-chinese.md`
    item 40 quotes its rule text exactly. Its recommendation: Add ADR 008's "Translated today"
    list, `docs/runbooks/deploy.md` and `.maestro/README.md` to the file list, and write out the
    exact text of the ADR 010 line, the AGENTS.md change and the pointer in
    `learner-chinese.md`.

### codebase-details-10. Data-flow diagram shows `locale` on the Teach sign_in event, which is always null for Teach - Severity: Nit

-   **Reviewer Lens:** `egm-codebase-details`
-   **Affected Scope:** Lines 556-557 (item 2, Sign-in service), 635 (item 8, Sign-in page), 645
    (item 9, Verify page) against spec line 212 (Data flow)
-   **Discrepancy Description:** The data-flow diagram shows `locale` on the Teach `sign_in`
    event, but Teach and Support send no `locale` at verify. With `locale: input.locale ?? null`
    (`learner-chinese.md` item 11), that property is always `null` for Teach.
-   **Rationale & Recommendation:** The plan should say that the `sign_in` event's `locale` is
    always `null` for Teach and Support.
-   **Check (confirmed):** docs/designs/learner-teach-banner.md:212 "-> sign_in event {
    audience: teach, locale, source: learner }"; :282 "Teach sends no `locale` or `localeChosen`
    at verify"; :635 "The code verify sends `source: arrivalSource()`, and no `locale`"; :645
    the token verify sends only `source`; :556-557 `source` goes "beside `audience` and
    `locale`". docs/designs/learner-chinese.md:966 `properties: { audience: link.audience,
    locale: input.locale ?? null }`, called in `verify`.

### codebase-details-11. The Maestro flow is under-specified for a real device - Severity: Nit

-   **Reviewer Lens:** `egm-codebase-details`
-   **Affected Scope:** Lines 811-817 (item 24, Device flow)
-   **Discrepancy Description:** Explore loads 12 courses per page
    (`apps/learner/src/lib/catalog.ts:39`), and the banner sits after "Load more"; with more
    than 12 seeded courses, "scroll to `teach-banner-open`" needs "Load more" taps that the flow
    does not mention. "Go back" has no hardware equivalent on iOS, and the back link in item 19
    has no `testID`. The header variables are not stated; `.maestro/sign-in.yaml:5-8` uses
    `APP_ID`, `EMAIL` and `API_URL`.
-   **Rationale & Recommendation:** State how the flow gets past "Load more", give the `/teach`
    back link a `testID` and tap it for "go back", and state the flow's header variables
    (`APP_ID` and any others).
-   **Check (confirmed):** docs/designs/learner-teach-banner.md:815-817 "launch signed out,
    scroll to `teach-banner-open`, tap it, ... go back, tap `teach-banner-close`, relaunch";
    :757 the back link has no `testID`. apps/learner/src/lib/catalog.ts:39 `limit: '12'`.
    apps/learner/src/app/(tabs)/index.tsx:161-170 "Load more" button. .maestro/sign-in.yaml:5-8
    `appId: ${APP_ID}`, `EMAIL`, `API_URL`. The Load-more point is conditional, as the reviewer
    wrote: I did not count the seeded courses exactly (a grep of packages/db/src/seed finds 6
    `status: 'live'` matches, so the current seed may fit on one page).

### codebase-details-12. Two small wording inaccuracies - Severity: Nit

-   **Reviewer Lens:** `egm-codebase-details`
-   **Affected Scope:** Lines 536 (Target Files to Create/Modify) and 569 (item 4, Sign-in
    tests)
-   **Discrepancy Description:** Line 536 says learner paths are relative to `apps/learner/src/`
    unless they start with `apps/`. Every learner path in this plan starts with `apps/`; only
    the sibling shorthand `teach-banner-storage.web.ts` (line 702) does not. Line 569 says
    "disposable Postgres"; the helper uses in-process PGlite
    (`apps/api/test/helpers/test-app.ts:2,18,27`).
-   **Rationale & Recommendation:** Drop or correct the sentence at line 536, and change
    "disposable Postgres" at line 569 to PGlite.
-   **Check (confirmed):** docs/designs/learner-teach-banner.md:536 "All learner paths below are
    relative to `apps/learner/src/` unless they start with `apps/`."; the learner paths at :692,
    :702, :714, :726, :736, :746, :761, :783, :796-797 all start with `apps/`, except the
    shorthand `teach-banner-storage.web.ts` at :702. :569 "integration test (vitest, disposable
    Postgres)". apps/api/test/helpers/test-app.ts:2 `import { createPgliteDb } from
    '@elevate/db/pglite'`; :18 `DATABASE_URL: 'pglite://memory'`; :27 `await createPgliteDb()`.
-   **Also raised by `egm-style` (style-6, Nit, confirmed):** The path convention at line 536 is
    unused and would misplace the one bare path. The reviewer says the convention ("relative to
    `apps/learner/src/` unless they start with `apps/`") is unused: every learner file path in
    items 14-23 is written in full. Under that rule the bare `teach-banner-storage.web.ts` (line
    702) would resolve to the wrong directory. Its recommendation: DROP the sentence, or write
    the short forms it describes.

### style-7. "The rules are covered by item 4's API tests and the i18n parity test" has no antecedent and overclaims - Severity: Nit

-   **Reviewer Lens:** `egm-style`
-   **Affected Scope:** Line 684 (item 13 Teach and Support checks), with lines 619-620 (item 7)
    and 661 (item 11)
-   **Discrepancy Description:** The reviewer says "**The rules** are covered by item 4's API
    tests and the i18n parity test" has no antecedent for "the rules" and overclaims. Two rules
    have no automated test: the schema check in `arrivalSource()` (lines 619-620) and the `from
    === 'learner'` check in `preferences-init.js` (line 661).
-   **Rationale & Recommendation:** CALIBRATE to "the server's `source` and `locale` handling,
    and catalog parity".
-   **Check (confirmed):** learner-teach-banner.md:684 "**The rules** are covered by item 4's
    API tests and the i18n parity test." No earlier bullet in item 13 defines "the rules".
    :619-620 "It returns the value only when `arrivalSourceSchema` accepts it" is in
    `packages/web-ui`, and :683 says "No web-ui tests". :661 "When `?from` is `learner`, write
    it to `sessionStorage`" is in the pre-paint scripts; no test file in the repo references
    `preferences-init`, and learner-chinese.md item 59 ("Teach and Support tests ... Files:
    none") adds none. Line 685 does assign "the pages and scripts" to a hand check, which covers
    the init script but not the `arrivalSource()` helper.

### style-8. "Nothing changes in the learner app" is stronger than the specification's wording - Severity: Nit

-   **Reviewer Lens:** `egm-style`
-   **Affected Scope:** Line 527 (Detailed Implementation Plan, PR 1 summary), against
    specification lines 314-315 (Order of release)
-   **Discrepancy Description:** The reviewer says "Nothing changes in the learner app" is
    stronger than the specification's "changes nothing visible in the learner app" (lines
    314-315). PR 1 changes `packages/core` contracts and adds an `@elevate/i18n` area, and the
    learner app bundles both.
-   **Rationale & Recommendation:** CALIBRATE to "No file under `apps/learner` changes" or the
    specification's wording.
-   **Check (confirmed):** learner-teach-banner.md:527 "Nothing changes in the learner app."
    :314-315 "It changes nothing visible in the learner app." Items 1 and 5-6 (:542, :581, :606)
    change `packages/core/src/contracts/auth.ts` and `packages/i18n`.
    apps/learner/package.json:7-8 lists `@elevate/core` and `@elevate/i18n` as dependencies.

### style-9. "Each passes" lint and typecheck/test is present tense for unbuilt work - Severity: Nit

-   **Reviewer Lens:** `egm-style`
-   **Affected Scope:** Lines 522-523 (Detailed Implementation Plan, opening paragraph)
-   **Discrepancy Description:** The reviewer says "Each passes `npm run lint` and `npx turbo
    run typecheck test` on its own" is present tense for work that is not built, so it reads as
    a verified result.
-   **Rationale & Recommendation:** CALIBRATE to "must pass".
-   **Check (confirmed):** learner-teach-banner.md:522-523 "The work lands in two pull requests,
    after all four of the Chinese design's. Each passes `npm run lint` and `npx turbo run
    typecheck test` on its own." The quote is exact and the work is planned, not built (none of
    the files in items 1-24 marked Create exist, e.g. no `portalAuth.*` under
    packages/i18n/src/messages/areas/). Whether a reader takes the present tense as a verified
    result is a style judgement.

### style-11. `useTeachBanner` has two signatures - Severity: Nit

-   **Reviewer Lens:** `egm-style`
-   **Affected Scope:** Line 716 (item 16 Banner rule), against specification line 222 (The
    banner)
-   **Discrepancy Description:** The reviewer says the plan's signature is
    `useTeachBanner(searching: boolean)`, while the specification writes `useTeachBanner()`.
-   **Rationale & Recommendation:** Use one form.
-   **Check (confirmed):** learner-teach-banner.md:716-717 "`useTeachBanner(searching: boolean):
    { visible: boolean; dismiss: () => void }`"; :739 "Call `useTeachBanner(searching)`". :222
    "A `useTeachBanner()` hook returns whether to show it."

### style-12. "gains a pointer" versus "is amended" for the learner-chinese.md sentence - Severity: Nit

-   **Reviewer Lens:** `egm-style`
-   **Affected Scope:** Lines 675-676 (item 12 Records), against specification lines 280-281
    (Teach's sign-in step, The code email)
-   **Discrepancy Description:** The reviewer says the plan has the learner-chinese.md sentence
    "gains a pointer", while the specification says it "is amended". After PR 1 the quoted
    sentence is false, so the two verbs describe different edits.
-   **Rationale & Recommendation:** Pick one.
-   **Check (confirmed):** learner-teach-banner.md:675-676 "its sentence "Teach and Support send
    none, so their links carry no `lang`" gains a pointer to this design." :280-281 "This
    changes the Chinese design's "Teach and Support send no `locale`": that sentence is amended
    when this design lands." The sentence is at learner-chinese.md:420-421 ("Teach and Support
    send none, so their links carry no `lang`."). Item 8 (:633-634) makes `SignInPage` send
    `locale` in both portals, so the sentence stops being true after PR 1.

### style-13. "reads nothing itself" is broader than intended - Severity: Nit

-   **Reviewer Lens:** `egm-style`
-   **Affected Scope:** Line 732 (item 17 Banner); the reviewer cited line 733, which is blank
-   **Discrepancy Description:** The reviewer says "reads nothing itself" is broader than
    intended, since the component reads `t()` and the router.
-   **Rationale & Recommendation:** CALIBRATE to "reads no storage or session state".
-   **Check (confirmed):** learner-teach-banner.md:732 "It takes `onDismiss` from its parent,
    and reads nothing itself." (line 733 is empty, so the reviewer's line number is off by one).
    :729-731 the same component shows `learnerTeach.banner.title`, `.body`, `.action` and
    `.close` from the catalog and calls `router.push('/teach')`, so it does use the message
    catalog and the router.

### style-14. API integration tests are filed under "Unit Tests"; "E2E/Integration" holds only manual checks - Severity: Nit

-   **Reviewer Lens:** `egm-style`
-   **Affected Scope:** Lines 824-827 and 831-838 (Verification Plan), with line 569 (item 4)
-   **Discrepancy Description:** The reviewer says item 4 is typed "integration test (vitest,
    disposable Postgres)" at line 569 but listed under "Unit Tests". "E2E/Integration" then
    holds only manual checks. The sibling design files the API integration tests under
    E2E/Integration (learner-chinese.md lines 1653-1657).
-   **Rationale & Recommendation:** Align the labels.
-   **Check (confirmed):** learner-teach-banner.md:569 "**Type / Scope**: integration test
    (vitest, disposable Postgres)." :824-825 "**Unit Tests**: `npx turbo run test`, covering:
    the API sign-in tests (item 4)". :831-838 E2E/Integration lists "A manual walkthrough" and
    "The Maestro flow in item 24, run by hand" only. learner-chinese.md:1653-1657
    "**E2E/Integration**: **API integration tests** against a disposable Postgres, covering: the
    verify rule and `PATCH /me`; ...".

### style-15. "Success measure" names two counts and no threshold - Severity: Nit

-   **Reviewer Lens:** `egm-style`
-   **Affected Scope:** Lines 839-840 (Verification Plan, Success measure)
-   **Discrepancy Description:** The reviewer says "Success measure" names two counts and no
    threshold, so it does not define success. The sibling design points its equivalent line at
    an open question about a target (learner-chinese.md lines 1672-1673).
-   **Rationale & Recommendation:** Rename it "Measurement", or state a target or an open
    question.
-   **Check (confirmed):** learner-teach-banner.md:839-840 "**Success measure:** after launch,
    count `sign_in` events with `audience: 'teach'` and `source: 'learner'`, and the
    `teacher_applied` events of those users." No target is given, and the only open question
    (:108-110) is about the Chinese text. learner-chinese.md:1672-1673 "**Success measure**:
    after launch, count `sign_in` and `checkout_completed` events by their `locale` property.
    [Question 2](#open-questions) asks whether there is a target."; its Question 2
    (learner-chinese.md:152-153) is "is there a target for the share of Chinese sign-ins and
    purchases?".

### style-16. Three stacked "with" clauses in the `teach.test.tsx` sentence - Severity: Nit

-   **Reviewer Lens:** `egm-style`
-   **Affected Scope:** Lines 807-809 (item 23 Learner tests)
-   **Discrepancy Description:** The reviewer says the sentence stacks three "with" clauses.
-   **Rationale & Recommendation:** Suggested wording: "In `zh`, pressing `teach-open` calls a
    mocked `Linking.openURL` with a URL ending `/?lang=zh&from=learner`."
-   **Check (confirmed):** learner-teach-banner.md:807-809 "**`teach.test.tsx`:** with the
    language `zh`, pressing `teach-open` calls `Linking.openURL` with a URL ending
    `/?lang=zh&from=learner`, with `Linking.openURL` replaced by `jest.fn` for the test." Three
    "with" phrases in one sentence. Whether to reword is a style choice.
