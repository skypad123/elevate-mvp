# ADR 010 — One language rule, an account language, and learner emails in it

**Status:** proposed · 2026-11-17

The design, its alternatives and the step-by-step plan are in
[`docs/designs/learner-chinese.md`](../designs/learner-chinese.md). This record keeps the
decisions. It amends [ADR 008](008-theming-preferences-i18n.md), which kept preferences off the
account and every email in English.

## Context

The learner app is aimed at Singapore, where many visitors read Chinese. The only language control
was behind sign-in, every install started in English, nothing read the device language, and the
server had no record of a learner's language, so every email was English. A stored `en` could not
be told apart from a default nobody chose.

## Decision

- **One order of precedence,** in `resolveLocale` (`packages/core/src/domain/locale.ts`). The
  language on screen is the first of:
  1. the language chosen on this device (`en` or `zh`);
  2. the account's language, used only when a person chose it;
  3. a `?lang` link parameter, when it is a supported language;
  4. `zh`, when the device's first language has the primary subtag `zh` (Traditional tags such
     as `zh-TW` included, since there is only a Simplified catalog);
  5. English.

  The three `preferences-init.js` pre-paint scripts copy rules 1, 4 and 5, because a classic
  script can't import.
- **`system` is the stored default.** The device's `locale` preference is `system`, `en` or `zh`.
  `system` means "not chosen on this device" and resolves by the rules above. A missing or unknown
  stored value becomes `system`. An `en` or `zh` stored before `system` existed counts as a choice,
  so no existing install changes language.
- **The account holds one language and whether it was chosen.** `users.locale` is a nullable
  `locale` enum (`en`, `zh`) and `users.locale_chosen` is a boolean, not null, default false. One
  column was chosen over a `users.preferences` JSON column. Nothing copies the account's language
  into device storage; the resolver reads it directly.
- **At verify, a chosen language beats a guessed one.** Verify carries the device's resolved
  `locale` and `localeChosen`. A chosen language sets `users.locale` and `locale_chosen = true`.
  A guessed one sets `users.locale` with `locale_chosen = false`, and only when the account has
  no language or its language was itself guessed.
- **The learner app writes the account's language only on a press, plus one fill-in.** It sends
  `PATCH /me` in three cases: a press on `English` or `中文` while signed in
  (`{ locale, localeChosen: true }`); a press on "Follow device" (`{ localeChosen: false }`); and
  once per app run after launch, when the signed-in account has no language
  (`{ locale: <resolved>, localeChosen: false }`). No effect watches the stored language, the
  fill-in never overwrites a language already on the account, and a failed write is ignored and
  not retried.
- **The learner emails' languages.** The sign-in code email uses the sign-in request's
  `locale`, else English, because the account may not exist yet; its link gets `&lang=<locale>`
  only when the request sent one. The receipt, the certificate email, the learner's copy of the
  refund email and the email for an automatically refunded second payment use `users.locale`,
  else English. The teacher's copy of the refund email, and every
  Teach, Support and teacher email, stay English.
- **Teach and Support send the page's language on the sign-in request.** Their sign-in page sends
  its resolved language as `locale`, so the code email and the emailed link follow the page. They
  send no `locale` at verify, so signing in to a portal never writes `users.locale`. (Added
  2026-11-18 with the Teach PR of the Teach banner design.)
- **The learner app words API errors from their codes.** Every error a learner can see has a code
  in `USER_ERROR_CODES` (`@elevate/core`) and a message `apiError.<code>`; the API sends variable
  parts as `details`, never spliced into the sentence. The app never shows the API's English
  sentence: an unlisted code or a proxy error gets a generic sentence in the language on screen.
  The API's `message` stays English, for logs, Support and the web portals, which keep showing it
  until their pages adopt the same rule. The portals' sign-in and verify pages word the sign-in
  codes and `rate_limited` from the same messages (`signInErrorKey` in `@elevate/web-ui/portal`),
  and show the server's sentence for any other code. (Amended 2026-11-17; this first read "API error messages
  stay English".)
- **Certificate PDFs stay English,** as the document of record. The in-app certificate screen and
  the public certificate page are shown in the viewer's language.
- **Teach and Support resolve `system` from the browser.** web-ui's `PreferencesProvider` passes
  `navigator.languages` to `resolveLocale`, and their pre-paint scripts apply the same device rule
  before paint. They have no account language yet. Their language picker offers "Follow device"
  (`system`) beside English and 中文.
- **The `?lang` hand-off is stored in Teach and Support only when nothing is stored.** Their
  pre-paint scripts read `?lang`; when it is a supported language and the stored `locale` is
  `system` or missing, they write it into `elevate.preferences` (keeping the theme), and either way
  remove `lang` from the address bar, keeping the hash. The parameter arrives from the learner
  app's Teach banner, on a site that has no language of its own yet, and on the emailed sign-in
  link, which carries the language of the page that asked for the code. The learner web app never stores `?lang`: it holds it in
  memory until the app next loads, because it arrives on every sign-in and checkout link and storing it would
  turn a guess into a lasting choice. In both, a language already stored is never overwritten.

## Consequences

- A learner's language reaches the server only through requests the app already makes (the
  sign-in request, verify, `PATCH /me`, starting checkout). Accounts signed in before this change
  are filled in by the one fill-in.
- Teach and Support show Chinese to a Chinese browser that has stored nothing, where they showed
  English before. A stored `en` keeps them English.
- A change to the device rule has to be made in `resolveLocale` and in all three pre-paint
  scripts.
- Code from before this change reads a stored `system` as unknown and writes `en` back. So a
  rollback pins devices that hadn't chosen to English, and during a deploy a Teach or Support tab
  still running the old bundle can turn another tab's "Follow device" into English through the
  browser's `storage` event, until it reloads. Both are accepted.
- The language is part of the checkout idempotency key, so starting checkout again after a
  language switch opens a second Stripe session. The older one is expired when that happens, and
  an enrolment is fulfilled once: a second payment that gets through (paid before the old session
  could be closed) is refunded automatically and the learner is told. A refund of that second
  payment never removes the course.
