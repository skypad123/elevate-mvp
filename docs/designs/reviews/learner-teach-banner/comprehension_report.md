# Comprehension Report: Stage 6 (Comprehension Test)

**Target:** `docs/designs/learner-teach-banner.md` (FeatureRange lines 1-519 and DetailedRange lines 520-846)

**Stage:** 6 (Comprehension Test), uninterrupted full flow. **Mode:** REVIEW.

One reviewer, `egm-comprehension`, read the document alone, with no standard and no other context
files. Its complete result comes first, starting with its paraphrase. Compare the paraphrase with
what you meant: a wrong paraphrase is a finding. The same findings then follow, each restated and
checked against the document and the code by a separate agent.

## Reviewer result (as returned)

Review complete: Stage 6 comprehension, Mode REVIEW. I read the persona file and the whole target (lines 1-846); no standards or other context were supplied. Both ranges could be paraphrased, so there are no Blockers. There are 5 Major findings and 14 Nits.

Target: docs/designs/learner-teach-banner.md

### What this proposes

- **The banner.** A dismissible "Teach on Elevate" banner goes at the very end of Explore, the learner app's home tab, on web, iOS and Android. It is hidden from signed-in users who own a teaching profile at any status, on devices where it was dismissed, and while a search or category filter is active.
- **The `/teach` screen.** The banner opens a short learner-app screen that explains who can teach, the steps, the commission (no percentage) and that Teach has its own sign-in. Its button opens `TEACH_URL/?lang=<language>&from=learner`, in the same tab on web and in the system browser on native. No session is handed over.
- **Teach's sign-in step.** The sign-in and verify pages that Teach and Support share are translated. They send the visitor's language with the sign-in request, so the code email matches it.
- **Counting.** `from=learner` is kept in `sessionStorage`, sent as `source` on the sign-in and verify requests, and recorded on the server's `sign_in` event. Sign-ins and later applications that started at the banner are then counted by query.
- **Delivery.** Two pull requests, the Teach sign-in step and then the learner app, both after the four pull requests of a separate "Chinese design".

### How the existing system works, per this document

- **The apps.** The learner app (`apps/learner`, Expo) and Teach (`apps/teach`, a web-only teacher portal at `TEACH_URL`) are separate sites with separate sessions. Support is a third portal that shares Teach's sign-in and verify pages from `@elevate/web-ui/portal`. The learner app has no link to Teach and no setting for its address.
- **Teach's routing.** A signed-out visitor goes to sign-in, a signed-in person with no profile goes to a start page with the personal and company applications, and a person with a profile goes into the portal.
- **Sign-in.** It is by email: a request sends an email holding a link and a 6-digit code, and a verify call takes either the code or the link's token. The server then records a `sign_in` analytics event; the client sends no events.
- **Roles.** Users hold profiles with a role (owner, manager or writer) and a status (`approved`, `applied`, and by implication rejected).
- **Language.** Once the Chinese design lands, a resolver picks the language, the sign-in request can carry `locale`, and Teach's pre-paint script reads `?lang` and strips it from the address bar. Teach's sign-in page and code email are still English, while its start page and dashboard are translated.

### Findings

#### Major

1. **Major — lines 269, 505-506 against 581-609, 628, 642, 651, 826.** The new catalog area for the sign-in text has two names.
   - The feature specification calls it "a new `auth` area" (269) and "the new `auth` and `learnerTeach` areas" (505-506).
   - The Detailed Implementation Plan calls it `portalAuth` throughout.
   - A reader cannot tell whether these are one area or two, or which name is intended.

2. **Major — lines 22-25, 48, 209-212, 278-283, 287-302.** The existing sign-in flow is never described in one place, and the counting design depends on it.
   - The reader has to work out that "sign-in request", "magic-link", `requestMagicLink` and `magicLinkRequestSchema` are the same thing; the document never says so.
   - That the email holds both a link and a code is confirmed only by a message string in the detailed plan (590-591).
   - "Code verify" on `SignInPage`, "token verify" on `VerifyPage` and "both branches of `verifyRequestSchema`" (289) are not tied to those two paths.
   - Where the emailed link lands is not stated (presumably Teach's verify route). The `&from` on that link only works if `preferences-init.js` runs there and `VerifyPage` reads it back.
   - `audience` is used at 127, 209 and 303 and never defined.

3. **Major — lines 33-34, 173-175, 278-283, 309-311.** The language half of the design rests on the Chinese design, which is described only by the names of its parts.
   - **The resolver:** the document does not say what it resolves from (browser language, a stored preference, `users.locale`) or what values it yields. CUJ 1's "`zh-SG` browser" giving Chinese (119-124) cannot be followed without it.
   - **`localeChosen`** (282) is never defined. Nor is it said that a verify carrying `locale` writes `users.locale`, which is the premise of 282-283.
   - **The baseline is mixed.** The Problem section's "an English sign-in code email, because Teach's sign-in request sends no language" (48) and "Teach's start page and dashboard are already translated" (50, 97) read as today's system. The reader cannot tell whether they are true today or only after the Chinese design ships.
   - Whether the Chinese design is built, in progress or only proposed is not stated.

4. **Major — lines 46-47, 84-85, 272-273, 630-631, 643-644.** How the error sentences become Chinese is not explained.
   - Goal 4 promises Chinese error sentences on the Teach sign-in page.
   - The plan says failures "now go through `useErrorMessage()`" and, in the next sentence, "API messages stay English, as ADR 008 sets out".
   - What `useErrorMessage()` does (for example, map an error code to a catalog key) and which errors therefore stay English is not said. The two statements read as contradictory.

5. **Major — lines 39-40, 99, 256, 276-277, 290-293, 339, 657-664.** "Support" is used from the Problem section onwards and this design changes it, but the Terms list (161-175) never defines it.
   - Its sign-in pages are translated, it sends `locale`, and its init script stores the arrival marker.
   - The only description is a message string in the detailed plan (598-599): "Internal tools: review courses, approve teachers, manage payments."
   - Why Support's `preferences-init.js` stores an arrival marker, when the banner links only to Teach, is not explained in the feature specification. The detailed plan only says the two files are "kept identical" (658).

#### Nits

6. **Nit — lines 64, 93, 95, 112, 179, 182, 360, 501-502.** "The brief" is used from line 64 but identified as `learner-main-page-improvements.md` only at 361 and 501. Line 32 links that file without calling it the brief. "Brainstorm review" (360, 370) and "Goldfish review" (502) are never explained.

7. **Nit — lines 374-384 against 75, 179-181.** Alternative C lists as a con that a rejected applicant "never gets it either". The chosen rule hides the banner from owners "at any status", which appears to hide it from a rejected applicant too, so this con does not separate C from the chosen design. The profile statuses are never listed (`approved` and `applied` appear at 139-140; rejected is implied). The link between an application and an owned profile is not stated.

8. **Nit — lines 84-85 against 204.** Goal 4 says without condition that Teach's door is in Chinese when the learner app is. The data flow says `lang` is stored only "if nothing stored". A returning visitor with a stored Teach language is an exception that the prose never states.

9. **Nit — lines 16-27 against 86-87.** The Overview says "It does four things" and leaves out arrival counting, which is Goal 5 and has its own section (285-305).

10. **Nit — lines 157, 185.** "As the hero is": Explore's hero is never described, so the comparison tells the reader nothing about when it hides.

11. **Nit — lines 221 against 269.** "The catalog" means the course catalog at 221 and the message catalog at 269 and after. "Area" (269) is not defined, and ADR 008 is first cited at 273 but linked only at 505.

12. **Nit — lines 204, 290.** `preferences-init.js` appears in the data flow and in "Counting arrivals" with no description. "Web pre-paint scripts" appears only in the detailed plan (655-659).

13. **Nit — lines 309-317, 344, 346.** "PR 1" to "PR 4" mean the Chinese design's pull requests at 309-311 and this design's at 313-317, 344 and 346. "The next store build after PR 2" (317) follows directly after "PR 2 (the code email…)" of the other design.

14. **Nit — line 300.** "Appends `&from=<source>` to the emailed link when it was sent": "it" reads as the link. Line 554 states it clearly ("when `input.source` is set").

15. **Nit — lines 346-347.** "Older clients that still send `source` or `locale`" describes newer cached clients talking to a reverted server. `locale` on the request comes from the Chinese design, so a revert of this design's PR 1 would not remove it.

16. **Nit — lines 280-281 against 675-676.** The Chinese design's sentence to be amended is quoted two ways: "Teach and Support send no `locale`" and "Teach and Support send none, so their links carry no `lang`". One place says the sentence "is amended"; the other says it "gains a pointer".

17. **Nit — lines 232-233, 334, 339, 484, 512.** "Profile" (a learner-app screen, as against a teaching profile), `PreferenceRows`, `preferences-storage` and "the picker" in Teach and Support are referenced without a description of what or where they are.

18. **Nit — lines 303-305, 839-840.** "Applications are the `teacher_applied` events whose `userId` has such a sign-in" does not say whether the sign-in must come before the application or within some window. A visitor already signed in to Teach (Goal 3's second case, 80) produces no `sign_in` event, so their application is not counted. The cross-tab undercount is stated (295, 338); this one is not.

19. **Nit — lines 166-167 against 261, 787.** Staging is reachable only over Tailscale, and the `preview` build's banner link points at staging. The consequence, that the link fails for a preview tester not on Tailscale, is not stated.

## Reviewer Status

| Reviewer            | Status    | Findings | Checked |
| ------------------- | --------- | -------- | ------- |
| `egm-comprehension` | completed | 19       | yes     |

**Severity breakdown** (findings that stood up to checking): 0 Blocker, 6 Major, 16 Nit. 0
finding(s) were refuted on checking and are listed at the end.

**How findings were checked:** after each reviewer finished, a separate agent re-read the cited
lines of the document and opened the cited code. Each finding carries that check's verdict and
evidence.

## Findings as checked (Blockers -> Major -> Nits)

### C1. The new sign-in catalog area has two names: `auth` and `portalAuth` - Severity: Major

-   **Reviewer Lens:** `egm-comprehension`
-   **Affected Scope:** Lines 269 (Teach's sign-in step in the visitor's language) and 505-506
    (Additional Resources) against 581-609 (items 5-6), 628, 642, 651-652 and 826 (Detailed
    Implementation Plan, Verification Plan)
-   **Discrepancy Description:** The feature specification calls the new message-catalog area
    for the sign-in text "a new `auth` area" (269) and "the new `auth` and `learnerTeach` areas"
    (505-506). The Detailed Implementation Plan calls it `portalAuth` throughout (files
    `portalAuth.en.ts`/`portalAuth.zh.ts`, keys `portalAuth.signIn.*`, `portalAuth.verify.*`,
    `portalAuth.blurb.teach`, parity test for `portalAuth`). A reader cannot tell whether these
    are one area or two, or which name is intended.
-   **Rationale & Recommendation:** The reviewer gave no explicit wording. Implied fix: use one
    name in both halves of the document (change `auth` at 269 and 505 to `portalAuth`, or the
    reverse).
-   **Check (confirmed):** learner-teach-banner.md:269 "to the catalog, in a new `auth` area";
    :505-506 "the new `auth` and `learnerTeach` areas"; :581 "areas/portalAuth.en.ts and
    portalAuth.zh.ts"; :609 "Add the `portalAuth` area"; :628 "`t()` with a `portalAuth` key";
    :642 "`portalAuth.verify` key"; :651-652 `blurbKey="portalAuth.blurb.teach"`; :826 "parity
    test for `portalAuth` and `learnerTeach`". Neither name exists today:
    packages/i18n/src/messages/areas/ has no auth.* or portalAuth.* file.

### C2. The existing sign-in flow is never described in one place, though the counting design depends on it - Severity: Major

-   **Reviewer Lens:** `egm-comprehension`
-   **Affected Scope:** Lines 22-25 (Overview), 48 (The Problem), 209-212 (Data flow), 278-283
    (Teach's sign-in step), 287-302 (Counting arrivals)
-   **Discrepancy Description:** Five sub-points. (a) The reader must work out that "sign-in
    request", "magic-link", `requestMagicLink` and `magicLinkRequestSchema` are the same thing;
    the document never says so. (b) That the email holds both a link and a code is confirmed
    only by a message string in the detailed plan (590-591). (c) "Code verify" on `SignInPage`,
    "token verify" on `VerifyPage` and "both branches of `verifyRequestSchema`" (289) are not
    tied to those two paths. (d) Where the emailed link lands is not stated (presumably Teach's
    verify route); the `&from` on that link only works if `preferences-init.js` runs there and
    `VerifyPage` reads it back. (e) `audience` is used at 127, 209 and 303 and never defined.
-   **Rationale & Recommendation:** The reviewer gave no explicit wording. Implied fix: add one
    short description of the sign-in flow (one request, one email with a link and a 6-digit
    code, two verify paths, where the link lands, what `audience` is) before the counting
    section relies on it.
-   **Check (confirmed):** (a) target :48 "sign-in request", :209 "magic-link { email, audience:
    teach, ... }", :288 `magicLinkRequestSchema`, :300 `requestMagicLink` with no sentence
    equating them; in code they are one thing: packages/core/src/contracts/auth.ts:5 and
    apps/api/src/services/auth.service.ts:45. (b) Only explicit statement is :590-591 "We sent a
    sign-in link and code to {email}"; :210 and :279-280 mention "code email" and "emailed link"
    side by side but do not say it is one email (code: auth.service.ts:73-79 sends one email
    with `link` and `code`). (c) :289, :297-298; only hint is :211 "verify { code | token, ...
    }"; code: auth.ts:13-16 is a union of `{token}` and `{email, code}`. (d) Target never names
    the landing route; code: auth.service.ts:67 `new URL('/verify',
    this.portalUrl(input.audience))`, apps/teach/src/router.tsx:39 `/verify` -> `VerifyPage`,
    apps/teach/index.html:7 loads `/preferences-init.js` for every route, so the reviewer's
    presumption is right. (e) `audience` at :127, :209, :212, :303, :557, :571, :839 with no
    definition.

### C3. The language half rests on the Chinese design, described only by the names of its parts - Severity: Major

-   **Reviewer Lens:** `egm-comprehension`
-   **Affected Scope:** Lines 33-34 (Overview), 173-175 (Terms), 278-283 (Teach's sign-in step),
    309-311 (Order of release); also 48, 50, 97, 119-124
-   **Discrepancy Description:** Four sub-points. (a) The resolver: the document does not say
    what it resolves from (browser language, a stored preference, `users.locale`) or what values
    it yields, so CUJ 1's "`zh-SG` browser" giving Chinese (119-124) cannot be followed. (b)
    `localeChosen` (282) is never defined, and it is not said that a verify carrying `locale`
    writes `users.locale`, which is the premise of 282-283. (c) The baseline is mixed: "an
    English sign-in code email, because Teach's sign-in request sends no language" (48) and
    "Teach's start page and dashboard are already translated" (50, 97) read as today's system,
    and the reader cannot tell whether they are true today or only after the Chinese design
    ships. (d) Whether the Chinese design is built, in progress or only proposed is not stated.
-   **Rationale & Recommendation:** The reviewer gave no explicit wording. Implied fix: say the
    Chinese design's status, give the resolver's inputs and outputs in a sentence, define
    `localeChosen` and the verify-writes-`users.locale` rule, and mark which statements describe
    today and which describe the system after the Chinese design.
-   **Check (confirmed):** (a) target :33-34 and :173-175 name "its resolver" only; the rule
    lives in learner-chinese.md:321-329 (`resolveLocale({ stored, account, param,
    deviceLanguages })`, device rule on the `zh` primary subtag). (b) `localeChosen` occurs once
    in the target, :282; defined in learner-chinese.md:301, :365-373. (c) Today no sign-in
    request has a language field at all: packages/core/src/contracts/auth.ts:5-10 (`email`,
    `audience`, `redirectPath` only), so the "because" at :48 only makes sense after the Chinese
    design; "already translated" (:50, :97) is true today (AGENTS.md 'Translated pages' rule
    lists the Teach dashboard and start page). The reviewer's own summary shows the confusion:
    it lists a recorded `sign_in` event as existing behaviour, but learner-chinese.md:523-524
    says "`sign_in` is defined in `ANALYTICS_EVENTS`, but nothing sends it today" and the only
    code hit is the constant at packages/core/src/domain/analytics.ts:2. (d) Target never states
    the status; it is only implied by :309 "After the Chinese design" and :522;
    learner-chinese.md:4 says "Status: Proposed".

### C4. How the error sentences become Chinese is not explained; two statements read as contradictory - Severity: Major

-   **Reviewer Lens:** `egm-comprehension`
-   **Affected Scope:** Lines 46-47 (The Problem), 84-85 (Goal 4), 272-273 (Teach's sign-in
    step), 630-631 (item 8), 643-644 (item 9)
-   **Discrepancy Description:** Goal 4 promises Chinese error sentences on the Teach sign-in
    page. The plan says failures "now go through `useErrorMessage()`" and, in the next sentence,
    "API messages stay English, as ADR 008 sets out". What `useErrorMessage()` does (for
    example, map an error code to a catalog key) and which errors therefore stay English is not
    said. The two statements read as contradictory.
-   **Rationale & Recommendation:** The reviewer gave no explicit wording. Implied fix: say what
    `useErrorMessage()` does and list which sign-in errors end up Chinese and which stay
    English, and bring Goal 4 into line with that.
-   **Check (confirmed):** target :46-47 "(`SignInPage` ... including its error sentences)";
    :84-85 "the Teach sign-in page, its error sentences ... are in Chinese"; :272-273 "the
    failure sentences, which now go through `useErrorMessage()`. API messages stay English, as
    ADR 008 sets out"; :630-631 and :643-644 as cited. The hook does not map codes to keys:
    packages/web-ui/src/preferences/errors.ts:5-16 "The server's message is shown as it is (the
    API answers in English); the two sentences the client words itself ... follow the chosen
    language"; docs/adr/008-theming-preferences-i18n.md:86-87 says the same. So the
    contradiction the reviewer senses is real (see the extra finding).

### C5. "Support" is used and changed by this design but never defined in Terms - Severity: Major

-   **Reviewer Lens:** `egm-comprehension`
-   **Affected Scope:** Lines 39-40 (The Problem), 99 (Non-Goals), 256, 276-277, 290-293, 339,
    657-664; Terms list 161-175
-   **Discrepancy Description:** "Support" is used from the Problem section onwards and this
    design changes it (its sign-in pages are translated, it sends `locale`, its init script
    stores the arrival marker), but the Terms list (161-175) never defines it. The only
    description is a message string in the detailed plan (598-599): "Internal tools: review
    courses, approve teachers, manage payments." Why Support's `preferences-init.js` stores an
    arrival marker, when the banner links only to Teach, is not explained in the feature
    specification; the detailed plan only says the two files are "kept identical" (658).
-   **Rationale & Recommendation:** The reviewer gave no explicit wording. Implied fix: add a
    Terms entry for Support (the internal staff portal that shares `SignInPage`/`VerifyPage`
    with Teach) and say that Support's init script changes only because the two copies are kept
    identical.
-   **Check (confirmed):** target :161-175 Terms has entries for Explore, Teach, An owner, The
    arrival marker and The Chinese design only. Support appears at :39-40 ("Support's portal is
    the only app that knows `TEACH_URL`"), :99, :256, :276-277, :290, :339, :657. Nuance: :39
    "Support's portal", :276 "Both portals" and :339 "Support staff" do tell the reader it is a
    staff portal, so 598-599 is the only description of what it is for rather than the only
    clue. No reason is given at :290-293 for Support storing the marker; :658 says "kept
    identical", matching the code comment at apps/teach/public/preferences-init.js:8
    "apps/support/public/preferences-init.js is the same file; change both together".

### C6. Goal 4's Chinese error sentences cannot be met through `useErrorMessage()` for server-worded errors (reviewer finding 4 understated) - Severity: Major

-   **Reviewer Lens:** `egm-comprehension` (raised by the checker)
-   **Affected Scope:** Lines 84-85 (Goal 4), 272-273 (Teach's sign-in step), 630-631 and
    643-644 (items 8-9), 836-837 (Verification Plan)
-   **Discrepancy Description:** Reviewer finding 4 treats this as an unexplained mechanism and
    guesses the hook might map an error code to a catalog key. It does not. `useErrorMessage()`
    shows the server's message unchanged and translates only two client-worded sentences
    (request never reached the server; failure with no message). Every sign-in failure the
    server words (wrong code, expired or used link, too many requests, locked code, no Support
    access) therefore stays English on the translated page. Goal 4 says the page's "error
    sentences ... are in Chinese" without exception, and the manual check at 836-837 walks "a
    wrong code" in Chinese, which will show English text. Only the invalid-email sentence and
    the incomplete-link sentence, which the pages word themselves, become Chinese.
-   **Rationale & Recommendation:** Either narrow Goal 4 and line 46-47 to the sentences the
    client words (invalid email, incomplete link, unreachable, generic) and say that server
    messages stay English per ADR 008, or add a code-to-key mapping for the sign-in error codes
    (`link_invalid`, `link_expired`, `code_invalid`, `code_locked`) and say so in items 8-9.
-   **Check (confirmed):** packages/web-ui/src/preferences/errors.ts:5-16 ("The server's message
    is shown as it is (the API answers in English); the two sentences the client words itself
    ... follow the chosen language"); packages/web-ui/src/portal/api.ts:50-58 (`if (error
    instanceof ApiError) return error.message`); server-worded English sentences at
    apps/api/src/services/auth.service.ts:104-108, :109-110, :114, :124-127, :136, :144;
    client-worded sentences today at packages/web-ui/src/portal/SignInPage.tsx:38 and
    VerifyPage.tsx:22; docs/adr/008-theming-preferences-i18n.md:86-87.

### C7. "The brief", "brainstorm review" and "Goldfish review" are used before or without being identified - Severity: Nit

-   **Reviewer Lens:** `egm-comprehension`
-   **Affected Scope:** Lines 64, 93, 95-96, 112, 179, 182, 360-361, 370-371, 501-502 (also 333,
    383, 393, 396)
-   **Discrepancy Description:** "The brief" is used from line 64 but identified as
    `learner-main-page-improvements.md` only at 361 and 501. Line 32 links that file without
    calling it the brief. "Brainstorm review" (360, 370) and "Goldfish review" (502) are never
    explained.
-   **Rationale & Recommendation:** The reviewer gave no explicit wording. Implied fix: call the
    linked file "the brief" where it is first linked (31-32) and explain or drop "brainstorm
    review" and "Goldfish review".
-   **Check (confirmed):** target :64 "the brief rejected it"; :93, :95-96 "Rejected in the
    brief" (the words straddle 95/96); :112; :179; :182; :31-32 link the file as "four separate
    designs drawn from [learner-main-page-improvements.md]" with no "brief"; :360-361 and
    :370-371 "Rejected in the brainstorm review (`[the brief](...)`)"; :501-502 "the brief and
    Goldfish review this design comes from". The linked file itself contains neither
    "brainstorm" nor "Goldfish" (grep -i on docs/designs/learner-main-page-improvements.md
    returns nothing).

### C8. Alternative C's rejected-applicant con does not separate it from the chosen rule; statuses and the application-to-profile link are not stated - Severity: Nit

-   **Reviewer Lens:** `egm-comprehension`
-   **Affected Scope:** Lines 374-384 (Alternative C) against 75 (Goal 2) and 179-181 (drafting
    decision 1); also 139-140
-   **Discrepancy Description:** Alternative C lists as a con that a rejected applicant "never
    gets it either". The chosen rule hides the banner from owners "at any status", which appears
    to hide it from a rejected applicant too, so this con does not separate C from the chosen
    design. The profile statuses are never listed (`approved` and `applied` appear at 139-140;
    rejected is implied). The link between an application and an owned profile is not stated.
-   **Rationale & Recommendation:** The reviewer gave no explicit wording. Implied fix: drop or
    reword the con at 381, list the three statuses, and say that applying creates a profile the
    applicant owns.
-   **Check (confirmed):** target :381 "A rejected applicant, whom Teach lets resubmit, never
    gets it either"; :75 "owns a teaching profile, whatever its status"; :179-180 "`role:
    'owner'`, at any status"; :389 (Alternative D) "Rejected applicants still see it" confirms
    the chosen rule hides them. Code: packages/core/src/domain/permissions.ts:30 `ProfileStatus
    = 'applied' | 'approved' | 'rejected'`; apps/api/src/services/profiles.service.ts:581 sets
    `status: 'rejected'` on the same profile row; apps/api/src/services/auth.service.ts:217-241
    returns every owned profile as `role: 'owner'` with no status filter. So a rejected
    applicant is an owner and is hidden under the chosen rule. Statuses in the target: only
    `approved`/`applied` at :139-140.

### C9. Goal 4 is unconditional, but `lang` is stored only if nothing is stored - Severity: Nit

-   **Reviewer Lens:** `egm-comprehension`
-   **Affected Scope:** Lines 84-85 (Goal 4) against 204 (Data flow)
-   **Discrepancy Description:** Goal 4 says without condition that Teach's door is in Chinese
    when the learner app is. The data flow says `lang` is stored only "if nothing stored". A
    returning visitor with a stored Teach language is an exception that the prose never states.
-   **Rationale & Recommendation:** The reviewer gave no explicit wording. Implied fix: state
    the exception in Goal 4 or in the sign-in section (a language already chosen in Teach wins
    over `?lang`).
-   **Check (confirmed):** target :84-85 "With the learner app in Chinese, the Teach sign-in
    page ... are in Chinese"; :204 "preferences-init.js: store lang (if nothing stored)". The
    Chinese design confirms the rule: learner-chinese.md:1616-1618 "When `?lang` is `en` or `zh`
    and the stored `locale` is not `en` or `zh`: merge ..." and :321-323 the resolver returns
    `stored` first. No prose in the target mentions the returning-visitor case.

### C10. The Overview's "four things" leaves out arrival counting - Severity: Nit

-   **Reviewer Lens:** `egm-comprehension`
-   **Affected Scope:** Lines 16-27 (Overview) against 86-87 (Goal 5) and 285-305 (Counting
    arrivals)
-   **Discrepancy Description:** The Overview says "It does four things" and leaves out arrival
    counting, which is Goal 5 and has its own section (285-305).
-   **Rationale & Recommendation:** The reviewer gave no explicit wording. Implied fix: add
    counting as a fifth item in the Overview list.
-   **Check (confirmed):** target :16 "It does four things:" then items at :18-27 (banner,
    `/teach` introduction, link with `?lang`, language of the first Teach pages); none mentions
    counting or `from=learner`. :86-87 Goal 5 "Arrivals from the banner can be counted"; :285
    "### Counting arrivals".

### C11. "As the hero is" compares to something never described - Severity: Nit

-   **Reviewer Lens:** `egm-comprehension`
-   **Affected Scope:** Lines 157 (CUJ 5) and 185 (drafting decision 3)
-   **Discrepancy Description:** "As the hero is": Explore's hero is never described, so the
    comparison tells the reader nothing about when it hides.
-   **Rationale & Recommendation:** The reviewer gave no explicit wording. Implied fix: say what
    the hero is (the scene at the top of Explore that is hidden while a search or category
    filter is active) or drop the comparison.
-   **Check (confirmed):** "hero" occurs in the target only at :157 and :185, both as "as the
    hero is". The comparison is accurate in code but not explained in the document:
    apps/learner/src/app/(tabs)/index.tsx:31 `const searching = q.length > 0 || !!category`, :36
    `{!searching ? (` wraps the hero (:37 comment, :58 `<HeroScene .../>`).

### C12. "The catalog" has two meanings; "area" is undefined; ADR 008 is cited before it is linked - Severity: Nit

-   **Reviewer Lens:** `egm-comprehension`
-   **Affected Scope:** Line 220-221 (The banner) against 269 (Teach's sign-in step); 273; 505
-   **Discrepancy Description:** "The catalog" means the course catalog at 221 and the message
    catalog at 269 and after. "Area" (269) is not defined, and ADR 008 is first cited at 273 but
    linked only at 505.
-   **Rationale & Recommendation:** The reviewer gave no explicit wording. Implied fix: say
    "course list" at 220-221 or "message catalog" at 269, define "area" on first use, and link
    ADR 008 at 273.
-   **Check (confirmed):** Line correction: the word "catalog" is on :220 ("including when the
    catalog is") with "empty" on :221. :269 "move every sentence to the catalog, in a new `auth`
    area"; :273 "as ADR 008 sets out" (no link; also :601-602); first link at :505 `[ADR
    008](../adr/008-theming-preferences-i18n.md)`. "Area" is defined only in the ADR:
    docs/adr/008-theming-preferences-i18n.md:63-64.

### C13. `preferences-init.js` is used without a description - Severity: Nit

-   **Reviewer Lens:** `egm-comprehension`
-   **Affected Scope:** Lines 204 (Data flow) and 290 (Counting arrivals); 655-659 (item 11)
-   **Discrepancy Description:** `preferences-init.js` appears in the data flow and in "Counting
    arrivals" with no description. "Web pre-paint scripts" appears only in the detailed plan
    (655-659).
-   **Rationale & Recommendation:** The reviewer gave no explicit wording. Implied fix: describe
    the script once in the feature specification (the portal's pre-paint script, loaded from
    `index.html` before the app starts).
-   **Check (confirmed):** target :204 "preferences-init.js: store lang ..."; :290-291 "The
    Teach and Support `preferences-init.js` copies already read `?lang` (the Chinese design's PR
    4)" says what it will read, not what it is; "pre-paint" appears only at :655 and :659. What
    it is: apps/teach/public/preferences-init.js:1-5 "Applies the stored theme and language
    before first paint ... index.html loads it as a classic script in <head>".

### C14. "PR 1" to "PR 4" mean two different designs' pull requests in adjacent bullets - Severity: Nit

-   **Reviewer Lens:** `egm-comprehension`
-   **Affected Scope:** Lines 309-311, 313-317 (Order of release); 344, 346 (Rollout and
    rollback)
-   **Discrepancy Description:** "PR 1" to "PR 4" mean the Chinese design's pull requests at
    309-311 and this design's at 313-317, 344 and 346. "The next store build after PR 2" (317)
    follows directly after "PR 2 (the code email…)" of the other design.
-   **Rationale & Recommendation:** The reviewer gave no explicit wording. Implied fix: qualify
    the numbers (for example "Chinese PR 2" and "banner PR 2") or name this design's two pull
    requests differently.
-   **Check (confirmed):** target :309-311 "This design needs its PR 1 ..., PR 2 (the code email
    in the request's language), PR 3 ... and PR 4"; :312-316 "Two pull requests: 1. Teach's
    sign-in step ... 2. The learner app"; :317 "The banner ships in the next store build after
    PR 2"; :344 "a revert of PR 2"; :346 "Reverting PR 1". The Chinese design's own numbering:
    learner-chinese.md:797-817.

### C15. Ambiguous "it" in "when it was sent" - Severity: Nit

-   **Reviewer Lens:** `egm-comprehension`
-   **Affected Scope:** Line 300 (Counting arrivals, On the server); compare 554 (item 2)
-   **Discrepancy Description:** "Appends `&from=<source>` to the emailed link when it was
    sent": "it" reads as the link. Line 554 states it clearly ("when `input.source` is set").
-   **Rationale & Recommendation:** Use the clear wording from line 554 at line 300: "when
    `input.source` is set" (or "when the request carried `source`").
-   **Check (confirmed):** target :300 "`requestMagicLink` appends `&from=<source>` to the
    emailed link when it was sent, so a link opened in a new tab still carries it"; :554-555
    "when `input.source` is set, append `&from=<input.source>` to the emailed URL".

### C16. "Older clients" in the rollback note are really newer cached clients, and `locale` is not removed by this revert - Severity: Nit

-   **Reviewer Lens:** `egm-comprehension`
-   **Affected Scope:** Lines 346-347 (Rollout and rollback)
-   **Discrepancy Description:** "Older clients that still send `source` or `locale`" describes
    newer cached clients talking to a reverted server. `locale` on the request comes from the
    Chinese design, so a revert of this design's PR 1 would not remove it.
-   **Rationale & Recommendation:** The reviewer gave no explicit wording. Implied fix: say
    "cached builds of the reverted pages that still send `source`" and drop `locale` from the
    sentence, since the server keeps accepting it.
-   **Check (confirmed):** target :346-347 "Reverting PR 1 ... Older clients that still send
    `source` or `locale` are fine, because zod drops unknown keys". The `locale` request field
    belongs to the Chinese design: target :309-310 "its PR 1 (the resolver and the `locale`
    request field)"; learner-chinese.md:881 "`magicLinkRequestSchema` adds `locale:
    localeSchema.optional()`" under PR 1 (:830). After the revert the only clients sending
    `source` are ones built from the reverted (newer) code.

### C17. The Chinese design's sentence to be amended is quoted two ways, with two different actions - Severity: Nit

-   **Reviewer Lens:** `egm-comprehension`
-   **Affected Scope:** Lines 280-281 (Teach's sign-in step) against 675-676 (item 12)
-   **Discrepancy Description:** The Chinese design's sentence to be amended is quoted two ways:
    "Teach and Support send no `locale`" and "Teach and Support send none, so their links carry
    no `lang`". One place says the sentence "is amended"; the other says it "gains a pointer".
-   **Rationale & Recommendation:** The reviewer gave no explicit wording. Implied fix: quote
    the sentence once, as it stands in learner-chinese.md, and use one verb for what happens to
    it.
-   **Check (confirmed):** target :280-281 "This changes the Chinese design's \"Teach and
    Support send no `locale`\": that sentence is amended when this design lands"; :675-676 "its
    sentence \"Teach and Support send none, so their links carry no `lang`\" gains a pointer to
    this design". The real sentence is the second form: learner-chinese.md:420-421 "Teach and
    Support send none, so their links carry no `lang`." The quote at :280 is a paraphrase.

### C18. "Profile", `PreferenceRows`, `preferences-storage` and "the picker" are referenced without description - Severity: Nit

-   **Reviewer Lens:** `egm-comprehension`
-   **Affected Scope:** Lines 232-233 (The banner, Dismissal), 334 and 339 (Risks), 484
    (Alternative L), 512 (Future Improvements)
-   **Discrepancy Description:** "Profile" (a learner-app screen, as against a teaching
    profile), `PreferenceRows`, `preferences-storage` and "the picker" in Teach and Support are
    referenced without a description of what or where they are.
-   **Rationale & Recommendation:** The reviewer gave no explicit wording. Implied fix: say on
    first use that Profile is the learner app's Profile tab, that `PreferenceRows` is the
    portals' preferences list, where `preferences-storage` lives, and that "the picker" is the
    language picker in the portals' preferences.
-   **Check (confirmed):** target :232 "a small storage module beside `preferences-storage`";
    :232-233 "it gets no row in Profile or `PreferenceRows`"; :334 "A link from Profile"; :339
    "its picker switches language"; :484 "choose English in the picker"; :512 "link in Profile".
    None is described anywhere in the target; the terms are explained only outside it (AGENTS.md
    rule on new user preferences names `PreferenceRows` (web) and the learner Profile card;
    learner-chinese.md:498 "The picker. `PreferenceRows` gains ...").

### C19. The application count has no ordering or window, and already-signed-in visitors are an unstated undercount - Severity: Nit

-   **Reviewer Lens:** `egm-comprehension`
-   **Affected Scope:** Lines 303-305 (Counting arrivals, The count) and 839-840 (Success
    measure); Goal 3 second case at 80
-   **Discrepancy Description:** "Applications are the `teacher_applied` events whose `userId`
    has such a sign-in" does not say whether the sign-in must come before the application or
    within some window. A visitor already signed in to Teach (Goal 3's second case, 80) produces
    no `sign_in` event, so their application is not counted. The cross-tab undercount is stated
    (295, 338); this one is not.
-   **Rationale & Recommendation:** The reviewer gave no explicit wording. Implied fix: state
    the ordering rule for the application query and add the already-signed-in case to the
    accepted undercounts.
-   **Check (confirmed):** target :303-305 "Applications are the `teacher_applied` events whose
    `userId` has such a sign-in" and :839-840 "the `teacher_applied` events of those users" give
    no order or window. The event is recorded only at verify: target :302 "`verify` adds
    `source` ... to the `sign_in` event's properties"; learner-chinese.md:523 "`sign_in`, sent
    from verify". A signed-in arrival does not verify: target :207 "signed in -> HomeRedirect",
    :80; apps/teach/src/routes/gate.tsx:16-26 only redirects. Stated undercounts are cross-tab
    only: :295 and :338.

### C20. The preview build's banner link points at Tailscale-only staging, and the consequence is not stated - Severity: Nit

-   **Reviewer Lens:** `egm-comprehension`
-   **Affected Scope:** Lines 166-167 (Terms) against 261 (Configuration) and 787-788 (item 22)
-   **Discrepancy Description:** Staging is reachable only over Tailscale, and the `preview`
    build's banner link points at staging. The consequence, that the link fails for a preview
    tester not on Tailscale, is not stated.
-   **Rationale & Recommendation:** The reviewer gave no explicit wording. Implied fix: add a
    sentence that a `preview` build's Teach link needs a device on the tailnet.
-   **Check (confirmed):** target :166-167 "Staging is reachable only over Tailscale"; :261-262
    and :787-788 "`EXPO_PUBLIC_TEACH_URL` is `https://teach.staging.elevatelearn.app` in
    `preview`"; the only mentions of Tailscale and `preview` in the target are :167 and :788,
    with no consequence stated. Context that lowers the weight but does not refute it: the
    `preview` profile already points the app's API and web URL at staging
    (apps/learner/eas.json:10-13), and staging's API also answers 403 off the tailnet
    (infra/README.md:191, :200-202), so a preview tester off Tailscale already cannot use the
    app.

### C21. The `sign_in` event the count depends on is not sent today, and the document never says the Chinese design adds it - Severity: Nit

-   **Reviewer Lens:** `egm-comprehension` (raised by the checker)
-   **Affected Scope:** Lines 52-53 (The Problem), 188-190 (drafting decision 5), 302-305
    (Counting arrivals), 309-311 (Order of release), 556-557 (item 2)
-   **Discrepancy Description:** The target speaks of "the `sign_in` event" as if it exists
    ("the `sign_in` event records it", "`verify` adds `source` ... to the `sign_in` event's
    properties", "beside `audience` and `locale`"). Today nothing sends that event; it is added
    by the Chinese design's PR 1. The Order of release list of what this design needs from the
    Chinese design's PR 1 ("the resolver and the `locale` request field") leaves the event out.
    The reviewer's own summary of the existing system ("The server then records a `sign_in`
    analytics event") shows a reader takes it as current behaviour. This is a concrete instance
    of the mixed baseline in reviewer finding 3.
-   **Rationale & Recommendation:** Say at 188-190 or 302 that the `sign_in` event is first sent
    by the Chinese design's PR 1, and add it to the dependency list at 309-311.
-   **Check (confirmed):** learner-chinese.md:523-524 "`sign_in` is defined in
    `ANALYTICS_EVENTS`, but nothing sends it today" and :961-969 (the `trackEvent` call it adds
    under PR 1); in code the only occurrence is the constant at
    packages/core/src/domain/analytics.ts:2, and apps/api/src/services/auth.service.ts:86-150
    (`verify`) records no event.

### C22. The data flow shows `locale` on Teach's `sign_in` event, but Teach sends no `locale` at verify, so it will be null - Severity: Nit

-   **Reviewer Lens:** `egm-comprehension` (raised by the checker)
-   **Affected Scope:** Line 212 (Data flow) against 282-283 (Verify is unchanged for the
    language) and 635 (item 8)
-   **Discrepancy Description:** Met while checking findings 3 and 18. The data-flow diagram
    ends the Teach flow with `sign_in event { audience: teach, locale, source: learner }`. The
    Chinese design fills that property from the verify request's `locale`, and this design
    states that Teach sends no `locale` at verify. A Teach sign-in from the banner will
    therefore record `locale: null`, so the event cannot show which language banner arrivals
    used, and the diagram suggests otherwise.
-   **Rationale & Recommendation:** Show `locale: null` (or drop `locale`) on the Teach
    `sign_in` event at line 212, or say that language for Teach arrivals is not recorded.
-   **Check (confirmed):** target :212; :282-283 "Teach sends no `locale` or `localeChosen` at
    verify"; :635 "The code verify sends `source: arrivalSource()`, and no `locale`";
    learner-chinese.md:965-968 `properties: { audience: link.audience, locale: input.locale ??
    null }` where `input` is the verify request.
