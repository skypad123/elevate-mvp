# Goldfish Review Report: Stage 7 (Critic Review)

**Target:** `docs/designs/learner-teach-banner.md` (FeatureRange, lines 1-519)

**Stage:** 7 (Critic Review), uninterrupted full flow. **Mode:** REVIEW.

Three reviewers ran, each once and in a fresh context: `egm-design` and `egm-structural` against the
feature-spec standard, and `egm-style`.

Findings raised by more than one reviewer are merged into one entry: the entry keeps the first
reviewer's id, takes the highest severity given, and lists the others under "Also raised by".

## Reviewer Status

| Reviewer         | Status    | Findings | Checked |
| ---------------- | --------- | -------- | ------- |
| `egm-design`     | completed | 12       | yes     |
| `egm-structural` | completed | 10       | yes     |
| `egm-style`      | completed | 22       | yes     |

**Severity breakdown** (findings that stood up to checking): 0 Blocker, 13 Major, 24 Nit. 0
finding(s) were refuted on checking and are listed at the end.

**How findings were checked:** after each reviewer finished, a separate agent re-read the cited
lines of the document and opened the cited code. Each finding carries that check's verdict and
evidence.

## Prioritized Findings (Blockers -> Major -> Nits)

### design-1. Dismissing the banner on native removes the only way to Teach - Severity: Major

-   **Reviewer Lens:** `egm-design`
-   **Affected Scope:** Lines 151 (CUJ 4), 186-187 (Decisions made while drafting, item 4), 334
    (Risks table), 512-513 (Future Improvements). The reviewer's line numbers are correct.
-   **Discrepancy Description:** The only mitigation for the risk "A dismissed visitor can't
    find Teach again" is "`/teach` stays open by address". On iOS and Android there is no
    address bar, and the app claims no web links (learner-chinese.md lines 339-340). So one
    press of the close button removes the only entry point on that install for good. CUJ 4's
    third outcome (line 151, "`/teach` still opens when visited by its address") cannot be
    checked on native. The Profile link that would fix this is deferred to Future Improvements
    and is not weighed as an alternative.
-   **Rationale & Recommendation:** Do one of: move the Profile "Teach on Elevate" row into
    scope; make the dismissal expire; or restrict the mitigation and CUJ 4 to web and record the
    native dead end as an accepted cost.
-   **Check (confirmed):** docs/designs/learner-teach-banner.md:334 gives the mitigation
    "`/teach` stays open by address. A link from Profile is a future improvement". Line 151:
    "`/teach` still opens when visited by its address." Lines 186-187: "the banner never shows
    there again". Lines 512-513 list the Profile link under Future Improvements. Alternatives
    A-M (351-495) include "H: No dismiss button" but neither a Profile link nor an expiring
    dismissal. docs/designs/learner-chinese.md:339-340: "the app claims no web links". One
    qualifier the reviewer did not mention: apps/learner/app.json:8 sets a custom scheme,
    `"scheme": "elevate"`, so `/teach` is technically reachable by a deep link, but the design
    names no such route and a visitor has no way to type one.

### design-2. The arrival count cannot show whether the bottom-of-list placement works - Severity: Major

-   **Reviewer Lens:** `egm-design`
-   **Affected Scope:** Lines 86-87 (Goal 5), 188-190 (Decisions, item 5), 295 and 303-305
    (Counting arrivals), 332 and 338 (Risks table), 432 (Alternative G), 516 (Future
    Improvements). The reviewer's line numbers are correct. A related line outside the reviewed
    range is 839-840 (Verification Plan, "Success measure").
-   **Discrepancy Description:** The design accepts its main risk, bottom-of-list placement, on
    the claim that "the arrival count shows whether it works" (332, 432, 516). The reviewer says
    the count cannot show that, for five reasons. (a) No denominator: with no impressions or
    presses, a low count cannot separate "never seen" from "seen and ignored" or "no demand".
    (b) No threshold or review date; the brief required success measures in each design doc
    (learner-main-page-improvements.md 297-298) and this one has none. (c) Undercount not
    acknowledged: Goal 3's second and third cases (80-81) are visitors already signed in to
    Teach, who produce no `sign_in` event, so their applications are never attributed; only the
    cross-tab case is listed (338). (d) Overcount not acknowledged: `elevate.from` is never
    cleared after a successful verify, so every later sign-in in that tab is tagged again
    (sign-out and back in, session expiry, a shared computer). (e) The application query is
    loose: "`teacher_applied` events whose `userId` has such a sign-in" (303-305) has no time
    order, so an existing applicant who later presses the banner is counted, and it includes
    resubmissions, since `reapply: true` is emitted at apps/api/src/services/profiles.service.ts
    lines 211 and 369.
-   **Rationale & Recommendation:** Define the metric as distinct users whose first Teach
    `sign_in` carries `source: learner`, and applications with `reapply: false` after that
    sign-in. Clear the marker on a successful verify. Either send `source` on the application
    request or state the signed-in undercount. State a decision rule, or reword the risk rows so
    the count is not presented as a test of the placement.
-   **Check (partly confirmed):** Everything holds except one sentence. Holds:
    learner-teach-banner.md:332 "The arrival count shows whether it works", repeated at 432 and
    516. Alternative I (444-453) rejects client events for views and presses, so there is no
    denominator. No threshold or review date appears anywhere in the file. Lines 295 and 338
    list only the cross-tab undercount. `sign_in` is sent only from verify
    (learner-chinese.md:523-524), so a visitor already signed in to Teach (lines 80-81) produces
    none. Lines 290-298 (and items 7 and 11 at 615-621, 661-664) write `elevate.from` to
    sessionStorage and never clear it; line 295 says "The marker lasts for the tab". Lines
    303-305 give the application query with no time order.
    apps/api/src/services/profiles.service.ts:211 emits `properties: { reapply: !!existing,
    profileId }` (true on a resubmission, not the literal `true`) and :369 emits `reapply:
    true`. learner-main-page-improvements.md:297-298 does require "acceptance criteria, success
    measures, and how to turn the feature off". Overstated: "this one has none". The document
    has a bullet labelled "Success measure" at lines 839-840, outside the reviewed range 1-519:
    "after launch, count `sign_in` events ... and the `teacher_applied` events of those users".
    It is a bare count with no threshold or date, so the reviewer's point about a missing
    decision rule still stands.
-   **Also raised by `egm-style` (style-5, Major, confirmed):** "The arrival count shows whether
    it works" claims a measure of reach the design lacks. The document says "The arrival count
    shows whether it works", "The arrival count shows whether the place works" and "if the
    arrival count shows few people reach it". The reviewer says the metric counts Teach sign-ins
    carrying `source: 'learner'` (line 303); views and presses are not recorded (Alternative I,
    lines 444-453). A low count cannot separate "few saw the banner" from "saw it and did not
    press" or "pressed and did not sign in". Line 516 claims a measurement of reach the design
    does not have. Its recommendation: CALIBRATE to "the arrival count shows how many sign-ins
    the banner produced; it does not show how many visitors saw it".
-   **Also raised by `egm-style` (style-14, Nit, confirmed):** Goal 5 "can be counted" reads as
    an exact count. Goal 5 says arrivals "can be counted". The reviewer says this reads as an
    exact count, while lines 295, 337 and 338 document an undercount and a forgeable marker (the
    reviewer says those risk rows are evidence-backed and should be kept). Its recommendation:
    CALIBRATE the goal to "can be estimated", or point to the known undercount.

### design-3. The Chinese path stops at the English personal application form - Severity: Major

-   **Reviewer Lens:** `egm-design`
-   **Affected Scope:** Lines 26-27 (Overview, item 4), 50-51 (The Problem), 84-85 (Goal 4),
    97-98 (Non-Goals, "Translating Teach beyond its sign-in step"; the reviewer cited 97-100,
    and 99-100 are the next non-goal), 117-127 (CUJ 1; the reviewer cited 117-125).
-   **Discrepancy Description:** Lines 50-51 say the start page and dashboard are translated,
    "so the gap is the sign-in step in between". The reviewer says that is not true for the
    design's own primary journey: CUJ 1 ends with "open the personal application", and that form
    is English literals at apps/teach/src/routes/apply.tsx lines 112-129 ("Become a teacher",
    "Teach what you practise.", and so on). Only the company application is translated (ADR 008
    lines 67-70). A Chinese reader passes a Chinese banner, intro, sign-in page, code email and
    start page, then meets an English form at the conversion step, followed by English review
    emails. The Non-Goal (97-100) declares this, but the Risks table has no row for it, and Goal
    4's "Teach's door" hides it.
-   **Rationale & Recommendation:** Correct lines 50-51; add a risk row; and either bring
    `apply.tsx` into PR 1 or have the `/teach` screen say the application is in English.
-   **Check (confirmed):** learner-teach-banner.md:50-51: "Teach's start page and dashboard are
    already translated, so the gap is the sign-in step in between." Line 122: "...sign in to
    Teach with the emailed code and open the personal application."
    apps/teach/src/routes/apply.tsx:112 `'Update your application' : 'Become a teacher'`, :114
    "Teach what you practise.", :117-119 and :123-126 are English literals in JSX with no `t()`
    call. docs/adr/008-theming-preferences-i18n.md:66-72 lists "the start page, the dashboard,
    ... the company application and set-up" as translated and says other pages "stay English ...
    as do error messages from the API and emails"; the personal application is not listed.
    learner-teach-banner.md:97-98 declares the non-goal ("The application forms ... stay as they
    are"). The Risks table (330-339) has no row for an English application form. The "English
    review emails" detail rests on ADR 008:71-72 and on learner-chinese.md translating learner
    emails only (line 415: "The teacher's copy of the refund email stays English"); I did not
    open the application email templates.

### design-4. The data-flow diagram shows `locale` on the Teach `sign_in` event, but Teach sends none at verify - Severity: Major

-   **Reviewer Lens:** `egm-design`
-   **Affected Scope:** Lines 209-212 (Data flow) against 282-283 (Teach's sign-in step in the
    visitor's language). The reviewer's line numbers are correct.
-   **Discrepancy Description:** The data-flow diagram shows `sign_in event { audience: teach,
    locale, source: learner }`. Lines 282-283 say Teach sends no `locale` at verify. The Chinese
    design fills the event's `locale` from the verify request only (learner-chinese.md 523-524,
    and `locale: input.locale ?? null` at 967). So every Teach `sign_in` records `locale: null`,
    and banner arrivals cannot be split by language, although Goal 4 is about Chinese visitors.
    An implementer who follows the diagram and sends `locale` at verify would write
    `users.locale`, which line 283 says must not happen.
-   **Rationale & Recommendation:** Fix the diagram to show `locale: null`, or carry the request
    language to the event without the account write, and say which.
-   **Check (confirmed):** learner-teach-banner.md:211-212: "verify { code | token, source:
    learner } -> sign_in event { audience: teach, locale, source: learner }". Lines 282-283:
    "Teach sends no `locale` or `localeChosen` at verify, so signing in to Teach never changes
    `users.locale`". Item 8 at line 635 repeats "The code verify sends `source:
    arrivalSource()`, and no `locale`." docs/designs/learner-chinese.md:523-524: `sign_in` is
    "sent from verify ... with the verify request's `locale`"; :967 `properties: { audience:
    link.audience, locale: input.locale ?? null }`. learner-chinese.md:954-960: when
    `input.locale` is set at verify, `users.locale` is updated, which is the write line 283
    rules out.

### structural-1. Eight rejections say "Rejected by author" and cite only this document's own decision list - Severity: Major

-   **Reviewer Lens:** `egm-structural`
-   **Affected Scope:** Alternatives Considered, Alternatives C-J, "Reason for Rejection" at
    lines 382-383, 394-395, 404-405, 417-418, 430-431, 440-441, 451-452, 462-463; the anchor
    target is "Decisions made while drafting", lines 177-190 (Technical Plan). All line numbers
    are correct for the target as it is now.
-   **Discrepancy Description:** Eight rejections are worded "Rejected by author" and link only
    to this document's own "Decisions made while drafting" list
    (`#decisions-made-while-drafting`). The standard's Alternatives Rule says a rejection must
    not be attributed to a maintainer without linking their issue, discussion, or PR. The
    reviewer says an in-document anchor is none of those, that the list it points to carries no
    outside record, so the citation is circular, and that decisions 3, 4 and 5 (lines 184-190)
    cite no source at all. The reviewer also notes that each of the eight does state a concrete
    trade-off, so the fix is small.
-   **Rationale & Recommendation:** Either drop the "Rejected by author" attribution and let the
    stated trade-off stand, or link the actual record of the decision.
-   **Check (confirmed):** docs/designs/learner-teach-banner.md:382, 394, 404, 417, 430, 440,
    451, 462 each read "**Reason for Rejection**: Rejected by author" followed on the next line
    by "([drafting decision N](#decisions-made-while-drafting))" and then a trade-off sentence.
    The anchor resolves to line 177, "### Decisions made while drafting". Decisions 3, 4 and 5
    (lines 184-190) name no source. Decisions 1 and 2 (lines 179, 182) do name "the brief's
    Question 6" and "the brief's Question 7" in plain text, without a link; those are open
    questions in the brief (learner-main-page-improvements.md:315, 317), not a record of the
    answer, so the reviewer's "no outside record" holds for the answers. The rule is quoted
    accurately: feature-spec-standard.md:19-21, "Rejection rationales must state concrete
    technical or scope trade-offs and must not attribute a rejection to a maintainer without
    linking their issue, discussion, or PR." One interpretive step is not a factual claim: the
    reviewer treats the document's author (line 3) as a "maintainer" in the rule's sense.
-   **Also raised by `egm-design` (design-8, Nit, partly confirmed):** Alternatives hygiene: a
    wrong attribution, a con that does not distinguish, a circular rationale, and self-links for
    "Rejected by author". Four points. (1) Alternative A is attributed to "the brainstorm
    review", but the brief records the session hand-over as "Rejected by author"
    (learner-main-page-improvements.md 240-241). (2) Alternative C's second con, that a rejected
    applicant never gets the prompt, applies equally to the chosen rule, which hides the banner
    from owners "at any status" (179-181), so it does not distinguish the two. (3) Alternatives
    C and D lean on "the brief's rule is owners only", but the brief left this open as Question
    6 (315-316), so that half of the rationale is circular. (4) The "Rejected by author" links
    point to this document's own decision list, which holds no rationale or discussion record;
    the standard asks that a rejection attributed to a maintainer link to an issue, discussion
    or PR. Its recommendation: The reviewer gave no explicit recommendation. Implied: attribute
    Alternative A to the author; drop or reword Alternative C's second con; stop citing the
    brief as having settled "owners only"; and link the author's rejections to a record of the
    decision.

### structural-2. The new sign-in catalog area is called `auth` in the specification and `portalAuth` in the implementation plan - Severity: Major

-   **Reviewer Lens:** `egm-structural`
-   **Affected Scope:** Lines 269 (Technical Plan, "Teach's sign-in step in the visitor's
    language") and 505-506 (Additional Resources), against the Detailed Implementation Plan in
    the same file at lines 581-609, 628, 642, 651-652, 826. All line numbers are correct.
-   **Discrepancy Description:** The specification names the new sign-in catalog area `auth`
    (lines 269 and 505). The Detailed Implementation Plan in the same file names it `portalAuth`
    throughout: for the files, the keys, the `blurbKey` values and the parity test. A reader
    gets two names for one thing depending on which half they read.
-   **Rationale & Recommendation:** The reviewer gave no explicit wording. The implied fix is to
    use one name in both halves, that is, change `auth` at lines 269 and 505 to `portalAuth` (or
    the reverse).
-   **Check (confirmed):** docs/designs/learner-teach-banner.md:269 "to the catalog, in a new
    `auth` area"; :505 "the catalog patterns the new `auth` and". Plan: :581
    "`packages/i18n/src/messages/areas/portalAuth.en.ts` and `portalAuth.zh.ts`"; :585, :589,
    :593, :597-598 keys `portalAuth.signIn.*`, `portalAuth.code.*`, `portalAuth.verify.*`,
    `portalAuth.blurb.teach`/`.support`; :609 "Add the `portalAuth` area to
    `enAreas`/`zhAreas`"; :628 "`t()` with a `portalAuth` key"; :642 "`portalAuth.verify` key";
    :651-652 `blurbKey="portalAuth.blurb.teach"` and `blurbKey="portalAuth.blurb.support"`; :826
    "the i18n parity test for `portalAuth` and `learnerTeach`". No `auth` or `portalAuth` area
    exists yet in packages/i18n/src/messages/areas/, so neither name is fixed by the code.
-   **Also raised by `egm-design` (design-9, Nit, confirmed):** Catalog area names disagree:
    `auth` in the spec, `portalAuth` in the plan; the learner area is not named in the
    architecture. The spec names the new sign-in area `auth`; the implementation plan uses
    `portalAuth` (lines 609, 628). The `learnerTeach` area appears first in Additional Resources
    (506); the architecture never says where the banner and `/teach` strings live. Its
    recommendation: Use one name, and state the learner area under "The banner".

### style-1. "Support's portal is the only app that knows TEACH_URL" is too broad - Severity: Major

-   **Reviewer Lens:** `egm-style`
-   **Affected Scope:** Lines 39-41 (the sentence is on 39-40), The Problem, bullet "Learners
    can't find Teach"
-   **Discrepancy Description:** The document says "Support's portal is the only app that knows
    `TEACH_URL` (`VITE_TEACH_URL`)". The reviewer calls this uncalibrated: the API also reads
    `env.TEACH_URL` (`apps/api/src/services/media.service.ts:56`), and the brief's wording is
    narrower and correct: "Only the Support portal reads `VITE_TEACH_URL`".
-   **Rationale & Recommendation:** CALIBRATE to "Support is the only client app that reads
    Teach's address (`VITE_TEACH_URL`)".
-   **Check (confirmed):** Target 39-40: "Support's portal is the only app that knows
    `TEACH_URL` (`VITE_TEACH_URL`)". apps/api/src/services/media.service.ts:56: `corsOrigin:
    env.isProd ? env.TEACH_URL : '*'`. The API reads it in many more places too, e.g.
    apps/api/src/env.ts:16 (`TEACH_URL: z.string().url()...`), apps/api/src/app.ts:25,
    apps/api/src/services/auth.service.ts:39, members.service.ts:267. Only client reader of
    VITE_TEACH_URL: apps/support/src/lib/urls.ts:6. Brief
    docs/designs/learner-main-page-improvements.md:102: "Only the Support portal reads
    `VITE_TEACH_URL`."

### style-2. "already read `?lang`" states planned behaviour as existing - Severity: Major

-   **Reviewer Lens:** `egm-style`
-   **Affected Scope:** Lines 290-291, Counting arrivals ("Keeping the marker in Teach"); same
    tense problem at lines 33-34 (Overview) and line 324 (Records and rules)
-   **Discrepancy Description:** The document says "The Teach and Support `preferences-init.js`
    copies already read `?lang` (the Chinese design's PR 4)." The reviewer says "already" states
    existing behaviour, but `apps/teach/public/preferences-init.js` reads only stored
    preferences today and the Chinese design is Status: Proposed. Lines 22-23 use "already" for
    code that does exist, so a reader cannot tell shipped from planned. Same problem at lines
    33-34 ("which resolves the language and adds the `?lang` hand-off") and line 324 ("is
    already covered by the Chinese design's whole-learner-app rule").
-   **Rationale & Recommendation:** CALIBRATE to "will read `?lang` once the Chinese design's PR
    4 lands".
-   **Check (confirmed):** Target 290-291, 33-34 and 324 read as quoted.
    apps/teach/public/preferences-init.js:11-15 reads only
    `localStorage.getItem('elevate.preferences')` and sets theme and `root.lang`; there is no
    `location.search` or `lang` parameter handling. docs/designs/learner-chinese.md:4 "Status:
    Proposed"; its PR 4 is "the Teach and Support `?lang` hand-off" (learner-chinese.md:817,
    1609) and its AGENTS.md rule is planned (learner-chinese.md:547-548). Target 22-23 "Teach's
    own router already sends a signed-out visitor to sign-in" describes existing code
    (apps/teach/src/router.tsx:41-48).

### style-3. "profile -> portal" outruns what HomeRedirect and ProfileGate do - Severity: Major

-   **Reviewer Lens:** `egm-style`
-   **Affected Scope:** Lines 81 (Goal 3), 214 (Data flow), 335 (Risks table, "Owners who are
    signed out see it"); also 24-25 (Overview item 3)
-   **Discrepancy Description:** The document says "signed in to Teach with a profile: the
    portal", "profile -> portal" and "pressing through takes an owner into their portal" (and at
    24-25 "an existing teacher into the portal"). The reviewer says this outruns the cited code:
    `HomeRedirect` sends any profile holder to `/p/:profileId`, and `ProfileGate`
    (`gate.tsx:40-59`) shows `PendingPage` or the application for a profile that is not
    approved, and the set-up steps for a company without an active payout account. CUJ 3 (lines
    139-140) names an `applied` owner, who would not land in the portal.
-   **Rationale & Recommendation:** CALIBRATE to "the profile's page: the portal if approved,
    otherwise its application status".
-   **Check (confirmed):** Target 81, 214, 335, 24-25 read as quoted; 139-140 name owners of an
    `approved` and an `applied` profile. apps/teach/src/routes/gate.tsx:22-26: target is
    last-used profile, else first approved, else `profiles[0]`, then `Navigate to={target ?
    profilePath(target.id) : '/start'}`. gate.tsx:53-58: `TeachLayout` only when `approved &&
    !settingUp`; otherwise `OnboardingLayout` with `PendingPage` (or the company application at
    `/apply`); `settingUp = company && !!profile && !profile.payout?.activated`.
    router.tsx:62-69 mounts `ProfileGate` on `p/:profileId`. Note: CUJ 3 itself only asserts the
    banner is hidden; that the `applied` owner would not reach the portal is the reviewer's
    (correct) inference from gate.tsx.

### style-4. In-app browser storage claim is stated without source and is the sole reason for rejecting Alternative M - Severity: Major

-   **Reviewer Lens:** `egm-style`
-   **Affected Scope:** Lines 252-254 (The `/teach` screen, "The button", native) and 492-495
    (Alternative M)
-   **Discrepancy Description:** The document says "it opens in the default browser, where a
    Teach session lasts" and "The in-app browser's storage is separate from the default
    browser's". The reviewer says this is a platform claim stated without a source or a test,
    and it is the only reason given for rejecting Alternative M. The reviewer did not test it
    either, but believes it holds for iOS (`SFSafariViewController`) and not generally for
    Android, where Custom Tabs share the browser's storage.
-   **Rationale & Recommendation:** CALIBRATE to the platforms where it was checked, and cite
    the check or the platform documentation.
-   **Check (confirmed):** Target 252-254 and 492-495 read as quoted; no source or test is cited
    anywhere in the file for the claim (the only mentions of in-app/default browser are lines
    83, 134, 252-253, 486-495). Alternative M's only Con (492-493) and its Reason for Rejection
    (494-495, "the sign-in has to last in their own browser") both rest on it. External check:
    Expo WebBrowser docs (docs.expo.dev/versions/latest/sdk/webbrowser) say "On iOS, the modal
    Safari will not share cookies with the system Safari" and "As of iOS 11,
    `SFSafariViewController` no longer shares cookies with Safari"; they say nothing of the kind
    for Android. Chrome's Custom Tabs docs (developer.chrome.com/docs/android/custom-tabs) say
    "Shared cookie jar and permissions model so users don't have to sign-in". So the blanket
    claim holds for iOS and not for Android Custom Tabs, as the reviewer suspected.

### style-6. The picker mitigation for Support's Chinese code email implies a picker on the sign-in page - Severity: Major

-   **Reviewer Lens:** `egm-style`
-   **Affected Scope:** Lines 277 (Teach's sign-in step, "Both portals get this"), 339 (Risks
    table, "Support staff get Chinese sign-in emails"), 484 (Alternative L, reason for
    rejection)
-   **Discrepancy Description:** The document says "Support staff can switch language", "its
    picker switches language" and "a Support agent can choose English in the picker". The
    reviewer says the mitigation implies a picker at the point where the Chinese code email is
    triggered, but `SignInPage` (`packages/web-ui/src/portal/SignInPage.tsx`) carries no
    `PreferencesButton` and the range adds none. The picker is reachable only after sign-in, so
    the first code email still follows the browser.
-   **Rationale & Recommendation:** CALIBRATE by naming where the picker is and stating that the
    first code email follows the browser language.
-   **Check (confirmed):** Target 277, 339, 484 read as quoted.
    packages/web-ui/src/portal/SignInPage.tsx:1-163 imports and renders no `PreferencesButton`
    or `PreferencesCard`. `PreferencesButton` is used only in apps/teach/src/routes/gate.tsx:76
    and apps/teach/src/routes/invitation.tsx:71. Support's picker is `PreferencesCard` at
    apps/support/src/routes/settings.tsx:17, a route inside `RequireAuth`
    (apps/support/src/router.tsx:33-50). The words "picker" and "PreferencesButton" occur in the
    whole target file only at lines 339 and 484, so nothing adds one to the sign-in page. Target
    278 sends the resolved `locale` with the sign-in request, and the Chinese design resolves an
    unchosen language from `navigator.languages` (learner-chinese.md:497-500), so a first
    sign-in follows the browser.

### style-7. Goal 6 "easy to remove ... one change" contradicts the rollback section - Severity: Major

-   **Reviewer Lens:** `egm-style`
-   **Affected Scope:** Lines 88-89 (Goal 6), against line 344 (Rollout and rollback)
-   **Discrepancy Description:** The document says "The banner is easy to remove. Turning it off
    is one change in the learner app". The reviewer says "easy" is a subjective judgment and
    "one change" contradicts the rollback section: a web revert plus a native store build.
    Installed native builds keep the banner until users update.
-   **Rationale & Recommendation:** CALIBRATE the goal to the line-344 wording and drop "easy".
-   **Check (confirmed):** Target 88-89: "**The banner is easy to remove.** Turning it off is
    one change in the learner app, and nothing in Teach depends on it." Target 344: "**Turning
    the banner off** is a revert of PR 2 on the web, and a store build on native." Target 317:
    "The banner ships in the next store build after PR 2. Web ships on deploy." That installed
    builds keep the banner until updated is an inference from 317 and 344 (the brief leaves
    over-the-air updates open, learner-main-page-improvements.md:335).
-   **Also raised by `egm-design` (design-7, Nit, confirmed):** Removal and configuration: "easy
    to remove" is not true on native, the URL fallback fails silently, and "both `eas.json`
    build profiles" is loose. Three points. (1) Goal 6 says the banner is "easy to remove", but
    on native that is a store build, and installed builds keep the banner and a baked-in
    `EXPO_PUBLIC_TEACH_URL` indefinitely. (2) `teachUrl()` falls back to port 5173 on the dev
    host when the variable is missing, so a production build with the variable missing ships a
    dead link silently. (3) "Both `eas.json` build profiles" is loose: there are three, and
    `development` has no env block. Its recommendation: (1) Limit Goal 6 to web, or name the
    native cost in the goal. (2) Hide the banner or fail the build when the variable is missing,
    instead of falling back. (3) Name the profiles precisely.

### style-8. "every potential teacher ... is lost" is an absolute claim with no data - Severity: Major

-   **Reviewer Lens:** `egm-style`
-   **Affected Scope:** Lines 56-57, The Problem, "What it costs"
-   **Discrepancy Description:** The document says "every potential teacher who reaches Elevate
    as a learner is lost unless Elevate contacts them some other way. There is no measure of how
    many there are." The reviewer calls this an absolute, unprovable claim, and notes the next
    sentence concedes there is no data.
-   **Rationale & Recommendation:** CALIBRATE to the verifiable fact, for example "a learner who
    might teach has no path from the learner app to Teach, and nothing counts such learners".
-   **Check (confirmed):** Target 56-57 reads exactly as quoted, including "There is no measure
    of how many there are." Whether "every ... is lost" is too absolute is a wording judgement;
    the quoted text and the concession are as the reviewer states.

### design-5. Owner detection is stale: the learner session reads `/me` on mount, and an offline failure shows the banner to an owner - Severity: Nit

-   **Reviewer Lens:** `egm-design`
-   **Affected Scope:** Lines 75-76 (Goal 2), 222-227 (The banner, "When it shows"). The
    reviewer's line numbers are correct.
-   **Discrepancy Description:** Goal 2 is stated without limits, but the learner session calls
    `/me` only on mount (apps/learner/src/lib/session.tsx lines 57-59). A learner who applies in
    Teach and returns keeps seeing the banner until a cold start or reload; a native app can
    stay in memory for days. When `/me` fails offline, the status is `signed_in` with `user`
    null (session.tsx 50-53), so the rule shows the banner to an owner.
-   **Rationale & Recommendation:** State the staleness as accepted, or call `refreshUser()`
    when the app returns to the foreground and hide the banner when signed in with no user.
-   **Check (confirmed):** learner-teach-banner.md:75-76 states Goal 2 with no limit. Line 225
    gives the rule `user?.profiles.some((p) => p.role === 'owner')`, which is falsy when `user`
    is null. apps/learner/src/lib/session.tsx:57-59: `useEffect(() => { void refreshUser() },
    [refreshUser])`, the only automatic call. session.tsx:50-53: on a non-401 failure,
    `setStatus('signed_in')` with the comment "Offline or API down: keep the session" and `user`
    left null. One small correction to "only on mount": `refreshUser()` is also called at
    apps/learner/src/app/(tabs)/profile.tsx:29 after a Profile save, and `signIn` sets the user
    at session.tsx:61-65. Nothing refreshes on return to the foreground (no `AppState` use under
    apps/learner/src).

### design-6. Goal 4 is unconditional, but `?lang` is ignored when Teach has a stored language and API error sentences stay English - Severity: Nit

-   **Reviewer Lens:** `egm-design`
-   **Affected Scope:** Lines 84-85 (Goal 4), 204 (Data flow). Also relevant: 272-273 (API
    messages stay English). The reviewer's line numbers are correct.
-   **Discrepancy Description:** `?lang` is stored only when Teach has no stored language (line
    204; learner-chinese.md 238-239 and 1617). A browser with a stored Teach `en`, or a learner
    who changes language after their first hand-off, gets the old language. Goal 4 also lists
    "its error sentences", but the usual code-step failures (wrong code, expired code, rate
    limit) are API messages that stay English (272-273).
-   **Rationale & Recommendation:** Qualify Goal 4 on both points.
-   **Check (confirmed):** learner-teach-banner.md:84-85: "With the learner app in Chinese, the
    Teach sign-in page, its error sentences, the sign-in code email and the start page are in
    Chinese." Line 204: "store lang (if nothing stored)".
    docs/designs/learner-chinese.md:238-239: "Opening `TEACH_URL/?lang=en` afterwards changes
    nothing, because a language is now stored"; :1617 stores only "when ... the stored `locale`
    is not `en` or `zh`". learner-teach-banner.md:272-273: "API messages stay English, as ADR
    008 sets out." packages/web-ui/src/preferences/errors.ts:6-8: "The server's message is shown
    as it is (the API answers in English)". apps/api/src/services/auth.service.ts:105-136 words
    `link_invalid`, `link_expired` and `code_invalid` on the server in English.

### design-10. Open Question 1 has no merge gate - Severity: Nit

-   **Reviewer Lens:** `egm-design`
-   **Affected Scope:** Lines 108-110 (Open Questions, Question 1), 336 (Risks table, "The
    Chinese text is wrong"). The reviewer's line numbers are correct.
-   **Discrepancy Description:** The risk "The Chinese text is wrong" is mitigated only by
    naming a reviewer who is not yet chosen. The sibling design makes sign-off a merge condition
    (learner-chinese.md 556).
-   **Rationale & Recommendation:** State the same gate for PR 1 and PR 2 here.
-   **Check (confirmed):** learner-teach-banner.md:336 gives the whole mitigation as "The same
    reviewer as the Chinese design (Question 1)". Lines 108-110 ask "who writes and checks the
    Chinese text...?", still open. The word "sign-off" does not appear in the file; line 602
    says only "The Chinese text is written by a person" and line 779 "reviewed with the
    Chinese". docs/designs/learner-chinese.md:556: "PR 2 and PR 3 don't merge without that
    reviewer's sign-off."

### design-11. No risk row for depending on a design that is still Proposed - Severity: Nit

-   **Reviewer Lens:** `egm-design`
-   **Affected Scope:** Lines 173-175 (Terms, "The Chinese design"), 280-281 (the code email),
    309-311 (Order of release), 321-322 (Records and rules). The reviewer's line numbers are
    correct.
-   **Discrepancy Description:** This design needs four pull requests of a design still marked
    Proposed. It reverses one of that design's statements ("Teach and Support send no `locale`")
    and edits an ADR 010 that does not exist yet. There is no risk row for the Chinese design
    changing or slipping, for example in `?lang` precedence or the init-script shape.
-   **Rationale & Recommendation:** Add a risk row, or pin the exact behaviours relied on.
-   **Check (confirmed):** docs/designs/learner-chinese.md:4: "Status: Proposed".
    learner-teach-banner.md:309-311: "This design needs its PR 1 ..., PR 2 ..., PR 3 ... and PR
    4". Lines 280-281: "This changes the Chinese design's 'Teach and Support send no `locale`':
    that sentence is amended when this design lands." The sentence as written in
    learner-chinese.md:420-421 is "Teach and Support send none, so their links carry no `lang`"
    (line 675 of the target quotes it exactly). Lines 321-322: "ADR 010 (added by the Chinese
    design) gains a line". `docs/adr/` holds 001 to 009 only, so ADR 010 does not exist. The
    Risks table (330-339) has no row about the Chinese design changing or slipping.

### design-12. Phone visitors are sent to a web portal with no statement that Teach works at phone width - Severity: Nit

-   **Reviewer Lens:** `egm-design`
-   **Affected Scope:** Lines 83 (Goal 3, native), 129-135 (CUJ 2), 252-254 (the `/teach` button
    on native). The reviewer's line numbers are correct.
-   **Discrepancy Description:** CUJ 2 sends phone users, whom the brief expects to be most
    learners, into Teach in a mobile browser. The design does not say whether Teach's sign-in,
    start and application pages work at phone width, or whether `/teach` should tell native
    visitors to continue on a computer. The reviewer states they did not test Teach at phone
    width.
-   **Rationale & Recommendation:** State the assumption, or add a risk row.
-   **Check (confirmed):** learner-teach-banner.md:83: "On native the link opens in the system
    browser, because Teach is web-only." Lines 129-135 (CUJ 2): "Teach opens in the phone's
    default browser". Lines 252-254: `Linking.openURL` on native.
    docs/designs/learner-main-page-improvements.md:126-127: "most learners are likely on
    phones". A search of the target for "phone width", "responsive" and "narrow" finds nothing,
    the Risks table (330-339) has no such row, and the `/teach` content list (240-246) has no
    note about continuing on a computer. Whether Teach is actually usable at phone width was not
    tested by the reviewer or by me; the confirmed claim is the document's silence.

### structural-3. Alternative A's rejection label disagrees with the brief it links to - Severity: Nit

-   **Reviewer Lens:** `egm-structural`
-   **Affected Scope:** Lines 360-362 (Alternatives Considered, Alternative A). Line numbers are
    correct.
-   **Discrepancy Description:** Line 360 says the session hand-over was "Rejected in the
    brainstorm review" and links the brief's Alternatives Weighed section. That section records
    it as "Rejected by author in favour of a plain link" (brief line 240). Alternative B's
    identical wording (line 370) does match the brief ("Rejected in review", brief line 234).
    Lines 64 and 93 ("the brief rejected it", "Rejected in the brief") are accurate; only the
    label at line 360 disagrees with its linked source.
-   **Rationale & Recommendation:** The reviewer gave no explicit wording. The implied fix is to
    make line 360's label match the brief, which records the hand-over as rejected by the
    author, not in review.
-   **Check (confirmed):** docs/designs/learner-teach-banner.md:360-361 "**Reason for
    Rejection**: Rejected in the brainstorm review (`[the brief](learner-main-page-improvements.md#alternatives-weighed)`)".
    docs/designs/learner-main-page-improvements.md:240-241 "**A session hand-over that signs a
    learner in to Teach.** Rejected by author in favour of a plain link: it would need a new
    one-time code exchange and its own security design." For Alternative B: target :370
    "Rejected in the brainstorm review" and brief :234 "**Pre-filling the Teach sign-in with
    `?email=`.** Rejected in review". Target :64 "the brief rejected it" and :93 "Rejected in
    the brief" are as quoted.
-   **Also raised by `egm-style` (style-10, Nit, confirmed):** Alternative A's attribution and
    reason differ from the brief. The document says "Rejected in the brainstorm review ... the
    security design costs more than the one sign-in it saves, while the pilot is small." The
    reviewer says the brief records the session hand-over as "Rejected by author", not in
    review, and that its stated reason is only the code exchange and security design; the cost
    comparison and the pilot-size clause are not in the brief. Lines 64 and 93 ("the brief
    rejected it") are accurate. Its recommendation: CALIBRATE the attribution and reason to the
    brief's text.

### structural-4. The `learnerTeach` catalog area is first named in the resources list, not in the architecture - Severity: Nit

-   **Reviewer Lens:** `egm-structural`
-   **Affected Scope:** Lines 505-506 (Additional Resources), against lines 217-256 (Technical
    Plan, "The banner" and "The `/teach` screen"). Line numbers are correct.
-   **Discrepancy Description:** The `learnerTeach` catalog area first appears in the resources
    list as "the new ... `learnerTeach` areas". Neither "The banner" (lines 217-234) nor "The
    `/teach` screen" (lines 236-256) says the learner text goes into a new area. A term is
    introduced in a reference list rather than in the architecture section.
-   **Rationale & Recommendation:** The reviewer gave no explicit wording. The implied fix is to
    name the new `learnerTeach` area in the Technical Plan ("The banner" or "The `/teach`
    screen") before the resources list refers to it.
-   **Check (confirmed):** A search of docs/designs/learner-teach-banner.md for `learnerTeach`
    gives its first hit at :506 ("`learnerTeach` areas follow."); the next hits are in the
    implementation plan at :729, :749, :752, :768, :772, :775, :826. Lines 217-256 never mention
    a catalog area. The only nearby reference to learner translation is :323-324, "The `/teach`
    screen is already covered by the Chinese design's whole-learner-app rule", which does not
    name the area.

### structural-5. Alternatives K, L and M give a bare reason while A-J open with an attribution and a link - Severity: Nit

-   **Reviewer Lens:** `egm-structural`
-   **Affected Scope:** Lines 473-474, 483-484, 494-495 (Alternatives Considered, Alternatives
    K, L, M); counterparts at lines 276-277 and 252-254 (Technical Plan). Line numbers are
    correct.
-   **Discrepancy Description:** Alternatives A-J open "Reason for Rejection" with an
    attribution and a link; K, L and M give a bare reason. These three comply with the standard,
    but the block is asymmetric. L and M also reject options whose chosen counterparts
    (translating Support at lines 276-277, `Linking.openURL` at lines 252-254) are decided only
    in body text, not in the numbered "Decisions made while drafting" list that C-J cite.
-   **Rationale & Recommendation:** The reviewer gave no explicit wording. The implied fix is to
    make the block consistent, for example by adding the Support-translation and
    `Linking.openURL` choices to the numbered decision list, or by using the bare-reason form
    throughout.
-   **Check (confirmed):** docs/designs/learner-teach-banner.md:473 "**Reason for Rejection**:
    Appending `&from` to the emailed link gives the same coverage"; :483 "**Reason for
    Rejection**: A translated shared page is simpler than a switch"; :494 "**Reason for
    Rejection**: Teach is a portal people return to". None has an attribution or link. A and B
    (:360, :370) open "Rejected in the brainstorm review (`[the brief](...)`)"; C-J open "Rejected
    by author (`[drafting decision N](...)`)". The chosen counterparts are at :276-277 ("**Both
    portals get this.** Support's sign-in uses the same two pages, so it is translated too.")
    and :252-254 ("**native:** with `Linking.openURL`"); the numbered list at :179-190 has five
    items and covers neither. Whether the asymmetry matters is a style opinion; the facts hold.

### structural-6. Alternative G bundles two alternatives under one heading - Severity: Nit

-   **Reviewer Lens:** `egm-structural`
-   **Affected Scope:** Lines 421-432 (Alternatives Considered, Alternative G). Line numbers are
    correct.
-   **Discrepancy Description:** One heading bundles two alternatives (above "Load more", and
    inside the grid) with bolded sub-labels inside Pros and Cons. Every other alternative in the
    target is one option per heading.
-   **Rationale & Recommendation:** The reviewer gave no explicit wording. The implied fix is to
    split Alternative G into two alternatives, one per position.
-   **Check (confirmed):** docs/designs/learner-teach-banner.md:421 "### Alternative G: Put the
    banner above "Load more", or inside the grid"; :424-425 Pros with "**Above "Load more":**"
    and "**Inside the grid,**"; :427-428 Cons with the same two sub-labels; :430-432 one shared
    Reason for Rejection. Headings at :351, :364, :374, :386, :398, :408, :434, :444, :455,
    :466, :476, :486 each name a single option.

### structural-7. A quoted sentence from the Chinese design is not verbatim - Severity: Nit

-   **Reviewer Lens:** `egm-structural`
-   **Affected Scope:** Lines 280-281 (Technical Plan, "Teach's sign-in step in the visitor's
    language", the code email bullet). Line numbers are correct.
-   **Discrepancy Description:** The text puts the Chinese design's sentence in quotation marks
    as "Teach and Support send no `locale`". The actual sentence (learner-chinese.md line 420)
    reads "Teach and Support send none, so their ...", and this document's own plan quotes it
    correctly at line 675. A quoted string should be verbatim so the amendment target can be
    found.
-   **Rationale & Recommendation:** Quote the sentence verbatim, as line 675 does: "Teach and
    Support send none, so their links carry no `lang`".
-   **Check (confirmed):** docs/designs/learner-teach-banner.md:280-281 "This changes the
    Chinese design's "Teach and Support send no `locale`": that sentence is amended when this
    design lands." docs/designs/learner-chinese.md:420-421 "Teach and Support send none, so
    their links carry no `lang`." A search of learner-chinese.md for "send no" finds only :571
    ("Older native builds send no `locale`"), which is a different sentence. Target :675-676
    quotes "Teach and Support send none, so their links carry no `lang`".
-   **Also raised by `egm-style` (style-16, Nit, confirmed):** The quoted sentence is not the
    Chinese design's text. The document puts "Teach and Support send no `locale`" in quotation
    marks as the Chinese design's sentence. The reviewer says that is not the Chinese design's
    text, which is "Teach and Support send none, so their links carry no `lang`"
    (`learner-chinese.md:420-421`). Its recommendation: Quote exactly or remove the quotation
    marks.

### structural-8. "PR 1" to "PR 4" refer to two different designs' pull requests without saying which - Severity: Nit

-   **Reviewer Lens:** `egm-structural`
-   **Affected Scope:** Lines 291 and 309-311 (the Chinese design's pull requests) against lines
    312-317 (Technical Plan, "Order of release") and 344, 346 (Risks & Mitigations, "Rollout and
    rollback"). Correction: this design's two pull requests are introduced at line 312 as a
    numbered list (items at 313-316); the literal strings "PR 1" and "PR 2" for this design
    first appear at 317, 344 and 346.
-   **Discrepancy Description:** "PR 1" to "PR 4" label the Chinese design's pull requests at
    lines 291 and 309-311, and "PR 1"/"PR 2" label this design's own at lines 313-317. The bare
    "PR 2" at lines 317 and 344 and "PR 1" at line 346 sit a few lines below "its PR 1 ... PR 2
    ... PR 3 ... PR 4" with nothing to say which design they belong to.
-   **Rationale & Recommendation:** The reviewer gave no explicit wording. The implied fix is to
    qualify the bare labels, for example "this design's PR 2", or to name the two pull requests
    differently from the Chinese design's.
-   **Check (confirmed):** docs/designs/learner-teach-banner.md:291 "(the Chinese design's PR
    4)"; :309-311 "This design needs its PR 1 (...), PR 2 (...), PR 3 (...) and PR 4 (...)";
    :312-316 "**Two pull requests:** 1. **Teach's sign-in step:** ... 2. **The learner app:**
    ..."; :317 "The banner ships in the next store build after PR 2."; :344 "a revert of PR 2 on
    the web"; :346 "**Reverting PR 1** puts Teach's sign-in back in English". None of 317, 344,
    346 carries a qualifier. Two small inaccuracies in the report that do not change the gap:
    the list at 313-316 is numbered "1."/"2." and does not itself use the words "PR 1"/"PR 2";
    and only line 317 is "a few lines below" 309-311, while 344 and 346 are about 35 lines
    below, in another section.

### structural-9. Two blank lines before `## Open Questions` - Severity: Nit

-   **Reviewer Lens:** `egm-structural`
-   **Affected Scope:** Lines 104-105, before `## Open Questions` at line 106. Line numbers are
    correct.
-   **Discrepancy Description:** Two blank lines precede `## Open Questions`; every other H2 in
    the range has one.
-   **Rationale & Recommendation:** The reviewer gave no explicit wording. The implied fix is to
    delete one of the two blank lines at 104-105.
-   **Check (confirmed):** docs/designs/learner-teach-banner.md:103 ends the Non-Goals list,
    :104 and :105 are both empty, :106 is "## Open Questions". A count of blank lines before
    each H2 in lines 1-519 gives 1 for the headings at 9, 36, 70, 91, 115, 159, 326, 349, 499
    and 510, and 2 only for the heading at 106.

### structural-10. Run-in bold labels in the Technical Plan lists use mixed punctuation - Severity: Nit

-   **Reviewer Lens:** `egm-structural`
-   **Affected Scope:** Run-in bold labels in the Technical Plan lists, for example lines
    219-230, 238-255, 268-282, 287-303. Line numbers are correct.
-   **Discrepancy Description:** Label punctuation is mixed inside single lists: colon
    ("**Where:**", "**What it holds:**", "**The route:**"), period ("**When it shows.**",
    "**Dismissal.**", "**Contracts.**"), comma ("**What it says,**"), and none ("**The button**
    opens"). The first four items of "The banner" (lines 219-230) alternate colon and period.
-   **Rationale & Recommendation:** The reviewer gave no explicit wording. The implied fix is to
    use one label punctuation style within each list.
-   **Check (confirmed):** docs/designs/learner-teach-banner.md:219 "**Where:**", :222 "**When
    it shows.**", :228 "**What it holds:**", :230 "**Dismissal.**" (colon, period, colon, period
    in one list). :238 "**The route:**", :240 "**What it says,**", :250 "**The button** opens",
    :255 "**`teachUrl()`** joins". :268 "**The text.**", :276 "**Both portals get this.**", :278
    "**The code email.**", :282 "**Verify is unchanged for the language.**" (this list is all
    periods). :287 "**Contracts.**", :290 "**Keeping the marker in Teach.**", :296 "**Sending
    it.**", :299 "**On the server:**", :303 "**The count:**". So the mix holds for the lists at
    219-230, 238-255 and 287-303; the 268-282 list is consistent on its own and differs only
    from its neighbours.

### style-9. "never shows there again" / "for good" are absolutes the document contradicts - Severity: Nit

-   **Reviewer Lens:** `egm-style`
-   **Affected Scope:** Lines 186-187 (Decisions made while drafting, decision 4), 334 (Risks
    table, "A dismissed visitor can't find Teach again"), 149 (CUJ 4)
-   **Discrepancy Description:** The document says "the banner never shows there again", "hides
    the banner on that device for good" and "The banner is gone on that device". The reviewer
    says these are absolutes that lines 233-234 contradict (a failed write hides it only "for
    the rest of the run"). Cleared storage or a reinstall also restores it.
-   **Rationale & Recommendation:** CALIBRATE to "until that device's storage is cleared".
-   **Check (confirmed):** Target 186-187: "A close button stores a flag on the device, and the
    banner never shows there again." Target 334: "The flag hides the banner on that device for
    good." Target 149: "The banner is gone on that device, signed in or out." Target 233-234: "A
    failed write is ignored, and the banner is hidden for the rest of the run either way."
    Target 230-232 stores the flag in `localStorage` / AsyncStorage, which clearing site data or
    reinstalling removes.

### style-11. Citing "the brief's owners-only rule" is circular - Severity: Nit

-   **Reviewer Lens:** `egm-style`
-   **Affected Scope:** Lines 383 (Alternative C, reason for rejection), 393 (Alternative D,
    cons), 396 (Alternative D, reason for rejection)
-   **Discrepancy Description:** The document says "the brief's rule is owners only", "unlike
    the brief's rule" and "the brief's owners-only rule". The reviewer says the brief decides
    that owners don't see the banner but leaves "owners only, or any member?" open as Question
    6, which line 179 says this design answers. Citing the brief as the reason for rejection is
    circular.
-   **Rationale & Recommendation:** CALIBRATE to "drafting decision 1".
-   **Check (confirmed):** Target 383, 393, 396 read as quoted. Brief
    learner-main-page-improvements.md:254-255: "Owners of a teaching profile don't see it."
    (also 24, 197). Brief 315-316, Question 6: "**Who doesn't see the banner:** owners only, or
    any member? What about applicants, rejected applicants and staff?" Target 179: "**Hidden
    from owners only** (the brief's Question 6)"; target 112-113 says the brief's Question 6 is
    answered in this design's drafting decisions.

### style-12. "Both earlier designs deferred one" miscounts the earlier designs - Severity: Nit

-   **Reviewer Lens:** `egm-style`
-   **Affected Scope:** Lines 449-450, Alternative I, Cons
-   **Discrepancy Description:** The document says "Both earlier designs deferred one." The
    reviewer says this is the second of four designs (line 31), so there is one earlier design;
    the other document is the brief, which only asks the question.
-   **Rationale & Recommendation:** CALIBRATE to "The Chinese design deferred one".
-   **Check (confirmed):** Target 449-450: "A new unauthenticated endpoint, which needs rate
    limiting and abuse handling. Both earlier designs deferred one." Target 31: "This is the
    second of four separate designs". learner-chinese.md:529: "No client event endpoint is
    added." Brief learner-main-page-improvements.md:333-334 only asks, as Question 14: "Add a
    client event endpoint for card impressions and app-versus-web opens?" (and line 176 notes
    "no endpoint takes events from the app"). No other design in docs/designs
    (teacher-profiles.md, teacher-profiles-brief.md) mentions a client event endpoint.

### style-13. "which covers the usual case" has no evidence - Severity: Nit

-   **Reviewer Lens:** `egm-style`
-   **Affected Scope:** Line 338, Risks table, "The marker is lost across tabs"
-   **Discrepancy Description:** The document says the emailed link carries `&from`, "which
    covers the usual case". The reviewer says no evidence shows which sign-in path is usual.
-   **Rationale & Recommendation:** CALIBRATE to "which covers sign-in through the emailed
    link".
-   **Check (confirmed):** Target 338: "The emailed link carries `&from`, which covers the usual
    case. The rest is an accepted undercount." Nothing in the target says which path (emailed
    link or typed code) is more common. The sign-in page offers both equally:
    packages/web-ui/src/portal/SignInPage.tsx:87-89 "We sent a sign-in link and code to ...
    Click the link, or type the code here."

### style-15. "Staging is reachable only over Tailscale" is a caveat with no decision attached - Severity: Nit

-   **Reviewer Lens:** `egm-style`
-   **Affected Scope:** Lines 166-167, Technical Plan, Terms (definition of Teach)
-   **Discrepancy Description:** The document says "Staging is reachable only over Tailscale."
    The reviewer says it is a caveat with no reader decision attached; it appears once in the
    document, inside a term definition.
-   **Rationale & Recommendation:** RELOCATE to the `eas.json` staging profile at lines 261-262
    or to the verification step, where it affects who can open the link; otherwise DROP.
-   **Check (confirmed):** Target 166-167: "Staging is reachable only over Tailscale." inside
    the "Teach" term bullet. A search of the whole file (all 846 lines) finds "Tailscale" only
    at line 167. Target 261-262 is the `eas.json` bullet with the staging and production URLs.
    Whether the sentence earns its place is a judgement; the placement facts hold.

### style-17. Four labels for Teach's sign-in step, and the lists omit the verify page - Severity: Nit

-   **Reviewer Lens:** `egm-style`
-   **Affected Scope:** Lines 45 (The Problem), 84 (Goal 4), 26-27 (Overview item 4), 97
    (Non-Goals), 266 (section heading)
-   **Discrepancy Description:** The document uses "Teach is English at its door", "Teach's
    door", "the first Teach pages" and "Teach's sign-in step": four labels for one thing, two of
    them figurative. The lists at 26-27 and 84-85 also omit the verify page that line 268
    translates.
-   **Rationale & Recommendation:** Use "Teach's sign-in step" throughout and list its parts
    once.
-   **Check (confirmed):** Target 45: "**Teach is English at its door.**"; 84: "**Teach's door
    is in the visitor's language.**"; 26: "**Makes the first Teach pages a new teacher sees
    match the learner app's language**"; 97: "Translating Teach beyond its sign-in step"; 266:
    "### Teach's sign-in step in the visitor's language". Target 26-27 lists "the sign-in page,
    the sign-in code email and the start page"; 84-85 lists "the Teach sign-in page, its error
    sentences, the sign-in code email and the start page"; neither names the verify page. Target
    268: "`SignInPage` and `VerifyPage` in `@elevate/web-ui/portal` move every sentence to the
    catalog".

### style-18. Meta-commentary, filler and vagueness - Severity: Nit

-   **Reviewer Lens:** `egm-style`
-   **Affected Scope:** Lines 59 (The Problem), 332 (Risks table), 67 (The Problem)
-   **Discrepancy Description:** The reviewer flags "The weak point of the idea, stated up
    front:", "Accepted, as decided." and "a handful of pilot teachers" as meta-commentary,
    filler and vagueness. The heading is singular but introduces three points; "as decided" adds
    nothing; lines 42-43 already give "three to five".
-   **Rationale & Recommendation:** Suggested: "Known weaknesses:", "Accepted.", "three to five
    pilot teachers".
-   **Check (confirmed):** Target 59: "**The weak point of the idea, stated up front:**"
    followed by three bullets (61, 65, 67). Target 332: "Accepted, as decided." Target 67: "With
    a handful of pilot teachers recruited by hand". Target 42-43: "recruit three to five
    teachers directly" (docs/spec.md:77 "recruit 3–5 pilot teachers"). Whether these are filler
    is a style judgement; the quotes and the count of three bullets hold.

### style-19. Unmeasured size adjectives ("short", "small", "a few") - Severity: Nit

-   **Reviewer Lens:** `egm-style`
-   **Affected Scope:** Lines 14 (Overview), 20 (Overview item 2), 183 (Decision 2; reviewer
    said 182), 231-232 (The banner, Dismissal; reviewer said 232), 240 (The `/teach` screen),
    405 (Alternative E)
-   **Discrepancy Description:** The reviewer flags "short introduction", "short learner-app
    screen", "a small storage module", "in a few short sections" and "a short screen" as
    unmeasured size adjectives, repeated. Lines 241-246 list exactly four sections.
-   **Rationale & Recommendation:** Say "four sections" and drop "short" and "small" where no
    size is specified.
-   **Check (confirmed):** Target 14 "short introduction"; 20 "a short learner-app screen"; 183
    "`/teach`, a short screen in the learner app" (decision 2 begins on 182, the phrase is on
    183); 231-232 "through a small storage module beside `preferences-storage`"; 240 "in a few
    short sections"; 405 "a short screen inside the app". Target 241-246 lists four bullets: who
    can teach, how it works, the fee, that Teach is a separate site.

### style-20. Subjective or unquantified judgments used as rejection reasons - Severity: Nit

-   **Reviewer Lens:** `egm-style`
-   **Affected Scope:** Lines 43 (The Problem; reviewer said 44), 277 (Teach's sign-in step),
    377 (Alternative C, Pros), 384 (Alternative C, reason), 391-392 (Alternative D, Cons), 403
    (Alternative E, Cons), 441-442 (Alternative H, reason), 452-453 (Alternative I, reason), 483
    (Alternative L, reason)
-   **Discrepancy Description:** The reviewer lists "doesn't grow"; "cheaper than keeping an
    English copy"; "The simplest rule"; "costs little"; "may find the prompt unwelcome"; "Three
    lines may not be enough to persuade"; "a stored flag is cheap"; "reads as an advert"; "the
    numbers that matter"; "simpler than a switch" as subjective or unquantified judgments used
    as rejection reasons. Each needs the concrete cost it stands for (for example, line 482
    already gives it: "a prop that switches translation off, or two copies of each page"), or
    should be dropped.
-   **Rationale & Recommendation:** State the concrete cost behind each phrase, or drop the
    phrase.
-   **Check (partly confirmed):** All ten quotes are in the target: 43 "doesn't grow" (not 44);
    277 "cheaper than keeping an English copy"; 377 "The simplest rule"; 384 "costs little";
    391-392 "may find the prompt unwelcome"; 403 "Three lines may not be enough to persuade";
    441 "a stored flag is cheap"; 442 "reads as an advert"; 452-453 "the numbers that matter";
    483 "simpler than a switch"; 481-482 gives the concrete cost as quoted. What does not hold
    is "used as rejection reasons" for all of them: only 384, 441-442, 452-453 and 483 sit in a
    "Reason for Rejection". Line 43 is a problem statement, 277 is in the technical plan, 377 is
    a Pro of the rejected Alternative C, and 391-392 and 403 are Cons.

### style-21. A con that does not distinguish Alternative C, and an ambiguous "Members are still hidden" - Severity: Nit

-   **Reviewer Lens:** `egm-style`
-   **Affected Scope:** Lines 381 (Alternative C, Cons) and 393 (Alternative D, Cons)
-   **Discrepancy Description:** Line 381 lists "A rejected applicant ... never gets it either"
    as a con of Alternative C, but the chosen rule (lines 179-180, owners "at any status") has
    the same effect for a rejected owner, so it does not distinguish the alternative. Line 393,
    "Members are still hidden", is ambiguous.
-   **Rationale & Recommendation:** Remove or rework the line-381 con; write "The banner is
    still hidden from members" at line 393.
-   **Check (confirmed):** Target 381: "A rejected applicant, whom Teach lets resubmit, never
    gets it either." Target 179-180: "The banner is hidden when any of the user's profiles has
    `role: 'owner'`, at any status." A rejected applicant is the owner of the rejected profile:
    apps/api/src/services/profiles.service.ts:176-177 ("resubmits it while it is still `applied`
    or `rejected`") and 332-333 ("Only the owner of this profile can resubmit its application");
    `ProfileStatus = 'applied' | 'approved' | 'rejected'`
    (packages/core/src/domain/permissions.ts:30). Target 389 (Alternative D's Pro, "Rejected
    applicants still see it") also implies the chosen rule hides them. Target 393: "Members are
    still hidden, unlike the brief's rule."

### style-22. The session hand-over rejection is restated six times; decisions restate later sections - Severity: Nit

-   **Reviewer Lens:** `egm-style`
-   **Affected Scope:** Lines 29 (Overview), 61-64 (The Problem), 93-94 (Non-Goals), 333 (Risks
    table), 351-362 (Alternative A), 515 (Future Improvements); also 179-190 against 217-234 and
    285-305
-   **Discrepancy Description:** The reviewer says the session hand-over rejection and its
    reason are restated six times, and that lines 179-190 also restate lines 217-234 and
    285-305.
-   **Rationale & Recommendation:** State the reason once in Alternative A and link to it from
    the other places.
-   **Check (partly confirmed):** The hand-over is mentioned in all six places, but the
    rejection and its reason are not both restated in each. Reason given (one-time code exchange
    and security design): 63-64, 93-94, and 356-358 with 360-362. Line 29 says only "No session
    is handed over" (no rejection, no reason). Line 333 says "a session hand-over was rejected
    in the brief" (no reason). Line 515 lists it as a future improvement ("if the second sign-in
    turns out to lose many people"), not a rejection. So the reason appears three times, not
    six. The second claim holds: decisions 1, 3 and 4 (179-187) are repeated in "The banner"
    (219-234), and decision 5 (188-190) in "Counting arrivals" (285-305).
