# Learner main page improvements: Chinese language, Teach banner, hover preview, teaching profile page

- **Author:** Sky Livingston
- **Date:** 2026-11-16

## Overview

Four separate features for the Elevate learner app (`apps/learner`: web, iOS and Android). Each
ships on its own. Two audiences:

- **Singapore's Chinese-speaking learners**, who today have to sign in before they can find the
  language setting. Even then, most screens stay English.
- **Teachers**, who have no way in from the learner app. They also have no page of their own to
  send their students to.

The four features:

1. **Chinese learner app with a switcher before sign-in.** Every screen and every learner email
   is available in Chinese. On first visit the app guesses the language from the browser or phone
   settings. A switcher sits on the home page and the sign-in screen. Text that teachers typed
   (course titles, descriptions, lessons) stays as typed.
2. **Teach banner at the bottom of the home page.** A short introduction to teaching on Elevate,
   then a link to Teach sign-in, or into the Teach portal if the visitor is already signed in
   there. Users who already own a teaching profile don't see it. Teach opens in the language the
   visitor chose in the learner app.
3. **Hover preview on course cards (web only).** When the mouse rests on a course card, the still
   thumbnail is replaced by Mux's silent animated preview of the course's video, as YouTube does.
   Phones and touch screens keep the still image.
4. **Public teaching profile page.** The teacher's name on a course opens the profile's page,
   which shows the name, headline, bio, avatar and the profile's other live courses. Teachers
   share the link with their own students. The link opens the installed app and falls back to
   the web page.

## Analysis

The seven-lens review found the four features much less even in size than the list suggests.
Three of them rest on an assumption the code does not support today.

### Feature 1 is the large one, and ADR 008 currently rules against parts of it

- **Emails can't follow a language that only lives on the device.**
  - The language preference sits in device storage (`elevate.preferences`). The `users` table has
    no language column (`packages/db/src/schema/auth.ts`). The sign-in request carries only
    email, audience and redirect path.
  - Three of the four learner emails are sent with no learner request behind them:
    - the receipt, from the Stripe webhook;
    - the certificate;
    - the refund.

    So the server has to store the language itself, not read it off a request header.
  - `docs/adr/008-theming-preferences-i18n.md` says preferences are "not synced to the account
    for now" and that API error messages and emails stay English. That ADR has to be amended, or
    a new ADR written, before design starts.
- **The app can't tell "never chose" from "chose English".** `locale` defaults to `en`, and the
  learner app writes the parsed preferences back to storage on every load. Every existing install
  therefore already stores `en`. A first-visit guess would never run for those installs unless the
  stored value can mean "not chosen yet". Theme already does this with `'system'`.
- **The job is bigger than the screens.** Most learner route files and several components use
  English literals: about 135 strings, plus plurals. English also arrives from outside the
  screens:
  - the duration and money formatting in `lib/format.ts`, which hard-codes `en-SG`;
  - category labels from `packages/core`;
  - error messages from the API;
  - Stripe Checkout, which is sent no `locale`;
  - the certificate PDF.

  The certificate PDF needs a Chinese font the repo doesn't ship. Its line wrapping splits on
  spaces, so a Chinese sentence never wraps.
- **The guess helps less than the switcher.** Many Singapore Chinese speakers run phones and
  browsers set to English (en-SG), so the guess misses them. Reading the phone's language needs
  `expo-localization`, a native module, which means a new app build.
- **Three paths leave the chosen language:**
  - native checkout opens the system browser;
  - the emailed sign-in link opens in a browser;
  - Teach is a separate site.

  Each needs the language passed along in the link.
- **Course content stays English.** A Chinese-speaking learner can read every button and still
  find only English courses. No table records the language a course is taught in. This decides
  whether Feature 1 reaches its audience: it depends on whether Chinese-taught courses exist.

### Feature 2 is small if "into Teach" means a link

- **The learner app can't sign anyone in to Teach.** The learner app and Teach each keep their own
  session token in their own site's storage, with sessions issued per audience. "Straight into
  the portal if signed in" works only if the banner links to Teach's home and Teach's own router
  decides between the sign-in page and the portal. A real session hand-over would need a new
  one-time code exchange and a security design.
- **Ownership is already known.** The signed-in user (`AuthUser.profiles`) carries each profile's
  `role` and `status`, so no new API is needed to hide the banner. The edge cases still need a
  rule:
  - owners versus members (writers, managers);
  - applicants and rejected applicants;
  - staff;
  - signed-out owners, who will still see the banner.
- **The Teach sign-in page and its email are English.** Passing the language does nothing until
  they are translated, so Feature 2's language hand-over depends on Feature 1's email work.
- **Passing the language.** The Teach pre-paint script (`public/preferences-init.js`) reads only
  local storage today. Proposed: a `?lang=zh` parameter. The script checks it against the
  supported list, saves it, sets `<html lang>` and removes it from the address bar. Support has a
  copy of that script, and the two must stay identical.
- **The learner app doesn't know where Teach is.** Only the Support portal reads `VITE_TEACH_URL`.
  The learner app needs a new `EXPO_PUBLIC_TEACH_URL` in `deploy.yml` and both `eas.json`
  profiles.

### Feature 3: a course has no video of its own, and lesson video is paid content

- **There is no course video.** A course has only `thumbnailMediaId`, an image. The only candidate
  is the first live video in the first lesson, and that pick changes when a teacher's edit to a
  live course is approved.
- **It changes who may see lesson video.** All Mux assets are created with signed playback, and
  the API hands out a playback token only after checking enrollment. An animated preview on the
  public catalog shows frames of paid lessons to anyone, signed in or not. That is a new rule for
  who sees what, and teachers have not agreed to it. The teacher agreement covers hosting only.
- **Signed previews break catalog caching.** Signing a fresh preview token for every card on every
  catalog request costs a token per card, 12 cards a page. It also stops the catalog response
  being cached, and the tokens expire after two hours.

  The reviewers believe animated previews need their own Mux token type. Nobody checked that
  against Mux's documentation, and the design doc must.
- **Proposed instead: make the clip once.** When Support approves the course (the only path to
  `live`), fetch a short animated WebP from Mux once. Store it as a public image next to the
  thumbnail and serve it the same way. The catalog stays cacheable, and the teacher can pick the
  seconds or tick a consent box in Teach. The cost: storage, a new file whenever the source video
  changes, and a clip that stays public.
- **The value is small at today's size.** The pilot has a handful of teachers, most learners are
  likely on phones (no hover), and nothing can measure whether the preview helps. Showing lesson
  count and total length on the card is a cheaper alternative.
- **Details for the design doc:**
  - a short delay before playing, and the still returns on mouse-out;
  - respect "reduce motion";
  - keyboard focus;
  - crop 16:9 video into the 4:3 card;
  - detect a mouse with the `(hover: hover) and (pointer: fine)` media query, not by platform.

### Feature 4: the page is medium, app links are large

- **The data exists; the endpoint does not.** `CoursePublicView.teacher.id` is already the
  profile ID, so an ID-based link exposes nothing new. A new public catalog route is needed, plus
  a `profileId` filter on the existing course list.
- **Expose only approved profiles.** The `profiles` table also holds credentials, the teaching
  sample URL, commission and Support's review notes, so the route selects named columns only. It
  should answer 404 for any profile that isn't approved, so the page never confirms that an
  application exists.
- **App links are the expensive part.** Opening the installed app from a web link needs:
  - Apple and Android domain-verification files served from the site;
  - the app configuration moved to `app.config.ts`, because the domain differs per environment;
  - the Apple Team ID and the Play signing key for each environment;
  - a new store build.

  Two more problems:
  - Staging is reachable only over Tailscale, so Apple's and Google's checks can't reach it.
  - The app should claim only the profile paths. Claiming all paths would pull the emailed
    sign-in links and the Stripe return page into the app, while checkout deliberately runs on
    the web.
- **Most people will open the web page anyway.** Links shared in chat apps often open in the
  app's built-in browser, which doesn't hand off to other apps. (This is general knowledge, not
  checked.) Every page also shares one fixed `<title>`, so every shared link shows the same
  generic preview. Per-profile link previews (title, image) may matter more than opening the
  app.
- **The teacher's side is missing.** Teach needs a place to copy the link from.

### Across all four

- **Features 1 and 2 share one foundation:** how the language is chosen, stored and passed along.
  Order of precedence: the user's own choice, then the account's stored value, then a `?lang`
  link parameter, then the device guess, then English. The language travels:
  - with the sign-in request;
  - onto `users.locale` at sign-in;
  - through `PATCH /me` when the user switches;
  - into the server's emails;
  - into Teach through `?lang`.

  Features 3 and 4 don't depend on it.
- **Nothing can measure any of the four.** Analytics events are sent only from the server, have
  no `locale` property, and no endpoint takes events from the app.
- **There is no fast native rollback.** There are no over-the-air updates (`expo-updates`) and no
  feature flags, so a bad native build can only be fixed through another store release. Each
  design doc should say how its feature is turned off.

### Contradictions and the ideal result

| Conflict                                                                  | Ideal result                                                            | Proposed way through                                                                                        |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| The language must work before sign-in, but the server needs it for emails | The device is the only place a choice is made                           | Send the language with requests the app already makes: the sign-in request, sign-in itself, and `PATCH /me` |
| A first-visit guess, versus a choice that lasts                           | Store only real choices                                                 | Store the language only when the user picks one, or store `system` and resolve it at runtime                |
| The banner needs Teach state, but the app shouldn't depend on Teach       | One link, and Teach decides                                             | Always link to `TEACH_URL/?lang=…`; hide the banner using `AuthUser.profiles`                               |
| The preview should move, and also be cheap, cacheable and rights-safe     | A public clip, made once, from seconds the teacher agreed to            | Render an animated WebP at approval and store it like the thumbnail                                         |
| The link should open the app, but app links are costly                    | The web page is the link, and also the fallback when the app is missing | Version 1: a web page with an "Open in app" button. Version 2: verified app links                           |

## Goals vs. Non-Goals

- **In-Scope Goals:**
  - Every learner-app screen and learner email in Simplified Chinese and English. API error
    messages stay English.
  - A language guess on first visit, plus a switcher on the home page and the sign-in screen.
  - A Teach banner at the bottom of the home page, hidden from users who own a teaching profile,
    linking to Teach in the visitor's chosen language.
  - A silent animated hover preview on course cards on the web.
  - A public, ID-linked teaching profile page with the bio and live courses, linked from the
    course page and shareable by teachers, opening the app when it's installed.
  - A way to measure each feature.
- **Out-of-Scope Non-Goals:**
  - Translating text that teachers typed (course titles, descriptions, lessons). Multi-language
    course content is a future feature.
  - Reviews, ratings, comments and replies on profiles or courses (future).
  - Structured profile fields such as experience and qualifications (future).
  - Readable profile handles such as `/t/jane-tan` (ID-based for now).
  - Hover previews on phones and touch screens.
  - A session hand-over that signs a learner in to Teach.
  - Translating the Teach and Support portals beyond the sign-in and start pages Feature 2 lands
    on.

## Alternatives Weighed

- **YouTube embed for the hover preview.** Rejected by author: the aim is the YouTube-style
  behaviour, not YouTube hosting. Course video already lives in Mux.
- **A separate trailer uploaded by the teacher.** Rejected by author in favour of Mux's animated
  preview of existing video. The review notes this reopens part of the question: something must
  still pick which video and which seconds, and the teacher must agree to them being public.
- **Readable profile handles.** Rejected by author for now; ID links are enough. The review
  proposes a shorter form of the same ID (`/t/<22-character base64url of the UUID>`), which needs
  no new column.
- **Reviews and replies in the first version.** Deferred by author. The spec also lists reviews,
  ratings and discussions as out of scope.
- **Reading the language from the `Accept-Language` header only.** Rejected in review: the
  receipt, certificate and refund emails are sent with no learner request, so there is no header
  to read.
- **Sending the language on every request and writing it to the user row.** Rejected in review: a
  database write on every request.
- **A `users.preferences` JSON column (the route ADR 008 sketches).** Not chosen yet. It would
  also sync theme, but the learner app's and Teach's values would overwrite each other. A
  `users.locale` column scoped to email language is narrower.
- **Pre-filling the Teach sign-in with `?email=`.** Rejected in review: it puts the address in
  server logs and referrer headers.
- **Signing preview tokens in the catalog list, or fetching one on hover.** Rejected by author in
  favour of making the clip once at approval. Signing in the list costs a token per card and
  stops the catalog being cached. Fetching on hover adds a round trip and a public endpoint that
  hands out URLs, which needs rate limiting.
- **A session hand-over that signs a learner in to Teach.** Rejected by author in favour of a
  plain link: it would need a new one-time code exchange and its own security design.
- **Translating API error messages.** Rejected by author: the API and its error messages stay
  English.
- **Translating only the purchase path first** (home, course detail, sign-in, checkout and the
  sign-in email). Not chosen yet: a smaller first release than "the whole app".

## Key Decisions & Staging for Next Steps

**Decided by author:**

1. The four features ship separately.
2. Chinese means the whole learner app, including its emails. Teacher-typed text stays as typed.
3. The first visit guesses the language from the browser or phone.
4. The banner goes to Teach sign-in, or into the Teach portal if signed in. Owners of a teaching
   profile don't see it. Teach opens in the chosen language.
5. The hover preview is web-only and uses Mux's animated preview of existing course video.
6. The profile page uses ID links, opens the app when installed, and falls back to the web page.
7. Reviews and structured profile fields come later.
8. **The API stays English.** Server logic and the error messages the API returns stay English.
   The app translates only the error sentences it words itself, following the existing
   `useErrorMessage()` pattern. ADR 008 is amended to support the switch:
   - a stored language can mean "not chosen yet", so the first visit can guess;
   - the switcher works before sign-in;
   - the language is passed to Teach with `?lang`;
   - learner emails follow the chosen language (see decision 11).
9. **The preview is made once, at approval.** When Support approves a course, the API fetches a
   short silent animated WebP from Mux. It stores the clip as a public image next to the
   thumbnail, and the catalog serves it the same way, so no token is signed per card and the
   catalog stays cacheable. In Teach, the teacher picks which seconds are used, or agrees to a
   default range. A course with no clip keeps its still thumbnail. A new clip is made when an
   approved edit replaces the source video.
10. **The banner is a plain link.** It always points to `TEACH_URL/?lang=<chosen>`, and Teach's
    own router sends the visitor to sign-in or into the portal. No session is handed over. The
    learner app hides the banner using `AuthUser.profiles`. It needs a new
    `EXPO_PUBLIC_TEACH_URL`. Teach's pre-paint script, and its Support copy, read `?lang`.
11. **Learner emails follow the chosen language.** This covers the sign-in code, receipt,
    certificate and refund emails, and the server has to store the language for them:
    - **The sign-in request carries `locale`.** It is saved on the magic-link row, so the
      sign-in email goes out in the language the visitor is using.
    - **Sign-in copies it to a new `users.locale` column.** The receipt, certificate and refund
      emails, which are sent with no learner request, read this column.
    - **A switch updates it.** When a signed-in learner changes language, the app sends
      `PATCH /me` with the new value. The most recent change wins across devices.
    - **Emails come from the shared catalog.** They are rendered from `@elevate/i18n` in a new
      `email` area, still through `simpleEmail`, so typed text is escaped. The API gains a
      dependency on `@elevate/i18n`.
    - **The sign-in link carries `lang`,** so the browser it opens in stays in the chosen
      language.
    - **API error messages stay English** (decision 8).

**Proposed documents, in order:**

1. An ADR on how the language is chosen, stored and passed along. It amends ADR 008 and comes
   before Features 1 and 2.
2. An ADR on app links and public URLs: which paths the app claims, how the verification files
   are served, and how links are tested while staging is private. It comes before Feature 4.
3. Four design docs under `docs/designs/`, one per feature, each with acceptance criteria,
   success measures, and how to turn the feature off.

   Ordering:
   - Feature 3 can go first once the footage rule is decided.
   - Feature 4 should ship after Feature 1, or carry its own Chinese strings.

**Open questions to settle in the design docs:**

1. **Chinese variants:** Simplified only? What do Traditional Chinese (zh-TW, zh-HK), Malay, Tamil
   and en-SG devices get?
2. **Existing installs:** do installs that already store `en` count as having chosen English?
3. **One language or two:** if a user's language differs between devices, which wins? Is there
   one email language per user across the learner app and Teach?
4. **The certificate:** are the PDF and the public certificate page translated? Is the language
   fixed when the certificate is issued? Which Chinese font ships, and under what licence?
5. **Chinese courses:** how many live courses are taught in Chinese, or promised? Should a course
   get a language field and a filter?
6. **Who doesn't see the banner:** owners only, or any member? What about applicants, rejected
   applicants and staff?
7. **The banner's intro:** how many screens does it have, does it live in the learner app or
   Teach, and can it be dismissed for good?
8. **`?lang` versus Teach's setting:** does the link parameter override a language Teach already
   stored?
9. **The preview clip:** what is the default range when the teacher picks nothing? Where in Teach
   are the seconds picked? Does the reviewers' belief that animated previews need their own Mux
   token type hold, checked against Mux's documentation?
10. **Which language wins at sign-in:** when the language on the sign-in request differs from
    the one already stored on the account, which is kept? Do Teach emails use the same
    `users.locale`?
11. **Missing or empty profiles:** a profile that isn't approved or has no live courses gets a 404
    or an empty page? Do company profiles get the page too?
12. **App links:** which paths are claimed, and how are they tested on private staging? Where do
    the Apple Team ID and Play key come from for each environment?
13. **Sharing:** where does a teacher copy the link, and can writers share it? Do shared links
    need per-profile previews for WhatsApp or WeChat?
14. **Measurement:** add a `locale` property to server events now? Add a client event endpoint
    for card impressions and app-versus-web opens?
15. **Native rollback:** is `expo-updates` (over-the-air updates) in scope?
