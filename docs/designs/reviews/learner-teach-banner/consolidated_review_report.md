# Consolidated Review Report: Teach banner on Explore

**Target:** `docs/designs/learner-teach-banner.md` (846 lines; feature spec 1-519, Detailed
Implementation Plan 520-846)

**Mode:** consolidated report, all review rubrics (Stages 5 to 9, run without stopping).
**Date:** 2026-11-17. The document was not edited during the review, so every line number
refers to the same version.

## Result

The five stages raised 126 findings. Merging the ones that two reviewers of the same stage raised
leaves 105: 1 Blocker, 38 Major and 66 Nit. This report sorts them into 13 decisions for the
author and 33 action items. Every finding is mapped to exactly one of them ([Traceability
Matrix](#traceability-matrix)).

**Checking.** After each reviewer finished, a separate agent re-read the cited lines and opened
the cited code. Of the 105 findings, 95 were confirmed, 9 were partly confirmed (the stage report
says which part does not hold), 1 is a judgement with no factual claim to test, and 0 were
refuted. A second agent then checked this report's sorting against the findings and its
corrections were applied.

**What to read first.** The one Blocker is action item A1: neither pull request can pass its own
checks until the Chinese text exists or its process is stated. After that, decisions D1 and D2
matter most, because each option changes which later action items are still needed.

## Decisions taken

The author answered every decision on 2026-11-17, after this report was written. The design
document has not been edited yet. "Follow-on" says what each answer does to the action items.

| Decision                                   | Answer                                                                                                                                                                                                  | Follow-on                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1. The arrival marker                     | **Delete it.** Count first applications (`teacher_applied` with `reapply: false`), leaving out the hand-recruited pilot teachers.                                                                       | Plan items 1, 2, 3, 7 and 11 go, with every `source` and `from` mention. The Teach PR has no API or contract change. A28 is required. D9 and D13 no longer apply. Most of A3, part of A4, A12 edit (2) and most of A19 are unnecessary.                                                                                                              |
| D2. Dismissal                              | **Keep it, with two ways back:** a "Teach on Elevate" row in Profile, and a dismissal that expires after **30 days**.                                                                                   | The Profile row moves from Future Improvements into scope: a plan item, a message in two languages and a test, hidden from owners like the banner. The flag stores the dismissal time, and the rule compares it with 30 days. A35 (one storage file) applies. A29 describes the expiry instead of "for good".                                        |
| D3. Chinese error sentences                | **Map error codes to translated messages.** The author also widened the rule: every API error a learner or teacher can see gets a code and a translated message, and only internal errors stay English. | In this design, the shared sign-in and verify pages map `link_invalid`, `link_expired`, `code_invalid` and `code_locked`. The wider rule reverses the brief's decision 8 and changes ADR 008 and `learner-chinese.md` (its Goal 1 exception, its Alternative I and its error-wording item). That is a separate piece of work and is not planned yet. |
| D4. The English personal application form  | **Translate it** in the Teach PR.                                                                                                                                                                       | `apps/teach/src/routes/apply.tsx` moves to the message catalog with Chinese text. The Non-Goal "translating Teach beyond its sign-in step" changes. The Problem still says the review emails stay English, after the email templates are checked. More Chinese text for A1.                                                                          |
| D5. The second sign-in                     | **Plain link for everyone.**                                                                                                                                                                            | The emailed-link idea joins Alternatives Considered with the reason for not taking it.                                                                                                                                                                                                                                                               |
| D6. The picker on sign-in                  | **Add `PreferencesButton` to the shared sign-in page**, in Teach and Support.                                                                                                                           | Plan item 8 gains the button. The mitigation in the Support risk row and in Alternative L becomes true as written.                                                                                                                                                                                                                                   |
| D7. An owner with a failed or stale lookup | **Accept both gaps.**                                                                                                                                                                                   | The risk row says so, Goal 2 is loosened, and a test covers signed in with no user. No foreground refresh.                                                                                                                                                                                                                                           |
| D8. The `/teach` screen                    | **Keep the four sections.**                                                                                                                                                                             | A13 writes the full English text of every screen message into the plan.                                                                                                                                                                                                                                                                              |
| D9. Language on Teach's `sign_in` event    | Not needed.                                                                                                                                                                                             | D1 deleted the marker, so the event line leaves the data flow.                                                                                                                                                                                                                                                                                       |
| D10. A build with no Teach address         | **Keep the fallback.**                                                                                                                                                                                  | The dead link on an empty web variable is recorded as an accepted cost.                                                                                                                                                                                                                                                                              |
| D11. The Tailscale sentence                | **Move it and state the consequence.**                                                                                                                                                                  | It moves beside the `preview` build profile: a preview build's Teach link needs a device on the tailnet.                                                                                                                                                                                                                                             |
| D12. Alternative G                         | **Leave it as one heading.**                                                                                                                                                                            | The structural finding is declined.                                                                                                                                                                                                                                                                                                                  |
| D13. The `from` allow-list                 | Not needed.                                                                                                                                                                                             | D1 deleted the marker.                                                                                                                                                                                                                                                                                                                               |

## Resolution

The decisions above and the action items below were applied to
`docs/designs/learner-teach-banner.md` on 2026-11-17. Line numbers in the rest of this report
refer to the version that was reviewed, not to the rewritten one.

-   **Applied:** all 13 decisions as answered, and all 33 action items, except the parts a chosen
    decision made unnecessary.
-   **Checked twice.** Six independent agents compared the rewrite with this report and with
    the code. They found 24 decisions or action items only partly applied, and 42 problems in
    the new text. Those were fixed. A second pass confirmed 63 of them closed and found 10 more
    problems, which were fixed too. No third pass was run.
-   **One more decision came out of the checks.** Once Teach's sign-in sends its language, the
    emailed sign-in link carries `lang`, and opening it stores that language, replacing "Follow
    device" at every link sign-in. The author chose to accept this. It is a risk row in the
    design, with matching edits planned for `learner-chinese.md`.
-   **Facts the checks corrected:**
    -   the server can't answer `code_locked` today, so three sign-in error codes are reachable,
        not four;
    -   only Support reads the Teach address variable, and an empty value ships a dead link with
        no warning;
    -   invited members also know Teach's address, so the count of first applications includes
        any of them who apply.
-   **Also changed:** `learner-chinese.md` item 55 now puts its sign-in test outside Expo
    Router's `app/` directory (action item A14).
-   **Still open, for the author:**
    -   **A1, the Blocker.** The design states the gate (no merge without the Chinese text and a
        reviewer's sign-off) but names nobody. Its Question 1 has to be answered before either
        pull request can pass its checks.
    -   **Question 2:** when the count is read, and what result removes the banner.
    -   **Question 3:** which design carries the wider rule that every user-visible API error
        gets a code and a translated message. It changes ADR 008 and `learner-chinese.md`.

## Stages

| Stage                       | Scope                                 | Reviewers                                                           | Status    | Blocker | Major | Nit | Report                                                                   |
| --------------------------- | ------------------------------------- | ------------------------------------------------------------------- | --------- | ------- | ----- | --- | ------------------------------------------------------------------------ |
| 5. Initial Zoom Out         | full file                             | `egm-zoom-out`, `egm-inventive-catalyst`                            | completed | 0       | 5     | 7   | [zoom_out_report.md](zoom_out_report.md)                                 |
| 6. Comprehension Test       | both ranges, document alone           | `egm-comprehension`                                                 | completed | 0       | 6     | 16  | [comprehension_report.md](comprehension_report.md)                       |
| 7. Critic Review            | feature spec, lines 1-519             | `egm-design`, `egm-structural`, `egm-style`                         | completed | 0       | 13    | 24  | [critic_report.md](critic_report.md)                                     |
| 8. Intermediate Zoom Out    | full file, with the Stage 5-7 reports | `egm-zoom-out`                                                      | completed | 0       | 5     | 5   | [intermediate_zoom_out_report.md](intermediate_zoom_out_report.md)       |
| 9. Implementation Readiness | plan, lines 520-846                   | `egm-implementation-readiness`, `egm-codebase-details`, `egm-style` | completed | 1       | 9     | 14  | [implementation_readiness_report.md](implementation_readiness_report.md) |

Each reviewer ran once, in a fresh context, and none needed a retry. Finding ids are written
`stage/id`: `7/design-2` is finding `design-2` in the Stage 7 report.

## Decisions for the author

A decision is listed where reviewers recommend incompatible things, or where the fix is a product
or scope choice. Stage 8 read the reports of Stages 5 to 7 and argues, in several places, for
cutting part of the design in place of the additions those stages ask for. The options are not
ranked.

### D1. Keep, change or delete the arrival marker - 🟡 Major

-   **Question:** Does this design keep the arrival marker (`from=learner` on the link, `source`
    on the `sign_in` event), and if so in which form?
-   **Where:** Goal 5 (86-87); Terms (171-172); drafting decision 5 (188-190); Data flow
    (202-212); Counting arrivals (285-305); Risks rows 332, 337, 338; Alternatives G (432), I, J,
    K (444-474); Future Improvements (514-516); plan items 1-4 (540-577), 7 (613-621), 8
    (633-635), 9 (645), 11 (655-664), 13 (684-686); Verification Plan (829-830, 839-840)
-   **Findings:** `5/Z1`, `5/Z4`, `5/Z7`, `6/C19`, `7/design-2`, `8/IZ1`
-   **Options:**
    -   **1. Delete the marker and count first applications instead (Alternative J).** Design: no
        `from=learner`, no `elevate.from`, no `source`. Goal 5 is restated: count
        `teacher_applied` events with `reapply: false` (already emitted,
        apps/api/src/services/profiles.service.ts 208-212 and 311-315) and leave out the three to
        five hand-recruited teachers. Alternatives I, J and K fold into one deferred alternative.
        Reword 332, 432, 515 and 516 so no count is presented as a test of the placement or of the
        second sign-in. Plan: remove items 1, 2, 3, 7 and 11 whole, the `source` bullets of items
        4, 8, 9 and 13, Terms 171-172, drafting decision 5, and risk rows 337 and 338. The Teach
        PR then has no API or contract change. It still keeps item 4's last test (576-577) and
        item 12's record edits. Cost: no sign-in count. Exclusion stops working once a second
        public route to Teach exists. The checker notes that 'Elevate knows the pilot teachers'
        emails' is an assumption, and that whether exclusion is good enough at pilot size is a
        judgement. An optional request field can be added later without a migration. Settles:
        5/Z1, 5/Z7, 6/C19 and 7/design-2 points (c), (d), (e). 5/Z4 and 7/design-2 point (a) are
        accepted, not solved: no count separates placement loss from second-sign-in loss.
        7/design-2 point (b), the decision rule at 839-840, is A22 and is still wanted (8/IZ1).
        Makes unnecessary: D9 (the event line leaves the diagram); D13; A19 except the rollback
        sentence at 346-347; most of A3; the second sentence of A4; edit (2) of A12; the `source`
        parts of A16 and A17. Makes A28 required.

        Backed by: 8/IZ1; 5/Z7 as support; 5/Z1 names deferring attribution (Alternative J) as one
        of its two options.
    -   **2. Keep the marker as designed and repair the count.** Design: the pipeline stays.
        Counting arrivals (303-305) defines the metric as distinct users whose first Teach
        `sign_in` carries `source: learner`, and applications with `reapply: false` after that
        sign-in. `elevate.from` is cleared after a successful verify (items 7, 8, 9). The
        already-signed-in undercount (Goal 3's second and third cases, 80-81) gets a risk row, or
        `source` is also sent on the application request. Lines 332, 432 and 516 get a decision
        rule, or are reworded to 'the arrival count shows how many sign-ins the banner produced;
        it does not show how many visitors saw it' (7/style-5, merged into 7/design-2). Goal 5
        (86-87) changes from 'can be counted' to 'can be estimated', or points at the known
        undercount (7/style-14, merged into 7/design-2); lines 295, 337 and 338 already record an
        undercount and a marker that can be forged. Cost: everything in items 1-4, 7-9, 11 and 13
        plus these additions. The count still has no denominator (no views or presses) and `from`
        can be forged (337). A3, A4 and A19 are all needed, and D9 and D13 still have to be
        answered. Settles: 6/C19 and 7/design-2 points (b) to (e). Does not settle 5/Z1, 5/Z4 or
        7/design-2 point (a).

        Backed by: 7/design-2; 6/C19.
    -   **3. Keep the marker but store it on the magic-link row (Alternative K).** Design: one
        nullable column on `magic_links`, written in `requestMagicLink` and read at `verify`, as
        `redirectPath` is today (auth.service.ts 63 and 149). The client sends `source` once, on
        the sign-in request. This removes both verify-branch contract changes, the code-verify
        send, the `source` send in item 9 (line 645) and `&from` on the emailed link. Alternative
        K becomes the chosen design and today's design becomes the rejected one. Line 343 ('No
        migration') changes, and the plan gains a migration item. Cost: a migration. The checker
        notes K does not remove risk row 338: a visitor who asks for a code in another tab is
        still not counted. Stage 8 says K repairs none of 7/design-2 points (a) to (e), so the
        metric repairs in the previous option still apply, including the rewording of 332, 432 and
        516 and the change of Goal 5 (86-87) from 'can be counted' to 'can be estimated'
        (7/style-5 and 7/style-14, merged into 7/design-2); the checker marks Stage 8's statement
        as the reviewer's inference. Settles: 5/Z1. A19 changes (line 300 goes; row 338 is
        reworded). D9 and D13 still have to be answered.

        Backed by: 5/Z1; 8/IZ1 says that if attribution is kept, K is the smaller form.
    -   **4. Keep the marker and add events that separate the causes.** Design: `requestMagicLink`
        records an event when `source` is set, with `{ audience, locale, source }` and `userId:
        null` (`trackEvent` accepts a null user). This needs a new name in `ANALYTICS_EVENTS`. The
        count then separates 'asked for a code' from 'completed sign-in'. Optionally `source:
        arrivalSource()` is sent with the application request, so `teacher_applied` is attributed
        directly and arrivals already signed in to Teach are counted. Can be combined with either
        'keep' option above. Cost: an unauthenticated request writes analytics rows, bounded by
        the route's rate limit and the per-email window. The event counts requests, not people.
        The application `source` adds a contract field to Teach's apply forms, which Non-Goal
        99-100 leaves unchanged. Banner views and presses stay unmeasured. The checker notes a
        visitor who reaches Teach's sign-in page and leaves without asking for a code is still
        invisible. Settles: 5/Z4 and 7/design-2 point (c). Does not settle 5/Z1.

        Backed by: 5/Z4; 7/design-2 lists 'send `source` on the application request' as one way to
        cover the signed-in undercount.

### D2. Keep, change or drop dismissal - 🟡 Major

-   **Question:** Does the banner keep its close button, and if so how does a visitor who closed
    it find Teach again, given that 'open `/teach` by its address' does not exist on iOS and
    Android?
-   **Where:** CUJ 4 (144-151); drafting decision 4 (186-187); Data flow (198); The banner (226,
    229, 230-234); `/teach` route note (238-239); Risks row 334; Alternative H (434-442); Future
    Improvements (512-513); plan items 15-16 (700-722), 17 (730-732), 18 (740), 21 (774), 23
    (805-806), 24 (813-817); Verification Plan (833)
-   **Findings:** `5/Z2`, `5/Z5`, `5/Z12`, `7/design-1`, `8/IZ2`
-   **Options:**
    -   **1. Drop dismissal (Alternative H).** Design: no close button and no stored flag.
        `useTeachBanner` becomes a pure rule on the session and `searching`. Alternative H becomes
        the chosen design and 'a dismissible banner' the rejected one. Plan: remove item 15 whole,
        the 'flag unread' state in item 16, the close button and its `.close` key (730-731, 774),
        CUJ 4, risk row 334, the Profile future improvement (512-513), the dismissal test bullet
        (805-806) and the relaunch half of item 24. The first half of item 24 stays. Cost: a
        repeat learner who will never teach sees the banner at the end of Explore on every visit.
        A stored flag can be added later. Settles: all five findings. Makes unnecessary: A29; A35;
        the close-button part of A15; the flag tests in A16; the close and relaunch steps in A33;
        the Profile, `PreferenceRows` and `preferences-storage` parts of A25. Makes A28 required.

        Backed by: 8/IZ2; 5/Z2.
    -   **2. Keep the close button, but it collapses the card to a one-line text link in the same
        slot.** Design: Explore always holds an entry to `/teach`, for signed-in and signed-out
        visitors, on every platform. The flag stores the dismissal time instead of the literal
        `dismissed` (230-231, 706-707), so a later release can show the card again without a
        storage change. Plan: one more visual state and its message key, a test for it in item 23,
        a changed Maestro flow, and CUJ 4's 'The banner is gone' (149) reworded. Risk row 334 and
        the Profile future improvement go. Cost: the collapsed line still takes space for learners
        who will never teach. A stored time invites a re-show policy that someone has to decide
        and test. Settles: 5/Z5, 5/Z12, 7/design-1. Does not settle 5/Z2 (two protections where
        one would do); its smaller ask, one storage file, is A35. A29 changes wording.

        Backed by: 5/Z5.
    -   **3. Keep permanent dismissal and add a way back: a Profile row now, or a dismissal that
        expires.** Design, Profile row: the 'Teach on Elevate' link in Profile moves from Future
        Improvements into scope, with a new plan item, a key in two languages and a test.
        Signed-out visitors cannot open Profile, so they still have no way back. Design, expiry:
        the flag stores a time, the rule compares it, and the re-show period has to be chosen and
        tested. Cost: either one adds scope that exists only to undo dismissal. Settles:
        7/design-1; 5/Z12 for signed-in visitors only (Profile row) or for everyone after the
        period (expiry). Does not settle 5/Z2; its smaller ask, one storage file, is A35. A29
        applies for the Profile row; for an expiring dismissal, write the expiry behaviour
        instead.

        Backed by: 7/design-1 (first and second of its three options).
    -   **4. Keep dismissal as designed and record the native dead end as an accepted cost.**
        Design: unchanged. Document: risk row 334, CUJ 4 line 151 and line 239 say the by-address
        fallback is web only, and that a dismissed native install has no route to `/teach` until a
        Profile link exists. Cost: on a phone, one press of the close button removes the only
        entry to Teach on that install. Settles: 5/Z12, and 7/design-1 as a documented cost. Does
        not settle 5/Z2 or 5/Z5. A29 still applies. 5/Z2's smaller ask, one storage file, is A35.

        Backed by: 7/design-1 (third option); 5/Z12.

### D3. Goal 4 promises Chinese error sentences that the server words in English - 🟡 Major

-   **Question:** Is Goal 4 narrowed to the sentences the sign-in and verify pages word
    themselves, or does the design add a mapping from sign-in error codes to catalog keys?
-   **Where:** The Problem (46-47); Goal 4 (84-85); Teach's sign-in step (272-273); plan items 8-9
    (630-631, 643-644); Verification Plan (836-837)
-   **Findings:** `6/C6`, `8/IZ3`
-   **Options:**
    -   **1. Narrow Goal 4.** Design: no change to items 8-9. `useErrorMessage()` shows the
        server's message unchanged and words only two sentences itself (the request never reached
        the server; a failure with no message). Document: Goal 4 and lines 46-47 cover only the
        client-worded sentences (invalid email, incomplete link, unreachable, generic) and say
        server messages stay English, as ADR 008 sets out. The manual check at 836-837 expects
        English for 'a wrong code'. Cost: a Chinese visitor reads English for a wrong code, an
        expired or used link, too many requests, a locked code and no Support access. Settles:
        both findings. A5 carries the wording.

        Backed by: 8/IZ3; 6/C6 (first of its two options).
    -   **2. Add a code-to-key mapping for the sign-in error codes.** Design: items 8 and 9 map
        `link_invalid`, `link_expired`, `code_invalid` and `code_locked` to new `portalAuth` keys,
        in both languages. Goal 4 then holds for those codes. Messages outside that list (rate
        limit, no Support access) stay English unless they are added. Cost: Stage 8 says this is a
        new i18n pattern against ADR 008 lines 86-87 and the brief's decision 8, so ADR 008 would
        need a change. More keys need Chinese text (A1). Settles: 6/C6. A5 then lists which codes
        are Chinese and which stay English.

        Backed by: 6/C6 (second of its two options); 8/IZ3 argues against it.

### D4. The Chinese path ends at an English personal application form - 🟡 Major

-   **Question:** How does the design deal with the personal application form
    (`apps/teach/src/routes/apply.tsx`), which is English and is the last step of CUJ 1?
-   **Where:** The Problem (50-51); Non-Goals (97-98); CUJ 1 (117-127, 'open the personal
    application' at 122); Risks table (330-339); `/teach` content (240-249)
-   **Findings:** `7/design-3`, `8/IZ4`
-   **Options:**
    -   **1. Correct the claim and record the English form as an accepted cost.** Design: no scope
        change. Document: lines 50-51 say the gap this design closes is the sign-in step, not that
        it is the only gap. CUJ 1 ends at the start page, which is what Goals 3 and 4 promise. One
        new risk row records that the personal application form and the review emails are English.
        The checker inferred the English review emails from ADR 008 71-72 and did not open the
        email templates; check them before writing the row. Cost: a Chinese reader meets an
        English form at the step where they apply. Settles: 8/IZ4. Answers 7/design-3 as an
        accepted cost: its either/or (translate the form, or say so on `/teach`) is declined.

        Backed by: 8/IZ4.
    -   **2. As above, and the `/teach` screen says the application is in English.** Design: one
        more sentence on `/teach`, so one more `learnerTeach.screen` key in two languages (A13
        gains a key). Lines 50-51 and the risk row are corrected as in the first option, with the
        same note about the review emails. Cost: Stage 8 notes the sentence goes stale when the
        form is translated, and it adds to the text the Chinese reviewer signs off (A1). Settles:
        both findings.

        Backed by: 7/design-3 (second of its two options); 8/IZ4 calls the sentence optional.
    -   **3. Translate the personal application form in the Teach PR.** Design: `apply.tsx`, a
        237-line English form, moves to the catalog in the Teach PR, with Chinese text and an
        AGENTS.md 'Translated pages' update. The Non-Goal at 97-98 changes. Lines 50-51 are still
        corrected: the review emails after the form stay English (inferred from ADR 008 71-72; the
        checker did not open the templates). Cost: Stage 8 says this contradicts the Non-Goal and
        the brief's own non-goal (brief 211-212). The Teach PR grows, and so does the Chinese text
        to review (A1). Settles: 7/design-3.

        Backed by: 7/design-3 (first of its two options); 8/IZ4 argues against it.

### D5. A signed-in learner still retypes their email in Teach - 🟡 Major

-   **Question:** For a learner who is signed in to the learner app, does the `/teach` button stay
    a plain link, or does it ask the API to email a Teach sign-in link to the learner's address?
-   **Where:** The weak point (61-64); Non-Goals (93-96); CUJ 2 (129-135); the `/teach` button
    (250-254); Risks row 333; Alternatives A and B (351-372); Future Improvements (515); plan item
    19 (752-756)
-   **Findings:** `5/Z3`
-   **Options:**
    -   **1. Keep the plain link for everyone.** Design: unchanged. A signed-in learner types
        their email again in Teach and asks for a code (risk row 333). Document: add the
        email-from-the-app idea to Alternatives Considered with the reason for not taking it, so
        the choice is no longer shown as only 'plain link or session hand-over'. Cost: the retyped
        email and the second request stay. Settles: 5/Z3 as a considered alternative.

        Backed by: No reviewer recommends this; it is the current design and follows the brief's
        decision (93-96).
    -   **2. For a signed-in learner, the button calls the existing sign-in request and shows 'we
        emailed you a sign-in link for Teach'.** Design: the button sends `{ email: user.email,
        audience: 'teach', locale, source: 'learner' }` to `POST /auth/magic-link`. Signed-out
        visitors keep the plain link. No new endpoint or token type, and no email in any URL. If
        the marker is kept (D1), `source` for these visitors starts in the learner app and no
        longer has to survive in the Teach tab between landing and a later sign-in. It still
        passes through `&from`, the pre-paint script and `sessionStorage` in the one page load
        (under Alternative K it is read from the magic-link row). If D1 deletes the marker, the
        request goes without `source`. Plan: item 19 gains a second branch with its own messages
        in two languages and tests; CUJ 2 changes. Cost: the inbox round trip stays. A press now
        sends an email, and accidental presses count against the per-email window the learner's
        own sign-ins use. Someone already signed in to Teach gets an email they do not need,
        unless a second 'Open Teach' link stays. A mail app's in-app browser may hold the Teach
        session outside the default browser. It reopens a decision the brief closed. Settles:
        5/Z3.

        Backed by: 5/Z3.

### D6. The language picker that the Support mitigation relies on is not on the sign-in page - 🟡 Major

-   **Question:** The sign-in page has no language control, so the first code email follows the
    browser. Does the design add a picker to the sign-in page, keep the risk row with corrected
    wording, or delete the risk row?
-   **Where:** Teach's sign-in step (276-283, 'Support staff can switch language' at 277); Risks
    row 339; Alternative L (476-484); plan item 8 (623-635); item 12 (675-676)
-   **Findings:** `7/style-6`, `9/implementation-readiness-4`, `8/IZ6`
-   **Options:**
    -   **1. Add `PreferencesButton` to `SignInPage`.** Design: item 8 adds the button to the
        shared sign-in page, for Teach and Support, and says whether `VerifyPage` gets it too. The
        mitigations at 277, 339 and 484 become true as written. The checker notes one existing
        example of the button on a signed-out page: apps/teach/src/routes/invitation.tsx 70-71.
        Cost: new UI on a shared page, and one more hand check, since `packages/web-ui` has no
        test runner. Settles: 9/implementation-readiness-4 and 7/style-6.

        Backed by: 9/implementation-readiness-4 (first of its two options).
    -   **2. Add no picker; keep the risk row and correct the wording.** Design: unchanged.
        Document: lines 277, 339 and 484 say the picker is in Settings, behind sign-in, and that
        the first code email follows the browser language. Item 8 says that no language control is
        added before sign-in. Cost: a visitor whose browser language is wrong for them gets the
        sign-in page and the code email in that language, and can change it only after signing in.
        Settles: 7/style-6 and 9/implementation-readiness-4.

        Backed by: 7/style-6; 9/implementation-readiness-4 (second of its two options).
    -   **3. Delete risk row 339 and the picker mitigation; state one rule.** Design: unchanged.
        Document: remove row 339 and the picker clauses at 277 and 484. State one rule: the code
        email is in the language of the page that asked for it. Under the Chinese design,
        Support's page follows the browser, so a Chinese email after a Chinese page is consistent
        behaviour, not a risk. Alternative L keeps its reason at 481-482. Stage 8 says this
        removes an exception from the Chinese design (its lines 420-421) and adds none. Cost: the
        document no longer records the Support agent with a Chinese browser as a risk. Settles:
        all three findings. Makes unnecessary: the 'the picker' part of A25.

        Backed by: 8/IZ6.

### D7. An owner whose `/me` answer failed or is out of date sees the banner - 🟡 Major

-   **Question:** When the session is `signed_in` but `user` is null (the `/me` request failed) or
    out of date (the owner applied in Teach after launch), does the banner show as an accepted
    cost, hide, or hide and refresh on return to the foreground?
-   **Where:** Goal 2 (75-76); The banner (222-227); Risks row 335; plan item 16 (716-722); item
    23 (800-806)
-   **Findings:** `8/IZ7`, `7/design-5`, `9/codebase-details-3`
-   **Options:**
    -   **1. Accept: the banner shows.** Design: unchanged. Document: row 335 gains a clause: an
        owner whose `/me` answer is stale, or failed offline, sees the banner, and pressing
        through leads to their own Teach page. Goal 2 and line 224 ('an owner never sees it
        flash') are loosened. Item 16 says that `signed_in` with `user` null shows the banner, and
        item 23 tests that state. Cost: a native app can stay in memory for days, so an owner who
        applied in Teach keeps seeing the banner until a cold start. The checker notes
        `refreshUser()` also runs after a Profile save and `signIn` sets the user; nothing
        refreshes on return to the foreground. Settles: 8/IZ7 for this part; 9/codebase-details-3
        (the state is decided and tested); 7/design-5 as an accepted cost.

        Backed by: 8/IZ7; 7/design-5 lists the accepted cost as one of its two options.
    -   **2. Hide the banner when signed in with no user.** Design: item 16's rule also returns
        false when the session is `signed_in` and `user` is null, with a test in item 23. Goal 2
        then holds for an offline owner. Staleness after applying in Teach is still stated as
        accepted in row 335; no foreground refresh. Cost: a signed-in learner who is offline also
        loses the banner until `/me` succeeds. Settles: 9/codebase-details-3 and the offline half
        of 7/design-5; the stale half as an accepted cost.

        Backed by: 9/codebase-details-3 asks for this state to be decided and tested, without
        picking a side; 7/design-5 lists the hide rule as part of its mechanism option. No
        reviewer recommends this exact mix.
    -   **3. Hide when signed in with no user, and refresh on return to the foreground.** Design:
        the hide rule as in the previous option, and `refreshUser()` is called when the app
        returns to the foreground. Goal 2 then holds for an offline owner and, after the next
        return to the foreground, for an owner who applied in Teach. Stage 8 notes nothing under
        `apps/` or `packages/` uses `AppState` today. Cost: a new listener in the learner session,
        its test, and additions to items 16 and 23. Settles: 7/design-5 and 9/codebase-details-3.

        Backed by: 7/design-5 (its mechanism option); 8/IZ7 argues against it.

### D9. The data flow shows a language on the Teach `sign_in` event that is always null - 🟡 Major

-   **Question:** Does the document record that the Teach `sign_in` event carries no language, or
    does the design carry the request language to the event? Not needed if D1 = delete the marker:
    the event line can leave the diagram.
-   **Where:** Data flow (209-212); Verify is unchanged (282-283); plan item 2 (556-557); item 8
    (635); item 9 (645)
-   **Findings:** `7/design-4`, `6/C22`, `9/codebase-details-10`
-   **Options:**
    -   **1. Record that the event has no language.** Design: unchanged. Document: line 212 shows
        `locale: null`, or drops `locale`, on `sign_in event { audience: teach, locale, source:
        learner }`. Plan item 2 (beside 'beside `audience` and `locale`') says the event's
        `locale` is always `null` for Teach and Support, so the language of banner arrivals is not
        recorded. The reason: Teach and Support send no `locale` at verify (282-283, 635, 645),
        and the Chinese design fills the property with `locale: input.locale ?? null`. Cost:
        banner arrivals cannot be split by language, although Goal 4 is about Chinese visitors.
        Settles: all three findings.

        Backed by: 6/C22; 9/codebase-details-10; 7/design-4 (first of its two options); 8/IZ7
        (listed under D7) says to remove `locale` from line 212.
    -   **2. Carry the request language to the event.** Design: the language of the sign-in
        request reaches the `sign_in` event without the account write. The document has to say
        how; no finding gives a path. It cannot be `locale` on the verify request: under the
        Chinese design that updates `users.locale` (learner-chinese.md 954-960), which line 283
        rules out. Line 212 then shows the carried value, and items 2, 8 and 9 describe the path.
        Cost: an addition to the API that only this event uses. Settles: 7/design-4; 6/C22 and
        9/codebase-details-10 are settled once the diagram and the plan match the new behaviour.

        Backed by: 7/design-4 (second of its two options); 8/IZ7 argues against it.

### D8. How much of Teach's process the `/teach` screen restates - 🟢 Nit

-   **Question:** Does the `/teach` screen keep its four sections, lose the six-step process, or
    shrink to a pitch plus the note that Teach is a separate site with its own sign-in?
-   **Where:** The `/teach` screen, what it says (240-249); plan item 19 (749-751); item 21
    (775-777)
-   **Findings:** `8/IZ9`, `5/Z6`
-   **Options:**
    -   **1. Keep the four sections.** Design: unchanged. A13 writes the English text of every
        screen key into the plan. Cost: the six steps restate a process Teach owns and can drift,
        as the document says a commission figure would (248-249). Every sentence also needs
        Chinese text and the reviewer's sign-off (A1). Declines 5/Z6 and 8/IZ9's point on the six
        steps; neither is settled.

        Backed by: No reviewer recommends this; it is the current design.
        9/implementation-readiness-2 (listed under A13) asks for the full text and takes no side
        on cutting.
    -   **2. Cut the six-step process.** Design: remove the 'how it works' section from `/teach`
        (the `.how.title` and `.how.step1` to `.how.step6` keys) before any sentence is added to
        the screen. 'Who can teach', 'the fee' and the sign-in note stay. Lines 240-249, item 19
        and item 21 shrink to match. Cost: the screen no longer tells a visitor about the review
        steps before they leave the app. The checker notes Teach's start page says only who each
        application is for; it does not describe the review steps, payment or the fee. Settles:
        8/IZ9's point on the screen, and 5/Z6 in part. A13 covers seven fewer keys, and A1 has
        less Chinese text to review.

        Backed by: 8/IZ9.
    -   **3. Cut to a pitch plus the note that Teach is a separate site with its own sign-in.**
        Design: 'who can teach' and 'the fee' go as well as the six steps. The screen keeps its
        title, intro, sign-in note and button. Lines 240-249, item 19 and item 21 shrink to match.
        Cost: the visitor leaves the app without reading who can apply or that Elevate takes a
        commission. Only 'who can teach' duplicates text Teach's start page already has, so the
        fee and the review steps are then stated nowhere before sign-in. Alternative E's rejection
        ('a screen explains more before anyone leaves') has less to stand on. Settles: 5/Z6 in
        full and 8/IZ9's point on the screen. A13 shrinks to about four keys.

        Backed by: 5/Z6.

### D10. A build with no Teach address ships a link to port 5173 - 🟢 Nit

-   **Question:** When a build outside development has no `EXPO_PUBLIC_TEACH_URL`, does the link
    fall back to port 5173 as designed, does the build or deploy fail, or is the feature switched
    off?
-   **Where:** `teachUrl()` (255-256); Configuration (260-264); Goal 6 (88-89); Rollout and
    rollback (344); plan item 14 (692-698); item 22 (783-792); Test Coverage Requirement (829)
-   **Findings:** `5/Z10`
-   **Options:**
    -   **1. No check: keep the fallback in every build.** Design: unchanged. `teachUrl()` stays
        non-nullable and no build check is added. Native values are fixed in `eas.json` (787-788),
        and `vars.TEACH_URL` already feeds Support's build, so the empty-variable case is the web
        build only. Cost: a deployed web build with an empty `vars.TEACH_URL` ships a link to port
        5173 on the learner host, with no warning. 5/Z10 is declined and recorded as an accepted
        cost.

        Backed by: 8/IZ7 (listed under D7).
    -   **2. Fail the build or the deploy when the address is missing.** Design: `teachUrl()`
        stays non-nullable. The deploy step (deploy.yml 150-159, which passes `vars.*` with no
        check) or the build fails when `EXPO_PUBLIC_TEACH_URL` is empty outside development. Item
        22 gains the check. No nullable return and no new branch in the app. Cost: one check in
        the workflow. Native is unaffected, because `eas.json` fixes the values for `preview` and
        `production`. Settles: 5/Z10's problem (a dead link shipped silently), by a different
        mechanism from the one it proposes.

        Backed by: design-7 point 2, merged into 7/style-7 (listed under A9): 'Hide the banner or
        fail the build when the variable is missing, instead of falling back'. 5/Z10 names a
        build-time warning or deploy check as needed beside its own proposal.
    -   **3. Outside development, a missing address means 'feature off'.** Design: outside
        `__DEV__`, `teachUrl()` returns null, `useTeachBanner` reports not visible, and `/teach`
        renders without its button. This gives the web a configuration-level off switch for Goal 6
        (A9 changes wording). Cost: the nullable return reaches every caller and adds a branch
        that line 829 requires a test for (A16). Silent hiding can mask a wrong configuration, so
        it still needs a build-time warning or deploy check. Native still needs a store build
        either way. Additions to items 14, 16, 19 and 23. Settles: 5/Z10.

        Backed by: 5/Z10; design-7 point 2 (merged into 7/style-7, listed under A9) also lists
        hiding the banner.

### D11. The Tailscale sentence in Terms: delete it or move it with its consequence - 🟢 Nit

-   **Question:** Is the sentence 'Staging is reachable only over Tailscale' deleted, or moved to
    where it affects who can open the link, with the consequence stated?
-   **Where:** Terms (166-167); Configuration (261-262); plan item 22 (787-788)
-   **Findings:** `6/C20`, `7/style-15`
-   **Options:**
    -   **1. Delete the sentence.** Document: delete the sentence at 166-167. A preview tester off
        the tailnet cannot use the app at all: the `preview` profile points the app's API at
        staging, which answers 403 off the tailnet. So no consequence for the Teach link needs
        stating. Settles: 7/style-15, which allows dropping. 6/C20 is declined, not settled: it
        asks for the consequence to be stated.

        Backed by: 8/IZ9 (listed under D8); 7/style-15 allows dropping the sentence.
    -   **2. Move it and state the consequence.** Document: move the sentence from Terms to the
        `preview` profile at 261-262 or to the verification step, and add the consequence: a
        `preview` build's Teach link needs a device on the tailnet. Cost: one more sentence to
        keep true. Settles: 6/C20 and 7/style-15.

        Backed by: 6/C20; 7/style-15 (relocating is its first choice).

### D12. Alternative G holds two positions under one heading - 🟢 Nit

-   **Question:** Does Alternative G stay one heading with two positions (above 'Load more', and
    inside the grid), or is it split into two alternatives?
-   **Where:** Alternative G (421-432)
-   **Findings:** `7/structural-6`
-   **Options:**
    -   **1. Leave it as one heading.** Document: unchanged. Both positions share one reason for
        rejection (430-432). 7/structural-6 is declined, not settled: every other alternative is
        one option per heading.

        Backed by: 8/IZ9 (listed under D8).
    -   **2. Split it into two alternatives.** Document: two alternatives, one per position, each
        with its own pros, cons and reason. The alternatives after it may need new letters, and
        references to them change with that. Cost: more text for the same rejection. Settles:
        7/structural-6.

        Backed by: 7/structural-6.

### D13. Where the `from` allow-list lives, if the marker is kept - 🟢 Nit

-   **Question:** If D1 keeps the marker, do both pre-paint scripts keep checking `from`
    themselves, or do they move the raw value and leave the check to `arrivalSource()`? Not needed
    if D1 = delete the marker.
-   **Where:** Counting arrivals, Keeping the marker in Teach (290-295, 'a valid `from` value' at
    292); plan item 7 (613-621); item 11 (655-664, 'When `?from` is `learner`' at 661); item 13
    (683-686)
-   **Findings:** `5/Z11`
-   **Options:**
    -   **1. Keep the check in both scripts.** Design: unchanged. The allow-list is in three
        places: the zod enum and both hand-copied `preferences-init.js` files. The scripts are
        untyped and untested (683-686), and they are kept in step only by a comment
        (apps/teach/public/preferences-init.js line 8). A new source means three edits. Only a
        checked value ever reaches `sessionStorage`. 5/Z11 is declined.

        Backed by: No reviewer recommends this; it is the current design.
    -   **2. The scripts move the raw value; `arrivalSource()` is the single allow-list.** Design:
        items 11 and 290-293 change so the scripts do only what must happen before the router
        reads the URL: move the raw `from` value, length-capped, into `sessionStorage` and strip
        it from the address bar. `arrivalSource()` already validates against `arrivalSourceSchema`
        on read (619-620), so it becomes the single allow-list and a new source is a one-line core
        change. Cost, as 5/Z11 states it: an unvalidated, capped, attacker-chosen string sits in
        `sessionStorage` until read; validation moves from entry to use, so every future reader
        must go through `arrivalSource()`; Support still carries the move-and-strip code for a
        link nothing sends it. The strip has to stay in the pre-paint script, because
        `RequireAuth` copies `location.search` into `redirect`
        (packages/web-ui/src/portal/auth.tsx:136) and the router is created at module load.
        Settles: 5/Z11.

        Backed by: 5/Z11.

## Action items

These are edits to the document. "Depends on" says which decision option removes or changes an
item.

### A1. Supply the Chinese text or state the process and merge gate for it - 🔴 Blocker

-   **Change:** Resolve Question 1 in the plan. Either put the Chinese strings beside the English
    ones in items 5 and 21, or state the process: who drafts, who signs off, and that sign-off is
    a merge condition for both pull requests, as learner-chinese.md does (its line 556 and its
    risk table for its PR 2 and PR 3). Say why this cannot wait: the `.zh.ts` files cannot be left
    empty, because a Chinese area is checked against its English file with `satisfies` and
    `packages/i18n/test/catalog.test.ts` fails on untranslated keys, so neither pull request can
    meet lines 522-523 without the text. Note that learner-chinese.md item 50 forbids machine
    translation. Update risk row 336 to name the gate, not only the reviewer.
-   **Where:** Open Questions, Question 1 (108-110); Risks row 336; plan opening (522-523); item 5
    (579-602, 'written by a person' at 602); item 21 (766-779)
-   **Depends on:** Not removed by any decision. D3 (mapping), D4 (translate the form, or add a
    sentence) and D8 (cut or keep `/teach` sections) change how many keys need Chinese text.
-   **Findings:** `9/implementation-readiness-1`, `7/design-10`

### A2. Use one name for the sign-in catalog area - 🟡 Major

-   **Change:** Change `auth` to `portalAuth` at line 269 ('in a new `auth` area') and at 505
    ('the new `auth` and `learnerTeach` areas'). The plan uses `portalAuth` for the files, keys,
    `blurbKey` values and the parity test, and 5/Z9 recommends the plan's name; the other
    reviewers accept either direction. Name the area once in the specification half. 5/Z9's second
    point, the 'PR 1' to 'PR 4' labels, is handled in A23.
-   **Where:** Teach's sign-in step (269); Additional Resources (505-506); against plan items 5-6
    (581-609), 8 (628), 9 (642), 10 (651-652) and the Verification Plan (826)
-   **Findings:** `6/C1`, `7/structural-2`, `9/style-2`, `5/Z9`

### A3. Describe the existing sign-in flow once - 🟡 Major

-   **Change:** Add one description before the counting section relies on it: (a) 'sign-in
    request', 'magic-link', `requestMagicLink` and `magicLinkRequestSchema` are the same request;
    (b) it sends one email that holds both a link and a 6-digit code (today only the message
    string at 590-591 shows this); (c) there are two verify paths, the code typed on `SignInPage`
    and the token from the link on `VerifyPage`, and these are the two branches of
    `verifyRequestSchema` (289); (d) the emailed link lands on Teach's verify route, where
    `preferences-init.js` runs and `VerifyPage` reads `from` back; (e) what `audience` is (used at
    127, 209 and 303, never defined).
-   **Where:** New short paragraph in Terms (161-175) or at the top of Counting arrivals (285); it
    serves 22-25, 48, 127, 209-212, 278-283, 287-303
-   **Depends on:** If D1 = delete the marker, the counting section goes and most of this is
    unnecessary; keep only (b) and, if `audience` is still used, (e). If D1 = Alternative K, point
    (d) changes: the link no longer carries `&from`.
-   **Findings:** `6/C2`

### A4. Define Support in Terms - 🟡 Major

-   **Change:** Add a Terms entry: Support is the internal staff portal (`apps/support`), which
    shares `SignInPage` and `VerifyPage` with Teach. Add one sentence in Counting arrivals saying
    that Support's `preferences-init.js` stores the arrival marker only because the two copies of
    the script are kept identical (658); the banner links only to Teach.
-   **Where:** Terms (161-175); used at 39-40, 99, 256, 276-277, 290-293, 339, 657-664
-   **Depends on:** If D1 = delete the marker, the second sentence is unnecessary. 8/IZ6 (D6) asks
    for the same one-clause definition.
-   **Findings:** `6/C5`

### A5. Qualify Goal 4 and say what `useErrorMessage()` does - 🟡 Major

-   **Change:** Three edits. (1) State the stored-language exception: `lang` is stored only when
    Teach has nothing stored (204), so a language already stored in Teach wins over `?lang`; say
    so in Goal 4 or in the sign-in section. (2) At 272-273, say what `useErrorMessage()` does: it
    shows the server's message unchanged and words only two sentences itself (the request never
    reached the server; a failure with no message). This removes the apparent contradiction with
    'API messages stay English'. (3) Say which sign-in errors end up Chinese and which stay
    English, and bring Goal 4 and 46-47 into line. Stage 8's wording for Goal 4, if D3 = narrow:
    'on a first visit, the sentences the sign-in and verify pages word themselves, the code email
    and the start page are in Chinese; server messages stay English; a language already stored in
    Teach wins'.
-   **Where:** The Problem (46-47); Goal 4 (84-85); Data flow (204); Teach's sign-in step
    (272-273)
-   **Depends on:** D3 sets edit (3): narrowing lists the server-worded errors as English; the
    mapping option lists the four mapped codes as Chinese. Edits (1) and (2) apply either way.
-   **Findings:** `6/C4`, `6/C9`, `7/design-6`

### A6. Calibrate two claims in The Problem - 🟡 Major

-   **Change:** Line 39-40: replace 'Support's portal is the only app that knows `TEACH_URL`
    (`VITE_TEACH_URL`)' with 'Support is the only client app that reads Teach's address
    (`VITE_TEACH_URL`)'. The API also reads `env.TEACH_URL`
    (apps/api/src/services/media.service.ts:56). Lines 56-57: replace 'every potential teacher who
    reaches Elevate as a learner is lost unless Elevate contacts them some other way' with the
    checkable fact, for example 'a learner who might teach has no path from the learner app to
    Teach, and nothing counts such learners'.
-   **Where:** The Problem, 'Learners can't find Teach' (39-40); 'What it costs' (56-57)
-   **Findings:** `7/style-1`, `7/style-8`

### A7. Correct where a profile holder lands in Teach - 🟡 Major

-   **Change:** Replace 'the portal' with 'the profile's page: the portal if approved, otherwise
    its application status' at 81, and match it at 24-25 ('an existing teacher into the portal'),
    214 ('profile -> portal') and 335 ('takes an owner into their portal'). `HomeRedirect` sends
    any profile holder to `/p/:profileId`; `ProfileGate` (gate.tsx 40-59) shows `PendingPage` or
    the application for a profile that is not approved, and the set-up steps for a company with no
    active payout account. CUJ 3 names an `applied` owner, who would not land in the portal.
-   **Where:** Overview item 3 (24-25); Goal 3 (81); Data flow (214); Risks row 335
-   **Findings:** `7/style-3`

### A8. Limit the in-app browser claim behind Alternative M to iOS and cite it - 🟡 Major

-   **Change:** The document says 'the in-app browser's storage is separate from the default
    browser's' (492-495) and that the default browser is 'where a Teach session lasts' (252-254),
    with no source. The checker did not test on a device but read the platform documents. The
    claim holds on iOS (Expo WebBrowser page,
    https://docs.expo.dev/versions/v58.0.0/sdk/webbrowser/: 'On iOS, the modal Safari will not
    share cookies with the system Safari') and does not hold for Android Custom Tabs, which share
    the browser's cookies (developer.chrome.com/docs/android/custom-tabs: 'Shared cookie jar and
    permissions model'). State Alternative M's reason for iOS only and cite the Expo page, and
    correct 'where a Teach session lasts' at 252-254 the same way. Stage 8 (8/IZ9, listed under
    D8) says the same: one platform is enough to reject the alternative.
-   **Where:** The `/teach` button, native (252-254); Alternative M (492-495)
-   **Findings:** `7/style-4`

### A9. Restate Goal 6 in the rollback section's words - 🟡 Major

-   **Change:** Drop 'easy' and 'one change'. Say what line 344 says: turning the banner off is a
    revert of the learner pull request on web and a store build on native, installed native builds
    keep the banner until users update, and nothing in Teach depends on it. The two other points
    merged into this finding are handled elsewhere: the silent fallback in D10, and 'both
    `eas.json` build profiles' in A18.
-   **Where:** Goal 6 (88-89), against Rollout and rollback (344)
-   **Depends on:** If D10 = a missing address means 'feature off', the web also has a
    configuration-level off switch; say so here. If D1 and D2 cut the marker and dismissal,
    removal is a revert of one pull request on web.
-   **Findings:** `7/style-7`

### A10. Keep each fact in one half of the document - 🟡 Major

-   **Change:** Stage 8 raises this because the two copies have already drifted (area name, the
    quoted sentence, 'when it was sent'). Delete the second copy; do not synchronise two. (1) In
    the Technical Plan, state the rule and the interface and leave literals to the plan: the
    `profiles.some(...)` expression (225), the storage key and value (230-231),
    `window.location.assign` and `Linking.openURL` (251-252), the `try`/`catch` placement
    (296-297) and the zod expression (287-289). (2) Give `useTeachBanner` one form: the plan has
    `useTeachBanner(searching: boolean)` (716), the specification `useTeachBanner()` (222). (3)
    Cut 'Decisions made while drafting' to items 1 and 2, the two brief questions that line
    112-113 points to; items 3 to 5 repeat 'The banner' and 'Counting arrivals'. The checker notes
    item 1 repeats 'The banner' too, so what sets items 1 and 2 apart is the link to the brief's
    questions. (4) State the reason for rejecting the session hand-over once, in Alternative A,
    and link to it from 61-64, 93-94 and 333. The checker found the reason given three times
    (63-64, 93-94, 356-362), not six.
-   **Where:** Decisions made while drafting (177-190); Technical Plan literals at 222, 225,
    230-234, 250-256, 287-289, 296-300, against the plan at 545-547, 554, 619-620, 694-698,
    706-710, 716-722, 753-756; hand-over mentions at 29, 61-64, 93-94, 333, 351-362, 515
-   **Depends on:** D1 = delete removes drafting decision 5 and lines 287-300; D2 = drop removes
    decision 4 and lines 230-234. The rest applies either way. Do (3) together with A11, which
    removes the links to decisions 3 to 5.
-   **Findings:** `5/Z8`, `8/IZ5`, `7/style-22`, `9/style-11`

### A11. Fix the 'Reason for Rejection' lines - 🟡 Major

-   **Change:** (1) In Alternatives C to J, drop 'Rejected by author ([drafting decision
    N](#decisions-made-while-drafting))' and let the stated trade-off stand. The link points only
    at this document's own list, which is not an outside record. This also makes C to J match K, L
    and M, which already give a bare reason. 7/structural-1 allows the other fix, linking a real
    record of the decision, if one exists; 8/IZ5 (listed under A10) recommends dropping. (2)
    Alternative A, line 360: the brief's 'Alternatives weighed' records the hand-over as 'Rejected
    by author in favour of a plain link' (brief line 240), not as rejected in the brainstorm
    review. Make the label match. Alternative B's label is right. The reason at 360-362 also goes
    beyond the brief (7/style-10, merged into 7/structural-3): 'the security design costs more
    than the one sign-in it saves, while the pilot is small' sits under a link to the brief, but
    the brief's reason is only the code exchange and its security design (brief 240-241). Either
    give only the brief's reason (a new one-time code exchange and its own security design), or
    mark the cost comparison and the pilot-size clause as this design's own reasoning, not the
    brief's. (3) Lines 383, 393 and 396: stop giving 'the brief's rule is owners only' as the
    reason. The brief left 'owners only, or any member?' open as Question 6, which this design
    answers (179). Cite drafting decision 1, or state the reason itself.
-   **Where:** Alternatives A (360-362), C (382-384), D (393-396), E (404-405), F (417-418), G
    (430-431), H (440-441), I (451-452), J (462-463); K, L, M (473-474, 483-484, 494-495)
-   **Depends on:** D1 and D2 rewrite Alternatives H, I, J and K; apply (1) to whatever remains.
    D12 = split changes which headings (1) covers.
-   **Findings:** `7/structural-1`, `7/structural-5`, `7/structural-3`, `7/style-11`

### A12. Put one 'relies on' list for the Chinese design, and fix the tenses - 🟡 Major

-   **Change:** (1) At 309-311, put a single list: the Chinese design is still Proposed, and this
    design uses its resolved language, `locale` on the sign-in request, the `?lang` hand-off in
    Teach, and the learner catalog areas. This pins the behaviours relied on, which is one of the
    two fixes 7/design-11 offers (the other is a risk row for the Chinese design changing or
    slipping). (2) Add the `sign_in` event to that list: nothing sends it today, and the Chinese
    design's PR 1 adds it. Say so at 188-190 or 302. (3) Fix 'already' where the code does not
    exist yet: 290-291 becomes 'will read `?lang` once the Chinese design's PR 4 lands'; same at
    33-34 ('which resolves the language and adds the `?lang` hand-off') and 324 ('is already
    covered by'). (4) Reword 282 to 'Teach's verify request is unchanged, so signing in to Teach
    never writes the account language', so `localeChosen` needs no definition. (5) Line 48
    ('because Teach's sign-in request sends no language') is true only after the Chinese design:
    no sign-in request has a language field today (packages/core/src/contracts/auth.ts 5-10). Say
    so. Lines 50 and 97 ('already translated') are true today (the AGENTS.md 'Translated pages'
    rule lists the Teach dashboard and start page) and can stay. (6) 6/C3 also asks what the
    resolver reads and what it yields, so that CUJ 1's '`zh-SG` browser' giving Chinese (119-124)
    can be followed. Stage 8's list does not include it; one clause inside the list covers it.
-   **Where:** Overview (33-34); The Problem (48, 50); Non-Goals (97); Terms (173-175); Verify is
    unchanged (282-283); Counting arrivals (290-291, 302); Order of release (309-311); Records and
    rules (321-324); drafting decision 5 (188-190)
-   **Depends on:** If D1 = delete the marker, edit (2) is unnecessary. Use A23's names for this
    design's pull requests in the list.
-   **Findings:** `8/IZ8`, `6/C3`, `6/C21`, `7/style-2`, `7/design-11`

### A13. Write the `/teach` screen's English text into the plan and name the back-link key - 🟡 Major

-   **Change:** Give the English text word for word for each key that has only a name:
    `learnerTeach.screen.title`, `.intro`, `.who.title`, `.who.body`, `.how.title`, `.how.step1`
    to `.how.step6`, `.fee.title`, `.fee.body` and `.signInNote`, as item 5 and the banner keys in
    item 21 do. Delete line 779 ('The English text of the screen is written in this PR'): the text
    makes claims about who may teach, the review steps and the commission, so it is a content
    decision. Name the message key for the back link's label at 757: a new `learnerTeach` key, or
    the existing `nav.explore` (packages/i18n/src/messages/areas/chrome.en.ts:13).
-   **Where:** Plan item 19 (744-757; content at 749-751, back link at 757); item 21 (766-779;
    screen keys at 775-777, line 779)
-   **Depends on:** D8 changes the key list: cutting the six steps removes the seven `.how.*`
    keys; cutting to a pitch also removes `.who.*` and `.fee.*`. D4 (second option) adds one key.
    Not unnecessary under any option.
-   **Findings:** `9/implementation-readiness-2`

### A14. Move the `/teach` test out of Expo Router's `app/` directory - 🟡 Major

-   **Change:** Replace `apps/learner/src/app/__tests__/teach.test.tsx` with a path outside
    `app/`, for example `apps/learner/src/__tests__/teach.test.tsx`. Every file under `app/` is
    treated as a route, so the likely effects are a stray `/__tests__/teach.test` route and
    jest-only imports in the `npx expo export --platform web` bundle (823). The reviewer did not
    run a build to confirm. The jest `testMatch` `**/__tests__/**/*.test.ts?(x)` still finds the
    new path. Say how the screen is rendered: `renderRouter` with `TestProviders`, as the Chinese
    design's sign-in test does, or a direct render of the default export. Fix learner-chinese.md
    item 55 (`app/__tests__/sign-in.test.tsx`) the same way.
-   **Where:** Plan item 23 (794-809; path at 796-797); Verification Plan (823)
-   **Findings:** `9/implementation-readiness-3`

### A15. Settle the composition choices in items 17 to 19 - 🟡 Major

-   **Change:** (1) Close button: name the component and icon, for example `IconButton`
    (`apps/learner/src/ui/IconButton.tsx`), which takes `icon`, `label` (as `accessibilityLabel`)
    and `testID`. (2) Banner placement: `apps/learner/src/app/(tabs)/index.tsx` 121-172 is a
    four-way ternary. Pick one and state it: inside the list branch's wrapper (155-171, gap
    `space[5]`) and again beside the empty state (142-153); or once after the ternary in the outer
    `View` (gap `space[6]`), behind `!courses.isPending && !courses.isError`. Word the condition
    as 220-221 does: the first page has loaded and no filter is active, including an empty
    catalog. The `items.length === 0` branch has no list or 'Load more', and it is mostly reached
    while searching, when `visible` is already false. (3) `/teach` container: say whether it uses
    `Screen` and which `bottomInset`; `course/[slug].tsx:163` uses `Screen bottomInset={isWideWeb
    ? 0 : TAB_BAR_HEIGHT}`. (4) Give the `variant` of the 'Find out more' button. (5) Give the
    `/teach` screen's text variants, and say whether the six steps are numbered. (6) Say the
    platform branch is `Platform.OS === 'web'` in the one file, as
    `apps/learner/src/app/checkout/[courseId].tsx:61` does. (7) Say whether a `Linking.openURL`
    rejection is swallowed; `apps/learner/src/components/RichText.tsx:35` uses `.catch(() => {})`.
    (8) Say whether the back link uses `href="/"` or `router.back()`; in `course/[slug].tsx`
    160-174 it is a `Link` wrapping a `Pressable` with `ArrowLeft` and the text 'Explore'. The
    back-link label key, which this finding also raises, is in A13.
-   **Where:** Plan item 17 (726-732); item 18 (738-742); item 19 (746-757)
-   **Depends on:** If D2 = drop dismissal, (1) is unnecessary. If D2 = collapse to a link, (1)
    also has to name the collapsed state's component. If D8 cuts the six steps, the step layout in
    (5) goes.
-   **Findings:** `9/codebase-details-5`, `9/implementation-readiness-6`

### A16. Make the test list meet the plan's own coverage requirement - 🟡 Major

-   **Change:** Add tests, or narrow line 829, for: the 'flag is unread' branch (719); a failed
    read counting as not dismissed and a failed write being ignored (709-710); `teachUrl()` (the
    env value, the trailing slash, the localhost rule, the dev-host fallback); the web branch of
    the button (`window.location.assign`; `apps/learner/jest.setup.ts:1` runs iOS resolution
    only); and Explore hiding the banner while loading and after a load error (741-742). In item
    4, say that the 'Teach verify sends no `locale`' case and the token-verify case use raw
    `api()` calls with `dev.link`: the `signIn()` helper sends `locale` on both requests
    (learner-chinese.md item 17) and verifies by code only (apps/api/test/helpers/test-app.ts
    70-81).
-   **Where:** Verification Plan, Test Coverage Requirement (829-830); item 23 (800-809); item 4
    (566-577); item 15 (709-710); item 16 (719); item 18 (741-742)
-   **Depends on:** If D2 = drop dismissal, the flag-unread and failed read/write tests are
    unnecessary. If D1 = delete the marker, the '`source` for each of the three requests'
    requirement at 829-830 and item 4's `source` cases go; the no-`locale` verify case stays. D7
    adds a test for the signed-in-with-no-user state. D10 adds a test for a null `teachUrl()` if
    that option is taken.
-   **Findings:** `9/codebase-details-6`

### A17. State the Support check as its own step, and reword 'the rules' - 🟡 Major

-   **Change:** (1) Lines 685-686 say the pages and scripts are 'checked by hand in CUJ 1, in
    Teach and in Support', and 833 says 'CUJs 1, 3, 4 and 5 on learner web, against local Teach
    and Support'. CUJ 1 covers learner web and Teach only; CUJs 3, 4 and 5 touch neither portal.
    Write the Support check as a separate step with its URL and what is asserted (Chinese text,
    `from` gone from the address bar, `elevate.from` in session storage), and stop attributing it
    to CUJ 1. (2) Line 684: replace only the subject, 'The rules', with 'The server's `source` and
    `locale` handling, and catalog parity,' so the sentence reads 'The server's `source` and
    `locale` handling, and catalog parity, are covered by item 4's API tests and the i18n parity
    test.' Two rules have no automated test and should be named as hand-checked: the schema check
    in `arrivalSource()` (619-620) and the `from === 'learner'` check in `preferences-init.js`
    (661).
-   **Where:** Plan item 13 (684-686); Verification Plan manual walkthrough (833, 836-837)
-   **Depends on:** If D1 = delete the marker, drop `from`, `elevate.from` and `source` from both
    edits; the Support check asserts only the Chinese text. If D2 = drop dismissal, CUJ 4 leaves
    line 833. If D3 = narrow, 836-837 also says a wrong code shows English. D13 changes which
    script rule is hand-checked.
-   **Findings:** `9/style-3`, `9/style-7`

### A18. Make the comparisons, scheme and fallbacks in the `teachUrl()` item exact - 🟡 Major

-   **Change:** Line 697-698 says the fallback works 'as `webBaseUrl()` does' and 'mirrors
    Support's `teachUrl()`'. Each matches only part. `webBaseUrl()`
    (apps/learner/src/lib/web-url.ts) has no `localhost`/`127.0.0.1` rule, returns
    `window.location.origin` on web and uses port 8081; only the native `hostUri` lookup matches.
    Support's `teachUrl()` (apps/support/src/lib/urls.ts) matches the env, localhost and port 5173
    rule on web, has no native branch, and takes the scheme from `window.location.protocol`.
    Rewrite 696-698 so the web rule is compared to Support's `teachUrl()` and the native host
    lookup to `webBaseUrl()`. State the scheme the new function uses on web and on native
    (`webBaseUrl()` hard-codes `http://`). State the last resort when `hostUri` is absent:
    `webBaseUrl()` ends in `http://localhost:8081`, so the match would be `http://localhost:5173`.
    In item 22 (787-788), say the `development` profile is left on the fallback on purpose. At
    261, replace 'both `eas.json` build profiles' with 'the `preview` and `production` profiles':
    apps/learner/eas.json has three, and `development` has no env block.
-   **Where:** Plan item 14 (696-698); item 22 (787-788); Configuration (261)
-   **Depends on:** A10 reduces 255-256 to the rule; this action rewrites 696-698 and the two
    profile lines only. If D10 = a missing address means 'feature off', the fallback text is
    rewritten anyway; keep the comparisons accurate for the development case.
-   **Findings:** `9/style-4`

### A19. Small fixes to the arrival-marker text - 🟢 Nit

-   **Change:** (1) Overview: 'It does four things' leaves out arrival counting, which is Goal 5
    and has its own section; add it as a fifth item. (2) Line 300: replace 'when it was sent' with
    the plan's wording at 554, 'when `input.source` is set'. (3) Row 338: replace 'which covers
    the usual case' with 'which covers sign-in through the emailed link'; nothing shows which path
    is usual. (4) Lines 346-347: 'Older clients that still send `source` or `locale`' are in fact
    cached builds of the reverted pages talking to a reverted server. Say 'cached builds of the
    reverted pages that still send `source`', and drop `locale`: it comes from the Chinese design,
    so the server keeps accepting it.
-   **Where:** Overview (16-27); Counting arrivals, On the server (300); Risks row 338; Rollout
    and rollback (346-347)
-   **Depends on:** If D1 = delete the marker, (1), (2) and (3) are unnecessary and (4) reduces to
    fixing the sentence about `locale`. If D1 = Alternative K, (2) goes (no `&from` on the link)
    and row 338 is reworded for the cross-tab case only.
-   **Findings:** `6/C10`, `6/C15`, `6/C16`, `7/style-13`

### A22. Make 'Success measure' a measure, or rename it - 🟢 Nit

-   **Change:** The line names two counts and no threshold. Either state a decision rule (when the
    count is read, and what result moves or removes the banner), or rename it 'Measurement', or
    point it at an open question about a target, as learner-chinese.md does (its lines 1672-1673).
    Stage 8 (8/IZ1, listed under D1) says the one-sentence decision rule should be added whichever
    way D1 goes.
-   **Where:** Verification Plan, Success measure (839-840)
-   **Depends on:** D1 sets which count is named: `sign_in` events with `source: 'learner'` if the
    marker is kept; first applications (`teacher_applied`, `reapply: false`, minus the
    hand-recruited teachers) if it is deleted.
-   **Findings:** `9/style-15`

### A23. Stop using 'PR 1' to 'PR 4' for two designs - 🟢 Nit

-   **Change:** 'PR 1' to 'PR 4' mean the Chinese design's pull requests at 291 and 309-311, and
    this design's at 317, 344 and 346; 'the next store build after PR 2' (317) follows directly
    after the other design's 'PR 2'. Call this design's two pull requests 'the Teach PR' and 'the
    learner PR' throughout, including the plan (Stage 8's wording, 8/IZ8, listed under A12). The
    other acceptable fix is to qualify each number ('this design's PR 2', 'Chinese PR 2').
-   **Where:** Counting arrivals (291); Order of release (309-317); Rollout and rollback (344,
    346); plan (522-532, headings at 538 and 688)
-   **Findings:** `6/C14`, `7/structural-8`

### A24. Quote the Chinese design's sentence once, verbatim, with one verb - 🟢 Nit

-   **Change:** Line 280 quotes 'Teach and Support send no `locale`'; the real sentence
    (learner-chinese.md line 420), quoted correctly at 675, is 'Teach and Support send none, so
    their links carry no `lang`'. Keep one verbatim quote. Either quote it verbatim at 280 as well
    (7/structural-7), or remove the quote at 280-281 and let item 12 carry it (8/IZ5, listed under
    A10). Use one verb for what happens to the sentence: 280-281 says it 'is amended', 675-676
    says it 'gains a pointer'. After the Teach PR the sentence is false, so these are different
    edits; pick one and use it in both places.
-   **Where:** Teach's sign-in step, The code email (280-281); plan item 12 (675-676)
-   **Depends on:** D6 (delete the risk row and state one rule) also touches the Chinese design's
    exception at its lines 420-421; write item 12's edit to match. A32 asks for the exact text of
    that edit.
-   **Findings:** `6/C17`, `7/structural-7`, `9/style-12`

### A25. Say what each name is on first use - 🟢 Nit

-   **Change:** (1) Call learner-main-page-improvements.md 'the brief' where it is first linked
    (31-32); 'the brief' is used from line 64 and named only at 361 and 501. Explain or drop
    'brainstorm review' (360, 370) and 'Goldfish review' (502). (2) 'As the hero is' (157, 185):
    say what the hero is (the scene at the top of Explore, hidden while a search or category
    filter is active), or drop the comparison. (3) 'The catalog' means the course catalog at 221
    and the message catalog at 269: write 'course list' at 220-221 or 'message catalog' at 269.
    Define 'area' on first use (269). Link ADR 008 at 273, where it is first cited, not only at
    505. (4) Describe `preferences-init.js` once (204 or 290): the portal's pre-paint script,
    loaded from `index.html` before the app starts. (5) Say that Profile is the learner app's
    Profile tab (232-233, 334, 512), that `PreferenceRows` is the portals' preferences list, where
    `preferences-storage` lives, and that 'the picker' is the language picker in the portals'
    preferences (339, 484). (6) Name the new `learnerTeach` catalog area in 'The banner' or 'The
    `/teach` screen' (217-256); it first appears in the resources list at 505-506.
-   **Where:** Overview (31-32) and 64, 93, 112; Alternatives A and B (360, 370) and Additional
    Resources (502); CUJ 5 (157) and drafting decision 3 (185); The banner (220-221, 232-233);
    Teach's sign-in step (269, 273); Data flow (204) and Counting arrivals (290); Risks rows 334,
    339; Alternative L (484); Future Improvements (512); Additional Resources (505-506)
-   **Depends on:** If D2 = drop dismissal, the `PreferenceRows`, `preferences-storage` and
    Profile mentions go and most of (5) is unnecessary. If D6 = delete the risk row, 'the picker'
    goes too. (4) is still needed if D1 deletes the marker, because the script still handles
    `lang` in the data flow.
-   **Findings:** `6/C7`, `6/C11`, `6/C12`, `6/C13`, `6/C18`, `7/structural-4`

### A26. Fix the cons of Alternatives C and D - 🟢 Nit

-   **Change:** Line 381: delete 'A rejected applicant, whom Teach lets resubmit, never gets it
    either'. The chosen rule hides the banner from owners 'at any status' (179-180), so it has the
    same effect for a rejected owner and does not separate Alternative C from the design. Stage 8
    (8/IZ9, listed under D8) also says delete. Line 393: replace 'Members are still hidden' with
    'The banner is still hidden from members'. 6/C8 also asks that the profile statuses be listed
    once (`approved` and `applied` appear at 139-140; rejected is only implied) and that the
    document say applying creates a profile the applicant owns; add one sentence where 'at any
    status' is first used (179-180) or in Terms.
-   **Where:** Alternative C, Cons (381); Alternative D, Cons (393); statuses at 139-140 and
    179-181
-   **Findings:** `6/C8`, `7/style-21`

### A27. Say what is known about Teach at phone width - 🟢 Nit

-   **Change:** CUJ 2 sends phone users into Teach in a mobile browser, and the document does not
    say whether Teach works there. Add one sentence, or a risk row, that says three things:
    sign-in and the start page are single-column at narrow widths in code (SignInPage.tsx 74-75;
    gate.tsx 111); nobody has tested them on a phone; and the application form was not checked at
    phone width at all. The first two are Stage 8's wording (8/IZ4, listed under D4). 7/design-12
    names all three pages, and a phone visitor in CUJ 2 reaches the application form whichever way
    D4 goes.
-   **Where:** Goal 3, native (83); CUJ 2 (129-135); the `/teach` button on native (252-254)
-   **Depends on:** None. Applies under every D4 option.
-   **Findings:** `7/design-12`

### A28. If the marker or dismissal is cut, also change the lines Stage 8's cut lists leave out - 🟢 Nit

-   **Change:** If D1 = delete the marker: also remove `&from=learner` and `source` at 78,
    126-127, 202, 250, 313-314, 525-527, 752-753 and 807-808. Otherwise `from=learner` stays on
    the link and in the tests, CUJ 1 asserts an event property that no longer exists, and nothing
    in Teach strips a leftover `from` from the address bar (item 11, which adds `from` to the
    `history.replaceState` call, is deleted). If D2 = drop dismissal: also change 198 ('dismissed
    here?'), 229 ('and a close button'), 740 (`onDismiss={dismiss}`) and 833 (the walkthrough of
    CUJ 4).
-   **Where:** Marker: Goal 3 link (78); CUJ 1 (126-127); Data flow (202); the button URL (250);
    Order of release (313-314); plan summary (525-527); item 19 (752-753); item 23 (807-808).
    Dismissal: Data flow (198); What it holds (229); item 18 (740); manual walkthrough (833)
-   **Depends on:** Needed only if D1 = delete the marker, or D2 = drop dismissal, or both.
    Unnecessary otherwise.
-   **Findings:** `8/IZ10`

### A29. Soften 'never shows there again' and 'for good' - 🟢 Nit

-   **Change:** Replace 'the banner never shows there again' (187), 'hides the banner on that
    device for good' (334) and 'The banner is gone on that device' (149) with 'until that device's
    storage is cleared'. Lines 233-234 already say a failed write hides it only for the rest of
    the run, and cleared storage or a reinstall brings it back.
-   **Where:** CUJ 4 (149); drafting decision 4 (186-187); Risks row 334
-   **Depends on:** Unnecessary if D2 = drop dismissal. If D2 = collapse to a link or an expiring
    dismissal, write the new behaviour instead.
-   **Findings:** `7/style-9`

### A30. Wording fixes in the specification half - 🟢 Nit

-   **Change:** (1) Line 449-450: 'Both earlier designs deferred one' becomes 'The Chinese design
    deferred one'; this is the second of four designs, so there is one earlier design, and the
    brief only asks the question. (2) Use 'Teach's sign-in step' throughout in place of 'Teach is
    English at its door' (45), 'Teach's door' (84) and 'the first Teach pages' (26-27), and list
    its parts once, including the verify page that line 268 translates and the lists at 26-27 and
    84-85 omit. (3) Line 59: 'The weak point of the idea, stated up front:' becomes 'Known
    weaknesses:' (it introduces three points). Row 332: 'Accepted, as decided.' becomes
    'Accepted.' Line 67: 'a handful of pilot teachers' becomes 'three to five pilot teachers'. (4)
    Drop 'short' and 'small' where no size is given (14, 20, 183, 231-232, 405); at 240 say 'four
    sections'. (5) State the concrete cost behind each of these phrases, or drop the phrase:
    'doesn't grow' (43), 'cheaper than keeping an English copy' (277), 'The simplest rule' (377),
    'costs little' (384), 'may find the prompt unwelcome' (391-392), 'Three lines may not be
    enough to persuade' (403), 'a stored flag is cheap' and 'reads as an advert' (441-442), 'the
    numbers that matter' (452-453), 'simpler than a switch' (483; lines 481-482 already give the
    cost). The checker notes only 384, 441-442, 452-453 and 483 sit in a 'Reason for Rejection'.
-   **Where:** Overview (14, 20, 26-27); The Problem (43, 45, 59, 67); Goal 4 (84); Non-Goals
    (97); drafting decision 2 (183); The banner (231-232); The `/teach` screen (240); section
    heading (266); line 277; Risks row 332; Alternatives C (377, 384), D (391-392), E (403, 405),
    H (441-442), I (449-450, 452-453), L (483)
-   **Depends on:** D2 = drop dismissal rewrites 441-442 and removes 231-232. D1 = delete the
    marker rewrites 449-453. D8 changes the section count at 240. D3 fixes the wording of Goal 4
    at 84 (see A5).
-   **Findings:** `7/style-12`, `7/style-17`, `7/style-18`, `7/style-19`, `7/style-20`

### A31. Formatting: one blank line, one label style - 🟢 Nit

-   **Change:** Delete one of the two blank lines at 104-105; every other H2 has one. Use one
    punctuation style for the run-in bold labels within each list. Today they mix a colon
    ('**Where:**', '**What it holds:**', '**The route:**'), a full stop ('**When it shows.**',
    '**Dismissal.**', '**Contracts.**'), a comma ('**What it says,**') and none ('**The button**
    opens').
-   **Where:** Before `## Open Questions` (104-105); run-in bold labels in the Technical Plan
    lists (219-230, 238-255, 268-282, 287-303)
-   **Findings:** `7/structural-9`, `7/structural-10`

### A32. Add the three missing records and write out the record text - 🟢 Nit

-   **Change:** (1) Add ADR 008's own 'Translated today' paragraph
    (docs/adr/008-theming-preferences-i18n.md 66-72) to item 12, for the sign-in and verify pages.
    The `en.ts` header comment and AGENTS.md are already updated and the ADR is not;
    learner-chinese.md item 57 updates all three. (2) Add `.maestro/README.md`, which documents a
    flow and its run command, to item 24 for the new `teach-banner.yaml`. (3) Add
    docs/runbooks/deploy.md (55-57), which lists the build-time variables `EXPO_PUBLIC_API_URL`
    and `EXPO_PUBLIC_WEB_URL`, to item 22 for `EXPO_PUBLIC_TEACH_URL`. For each of the three, the
    other acceptable fix is to state that the file is left alone, so the list of files to write is
    complete. (4) In item 12, give the exact text of the ADR 010 line, the AGENTS.md change and
    the learner-chinese.md edit; learner-chinese.md item 40 quotes its rule text exactly.
-   **Where:** Plan item 6 (604-611); item 12 (666-676); item 22 (783-792); item 24 (811-817)
-   **Depends on:** A24 sets the verb for the learner-chinese.md edit; D6 may change that edit.
    D10 = fail the build also changes item 22.
-   **Findings:** `9/implementation-readiness-10`

### A33. Specify the Maestro flow for a real device - 🟢 Nit

-   **Change:** (1) Say how the flow gets past 'Load more': Explore loads 12 courses per page
    (apps/learner/src/lib/catalog.ts:39) and the banner sits after 'Load more', so with more than
    12 seeded courses 'scroll to `teach-banner-open`' needs taps the flow does not mention. (2)
    Give the `/teach` back link a `testID` in item 19 and tap it for 'go back'; iOS has no
    hardware back. (3) State the flow's header variables; `.maestro/sign-in.yaml` 5-8 uses
    `APP_ID`, `EMAIL` and `API_URL`.
-   **Where:** Plan item 24 (811-817); the back link in item 19 (757)
-   **Depends on:** If D2 = drop dismissal, the 'tap `teach-banner-close`, relaunch, assert not
    visible' steps go; (1) to (3) still apply to the first half.
-   **Findings:** `9/codebase-details-11`

### A34. Wording fixes in the Detailed Implementation Plan - 🟢 Nit

-   **Change:** (1) Line 522-523: 'Each passes' becomes 'Each must pass'; the work is not built.
    (2) Line 527: 'Nothing changes in the learner app' becomes 'No file under `apps/learner`
    changes', or the specification's 'changes nothing visible in the learner app' (314-315); the
    Teach PR changes `packages/core` contracts and adds an i18n area that the learner app bundles.
    (3) Line 536: drop or correct 'All learner paths below are relative to `apps/learner/src/`';
    every learner path in the plan starts with `apps/`, except the shorthand
    `teach-banner-storage.web.ts` at 702. (4) Line 569: 'disposable Postgres' becomes PGlite; the
    helper runs it in process (apps/api/test/helpers/test-app.ts 2, 18, 27). (5) Line 732: 'reads
    nothing itself' becomes 'reads no storage or session state'; the component reads `t()` and the
    router. (6) Lines 824-838: item 4 is typed 'integration test' at 569 but listed under 'Unit
    Tests', and 'E2E/Integration' holds only manual checks. Align the labels; learner-chinese.md
    files its API integration tests under E2E/Integration (its lines 1653-1657). (7) Lines
    807-809: replace the sentence with three 'with' clauses by 'In `zh`, pressing `teach-open`
    calls a mocked `Linking.openURL` with a URL ending `/?lang=zh&from=learner`.'
-   **Where:** Plan opening (522-523, 527); Target Files note (536); item 4 (569); item 17 (732);
    item 23 (807-809); Verification Plan (824-827, 831-838)
-   **Depends on:** If D1 = delete the marker: in (2) the Teach PR no longer changes contracts,
    and in (7) the URL ends `/?lang=zh`. If D2 = drop dismissal, line 732 ('takes `onDismiss` from
    its parent') is rewritten and (5) may be unnecessary.
-   **Findings:** `9/codebase-details-12`, `9/style-8`, `9/style-9`, `9/style-13`, `9/style-14`,
    `9/style-16`

### A35. If dismissal is kept, use one storage file in item 15 - 🟢 Nit

-   **Change:** This is the smaller ask of 5/Z2 (listed under D2). It applies whenever dismissal
    is kept. Replace the two files in item 15 (`teach-banner-storage.ts` and
    `teach-banner-storage.web.ts`, 702-703) with one file that uses AsyncStorage on web and
    native, and change 708 and 230-232 to match. AsyncStorage is already a dependency
    (apps/learner/package.json line 13). The preferences `.web.ts` sibling exists only for a
    synchronous first-paint read, which the banner does not need: the hook already hides the
    banner while the flag is unread. Two checker notes. How AsyncStorage's web build stores data
    could not be confirmed (there is no `node_modules` in the worktree). This would be the app's
    first use of AsyncStorage on web; both web storage files today use `window.localStorage`
    directly. If two files are kept for either reason, say so in item 15.
-   **Where:** Plan item 15 (700-710); Dismissal (230-232)
-   **Depends on:** Unnecessary if D2 = drop dismissal. Applies under the other three D2 options.
-   **Findings:** none

## Traceability Matrix

Every finding of the five stage reports, and the decision or action item it maps to. A finding
marked "merged" was raised by a second reviewer of the same stage and sits inside the finding
named.

| Finding                         | Severity | Reviewer                       | Verdict   | Title                                                                                                          | Maps to |
| ------------------------------- | -------- | ------------------------------ | --------- | -------------------------------------------------------------------------------------------------------------- | ------- |
| `5/Z1`                          | Major    | `egm-zoom-out`                 | partly    | Finding 1: The arrival-count pipeline passes one analytics property through too many components                | D1      |
| `5/Z2`                          | Major    | `egm-zoom-out`                 | partly    | Finding 2: Dismissal is a second protection against intrusiveness that the bottom-of-list placement already... | D2      |
| `5/Z3`                          | Major    | `egm-inventive-catalyst`       | confirmed | Finding 1: The second sign-in is treated as a binary choice (plain link vs session hand-over); a signed-in...  | D5      |
| `5/Z4`                          | Major    | `egm-inventive-catalyst`       | partly    | Finding 2: Measurement is framed as full client funnel vs only `sign_in` + `teacher_applied`; two accepted...  | D1      |
| `5/Z5`                          | Major    | `egm-inventive-catalyst`       | confirmed | Finding 3: Dismissal hides the banner "for good", giving up later discovery of Teach to avoid reading as an... | D2      |
| `5/Z6`                          | Nit      | `egm-zoom-out`                 | confirmed | Finding 3: The /teach screen restates Teach's application, review and payout process                           | D8      |
| `5/Z7`                          | Nit      | `egm-zoom-out`                 | judgement | Finding 4: The banner is most visible when it matters least                                                    | D1      |
| `5/Z8`                          | Nit      | `egm-zoom-out`                 | confirmed | Finding 5: The Technical Plan carries code-level detail that the Detailed Implementation Plan repeats          | A10     |
| `5/Z9`                          | Nit      | `egm-zoom-out`                 | confirmed | Finding 6: The two halves of the document name the same things differently                                     | A2      |
| `5/Z10`                         | Nit      | `egm-inventive-catalyst`       | confirmed | Finding 4: `teachUrl()`'s development fallback (port 5173 on the page's host) is the behaviour in every bui... | D10     |
| `5/Z11`                         | Nit      | `egm-inventive-catalyst`       | confirmed | Finding 5: The `from` allow-list is copied into both pre-paint scripts as well as the zod enum; the scripts... | D13     |
| `5/Z12`                         | Nit      | `egm-inventive-catalyst`       | confirmed | The "`/teach` stays open by address" mitigation does not exist on iOS and Android                              | D2      |
| `6/C1`                          | Major    | `egm-comprehension`            | confirmed | The new sign-in catalog area has two names: `auth` and `portalAuth`                                            | A2      |
| `6/C2`                          | Major    | `egm-comprehension`            | confirmed | The existing sign-in flow is never described in one place, though the counting design depends on it            | A3      |
| `6/C3`                          | Major    | `egm-comprehension`            | confirmed | The language half rests on the Chinese design, described only by the names of its parts                        | A12     |
| `6/C4`                          | Major    | `egm-comprehension`            | confirmed | How the error sentences become Chinese is not explained; two statements read as contradictory                  | A5      |
| `6/C5`                          | Major    | `egm-comprehension`            | confirmed | "Support" is used and changed by this design but never defined in Terms                                        | A4      |
| `6/C6`                          | Major    | `egm-comprehension`            | confirmed | Goal 4's Chinese error sentences cannot be met through `useErrorMessage()` for server-worded errors (review... | D3      |
| `6/C7`                          | Nit      | `egm-comprehension`            | confirmed | "The brief", "brainstorm review" and "Goldfish review" are used before or without being identified             | A25     |
| `6/C8`                          | Nit      | `egm-comprehension`            | confirmed | Alternative C's rejected-applicant con does not separate it from the chosen rule; statuses and the applicat... | A26     |
| `6/C9`                          | Nit      | `egm-comprehension`            | confirmed | Goal 4 is unconditional, but `lang` is stored only if nothing is stored                                        | A5      |
| `6/C10`                         | Nit      | `egm-comprehension`            | confirmed | The Overview's "four things" leaves out arrival counting                                                       | A19     |
| `6/C11`                         | Nit      | `egm-comprehension`            | confirmed | "As the hero is" compares to something never described                                                         | A25     |
| `6/C12`                         | Nit      | `egm-comprehension`            | confirmed | "The catalog" has two meanings; "area" is undefined; ADR 008 is cited before it is linked                      | A25     |
| `6/C13`                         | Nit      | `egm-comprehension`            | confirmed | `preferences-init.js` is used without a description                                                            | A25     |
| `6/C14`                         | Nit      | `egm-comprehension`            | confirmed | "PR 1" to "PR 4" mean two different designs' pull requests in adjacent bullets                                 | A23     |
| `6/C15`                         | Nit      | `egm-comprehension`            | confirmed | Ambiguous "it" in "when it was sent"                                                                           | A19     |
| `6/C16`                         | Nit      | `egm-comprehension`            | confirmed | "Older clients" in the rollback note are really newer cached clients, and `locale` is not removed by this r... | A19     |
| `6/C17`                         | Nit      | `egm-comprehension`            | confirmed | The Chinese design's sentence to be amended is quoted two ways, with two different actions                     | A24     |
| `6/C18`                         | Nit      | `egm-comprehension`            | confirmed | "Profile", `PreferenceRows`, `preferences-storage` and "the picker" are referenced without description         | A25     |
| `6/C19`                         | Nit      | `egm-comprehension`            | confirmed | The application count has no ordering or window, and already-signed-in visitors are an unstated undercount     | D1      |
| `6/C20`                         | Nit      | `egm-comprehension`            | confirmed | The preview build's banner link points at Tailscale-only staging, and the consequence is not stated            | D11     |
| `6/C21`                         | Nit      | `egm-comprehension`            | confirmed | The `sign_in` event the count depends on is not sent today, and the document never says the Chinese design...  | A12     |
| `6/C22`                         | Nit      | `egm-comprehension`            | confirmed | The data flow shows `locale` on Teach's `sign_in` event, but Teach sends no `locale` at verify, so it will...  | D9      |
| `7/design-1`                    | Major    | `egm-design`                   | confirmed | Dismissing the banner on native removes the only way to Teach                                                  | D2      |
| `7/design-2`                    | Major    | `egm-design`                   | partly    | The arrival count cannot show whether the bottom-of-list placement works                                       | D1      |
| `7/style-5`                     | merged   |                                |           | merged into `7/design-2`                                                                                       | D1      |
| `7/style-14`                    | merged   |                                |           | merged into `7/design-2`                                                                                       | D1      |
| `7/design-3`                    | Major    | `egm-design`                   | confirmed | The Chinese path stops at the English personal application form                                                | D4      |
| `7/design-4`                    | Major    | `egm-design`                   | confirmed | The data-flow diagram shows `locale` on the Teach `sign_in` event, but Teach sends none at verify              | D9      |
| `7/structural-1`                | Major    | `egm-structural`               | confirmed | Eight rejections say "Rejected by author" and cite only this document's own decision list                      | A11     |
| `7/design-8`                    | merged   |                                |           | merged into `7/structural-1`                                                                                   | A11     |
| `7/structural-2`                | Major    | `egm-structural`               | confirmed | The new sign-in catalog area is called `auth` in the specification and `portalAuth` in the implementation plan | A2      |
| `7/design-9`                    | merged   |                                |           | merged into `7/structural-2`                                                                                   | A2      |
| `7/style-1`                     | Major    | `egm-style`                    | confirmed | 1. "Support's portal is the only app that knows TEACH_URL" is too broad                                        | A6      |
| `7/style-2`                     | Major    | `egm-style`                    | confirmed | 2. "already read `?lang`" states planned behaviour as existing                                                 | A12     |
| `7/style-3`                     | Major    | `egm-style`                    | confirmed | 3. "profile -> portal" outruns what HomeRedirect and ProfileGate do                                            | A7      |
| `7/style-4`                     | Major    | `egm-style`                    | confirmed | 4. In-app browser storage claim is stated without source and is the sole reason for rejecting Alternative M    | A8      |
| `7/style-6`                     | Major    | `egm-style`                    | confirmed | 6. The picker mitigation for Support's Chinese code email implies a picker on the sign-in page                 | D6      |
| `7/style-7`                     | Major    | `egm-style`                    | confirmed | 7. Goal 6 "easy to remove ... one change" contradicts the rollback section                                     | A9      |
| `7/design-7`                    | merged   |                                |           | merged into `7/style-7`                                                                                        | A9      |
| `7/style-8`                     | Major    | `egm-style`                    | confirmed | 8. "every potential teacher ... is lost" is an absolute claim with no data                                     | A6      |
| `7/design-5`                    | Nit      | `egm-design`                   | confirmed | Owner detection is stale: the learner session reads `/me` on mount, and an offline failure shows the banner... | D7      |
| `7/design-6`                    | Nit      | `egm-design`                   | confirmed | Goal 4 is unconditional, but `?lang` is ignored when Teach has a stored language and API error sentences st... | A5      |
| `7/design-10`                   | Nit      | `egm-design`                   | confirmed | Open Question 1 has no merge gate                                                                              | A1      |
| `7/design-11`                   | Nit      | `egm-design`                   | confirmed | No risk row for depending on a design that is still Proposed                                                   | A12     |
| `7/design-12`                   | Nit      | `egm-design`                   | confirmed | Phone visitors are sent to a web portal with no statement that Teach works at phone width                      | A27     |
| `7/structural-3`                | Nit      | `egm-structural`               | confirmed | Alternative A's rejection label disagrees with the brief it links to                                           | A11     |
| `7/style-10`                    | merged   |                                |           | merged into `7/structural-3`                                                                                   | A11     |
| `7/structural-4`                | Nit      | `egm-structural`               | confirmed | The `learnerTeach` catalog area is first named in the resources list, not in the architecture                  | A25     |
| `7/structural-5`                | Nit      | `egm-structural`               | confirmed | Alternatives K, L and M give a bare reason while A-J open with an attribution and a link                       | A11     |
| `7/structural-6`                | Nit      | `egm-structural`               | confirmed | Alternative G bundles two alternatives under one heading                                                       | D12     |
| `7/structural-7`                | Nit      | `egm-structural`               | confirmed | A quoted sentence from the Chinese design is not verbatim                                                      | A24     |
| `7/style-16`                    | merged   |                                |           | merged into `7/structural-7`                                                                                   | A24     |
| `7/structural-8`                | Nit      | `egm-structural`               | confirmed | "PR 1" to "PR 4" refer to two different designs' pull requests without saying which                            | A23     |
| `7/structural-9`                | Nit      | `egm-structural`               | confirmed | Two blank lines before `## Open Questions`                                                                     | A31     |
| `7/structural-10`               | Nit      | `egm-structural`               | confirmed | Run-in bold labels in the Technical Plan lists use mixed punctuation                                           | A31     |
| `7/style-9`                     | Nit      | `egm-style`                    | confirmed | 9. "never shows there again" / "for good" are absolutes the document contradicts                               | A29     |
| `7/style-11`                    | Nit      | `egm-style`                    | confirmed | 11. Citing "the brief's owners-only rule" is circular                                                          | A11     |
| `7/style-12`                    | Nit      | `egm-style`                    | confirmed | 12. "Both earlier designs deferred one" miscounts the earlier designs                                          | A30     |
| `7/style-13`                    | Nit      | `egm-style`                    | confirmed | 13. "which covers the usual case" has no evidence                                                              | A19     |
| `7/style-15`                    | Nit      | `egm-style`                    | confirmed | 15. "Staging is reachable only over Tailscale" is a caveat with no decision attached                           | D11     |
| `7/style-17`                    | Nit      | `egm-style`                    | confirmed | 17. Four labels for Teach's sign-in step, and the lists omit the verify page                                   | A30     |
| `7/style-18`                    | Nit      | `egm-style`                    | confirmed | 18. Meta-commentary, filler and vagueness                                                                      | A30     |
| `7/style-19`                    | Nit      | `egm-style`                    | confirmed | 19. Unmeasured size adjectives ("short", "small", "a few")                                                     | A30     |
| `7/style-20`                    | Nit      | `egm-style`                    | partly    | 20. Subjective or unquantified judgments used as rejection reasons                                             | A30     |
| `7/style-21`                    | Nit      | `egm-style`                    | confirmed | 21. A con that does not distinguish Alternative C, and an ambiguous "Members are still hidden"                 | A26     |
| `7/style-22`                    | Nit      | `egm-style`                    | partly    | 22. The session hand-over rejection is restated six times; decisions restate later sections                    | A10     |
| `8/IZ1`                         | Major    | `egm-zoom-out`                 | partly    | Finding 1: Delete the arrival marker instead of patching it                                                    | D1      |
| `8/IZ2`                         | Major    | `egm-zoom-out`                 | confirmed | Finding 2: Drop dismissal (Alternative H) instead of adding a way back                                         | D2      |
| `8/IZ3`                         | Major    | `egm-zoom-out`                 | confirmed | Finding 3: Narrow Goal 4 instead of adding an error-code-to-key mapping                                        | D3      |
| `8/IZ4`                         | Major    | `egm-zoom-out`                 | confirmed | Finding 4: Correct the 'gap is the sign-in step' claim; do not pull the personal application form into the...  | D4      |
| `8/IZ5`                         | Major    | `egm-zoom-out`                 | partly    | Finding 5: Fix the drift between the specification half and the plan half by deleting the second copy          | A10     |
| `8/IZ6`                         | Nit      | `egm-zoom-out`                 | confirmed | Finding 6: Delete the Support risk row and the picker mitigation instead of calibrating them                   | D6      |
| `8/IZ7`                         | Nit      | `egm-zoom-out`                 | confirmed | Finding 7: Take the accepted cost, not the mechanism, for design-5, design-7 and design-4                      | D7      |
| `8/IZ8`                         | Nit      | `egm-zoom-out`                 | confirmed | Finding 8: One short 'relies on' list in place of four separate additions about the Chinese design             | A12     |
| `8/IZ9`                         | Nit      | `egm-zoom-out`                 | confirmed | Finding 9: Smaller asks where deleting beats adding (Tailscale sentence, Alternative C con, Alternative G,...  | D8      |
| `8/IZ10`                        | Nit      | `egm-zoom-out`                 | confirmed | The cut lists in Findings 1 and 2 leave out lines that carry the same mechanism                                | A28     |
| `9/implementation-readiness-1`  | Blocker  | `egm-implementation-readiness` | confirmed | No Chinese text and no process for it, so neither PR can pass its own checks                                   | A1      |
| `9/codebase-details-2`          | merged   |                                |           | merged into `9/implementation-readiness-1`                                                                     | A1      |
| `9/style-5`                     | merged   |                                |           | merged into `9/implementation-readiness-1`                                                                     | A1      |
| `9/implementation-readiness-2`  | Major    | `egm-implementation-readiness` | confirmed | The /teach screen's English copy is not in the plan, and the back link has no key                              | A13     |
| `9/codebase-details-1`          | merged   |                                |           | merged into `9/implementation-readiness-2`                                                                     | A13     |
| `9/implementation-readiness-3`  | Major    | `egm-implementation-readiness` | confirmed | Item 23 puts a test file inside Expo Router's app directory                                                    | A14     |
| `9/codebase-details-4`          | merged   |                                |           | merged into `9/implementation-readiness-3`                                                                     | A14     |
| `9/implementation-readiness-4`  | Major    | `egm-implementation-readiness` | partly    | The spec relies on a language picker at sign-in that item 8 does not add                                       | D6      |
| `9/codebase-details-3`          | Major    | `egm-codebase-details`         | confirmed | An owner whose launch request fails sees the banner                                                            | D7      |
| `9/codebase-details-5`          | Major    | `egm-codebase-details`         | confirmed | Banner and screen composition leave choices to the implementer                                                 | A15     |
| `9/implementation-readiness-5`  | merged   |                                |           | merged into `9/codebase-details-5`                                                                             | A15     |
| `9/codebase-details-6`          | Major    | `egm-codebase-details`         | confirmed | The plan's own coverage requirement is not met by its test list                                                | A16     |
| `9/style-1`                     | merged   |                                |           | merged into `9/codebase-details-6`                                                                             | A16     |
| `9/implementation-readiness-9`  | merged   |                                |           | merged into `9/codebase-details-6`                                                                             | A16     |
| `9/style-2`                     | Major    | `egm-style`                    | confirmed | One catalog area has two names: `portalAuth` in the plan, `auth` in the specification                          | A2      |
| `9/implementation-readiness-8`  | merged   |                                |           | merged into `9/style-2`                                                                                        | A2      |
| `9/codebase-details-9`          | merged   |                                |           | merged into `9/style-2`                                                                                        | A2      |
| `9/style-3`                     | Major    | `egm-style`                    | confirmed | Support check attributed to CUJ 1, which does not cover Support                                                | A17     |
| `9/style-4`                     | Major    | `egm-style`                    | confirmed | Two "as X does" comparisons in the `teachUrl()` item each match only part of the sentence                      | A18     |
| `9/implementation-readiness-7`  | merged   |                                |           | merged into `9/style-4`                                                                                        | A18     |
| `9/codebase-details-7`          | merged   |                                |           | merged into `9/style-4`                                                                                        | A18     |
| `9/implementation-readiness-6`  | Nit      | `egm-implementation-readiness` | confirmed | Item 18 allows two placements for the banner in Explore                                                        | A15     |
| `9/style-10`                    | merged   |                                |           | merged into `9/implementation-readiness-6`                                                                     | A15     |
| `9/implementation-readiness-10` | Nit      | `egm-implementation-readiness` | confirmed | ADR 008's 'Translated today' paragraph and .maestro/README.md are missing from the file list                   | A32     |
| `9/codebase-details-8`          | merged   |                                |           | merged into `9/implementation-readiness-10`                                                                    | A32     |
| `9/codebase-details-10`         | Nit      | `egm-codebase-details`         | confirmed | Data-flow diagram shows `locale` on the Teach sign_in event, which is always null for Teach                    | D9      |
| `9/codebase-details-11`         | Nit      | `egm-codebase-details`         | confirmed | The Maestro flow is under-specified for a real device                                                          | A33     |
| `9/codebase-details-12`         | Nit      | `egm-codebase-details`         | confirmed | Two small wording inaccuracies                                                                                 | A34     |
| `9/style-6`                     | merged   |                                |           | merged into `9/codebase-details-12`                                                                            | A34     |
| `9/style-7`                     | Nit      | `egm-style`                    | confirmed | "The rules are covered by item 4's API tests and the i18n parity test" has no antecedent and overclaims        | A17     |
| `9/style-8`                     | Nit      | `egm-style`                    | confirmed | "Nothing changes in the learner app" is stronger than the specification's wording                              | A34     |
| `9/style-9`                     | Nit      | `egm-style`                    | confirmed | "Each passes" lint and typecheck/test is present tense for unbuilt work                                        | A34     |
| `9/style-11`                    | Nit      | `egm-style`                    | confirmed | `useTeachBanner` has two signatures                                                                            | A10     |
| `9/style-12`                    | Nit      | `egm-style`                    | confirmed | "gains a pointer" versus "is amended" for the learner-chinese.md sentence                                      | A24     |
| `9/style-13`                    | Nit      | `egm-style`                    | confirmed | "reads nothing itself" is broader than intended                                                                | A34     |
| `9/style-14`                    | Nit      | `egm-style`                    | confirmed | API integration tests are filed under "Unit Tests"; "E2E/Integration" holds only manual checks                 | A34     |
| `9/style-15`                    | Nit      | `egm-style`                    | confirmed | "Success measure" names two counts and no threshold                                                            | A22     |
| `9/style-16`                    | Nit      | `egm-style`                    | confirmed | Three stacked "with" clauses in the `teach.test.tsx` sentence                                                  | A34     |
