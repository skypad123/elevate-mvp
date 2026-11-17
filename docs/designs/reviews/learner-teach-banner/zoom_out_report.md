# Goldfish Review Report: Stage 5 (Initial Zoom Out)

**Target:** `docs/designs/learner-teach-banner.md` (full file, lines 1-846)

**Stage:** 5 (Initial Zoom Out Review), uninterrupted full flow. **Mode:** REVIEW.

Two reviewers ran, each once and in a fresh context: `egm-zoom-out` against the Zoom-Out Standard,
and `egm-inventive-catalyst`. The catalyst's own report is reproduced in full after the findings,
because its contradictions and transformations do not all reduce to severity findings.

## Reviewer Status

| Reviewer                 | Status    | Findings | Checked |
| ------------------------ | --------- | -------- | ------- |
| `egm-zoom-out`           | completed | 6        | yes     |
| `egm-inventive-catalyst` | completed | 5        | yes     |

**Severity breakdown** (findings that stood up to checking): 0 Blocker, 5 Major, 7 Nit. 0 finding(s)
were refuted on checking and are listed at the end.

**How findings were checked:** after each reviewer finished, a separate agent re-read the cited
lines of the document and opened the cited code. Each finding carries that check's verdict and
evidence.

## Prioritized Findings (Blockers -> Major -> Nits)

### Z1. The arrival-count pipeline passes one analytics property through too many components - Severity: Major

-   **Reviewer Lens:** `egm-zoom-out`
-   **Affected Scope:** Target lines 171-172 (Terms, the arrival marker), 188-190 (drafting
    decision 5), 209-212 (Data flow), 285-305 (Counting arrivals), 338 (risk row 'The marker is
    lost across tabs'), 455-464 (Alternative J), 466-474 (Alternative K), 540-577 (plan items
    1-4), 613-621 (item 7), 633-635 (item 8), 645 (item 9), 655-664 (item 11). All the
    reviewer's line numbers are correct for the file as it is now.
-   **Discrepancy Description:** The reviewer says one analytics property with one allowed value
    (`source: 'learner'`) travels through too many parts (standard section 2, Minimalist Data
    Flow). The path is: the link, both `preferences-init.js` copies, `sessionStorage`, a new
    `arrivalSource()` helper, then three client sends (sign-in request, code verify, token
    verify). The server also writes `&from` into the emailed link, only to get it back through
    the init script, `sessionStorage` and the verify request. The contract gains a field on
    three schemas, and risk row 338 still accepts an undercount. The reviewer points out that
    the codebase already carries per-request sign-in context on the magic-link row:
    `redirectPath` is written in `requestMagicLink` and read back at `verify` for both code and
    token (`apps/api/src/services/auth.service.ts` lines 63 and 149;
    `packages/db/src/schema/auth.ts` line 55). Alternative K (lines 466-474) follows that
    pattern: one nullable column, the client sends `source` once, and it removes both
    verify-branch contract changes, the `VerifyPage` change, the code-verify send, the `&from`
    on the emailed link and risk row 338. The rejection weighs only "a migration" against none
    of that. Alternative J (no attribution) is also viable at pilot size, because line 39 says
    Teach's address is known only to people Elevate tells directly, so other sign-ins can be
    attributed by exclusion. Any sign-in-based count misses visitors already signed in to Teach
    (Goal 3's second and third cases, lines 79-81), so the `teacher_applied` join at lines
    303-305 undercounts however many hops are added. Smaller points: `arrivalSourceSchema` is a
    general "arrival source" concept built for one caller, and Support's init script gains a
    marker nothing sends it (forced by the keep-identical rule).
-   **Rationale & Recommendation:** Reconsider Alternative K against the full cost of the chosen
    path, or defer attribution (Alternative J).
-   **Check (partly confirmed):** What holds:
    -   The path is as described: learner-teach-banner.md:290-298 (init scripts write
        `elevate.from` to `sessionStorage`; `arrivalSource()` reads it; `SignInPage` sends
        it with the sign-in request and the code verify, `VerifyPage` with the token verify)
        and :300-301 (`requestMagicLink` appends `&from=<source>` to the emailed link).
    -   Three schemas: learner-teach-banner.md:288-289 and :546-547; the current contract is
        one object plus a two-branch union at packages/core/src/contracts/auth.ts:5-16.
    -   The existing pattern: apps/api/src/services/auth.service.ts:63 `redirectPath:
        input.redirectPath ?? null` (insert into `magic_links`), :149 `redirectPath:
        link.redirectPath` (returned after either the token or the code lookup at :93-101);
        packages/db/src/schema/auth.ts:55 `redirectPath: text()`.
    -   Alternative K's rejection names only the migration: learner-teach-banner.md:472-474
        ("A migration on `magic_links` for one analytics property"; "Appending `&from` to
        the emailed link gives the same coverage for the link path without a column").
    -   Line 39 quote is exact. Already-signed-in visitors skip sign-in
        (learner-teach-banner.md:79-81), and applications are counted only through
        "`teacher_applied` events whose `userId` has such a sign-in" (:303-305); no risk row
        covers that undercount.
    -   `z.enum(['learner'])` at :287; Support's script is changed at :657-658 "kept
        identical", and both existing scripts carry the comment "is the same file; change
        both together" (apps/teach/public/preferences-init.js:8,
        apps/support/public/preferences-init.js:8). The only link carrying `from` goes to
        `TEACH_URL` (:78, :250).

    What is overstated:
    -   Alternative K does not remove risk row 338. Under K the client still reads the
        marker from `sessionStorage` to send it once on the sign-in request, so a visitor
        who arrives in one tab and asks for a code later in another tab is still not counted
        (:295, :338). K removes only the emailed-link part of that risk, which the doc's own
        Pros line already says (:469-470).
    -   K does not remove "the `VerifyPage` change" as a whole. It removes only the `source`
        send at :645; `VerifyPage` is still modified for translation (:642-644).

    Judgement, not testable: that Alternative J is "viable at pilot size" by exclusion.

### Z2. Dismissal is a second protection against intrusiveness that the bottom-of-list placement already gives - Severity: Major

-   **Reviewer Lens:** `egm-zoom-out`
-   **Affected Scope:** Target lines 144-151 (CUJ 4), 186-187 (drafting decision 4), 226 (banner
    rule), 230-234 (Dismissal), 334 (risk row), 434-442 (Alternative H), 512-513 (Future
    Improvements), 700-722 (plan items 15 and 16), 730-732 (item 17 close button), 805-806 (item
    23 test bullet), 813-817 (item 24 Maestro flow). All the reviewer's line numbers are correct
    for the file as it is now.
-   **Discrepancy Description:** The reviewer says the banner gets two separate protections
    against being intrusive and one is enough (YAGNI). Decision 3 places it after the whole list
    and "Load more" so it "doesn't interrupt the list" (lines 184-185, 431-432). Decision 4 adds
    a permanent per-device dismissal so it doesn't "read as an advert" (lines 441-442). A footer
    the doc itself expects few people to reach (lines 65-66) does not need a close button.
    Dismissal costs: two new storage files; an async "flag unread" state in the visibility rule;
    a `dismiss` API on the hook, a close control and its message key; a test bullet and the
    relaunch half of the Maestro flow; risk row 334 and a Future Improvement (a Profile link,
    lines 512-513) that exists only to undo it. Without it, `useTeachBanner` is a pure
    derivation from session state and `searching`, and items 15 and 24 mostly disappear. If
    dismissal is kept, one file should do: AsyncStorage is already a dependency
    (`apps/learner/package.json` line 13), and the preferences `.web.ts` sibling exists only for
    a synchronous first-paint read (`apps/learner/src/lib/preferences-storage.web.ts` line 8),
    which the banner does not need because the hook already hides while the flag is unread. The
    reviewer states one thing as not confirmed: that AsyncStorage's web build is
    localStorage-backed (upstream documented behaviour; `node_modules` is not present in the
    worktree).
-   **Rationale & Recommendation:** Drop dismissal for v1 (Alternative H), or collapse item 15
    to one storage file.
-   **Check (partly confirmed):** What holds:
    -   Placement and its reason: learner-teach-banner.md:184-185 and :431-432 ("so the
        banner doesn't interrupt the list"). Dismissal and its reason: :186-187 and :441-442
        ("a banner that can't be closed reads as an advert"). Low reach: :65-66 ("may rarely
        be seen").
    -   Each listed cost is in the doc: two files at :702-703; "the device's dismissal flag
        hasn't been read yet" at :226 and :719; `dismiss` at :716-722; close button at
        :730-731 and key `.close` at :774; test bullet at :805-806; relaunch at :816-817;
        risk row at :334; Profile link at :512-513.
    -   apps/learner/package.json:13 `"@react-native-async-storage/async-storage": "2.2.0"`.
    -   apps/learner/src/lib/preferences-storage.web.ts:8 `/** Web: localStorage is
        synchronous, so the very first render already has the stored theme. */`; the native
        sibling says the same from the other side
        (apps/learner/src/lib/preferences-storage.ts:9-11).
    -   No `node_modules` directory exists at the worktree root or in apps/learner, so the
        reviewer's "not confirmed" caveat stands; I could not check the package's web build
        either.

    What is overstated:
    -   "Items 15 and 24 mostly disappear": item 15 disappears entirely, but only the second
        half of item 24 does. The Maestro flow's first half (launch, scroll to
        `teach-banner-open`, tap, assert `teach-open`, :815-816) does not depend on
        dismissal.

    Context for the one-file option (not a refutation): the learner app does not currently use
    AsyncStorage on web. Its only import outside tests is the native file
    apps/learner/src/lib/preferences-storage.ts:7, and both web siblings use
    `window.localStorage` directly (preferences-storage.web.ts:11, token-storage.web.ts). One
    file would be the first use of AsyncStorage's web build in this app.

    Judgement, not testable: that one protection is enough and a rarely reached footer needs no
    close button.

### Z3. The second sign-in is treated as a binary choice (plain link vs session hand-over); a signed-in learner could trigger the existing Teach sign-in email from the learner app - Severity: Major

-   **Reviewer Lens:** `egm-inventive-catalyst`
-   **Affected Scope:** learner-teach-banner.md: "The weak point of the idea" (lines 61-64),
    Non-Goals (93-96), Risks row "The second sign-in loses people" (333), Alternatives A and B
    (351-372), Future Improvements (515). Also cited: 295, 300-301, 338, 129-135, 486-495.
-   **Discrepancy Description:** The reviewer says the design frames the choice as either a
    plain link (a signed-in learner retypes their email in Teach and asks for a code) or a
    session hand-over that "needs a new one-time code exchange and its own security design", and
    rejects `?email=` because it puts the address in a URL. The reviewer argues the retype and
    the Teach-side request step are not forced by rejecting the hand-over, because the existing
    sign-in request is already a one-time exchange: `POST /auth/magic-link` takes `audience` in
    the body from any unauthenticated client (apps/api/src/routes/auth.ts lines 12-17) and
    already emails a link that signs the browser in at `TEACH_URL/verify`
    (apps/api/src/services/auth.service.ts lines 45-84). Secondary liabilities the reviewer
    lists: the inbox round trip remains; `/teach` gains a second branch to translate, test and
    cover in CUJ 2 (lines 129-135); a button press now sends an email and accidental presses
    count against the per-email window shared with the learner's own sign-ins; someone already
    signed in to Teach gets an email they do not need unless a secondary "Open Teach" link
    stays; mail apps' in-app browsers may hold the Teach session outside the default browser
    (the exposure Alternative M describes, lines 486-495); and it reopens a decision the brief
    closed (lines 93-96), so it needs the author's call.
-   **Rationale & Recommendation:** For a signed-in learner, have the `/teach` button call the
    existing sign-in request itself with `{ email: user.email, audience: 'teach', locale,
    source: 'learner' }`, then show "we emailed you a sign-in link for Teach". The emailed link
    already carries `&lang` and `&from` under this design (lines 300-301). Signed-out visitors
    keep the plain link. The reviewer says this needs no new endpoint or token type, puts no
    email in any URL, and makes `source` originate in the learner app for that segment so its
    attribution no longer depends on `sessionStorage` surviving in the Teach tab (lines 295,
    338).
-   **Check (confirmed):** Document claims hold: learner-teach-banner.md:61-64 ("A plain link
    means a second sign-in ... needs a one-time code exchange and its own security design; the
    brief rejected it"), 93-96 (both Non-Goals), 333, 351-372, 515, 300-301 (`&from` appended to
    the emailed link), 279-280 (`&lang` on the emailed link), 295 and 338 (marker lost across
    tabs). Code claims hold: apps/api/src/routes/auth.ts:12-19 registers `/magic-link` with only
    `rateLimit` and `validate('json', magicLinkRequestSchema)`, no `requireUser`;
    packages/core/src/contracts/auth.ts:5-10 has `audience` in the body;
    apps/api/src/services/auth.service.ts:67-80 builds `new URL('/verify',
    this.portalUrl(input.audience))` with only `token` (and `redirect`) in the query and mails
    it, so no email is in the URL; auth.service.ts:36-43 maps `teach` to `env.TEACH_URL`. The
    shared per-email window is real: auth.service.ts:49-54 counts `magic_links` by `email` only
    (5 per 15 minutes, lines 17-18), not by audience. The brief's rejections are at
    docs/designs/learner-main-page-improvements.md:234-235 (`?email=`) and 240-241 (session
    hand-over). One nuance, not a refutation: under the proposal `source` still reaches the
    `sign_in` event through the emailed link's `&from`, the pre-paint script and
    `sessionStorage` within the one page load (target 298, 300-302, 661); what goes away is the
    need for the marker to survive between landing and a later sign-in. Whether to reopen the
    brief's decision is the author's call.

### Z4. Measurement is framed as full client funnel vs only `sign_in` + `teacher_applied`; two accepted risks are deferred to one count that cannot tell them apart - Severity: Major

-   **Reviewer Lens:** `egm-inventive-catalyst`
-   **Affected Scope:** learner-teach-banner.md: Goal 5 (86-87), drafting decision 5 (188-190),
    "Counting arrivals" (285-305), Risks rows (332-333), Alternatives G and I (430-432,
    444-453), Future Improvements (514-516), Success measure (839-840). Also cited: 99-100,
    303-305, 337.
-   **Discrepancy Description:** The reviewer says Alternative I frames measurement as either a
    full client funnel behind "a new unauthenticated endpoint" or only `sign_in` plus
    `teacher_applied`. The design takes the second and then defers two accepted risks to that
    single count: placement (line 332, "The arrival count shows whether it works") and the
    second sign-in (line 333). A low count cannot say which caused it, and Future Improvements
    515 and 516 are each conditioned on a signal the design cannot produce. Separately, a
    visitor who lands already signed in to Teach produces no `sign_in` event, so neither they
    nor their application is counted, which Goal 5 promises. Secondary liabilities the reviewer
    lists: a new name in `ANALYTICS_EVENTS`; an unauthenticated request now writes analytics
    rows, bounded only by the route's existing rate limit and the per-email window; a forged
    `from` inflates this count too (risk at line 337); the event has no user and must hold no
    email, so "Resend" presses cannot be de-duplicated (it counts requests, not people); banner
    views and presses in the learner app stay unmeasured; the optional application `source` adds
    a contract field in Teach's apply forms, which the design otherwise leaves unchanged (lines
    99-100).
-   **Rationale & Recommendation:** Record an event inside `requestMagicLink` when `source` is
    set, with `{ audience, locale, source }` and `userId: null`. `trackEvent` accepts a null
    user (apps/api/src/services/audit.service.ts lines 46-61) and `analytics_events.user_id` is
    nullable (packages/db/src/schema/system.ts line 42). The reviewer says the count then splits
    "landed and asked for a code" from "completed sign-in", isolating the second-sign-in loss
    from the placement loss with no new endpoint. Optionally, send `source: arrivalSource()`
    with the application request so `teacher_applied` is attributed directly, not by joining to
    any past sign-in (lines 303-305); that would also cover arrivals already signed in.
-   **Check (partly confirmed):** Holds: learner-teach-banner.md:444-453 (Alternative I: "A new
    unauthenticated endpoint"; "sign-ins and applications are the numbers that matter"); 332
    quotes "The arrival count shows whether it works" exactly; 432 repeats it; 516 conditions a
    move on "if the arrival count shows few people reach it" and 515 on "if the second sign-in
    turns out to lose many people", and the design records only completed sign-ins (302-305), so
    neither condition has its own signal. The already-signed-in gap holds: `source` is recorded
    only at `verify` (target 302; apps/api/src/services/auth.service.ts:86-150 is the only
    sign-in path), and applications are attributed only through "`teacher_applied` events whose
    `userId` has such a sign-in" (303-304), while a signed-in arrival goes straight to
    `HomeRedirect` (207, 214). Code holds: apps/api/src/services/audit.service.ts:46-55 takes
    `userId?: string | null` and inserts `input.userId ?? null`;
    packages/db/src/schema/system.ts:42 `userId: uuid().references(...)` has no `.notNull()`;
    packages/core/src/domain/analytics.ts:1-18 has no request-stage event, so a new name is
    needed; apps/api/src/routes/auth.ts:14 is the route rate limit (30 per 15 minutes, keyed by
    IP in middleware/rate-limit.ts:11-14) and auth.service.ts:49-54 the per-email window;
    `teacher_applied` today carries only `{ reapply, profileId }`
    (apps/api/src/services/profiles.service.ts:208-212); target 99-100 says the application
    forms are unchanged. Looser than the evidence: (1) Risk row 333 does not itself defer to the
    count; it says "Accepted: a session hand-over was rejected in the brief. The `/teach` screen
    says that Teach asks for a sign-in." The deferral is only implied by line 515. (2) The
    proposed event fires when a code is requested, so a visitor who lands on Teach's sign-in
    page and leaves without asking for a code is still invisible; the proposal separates "asked
    for a code but did not finish" from the rest, not the whole second-sign-in loss from
    placement loss.

### Z5. Dismissal hides the banner "for good", giving up later discovery of Teach to avoid reading as an advert - Severity: Major

-   **Reviewer Lens:** `egm-inventive-catalyst`
-   **Affected Scope:** learner-teach-banner.md: CUJ 4 (144-151), drafting decision 4 (186-187),
    "Dismissal" (230-234), Risks row "A dismissed visitor can't find Teach again" (334),
    Alternative H (434-442), Future Improvements (512-513). Also cited: 67-68, 149, 706-707,
    801-806, 815-817.
-   **Discrepancy Description:** The reviewer says "the banner must not read as an advert" is
    set against "someone who becomes interested later can find Teach", and the second is given
    up. The flag hides the banner on the device "for good". The stated mitigation is typing
    `/teach` by address, and the Profile link is deferred; that link would not serve signed-out
    visitors anyway, since Profile sits behind sign-in (docs/designs/learner-chinese.md lines
    39-41). The design's own premise is that the banner's value is in later growth (lines
    67-68), so devices that dismiss during the pilot are the ones lost when it matters. The
    sister design rejected a one-time prompt for this reason: "it is lost for good once
    dismissed" (learner-chinese.md lines 643-652). Secondary liabilities the reviewer lists: the
    collapsed line still takes space for learners who will never teach; one more visual state to
    translate and test in item 23 (lines 801-806) and the Maestro flow (lines 815-817); CUJ 4's
    "The banner is gone" (line 149) has to be reworded; a stored timestamp invites a re-show
    policy that someone must decide and test.
-   **Rationale & Recommendation:** Separate the dismissible prompt from the permanent entry
    point: make the close button collapse the card to a single quiet text link in the same slot
    instead of removing it, so Explore always holds an entry for signed-in and signed-out
    visitors with no new surface. Independently, store the dismissal time instead of the literal
    `dismissed` (lines 230-231, 706-707), so a later release can re-show the card without a
    storage migration.
-   **Check (confirmed):** learner-teach-banner.md:334 "The flag hides the banner on that device
    for good. | `/teach` stays open by address. A link from Profile is a future improvement";
    186-187 "the banner never shows there again"; 512-513 Profile link deferred; 67-68 "the
    banner's value is in later growth, not the pilot"; 441-442 "a banner that can't be closed
    reads as an advert"; 230-231 and 706-707 store the literal value `dismissed` under
    `elevate.teachBanner`; 149 "The banner is gone on that device, signed in or out"; 801-806
    and 815-817 are the tests named. docs/designs/learner-chinese.md:39-40 "The only language
    control is on the Profile tab ... which a signed-out visitor can't open", matched in code at
    apps/learner/src/app/(tabs)/_layout.tsx:21-24 (`Tabs.Protected guard={isSignedIn}` around
    `profile`). learner-chinese.md:643-652 is Alternative E, rejected because "a one-time prompt
    adds UI and state to reach the same people the Explore switcher already reaches, and it is
    lost for good once dismissed" (two reasons, of which this is one). Whether to adopt the
    collapse-to-link change is a design choice; the facts it rests on hold.

### Z6. The /teach screen restates Teach's application, review and payout process - Severity: Nit

-   **Reviewer Lens:** `egm-zoom-out`
-   **Affected Scope:** Target lines 240-249 (The `/teach` screen, what it says), 749-751 (plan
    item 19 content), 775-777 (plan item 21 screen keys). Line numbers are correct.
-   **Discrepancy Description:** The reviewer says the screen restates the application, review
    and payout process in six steps, plus who can apply and the fee, in about 15 keys in two
    languages. That process is owned by Teach, whose start page already explains both
    applications, translated (`apps/teach/src/routes/gate.tsx` lines 96-129). The doc drops the
    commission percentage because it "would drift" (lines 248-249); the six-step description
    drifts the same way. The screen's stated purpose (lines 333, 405-406) needs only a short
    pitch and the note that Teach is a separate site with its own sign-in.
-   **Rationale & Recommendation:** Cut the screen to a short pitch plus the note that Teach is
    a separate site with its own sign-in (implied by the reviewer; no explicit Ask was given).
-   **Check (confirmed):** - Six steps: learner-teach-banner.md:242-243 lists apply, application
    review, build a course, course review, learners pay, Stripe pays; :750 says "the six steps
    of how it works".
    -   Key count: :775-777 gives `title`, `intro`, `who.title`, `who.body`, `how.title`,
        `how.step1` to `how.step6`, `fee.title`, `fee.body`, `signInNote`, `action` = 15
        keys, in `learnerTeach.en.ts` and `learnerTeach.zh.ts` (:768).
    -   Teach's start page: `StartPage` is at apps/teach/src/routes/gate.tsx:96-130 (the
        function closes on line 130, one past the reviewer's range). It renders both
        applications from `start.person.*` and `start.company.*` keys, which exist in
        English (packages/i18n/src/messages/areas/teachShell.en.ts:46-51) and Chinese
        (teachShell.zh.ts:25 onwards).
    -   Drift reason: learner-teach-banner.md:248-249 ("a number written into the screen
        would drift"); `commissionBps` exists at packages/core/src/domain/money.ts:20.
    -   Stated purpose: :333 ("The `/teach` screen says that Teach asks for a sign-in") and
        :405-406 ("a short screen inside the app explains more before anyone leaves it").

    A limit on the overlap, which does not contradict the reviewer's wording: the start page
    covers only who each application is for (one sentence each, teachShell.en.ts:47 and :50). It
    does not describe the review steps, payment or the fee, so only the "who can teach" section
    of `/teach` duplicates existing translated text. That the six steps will drift, and that a
    short pitch is enough, are judgement.

### Z7. The banner is most visible when it matters least - Severity: Nit

-   **Reviewer Lens:** `egm-zoom-out`
-   **Affected Scope:** Target lines 65-68 (weak points), 184-185 (drafting decision 3), 332
    (risk row 'Few people see the banner'), 421-432 (Alternative G). Line numbers are correct.
-   **Discrepancy Description:** The reviewer says that with a pilot catalog of one page there
    is no "Load more", so the banner sits right after a few cards. As the catalog grows the
    banner moves further down, and line 68 says later growth is when its value arrives. The
    reviewer notes this is the author's decision and is stated openly, so no change is required.
    It is offered as one more reason not to build Finding 1's pipeline to measure a placement
    the doc already expects to underperform.
-   **Rationale & Recommendation:** No change required. Treat it as further support for cutting
    or deferring the arrival-count pipeline in Finding 1.
-   **Check (a judgement, with no factual claim to test):** The opinion (that the placement
    works against the stated goal, and that this weakens the case for measuring it) is a design
    view with nothing to test. Its factual parts hold:
    -   "Load more" renders only when there is another page:
        apps/learner/src/app/(tabs)/index.tsx:160 `{courses.hasNextPage ? (` ...
        `label="Load more"` (:164); the page size is 12 at
        apps/learner/src/lib/catalog.ts:39 (`limit: '12'`).
    -   learner-teach-banner.md:67-68 "the banner's value is in later growth, not the
        pilot"; :184 "below the last course and \"Load more\""; :332 "a visitor has to
        scroll past every loaded course ... Accepted, as decided".
    -   The doc does plan to use the count to judge the placement: :332 and :432 ("The
        arrival count shows whether the place works").

### Z8. The Technical Plan carries code-level detail that the Detailed Implementation Plan repeats - Severity: Nit

-   **Reviewer Lens:** `egm-zoom-out`
-   **Affected Scope:** Target lines 225, 230-234, 250-256, 287-289 and 296-298 (Technical
    Plan), duplicated at lines 545-547, 619-620, 694-698, 706-710, 716-722 and 753-756 (Detailed
    Implementation Plan). Line numbers are correct.
-   **Discrepancy Description:** The reviewer says the architecture section holds code-level
    detail that the implementation plan repeats (standard section 3, Premature Detail).
    Examples: the `profiles.some(...)` expression, storage key and value literals,
    `window.location.assign`, the `try`/`catch` placement, the zod expression. The two copies
    have to be kept in sync.
-   **Rationale & Recommendation:** The architecture section should state the rule and the
    interface, and leave the literals to the plan.
-   **Check (confirmed):** Each named duplicate is present in both halves of
    learner-teach-banner.md:
    -   `user?.profiles.some((p) => p.role === 'owner')` at :225 and again at :721.
    -   Key `elevate.teachBanner` with value `dismissed`, `localStorage` on web and
        AsyncStorage on native, at :230-231 and again at :707-708.
    -   `window.location.assign` and `Linking.openURL` at :251-252 and again at :755-756.
    -   `arrivalSourceSchema = z.enum(['learner'])` and `source:
        arrivalSourceSchema.optional()` at :287-289 and again at :545-547.
    -   `try`/`catch` around the `elevate.from` read at :296-297 and again at :619-620.
    -   `teachUrl()` reading `EXPO_PUBLIC_TEACH_URL` with the port 5173 fallback at :255-256
        and again at :694-698.

    That this is too much detail for the architecture section is the reviewer's judgement; the
    duplication itself is fact.

### Z9. The two halves of the document name the same things differently - Severity: Nit

-   **Reviewer Lens:** `egm-zoom-out`
-   **Affected Scope:** Target lines 269 and 505 against 581-599, 609, 628, 642, 651 and 826
    (catalog area name); lines 309-317 (Order of release, PR numbering). Line numbers are
    correct.
-   **Discrepancy Description:** The reviewer says the Technical Plan and Additional Resources
    call the new catalog area `auth`, while the plan creates `portalAuth` with `portalAuth.*`
    keys. Separately, "PR 1" to "PR 4" at lines 309-311 mean the Chinese design's pull requests,
    while "PR 2" at line 317 means this design's. A fresh reader cannot tell which without
    rereading.
-   **Rationale & Recommendation:** Use one area name throughout (the plan's `portalAuth`), and
    make each PR reference say which design it belongs to (implied by the reviewer; no explicit
    Ask was given).
-   **Check (confirmed):** - Area name: learner-teach-banner.md:269 "in a new `auth` area" and
    :505-506 "the new `auth` and `learnerTeach` areas"; against :581 `portalAuth.en.ts` and
    `portalAuth.zh.ts`, :585-599 `portalAuth.*` keys, :609 "Add the `portalAuth` area", :628 "a
    `portalAuth` key", :642 "a `portalAuth.verify` key", :651
    `blurbKey="portalAuth.blurb.teach"`, :826 "the i18n parity test for `portalAuth` and
    `learnerTeach`". No existing area is called `auth` or `portalAuth`
    (packages/i18n/src/messages/areas/ listing).
    -   PR numbering: :309-311 "This design needs its PR 1 ... PR 2 ... PR 3 ... and PR 4"
        under "After the Chinese design", matching the four PRs at
        docs/designs/learner-chinese.md:797-817; :317 "The banner ships in the next store
        build after PR 2" means this design's second PR (:316). The same unqualified use
        recurs at :344 ("a revert of PR 2") and :346 ("Reverting PR 1").
    -   One softening detail: line 309 does say "its PR 1", so the first reference is
        attributed to the Chinese design; the unqualified ones are :310-311, :317, :344 and
        :346. Whether a fresh reader is confused is judgement.

### Z10. `teachUrl()`'s development fallback (port 5173 on the page's host) is the behaviour in every build, so a missing Teach URL ships a dead link silently - Severity: Nit

-   **Reviewer Lens:** `egm-inventive-catalyst`
-   **Affected Scope:** learner-teach-banner.md: "`teachUrl()`" (255-256), Configuration
    (260-264), Rollout and rollback (344), item 14 (692-698), item 22 (783-792, the `deploy.yml`
    line at 789-790), Goal 6 (88-89). Also cited: 829.
-   **Discrepancy Description:** The reviewer says a development convenience is accepted as the
    behaviour for every build. A missing `EXPO_PUBLIC_TEACH_URL` falls back to port 5173 "on the
    dev host". In a deployed web build that is the learner hostname on port 5173, a dead link
    shipped silently if `vars.TEACH_URL` is empty in an environment. The existing `webBaseUrl()`
    differs: its web fallback, `window.location.origin`, is correct in production
    (apps/learner/src/lib/web-url.ts lines 5-11). The failure is passive, and on native it can
    only be fixed by a store build (line 344). Secondary liabilities the reviewer lists: silent
    hiding can mask a misconfiguration, so it needs a build-time warning or a deploy check; a
    nullable return spreads to every caller; one more branch for the rule that line 829 requires
    tests for; native still needs a store build either way.
-   **Rationale & Recommendation:** Outside `__DEV__`, treat a missing Teach URL as "feature
    off": `teachUrl()` returns null, `useTeachBanner` reports not visible, and `/teach` renders
    without its button. This also gives the web a configuration-level off switch for Goal 6, in
    place of a code revert.
-   **Check (confirmed):** learner-teach-banner.md:255-256 "Without it, it uses port 5173 on the
    dev host, as Support's `teachUrl()` does"; 696-698 "A missing value, or one pointing at
    `localhost` or `127.0.0.1`, uses port 5173 on the dev host: `window.location.hostname` on
    web", with no `__DEV__` condition; 263-264 and 789-790 take the web value from
    `vars.TEACH_URL`; 344 "a revert of PR 2 on the web, and a store build on native"; 88-89 Goal
    6; 829 the branch-coverage rule. apps/learner/src/lib/web-url.ts:5-11 is `webBaseUrl()`, and
    line 8 returns `window.location.origin` on web. apps/support/src/lib/urls.ts:5-12 is the
    mirrored helper: it falls back to
    `${window.location.protocol}//${window.location.hostname}:5173` whenever `VITE_TEACH_URL` is
    missing or local, in any build. .github/workflows/deploy.yml:150-159 passes `vars.*`
    straight into the build with no check that they are set. apps/learner/package.json has no
    `expo-updates`, so a native fix does need a new build. Context for weighing it:
    `vars.TEACH_URL` already feeds `VITE_TEACH_URL` (deploy.yml:153), and both `eas.json`
    profiles would hard-code the native value (target 787-788), so the empty-variable case is
    the web build only.

### Z11. The `from` allow-list is copied into both pre-paint scripts as well as the zod enum; the scripts could move the raw value and leave validation to `arrivalSource()` - Severity: Nit

-   **Reviewer Lens:** `egm-inventive-catalyst`
-   **Affected Scope:** learner-teach-banner.md: "Keeping the marker in Teach" (290-295), item 7
    (613-621), item 11 (655-664), item 13 (678-686; the reviewer's "line 683" is the
    no-web-ui-tests line, and the hand check of the scripts is at 685-686).
-   **Discrepancy Description:** The reviewer says "a classic script can't import" is accepted
    as meaning the pre-paint scripts must validate `from` themselves ("a valid `from` value",
    line 292; "When `?from` is `learner`", line 661). The allow-list then lives in three places:
    the zod enum and two hand-copied scripts. The scripts are untyped and untested (line 683),
    and their only sync guard is a comment (apps/teach/public/preferences-init.js line 8).
    Support also carries capture logic for a link nothing sends it. Secondary liabilities the
    reviewer lists: an unvalidated, capped, attacker-chosen string sits in `sessionStorage`
    until read; validation moves from entry to use, so every future reader must go through
    `arrivalSource()`; Support still carries the generic move-and-strip code.
-   **Rationale & Recommendation:** Keep in the scripts only what must happen before the router
    reads the URL: move the raw `from` value, length-capped, into `sessionStorage` and strip it
    from the address bar. `arrivalSource()` already validates against `arrivalSourceSchema` on
    read (lines 619-620), so it becomes the single allow-list and a new source is a one-line
    core change. The reviewer notes that moving the whole capture into typed web-ui code is not
    viable as designed: `RequireAuth` copies `location.search` into `redirect`
    (packages/web-ui/src/portal/auth.tsx line 136) and the router is created at module load, so
    the strip has to stay pre-paint.
-   **Check (confirmed):** learner-teach-banner.md:292 "write a valid `from` value to
    `sessionStorage` under `elevate.from`"; 661 "When `?from` is `learner`, write it to
    `sessionStorage`"; 657-658 both scripts modified and "kept identical"; 287 the zod enum;
    619-620 "It returns the value only when `arrivalSourceSchema` accepts it"; 683 "No web-ui
    tests, because `packages/web-ui` has no test runner" and 685-686 "The pages and scripts are
    checked by hand in CUJ 1" (so the untested claim is supported by 683-686, not 683 alone).
    apps/teach/public/preferences-init.js:8 "apps/support/public/preferences-init.js is the same
    file; change both together"; a diff of the two copies shows they differ only in that comment
    line, and a search of the repo finds no test or script that compares them (only comments in
    packages/core/src/contracts/preferences.ts:33 and
    packages/web-ui/src/preferences/PreferencesProvider.tsx:38, and the `<script>` tags in each
    index.html:7). packages/web-ui/package.json:12-14 has only a `typecheck` script.
    docs/designs/learner-chinese.md:331-332 gives the source of the premise: the scripts "copy
    the device rule, because a classic script can't import". Nothing in the design links to
    Support with `from` (the only link is `TEACH_URL/?lang=...&from=learner`, target 78 and
    250). packages/web-ui/src/portal/auth.tsx:136 is exactly
    ``to={`/sign-in?redirect=${encodeURIComponent(location.pathname + location.search)}`}``;
    apps/teach/src/router.tsx:24 and apps/support/src/router.tsx:16 are `export const router =
    createBrowserRouter([` at module scope.

### Z12. The "`/teach` stays open by address" mitigation does not exist on iOS and Android - Severity: Nit

-   **Reviewer Lens:** `egm-inventive-catalyst` (raised by the checker)
-   **Affected Scope:** learner-teach-banner.md: Risks row "A dismissed visitor can't find Teach
    again" (334), CUJ 4 (151), "The `/teach` screen" route note (238-239). Strengthens the
    reviewer's Finding 3.
-   **Discrepancy Description:** The reviewer's Finding 3 repeats the design's stated
    mitigation, "typing `/teach` by address", without noting that it applies only to the web.
    The design ships the banner on web, iOS and Android (lines 72-74). In the native app there
    is no address bar, and the only in-app way to `/teach` is the banner's own button
    (`router.push('/teach')`, line 730). After a dismissal on a phone, the risk row's mitigation
    is therefore not available at all, short of a hand-built `elevate://teach` deep link. Line
    151 ("`/teach` still opens when visited by its address") and line 239 ("owners who type its
    address") have the same web-only meaning.
-   **Rationale & Recommendation:** In Risks row 334 and CUJ 4, say that the by-address fallback
    is web-only and that a dismissed native install has no route to `/teach` until the Profile
    link (lines 512-513) or the change proposed in Finding 3 exists. Weigh Finding 3 with that
    in mind.
-   **Check (confirmed):** learner-teach-banner.md:334 "`/teach` stays open by address"; 151;
    238-239; 72-74 (web, iOS and Android); 730 (the banner button is the only caller of
    `router.push('/teach')` in the plan); items 14-24 (690-817) add no other link to `/teach`.
    apps/learner/app.json:8 sets `"scheme": "elevate"`, so a deep link is technically possible
    but is not something a visitor types.

## Inventive Catalyst report (as returned)

Mode: REVIEW, Stage 5 (Initial Strategic Review), Inventive Catalyst
Target: docs/designs/learner-teach-banner.md (lines 1-846)
Review status: complete. The persona file, the target and all six context files were read in full. No bundled standards were supplied beyond the persona.

Contradiction check: genuine false compromises exist. There are five findings (three Major, two Nit), all advisory. Line numbers refer to the target unless a path is given.

---

Finding 1

1. Severity: Major
2. Affected Scope: "The weak point of the idea" (lines 61-64), Non-Goals (93-96), Risks row "The second sign-in loses people" (333), Alternatives A and B (351-372), Future Improvements (515).
3. False Compromise: The design treats the choice as binary. Either a plain link, where a signed-in learner retypes their email in Teach and asks for a code, or a session hand-over that "needs a new one-time code exchange and its own security design". `?email=` is rejected because it puts the address in a URL. But the existing sign-in request is already a one-time exchange:
   - `POST /auth/magic-link` takes `audience` in the body from any client, unauthenticated (`apps/api/src/routes/auth.ts` lines 12-17).
   - It already emails a link that signs the browser in at `TEACH_URL/verify` (`apps/api/src/services/auth.service.ts` lines 45-84).
     The retype and the Teach-side request step are therefore not forced by the rejected hand-over.
4. Proposed Resolution (Inversion + Preliminary Action): For a signed-in learner, the `/teach` button calls the existing sign-in request itself with `{ email: user.email, audience: 'teach', locale, source: 'learner' }`, then shows "we emailed you a sign-in link for Teach". The emailed link already carries `&lang` and `&from` under this design (lines 300-301). Signed-out visitors keep the plain link. This needs no new endpoint or token type and puts no email in any URL. It also makes `source` originate in the learner app for that segment, so its attribution no longer depends on `sessionStorage` surviving in the Teach tab (lines 295, 338).
5. Secondary Liabilities:
   - The inbox round trip remains. It saves the retype and the request step, not the email.
   - `/teach` gains a second branch to translate, test and cover in CUJ 2 (lines 129-135).
   - A button press now sends an email. Accidental presses count against the per-email window shared with the learner's own sign-ins.
   - Someone already signed in to Teach gets an email they do not need, unless a secondary "Open Teach" link stays.
   - Mail apps' in-app browsers may hold the Teach session outside the default browser. This is the exposure Alternative M describes (lines 486-495), and it already applies to today's emailed links.
   - It reopens a decision the brief closed (lines 93-96), so it needs the author's call.

---

Finding 2

1. Severity: Major
2. Affected Scope: Goal 5 (86-87), drafting decision 5 (188-190), "Counting arrivals" (285-305), Risks rows (332-333), Alternatives G and I (431-432, 444-453), Future Improvements (514-516), Success measure (839-840).
3. False Compromise: Alternative I frames measurement as either a full client funnel behind "a new unauthenticated endpoint" or only `sign_in` plus `teacher_applied`. The design takes the second and then defers two accepted risks to that single count: placement (332, "The arrival count shows whether it works") and the second sign-in (333). A low count cannot say which caused it. Future Improvements 515 and 516 are each conditioned on a signal the design cannot produce. Separately, a visitor who lands already signed in to Teach produces no `sign_in` event, so neither they nor their application is counted, which Goal 5 promises.
4. Proposed Resolution (Intermediary on a request that already exists): Record an event inside `requestMagicLink` when `source` is set, with `{ audience, locale, source }` and `userId: null`. `trackEvent` accepts a null user (`apps/api/src/services/audit.service.ts` lines 46-61) and `analytics_events.user_id` is nullable (`packages/db/src/schema/system.ts` line 42). The count then splits "landed and asked for a code" from "completed sign-in", which isolates the second-sign-in loss from the placement loss with no new endpoint. Optionally, send `source: arrivalSource()` with the application request so `teacher_applied` is attributed directly, not by joining to any past sign-in (lines 303-305). That would also cover arrivals already signed in.
5. Secondary Liabilities:
   - A new name in `ANALYTICS_EVENTS`.
   - An unauthenticated request now writes analytics rows. They are bounded only by the route's existing rate limit and the per-email window.
   - A forged `from` inflates this count too, as with the risk at line 337.
   - The event has no user and must hold no email, so "Resend" presses cannot be de-duplicated. It counts requests, not people.
   - Banner views and presses inside the learner app stay unmeasured.
   - The optional application `source` adds a contract field in Teach's apply forms, which the design otherwise leaves unchanged (lines 99-100).

---

Finding 3

1. Severity: Major
2. Affected Scope: CUJ 4 (144-151), drafting decision 4 (186-187), "Dismissal" (230-234), Risks row "A dismissed visitor can't find Teach again" (334), Alternative H (434-442), Future Improvements (512-513).
3. False Compromise: "The banner must not read as an advert" is set against "someone who becomes interested later can find Teach", and the second is given up. The flag hides the banner on the device "for good". The stated mitigation is typing `/teach` by address, and the Profile link is deferred. That link would not serve signed-out visitors anyway, since Profile sits behind sign-in (`docs/designs/learner-chinese.md` lines 39-41). The design's own premise is that the banner's value is in later growth (lines 67-68), so devices that dismiss during the pilot are the ones lost when it matters. The sister design rejected a one-time prompt for this reason: "it is lost for good once dismissed" (learner-chinese.md lines 643-652).
4. Proposed Resolution (Extraction: separate the dismissible prompt from the permanent entry point): Make the close button collapse the card to a single quiet text link in the same slot instead of removing it. Explore then always holds an entry for signed-in and signed-out visitors, and no new surface is added. Independently (Dynamics), store the dismissal time instead of the literal `dismissed` (lines 230-231, 706-707), so a later release can re-show the card without a storage migration.
5. Secondary Liabilities:
   - The collapsed line still takes space for learners who will never teach.
   - There is one more visual state to translate and test, in item 23 (lines 801-806) and the Maestro flow (lines 815-817).
   - CUJ 4's "The banner is gone" (line 149) has to be reworded.
   - A stored timestamp invites a re-show policy that someone must decide and test.

---

Finding 4

1. Severity: Nit
2. Affected Scope: "`teachUrl()`" (255-256), Configuration (260-264), Rollout and rollback (344), item 14 (692-698), item 22 (789-790), Goal 6 (88-89).
3. False Compromise: A development convenience is accepted as the behaviour for every build. A missing `EXPO_PUBLIC_TEACH_URL` falls back to port 5173 "on the dev host". In a deployed web build that is the learner hostname on port 5173, a dead link shipped silently if `vars.TEACH_URL` is empty in an environment. The existing `webBaseUrl()` differs: its web fallback, `window.location.origin`, is correct in production (`apps/learner/src/lib/web-url.ts` lines 5-11). The failure is passive, and on native it can only be fixed by a store build (line 344).
4. Proposed Resolution (Blessing in Disguise: turn the misconfiguration signal into a safe state): Outside `__DEV__`, treat a missing Teach URL as "feature off". `teachUrl()` returns null, `useTeachBanner` reports not visible, and `/teach` renders without its button. This also gives the web a configuration-level off switch for Goal 6, in place of a code revert.
5. Secondary Liabilities:
   - Silent hiding can mask a misconfiguration, so it needs a build-time warning or a deploy check to stay visible.
   - A nullable return spreads to every caller.
   - It adds one more branch to the rule that line 829 requires tests for.
   - Native still needs a store build either way.

---

Finding 5

1. Severity: Nit
2. Affected Scope: "Keeping the marker in Teach" (290-295), item 7 (613-621), item 11 (655-664), item 13 (678-686).
3. False Compromise: "A classic script can't import" is accepted as meaning the pre-paint scripts must validate `from` themselves ("a valid `from` value", line 292; "When `?from` is `learner`", line 661). The allow-list then lives in three places: the zod enum and two hand-copied scripts. The scripts are untyped and untested (line 683), and their only sync guard is a comment (`apps/teach/public/preferences-init.js` line 8). Support also carries capture logic for a link nothing sends it.
4. Proposed Resolution (Extraction): Keep in the scripts only what must happen before the router reads the URL. That is moving the raw `from` value, length-capped, into `sessionStorage` and stripping it from the address bar. `arrivalSource()` already validates against `arrivalSourceSchema` on read (lines 619-620), so it becomes the single allow-list, and a new source is a one-line core change. Moving the whole capture into typed web-ui code is not viable as designed. `RequireAuth` copies `location.search` into `redirect` (`packages/web-ui/src/portal/auth.tsx` line 136) and the router is created at module load, so the strip has to stay pre-paint.
5. Secondary Liabilities:
   - An unvalidated, capped, attacker-chosen string sits in `sessionStorage` until read.
   - Validation moves from entry to use, so every future reader must go through `arrivalSource()`.
   - Support still carries the generic move-and-strip code.

---

Accepted trade-offs examined and judged real, not false compromises (no finding):

- Signed-out owners see the banner (line 335). This is an information bound, not a contradiction.
- Default browser over in-app browser on native (lines 486-495). The storage isolation is real.
- Translating Support's shared sign-in pages (lines 476-484).
- Stating no commission percentage (lines 248-249).
- `&from` on the emailed link in place of a `magic_links` column (lines 466-474). Coverage is equivalent for the paths the design counts.
- Placement below "Load more" (lines 421-432). It is visible at the same scroll depth as the "above Load more" option on the first page.
- Release after the Chinese design (lines 309-311). Goal 4 needs it.
