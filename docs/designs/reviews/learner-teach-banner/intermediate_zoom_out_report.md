# Goldfish Review Report: Stage 8 (Intermediate Zoom Out)

**Target:** `docs/designs/learner-teach-banner.md` (full file, lines 1-846)

**Stage:** 8 (Intermediate Zoom Out Review), uninterrupted full flow. **Mode:** REVIEW.

One reviewer, `egm-zoom-out`, ran once in a fresh context against the Zoom-Out Standard. It was
given the Stage 5, 6 and 7 reports and asked one question: for each addition or mitigation those
stages ask for, would a simpler design remove the need for it? The document was not edited between
stages, so finding ids such as Z1, C2 and design-2 refer to `zoom_out_report.md`,
`comprehension_report.md` and `critic_report.md`.

## Reviewer Status

| Reviewer       | Status    | Findings | Checked |
| -------------- | --------- | -------- | ------- |
| `egm-zoom-out` | completed | 9        | yes     |

**Severity breakdown** (findings that stood up to checking): 0 Blocker, 5 Major, 5 Nit. 0 finding(s)
were refuted on checking and are listed at the end.

**How findings were checked:** after each reviewer finished, a separate agent re-read the cited
lines of the document and opened the cited code. Each finding carries that check's verdict and
evidence.

## Prioritized Findings (Blockers -> Major -> Nits)

### IZ1. Delete the arrival marker instead of patching it - Severity: Major

-   **Reviewer Lens:** `egm-zoom-out`
-   **Affected Scope:** Reviewer's lines, all correct for the target as it is now: 86-87 (Goal
    5), 171-172 (Terms), 188-190 (drafting decision 5), 204-212 (Data flow), 285-305 (Counting
    arrivals), 332, 337-338 (Risks), 346-347 (Rollback), 432 (Alternative G), 444-474
    (Alternatives I, J, K), 514-516 (Future Improvements), 540-577 (plan items 1-4), 613-621
    (item 7), 633-635 (item 8), 645 (item 9), 655-664 (item 11), 685-686 (item 13), 829-830,
    839-840 (Verification Plan). Not listed by the reviewer but carrying the same marker: 78
    (Goal 3 link), 126-127 (CUJ 1), 202 (Data flow link), 250 (button URL), 313-314 (Order of
    release, PR 1), 525-527 (plan summary of PR 1), 752-753 (item 19 URL), 807-808 (item 23
    test).
-   **Discrepancy Description:** The reviewer says to delete the arrival marker (`from=learner`,
    `elevate.from`, `source`) and not patch it. Stages 6 and 7 ask to add to it: a metric
    definition (distinct users, first sign-in, `reapply: false`, time order); clearing
    `elevate.from` after verify; `source` on the application request; a way to carry the request
    language to the event; a description of the whole sign-in flow; an explanation of why
    Support's init script stores a marker; two more undercount rows. After all that the pipeline
    still cannot judge the placement, the job lines 332, 432 and 516 give it: it has no
    denominator (design-2a) and `from` is forgeable (line 337). A simpler measure needs nothing
    built: count first applications, `teacher_applied` with `reapply: false`, which exists today
    (apps/api/src/services/profiles.service.ts lines 208-212 and 311-315), and exclude the three
    to five hand-recruited teachers, whose emails Elevate knows (target 42-43; docs/spec.md line
    77). Line 39 says nobody else knows Teach's address. That measure fixes design-2 points
    2c/C19 (visitors already signed in to Teach), 2d (no marker to leave uncleared) and 2e
    (resubmissions). What goes: plan items 1, 2, 3, 7 and 11 whole; the `source` bullets of
    items 4, 8, 9 and 13; risk rows 337 and 338; Terms 171-172; Alternatives I, J and K fold
    into one deferred alternative. The design then makes no API or contract change and its first
    PR is web-ui, i18n and two router files. Limit: exclusion stops working when a second public
    route to Teach exists; an optional request field needs no migration (line 343), so this is
    not a dead end. Weight change: Stage 5 (Z1) left Alternatives K and J level; Stage 7 shows K
    repairs none of design-2 (a) to (e), so J is now the recommendation; Z4 and Z11 fall away.
    Bears on design-2, design-4, style-5, style-13, style-14, C2, C5, C10, C13, C15, C16, C19,
    C21, C22; changes the weight of Z1, Z4, Z7, Z11.
-   **Rationale & Recommendation:** Delete the marker: remove plan items 1, 2, 3, 7 and 11, the
    `source` bullets of items 4, 8, 9 and 13, risk rows 337 and 338 and Terms 171-172; fold
    Alternatives I, J and K into one deferred alternative; make Alternative J (no attribution,
    count first applications and exclude the hand-recruited teachers) the recommendation. Keep
    one addition from design-2: a one-sentence decision rule at 839-840 (when the count is read,
    and what result moves or removes the banner). Reword 332, 432 and 516 so no count is
    presented as a test of the placement (style-5). If the author keeps attribution, every Stage
    7 addition listed is required, and Alternative K is still the smaller form.
-   **Check (partly confirmed):** Holds. Target 332 'The arrival count shows whether it works',
    432 'The arrival count shows whether the place works', 516 'if the arrival count shows few
    people reach it'; 337 'Anyone can add `from=learner` to a Teach link and inflate the count';
    39 'Teach's address is known only to people Elevate tells directly'; 343 'No migration.
    There are no new columns, only optional request fields.'
    apps/api/src/services/profiles.service.ts:208-212
    `name: ANALYTICS_EVENTS.teacherApplied, properties: { reapply: !!existing, profileId }` and
    :311-315 `properties: { reapply: false, profileId, type: 'corporate' }` (resubmission at
    :369 emits `reapply: true`). docs/spec.md:77 'recruit 3-5 pilot teachers'.
    critic_report.md:55-113 (design-2) lists points (a)-(e) and the recommended additions as the
    reviewer restates them; critic_report.md:145-168 (design-4) offers 'carry the request
    language to the event'; comprehension_report.md:133 (C2) and :218 (C5) ask for the sign-in
    flow description and the Support-marker explanation. zoom_out_report.md:27-92 (Z1)
    recommends 'Reconsider Alternative K ... or defer attribution (Alternative J)', so K and J
    were level. Plan items 1 (540-547), 2 (549-557), 3 (559-564), 7 (613-621), 11 (655-664) are
    wholly about `source`/`from`; the `source` bullets of items 4, 8, 9, 13 are at 571-575,
    633-635, 645, 685-686. Inexact. (1) The cut list is incomplete: `from=learner` and `source`
    also appear at target 78, 126-127, 202, 250, 313-314, 525-527, 752-753 and 807-808, which
    the reviewer does not list. (2) 'its first PR is web-ui, i18n and two router files' leaves
    out what else stays in PR 1: item 4's last bullet (576-577, a test in
    apps/api/test/auth.test.ts) and item 12's record edits (668-676: ADR 010, AGENTS.md,
    learner-chinese.md). 'No API or contract change' does hold. (3) 'whose emails Elevate knows'
    is an assumption: neither target 42-43 nor spec.md:77 says so. (4) 'Stage 7 shows K repairs
    none of design-2 (a) to (e)' is the reviewer's inference: critic_report.md never names
    Alternative K or J (grep finds neither). The inference is consistent with target 466-474 (K
    changes only where the server reads the source) but is not something Stage 7 states. Whether
    to cut is a design opinion.

### IZ2. Drop dismissal (Alternative H) instead of adding a way back - Severity: Major

-   **Reviewer Lens:** `egm-zoom-out`
-   **Affected Scope:** Reviewer's lines, all correct: 144-151 (CUJ 4), 186-187 (drafting
    decision 4), 226 (banner rule), 230-234 (Dismissal), 334 (Risks), 434-442 (Alternative H),
    512-513 (Future Improvements), 700-722 (plan items 15-16), 730-732 (item 17 close button),
    774 (`.close` key), 805-806 (item 23 test), 813-817 (item 24 Maestro). Also carrying
    dismissal but not listed: 198 (Data flow 'dismissed here?'), 229 ('and a close button'), 740
    (`onDismiss={dismiss}` in item 18), 833 (walkthrough of CUJ 4).
-   **Discrepancy Description:** The reviewer says to drop dismissal and not add a way back.
    design-1 offers three fixes for the native dead end: a Profile row (a new surface that
    signed-out visitors cannot open), an expiring dismissal (needs a timestamp, a re-show policy
    and tests), or a web-only caveat (records the dead end and keeps it). Each fix exists only
    to undo a feature whose stated purpose (441-442) the bottom-of-list placement already serves
    (184-185, 431-432). What goes: item 15 whole, the async 'flag unread' state, the close
    control and its key, CUJ 4, risk row 334, the Profile future improvement, and the relaunch
    half of item 24. Item 16 becomes a pure rule on the session and `searching`. Weight change:
    at Stage 5 this was a YAGNI judgement (Z2); design-1 turns it into a confirmed defect whose
    every repair adds scope; Z5's collapse-to-link and Z12 are no longer needed. Not a dead end:
    a stored flag can be added later if learners complain. Bears on design-1, style-9, C18;
    changes the weight of Z2, Z5, Z12. The report's closing reuse check adds: no existing
    dismissible banner or dismissal storage exists in the learner app.
-   **Rationale & Recommendation:** Take Alternative H: remove item 15, the 'flag unread' state,
    the close button and its `.close` key, CUJ 4, risk row 334, the Profile future improvement
    and the relaunch half of item 24; make item 16 a pure rule on the session and `searching`.
-   **Check (confirmed):** Target 441-442 'a banner that can't be closed reads as an advert to
    the learners Explore serves'; 184-185 'The banner goes after the whole list ... hidden while
    searching'; 431-432 'so the banner doesn't interrupt the list'; 334 mitigation '`/teach`
    stays open by address. A link from Profile is a future improvement'; 702-710 two storage
    files; 719 'while the flag is unread'; 730-731 close button; 774 `.close` ('Hide this');
    816-817 'tap `teach-banner-close`, relaunch, and assert'. critic_report.md:30-54 (design-1,
    Major, check confirmed) gives exactly the three fixes: Profile row in scope, expiring
    dismissal, or web-only caveat. Profile is closed to signed-out visitors:
    apps/learner/src/app/(tabs)/_layout.tsx
    wraps `learning` and `profile` in `<Tabs.Protected guard={isSignedIn}>`.
    zoom_out_report.md:93 (Z2, Major) is the Stage 5 YAGNI finding; :257 (Z5) and :496 (Z12) are
    as described. Reuse check: `grep -rniE dismiss apps/learner/src` finds only a comment at
    apps/learner/src/components/CertificateCard.tsx:112 about the share sheet, so no dismissible
    banner or dismissal storage exists. The reviewer's cut list does not name target 198 and
    740, which also need to change. Whether one protection is enough is a design opinion.

### IZ3. Narrow Goal 4 instead of adding an error-code-to-key mapping - Severity: Major

-   **Reviewer Lens:** `egm-zoom-out`
-   **Affected Scope:** Reviewer's lines, all correct: 46-47 (The Problem, sign-in page
    'including its error sentences'), 84-85 (Goal 4), 204 (Data flow, 'store lang (if nothing
    stored)'), 272-273 (failure sentences through `useErrorMessage()`), 630-631 (item 8 errors),
    643-644 (item 9 error state), 836-837 (Verification Plan, 'an invalid email and a wrong
    code').
-   **Discrepancy Description:** The reviewer says to narrow Goal 4 and not add the code-to-key
    mapping that C6 offers as its second option. `useErrorMessage()` shows server messages
    unchanged (packages/web-ui/src/preferences/errors.ts lines 5-16). A mapping would be a new
    i18n pattern against ADR 008 lines 86-87 and the brief's decision 8 (brief lines 259-261).
    Bears on C4, C6, C9, design-6.
-   **Rationale & Recommendation:** Rewrite Goal 4 once: on a first visit, the sentences the
    sign-in and verify pages word themselves, the code email and the start page are in Chinese;
    server messages stay English; a language already stored in Teach wins. Line 836-837 must
    expect English for 'a wrong code'. One sentence on what the hook does answers C4; no list of
    error codes is needed.
-   **Check (confirmed):**
    packages/web-ui/src/preferences/errors.ts:5-16:
    'The server's message is shown as it is (the API answers in English); the two sentences the
    client words itself ... follow the chosen language'.
    docs/adr/008-theming-preferences-i18n.md:86-87: 'A failed request is worded by
    `useErrorMessage()`: the server's message as it is (the API answers in English), and the two
    sentences the client words itself in the chosen language.'
    docs/designs/learner-main-page-improvements.md:259-261 (same text at
    concepts_brief.md:259-261): '8. The API stays English ... The app translates only the error
    sentences it words itself, following the existing `useErrorMessage()` pattern.'
    comprehension_report.md:243-268 (C6): second option is 'add a code-to-key mapping for the
    sign-in error codes (`link_invalid`, `link_expired`, `code_invalid`, `code_locked`)'. A
    wrong code is worded by the server in English: apps/api/src/services/auth.service.ts:124
    `code_invalid` (also :105, :109, :113, :136). Target 84-85 says 'its error sentences ... are
    in Chinese' without exception; 204 'store lang (if nothing stored)'; 836-837 walks 'a wrong
    code' in Chinese.

### IZ4. Correct the 'gap is the sign-in step' claim; do not pull the personal application form into the first PR - Severity: Major

-   **Reviewer Lens:** `egm-zoom-out`
-   **Affected Scope:** Reviewer's lines, all correct: 50-51 (The Problem), 97-98 (Non-Goals,
    'Translating Teach beyond its sign-in step'), 122 (CUJ 1 'open the personal application'),
    330-339 (Risks table).
-   **Discrepancy Description:** The reviewer says to correct the claim and not translate the
    personal application form now. design-3's first option translates
    apps/teach/src/routes/apply.tsx, a 237-line English form; that contradicts the Non-Goal at
    97-98 and the brief's non-goal (brief lines 211-212). design-12 needs one sentence, not a
    risk row or a UI note: the two pages the link lands on are single-column at narrow widths in
    code (SignInPage.tsx line 74-75; gate.tsx line 111), and nobody has tested this on a phone.
    Bears on design-3, design-12.
-   **Rationale & Recommendation:** The subtractive fix: line 50-51 says the gap this design
    closes is the sign-in step; CUJ 1 ends at the start page, which is what Goals 3 and 4
    promise; one risk row records the English form as an accepted cost. A sentence on `/teach`
    saying the form is English is optional: it costs one key in two languages and goes stale
    when the form is translated. For design-12, add one sentence that the two landing pages are
    single-column at narrow widths in code and untested on a phone.
-   **Check (confirmed):** Target 50-51: 'Teach's start page and dashboard are already
    translated, so the gap is the sign-in step in between.' Target 97-98: 'The application
    forms, course builder and other Teach pages stay as they are.' Target 122: '...sign in to
    Teach with the emailed code and open the personal application.'
    apps/teach/src/routes/apply.tsx
    is 237 lines (`wc -l`), with English literals and no `t()` call, e.g. :112 `'Update your
    application' : 'Become a teacher'`, :114 'Teach what you practise.'
    docs/designs/learner-main-page-improvements.md:211-212: non-goal 'Translating the Teach and
    Support portals beyond the sign-in and start pages Feature 2 lands on.'
    critic_report.md:114-144 (design-3): recommendation includes 'bring `apply.tsx` into PR 1 or
    have the `/teach` screen say the application is in English'.
    packages/web-ui/src/portal/SignInPage.tsx:74-75: `<div className="flex min-h-full
    items-center justify-center bg-canvas px-4 py-12">` / `<div className="w-full max-w-[460px]
    ...">`. apps/teach/src/routes/gate.tsx:111: `<div className="grid gap-4 sm:grid-cols-2">`
    (one column below the `sm` breakpoint). critic_report.md:478 (design-12) records that Teach
    was not tested at phone width. The Risks table (330-339) has no row for the English form.
    Which fix to take is a design opinion.

### IZ5. Fix the drift between the specification half and the plan half by deleting the second copy - Severity: Major

-   **Reviewer Lens:** `egm-zoom-out`
-   **Affected Scope:** Reviewer's lines, all correct: 177-190 (Decisions made while drafting),
    225, 230-234, 250-256, 269, 280-281, 287-289, 296-300, 382-463 (reasons for rejection of
    Alternatives C-J), 505-506 (Additional Resources), against the plan at 545-547, 554,
    581-609, 675-676.
-   **Discrepancy Description:** The reviewer raises Z8 from Nit to Major. Z8 said the
    specification half repeats the plan half. The reviewer says Stages 6 and 7 confirm the
    copies have already drifted in three places, two of them rated Major: the area name (`auth`
    against `portalAuth`), the quoted Chinese-design sentence (280 against 675), and 'when it
    was sent' (300 against 554). The fix should delete the second copy, not synchronise two.
    Bears on C1, structural-2, design-9, C15, C17, structural-7, style-16, style-22,
    structural-1, structural-5, design-8; changes the weight of Z8.
-   **Rationale & Recommendation:** Name the area once in the specification half; delete the
    misquote at 280-281 and leave item 12 to carry it. structural-1 offers 'drop the
    attribution' or 'link a record': drop it, since each rejection already states a trade-off.
    structural-5 offers 'add two decisions to the numbered list' or 'bare reasons throughout':
    use bare reasons. With the attributions gone, cut 'Decisions made while drafting' to items 1
    and 2, the two brief questions it answers; items 3 to 5 restate their own sections
    (style-22).
-   **Check (partly confirmed):** Holds. The three drifts exist: target 269 'in a new `auth`
    area' and 505 'the new `auth` and `learnerTeach` areas' against 581 `portalAuth.en.ts`, 609
    'Add the `portalAuth` area'; target 280-281 quotes 'Teach and Support send no `locale`' and
    says it 'is amended', while 675-676 quotes 'Teach and Support send none, so their links
    carry no `lang`' and says it 'gains a pointer' (the real sentence is the second form,
    docs/designs/learner-chinese.md:420-421); target 300 'when it was sent' against 554 'when
    `input.source` is set'. zoom_out_report.md:359 rates Z8 Nit. critic_report.md:169-197
    (structural-1): 'Either drop the "Rejected by author" attribution and let the stated
    trade-off stand, or link the actual record'. critic_report.md:549-572 (structural-5):
    'adding the Support-translation and `Linking.openURL` choices to the numbered decision list,
    or by using the bare-reason form throughout'. Decisions 1 and 2 name the brief's Questions 6
    and 7 (target 179, 182, and 112-113 points there). critic_report.md:852-870 (style-22,
    partly confirmed): decisions 1, 3 and 4 repeat 'The banner' (219-234) and decision 5 repeats
    'Counting arrivals' (285-305). Does not hold: 'two of them rated Major'. Only one of the
    three drifts is rated Major, the area name (comprehension_report.md:111 C1 Major;
    critic_report.md:214 structural-2 Major). The misquote is Nit in both stages
    (comprehension_report.md:434 C17 Nit; critic_report.md:590 structural-7 Nit) and 'when it
    was sent' is Nit (comprehension_report.md:405 C15 Nit). The count of two is right only if it
    means two findings (C1 and structural-2) about the same drift. Also, style-22's check shows
    decision 1 restates 'The banner' as well, so 'items 3 to 5 restate their own sections' is
    not what separates them from items 1 and 2; the brief-question link is. The severity uplift
    itself is the reviewer's judgement.

### IZ6. Delete the Support risk row and the picker mitigation instead of calibrating them - Severity: Nit

-   **Reviewer Lens:** `egm-zoom-out`
-   **Affected Scope:** Reviewer's lines, all correct: 276-283 ('Both portals get this', 'The
    code email', 'Verify is unchanged'), 339 (risk row 'Support staff get Chinese sign-in
    emails'), 476-484 (Alternative L), 675-676 (item 12, `learner-chinese.md` sentence).
-   **Discrepancy Description:** The reviewer says style-6 asks to say where the picker is and
    that the first email follows the browser. A simpler statement is one rule: the code email is
    in the language of the page that asked for it. Under the Chinese design, Support's page
    follows the browser (learner-chinese.md lines 497-500), so a Chinese email follows a Chinese
    page; that is consistent behaviour, not a risk. This removes an exception from the Chinese
    design (its lines 420-421) and adds none. Alternative L keeps its concrete reason at
    481-482. C5 then needs one clause defining Support; the 'why does Support store a marker'
    half goes with Finding 1. Bears on style-6, C5, C18, design-11.
-   **Rationale & Recommendation:** Delete risk row 339 and the picker mitigation (277, 339,
    484). State one rule: the code email is in the language of the page that asked for it. Keep
    Alternative L's reason at 481-482. Add one clause defining Support.
-   **Check (confirmed):** Target 277 'Support staff can switch language'; 339 'its picker
    switches language'; 484 'a Support agent can choose English in the picker'; 481-482 'The two
    portals share `SignInPage` and `VerifyPage`. Keeping Support English means a prop that
    switches translation off, or two copies of each page.' critic_report.md:334-357 (style-6,
    Major, confirmed): 'CALIBRATE by naming where the picker is and stating that the first code
    email follows the browser language'; its check found no `PreferencesButton` in
    SignInPage.tsx and Support's picker only at apps/support/src/routes/settings.tsx:17 inside
    `RequireAuth`.
    docs/designs/learner-chinese.md:497-500:
    'Teach and Support resolve `system` too. web-ui's `PreferencesProvider` resolves the
    language with `resolveLocale` and `navigator.languages`.' learner-chinese.md:420-421: 'Teach
    and Support send none, so their links carry no `lang`.' comprehension_report.md:218-242 (C5)
    asks for a Terms entry for Support and the reason its init script stores the marker. Whether
    a Chinese code email for Support staff is a risk or consistent behaviour is a design
    opinion.

### IZ7. Take the accepted cost, not the mechanism, for design-5, design-7 and design-4 - Severity: Nit

-   **Reviewer Lens:** `egm-zoom-out`
-   **Affected Scope:** Reviewer's lines, all correct: 75-76 (Goal 2), 222-227 (banner rule),
    335 (risk row 'Owners who are signed out see it') for design-5; 255-256 (`teachUrl()`),
    692-698 (item 14) for design-7 and Z10; 209-212 (Data flow), 282-283 (Verify unchanged) for
    design-4 and C22.
-   **Discrepancy Description:** The reviewer says three Stage 7 findings each offer a mechanism
    or an accepted cost, and to take the accepted cost each time. design-5: no foreground
    `refreshUser()`; a stale or offline owner sees a footer banner that leads to their own Teach
    page, the same cost row 335 already accepts. design-7 point 2: no nullable `teachUrl()` and
    no build check; native values are hard-coded in `eas.json` (787-788), and `vars.TEACH_URL`
    already feeds Support's build. design-4: remove `locale` from line 212; do not add a path
    that carries the request language to the event. Z10 unchanged. The report's closing reuse
    check adds: nothing uses `AppState` or `sessionStorage` under `apps/` or `packages/` source.
-   **Rationale & Recommendation:** design-5: add a clause to risk row 335 for the stale or
    offline owner and loosen Goal 2; add no foreground refresh. design-7 point 2: keep
    `teachUrl()` non-nullable and add no build check. design-4: remove `locale` from the
    `sign_in` event at line 212.
-   **Check (confirmed):** critic_report.md:399-420 (design-5): 'State the staleness as
    accepted, or call `refreshUser()` when the app returns to the foreground'.
    apps/learner/src/lib/session.tsx:50-53
    keeps `signed_in` with `user` null when offline ('Offline or API down: keep the session'),
    :57-59 calls `refreshUser()` on mount only. Target 335: 'Accepted: pressing through takes an
    owner into their portal.' critic_report.md:374-383 (design-7 point 2): 'Hide the banner or
    fail the build when the variable is missing, instead of falling back';
    zoom_out_report.md:417-432 (Z10) names the nullable return and a build check. Target 787-788
    hard-codes `EXPO_PUBLIC_TEACH_URL` per profile, matching today's apps/learner/eas.json:11-13
    and :19-21, which hard-code the API and web URLs. .github/workflows/deploy.yml:150-153: step
    'Build Teach, Support and learner web' sets `VITE_TEACH_URL: ${{ vars.TEACH_URL }}`. Target
    211-212 shows `sign_in event { audience: teach, locale, source: learner }` while 282-283
    says 'Teach sends no `locale` or `localeChosen` at verify'; critic_report.md:145-168
    (design-4) offers 'show `locale: null`, or carry the request language to the event'. Reuse
    check: `grep -rnE 'sessionStorage|AppState' apps packages` returns nothing. Choosing the
    accepted cost each time is a design opinion.

### IZ8. One short 'relies on' list in place of four separate additions about the Chinese design - Severity: Nit

-   **Reviewer Lens:** `egm-zoom-out`
-   **Affected Scope:** Reviewer's lines, all correct: 33-34 (Overview), 173-175 (Terms, 'The
    Chinese design'), 278-283 (code email and verify), 290-291 ('already read `?lang` (the
    Chinese design's PR 4)'), 309-317 (Order of release), 321-324 (Records and rules), 344-346
    (Rollback, 'PR 2' and 'PR 1').
-   **Discrepancy Description:** The reviewer says C3 asks for the resolver's rule,
    `localeChosen`, the status and a marked baseline; design-11 asks for a risk row; style-2
    asks for tense fixes. One list at 309-311 covers all of them. Bears on C3, C21, style-2,
    design-11, C13, C14, structural-8, design-10.
-   **Rationale & Recommendation:** Put a single list at 309-311: the Chinese design is
    Proposed, and this design uses its resolved language, `locale` on the sign-in request, the
    `?lang` hand-off and the learner catalog areas. Reword line 282 to 'Teach's verify request
    is unchanged, so signing in to Teach never writes the account language', so `localeChosen`
    needs no definition. Call this design's pull requests 'the Teach PR' and 'the learner PR',
    which removes the numbering clash without qualifiers. Add design-10's merge-gate sentence as
    written.
-   **Check (confirmed):**
    docs/designs/learner-chinese.md:4
    'Status: Proposed'. Target 309-311: 'This design needs its PR 1 (the resolver and the
    `locale` request field), PR 2 (the code email in the request's language), PR 3 (the learner
    catalog areas) and PR 4 (the `?lang` hand-off in Teach)', then 312-317 and 344-346 use 'PR
    1' and 'PR 2' for this design's own pull requests. Target 282 is the only use of
    `localeChosen`. Target 290-291 'already read `?lang`' states planned behaviour as present.
    comprehension_report.md:164-195 (C3) asks for status, resolver inputs and outputs,
    `localeChosen` and a marked baseline; :388 (C14) and critic_report.md:615 (structural-8) are
    the PR-numbering clash; critic_report.md:458-476 (design-11) asks for 'a risk row, or pin
    the exact behaviours relied on'; :263 (style-2) is the tense finding; :442-456 (design-10)
    asks for the same merge gate as learner-chinese.md:556 ('PR 2 and PR 3 don't merge without
    that reviewer's sign-off'). Whether one list is enough is a design opinion.

### IZ9. Smaller asks where deleting beats adding (Tailscale sentence, Alternative C con, Alternative G, Alternative M, Goal 6, the six-step process) - Severity: Nit

-   **Reviewer Lens:** `egm-zoom-out`
-   **Affected Scope:** Reviewer's lines, all correct: 88-89 (Goal 6), 166-167 (Terms, Tailscale
    sentence), 240-249 (`/teach` content), 381 (Alternative C, second con), 421-432 (Alternative
    G), 486-495 (Alternative M).
-   **Discrepancy Description:** The reviewer lists smaller asks. A preview tester off the
    tailnet cannot use the app at all, so the Tailscale sentence needs no consequence stated.
    One platform is enough to reject Alternative M; no per-platform analysis is needed. With
    Findings 1 and 2 taken, removal is a revert of one PR on web. Z6 is slightly raised: every
    sentence on `/teach` now also needs the reviewer's sign-off (design-10), and Stage 7
    proposes adding sentences to it. Bears on style-7, style-15, C20, C8, style-21,
    structural-6, style-4.
-   **Rationale & Recommendation:** style-15 and C20: delete the Tailscale sentence. C8 and
    style-21: delete the con at 381. structural-6: do not split Alternative G into two headings.
    style-4: narrow Alternative M's reason to iOS, where the in-app browser does not share
    storage, and cite the Expo WebBrowser page. style-7: restate Goal 6 in line 344's words. Z6:
    cut the six-step process before adding any sentences to `/teach`.
-   **Check (confirmed):** Target 166-167 'Staging is reachable only over Tailscale.' (the only
    mention of Tailscale in the file).
    apps/learner/eas.json:12
    sets the `preview` profile's `EXPO_PUBLIC_API_URL` to
    `https://api.staging.elevatelearn.app`, and infra/README.md ('Private staging (Tailscale)')
    says 'The API load balancer answers 403 by default and forwards only the connector's IP', so
    a preview build off the tailnet has no working API. Target 381 'A rejected applicant, whom
    Teach lets resubmit, never gets it either', while the chosen rule at 179-181 hides owners
    'at any status' (comprehension_report.md:289 C8, critic_report.md:832 style-21).
    critic_report.md:574-588 (structural-6) implies splitting Alternative G. Target 492-495
    rests Alternative M on 'The in-app browser's storage is separate from the default
    browser's'; the Expo SDK 58 WebBrowser page
    (https://docs.expo.dev/versions/v58.0.0/sdk/webbrowser/) says 'As of iOS 11,
    SFSafariViewController no longer shares cookies with Safari' and 'On iOS, the modal Safari
    will not share cookies with the system Safari', and says nothing about Android. Target 88-89
    'Turning it off is one change in the learner app' against 344 'a revert of PR 2 on the web,
    and a store build on native' (critic_report.md:359 style-7). Target 242-243 lists the six
    steps and 750 'the six steps of how it works'; zoom_out_report.md:297 (Z6, Nit).
    critic_report.md:114-144 (design-3) and :478-497 (design-12) each propose a further sentence
    on `/teach`. Each choice between deleting and adding is a design opinion.

### IZ10. The cut lists in Findings 1 and 2 leave out lines that carry the same mechanism - Severity: Nit

-   **Reviewer Lens:** `egm-zoom-out` (raised by the checker)
-   **Affected Scope:** Finding 1 (arrival marker): 78 (Goals, Goal 3 link), 126-127 (CUJ 1),
    202 (Data flow), 250 (The `/teach` screen, button), 313-314 (Order of release), 525-527
    (Detailed Implementation Plan, PR 1 summary), 752-753 (item 19), 807-808 (item 23). Finding
    2 (dismissal): 198 (Data flow), 229 (The banner, 'What it holds'), 740 (item 18), 833
    (Verification Plan walkthrough).
-   **Discrepancy Description:** If the author takes Finding 1 and edits only the lines the
    reviewer lists, `from=learner` stays on the link and in the tests, and CUJ 1 still asserts
    an event property that no longer exists. If the author takes Finding 2 and edits only the
    listed lines, the data-flow diagram still has a 'dismissed here?' branch, Explore still
    passes `onDismiss`, and the walkthrough still runs CUJ 4. Nothing in Teach would strip a
    leftover `from` from the address bar, because the Chinese design's `history.replaceState`
    removes `lang` only (target 663-664 adds `from` to it in item 11, which Finding 1 deletes).
-   **Rationale & Recommendation:** When applying Finding 1, also remove `&from=learner` and
    `source` at 78, 126-127, 202, 250, 313-314, 525-527, 752-753 and 807-808. When applying
    Finding 2, also change 198, 229, 740 and 833.
-   **Check (confirmed):**
    docs/designs/learner-teach-banner.md:78
    '`TEACH_URL/?lang=<language>&from=learner`'; :126-127 'The address bar shows no `lang` or
    `from`. A `sign_in` event records `audience: 'teach'` and `source: 'learner'`'; :202
    'TEACH_URL/?lang=<resolved>&from=learner'; :250 '`/?lang=<resolved locale>&from=learner`';
    :313-314 '`locale` and `source` on the requests, the marker in the init scripts, and the
    `sign_in` property'; :525-527 'sends `locale` and `source` ... keeps the arrival marker ...
    records `source` on `sign_in`'; :753 "teachUrl('/') + '?lang=' + locale + '&from=learner'";
    :808 'a URL ending `/?lang=zh&from=learner`'. Dismissal: :198 'dismissed here? -- yes -->
    no banner'; :229 'and a close button with an accessibility label'; :740 '`<TeachBanner
    onDismiss={dismiss} />`'; :833 'CUJs 1, 3, 4 and 5 on learner web'. None of these line
    numbers appears in the Affected Scope of Finding 1 or Finding 2 in the reviewer report.
