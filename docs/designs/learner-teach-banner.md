# Teach banner on Explore

-   **Author:** Sky Livingston
-   **Status:** The Teach PR is built (2026-11-18). The learner PR is not started.
-   **Date:** 2026-11-17

---

## Overview

Elevate's learner app (`apps/learner`: web, iOS and Android) has no way into Elevate Teach, the
web portal where teachers apply, build courses and get paid. This design adds a banner to
Explore, the learner app's home tab, that tells visitors they can teach on Elevate. It gives an
introduction, then a link into Teach in the language the visitor is using.

It does five things:

1.  **Shows a banner on Explore,** except to signed-in users the app knows to own a teaching
    profile.
2.  **Introduces teaching on Elevate** on a learner-app screen, `/teach`, before sending anyone
    away from the app.
3.  **Links to Teach's home page, `TEACH_URL/`,** with `?lang=<language>`. Teach's own router
    already sends a signed-out visitor to sign-in, a signed-in person with no profile to the
    start page (the personal and company applications), and a person with a profile to that
    profile's page.
4.  **Puts Teach's sign-in step and its personal application in the visitor's language.**
    "Teach's sign-in step" means, throughout this document: the sign-in page, the verify page,
    the sign-in code email, and the error sentences for the server's five sign-in error codes and its rate limit.
5.  **Adds a "Teach on Elevate" row to the Profile tab,** so a signed-in visitor who closed the
    banner can still find the screen.

No session is handed over: a learner signed in to the learner app signs in to Teach separately.

This is the second of four separate designs drawn from
[learner-main-page-improvements.md](learner-main-page-improvements.md), called "the brief" below.
It builds on the first, [learner-chinese.md](learner-chinese.md), called "the Chinese design"
below. That design is still Proposed. Once built, it resolves the visitor's language and adds
the `?lang` hand-off to Teach.

## The Problem

-   **Learners can't find Teach.** No screen in the learner app tells a visitor they can teach,
    and no link leads to Teach. Teach's address reaches only the teachers Elevate recruits and
    the members they invite by email. Support, the internal staff portal, is the only client
    app that reads Teach's address (`VITE_TEACH_URL`); the learner app has no such setting.
-   **Teachers are recruited by hand today.** The spec's pilot plan is to recruit three to five
    teachers directly ([`docs/spec.md`](../spec.md)). A practitioner who finds Elevate as a
    learner, and might teach, has no next step in the app.
-   **Teach's sign-in step and personal application are English.** A Chinese-reading visitor
    sent to Teach meets:
    -   an English sign-in page and verify page (`SignInPage` and `VerifyPage` in
        `@elevate/web-ui/portal`, including their error sentences);
    -   an English sign-in code email. Today no sign-in request carries a language. The Chinese
        design adds one for the learner app only.
    -   an English personal application form (`apps/teach/src/routes/apply.tsx`). The company
        application is already translated.

    Teach's start page and dashboard are already translated, so these are the English steps
    between arriving and applying. The emails Elevate sends about an application are English
    too, and stay English in this design.
-   **A press in the learner app records nothing.** Analytics events are sent only by the
    server. This design doesn't change that: first applications, which the API already
    records, are the only count (Goal 5).

**What it costs:** a learner who might teach has no path from the learner app to Teach.

**Known weaknesses:**

-   **A plain link means a second sign-in.** The learner app and Teach keep separate sessions on
    separate sites. A learner who is signed in to the learner app still has to ask for a code
    and type it into Teach. [Alternative A](#alternative-a-sign-the-learner-in-to-teach-automatically)
    gives the reason a hand-over was not taken.
-   **The banner sits at the very bottom of Explore.** Explore is a course list with "Load
    more", one column wide on a phone. A visitor has to scroll past every loaded course to see
    the banner, and nothing measures how many do.
-   **The audience at launch is unknown.** The pilot's teachers are recruited by hand, so the
    banner is aimed at later growth.

## Goals

1.  **A visitor who might teach can find Teach from Explore.** The banner is on Explore for
    signed-out visitors and for signed-in learners who own no teaching profile, on web, iOS and
    Android.
2.  **Owners don't see it.** A signed-in user whose loaded account shows that they own a
    teaching profile, whatever its status, doesn't see the banner or the Profile row. Members
    (managers and writers) still do. An owner whose account could not be loaded, or changed
    since the account was last loaded, may see it (see [Risks](#risks)).
3.  **From the `/teach` screen, one press reaches the right Teach page.** The link is
    `TEACH_URL/?lang=<language>`:
    -   signed out in Teach: Teach's sign-in page;
    -   signed in to Teach with no profile: the start page, with both applications;
    -   signed in to Teach with a profile: that profile's page, which is the portal if the
        profile is approved and set up, and otherwise its application or set-up steps.

    On native the link opens in the phone's default browser, because Teach is web-only.
4.  **Teach's sign-in step and personal application are in the visitor's language.** On a first
    visit to Teach from a learner app in Chinese, these are in Chinese: the sign-in page, the
    verify page, the code email, the sign-in error sentences, the start page and the personal
    application form. Three limits:
    -   a language already stored in Teach wins over `?lang`;
    -   other messages the server words stay English: field validation messages, Support's
        refusal of an account that is not staff, and a response with no message ("Something
        went wrong");
    -   the emails Elevate sends about an application stay English.
5.  **First applications can be counted.** Elevate can count first teacher applications from
    launch onwards and leave out the teachers it recruited by hand. The count includes invited
    members who apply on their own. Nothing counts banner views or presses, so the count can't
    show whether the banner's place on Explore works.
6.  **The banner can be removed without touching Teach.** Turning it off is a revert of the
    learner pull request on web and a store build on native. Installed native builds keep the
    banner until their users update. Nothing in Teach depends on it.

## Non-Goals

-   **Signing a learner in to Teach automatically** (a session hand-over). See
    [Alternative A](#alternative-a-sign-the-learner-in-to-teach-automatically).
-   **Pre-filling the Teach sign-in with the learner's email** (`?email=`). See
    [Alternative B](#alternative-b-pre-fill-teachs-sign-in-with-email).
-   **Translating Teach beyond its sign-in step and personal application.** The start page,
    dashboard and company application are already translated. The course builder, earnings and
    other Teach pages stay as they are, and so do the emails about an application.
-   **Translating every error the API can return.** This design maps only the five sign-in
    error codes and `rate_limited`. The wider rule is [Question 3](#open-questions).
-   **Changing how teachers apply.** The application's fields, Support's review and Stripe
    onboarding are unchanged.
-   **A Teach app on phones.** Teach stays web-only.
-   **Counting banner views and presses,** or attributing a sign-in to the banner. See
    [Alternative L](#alternative-l-attribute-arrivals-to-the-banner).
-   **A/B testing the banner's text or position.** There are no feature flags
    ([`docs/spec.md`](../spec.md) puts them out of scope).

## Open Questions

-   **Question 1 (the Chinese text), answered 2026-11-17:** as for the Chinese design's Question
    3, Claude drafts it, independent reviewers check it, and the author signs it off. Neither pull
    request merges before that sign-off (see [Order of release](#order-of-release)).
-   **Question 2 (the decision rule):** when is the count of first applications read, and what
    result removes the banner? The count can't test the banner's place, so moving it is a
    judgement.
-   **Question 3 (the wider error rule), answered 2026-11-17:** the Chinese design carries it,
    in its PR 3, for the learner app ([its error rule](learner-chinese.md#the-error-rule)): a
    `USER_ERROR_CODES` list, an `apiError` area, and distinct codes where one meant several
    things. That PR splits `link_used` ("That sign-in link was already used.") from
    `link_invalid`, so this design's Teach PR maps five sign-in codes, not four, and can take its
    messages from the shared `apiError` area. Teach and Support pages adopt the rule as they are
    translated.

The brief's Questions 6 (who doesn't see the banner) and 7 (the introduction) are answered in
[Decisions made while drafting](#decisions-made-while-drafting).

## Critical User Journeys (CUJs)

### CUJ 1: A signed-out visitor finds Teach and applies

-   **Given**: A first visit to the learner web app in a `zh-SG` browser. Nothing is stored for
    Elevate on the learner or Teach site.
-   **When**: They scroll to the end of Explore, press the banner, read `/teach`, press its
    button, sign in to Teach with the emailed code and open the personal application.
-   **Then**:
    -   The banner, `/teach`, Teach's sign-in page, the code email, the start page and the
        personal application form are in Chinese.
    -   Teach opens on its sign-in page, then lands on the start page after sign-in.
    -   The address bar shows no `lang`.
    -   Typing a wrong code shows the Chinese "That code is not right" sentence.
    -   The Teach site now stores Chinese as its language, because the banner's link carried
        `lang`.

### CUJ 2: A signed-in learner on a phone

-   **Given**: The native app on an `en-SG` phone, signed in, on no teaching profile.
-   **When**: They press the banner, then the `/teach` button.
-   **Then**:
    -   Teach opens in the phone's default browser, not inside the app.
    -   Teach asks them to sign in, because the app's session isn't shared.

### CUJ 3: An owner doesn't see the banner

-   **Given**: A signed-in user who owns an `approved` profile, and a second user who owns an
    `applied` one.
-   **When**: Each scrolls to the end of Explore, then opens Profile.
-   **Then**: Neither sees the banner or the Profile row. A writer on someone else's profile sees
    both.

### CUJ 4: Dismissing the banner

-   **Given**: A signed-in visitor who sees the banner.
-   **When**: They press its close button, then reload the app.
-   **Then**:
    -   The banner is hidden on that device, signed in or out, for 30 days or until the
        device's storage is cleared.
    -   It still shows on their other devices.
    -   The "Teach on Elevate" row in Profile still opens `/teach`.
    -   After 30 days, the banner shows again.

### CUJ 5: Searching

-   **Given**: A visitor on Explore.
-   **When**: They type a search or pick a category.
-   **Then**: The banner is hidden, and comes back when the filters are cleared.

## Technical Plan (Architecture)

### Terms

-   **Explore:** the learner app's home tab (`apps/learner/src/app/(tabs)/index.tsx`). It shows
    a course list with "Load more".
-   **Profile:** the learner app's Profile tab, open only to signed-in users.
-   **Teach:** the teacher portal (`apps/teach`), served at `TEACH_URL`:
    `https://teach.elevatelearn.app` in production and `https://teach.staging.elevatelearn.app`
    on staging (`infra/terraform/modules/environment/main.tf`).
-   **Support:** the internal staff portal (`apps/support`). It shares its sign-in and verify
    pages with Teach, so translating them changes Support too.
-   **A teaching profile** is what a teacher sells from. Applying creates a profile that the
    applicant owns. Its status is `applied`, `approved` or `rejected`.
-   **An owner:** a user whose `AuthUser.profiles` holds a profile with `role: 'owner'`.
    Managers and writers are members. Staff roles (`AuthUser.roles`) are separate and play no
    part here.
-   **The sign-in email:** one sign-in request sends one email that holds both a link and a
    six-digit code. The visitor types the code on the sign-in page, or opens the link, which
    lands on the verify page. The request's `audience` field says which app it is for:
    `learner`, `teach` or `support`.
-   **`RequireAuth` and `HomeRedirect`:** Teach's route guard, which sends a signed-out visitor
    to sign-in, and its `/` route, which sends a signed-in one to the right page.
-   **The pre-paint script:** each portal's `public/preferences-init.js`, loaded from
    `index.html` before the app starts. It sets the theme and `<html lang>` before first paint.
-   **The message catalog:** `@elevate/i18n`. An **area** is one named slice of it, kept as two
    files, `areas/<area>.en.ts` and `areas/<area>.zh.ts`.

### Decisions made while drafting

1.  **Hidden from owners only** (the brief's Question 6). Managers, writers, staff and
    signed-out visitors see the banner.
2.  **The introduction is a learner-app screen** (the brief's Question 7). The banner opens
    `/teach`, and only that screen's button leaves the app.

### Data flow

```text
 learner app                                    Teach (TEACH_URL)
 -----------                                    -----------------
 Explore: owner?           -- yes -->  no banner
          dismissed < 30 days ago? -- yes -->  no banner
          searching, or list not loaded? -- yes -->  no banner
        | no
        v
 banner --press--> /teach screen --press--> TEACH_URL/?lang=<resolved>
 Profile row (not an owner) --press--> /teach screen
                                                     |
                     pre-paint script (Chinese design): store lang if nothing
                     is stored, then remove it from the address bar
                                                     |
                     RequireAuth: signed out -> /sign-in ; signed in -> HomeRedirect
                                                     |
       sign-in request { email, audience: teach, locale }
            -> code email in locale; emailed link carries &lang
       verify { code | token }     (unchanged: no locale, no account write)
                                                     |
                     HomeRedirect: no profile -> /start (applications)
                                   profile -> that profile's page
```

### The banner

-   **Where:** a new `TeachBanner` component. Explore renders it once, after the course list and
    "Load more". It shows when the first page of courses has loaded and no filter is active,
    including when the course list is empty. It doesn't show while loading or after a load
    error.
-   **When it shows:** a `useTeachBanner` hook decides. It hides the banner when any of these
    holds:
    -   the session is still loading. The root layout already shows nothing until the session
        has loaded, so this is a guard;
    -   the loaded user owns a profile;
    -   the dismissal time hasn't been read yet, or is less than 30 days old;
    -   a search or category filter is active, or the first page hasn't loaded.
-   **What it holds:** a headline, one sentence, a "Find out more" button that opens `/teach`,
    and a close button with an accessibility label.
-   **Dismissal:** the close button stores the time on the device. The banner stays hidden there
    for 30 days, then shows again. Clearing the device's storage also brings it back. The time
    isn't a user preference, so it gets no row in the Preferences card on the Profile tab. A
    failed write is
    ignored: the banner is hidden for the rest of that run only.
-   **Text:** the banner, the `/teach` screen and the Profile row take their text from a new
    `learnerTeach` area.

### The `/teach` screen

-   **The route:** `apps/learner/src/app/teach.tsx`, outside the tabs, like `course/[slug]`. It
    is open to everyone, including owners who type its address on web.
-   **What it says:** three titled sections and a closing note:
    -   who can teach: individuals, and registered companies;
    -   how it works, in six steps: apply, Elevate reviews the application, connect a Stripe
        account, build a course, Elevate reviews the course, learners pay and Stripe pays the
        teacher. A company has one more check, on the Stripe account's legal name, which step 3
        mentions;
    -   the fee: Elevate takes a commission on each sale, and Teach shows it for a course's
        price before the course is submitted for review;
    -   the note: Teach is a separate site with its own sign-in.

    It states no percentage. The rate is a server default (`DEFAULT_COMMISSION_BPS` in
    `apps/api/src/env.ts`) copied onto each profile, where it can be changed, so a number
    written into the screen would drift. The six steps restate a process Teach owns, so they
    can drift too; see [Alternative R](#alternative-r-a-shorter-teach-screen).
-   **The button:** it opens `teachUrl('/')` with `?lang=<resolved language>`.
    -   **Web:** in the same tab.
    -   **Native:** in the phone's default browser, where a Teach sign-in stays for the
        teacher's next visit. The in-app browser that checkout uses may not keep it; see
        [Alternative P](#alternative-p-open-teach-in-the-in-app-browser-on-native).
-   **`teachUrl()`:** a new helper beside `webBaseUrl()`. It reads a new
    `EXPO_PUBLIC_TEACH_URL`. When the value is missing or points at this machine (`localhost`),
    it points at Teach's development port on the development host.

### The Profile row

-   **What it is:** a "Teach on Elevate" card in the Profile tab, with one sentence and a button
    that opens `/teach`. It uses the same owner rule as the banner, and ignores dismissal.
-   **Who it reaches:** signed-in visitors only, because Profile is behind sign-in. A signed-out
    visitor who closed the banner gets it back after 30 days.

### Configuration

-   **`EXPO_PUBLIC_TEACH_URL`:** it is added to:
    -   the `preview` and `production` build profiles in `eas.json`
        (`https://teach.staging.elevatelearn.app` and `https://teach.elevatelearn.app`). Staging
        is reachable only over Tailscale, so a `preview` build's Teach link needs a device
        signed in to Elevate's Tailscale network.
    -   the learner web build step in `.github/workflows/deploy.yml`, from `vars.TEACH_URL`,
        which already feeds Support's build.
-   **A missing address isn't checked:** a web build made with an empty variable links to the
    development port, with no warning. This is an accepted cost (see [Risks](#risks)).

### Teach's sign-in step in the visitor's language

-   **The text:** `SignInPage` and `VerifyPage` in `@elevate/web-ui/portal` move every sentence
    to a new `portalAuth` area: headings, labels, buttons and the invalid-email sentence. Each
    portal's `blurb` becomes a message key.
-   **Errors:** a failed request is worded in one of two ways.
    -   **The sign-in error codes are translated:** when the server answers with the code
        `link_invalid`, `link_used`, `link_expired`, `code_invalid`, `code_locked` or
        `rate_limited`, the page shows that code's `apiError.<code>` message, the one the
        learner app shows ([Question 3](#open-questions)). The server's own English sentence is
        not shown. The server defines all five sign-in codes, but today it can't answer
        `code_locked`: the fifth wrong code uses the link up, so the next try answers
        `link_invalid` when the address has no other unused link. The mapping keeps
        `code_locked` in case the server starts sending it. `rate_limited` is added because its
        message already exists and the code-request step can hit it.
    -   **Everything else goes through `useErrorMessage()`:** this is the rule in
        [ADR 008](../adr/008-theming-preferences-i18n.md). That hook shows the server's message
        unchanged, and words only two sentences itself: the request never reached the server,
        and a failure that isn't an API response. So "This account does not have access to
        Elevate Support" and a response with no message ("Something went wrong") stay English.
        Mapping `forbidden` would replace Support's sentence with the generic "You do not have
        access to this.".

    The mapping is the first use of a rule the author wants more widely
    ([Question 3](#open-questions)). ADR 008 and AGENTS.md gain the rule in its general form: a
    page may map an error code it knows to a message, and the server's sentence is the
    fallback.
-   **A language picker on the sign-in page:** the page gets the existing `PreferencesButton`,
    as Teach's invitation page has. A visitor whose browser language is wrong for them can
    switch before asking for a code.
-   **Both portals:** Support's sign-in uses the same two pages, so it gets all of this.
-   **The code email:** `SignInPage` sends the page's resolved language as `locale` with the
    sign-in request, in Teach and Support. Under the Chinese design, the code email is then in
    that language and the emailed link carries `&lang`. So the code email is in the language of
    the page that asked for it.
-   **The emailed link stores a language:** under the Chinese design, a portal's pre-paint
    script stores a `?lang` value when the browser has no language stored, or has "Follow
    device" stored. So opening the emailed link stores the language of the page that asked for
    the code, and turns "Follow device" into that fixed language at every link sign-in. This is
    accepted (see [Risks](#risks)). The Chinese design assumed `?lang` reaches Teach only once,
    from the banner; the Teach PR amends that text.
-   **Verify is unchanged:** Teach's and Support's verify requests carry no language, so signing
    in to a portal never writes the account's language, which the learner emails read.

### The personal application in the visitor's language

-   **The form:** `apps/teach/src/routes/apply.tsx` moves every sentence to a new
    `personalApply` area, the way the company application (`apply-corporate.tsx`,
    `companyApply`) already does.
-   **What stays English:** the emails Elevate sends when an application is received, approved
    or turned down. They are built with `simpleEmail` with no language, and the Chinese design
    translates learner emails only. Field validation messages come from the server and stay
    English too.

### Measurement

-   **The count:** first applications are the `teacher_applied` events with `reapply: false`,
    which the API already records for personal and company applications
    (`apps/api/src/services/profiles.service.ts`). Elevate leaves out the teachers it recruited
    by hand. This assumes its staff know which accounts those are.
-   **What it can and can't show:** apart from the hand-recruited teachers and the members they
    invite, nobody is told Teach's address, so most other first applications are expected to
    come through the learner app. Three limits:
    -   the count can't tell an invited member who applied on their own from someone who
        pressed the banner;
    -   it stops separating the banner from other routes once a second public way into Teach
        exists;
    -   it never shows how many visitors saw or pressed the banner.
-   **Nothing is built for it:** there is no new event, field or column.

### Order of release

-   **What this design relies on:** the Chinese design, which is Proposed and not built. This
    design uses:
    -   **its resolved language:** a stored choice; then, in the learner app, the signed-in
        account's chosen language; then `?lang`; then the browser's or phone's first language
        (Chinese for any `zh` tag, otherwise English). Both the learner app and
        `@elevate/web-ui` expose it (the Chinese design's PR 1). The phone's language comes with
        its PR 3.
    -   **`locale` on the sign-in request:** it sets the code email's language and adds
        `&lang` to the emailed link (its PR 1 and PR 2).
    -   **the `?lang` hand-off in Teach:** the pre-paint script stores a `?lang` value when no
        language is stored or "Follow device" is, and removes it from the address bar (its
        PR 4).
    -   **the learner catalog areas and test helpers:** these come with its PR 3.
-   **Two pull requests:** they are named, to avoid confusion with the Chinese design's four.
    1.  **The Teach PR:** the translated sign-in and verify pages, the mapped error codes, the
        picker, `locale` on the sign-in request, and the translated personal application. It
        changes no file under `apps/learner` and no API code. It needs the Chinese design's
        PR 1, PR 2 and PR 4.
    2.  **The learner PR:** the banner, `/teach`, the Profile row, `teachUrl()` and the
        configuration. It needs the Chinese design's PR 3 and the Teach PR.
-   **The Chinese text gates both:** a Chinese area file can't be left empty. It is checked
    against its English file at compile time, and `packages/i18n/test/catalog.test.ts` fails on
    a missing or empty message. So neither pull request can pass its checks until its Chinese is
    written, and neither merges until the author signs it off ([Question 1](#open-questions)).
-   **Native:** the banner ships in the next store build after the learner PR. Web ships on
    deploy.

### Records and rules

-   **ADR 010:** added by the Chinese design. It gains a line: Teach and Support send `locale`
    on the sign-in request, and nothing at verify.
-   **ADR 008:** it gains the general rule that a page may map an error code it knows to a
    message, first used for the sign-in codes. Its "Translated today" list gains the sign-in
    and verify pages and the personal application, and its list of pages that carry
    `PreferencesButton` gains the sign-in page.
-   **AGENTS.md:** "Translated pages" adds the same pages and the same rule. The `/teach` screen
    and the Profile row will be covered by the Chinese design's whole-learner-app rule once its
    PR 3 lands.
-   **The Chinese design:** it says "Teach and Support send none, so their links carry no
    `lang`", and that `?lang` reaches Teach once, from the banner. The Teach PR replaces the
    first, extends the second, and amends its CUJ 6 and its risk row on a crafted `?lang` link.

## Risks & Mitigations

### Risks

| Risk                                                 | What goes wrong                                                                                                                                                                                                                                      | Mitigation or accepted cost                                                                                                                                                                                                        |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Few people see the banner**                        | It sits after the whole list, so a visitor has to scroll past every loaded course.                                                                                                                                                                   | Accepted. Nothing counts views or presses, so no number shows whether the place works. Moving the banner is a change to one file.                                                                                                  |
| **The second sign-in loses people**                  | A signed-in learner has to ask for a code again in Teach.                                                                                                                                                                                            | Accepted; see [Alternative A](#alternative-a-sign-the-learner-in-to-teach-automatically). The `/teach` screen says that Teach asks for a sign-in.                                                                                  |
| **A visitor who closed the banner can't find Teach** | The banner is hidden on that device.                                                                                                                                                                                                                 | It returns after 30 days. A signed-in visitor has the Profile row. A signed-out visitor on a phone has no way to `/teach` until the 30 days pass; on web the address still opens it.                                               |
| **An owner sees the banner**                         | The app can't tell who a signed-out visitor is. An owner whose account failed to load at launch, or who applied in Teach since the account was loaded, also sees it. The account is loaded again on a cold start, a new sign-in or a Profile save.   | Accepted: pressing through takes an owner to their own profile's page in Teach. A test covers "signed in with no user".                                                                                                            |
| **The Chinese text is wrong or missing**             | The first words a teacher reads are badly translated, or a pull request can't pass its checks.                                                                                                                                                       | Sign-off by the reviewer in [Question 1](#open-questions) is a merge condition for both pull requests.                                                                                                                             |
| **The Chinese design changes or slips**              | This design is built on four of its behaviours.                                                                                                                                                                                                      | They are listed in [Order of release](#order-of-release). If one changes, this design is revised before its pull requests start.                                                                                                   |
| **The error mapping drifts from the server**         | The server renames or adds a sign-in error code, and the page shows English again.                                                                                                                                                                   | API tests pin the codes the server can answer today. An unknown code falls back to the server's sentence, so nothing breaks.                                                                                                       |
| **A locked-out visitor reads the wrong sentence**    | After five wrong codes the server answers `link_invalid`, not `code_locked`, when the address has no other unused link. The visitor reads "not valid" where "too many incorrect codes" would be clearer.                                             | Accepted. This is today's behaviour in English too, and fixing it is an API change outside this design.                                                                                                                            |
| **Opening the emailed link stores a language**       | Each sign-in through the emailed link stores the language of the page that asked for the code, when the browser has no language stored or has "Follow device" stored. A visitor who chose "Follow device" on purpose loses it at every link sign-in. | Accepted by the author. The visitor can pick "Follow device" again, and signing in with the typed code stores nothing.                                                                                                             |
| **Support's sign-in turns Chinese**                  | A Support agent with a Chinese browser gets a Chinese sign-in page and code email.                                                                                                                                                                   | The picker on the sign-in page switches the language before a code is requested. The Support check in item 11 covers it.                                                                                                           |
| **The application emails are English**               | A Chinese applicant gets English emails when the application is received and decided.                                                                                                                                                                | Accepted. The form itself is translated.                                                                                                                                                                                           |
| **Teach on a phone is untested**                     | CUJ 2 sends phone visitors into Teach in a mobile browser.                                                                                                                                                                                           | In code, the sign-in page and the start page are single-column at narrow widths. Nobody has tested them on a phone, and the application form wasn't checked at phone width. The Teach PR's hand checks include a phone-width pass. |
| **A web build with no Teach address**                | The `/teach` button links to the development port on the learner site, with no warning.                                                                                                                                                              | Accepted. The same `TEACH_URL` variable already feeds Support's build, whose links to Teach would be wrong in the same way, and it is set once for each environment. Native addresses are fixed in `eas.json`.                     |

### Rollout and rollback

-   **No migration and no API change.** The Teach PR sends a request field that the Chinese
    design's PR 1 adds.
-   **Turning the banner off** is a revert of the learner PR on the web, and a store build on
    native. Installed native builds keep the banner until their users update. Nothing in Teach
    depends on it.
-   **Reverting the Teach PR** puts Teach's and Support's sign-in step and the personal
    application back in English. A browser tab that still holds the reverted pages keeps
    sending `locale`, which the server still accepts.

## Alternatives Considered

### Alternative A: Sign the learner in to Teach automatically

-   **Pros**:
    -   No second sign-in: a signed-in learner lands straight on the start page.
-   **Cons**:
    -   The two sites keep separate sessions in their own storage. A hand-over needs a new
        one-time code, an exchange endpoint, expiry and replay rules.
    -   It serves only learners who are already signed in.
-   **Reason for Rejection**: Rejected by author in the brief, in favour of a plain link
    ([Alternatives weighed](learner-main-page-improvements.md#alternatives-weighed)): it needs a
    new one-time code exchange and its own security design. This design adds its own reason:
    nothing shows how many learners the second sign-in loses, so the work has no measured
    benefit yet.

### Alternative B: Pre-fill Teach's sign-in with `?email=`

-   **Pros**:
    -   The visitor doesn't retype their address.
-   **Cons**:
    -   The address ends up in server and CDN logs, browser history and referrer headers.
-   **Reason for Rejection**: Rejected in the brief's review ("Rejected in review" under
    [Alternatives weighed](learner-main-page-improvements.md#alternatives-weighed)): it puts an
    email address in logs and referrer headers to save one typed field.

### Alternative C: Email a signed-in learner a Teach sign-in link

-   **Pros**:
    -   The `/teach` button calls the existing sign-in request with the learner's address and
        `audience: 'teach'`. No new endpoint, no email in a URL, and nothing to retype.
-   **Cons**:
    -   A press now sends an email, and accidental presses count against the same limit as the
        learner's own sign-ins.
    -   Someone already signed in to Teach gets an email they don't need.
    -   The trip to the inbox stays.
-   **Reason for Rejection**: It replaces typing an address with an email nobody asked for, and
    reopens the brief's decision that the banner is a plain link.

### Alternative D: Hide the banner from anyone on a profile

-   **Pros**:
    -   One check: the user has any profile.
    -   Members, who already use Teach, aren't shown an invitation to it.
-   **Cons**:
    -   A writer who would like a profile of their own never gets the prompt.
-   **Reason for Rejection**: A member who sees the banner loses a moment of attention, while a
    writer who never sees it has no prompt to start their own profile.

### Alternative E: Hide it from anyone on an approved or applied profile

-   **Pros**:
    -   Rejected applicants still see it, since Teach lets them resubmit.
-   **Cons**:
    -   A second rule on status, with its own tests.
    -   A rejected applicant is shown an invitation to the portal that turned them down.
    -   The banner is still hidden from members.
-   **Reason for Rejection**: It adds a status rule for rejected applicants, who already know
    where Teach is.

### Alternative F: Put the whole introduction in the banner

-   **Pros**:
    -   No new screen: one press leads straight to Teach.
-   **Cons**:
    -   A banner has room for a headline and a sentence, not for who can apply, the steps and
        the fee.
    -   The first press already leaves the app.
-   **Reason for Rejection**: A screen inside the app can say who can apply, how review works
    and that there is a fee before anyone leaves. On native, leaving opens a browser.

### Alternative G: A public introduction page in Teach

-   **Pros**:
    -   One page serves every link, including links teachers share.
    -   It sits on the site where the visitor goes next.
-   **Cons**:
    -   Every Teach page except sign-in, verify and invitations sits behind `RequireAuth`; this
        adds a new signed-out route and its own translation.
    -   Native visitors leave the app before reading it.
-   **Reason for Rejection**: No other link needs the page yet, and it moves the introduction
    out of the app the visitor is in.

### Alternative H: Put the banner above "Load more", or inside the grid

-   **Pros**:
    -   **Above "Load more":** seen by anyone who scrolls the first page.
    -   **Inside the grid,** after two rows: seen soonest.
-   **Cons**:
    -   **Above "Load more":** it moves down as pages load and ends up mid-list.
    -   **Inside the grid:** it sits between courses, and `Grid` has no full-width item today.
-   **Reason for Rejection**: Explore is for finding courses, so the banner doesn't sit inside
    the list.

### Alternative I: No dismiss button

-   **Pros**:
    -   Nothing to store or test, and no question of how a visitor finds Teach again.
-   **Cons**:
    -   A learner who will never teach sees the banner at the end of Explore on every visit,
        with no way to close it.
-   **Reason for Rejection**: Explore is the screen learners come back to. Closing the banner
    costs one stored time and its tests.

### Alternative J: Dismissal that never expires, or that collapses to a text link

-   **Pros**:
    -   **Never expires:** a visitor who closed the banner never sees it again.
    -   **Collapses to a link:** Explore always holds an entry to `/teach`, on every platform.
-   **Cons**:
    -   **Never expires:** on a phone, one press removes the only way to `/teach` for a
        signed-out visitor, because typing the address works only on web.
    -   **Collapses to a link:** a third visual state, and the line still takes space for
        learners who will never teach.
-   **Reason for Rejection**: A 30-day expiry and the Profile row give every visitor a way back
    without a permanent line on Explore.

### Alternative K: Hide the banner when the account can't be loaded, or refresh it on return

-   **Pros**:
    -   An offline owner doesn't see the banner. With a refresh when the app returns to the
        foreground, a new owner stops seeing it sooner.
-   **Cons**:
    -   A signed-in learner who is offline loses the banner too.
    -   The refresh needs an app-state listener in the learner session, which nothing uses
        today.
-   **Reason for Rejection**: An owner who presses the banner lands on their own profile's page.
    That outcome doesn't justify a new listener.

### Alternative L: Attribute arrivals to the banner

-   **Pros**:
    -   **A link marker** (`from=learner`, sent as `source` with the sign-in requests and
        recorded on the `sign_in` event) counts sign-ins that started from the banner.
    -   **A request-time event,** and `source` on the application request, separate "asked for a
        code" from "signed in", and count arrivals who were already signed in to Teach.
    -   **Client events** for views, presses and dismissals give the whole funnel.
-   **Cons**:
    -   **The marker** passes through the link, both pre-paint scripts, session storage, three
        requests and the emailed link. It misses visitors already signed in to Teach, anyone can
        forge it, and it still has no count of views to compare with.
    -   **Storing the marker on the sign-in row** removes two of those steps and adds a
        migration, with the same gaps.
    -   **A request-time event** lets a signed-out request write analytics rows, and `source` on
        the application adds a field to forms this design otherwise leaves alone.
    -   **Client events** need an unauthenticated endpoint with rate limiting and abuse
        handling.
-   **Reason for Rejection**: The marker and its variants cost several moving parts and still
    can't say whether the banner's place works. While Teach has no other public entry, counting
    first applications gives a usable count with nothing built, and an optional request field
    can be added later without a migration. Client events are deferred, because they need a
    public endpoint (see [Future Improvements](#future-improvements)).

### Alternative M: Leave the server's sign-in errors in English

-   **Pros**:
    -   No new pattern: `useErrorMessage()` already shows the server's sentence, as ADR 008 sets
        out.
-   **Cons**:
    -   A Chinese visitor reads English for a wrong code and an expired or used link, on the
        page this design translates.
-   **Reason for Rejection**: The brief's decision 8 kept API error messages English. The
    author reversed it while reviewing this design ([Question 3](#open-questions)), and these
    codes are the first use. A Chinese visitor would otherwise read English for a wrong code and
    an expired or used link, on a page this design translates.

### Alternative N: Leave the personal application in English

-   **Pros**:
    -   The Teach PR stays at the sign-in step, as the brief's non-goal has it.
    -   A sentence on `/teach` could warn that the application is in English.
-   **Cons**:
    -   A Chinese reader passes a Chinese banner, screen, sign-in and start page, then meets an
        English form at the step where they apply.
    -   The warning sentence still leaves the form English, and goes stale once the form is
        translated.
-   **Reason for Rejection**: The application is the step the whole path leads to. The cost is
    one more form in the catalog and its Chinese text.

### Alternative O: Translate only Teach's sign-in, and leave Support's English

-   **Pros**:
    -   Support's sign-in and its code email behave exactly as today.
-   **Cons**:
    -   The two portals share `SignInPage` and `VerifyPage`. Keeping Support English means a
        prop that switches translation off, or two copies of each page.
-   **Reason for Rejection**: Both ways of keeping Support English add code, and the picker on
    the sign-in page lets a Support agent choose English.

### Alternative P: Open Teach in the in-app browser on native

-   **Pros**:
    -   The same `WebBrowser.openBrowserAsync` the checkout hand-off uses, and the visitor stays
        inside the app.
-   **Cons**:
    -   On iOS, the in-app browser does not share cookies with Safari
        ([Expo WebBrowser](https://docs.expo.dev/versions/v58.0.0/sdk/webbrowser/)). Teach
        keeps its session as a token in the site's local storage, not a cookie. The author
        expects the in-app browser to keep that apart from Safari's too, but neither that page
        nor a test on a device confirms it.
-   **Reason for Rejection**: Teach is a portal people return to. The default browser keeps the
    sign-in whichever way the in-app browser behaves, so it is the safe choice. CUJ 2's
    walkthrough checks that path only.

### Alternative Q: Fail the deploy, or switch the feature off, when the Teach address is missing

-   **Pros**:
    -   A web build can't ship a link to the development port.
-   **Cons**:
    -   **Fail the deploy:** one more check in the workflow, for a value that is set once for
        each environment.
    -   **Feature off:** `teachUrl()` can return nothing, so every caller gains a branch and a
        test, and a wrong configuration hides the banner without a sign.
-   **Reason for Rejection**: The variable is already set in both environments for Support's
    build, and nothing has needed a check on it so far. The dead link on an empty value is an
    accepted cost.

### Alternative R: A shorter `/teach` screen

-   **Pros**:
    -   **No six steps,** or **a pitch only:** less text to translate, and less that can drift
        when Teach's process changes.
-   **Cons**:
    -   Teach's sign-in page says in one line that courses are reviewed and paid through
        Stripe, and its start page says who each application is for. The review of an
        application and the fee would be stated nowhere before sign-in.
-   **Reason for Rejection**: The screen is the only place a visitor reads how teaching on
    Elevate works before leaving the app. The accepted cost is that its six steps have to be
    kept in step with Teach.

### Alternative S: No language picker on the sign-in page

-   **Pros**:
    -   No new control on a page two portals share.
-   **Cons**:
    -   A visitor whose browser language is wrong for them could change it only after signing
        in, and the first code email would follow the browser.
    -   Without the picker, the Support risk has no mitigation, and the document can only state
        the rule "the code email follows the page".
-   **Reason for Rejection**: Teach's invitation page already carries the same button for
    signed-out visitors, so the picker adds no new component.

---

## Additional Resources

-   [learner-main-page-improvements.md](learner-main-page-improvements.md): the brief and its
    review, which this design comes from.
-   [learner-chinese.md](learner-chinese.md): the resolved language, the `locale` request field
    and the Teach `?lang` hand-off this design builds on.
-   [ADR 008](../adr/008-theming-preferences-i18n.md): the catalog patterns the new
    `portalAuth`, `personalApply` and `learnerTeach` areas follow.
-   [Teach's router](../../apps/teach/src/router.tsx) and
    [`HomeRedirect`](../../apps/teach/src/routes/gate.tsx): how `TEACH_URL/` sorts visitors.

## Future Improvements

-   **Translated application emails,** so a Chinese applicant hears back in Chinese.
-   **Counting views and presses,** if the count of first applications proves too coarse.
-   **A session hand-over** to Teach.
-   **A different place for the banner.** Nothing measures the place, so moving it is a
    judgement ([Question 2](#open-questions)).

---

## Detailed Implementation Plan

The work lands in two pull requests, after the Chinese design's. Each must pass `npm run lint`
and `npx turbo run typecheck test` on its own.

1.  **The Teach PR:** it translates the shared sign-in and verify pages and Teach's personal
    application, maps the sign-in error codes, adds the language picker to the sign-in
    page, and sends `locale` with the sign-in request. No file under `apps/learner` changes, and
    no API code changes.
2.  **The learner PR:** it adds the banner, the `/teach` screen, the Profile row, `teachUrl()`
    and `EXPO_PUBLIC_TEACH_URL`.

**Release order:** the Teach PR deploys before the learner PR. The learner PR's native build
ships in the next store release after that.

**The Chinese text:** every `.zh.ts` file below needs its text before its pull request can pass
`npx turbo run typecheck test` (see [Order of release](#order-of-release)). Once
[Question 1](#open-questions) is answered, the writer named there writes it, and the reviewer's
sign-off is a merge condition.

### Target Files to Create/Modify

#### The Teach PR

##### 1. Sign-in messages

-   **Files**: `packages/i18n/src/messages/areas/portalAuth.en.ts` and `portalAuth.zh.ts`
    (Create).
-   **Type / Scope**: message catalog.
-   **Proposed Changes**: these keys, with today's English text word for word:
    -   **The email step:** `portalAuth.signIn.eyebrow` ("Sign in"), `.emailLabel` ("Email"),
        `.emailPlaceholder` ("you@example.com"), `.request` ("Email me a sign-in code"),
        `.invalidEmail` ("Enter a valid email address"), `.noPasswords` ("One-time link and
        code, no passwords. {back}"). The `{back}` link's label is `common.back`.
    -   **The code step:** `portalAuth.code.eyebrow` ("Check your inbox"), `.title` ("Enter the
        6-digit code"), `.sentTo` ("We sent a sign-in link and code to {email}. Click the link,
        or type the code here."), `.label` ("Code"), `.placeholder` ("123 456"), `.verify`
        ("Verify"), `.differentEmail` ("Use a different email") and `.resend` ("Resend").
    -   **The verify page:** `portalAuth.verify.signingIn` ("Signing you in…"), `.eyebrow`
        ("Sign-in link"), `.title` ("We could not sign you in"), `.incomplete` ("This sign-in
        link is incomplete. Request a new one."), `.requestNew` ("Request a new link") and
        `.back` ("Back to start").
    -   **No error keys:** the error codes use the shared `apiError` messages (item 4).
    -   **The blurbs:** `portalAuth.blurb.teach` ("Author courses, submit them for review and get
        paid through Stripe.") and `portalAuth.blurb.support` ("Internal tools: review courses,
        approve teachers, manage payments.").

    `{email}` and `{back}` are slots, filled with React nodes by `fillSlots`, as ADR 008 sets
    out.

##### 2. Personal application messages

-   **Files**: `packages/i18n/src/messages/areas/personalApply.en.ts` and `personalApply.zh.ts`
    (Create).
-   **Type / Scope**: message catalog.
-   **Proposed Changes**: one key for every sentence in `apps/teach/src/routes/apply.tsx`, with
    today's English text word for word. Key names follow `companyApply`: `personalApply.<field>`
    for a label, `.hint` for its hint, and `personalApply.<section>.title` for a heading. The
    headline label reuses `profileField.headline`, as the company form does. The display name
    and bio labels reuse `profileField.displayName` and `profileField.bio`.
    -   **The header:**
        -   `personalApply.eyebrow.apply`: "Become a teacher"
        -   `personalApply.eyebrow.reapply`: "Update your application"
        -   `personalApply.title`: "Teach what you practise."
        -   `personalApply.intro`: "Elevate is a small, curated platform. Tell us who you are,
            what you teach and show us a few minutes of you teaching. A human reviews every
            application, usually within two working days."
        -   `personalApply.companyInstead`: "This application is for a person teaching under
            their own name, a sole proprietor included. Teaching as a private limited company or
            an LLP? {link}."
        -   `personalApply.companyInstead.link`: "Apply as a company instead"
        -   `personalApply.reviewerNote`: "Reviewer note"
    -   **The load error:**
        -   `personalApply.loadFailed.title`: "Could not load your application"
        -   the retry button uses `common.tryAgain`
    -   **About you:**
        -   `personalApply.about.title`: "About you"
        -   `personalApply.displayName.hint`: "Shown on your courses and certificates."
        -   `personalApply.headline.hint`: "One line, e.g. “Ceramicist and studio teacher, Jalan
            Bahar”."
        -   `personalApply.bio.hint`: "50–3000 characters. Learners read this on your course
            pages."
    -   **Credentials and experience:**
        -   `personalApply.experience.title`: "Credentials and experience"
        -   `personalApply.credentials`: "Credentials"
        -   `personalApply.credentials.hint`: "Qualifications, years of practice, where you have
            taught."
    -   **Teaching sample:**
        -   `personalApply.sample.title`: "Teaching sample"
        -   `personalApply.sample.intro`: "Upload a short video of you teaching, or paste a link
            to one. Either is fine."
        -   `personalApply.sample.upload`: "Upload a video"
        -   `personalApply.sample.upload.hint`: "MP4 or MOV, up to a few minutes"
        -   `personalApply.sample.kept`: "The video from your last application is kept
            unless you upload a new one."
        -   `personalApply.sample.link`: "Or a link"
        -   `personalApply.sample.link.placeholder`: "https://youtube.com/…"
    -   **Submitting:**
        -   `personalApply.agreement`: "By applying you agree to the teacher agreement: you own
            your content; Elevate holds a non-exclusive hosting licence while it is listed."
        -   `personalApply.submit.apply`: "Submit application"
        -   `personalApply.submit.reapply`: "Resubmit"
        -   `personalApply.sent.title`: "Application sent"
        -   `personalApply.sent.description`: "We will email you when it has been reviewed."
        -   `personalApply.submit.failed`: "Could not submit"

    `{link}` is a slot, filled by `fillSlots`. The search in item 8 is the final check that no
    sentence in the file is left out.

##### 3. Catalog assembly

-   **Files**: `packages/i18n/src/messages/en.ts` and `zh.ts` (Modify).
-   **Type / Scope**: catalog assembly.
-   **Proposed Changes**:
    -   Add the `portalAuth` and `personalApply` areas to `enAreas`/`zhAreas` and to the merged
        catalogs.
    -   The "Translated today" header comment in `en.ts` adds the sign-in and verify pages of
        Teach and Support, and Teach's personal application.

##### 4. Sign-in error helper

-   **Files**: `packages/web-ui/src/portal/sign-in-errors.ts` (Create) and
    `packages/web-ui/src/portal/index.ts` (Modify).
-   **Type / Scope**: web-ui helper.
-   **Proposed Changes**:
    -   `signInErrorKey(error: unknown): MessageKey | null` returns
        `` `apiError.${error.code}` `` when `error` is an `ApiError` whose `code` is
        `link_invalid`, `link_used`, `link_expired`, `code_invalid`, `code_locked` or
        `rate_limited`, and null otherwise. The codes are one `as const` list that `satisfies`
        `UserErrorCode[]`, so the key type checks without a cast.
    -   `useSignInErrorMessage()` words an error with that key, or with `useErrorMessage()`
        when there is none. Both pages use it.
    -   `index.ts` exports it.

##### 5. Sign-in page

-   **Files**: `packages/web-ui/src/portal/SignInPage.tsx` (Modify).
-   **Type / Scope**: shared page.
-   **Proposed Changes**:
    -   **Text:** every string becomes `t()` with a `portalAuth` key (item 1). The sent-to
        sentence and the "no passwords" line use `fillSlots`.
    -   **Errors:** the state holds `{ kind: 'invalidEmail' } | { kind: 'api'; error: unknown }
        | null`, worded at render. `invalidEmail` uses its key. `api` uses
        `signInErrorKey(error)` when it returns a key, and `useErrorMessage()` otherwise.
    -   **The blurb:** the `blurb: string` prop becomes `blurbKey: MessageKey`.
    -   **The picker:** `PreferencesButton` from `../preferences` goes in a row with `Logo`,
        aligned to the end, as `apps/teach/src/routes/invitation.tsx` lays it out. `VerifyPage`
        gets none: it shows a spinner, and its error state links back to this page.
    -   **The sign-in request** sends `locale`, the resolved language from `usePreferences()`.
    -   **The code verify** is unchanged: it sends no `locale`.

##### 6. Verify page

-   **Files**: `packages/web-ui/src/portal/VerifyPage.tsx` (Modify).
-   **Type / Scope**: shared page.
-   **Proposed Changes**:
    -   Every string becomes `t()` with a `portalAuth.verify` key.
    -   The error state stores `{ kind: 'incomplete' }` or the error object, and words it at
        render as item 5 does.
    -   The token verify is unchanged.

##### 7. Portal routers

-   **Files**: `apps/teach/src/router.tsx` and `apps/support/src/router.tsx` (Modify).
-   **Type / Scope**: route tables.
-   **Proposed Changes**: pass `blurbKey="portalAuth.blurb.teach"` and
    `blurbKey="portalAuth.blurb.support"` in place of the English `blurb`. `portalName` stays,
    since it is a name.

##### 8. Personal application form

-   **Files**: `apps/teach/src/routes/apply.tsx` (Modify).
-   **Type / Scope**: Teach page.
-   **Proposed Changes**:
    -   Every string becomes `t()` with a key from item 2. The implementer searches the file for
        JSX text, `label=`, `hint=`, `placeholder=`, and the `title` and `description` of each
        toast and of the load-error state.
    -   The company-instead sentence uses `fillSlots` with its `{link}` slot, as
        `apply-corporate.tsx` does for `companyApply.personalInstead`.
    -   `errorMessage(error)` becomes the function from `useErrorMessage()`, in the load-error
        state and in the failed-submit toast.
    -   Field errors are unchanged: both forms already show the server's validation messages
        under each field, in English.

##### 9. Sign-in API tests

-   **Files**: `apps/api/test/auth.test.ts` (Modify).
-   **Type / Scope**: integration test (vitest, PGlite in process).
-   **Proposed Changes**: add any of these cases that aren't there already.
    -   **The code email:** a Teach sign-in request with `locale: 'zh'` gets a Chinese code
        email, and its link ends with `&lang=zh`.
    -   **Verify writes nothing:** a Teach verify with no `locale` leaves `users.locale`
        unchanged. This case uses raw `api()` calls with the `dev.link` value, because the
        `signIn()` helper sends `locale` on both requests and verifies by code only.
    -   **The codes the server can answer,** which item 4 depends on:
        -   a wrong code answers `code_invalid`;
        -   an expired link answers `link_expired`;
        -   an unknown token and a used link answer `link_invalid`;
        -   a code tried after five wrong codes answers `link_invalid` too, because the fifth
            wrong code uses the link up. This case uses a single sign-in request, so the address
            has no other unused link. The existing test accepts either `link_invalid` or
            `code_locked` here and is left as it is;
        -   two verifies of one link at once answer `link_used` to the loser (an existing test);
        -   a sixth code request in the window answers `rate_limited`.

##### 10. Records

-   **Files**: `docs/adr/010-locale-resolution-and-email-language.md`,
    `docs/adr/008-theming-preferences-i18n.md`, `AGENTS.md`, `docs/designs/learner-chinese.md` and
    `packages/web-ui/src/preferences/PreferencesCard.tsx` (Modify).
-   **Type / Scope**: records and agent rules.
-   **Proposed Changes**:
    -   **ADR 010** adds: "Teach and Support send the page's resolved language as `locale` on
        the sign-in request, so the code email and the emailed link follow it. They send no
        `locale` at verify, so signing in to a portal never writes `users.locale`."
    -   **ADR 008:**
        -   its "Translated today" paragraph adds "the sign-in and verify pages of Teach and
            Support" and, after "the company application and set-up", "the personal
            application";
        -   its sentence on pages that carry a `PreferencesButton` ("Teach's application and
            set-up pages, an invitation link") adds "the sign-in page of Teach and Support";
        -   its list of shared components that call `useT()` adds `SignInPage` and `VerifyPage`;
        -   after the `useErrorMessage()` bullet, add: "A page may map an `error.code` it knows
            to a catalog message. The server's sentence stays English and is the fallback for
            every other code. First used for the sign-in codes (`signInErrorKey`)."
    -   **`PreferencesCard.tsx`:** the comment above `PreferencesButton`, which lists the pages
        that carry it, adds the sign-in page.
    -   **AGENTS.md:** in the "Translated pages" rule, the list in brackets gains "the sign-in
        and verify pages of Teach and Support" and "Teach's personal application". The rule
        gains one sentence: "A page may map an `error.code` it knows to a message key; the
        server's message is the fallback."
    -   **`learner-chinese.md`,** four edits:
        -   the sentence "Teach and Support send none, so their links carry no `lang`" is
            replaced by "Teach and Support send the page's language once the Teach PR of
            [learner-teach-banner.md](learner-teach-banner.md) lands; until then they send none,
            so their links carry no `lang`.";
        -   under "Why Teach stores `?lang` and the learner app doesn't", the Teach bullet
            ("the parameter arrives once, from the banner") gains: "From the Teach PR of
            [learner-teach-banner.md](learner-teach-banner.md) onwards it also arrives on the
            emailed sign-in link, so opening that link stores the language the sign-in page was
            showing.";
        -   its CUJ 6, which expects the picker to show "Follow device", gains: "After a
            sign-in through the emailed link, the picker shows the page's language.";
        -   its risk row on a crafted `?lang` link, which accepts that a link overwrites a
            deliberate "Follow device", says that the emailed sign-in link does the same at
            every sign-in.

##### 11. Teach and Support checks

-   **Files**: none.
-   **Type / Scope**: test coverage note.
-   **Proposed Changes**:
    -   **No web-ui tests,** because `packages/web-ui` has no test runner. `signInErrorKey` and
        the pages are checked by hand.
    -   **Automated:** the server's `locale` handling and the codes it can answer are covered by
        item 9, and both new areas by the i18n parity test.
    -   **Teach, by hand,** in a `zh-SG` browser profile and again in an English one, at desktop
        and phone width:
        -   the sign-in page, the code step, the verify page and the personal application show
            no English in Chinese;
        -   a wrong code, a used link and an expired link show their Chinese sentences, and a
            field validation message on the application shows in English;
        -   the picker on the sign-in page switches the page, and the next code email follows
            it;
        -   after signing in through the emailed link, the picker shows the page's language as
            the stored choice.
    -   **Support, by hand,** at `SUPPORT_URL/sign-in` in a `zh-SG` browser profile: the page
        is Chinese, the picker switches it to English, and the code email follows the page.

#### The learner PR

##### 12. Teach address

-   **Files**: `apps/learner/src/lib/web-url.ts` (Modify).
-   **Type / Scope**: helper.
-   **Proposed Changes**: add `teachUrl(path = ''): string`.
    -   It reads `process.env.EXPO_PUBLIC_TEACH_URL`, trimming a trailing `/`.
    -   **The fallback** applies when the value is missing or points at `localhost` or
        `127.0.0.1`. That rule is Support's `teachUrl()` rule
        (`apps/support/src/lib/urls.ts`). The web and native branches are chosen with
        `Platform.OS === 'web'`.
        -   **Web:** `${window.location.protocol}//${window.location.hostname}:5173`, as
            Support's does.
        -   **Native:** `http://<host>:5173`, with the host taken from
            `Constants.expoConfig?.hostUri` as `webBaseUrl()` takes it, and
            `http://localhost:5173` when there is none.

##### 13. Dismissal storage

-   **Files**: `apps/learner/src/lib/teach-banner-storage.ts` (Create).
-   **Type / Scope**: storage helper.
-   **Proposed Changes**:
    -   One file for web and native, using AsyncStorage, which is already a dependency. This is
        the app's first use of AsyncStorage on web, where the package is expected to store in
        `localStorage`. That is confirmed in CUJ 4's web walkthrough, by finding the key in the
        browser's local storage. The preferences storage has a separate `.web.ts` file only so
        that the first paint can read the theme synchronously, which the banner doesn't need.
    -   `readDismissedAt(): Promise<number | null>` and `writeDismissedAt(at: number):
        Promise<void>` use the key `elevate.teachBanner` and store the time in milliseconds as a
        string.
    -   Every read and write sits in a `try`/`catch`. A failed read, or a value that isn't a
        number, counts as not dismissed. A failed write is ignored.

##### 14. Banner rule

-   **Files**: `apps/learner/src/lib/teach-banner.ts` (Create).
-   **Type / Scope**: rule and hook.
-   **Proposed Changes**:
    -   `TEACH_BANNER_HIDE_MS` is 30 days in milliseconds.
    -   `isProfileOwner(user: AuthUser | null): boolean` is
        `user?.profiles.some((p) => p.role === 'owner') ?? false`.
    -   `useTeachBanner(input: { searching: boolean; loaded: boolean }): { visible: boolean;
        dismiss: () => void }`.
        -   It reads the dismissal time once on mount, and holds it in state with a "read"
            flag.
        -   `visible` is false while the session is loading (a guard: the root layout renders
            nothing until then), while the time is unread, when the time is less than
            `TEACH_BANNER_HIDE_MS` before now, when `searching` is true, when `loaded` is false,
            or when `isProfileOwner(user)`.
        -   A session that is signed in with no user (the account request failed) counts as not
            an owner, so the banner shows.
        -   `dismiss()` sets the state to now at once and calls `writeDismissedAt(now)`.

##### 15. Banner

-   **Files**: `apps/learner/src/components/TeachBanner.tsx` (Create).
-   **Type / Scope**: component.
-   **Proposed Changes**:
    -   A `Card` with `learnerTeach.banner.title` (text variant `h3`) and `.body` (variant
        `body`, tone `secondary`).
    -   A `Button` with `variant="secondary"`, label `learnerTeach.banner.action` and `testID`
        `teach-banner-open`, which calls `router.push('/teach')`.
    -   A close control: `IconButton` (`apps/learner/src/ui/IconButton.tsx`) with the `X` icon
        from `lucide-react-native`, `label` from `learnerTeach.banner.close` and `testID`
        `teach-banner-close`, placed at the card's top end.
    -   It takes `onDismiss` from its parent, and reads no storage or session state.

##### 16. Explore

-   **Files**: `apps/learner/src/app/(tabs)/index.tsx` (Modify).
-   **Type / Scope**: screen.
-   **Proposed Changes**:
    -   Call `useTeachBanner({ searching, loaded: !courses.isPending && !courses.isError })`.
    -   Render `{visible ? <TeachBanner onDismiss={dismiss} /> : null}` once, after the four-way
        ternary that shows the skeleton, the error, the empty state or the list, as the last
        child of the outer `View`.
    -   Add an empty `View` with `testID` `explore-end` and a height of 1 as the very last
        child, after the banner. The device flow scrolls to it when the banner is hidden.

##### 17. The `/teach` screen

-   **Files**: `apps/learner/src/app/teach.tsx` (Create).
-   **Type / Scope**: route.
-   **Proposed Changes**:
    -   **The container:** `Screen` with `bottomInset={isWideWeb ? 0 : TAB_BAR_HEIGHT}`, as
        `apps/learner/src/app/course/[slug].tsx` has.
    -   **The back link:** a `Link href="/"` wrapping a `Pressable` with the `ArrowLeft` icon
        and the text `t('nav.explore')`, as that file lays it out, with `testID` `teach-back`.
    -   **Content,** from the `learnerTeach.screen` keys in item 20: the title (variant `h1`)
        and intro (`bodyLg`, tone `secondary`), then the three titled sections, each with an
        `h3` heading and `body` text. The six steps are a numbered list. The closing note comes
        last, in `small`, above the button.
    -   **The button:** `variant="primary"`, label `learnerTeach.screen.action`, `testID`
        `teach-open`. It builds `` `${teachUrl('/')}?lang=${locale}` ``, with `locale` from
        `usePreferences()`, and branches on `Platform.OS === 'web'` in this one file, as
        `apps/learner/src/app/checkout/[courseId].tsx` does:
        -   **Web:** `window.location.assign(url)`.
        -   **Native:** `Linking.openURL(url).catch(() => {})`, with `Linking` from
            `react-native`, as `apps/learner/src/components/RichText.tsx` does.

##### 18. Root stack

-   **Files**: `apps/learner/src/app/_layout.tsx` (Modify).
-   **Type / Scope**: navigation.
-   **Proposed Changes**: add `<Stack.Screen name="teach" />` beside `course/[slug]`, outside
    both `Stack.Protected` groups, so it opens signed in or out.

##### 19. Profile row

-   **Files**: `apps/learner/src/components/TeachProfileRow.tsx` (Create) and
    `apps/learner/src/app/(tabs)/profile.tsx` (Modify).
-   **Type / Scope**: component and screen.
-   **Proposed Changes**:
    -   **`TeachProfileRow`** returns null when `isProfileOwner(user)`. Otherwise it renders a
        `Card` with `learnerTeach.profile.title` (variant `h3`), `.body` (`body`, tone
        `secondary`) and a `Button` (`variant="secondary"`, label `.action`, `testID`
        `profile-teach-open`) that calls `router.push('/teach')`.
    -   **`profile.tsx`** renders it between the Preferences card and the Account card.

##### 20. Learner messages

-   **Files**: `packages/i18n/src/messages/areas/learnerTeach.en.ts` and `learnerTeach.zh.ts`
    (Create), and `packages/i18n/src/messages/en.ts` and `zh.ts` (Modify).
-   **Type / Scope**: message catalog.
-   **Proposed Changes**: these keys and English text, and the area joins `enAreas`/`zhAreas`
    and the merged catalogs.
    -   **The banner:**
        -   `learnerTeach.banner.title`: "Teach on Elevate"
        -   `.body`: "Run courses for learners in Singapore, and get paid through Stripe."
        -   `.action`: "Find out more"
        -   `.close`: "Hide this"
    -   **The Profile row:**
        -   `learnerTeach.profile.title`: "Teach on Elevate"
        -   `.body`: "Find out how to apply and run your own courses."
        -   `.action`: "Find out more"
    -   **The screen:**
        -   `learnerTeach.screen.title`: "Teach on Elevate"
        -   `.intro`: "Elevate Teach is where teachers apply, build courses and get paid. It is
            a separate website."
        -   `.who.title`: "Who can teach"
        -   `.who.body`: "Individuals and registered companies can apply. Learners buy your
            courses from your teaching profile."
        -   `.how.title`: "How it works"
        -   `.how.step1`: "Apply with your credentials and a teaching sample."
        -   `.how.step2`: "The Elevate team reviews your application."
        -   `.how.step3`: "Connect your Stripe account, so learners can pay you. For a company,
            Elevate then checks the account's legal name."
        -   `.how.step4`: "Build a course with lessons, video and a quiz."
        -   `.how.step5`: "The Elevate team reviews the course before it goes live."
        -   `.how.step6`: "Learners pay through Stripe, and Stripe pays you."
        -   `.fee.title`: "The fee"
        -   `.fee.body`: "Elevate takes a commission on each sale. Teach shows it for your
            course's price before you submit the course for review."
        -   `.signInNote`: "Teach has its own sign-in. You will be asked for your email again
            there."
        -   `.action`: "Go to Elevate Teach"

    The back link reuses `nav.explore` ("Explore") from the `chrome` area.

##### 21. Configuration

-   **Files**: `apps/learner/eas.json`, `.github/workflows/deploy.yml`, `.env.example` and
    `docs/runbooks/deploy.md` (Modify).
-   **Type / Scope**: build configuration.
-   **Proposed Changes**:
    -   **`eas.json`:** `EXPO_PUBLIC_TEACH_URL` is `https://teach.staging.elevatelearn.app` in
        `preview` and `https://teach.elevatelearn.app` in `production`. The `development`
        profile has no `env` block and is left on the fallback on purpose.
    -   **`deploy.yml`:** the "Build Teach, Support and learner web" step adds
        `EXPO_PUBLIC_TEACH_URL: ${{ vars.TEACH_URL }}`.
    -   **`.env.example`:** a commented `# EXPO_PUBLIC_TEACH_URL=https://teach.example.com` line
        beside `EXPO_PUBLIC_WEB_URL`, with what it is for.
    -   **`docs/runbooks/deploy.md`:** its list of build-time variables for the learner app adds
        `EXPO_PUBLIC_TEACH_URL`.

##### 22. Learner tests

-   **Files** (all Create), kept outside `src/app/`, where Expo Router treats every file as a
    route:
    -   `apps/learner/src/lib/__tests__/teach-banner.test.tsx`;
    -   `apps/learner/src/lib/__tests__/teach-banner-storage.test.ts`;
    -   `apps/learner/src/lib/__tests__/web-url.test.ts`;
    -   `apps/learner/src/__tests__/teach.test.tsx`;
    -   `apps/learner/src/components/__tests__/TeachProfileRow.test.tsx`.
-   **Type / Scope**: jest-expo tests, using the Chinese design's `TestProviders` and its
    `api.auth.me.$get` mock.
-   **Proposed Changes**:
    -   **`teach-banner.test.tsx`** mocks `@/lib/teach-banner-storage` with `jest.mock`, and
        controls the clock with jest's fake timers:
        -   visible for a signed-out visitor, for a writer on someone else's profile, and for a
            session that is signed in with no user;
        -   hidden for an owner of an `approved` profile, and of an `applied` one;
        -   hidden while the session loads, while the time is unread, while `searching` is
            true, and while `loaded` is false;
        -   after `dismiss()`, hidden, and `writeDismissedAt` was called with the current time;
        -   hidden when the stored time is 29 days old, and visible when it is 30 days old;
        -   a `readDismissedAt` that resolves to null shows the banner.
    -   **`teach-banner-storage.test.ts`** uses the AsyncStorage mock from
        `apps/learner/jest.setup.ts`, the way `preferences.test.tsx` does. It calls the mock's
        methods directly (`mockRejectedValueOnce`), and never `jest.spyOn`:
        -   a write, then a read, returns the same time;
        -   a stored value that isn't a number reads as null;
        -   a rejected `getItem` reads as null, and a rejected `setItem` doesn't throw.
    -   **`web-url.test.ts`** mocks `expo-constants` to give or withhold a `hostUri`.
        `teachUrl()`:
        -   returns the configured value without its trailing slash;
        -   applies the fallback for a missing value, a `localhost` value and a `127.0.0.1`
            value;
        -   uses the development host when there is one, and ends in `http://localhost:5173`
            when there is none.
    -   **`teach.test.tsx`** renders the route with `renderRouter` and `TestProviders`, as the
        Chinese design's sign-in test does. In `zh`, pressing `teach-open` calls a mocked
        `Linking.openURL` with a URL ending `/?lang=zh`.
    -   **`TeachProfileRow.test.tsx`:** nothing renders for an owner; for anyone else, pressing
        `profile-teach-open` pushes `/teach`.
    -   **Not covered by jest,** and checked by hand in the walkthrough:
        -   the web branches of the `/teach` button and of `teachUrl()`. Jest runs with
            `Platform.OS` as `ios`, so the `Platform.OS === 'web'` branches don't run;
        -   Explore's own `loaded` expression, because no test renders Explore.

##### 23. Device flow

-   **Files**: `.maestro/teach-banner.yaml` (Create) and `.maestro/README.md` (Modify).
-   **Type / Scope**: device flow (manual).
-   **Proposed Changes**:
    -   **`teach-banner.yaml`,** with the header of `learner-preferences.yaml`: `appId:
        ${APP_ID}` and `env: APP_ID: sg.elevate.learner`. It needs no `EMAIL` or `API_URL`,
        because it runs signed out:
        1.  launch with cleared state, signed out;
        2.  scroll until `teach-banner-open` is visible. The banner sits after the first page
            of courses and "Load more", so no further page has to load;
        3.  tap `teach-banner-open`, and assert `teach-open` is visible;
        4.  tap `teach-back`;
        5.  scroll to `teach-banner-close` and tap it;
        6.  stop and relaunch without clearing state, scroll until `explore-end` is visible, and
            assert `teach-banner-open` is not visible.

        The 30-day return is covered by item 22, not on a device.
    -   **`README.md`:** add the flow and its run command beside the existing command for
        `learner-preferences.yaml`.

### Verification Plan

-   **Compilation/Build**:
    -   `npx turbo run typecheck` after each pull request;
    -   `npx expo export --platform web` in `apps/learner`.
-   **Unit Tests**: `npx turbo run test`, covering:
    -   the i18n parity test for `portalAuth`, `personalApply` and `learnerTeach`;
    -   the learner tests in item 22.
-   **Static Analysis & Linting**: `npm run lint` (Biome) and `npm run check:dupes`.
-   **Test Coverage Requirement**: every branch of `useTeachBanner`'s rule, of `isProfileOwner`,
    of the storage helper and of `teachUrl()` has a test, except the web branches that item 22
    names as hand-checked.
-   **E2E/Integration**:
    -   **API integration tests** (item 9): the code email's language, verify writing nothing,
        and the codes the server can answer.
    -   **A manual walkthrough of the learner app:**
        -   CUJs 1, 3, 4 and 5 on learner web, against a local Teach. CUJ 1 includes the
            `/teach` button's and `teachUrl()`'s web branches. CUJ 4 confirms that
            `elevate.teachBanner` is in the browser's local storage, and checks the 30-day
            return by editing the stored time.
        -   With the API stopped, Explore shows "Could not load courses" and no banner.
        -   CUJ 2 on the iOS simulator and an Android emulator, with `EXPO_PUBLIC_TEACH_URL`
            pointing at the development host. On iOS it also confirms that a Teach sign-in made
            in the default browser is still there when Teach is opened again. The in-app browser
            is not tested.
    -   **The manual Teach and Support checks** in item 11.
    -   **The Maestro flow** in item 23, run by hand.
    -   **After the learner PR deploys to staging:** press the `/teach` button on the staging
        learner site and confirm it opens `https://teach.staging.elevatelearn.app/?lang=...`.
-   **Measurement**: after launch, count `teacher_applied` events with `reapply: false`, leaving
    out the hand-recruited teachers. When the count is read, and what result removes the
    banner, is [Question 2](#open-questions).

---

<!-- Provenance: Indicates initial structural drafting via EGM. -->

_Drafted with EGM_
