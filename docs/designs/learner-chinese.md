# Chinese learner app with a language switch before sign-in

-   **Author:** Sky Livingston
-   **Status:** Proposed
-   **Date:** 2026-11-16

---

## Overview

Elevate sells short courses by independent teachers in Singapore. This design makes the learner
app (`apps/learner`: web, iOS and Android) usable from the first screen by people who read
Chinese.

It does four things:

1.  **Translates every screen and learner email** into Simplified Chinese. That covers every
    learner screen, plus the sign-in code, receipt, certificate and refund emails.
2.  **Picks a language on the first visit** from the browser or phone settings.
3.  **Puts a switcher on Explore (the home tab) and the sign-in screen**, so nobody has to sign
    in to find it.
4.  **Lets Teach and Support follow the browser's language too,** and accept a one-time `?lang`
    link parameter. Only their already translated pages change.

Text that teachers typed stays as typed: course titles, descriptions and lessons. Messages from
the API stay English.

This is the first of four separate designs drawn from
[learner-main-page-improvements.md](learner-main-page-improvements.md). The others are the Teach
banner, the course-card hover preview and the public teaching profile page. Its language
hand-off (`?lang`) is what the Teach banner design builds on.

## The Problem

The learner app is aimed at Singapore. In the 2020 census, Mandarin was the language most often
spoken at home after English, by about 30% of residents. Today the app shows those visitors
only English until they sign in, and most of it stays English afterwards. Five problems:

-   **The language setting is behind sign-in.** The only language control is on the Profile tab
    (`apps/learner/src/app/(tabs)/profile.tsx`), which a signed-out visitor can't open. A new
    visitor has to get through an English Explore page, an English sign-in screen and an
    English sign-in email before they can change it.
-   **The setting changes little even when found.** Navigation and the Profile screen are
    translated. The pages that decide whether someone signs up are English literals:
    -   Explore (`(tabs)/index.tsx`);
    -   sign-in and verify;
    -   course detail;
    -   checkout;
    -   the course card.

    Durations, dates (`lib/format.ts` hard-codes `en-SG`), the "Free" price label and category
    labels are English too.
-   **Every install starts in English, and the app can't tell a choice from a default.** The
    stored language defaults to `en` (`packages/core/src/contracts/preferences.ts`). The app
    writes that default back to storage on first load (`lib/preferences.tsx`), so it can't tell
    later whether someone chose English or never chose. Nothing reads the device language.
-   **Emails are English, and the server doesn't know the learner's language.** The language
    preference lives only on the device. The `users` table has no language column, and the
    sign-in request carries none. Three of the four learner emails are sent with no request from
    the learner to read a language from:
    -   the receipt comes from the Stripe webhook;
    -   the certificate is issued when the course is completed;
    -   the refund is triggered from Support.

    [ADR 008](../adr/008-theming-preferences-i18n.md) records that emails stay English and
    preferences aren't synced to the account. This design amends that.
-   **Links out of the app drop the language.** Each of these leaves the app in English:
    -   the sign-in link in the email opens a browser;
    -   native checkout opens the system browser;
    -   Stripe Checkout is sent no `locale`.

**What it costs:** a Chinese-reading visitor's first contact with Elevate is all English. There
is also no record of how many such visitors arrive or leave. Analytics events carry no language.

**The proposed fix:** translate the learner app whole and resolve one language for each visitor
in a fixed order of precedence:

1.  what they chose;
2.  what their account has stored;
3.  a `?lang` link parameter;
4.  the device setting;
5.  English.

Send the language with the requests the app already makes (the sign-in request, verify,
`PATCH /me`, starting checkout) so the server can store it and send emails in it.

## Goals

1.  **Every learner screen works in Chinese.** With the language set to Chinese, every route in
    `apps/learner/src/app` shows no English, with four exceptions:
    -   text that teachers typed;
    -   API error messages;
    -   names: Elevate, Stripe, course and teacher names;
    -   the certificate PDF, which stays an English document of record. The in-app certificate
        screen and the public `/c/[token]` page are translated, in the viewer's language.

    This also covers accessibility labels, durations, dates, money and category labels.
    The catalog parity test (`packages/i18n/test/catalog.test.ts`) passes with no Chinese key
    missing, and a manual audit of every route finds no other English (see the
    [Verification Plan](#verification-plan)).
2.  **The first visit picks the language.** On a visitor's first launch:
    -   a device or browser whose first preferred language is any Chinese (`zh`, `zh-*`) gets
        Chinese;
    -   anything else gets English.

    Once a person chooses a language, the device setting never overrides it.
3.  **A signed-out visitor can switch.** A switcher sits on Explore and on the sign-in screen.
    Switching on the sign-in screen keeps the typed email and the code step.
4.  **The learner emails follow the language.**
    -   The sign-in code email is in the language the visitor was using when they asked for the
        code.
    -   The receipt, certificate and refund emails, and the email for an automatically refunded
        second payment (item 15), are in the language stored on the account.
5.  **The language survives leaving the app.** These open in the chosen language:
    -   the page the emailed sign-in link opens;
    -   the checkout return pages;
    -   Stripe Checkout itself, which accepts `locale: 'zh'` (Simplified Chinese).
6.  **Chinese use can be measured.** The `sign_in`, `checkout_started` and `checkout_completed`
    events carry the language the learner was using. The share of Chinese sign-ins and purchases
    can then be counted from launch onwards.
7.  **Teach and Support agree with the learner app.** They resolve a language nobody chose from
    the browser, offer "Follow device" in their picker, and keep a `?lang` link parameter when
    nothing is stored yet ([CUJ 6](#cuj-6-a-chinese-browser-opens-teach-directly) and
    [CUJ 7](#cuj-7-a-lang-link-sets-teachs-language-once)).

## Non-Goals

-   **Translating text that teachers typed** (course titles, descriptions, lesson text, quiz
    questions). Multi-language course content is a later feature. No machine translation
    anywhere.
-   **Translating API error messages.** The API stays English. The app words only the error
    sentences it already writes itself, as `useErrorMessage()` does in the web portals.
-   **A course language field, or filtering by course language.** This is deferred, though see
    [Question 1](#open-questions).
-   **Traditional Chinese, Malay or Tamil catalogs.** Only `en` and `zh` (Simplified, formatted
    as `zh-SG`) exist.
-   **Translating more of the Teach and Support portals, or their emails.** Teach and Support
    also start guessing the language from the browser (see
    [Teach and Support](#teach-and-support)), and accept a `?lang` hand-off, but their
    untranslated pages stay English. The Teach sign-in page, the Teach sign-in email and the
    banner that sends people to Teach belong to the Teach banner design.
-   **Syncing theme or other preferences to the account.** Only the language is stored on the
    server, and only for emails.
-   **Over-the-air updates (`expo-updates`).** A native fix ships through the stores, as it does
    today.

## Open Questions

-   **Question 1 (Chinese courses; the brief's Question 5):** how many live courses are taught in
    Chinese, or promised by teachers? If none, a Chinese-reading learner meets an all-English
    catalog in a Chinese interface. That would call for a course language field sooner than
    "later".
-   **Question 2 (success target):** is there a target for the share of Chinese sign-ins and
    purchases? Or is the first release only meant to establish the baseline?
-   **Question 3 (the Chinese text), answered 2026-11-17:** Claude drafts the Chinese text in the
    house style of `packages/i18n/src/messages/zh.ts`, independent reviewers check it for
    accuracy, consistency and mechanics, and the author reads it and signs it off. A PR with
    Chinese text doesn't merge before that sign-off. (The author first chose to write it, then
    asked Claude to draft it the same day.)

This design answers the brief's Questions 1 (variants), 2 (existing installs), 3 and 10 (which
language wins), 4 (the certificate), 8 (`?lang` against Teach's setting), 14 (measurement) and
15 (over-the-air updates). Questions 6, 7, 9 and 11–13 belong to the other three designs.

## Critical User Journeys (CUJs)

### CUJ 1: A Chinese-reading visitor buys a course without meeting English

-   **Given**: A first visit to the learner web app in a browser whose first preferred language
    is `zh-CN`, with nothing stored for Elevate.
-   **When**: They open Explore, open a course, sign in with the emailed code, and pay.
-   **Then**:
    -   Explore, the course page, sign-in, verify and checkout are in Chinese. Teacher-typed
        titles and descriptions are as typed.
    -   The sign-in email is in Chinese.
    -   Stripe Checkout opens with `locale: 'zh'`, and the success page is in Chinese.
    -   The receipt email is in Chinese.
    -   `users.locale` is `zh`.
    -   The `sign_in` and `checkout_completed` events carry `locale: 'zh'`.

### CUJ 2: A Chinese reader on an English phone switches before signing in

-   **Given**: A first launch of the native app on a phone set to `en-SG`. The app guesses
    English.
-   **When**: On the sign-in screen they type their email, tap 中文, and ask for the code.
-   **Then**:
    -   The screen switches to Chinese, and the typed email is still there.
    -   The stored preference is `zh`, which counts as chosen.
    -   The code email is in Chinese.
    -   After sign-in, `users.locale` is `zh` and `locale_chosen` is true, because a chosen
        language overwrites the account.
    -   Tapping "Enrol on the web" opens the course page in the system browser in Chinese,
        because the link carries `?lang=zh`.

### CUJ 3: A returning learner on a new device keeps their account's language

-   **Given**: `users.locale` is `zh` with `locale_chosen` true. A new laptop with an English
    browser, so the stored preference is `system` and resolves to English. They ask for a code
    there, so the code email is English: it follows the request's language, and the account
    isn't consulted before sign-in.
-   **When**: They sign in.
-   **Then**:
    -   The account keeps `zh`, because the laptop's language was only a guess.
    -   The app switches to Chinese: the account's chosen language is an input to the resolver.
        Nothing is written to the laptop's storage, so the stored value stays `system`.

### CUJ 4: An existing install is not switched under its user

-   **Given**: An install made before this release. It stores `{"locale":"en"}` on a phone set
    to Chinese.
-   **When**: The updated app launches.
-   **Then**:
    -   The app stays English, because a stored `en` counts as a choice.
    -   The switcher on Explore offers 中文.

### CUJ 5: A webhook email follows the account

-   **Given**: `users.locale` is `zh`, and Support refunds the learner's payment.
-   **When**: The refund is recorded.
-   **Then**:
    -   The learner's refund email is in Chinese. Support's typed reason is as typed.
    -   The teacher's copy is English, unchanged.

### CUJ 6: A Chinese browser opens Teach directly

-   **Given**: A first visit to the Teach portal in a `zh-SG` browser, with nothing stored.
-   **When**: The sign-in page loads.
-   **Then**:
    -   `<html lang>` is `zh` before first paint.
    -   Translated Teach pages show Chinese, and untranslated ones stay English.
    -   The Preferences picker shows "Follow device" as selected.

### CUJ 7: A `?lang` link sets Teach's language once

-   **Given**: An English browser that has never opened Teach.
-   **When**: It opens `TEACH_URL/?lang=zh`, and later opens Teach again without the parameter.
-   **Then**:
    -   Teach shows its translated pages in Chinese.
    -   The address bar no longer shows `lang`.
    -   `elevate.preferences.locale` is `zh` on the Teach site, so the second visit is also in
        Chinese.
    -   Opening `TEACH_URL/?lang=en` afterwards changes nothing, because a language is now
        stored.

## Technical Plan (Architecture)

### Terms

-   **Portals:** Elevate has three. The learner app serves learners, and is the subject of this
    design. Teach serves teachers and the members of a teaching profile. Support serves Elevate
    staff.
-   **`@elevate/web-ui`:** the shared React component package of the two web portals (Teach and
    Support). The learner app doesn't use it. `TEACH_URL` is the Teach portal's base URL.
-   **Area:** one named slice of the `@elevate/i18n` message catalog, kept as two files,
    `areas/<area>.en.ts` and `areas/<area>.zh.ts`. Examples are `chrome`, `domain` and `ui`.
    `translate`, `createTranslator`, `localeNames` (each language's name in its own script) and
    `intlLocale` (`zh` → `zh-SG`) are its helpers.
-   **Audience:** the field on a sign-in request and session that names the portal, `learner`,
    `teach` or `support`.
-   **The sign-in email:** one email holds both a six-digit code, typed into the app, and a
    link, which opens `/verify` in a browser. One `magic_links` row backs both.
    -   "The sign-in request" is `POST /auth/magic-link` (`AuthService.requestMagicLink`).
    -   "Verify" is `POST /auth/verify` (`AuthService.verify`), sent with either the code or the
        link's token.
-   **Home and Explore** are the same screen, the first tab (`(tabs)/index.tsx`).

### Decisions made while drafting

1.  **A stored `en` counts as a choice.** `locale` gains a `system` value, which is the new
    default. Anything already stored keeps its value.
2.  **A chosen language beats a guessed one, and the account records which it holds.**
    `users.locale_chosen` says whether the account's language was picked by a person.
    -   A device's choice overwrites the account.
    -   A device's guess only fills an account that is empty or itself guessed.
    -   Nothing copies the account's language into device storage. The resolver reads it
        directly.
3.  **Teach and Support guess from the browser too.** They resolve `system` from
    `navigator.languages`, and their picker offers "Follow device".
4.  **Teach and Support accept `?lang` now.** The learner-side banner that sends the link is
    the Teach banner design's job.
5.  **Certificates:** the in-app certificate screen and the public `/c/[token]` page are
    translated in the viewer's language. The PDF stays an English document of record.
6.  **Traditional Chinese devices get the Simplified catalog.** Any device language whose primary
    subtag is `zh` resolves to `zh`.
7.  **The sign-in code email follows the request,** not the account, because the account may not
    exist yet when the code is asked for.
8.  **One `users.locale` column, not a preferences column.** Chosen when the Technical Plan was
    approved; the brief had left it open.
9.  **The whole learner app in one release.** The brief's decision 2 settled this; the brief's
    "purchase path first" option is closed.

### Data flow

```text
                 device storage (per origin / per install)
                 elevate.preferences = { theme, locale: system|en|zh }
                              |
  account (AuthUser.locale    |      ?lang (web: read once per tab, never stored)
  when localeChosen) ---+     |     +----
  device languages -----+     v     |
                 resolveLocale(stored, account, param, device)  -->  UI language (en|zh)
                              |
   sign-in request { email, audience, locale }   -> code email in `locale ?? en`,
                              |                     link gets &lang=<locale> only if sent
   verify { code|token, locale, localeChosen }   -> chosen:  users.locale, locale_chosen := locale, true
                              |                     guessed: same, only if empty or not chosen
   press on English / 中文    -> PATCH /me { locale, localeChosen: true }
   press on Follow device     -> PATCH /me { localeChosen: false }
   first refresh, account empty -> PATCH /me { locale: <resolved>, localeChosen: false } (once)
                              v
                 users.locale -> receipt, certificate, refund emails
   checkout start { promoCode?, locale: <resolved> } -> Stripe `locale`, session metadata,
                 &lang on return URLs, checkout_started / checkout_completed `locale`
```

### The language preference

-   **The stored field.** In `packages/core/src/contracts/preferences.ts`, `locale` becomes
    `localePreferenceSchema = z.enum(['system', ...supportedLocales])` with `.default('system')`.
    -   `system` means "not chosen on this device". It resolves from the account, then
        `?lang`, then the device.
    -   `Locale` stays `'en' | 'zh'`: the language the UI and emails use.
    -   `parseStoredPreferences` already falls back per field, so old values (`en`, `zh`) parse
        unchanged. A missing or unknown value becomes `system`.
-   **One resolver.** `resolveLocale({ stored, account, param, deviceLanguages })` in core
    returns a `Locale`. It returns:
    1.  `stored`, when it is `en` or `zh`;
    2.  else `account`, when it is set: the signed-in user's `locale`, passed only when
        `localeChosen` is true;
    3.  else `param`, when it is a supported locale;
    4.  else `zh`, when the first device language's primary subtag (the part before `-`,
        lower-cased) is `zh`, which includes Traditional tags such as `zh-TW`;
    5.  else `en`.

    The learner app and web-ui import it. The three `preferences-init.js` scripts (learner,
    Teach, Support) copy the device rule, because a classic script can't import.
-   **`?lang` on the learner web app is never stored.**
    -   It's read once from `window.location` when the app first mounts in a tab, from whatever
        page the tab opened on.
    -   It's held in memory until the app next loads, so it survives in-app navigation and
        redirects, such as a signed-out visitor on a protected route being sent to Explore. A
        reload after the address has lost `?lang` falls back to the device.
    -   A stored choice and a chosen account language both beat it.
    -   The native app takes no `?lang`: the emailed links and Stripe's return URLs are web
        pages, and the app claims no web links.

### Reading the device language

-   **Web:** `navigator.languages`, read synchronously.
    -   The learner web app gets a pre-paint script (`apps/learner/public/preferences-init.js`).
        It sets `<html lang>` before paint, replacing today's hard-coded `lang="en"`, which the
        app fixes only after mount.
    -   Unlike Teach's script, it never stores `?lang`.
-   **Native:** `expo-localization`, read as `getLocales()[0].languageTag`. Its `useLocales()`
    hook re-renders when the phone's language changes, which matters only while the stored value
    is `system`.
    -   `expo-localization` is a native module, so this ships in a new store build.
    -   Hermes' `Intl` default locale was not chosen, because on iOS it follows the region
        format, not the language list.

### The language on the server

-   **Columns.** One migration adds, on `users`:
    -   `locale`, a nullable column typed by a new `locale` Postgres enum (`en`, `zh`);
    -   `locale_chosen boolean not null default false`.

    `magic_links` is unchanged.
-   **Contract changes** (all fields optional, so clients that send none behave as today):
    -   `magicLinkRequestSchema` adds `locale`.
    -   Both branches of `verifyRequestSchema` add `locale` and `localeChosen`, describing the
        device doing the verifying.
    -   `updateMeSchema` adds `locale` and `localeChosen`.
    -   `checkoutRequestSchema` adds `locale`.
    -   `AuthUser` adds `locale: Locale | null` and `localeChosen: boolean`.
-   **At verify** (`AuthService.verify`), after `findOrCreateUser` and before `buildAuthUser`,
    when the request has a `locale`:
    -   `localeChosen: true` sets `users.locale = locale, locale_chosen = true`;
    -   otherwise it sets `users.locale = locale, locale_chosen = false`, only
        `WHERE locale IS NULL OR locale_chosen = false`.
-   **Writes from the learner app.** It sends `PATCH /me` in three cases only, and never from an
    effect that watches the stored language:
    -   **A press on `English` or `中文`** while signed in sends `{ locale, localeChosen: true }`.
    -   **A press on "Follow device"** sends `{ localeChosen: false }`, so other devices stop
        following the account. The stored value still sets the email language.
    -   **Once after launch**, when preferences are loaded, the user is signed in and
        `user.locale` is null, it sends `{ locale: <resolved>, localeChosen: false }`. This fills
        accounts signed in before this release. It never overwrites a value, so devices can't
        flip the account.

    The response is `{ user }`, and the session replaces its cached user with it. A failure,
    including offline, is ignored: the device still shows the chosen language, and nothing is
    retried.

### Emails in the learner's language

-   **The email area.** A new `email` area in `@elevate/i18n` (`email.en.ts`, `email.zh.ts`)
    holds every sentence of the learner emails, plus the shared footer.
    -   Each message is a whole sentence with `{placeholders}`, following ADR 008.
    -   The English messages reproduce today's text word for word, because existing tests match
        it.
    -   `apps/api` gains a dependency on `@elevate/i18n`.
-   **Templates.** In `apps/api/src/emails/templates.ts`:
    -   `layout` takes a `locale`, sets `<html lang>` and translates the footer.
    -   `magicLinkEmail` takes a `locale`.
    -   `simpleEmail` takes an optional `locale`, defaulting to `en`, so every Teach, Support and
        teacher email is unchanged.

    Typed text (course titles, teacher names, Support's refund reason) is passed as placeholder
    values. Values inserted into HTML go through `para()` or `escapeHtml`, as AGENTS.md
    requires. The subject and the text part are plain text.
-   **Which language each email uses:**

    | Email                   | Sent from                                | Language                          |
    | ----------------------- | ---------------------------------------- | --------------------------------- |
    | Sign-in code            | `AuthService.requestMagicLink`           | the request's `locale`, else `en` |
    | Receipt                 | `PaymentsService` (Stripe webhook)       | `enrollment.user.locale ?? 'en'`  |
    | Certificate             | `CertificatesService.issueForEnrollment` | `enrollment.user.locale ?? 'en'`  |
    | Refund (learner copy)   | `TransactionsService.sendRefundNotices`  | `p.user.locale ?? 'en'`           |
    | Second payment refunded | `PaymentsService.refundDuplicate`        | `enrollment.user.locale ?? 'en'`  |

    The teacher's copy of the refund email stays English.
-   **A refund made in the Stripe dashboard** is recorded with the system reason
    `'Refunded in Stripe'`. The learner's email shows `email.refund.reasonStripe` in its place.
    The stored value doesn't change.
-   **The sign-in link** gains `&lang=<locale>` only when the request sent a `locale`, so the
    browser it opens shows `/verify` in that language. Teach and Support send none, so their
    links carry no `lang`.

### Checkout

-   **The language on screen travels with checkout.** The learner app sends its resolved
    language as `locale` when it starts checkout. `PaymentsService` then:
    -   passes it to Stripe (`checkout.sessions.create({ locale: 'zh' | 'en' })`). Stripe's
        Checkout Session type lists `'zh'` (Simplified), `'zh-HK'` and `'zh-TW'`;
    -   writes it into the session's `metadata`, leaving the key out when no `locale` was sent;
    -   appends `&lang=<locale>` to the success and cancel URLs, which already have a query
        string;
    -   makes it part of the idempotency key (`checkoutIdempotencyKey` appends the locale, or
        `none` when unset), so a retry after a switch opens a new Stripe session instead of
        reusing one with other parameters.
-   **Native hand-offs.** The native "enrol on the web" and "continue on the web" links
    (`course/[slug].tsx:86`, `checkout/[courseId].tsx:100`) append `?lang=<resolved locale>`.
    The system browser has its own storage, so without this it would guess.

### The learner app's text

-   **Every hard-coded string moves to the catalog.** That covers each route under
    `apps/learner/src/app`, the components in `src/components` and `src/ui`, and accessibility
    labels and placeholders. They go into new learner areas:

    | Area                 | Screens and components                                                                                                                             |
    | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
    | `learnerCommon`      | the switcher, error sentences, durations, the "Free" price label, the list separator, `EmptyState`, `RootError`, `+not-found`                      |
    | `learnerExplore`     | Explore (the home tab)                                                                                                                             |
    | `learnerAuth`        | sign-in and verify                                                                                                                                 |
    | `learnerCourse`      | course detail and the course card                                                                                                                  |
    | `learnerCheckout`    | checkout and its success page                                                                                                                      |
    | `learnerLearn`       | the course overview (`learn/[enrollmentId]/index.tsx`), the lesson player and its `media/*` components, `QuizRunner`, `Trail` and the learning tab |
    | `learnerCertificate` | the in-app certificate screen, `CertificateCard` and the public `/c/[token]` page                                                                  |

    The certificate PDF stays English. Plurals use two keys, enum labels use the stored value as
    the key, and sentences with links use `{slot}`, as ADR 008 sets out.
-   **Category labels.** These become `category.<slug>` keys in the `domain` area.
    -   A learner helper, `categoryKey(slug)`, returns the key only for a slug in
        `COURSE_CATEGORIES`, because the contracts type the category as `string`.
    -   For an unknown slug, the app shows `categoryLabel(slug)`, the English label or the raw
        slug, as today.
-   **Formatting.** `lib/format.ts` takes the locale or translator:
    -   dates go through `Intl` with `intlLocale(locale)`;
    -   durations become keys for minutes, hours, and hours with minutes;
    -   lists join with `learnerCommon.list.separator` (`, ` in English and `、` in Chinese);
    -   money still goes through `formatSgd`, since `S$` is the same in both languages. Its
        English "Free" (`showFree`) is replaced at the learner call sites by
        `learnerCommon.price.free`.
-   **Errors.** A learner `useErrorMessage()` in `lib/api-error.ts` mirrors web-ui's.
    -   It shows the API's message as it is, and the two sentences the client words itself (no
        connection, unknown failure) from the catalog.
    -   A response with no message no longer gets the English `'Something went wrong'` built in;
        the translated generic sentence is used.
    -   Screens store the error object and word it when they render, so a language switch
        rewords a shown error.
-   **The switcher.** A new `LanguageSwitch` shows `English` and `中文`, each from
    `localeNames` in its own script, as `role="radio"` chips in a labelled `radiogroup`. Its
    selected chip is the resolved language. It sits in two places:
    -   on Explore, in a row above the search field, which stays visible while searching;
    -   on sign-in, directly under the logo and outside both cards, so it shows on the email and
        the code steps.

    Profile keeps its own language row of three chips: `English`, `中文` and "Follow device"
    (`prefs.language.system`). Its selected chip is the stored value, so "Follow device" can
    show as selected.

    A press in either control changes the device's stored value and, when signed in, sends
    `PATCH /me` ([The language on the server](#the-language-on-the-server)). The sign-in screen's state (typed email,
    code step) survives the switch.
-   **`RootError`** is the router's root error boundary and renders outside the app's
    providers. It wraps its content in its own `PreferencesProvider`, which gives it both the
    translator and the theme that its `ThemeProvider` needs. On native it renders with the
    defaults until the storage read finishes.

### Teach and Support

-   **Teach and Support resolve `system` too.** web-ui's `PreferencesProvider` resolves the
    language with `resolveLocale` and `navigator.languages`. Teach and Support have no account
    input yet. Both `preferences-init.js` copies (Teach and Support, still identical) resolve
    `system` or a missing value the same way before paint.
-   **The picker.** `PreferenceRows` gains a "Follow device" option, from the same
    `prefs.language.system` key as the learner app. A stored `en` or `zh` in those portals is
    unchanged.
-   **The `?lang` hand-off.** Both `preferences-init.js` copies read `?lang` before paint. When
    it is a supported locale and the stored `locale` is `system` or missing, the script writes it
    into `elevate.preferences` (keeping the stored theme) and sets `<html lang>`. Either way, it
    then removes `lang` from the address bar with `history.replaceState`, keeping
    `location.hash`. web-ui's provider then reads the saved value like any stored choice, and
    needs no `?lang` code of its own.
-   **Why Teach stores `?lang` and the learner app doesn't.**
    -   **Teach:** the parameter arrives once, from the banner, on a site that has no language
        of its own yet. Storing it keeps the language after Teach's own redirects and sign-in.
    -   **The learner app:** `?lang` arrives on every sign-in and checkout link, so storing it
        would turn a guess into a lasting choice.

    In both, a language already stored is never overwritten.
-   **Nothing sends Teach a `?lang` yet.** Until the Teach banner design ships, a link like
    `TEACH_URL/?lang=zh` can be typed or shared by hand.

### Measurement

-   **The events.** Each of these gets a `locale` property, which is `null` when it's unknown:
    -   `sign_in`, sent from verify after the Support access check, with the verify request's
        `locale`. `sign_in` is defined in `ANALYTICS_EVENTS`, but nothing sends it today.
    -   `checkout_started`, with the checkout request's `locale`.
    -   `checkout_completed`, on the webhook and `sync` paths from the session's
        `metadata.locale`, and on the free path from the checkout request's `locale`.

    No client event endpoint is added.

### Records and rules

-   **A new ADR.** `docs/adr/010-locale-resolution-and-email-language.md` records:
    -   the order of precedence;
    -   `system`;
    -   `users.locale` and `locale_chosen`;
    -   the chosen-or-guessed rule at verify;
    -   the press-only writes and the single fill-in;
    -   the learner emails' languages;
    -   API error messages staying English;
    -   certificate PDFs staying English;
    -   Teach and Support resolving `system` from the browser;
    -   the `?lang` hand-off, stored in Teach and Support only when nothing is stored.
-   **ADR 008** gets three pointers: "Not synced to the account" is amended by ADR 010;
    learner emails are amended by ADR 010, while API error messages still stay English; and the
    learner app joins "Translated today".
-   **AGENTS.md** gains a "Learner emails" rule, and its "Translated pages" rule extends to the
    whole learner app.

## Risks & Mitigations

### Risks

| Risk                                                           | What goes wrong                                                                                                                                              | Mitigation or accepted cost                                                                                                                                                                                                                                                             |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **The Chinese text is wrong or unreviewed**                    | Payment, refund and sign-in wording that misleads, or reads as machine-made, on the screens and emails where learners decide to pay.                         | The text is drafted in the house style, reviewed independently and signed off by the author (item 50, [Question 3](#open-questions)). PR 2 and PR 3 don't merge without that sign-off.                                                                                                  |
| **English literals are left in the app**                       | A screen shows English in a Chinese app. The catalog parity test can't find a literal that never became a key.                                               | The manual Goal 1 audit before PR 3 merges, recorded in the PR. The AGENTS.md "Translated pages" rule covers new strings. After launch, nothing automatic catches a new literal; a lint rule is a [future improvement](#future-improvements).                                           |
| **The pre-paint scripts drift from `resolveLocale`**           | There are three hand-copied scripts (learner, Teach, Support), because a classic script can't import. A changed device rule in core would leave them behind. | They copy only the one-line device rule. Each names `resolveLocale` in a comment, and the Teach and Support copies stay identical, as today. A drifted script only sets `<html lang>` wrongly until the provider mounts and corrects it.                                                |
| **A sign-in email in a language the owner didn't pick**        | Anyone can ask for a sign-in email for any address with `locale: 'zh'`. The owner may take it for phishing.                                                  | The sign-in request's rate limit (30 per 15 minutes) bounds it, as for English requests today. The request can't mark the language as chosen: only the verifying device can, so using the link at most fills an empty or guessed account.                                               |
| **A crafted `?lang` link**                                     | A link sets someone's Teach or Support language.                                                                                                             | Only `en` and `zh` are accepted, nothing else from the URL is used, and the parameter is removed from the address bar. It is stored only when nothing is stored, or when the stored value is "Follow device". That last case overwrites a deliberate "Follow device"; this is accepted. |
| **Two devices disagree**                                       | A press on one device sets the account. The other device keeps its own stored choice, so the app and the emails can be in different languages.               | Accepted: the emails follow the most recent press on any device. Writes happen only on a press, or once to fill an empty account, so ordinary use never flips the account.                                                                                                              |
| **Chinese text in email clients**                              | Missing characters or a mis-guessed encoding.                                                                                                                | `layout` declares UTF-8 (item 35), and the font stacks end in generic families, so clients fall back to a system CJK font. PR 2 is checked by hand in Gmail web, Apple Mail and Outlook.                                                                                                |
| **`<html lang="zh">` on untranslated Teach and Support pages** | Screen readers read English text with a Chinese voice, and font fallback changes.                                                                            | Accepted with [Alternative G](#alternative-g-teach-and-support-treat-system-as-english). It goes away as those pages are translated.                                                                                                                                                    |
| **Stripe's own receipt stays English**                         | The Stripe receipt page (`receipt_url`) and any receipt Stripe sends follow the Stripe Customer's `preferred_locales`, which Elevate doesn't set.            | A known limitation. Elevate's own receipt email is translated.                                                                                                                                                                                                                          |
| **Adding a language later**                                    | `locale` is a Postgres enum.                                                                                                                                 | Adding a language means a migration as well as a catalog. Item 8 makes typecheck fail until the Drizzle enum matches `supportedLocales`.                                                                                                                                                |

### Rollout and rollback

-   **The migration is additive:** two columns and a new enum. An API rollback leaves the
    columns unused.
-   **Older clients keep working.** Older native builds send no `locale`, so their users get
    English emails unless another device set the account. Older stored preferences parse.
-   **There is no feature flag** ([`docs/spec.md`](../spec.md) puts flags out of scope).
-   **What each revert turns off:**

    | Revert                | Turns off                                                                                | Stays on                                                                                                                 |
    | --------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
    | Learner web           | the Chinese learner web app, the switcher and the browser guess                          | Chinese emails and Chinese Stripe pages for accounts whose `users.locale` is `zh`; Teach and Support behaviour           |
    | Teach and Support web | "Follow device", the browser guess and the `?lang` hand-off there                        | everything in the learner app and the API                                                                                |
    | API                   | Chinese emails, Stripe `locale`, the `&lang` return URLs and the `locale` event property | the clients' translated text. Clients still send `locale`, and the older API ignores it, because zod drops unknown keys. |
    | Native                | needs a store build, as with any native change                                           | —                                                                                                                        |

-   **A rollback is lossy in one way.** Code from before this release parses a stored `system`
    as unknown and falls back to its default, `en`, then writes that back. A device that hasn't
    chosen is then pinned to English until its user switches. This is accepted: shipping
    tolerance for `system` in an earlier release would cost a release for a case that needs a
    rollback to happen at all.
-   **An open tab can do the same during a deploy.** A Teach or Support tab still running the old
    bundle reads another tab's newly stored `system` through the `storage` event, falls back to
    `en` and writes that back, until it reloads. This is accepted for the same reason.

## Alternatives Considered

### Alternative A: Read the language from the `Accept-Language` header

-   **Pros**:
    -   No new column, and no contract change.
    -   Every browser and native HTTP client already sends the header.
-   **Cons**:
    -   Three of the four learner emails are sent with no learner request: the receipt from the
        Stripe webhook, the certificate on completion, and the refund triggered from Support.
        There is no header to read for them.
    -   The header reports the device's language, not the learner's choice in the app.
-   **Reason for Rejection**: Rejected in the brainstorm review ([the brief](learner-main-page-improvements.md#alternatives-weighed)): three of the
    four emails have no request, so the header can't decide their language.

### Alternative B: Send the language on every API request and write it to the user row

-   **Pros**:
    -   The account always matches the device the learner used last.
    -   No separate `PATCH /me` call on a switch.
-   **Cons**:
    -   It writes to the database on every authenticated request, or needs a compare-then-write
        on each one.
    -   Two devices in different languages flip the account back and forth with ordinary use,
        not only when someone switches.
-   **Reason for Rejection**: Rejected in the brainstorm review ([the brief](learner-main-page-improvements.md#alternatives-weighed)): a database write
    per request, and the account changes without anyone choosing anything.

### Alternative C: A `users.preferences` JSON column (the route ADR 008 sketches)

-   **Pros**:
    -   It is already written down in ADR 008.
    -   It would also sync theme across devices.
-   **Cons**:
    -   The learner app, Teach and Support would share one account-level value. A theme or
        language picked in Teach would overwrite the learner app's.
    -   The server only needs the language, and only for emails, Stripe Checkout and analytics.
-   **Reason for Rejection**: Rejected by author ([drafting decision 8](#decisions-made-while-drafting)): the coupling
    between portals costs more than syncing theme is worth, and the server needs only the
    language.

### Alternative D: Treat existing stored `en` as "not chosen" (a device-side "chosen" flag)

-   **Pros**:
    -   Chinese-reading users who installed before launch get Chinese without finding the
        switcher.
-   **Cons**:
    -   Someone who deliberately picked English on a Chinese-language device is switched once
        and has to switch back.
    -   It adds a second field that every reader of preferences must check.
-   **Reason for Rejection**: Rejected by author ([drafting decision 1](#decisions-made-while-drafting)): switching
    someone who deliberately chose English is worse than leaving a pre-launch install in English
    until its user finds the switcher.

### Alternative E: Ask existing installs once ("Switch to 中文?")

-   **Pros**:
    -   It reaches pre-launch installs on Chinese devices without switching anyone silently.
-   **Cons**:
    -   One more piece of UI, with its own "dismissed" state.
    -   If dismissed, it never appears again.
-   **Reason for Rejection**: Rejected by author ([drafting decision 1](#decisions-made-while-drafting)): a one-time
    prompt adds UI and state to reach the same people the Explore switcher already reaches, and
    it is lost for good once dismissed.

### Alternative F: At sign-in, the device always wins, or the account always wins

-   **Pros**:
    -   One rule with no extra field on the sign-in request.
-   **Cons**:
    -   **Device always wins:** an account set to Chinese that signs in on an en-SG phone, which
        guessed English, flips to English. Receipts then switch language without the learner
        knowing.
    -   **Account always wins:** someone who picked English on this device just before signing
        in is switched to the account's Chinese.
-   **Reason for Rejection**: Rejected by author ([drafting decision 2](#decisions-made-while-drafting)): each simple
    rule loses a language someone chose. "A choice beats a guess" avoids both failures for one
    boolean on the verify request and one column on `users` (`locale_chosen`).

### Alternative G: Teach and Support treat `system` as English

-   **Pros**:
    -   Teach and Support behave exactly as today, and the design stays about the learner app.
-   **Cons**:
    -   The three portals disagree about the same stored value.
    -   A Chinese-browser visitor who goes straight to Teach gets English.
-   **Reason for Rejection**: Rejected by author ([drafting decision 3](#decisions-made-while-drafting)): one meaning for
    a stored value across three portals is worth the accepted costs. Untranslated Teach pages stay
    English for those visitors, and carry `<html lang="zh">` until they are translated.

### Alternative H: Use Hermes' built-in `Intl` for the phone's language, not `expo-localization`

-   **Pros**:
    -   No new native module, so phones could guess without a new store build.
-   **Cons**:
    -   On iOS, the default `Intl` locale follows the region-format setting, not the preferred
        language list. A phone with English region formats and Chinese as its language would
        guess English.
    -   It has no change event when the phone's language changes.
-   **Reason for Rejection**: Wrong answers on iOS outweigh saving one store build.
    `expo-localization` is the SDK 58 module for this, and installs with `npx expo install`.

### Alternative I: Translate API error messages

-   **Pros**:
    -   Server-side validation and sign-in errors, such as "That code is not right", would
        appear in Chinese.
-   **Cons**:
    -   Either the API takes a language on every request and translates, or the client maps
        every error `code` to a message. Both touch every handler and keep growing.
-   **Reason for Rejection**: Rejected by author ([the brief's decision 8](learner-main-page-improvements.md#key-decisions--staging-for-next-steps)): the
    cost touches every handler and grows with each new error, while the screens that decide a
    sign-up show few API errors. The app translates only the two sentences it words itself.

### Alternative J: Translate only the purchase path first

-   **Pros**:
    -   A smaller first release: Explore, course detail, sign-in, verify, checkout, and the
        sign-in email.
    -   It reaches the screens that decide a sign-up sooner.
-   **Cons**:
    -   A learner who buys meets English in the lesson player, quiz, certificate and other
        emails right after paying.
-   **Reason for Rejection**: Rejected by author ([the brief's decision 2](learner-main-page-improvements.md#key-decisions--staging-for-next-steps); drafting
    decision 9): an English lesson player and English emails straight after paying would undo
    the trust the translated purchase path built.

### Alternative K: Machine-translate teacher-written course text

-   **Pros**:
    -   A Chinese reader could read course titles and descriptions.
-   **Cons**:
    -   Teachers didn't write or check the translation, and learners pay on the strength of
        that text.
    -   It needs a translation service and a cache, and needs re-translating on every approved
        edit.
-   **Reason for Rejection**: Rejected by author ([the brief's decision 2](learner-main-page-improvements.md#key-decisions--staging-for-next-steps)): learners
    would pay on text nobody wrote or checked. Multi-language course content is a later feature,
    written by teachers.

### Alternative L: Leave certificates fully English, or translate the PDF too

-   **Pros**:
    -   **Fully English:** no work on the certificate screens at all.
    -   **Translated PDF:** the learner's document matches their language.
-   **Cons**:
    -   **Fully English:** the in-app screen's buttons and labels stay English inside a Chinese
        app.
    -   **Translated PDF:** it needs a `certificates.locale` column fixed at issue time and a
        bundled CJK font, which makes the API image larger. It also needs wrapping that breaks
        between CJK characters, since `wrap()` splits only on spaces.
-   **Reason for Rejection**: Rejected by author ([drafting decision 5](#decisions-made-while-drafting)): translating the
    screens costs only catalog keys, while a translated PDF needs a column, a font and new
    wrapping. The PDF stays an English document of record.

### Alternative M: Send Traditional Chinese devices to English

-   **Pros**:
    -   Traditional readers from Taiwan or Hong Kong aren't shown a script that isn't theirs.
-   **Cons**:
    -   A Traditional reader who reads Simplified more easily than English lands in English and
        has to find the switcher.
-   **Reason for Rejection**: Rejected by author ([drafting decision 6](#decisions-made-while-drafting)): most
    Traditional readers can read Simplified, and English is the worse fallback for them. A
    Traditional catalog is a [future improvement](#future-improvements).

### Alternative N: Use the first Chinese language anywhere in the device's list

-   **Pros**:
    -   An `en-SG` phone with Chinese as its second language, common in Singapore, would start
        in Chinese.
-   **Cons**:
    -   Someone who put English first chose English first. Many bilingual readers add Chinese
        second for input or for other apps, not for app text.
    -   Browsers and phones fill the list differently, so the same person could get different
        languages on web and native.
-   **Reason for Rejection**: The first preferred language is the person's own ranking, and the
    switcher sits on the first screen for anyone it gets wrong.

---

## Additional Resources

-   [learner-main-page-improvements.md](learner-main-page-improvements.md): the brief and Goldfish
    review this design comes from.
-   [ADR 008](../adr/008-theming-preferences-i18n.md): theming, preferences and the i18n catalog
    patterns this design follows and amends.
-   [AGENTS.md](../../AGENTS.md): the rules on translated pages, `simpleEmail` and migrations.

## Future Improvements

-   **A course language field:** set by the teacher, shown as a chip and usable as a filter
    ([Question 1](#open-questions)).
-   **A Traditional Chinese catalog** for `zh-Hant` devices.
-   **Translated certificate PDFs:** a language fixed at issue time, a bundled CJK font, and
    wrapping that breaks between CJK characters.
-   **Client analytics events** for impressions and switcher use, if server events prove too
    coarse.
-   **A lint rule or render test that finds English literals** in learner screens, replacing the
    manual Goal 1 audit for new code.

---

## Detailed Implementation Plan

The work lands in four pull requests, in order. Each passes `npm run lint` and
`npx turbo run typecheck test` on its own.

1.  **PR 1: language plumbing.**
    -   **What it contains:**
        -   contracts, the resolver and the migration;
        -   the API rules for sign-in, `/me` and checkout;
        -   the provider and init-script wiring that keeps every consumer typechecking;
        -   ADR 010.
    -   **What changes for users:**
        -   the learner app sends `locale` with the sign-in request, verify and checkout, and
            `localeChosen` with verify;
        -   a language press while signed in sends `PATCH /me`, and the one fill-in runs for
            accounts with no language;
        -   learner web guesses the language from the browser, and the Stripe page and return
            URLs follow it;
        -   Teach and Support resolve `system` from the browser;
        -   a "Follow device" option appears in the learner Profile and in the Teach and Support
            Preferences picker.
    -   **Text:** it adds one message, `prefs.language.system`, in both languages. The emails
        stay English until PR 2.
2.  **PR 2: emails.**
3.  **PR 3: the learner app's text, switcher and device languages.**
4.  **PR 4: the Teach and Support `?lang` hand-off.**

**Release order:**

-   PR 1's API deploys before or with its web builds.
-   No native store build ships before PR 3, because native has no device languages until then.
-   PR 3's native build needs PR 1's API in production.
-   PR 3 doesn't depend on PR 2.

### Target Files to Create/Modify

All learner paths below are relative to `apps/learner/src/` unless they start with `apps/`.

#### PR 1: language plumbing

##### 1. Preferences contract

-   **Files**: `packages/core/src/contracts/preferences.ts` (Modify).
-   **Type / Scope**: zod contract.
-   **Proposed Changes**:
    -   Add `localePreferenceSchema = z.enum(['system', ...supportedLocales])` and the type
        `LocalePreference`.
    -   `preferencesSchema.locale` becomes `localePreferenceSchema.default('system')`.
    -   Keep `localeSchema` and `Locale` (`'en' | 'zh'`) for resolved values.
    -   Update the header comment: `system` means "not chosen on this device; resolved from the
        account, `?lang`, then the device".

##### 2. The resolver

-   **Files**: `packages/core/src/domain/locale.ts` (Create).
-   **Type / Scope**: pure domain function.
-   **Proposed Changes**:
    -   `resolveLocale` has this signature:

        ```ts
        resolveLocale(input: {
          stored: LocalePreference
          account?: Locale | null
          param?: string | null
          deviceLanguages: readonly string[]
        }): Locale
        ```

        It:
        -   returns `stored` when it is `en` or `zh`;
        -   else returns `account` when it is set;
        -   else returns `param` when `localeSchema` accepts it;
        -   else returns `zh` when the first device language's primary subtag, lower-cased, is
            `zh`;
        -   else returns `en`.
    -   `isChosen(stored: LocalePreference): boolean` is true for `en` and `zh`.

##### 3. Domain barrel

-   **Files**: `packages/core/src/domain/index.ts` (Modify).
-   **Type / Scope**: barrel.
-   **Proposed Changes**: add `export * from './locale'`. `localePreferenceSchema` is already
    exported through `contracts/index.ts`.

##### 4. Auth contracts

-   **Files**: `packages/core/src/contracts/auth.ts` (Modify).
-   **Type / Scope**: zod contract.
-   **Proposed Changes**:
    -   `magicLinkRequestSchema` adds `locale: localeSchema.optional()`.
    -   Both branches of `verifyRequestSchema` add `locale: localeSchema.optional()` and
        `localeChosen: z.boolean().optional()`.
    -   `updateMeSchema` adds `locale: localeSchema.optional()` and
        `localeChosen: z.boolean().optional()`.
    -   `AuthUser` adds `locale: Locale | null` and `localeChosen: boolean`.

##### 5. Checkout contract

-   **Files**: `packages/core/src/contracts/checkout.ts` (Modify).
-   **Type / Scope**: zod contract.
-   **Proposed Changes**: `checkoutRequestSchema` adds `locale: localeSchema.optional()`.

##### 6. Preferences test

-   **Files**: `packages/core/test/preferences.test.ts` (Modify).
-   **Type / Scope**: unit test (vitest).
-   **Proposed Changes**:
    -   `{}` parses to `locale: 'system'`.
    -   A stored `en` or `zh` parses unchanged.
    -   The existing `'klingon'` case (lines 41–44) now expects `'system'` instead of `'en'`.

##### 7. Resolver test

-   **Files**: `packages/core/test/locale.test.ts` (Create).
-   **Type / Scope**: unit test (vitest).
-   **Proposed Changes**: a table of cases for `resolveLocale`:
    -   **A stored choice wins.** Chosen `en` with `account: 'zh'`, `param: 'zh'` and a `zh`
        device gives `en`.
    -   **The account comes next.** `system` with `account: 'zh'` on an English device with
        `param: 'en'` gives `zh`.
    -   **The device rule.** `system` with no account:
        -   `['zh-TW']`, `['zh-Hant-HK']`, `['zh']` and `['zh-SG', 'en']` give `zh`;
        -   `['en-SG', 'zh-CN']` gives `en`, because only the first language counts;
        -   `[]` gives `en`.
    -   **`param`.** `param: 'zh'` wins over an English device, and an invalid `param` is
        ignored.
    -   **`isChosen`.** It is true for `en` and `zh`, and false for `system`.

##### 8. Locale enum

-   **Files**: `packages/db/src/schema/enums.ts` (Modify).
-   **Type / Scope**: Drizzle schema.
-   **Proposed Changes**:
    -   Add `localeEnum = pgEnum('locale', ['en', 'zh'] as const satisfies typeof
        supportedLocales)`, with `supportedLocales` brought in by a type-only import from
        `@elevate/core`.
    -   The schema's runtime imports stay as they are, and adding a language to
        `supportedLocales` without adding it here fails typecheck. The Postgres enum changes
        when `npm run db:generate` emits a migration.

##### 9. Users columns

-   **Files**: `packages/db/src/schema/auth.ts` (Modify).
-   **Type / Scope**: Drizzle schema.
-   **Proposed Changes**: `users.locale: localeEnum()` (nullable) and
    `users.localeChosen: boolean().notNull().default(false)`. `magicLinks` is unchanged.

##### 10. Migration

-   **Files**: `packages/db/drizzle/<timestamp>_user_locale/` (Create): `migration.sql` and
    `snapshot.json`.
-   **Type / Scope**: migration.
-   **Proposed Changes**: generated with `npm run db:generate -- --name user_locale`. It contains
    `CREATE TYPE locale` and two `ALTER TABLE users ADD COLUMN` statements.

##### 11. Sign-in and verify

-   **Files**: `apps/api/src/services/auth.service.ts` (Modify).
-   **Type / Scope**: API service.
-   **Proposed Changes**:
    -   **`requestMagicLink`:** when `input.locale` is set, add `&lang=<input.locale>` to the
        emailed URL. Otherwise add nothing. The email's own language changes in PR 2.
    -   **`verify`:** between `findOrCreateUser` and `buildAuthUser`, when `input.locale` is
        set:
        -   if `input.localeChosen` is true, update `users` to
            `{ locale: input.locale, localeChosen: true }` where `eq(users.id, user.id)`;
        -   otherwise, update `users` to `{ locale: input.locale, localeChosen: false }` where
            `and(eq(users.id, user.id), or(isNull(users.locale), eq(users.localeChosen,
            false)))`.
    -   **The `sign_in` event:** after the Support access check, call:

        ```ts
        trackEvent(this.deps, {
          userId: user.id,
          name: ANALYTICS_EVENTS.signIn,
          properties: { audience: link.audience, locale: input.locale ?? null },
        })
        ```

    -   **`buildAuthUser`:** return `locale: user.locale` and `localeChosen: user.localeChosen`.
        It reads the row after the update, so the response carries the new values.

##### 12. `PATCH /me`

-   **Files**: `apps/api/src/routes/me.ts` (Modify).
-   **Type / Scope**: Hono route.
-   **Proposed Changes**:
    -   `PATCH /me` copies `body.locale` and `body.localeChosen` into the patch when present.
    -   It still returns `{ user }` (the rebuilt `AuthUser`, now with `locale` and
        `localeChosen`), with status 200.

##### 13. Payments provider types

-   **Files**: `apps/api/src/providers/payments/types.ts` (Modify).
-   **Type / Scope**: provider interface.
-   **Proposed Changes**:
    -   `CheckoutSessionInput.locale?: Locale`.
    -   `checkoutIdempotencyKey`'s parameter gains `locale?: Locale` and `replacesSessionId?:
        string`. The key becomes
        `checkout:<enrollment>:<amount>:<payoutAccount>:<locale>:<replaced>`, each of the last two
        being `none` when unset. A retry after a language switch then makes a new Stripe session.
        The key only guards one start against a double submit: Stripe refuses a repeated key whose
        request differs (`expires_at` always does), and replays a closed session for one that
        matches. Naming the replaced session keeps restarts from repeating a key; when one still
        repeats (the enrolment points again at a session it once replaced, or a retry comes after
        30 minutes), the Stripe provider retries once with a fresh key (item 14). Reusing an open
        session on a later retry is the payments service's job (item 15).
    -   Both callers, `stripe.ts:114` and `fake.ts:133`, already pass the whole
        `CheckoutSessionInput`, so they pick up `locale` with no change.
    -   **`expireCheckoutSession(sessionId)`** closes an open session and returns it as it then
        is; a session that is no longer open (paid first, or expired) is left alone.
        `UnconfiguredPaymentsProvider` refuses it like the other methods.
    -   **`createRefund`** takes an optional `idempotencyKey`, so a retried refund returns the
        first one.

##### 14. Stripe provider

-   **Files**: `apps/api/src/providers/payments/stripe.ts` (Modify).
-   **Type / Scope**: Stripe provider.
-   **Proposed Changes**: pass `locale: input.locale` to `checkout.sessions.create` when set.
    When Stripe refuses the key with `StripeIdempotencyError`, `createCheckoutSession` tries once
    more with the key plus `:<time>`; other errors are thrown as before.
    `expireCheckoutSession` calls `checkout.sessions.expire`, treats Stripe's refusal (a session
    that is not open) as no error, and retrieves the session. `createRefund` passes
    `idempotencyKey` to `refunds.create`. `FakePaymentsProvider` (`fake.ts`) records `locale`
    from `...input` and, like Stripe, stores no metadata key whose value is empty; it gains an
    `expired` flag that `expireCheckoutSession` sets on an unpaid
    session, after which the session is not reused and cannot be paid, and it returns the first
    refund for a repeated `idempotencyKey`.

##### 15. Payments service

-   **Files**: `apps/api/src/services/payments.service.ts`,
    `apps/api/src/services/transactions.service.ts` and `apps/api/src/services/stripe-events.ts`
    (Modify).
-   **Type / Scope**: API service.
-   **Proposed Changes**:
    -   **The signature:** `startCheckout(user, courseId, { promoCode, locale })`, with both
        fields optional, replacing the positional `promoCode`.
    -   **Starting checkout:** put `locale` in the `CheckoutSessionInput` given to
        `payments.createCheckoutSession`. The provider builds the idempotency key from that
        input (item 13). Write it into the session `metadata`
        as `...(locale ? { locale } : {})`, so a missing locale leaves the key out rather than
        storing `''`.
    -   **Return URLs:** append `&lang=<locale>` to both `successUrl` and `cancelUrl`, when
        `locale` is set.
    -   **Reading it back:** `fulfilCheckout` reads
        `localeSchema.safeParse(m.locale).success ? m.locale : null`.
    -   **Starting again reads the session the enrolment points at.**
        -   Paid: that payment stands. It is fulfilled and the response is
            `{ kind: 'enrolled' }`; nothing new is opened.
        -   Open, with the same enrolment, payee, promo code, amount and locale in its metadata:
            the learner goes back to it.
        -   Otherwise a new session is opened, with `replacesSessionId` set to the old one, and
            the old one is closed with `expireCheckoutSession` before the enrolment is pointed at
            the new one. If the old one turns out paid by then, it is fulfilled, the new one is
            expired and the response is `enrolled`. A failure to close it is logged and checkout
            goes on; the bullets below catch a second payment. The free path closes the old
            session the same way before enrolling.
        -   The writes to the enrolment (back to `pending_payment`, the new pointer, or the free
            enrolment) apply only `WHERE status <> 'active'`. When none applies, a payment
            activated the enrolment meanwhile: the new session is expired and the response is
            `enrolled`.
    -   **An earlier session is still matched.** One paid before it could be closed is matched
        through its `metadata.enrollmentId`, and only when `metadata.userId` is that enrolment's
        learner. Without this, paying in the first tab took the money and enrolled nobody.
    -   **An enrolment is fulfilled once.** In one transaction, `fulfilCheckout` first locks the
        enrolment row `FOR UPDATE`, so fulfilments of one enrolment queue (locking after the
        insert deadlocks against the insert's foreign-key lock). It then inserts the payment with
        `onConflictDoNothing()` over every unique index (no row: a concurrent fulfilment of the
        same session won, so `ignored`, where the old message check answered 500). The payment's
        promo code is the session's own `metadata.promoCodeId`, not the enrolment's, which a
        restart may have changed. Stripe stores no empty metadata value, so a session with
        `elevatePayoutAccountId` and no `promoCodeId` had no promo code; only an older session
        without a payee falls back to the enrolment's.
        -   Not yet active: activate it, point it at the paying session, count the enrolment and
            the promo code, as before.
        -   Already active: the payment is a duplicate. It stays on record and is refunded in
            full (`createRefund` with key `duplicate-refund:<session>`, recorded through
            `TransactionsService.applyRefund`). The learner gets one email saying they paid twice
            and were refunded; no `checkout_completed`, no enrolment email, no count. The audit
            action is `payment.duplicate`, and `refund_issued` carries `duplicate: true`. The
            outcome is `duplicate`, which the webhook answers as `applied`.
        -   If that refund fails, the outcome is `duplicate_unrefunded`: the webhook stores it
            as the event's error for Support, and the payment stays `succeeded`. The next
            fulfilment of that session (the success page's poll) finds the payment, sees it is an
            unrefunded duplicate (`succeeded`, enrolment active and pointing elsewhere) and tries
            the refund again; Support can also refund it. When the webhook and a poll refund the
            same duplicate at once, the refund key returns one refund, and only the call that
            records it writes the audit, the event and the email; a call that fails after the
            other has recorded a full refund counts as done.
    -   **`syncSession` reads every session that is not the enrolment's.** It answers `paid`
        straight away only for the session the enrolment points at. For another one it retrieves
        the session and, when that session is paid, runs fulfilment, which records and refunds a
        duplicate even when no webhook arrives. It answers `paid` whenever the enrolment is
        active.
    -   **Only the paying session's refund removes access.** `TransactionsService.applyRefund`
        sets the enrolment to `refunded` and lowers the count only when the refunded payment's
        session is the one the enrolment points at. A refunded duplicate, whether by the step
        above, by Support or in the Stripe dashboard, leaves the course in place, and the refund
        notice says access was removed only when the enrolment is `refunded`. If Support refunds
        the payment that gave access while another `succeeded` payment for the enrolment stands
        (a duplicate not refunded yet), the enrolment is pointed at that payment instead and
        stays active. `applyRefund` does all of this in one transaction that locks the
        enrolment first, as fulfilment does, so refunds of two payments of one enrolment are
        recorded one after the other. The "you paid twice" email reads the enrolment after its
        refund: if Support refunded the other payment meanwhile, it says access was removed.
    -   **Known limits.** A refund made from the Stripe dashboard is recorded by `charge.refunded`
        under a made-up id when the charge carries no refund list, so it can be recorded twice if
        it races the refund call above; this predates PR 1 and applies to Support refunds too. A
        process that stops between writing a duplicate payment and refunding it leaves it for the
        next poll or for Support, because the webhook ledger answers Stripe's retry as a
        duplicate. Two restarts of one enrolment at the same moment (two tabs) can each open a
        session; the one not pointed at stays open until it expires, and paying both falls back
        to the refund. When the webhook's refund call gives up while a poll's call for the same
        duplicate is still at Stripe, the webhook stores `duplicate_unrefunded` although the
        poll then records the refund; the payment row is the record to trust.
    -   **Events:**
        -   `checkout_started` adds `locale ?? null`;
        -   `checkout_completed` on the webhook and `sync` paths, which share `fulfilCheckout`,
            uses the locale read back from the metadata;
        -   the free path (line 152, no Stripe session) uses the request's `locale ?? null`.

##### 16. Checkout route

-   **Files**: `apps/api/src/routes/checkout.ts` (Modify).
-   **Type / Scope**: Hono route.
-   **Proposed Changes**: call `payments.startCheckout(user, id, { promoCode: body.promoCode,
    locale: body.locale })`.

##### 17. Test sign-in helper

-   **Files**: `apps/api/test/helpers/test-app.ts` (Modify).
-   **Type / Scope**: test helper.
-   **Proposed Changes**: the signature becomes `signIn(email, audience = 'learner', opts?: {
    locale?: Locale; localeChosen?: boolean })`. It sends `opts.locale` on the magic-link
    request, and both fields on the verify request. Existing callers are unchanged.

##### 18. Auth tests

-   **Files**: `apps/api/test/auth.test.ts` (Modify).
-   **Type / Scope**: integration test (vitest, disposable Postgres).
-   **Proposed Changes**:
    -   **Verify:**
        -   a chosen `zh` overwrites `users.locale = 'en'` and sets `localeChosen`;
        -   a guessed `en` leaves a chosen `zh` alone;
        -   a guessed `en` replaces a guessed `zh`;
        -   a guessed locale fills a null account;
        -   no `locale` leaves it unchanged.
    -   **The emailed link:** it has `lang` when `locale` was sent, and none for a Teach request
        without `locale`.
    -   **The response:** `AuthUser.locale` and `localeChosen` are returned.
    -   **Events:** a `sign_in` event is recorded with its `locale`, and none for a refused
        Support sign-in.
    -   **`PATCH /me`:**
        -   `{ locale: 'zh', localeChosen: true }` stores both;
        -   `{ localeChosen: false }` keeps the locale;
        -   an invalid value answers 400.

##### 19. Checkout tests

-   **Files**: `apps/api/test/checkout.test.ts` (Modify).
-   **Type / Scope**: integration test.
-   **Proposed Changes**:
    -   **`locale: 'zh'` in the checkout request:** the fake provider receives `locale: 'zh'`,
        the metadata has it, and the success and cancel URLs end with `&lang=zh`.
    -   **No `locale`:** there's no `lang` on either URL, and the metadata has no `locale` key.
    -   **Idempotency:** the same enrollment with two locales gives two idempotency keys.
    -   **Events:** `checkout_completed` records the locale in each of three cases:
        -   a free course (`payments.service.ts:152`), from the request;
        -   a paid course completed by the webhook, from the metadata;
        -   a paid course completed by `sync`, from the metadata.

        `checkout_started` records it too.
    -   **Two sessions for one enrolment** (`apps/api/test/checkout.test.ts`):
        -   restarting in another language expires the old session, and its success page
            reports `expired`; switching back opens a third session, and a plain retry reuses
            the open one;
        -   a paid earlier session keeps its own promo code when the restart sends another,
            including one paid after the restart, whose metadata has no `promoCodeId`;
        -   a Support refund of the first payment while a duplicate is unrefunded moves access to
            the duplicate;
        -   the Stripe provider retries a refused key once with a fresh one
            (`apps/api/test/stripe-provider.test.ts`), and no other error;
        -   a payment that activates the enrolment while a restart runs is left alone;
        -   a second payment found only by the success page's poll is refunded once;
        -   a failed duplicate refund is retried by the next poll;
        -   a session paid before the restart is fulfilled and the restart answers `enrolled`;
        -   a session that could not be closed and is paid alone is fulfilled, and the enrolment
            points at it;
        -   both sessions paid: one enrolment, one count, one `checkout_completed`, and the
            second payment refunded with one email; its `charge.refunded` keeps the course;
        -   a failed refund is stored with the webhook event, and a Support refund of that
            payment keeps the course;
        -   a webhook and a `sync` for the same session at once both answer 200, with one
            payment;
        -   another learner's `sync` of an earlier session answers 404.

##### 20. Idempotency key test

-   **Files**: `apps/api/test/payout-accounts.test.ts` (Modify).
-   **Type / Scope**: unit test.
-   **Proposed Changes**:
    -   The expected key at line 95 becomes `'checkout:enr_1:8000:acc_1:none'`.
    -   A new case checks that `{ ...base, locale: 'zh' }` gives a different key.

##### 21. web-ui provider

-   **Files**: `packages/web-ui/src/preferences/PreferencesProvider.tsx` (Modify).
-   **Type / Scope**: React context.
-   **Proposed Changes**:
    -   `PreferencesContextValue` gains `locale: Locale`, from
        `resolveLocale({ stored: preferences.locale, deviceLanguages: navigator.languages })`.
    -   `t`, `applyToDocument` (`<html lang>`) and the format hooks read it.

##### 22. web-ui format hooks

-   **Files**: `packages/web-ui/src/preferences/format.ts` (Modify).
-   **Type / Scope**: format hooks.
-   **Proposed Changes**: `useIntlLocale` reads the context's resolved `locale`, not
    `preferences.locale`.

##### 23. Teach and Support picker

-   **Files**: `packages/web-ui/src/preferences/PreferencesCard.tsx` (Modify).
-   **Type / Scope**: component.
-   **Proposed Changes**:
    -   The language `<select>` in `PreferenceRows` gains a first option, `system`, labelled
        `t('prefs.language.system')`.
    -   The `onChange` cast widens from `Locale` to `LocalePreference`.

##### 24. "Follow device" message

-   **Files**: `packages/i18n/src/messages/areas/chrome.en.ts` and `chrome.zh.ts` (Modify).
-   **Type / Scope**: message catalog.
-   **Proposed Changes**: add `prefs.language.system`: "Follow device" / "跟随设备". The
    learner Profile (item 28) and `PreferenceRows` (item 23) use it.

##### 25. Teach and Support pre-paint (device rule)

-   **Files**: `apps/teach/public/preferences-init.js` and `apps/support/public/preferences-init.js`
    (Modify), kept identical.
-   **Type / Scope**: web pre-paint scripts.
-   **Proposed Changes**: when the stored `locale` is not `en` or `zh` (that is, `system`,
    missing, or any other value), set `root.lang` from `navigator.languages[0]` by the
    `resolveLocale` device rule. `?lang` is PR 4.

##### 26. Learner preferences

-   **Files**: `apps/learner/src/lib/preferences.tsx` (Modify).
-   **Type / Scope**: React context.
-   **Proposed Changes**:
    -   **New context fields:**
        -   `locale: Locale`, from `resolveLocale({ stored: preferences.locale, account,
            param, deviceLanguages })`;
        -   `setAccountLocale(locale: Locale | null)`, which the session calls.
    -   **The inputs to `resolveLocale`:**
        -   `account` is held in state and set only through `setAccountLocale`.
        -   `param`, on web, is read once at first mount from `window.location`'s `lang` and
            held in memory until the app next loads. Native has none.
        -   `deviceLanguages` is `navigator.languages` on web and `[]` on native until PR 3.
    -   **Using the resolved value:** `t` and `<html lang>` use the resolved `locale`.
        `setPreference` is unchanged.

##### 27. Learner session

-   **Files**: `apps/learner/src/lib/session.tsx` (Modify).
-   **Type / Scope**: React context, inside `PreferencesProvider`.
-   **Proposed Changes**:
    -   **Passing the account to preferences:** whenever `user` changes, call
        `setAccountLocale(user?.localeChosen ? user.locale : null)`.
    -   **A new `chooseLocale(next: LocalePreference)`,** added to the `Session` type and
        returned by `useSession()`:
        -   it calls `setPreference('locale', next)`;
        -   when signed in, it sends:

            ```ts
            api.me.$patch({
              json: next === 'system'
                ? { localeChosen: false }
                : { locale: next, localeChosen: true },
            })
            ```

            and replaces the cached user with the response's `user`;
        -   a failure, including offline, is ignored.
    -   **The one fill-in:** once preferences are `ready` and after `refreshUser` succeeds, if
        `user.locale` is null, send `{ locale: <resolved>, localeChosen: false }` once per app
        run.
    -   **No effect watches the stored language**, so nothing writes to the account except a
        press or that one fill-in.

##### 28. Profile language row

-   **Files**: `apps/learner/src/app/(tabs)/profile.tsx` (Modify).
-   **Type / Scope**: screen.
-   **Proposed Changes**:
    -   The existing `English` and `中文` chips call `chooseLocale` instead of `setPreference`.
    -   A third chip, "Follow device" (`t('prefs.language.system')`), calls
        `chooseLocale('system')`.
    -   The selected chip is the stored value, `preferences.locale`.

##### 29. Sign-in and verify screens

-   **Files**: `apps/learner/src/app/(auth)/sign-in.tsx` and `(auth)/verify.tsx` (Modify).
-   **Type / Scope**: screens.
-   **Proposed Changes**:
    -   `sign-in.tsx` sends `locale` (resolved) with the magic-link request.
    -   Both screens send `locale` (resolved) and `localeChosen: isChosen(preferences.locale)`
        with the verify request.

##### 30. Starting checkout

-   **Files**: `apps/learner/src/lib/catalog.ts`, `apps/learner/src/app/checkout/[courseId].tsx`
    and `apps/learner/src/app/course/[slug].tsx` (Modify).
-   **Type / Scope**: API helper and screens.
-   **Proposed Changes**:
    -   The signature becomes `startCheckout(courseId, { locale, promoCode })`, with `locale`
        required, so no caller can leave it out.
    -   The checkout screen (line 56) and the free-course enrol button on the course page
        (line 70) pass the resolved locale.

##### 31. ADRs

-   **Files**: `docs/adr/010-locale-resolution-and-email-language.md` (Create) and
    `docs/adr/008-theming-preferences-i18n.md` (Modify).
-   **Type / Scope**: architecture decision records.
-   **Proposed Changes**:
    -   **ADR 010 records:**
        -   the order of precedence;
        -   `system`;
        -   `users.locale` and `locale_chosen`;
        -   the chosen-or-guessed rule at verify;
        -   the press-only writes and the single fill-in;
        -   the learner emails' languages;
        -   API error messages staying English;
        -   certificate PDFs staying English;
        -   Teach and Support resolving `system` from the browser;
        -   the `?lang` hand-off, stored in Teach and Support only when nothing is stored.
    -   **ADR 008** gets "Amended by ADR 010" next to "Not synced to the account". (The email
        pointer is PR 2; "Translated today" is PR 3.)

#### PR 2: emails

##### 32. Email messages

-   **Files**: `packages/i18n/src/messages/areas/email.en.ts` and `email.zh.ts` (Create).
-   **Type / Scope**: message catalog.
-   **Proposed Changes**: these keys, as whole sentences with `{placeholders}`:
    -   `email.footer.ignore`, and `email.text.cta` for the button's line in the plain-text part
        (`{label}: {url}`, so Chinese gets a full-width colon);
    -   `email.signIn.subject`, `.title`, `.body`, `.button`, `.codeIntro`, `.text.open`,
        `.text.code`;
    -   `email.receipt.title`, `.paid`, `.stripeReceipt`, `.noReceipt`, `.start`, `.button`;
    -   `email.certificate.title`, `.congrats`, `.verify`, `.button`;
    -   `email.refund.title`, `.refunded`, `.reason`, `.reasonStripe`, `.accessRemoved`;
    -   `email.duplicate.title`, `.refunded`, `.kept`, `.removed`, `.button`: the email for a
        second payment that is refunded automatically (item 15), added after this list was
        first written.

    The English text reproduces today's emails word for word, because existing tests match it:
    -   "You're enrolled" in `checkout.test.ts`;
    -   "Refund issued" and "Your certificate" in `certificates-earnings.test.ts`;
    -   "Your certificate" in `money-loop.test.ts:295`;
    -   "Refund issued" in `payout-accounts.test.ts:268` and `:279`.

##### 33. Catalog assembly (email)

-   **Files**: `packages/i18n/src/messages/en.ts` and `zh.ts` (Modify).
-   **Type / Scope**: catalog assembly.
-   **Proposed Changes**: add the `email` area to `enAreas`/`zhAreas` and to the merged catalogs.

##### 34. API dependency

-   **Files**: `apps/api/package.json` and the root `package-lock.json` (Modify).
-   **Type / Scope**: dependencies.
-   **Proposed Changes**: add `"@elevate/i18n": "*"`.

##### 35. Email templates

-   **Files**: `apps/api/src/emails/templates.ts` (Modify).
-   **Type / Scope**: email templates.
-   **Proposed Changes**:
    -   **`layout(title, bodyHtml, locale = 'en')`** writes `<html lang>`, a
        `<meta charset="utf-8">` in a new `<head>`, and the translated footer.
    -   **`magicLinkEmail`** takes `locale: Locale` and builds every string with
        `translate(locale, …)`.
    -   **`simpleEmail`** takes `locale?: Locale`, defaulting to `en`.
    -   **Escaping:** values inserted into HTML go through `para()` or `escapeHtml`. The subject
        and the text part are plain text.

##### 36. Code email language

-   **Files**: `apps/api/src/services/auth.service.ts` (Modify).
-   **Type / Scope**: API service.
-   **Proposed Changes**: `requestMagicLink` passes `locale: input.locale ?? 'en'` to
    `magicLinkEmail`.

##### 37. Receipt, certificate and refund emails

-   **Files**: `apps/api/src/services/payments.service.ts`, `certificates.service.ts` and
    `transactions.service.ts` (Modify).
-   **Type / Scope**: API services.
-   **Proposed Changes**:
    -   **The learner emails** are built from `email.*` keys and pass `locale` to
        `simpleEmail`:
        -   the receipt and the certificate (`issueForEnrollment`) use
            `enrollment.user.locale ?? 'en'`;
        -   the learner's refund email uses `p.user.locale ?? 'en'`;
        -   the duplicate-payment email (item 15) uses `enrollment.user.locale ?? 'en'`.

        The queries already load `user: true`, so no query changes.
    -   **The Stripe refund reason:** `transactions.service.ts` exports
        `STRIPE_REFUND_REASON = 'Refunded in Stripe'` and records that constant where it records
        the reason today. When a payment's stored reason equals the constant, the learner email
        fills `email.refund.reason`'s `{reason}` with `t('email.refund.reasonStripe')` instead
        of the stored text.
    -   **The teacher's refund copy** is unchanged.

##### 38. Email unit tests

-   **Files**: `apps/api/test/emails.test.ts` (Create).
-   **Type / Scope**: unit test.
-   **Proposed Changes**:
    -   `magicLinkEmail` in `zh` produces a Chinese subject, body and footer, and `lang="zh"`.
    -   `simpleEmail` in `zh` produces a Chinese footer and `lang="zh"`.
    -   A course title containing `<script>` is escaped by `simpleEmail` in both languages.

##### 39. Email integration tests

-   **Files**: `apps/api/test/auth.test.ts`, `checkout.test.ts` and
    `certificates-earnings.test.ts` (Modify).
-   **Type / Scope**: integration tests.
-   **Proposed Changes**:
    -   **The code email's language:** it's Chinese for `locale: 'zh'` and English for none.
    -   **`checkout.test.ts`:** a `zh` user's receipt is Chinese, and so is the email for their
        automatically refunded second payment, even when that checkout ran in English.
    -   **`certificates-earnings.test.ts`:**
        -   a `zh` user's certificate and refund emails are Chinese;
        -   a Stripe-dashboard refund shows the translated reason;
        -   a null-locale user's emails are English;
        -   the teacher's refund email is English.

##### 40. Records (emails)

-   **Files**: `docs/adr/008-theming-preferences-i18n.md` and `AGENTS.md` (Modify).
-   **Type / Scope**: records and agent rules.
-   **Proposed Changes**:
    -   **ADR 008:** next to "…as do error messages from the API and emails", add: "Learner
        emails: amended by ADR 010. API error messages still stay English."
    -   **AGENTS.md:** add a "Learner emails" rule: "The receipt, certificate and refund emails
        use `users.locale ?? 'en'`; the sign-in code email uses the request's `locale`. See ADR
        010. A new string in a learner email is a key in the `email` area."

#### PR 3: the learner app

##### 41. `expo-localization`

-   **Files**: `apps/learner/package.json` and the root `package-lock.json` (Modify);
    `apps/learner/app.json` only if `npx expo install` writes to it.
-   **Type / Scope**: dependencies and app config.
-   **Proposed Changes**:
    -   Run `npx expo install expo-localization`.
    -   Keep any config-plugin entry it writes to `app.json` as written.
    -   Add the plugin's locale-change setting if the SDK 58 `expo-localization` page says
        Android needs it for `useLocales()` to re-render.

##### 42. Device languages

-   **Files**: `apps/learner/src/lib/device-languages.ts` and `device-languages.web.ts` (Create).
-   **Type / Scope**: platform helper.
-   **Proposed Changes**: export `useDeviceLanguages(): readonly string[]`.
    -   **Native:** `useLocales()` from `expo-localization`, mapped to `languageTag`.
    -   **Web:** `navigator.languages`.

    `preferences.tsx` (item 26) switches its native input to `useDeviceLanguages()`.

##### 43. Chip

-   **Files**: `apps/learner/src/ui/Chip.tsx` (Modify).
-   **Type / Scope**: UI primitive.
-   **Proposed Changes**:
    -   Add `testID?: string` (on the `Pressable`).
    -   Add `lang?: string`, passed to `Text` on web only, as
        `{...(Platform.OS === 'web' ? ({ lang } as object) : {})}`.
    -   A one-line comment in `Chip.tsx` says why: React Native's strict types have no `lang`,
        but React Native Web renders it.

##### 44. `LanguageSwitch`

-   **Files**: `apps/learner/src/components/LanguageSwitch.tsx` (Create).
-   **Type / Scope**: component.
-   **Proposed Changes**:
    -   **The control:** a labelled `radiogroup` (`learnerCommon.language.label`) of two
        `role="radio"` `Chip`s. They're labelled from `localeNames`, each with `lang` set to the
        chip's own locale, and with `testID`s `lang-en` and `lang-zh`.
    -   **State:** the selected chip is the resolved `locale`, and a press calls `chooseLocale`.
    -   **Where it goes:** Explore and sign-in only (item 49). Profile keeps its own row.

##### 45. Category keys

-   **Files**: `apps/learner/src/lib/categories.ts` (Create).
-   **Type / Scope**: helper.
-   **Proposed Changes**:
    -   `isCourseCategory(slug: string): slug is CourseCategory` checks the slug against
        `COURSE_CATEGORIES`.
    -   `categoryKey(slug: string): MessageKey | null` returns `` `category.${slug}` `` when
        `isCourseCategory(slug)`, so the key type checks without a cast, and null otherwise.
    -   Callers show `categoryLabel(slug)` on null.

##### 46. Formatting

-   **Files**: `apps/learner/src/lib/format.ts` (Modify).
-   **Type / Scope**: formatting helpers.
-   **Proposed Changes**:
    -   **`formatMinutes(seconds, t)`** uses `learnerCommon.duration.minutes` (`{minutes} min`),
        `.hours` (`{hours} h`) and `.hoursMinutes` (`{hours} h {minutes} min`).
    -   **`formatDate(iso, locale)`** uses `intlLocale(locale)`.
    -   **`formatList(items, t)`** joins with `learnerCommon.list.separator`.
    -   **Callers** pass `t` and `locale` from `usePreferences()`.

##### 47. Error wording

-   **Files**: `apps/learner/src/lib/api-error.ts` (Modify).
-   **Type / Scope**: error helper.
-   **Proposed Changes**:
    -   **`errorMessage`** gains a second fallback parameter, as web-ui's does. For an
        `ApiError` it returns `error.message || fallback`, so an empty message never shows
        blank.
    -   **`ApiError.fromResponse`** keeps an empty message when the body has none. It no longer
        uses the English `'Something went wrong'`.
    -   **A new `useErrorMessage()`** returns `(error: unknown) => errorMessage(error,
        t('learnerCommon.error.generic'), t('learnerCommon.error.unreachable'))`, memoised on
        `t`.

##### 48. `fillSlots`

-   **Files**: `packages/i18n/src/react.ts` (Create); `packages/i18n/package.json` and
    `packages/web-ui/src/preferences/rich.tsx` (Modify).
-   **Type / Scope**: shared helper.
-   **Proposed Changes**:
    -   **Move `fillSlots`.** web-ui's version is plain React (`createElement`, `Fragment`), so
        it moves to `@elevate/i18n/react`.
    -   **`package.json`** gains:
        -   an `./react` export;
        -   `react` as a peer dependency, with `peerDependenciesMeta.react.optional: true`, so
            the API's use of `@elevate/i18n` needs no React;
        -   `react` and `@types/react` as dev dependencies, for its own typecheck.
    -   **web-ui:** `rich.tsx` re-exports it.
    -   **The learner app** imports it, so no copy is made.

##### 49. Learner routes and components

-   **Files**: every path was checked to exist.
    -   **Routes** (`app/`):
        -   `(tabs)/index.tsx`, `(tabs)/learning.tsx`, `(tabs)/profile.tsx` and
            `+not-found.tsx`;
        -   `(auth)/sign-in.tsx` and `(auth)/verify.tsx`;
        -   `course/[slug].tsx`;
        -   `checkout/[courseId].tsx` and `checkout/success.tsx`;
        -   `c/[token].tsx`;
        -   `learn/[enrollmentId]/index.tsx`, `learn/[enrollmentId]/certificate.tsx` and
            `learn/[enrollmentId]/lesson/[lessonId].tsx`.
    -   **Components:**
        -   `components/CertificateCard.tsx`, `CourseCard.tsx`, `QuizRunner.tsx`,
            `RootError.tsx` and `Trail.tsx`;
        -   `components/media/AudioArtefact.tsx`, `VideoArtefact.tsx` and
            `VideoArtefact.web.tsx`;
        -   `ui/EmptyState.tsx`.
-   **Type / Scope**: screens and components. In each file the implementer searches for JSX
    text, `accessibilityLabel=`, `placeholder=`, and string literals passed to `Text` or stored
    in state.
-   **Proposed Changes**:
    -   **Strings:** every hard-coded string becomes a `t()` call with a key in the area given
        in [The learner app's text](#the-learner-apps-text). Plurals use two keys (`learnerCourse.lessons.one` and
        `.other`).
    -   **Errors:** every `errorMessage(` call in `apps/learner/src` moves to
        `useErrorMessage()`. A screen that keeps an error in state stores the error object, not
        a string, and words it at render.
    -   **Categories:** badges and chips use `categoryKey`.
    -   **Explore** (`(tabs)/index.tsx`): `LanguageSwitch` goes in a row above the search field,
        outside the hero.
    -   **Sign-in** (`(auth)/sign-in.tsx`):
        -   `LanguageSwitch` goes directly under `Logo`, outside both cards;
        -   the error state becomes `{ kind: 'invalidEmail' } | { kind: 'api'; error: unknown }
            | null`, worded at render (`invalidEmail` from a `learnerAuth` key, `api` with
            `useErrorMessage()`);
        -   `testID`s `sign-in-email` and `sign-in-request` are added.
    -   **Profile** (`(tabs)/profile.tsx`):
        -   it keeps its own chip row (item 28) and doesn't use `LanguageSwitch`;
        -   its language chips get `testID`s `profile-lang-en`, `profile-lang-zh` and
            `profile-lang-system`, and the `English` and `中文` chips get `lang`;
        -   the theme chips get `testID`s `theme-system`, `theme-light` and `theme-dark`.
    -   **Price:**
        -   when the price is 0, the "Free" label is `t('learnerCommon.price.free')`;
        -   otherwise it is `formatSgd(cents)` without `showFree`;
        -   this applies at `course/[slug].tsx:104`, `checkout/[courseId].tsx:203`,
            `CourseCard.tsx:45` and `(tabs)/learning.tsx:124`.
    -   **Native hand-offs:** `course/[slug].tsx:86` and `checkout/[courseId].tsx:100` append
        `?lang=<resolved locale>` to the web URL.
    -   **`Trail`:** "after {list}" becomes `learnerLearn.trail.after` with
        `{list}` = `formatList(item.requires, t)`.
    -   **`RootError`:** it renders outside the app's providers, so it wraps its content in its
        own provider:

        ```tsx
        <PreferencesProvider>
          <ThemeProvider>{/* the error screen, using t() */}</ThemeProvider>
        </PreferencesProvider>
        ```

        On native it renders with the defaults until the storage read finishes.
    -   **Navigation:** `TopNav.tsx` and `PillTabBar.tsx` already use `t()`. They gain only the
        `testID`s `nav-sign-in` and `nav-profile`.

##### 50. Learner messages

-   **Files**: `packages/i18n/src/messages/areas/learner*.en.ts` and `.zh.ts` (Create).
-   **Type / Scope**: message catalog.
-   **Proposed Changes**:
    -   **The areas:** `learnerCommon`, `learnerExplore`, `learnerAuth`, `learnerCourse`,
        `learnerCheckout`, `learnerLearn` and `learnerCertificate`.
    -   **`learnerCommon`** holds the switcher label, errors, durations, `price.free`,
        `list.separator`, and the text of `EmptyState`, `RootError` and `+not-found`.
    -   **Chinese text** is drafted by Claude in the house style of `zh.ts`, reviewed
        independently, and signed off by the author before merge (Question 3). Nothing is
        translated at runtime.

##### 51. Category and preference messages

-   **Files**: `packages/i18n/src/messages/areas/domain.en.ts` / `.zh.ts` and `chrome.en.ts` /
    `.zh.ts` (Modify).
-   **Type / Scope**: message catalog.
-   **Proposed Changes**:
    -   **`domain`:** add `category.<slug>` for the ten slugs in `COURSE_CATEGORIES`.
    -   **`chrome`:** reword `prefs.language.description`, which says "More of Elevate is
        translated over time", to:
        -   "Applies to every screen of the learner app, and to the translated pages of Teach
            and Support."
        -   "适用于学员应用的所有页面，以及 Teach 和 Support 中已翻译的页面。"

##### 52. Catalog assembly (learner)

-   **Files**: `packages/i18n/src/messages/en.ts` and `zh.ts` (Modify).
-   **Type / Scope**: catalog assembly.
-   **Proposed Changes**: add the seven learner areas to `enAreas`/`zhAreas` and to the merged
    catalogs.

##### 53. Learner pre-paint

-   **Files**: `apps/learner/public/preferences-init.js` (Create) and
    `apps/learner/public/index.html` (Modify).
-   **Type / Scope**: web pre-paint script.
-   **Proposed Changes**:
    -   **The script:** it sets `<html lang>` from the stored locale. For any stored value
        other than `en` or `zh` (`system`, missing or unknown), it uses `?lang`, then
        `navigator.languages[0]`, by the device rule. It never stores anything.
    -   **`index.html`** loads it as a classic `<script src>` in `<head>`, because the deployed
        site sends `script-src 'self'`.

##### 54. Jest setup

-   **Files**: `apps/learner/jest.setup.ts` (Modify).
-   **Type / Scope**: test setup.
-   **Proposed Changes**:
    -   **`expo-localization`:** mock `getLocales` and `useLocales` to return
        `[{ languageTag: 'en-SG', languageCode: 'en' }]` by default, so existing assertions stay
        English. An exported `setMockDeviceLanguages(tags)` overrides the list for one test.
    -   **The API client:** `jest.mock('@/lib/api')`, with these as `jest.fn`:
        -   `api.me.$patch`;
        -   `api.auth['magic-link'].$post` and `api.auth.verify.$post`;
        -   `api.auth.me.$get` and `api.auth['sign-out'].$post`, which the session calls.
    -   **Responses:** a `jsonResponse(body, status = 200)` helper returns
        `{ ok: status < 400, status, json: async () => body }`. Offline is simulated by
        rejecting with `new Error('Network request failed')`.
    -   **Token storage:** `jest.mock('@/lib/token-storage')`, backed by an in-memory value.

##### 55. Learner tests

-   **Files**:
    -   `apps/learner/src/lib/__tests__/preferences.test.tsx` (Modify);
    -   `apps/learner/src/lib/__tests__/session-locale.test.tsx` (Create);
    -   `apps/learner/src/__tests__/sign-in.test.tsx` (Create), outside `src/app/`, where Expo
        Router treats every file as a route;
    -   `apps/learner/src/test-utils/providers.tsx` (Create).
-   **Type / Scope**: jest-expo tests.
-   **Proposed Changes**:
    -   **`test-utils/providers.tsx`** exports `TestProviders`, which nests
        `PreferencesProvider`, `ThemeProvider`, `QueryClientProvider` and `SessionProvider` as
        the app's root layout does.
    -   **`preferences.test.tsx`:**
        -   a first launch on a `zh-TW` device resolves to `zh`, and on `en-SG` to `en`;
        -   a stored `en` on a `zh` device stays `en`;
        -   `setAccountLocale('zh')` with a stored `system` resolves to `zh`, without writing to
            storage.
    -   **`session-locale.test.tsx`** renders inside `TestProviders`:
        -   `chooseLocale('zh')` while signed in sends `{ locale: 'zh', localeChosen: true }`;
        -   `chooseLocale('system')` sends `{ localeChosen: false }`;
        -   signed out, it sends nothing;
        -   a launch with `user.locale` null sends one fill-in, and a launch with it set sends
            none;
        -   an offline launch sends nothing.
    -   **`sign-in.test.tsx`** uses `renderRouter` from `expo-router/testing-library`, with
        `TestProviders` as `wrapper`. Typing an email and then pressing `lang-zh` keeps the
        email, and the request carries `locale: 'zh'`.

##### 56. Device flows

-   **Files**:
    -   `.maestro/sign-in-zh.yaml` (Create);
    -   `.maestro/sign-in.yaml`, `.maestro/learner-preferences.yaml` and
        `.maestro/scripts/request-code.js` (Modify).
-   **Type / Scope**: device flows (manual).
-   **Proposed Changes**:
    -   **`sign-in-zh.yaml`:**
        1.  launch the app;
        2.  tap `lang-zh` on sign-in;
        3.  assert the code step's title has no Latin text;
        4.  tap `lang-en`.
    -   **`sign-in.yaml` and `learner-preferences.yaml`** change only their selectors, to the
        `testID`s in items 44 and 49, so the English text matches that follow keep working.
        "Restore defaults" in `learner-preferences.yaml` taps `profile-lang-system`.
    -   **`request-code.js`** sends `locale: 'zh'` when the flow passes `LOCALE=zh`, and no
        `locale` otherwise.

##### 57. Records (learner app)

-   **Files**: `docs/adr/008-theming-preferences-i18n.md`, `AGENTS.md` and
    `packages/i18n/src/messages/en.ts` (Modify).
-   **Type / Scope**: records and agent rules.
-   **Proposed Changes**:
    -   **ADR 008:**
        -   add the learner app to "Translated today";
        -   lines 84–85 name `fillSlots`'s new home, `@elevate/i18n/react`.
    -   **AGENTS.md:** the "Translated pages" rule adds the whole learner app. A new string on a
        learner screen is a key in a `learner*` area.
    -   **`en.ts`:** the "Translated today" header comment (lines 9–11) adds the learner app.

#### PR 4: the Teach and Support `?lang` hand-off

##### 58. Teach and Support pre-paint (`?lang`)

-   **Files**: `apps/teach/public/preferences-init.js` and `apps/support/public/preferences-init.js`
    (Modify), kept identical.
-   **Type / Scope**: web pre-paint scripts.
-   **Proposed Changes**:
    -   **When `?lang` is `en` or `zh` and the stored `locale` is not `en` or `zh`:** merge
        `{ locale: <lang> }` into the stored JSON (keeping `theme`), write it back, and set
        `root.lang`.
    -   **Whenever `lang` is present:** call `history.replaceState` with `lang` removed from
        `location.search` and `location.hash` kept.
    -   **Storage errors** fall through to the defaults, as today.

##### 59. Teach and Support tests

-   **Files**: none.
-   **Type / Scope**: test coverage note.
-   **Proposed Changes**:
    -   **No new tests**, because `packages/web-ui` has no test runner.
    -   **Resolver rules:** `packages/core/test/locale.test.ts` (item 7) covers them.
    -   **Wiring:** the provider and both init scripts are checked by hand in CUJs 6 and 7.

### Verification Plan

-   **Compilation/Build**:
    -   `npx turbo run typecheck` after each PR;
    -   `npx expo export --platform web` in `apps/learner`.
-   **Unit Tests**: `npx turbo run test`. That covers:
    -   the core resolver and preferences tests;
    -   the `i18n` catalog parity test (no missing Chinese key, matching placeholders, no
        duplicate keys);
    -   the API email tests;
    -   the learner jest-expo suite.
-   **Static Analysis & Linting**:
    -   `npm run lint` (Biome);
    -   `npm run check:dupes`;
    -   `npx expo-doctor` in `apps/learner`, after adding `expo-localization`.
-   **Test Coverage Requirement**: these have a test each:
    -   every branch of `resolveLocale`;
    -   every branch of the verify rule (chosen; guessed against a chosen, a guessed and an empty
        account; no locale);
    -   the three `PATCH /me` triggers.
-   **E2E/Integration**:
    -   **API integration tests** against a disposable Postgres, covering:
        -   the verify rule and `PATCH /me`;
        -   the Stripe `locale`, the idempotency key and the return URLs;
        -   the learner emails in both languages.
    -   **A manual walkthrough:**
        -   CUJs 1–5 on learner web (a `zh-CN` browser profile), the iOS simulator and an Android
            emulator;
        -   CUJs 6–7 in Teach and in Support.
    -   **A manual Goal 1 audit:**
        1.  Set 中文 on learner web.
        2.  Open each route under `apps/learner/src/app`, signed in and signed out, including
            empty and error states.
        3.  List every Latin-script word in visible text or in an accessibility label, using the
            browser's accessibility tree.
        4.  Check each against Goal 1's four exceptions, and record the result in the PR.

        Strings shown only on native (the hand-off links and the native media controls) are
        checked during CUJ 2's walkthrough on the simulators.
-   **Success measure**: after launch, count `sign_in` and `checkout_completed` events by their
    `locale` property. [Question 2](#open-questions) asks whether there is a target.

---

<!-- Provenance: Indicates initial structural drafting via EGM. -->

_Drafted with EGM_
