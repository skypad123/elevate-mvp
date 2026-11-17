# Stage 6: Comprehension Test — learner-chinese.md

- **Target:** `docs/designs/learner-chinese.md`. FeatureRange is lines 1–624 and DetailedRange
  is lines 625–1116.
- **Reviewer:** `egm-comprehension`, which read the document alone, with no GoldfishContext and
  no standard.
- **Result:** every section could be paraphrased. There are no Blockers, 2 Majors and 16 Nits.

## What this proposes

The design translates the whole Elevate learner app (web, iOS, Android) and its four learner
emails into Simplified Chinese. The emails are the sign-in code, receipt, certificate and refund.
Teacher-typed text, API error messages and the certificate PDF stay English.

Each visitor gets one language by a fixed order of precedence:

1. an explicit choice;
2. the account's stored language;
3. a `?lang` link parameter;
4. the device's first preferred language;
5. English.

A new stored value, `system`, means "not chosen yet". A switcher on Explore and the sign-in
screen lets signed-out visitors change language.

The server learns the language through new `locale` columns on `users` and `magic_links`,
filled at sign-in:

- a chosen language overwrites the account;
- a guessed language only fills an empty account;
- a signed-in learner who switches also sends `PATCH /me`.

The stored account language then drives:

- the email language;
- Stripe Checkout's `locale`;
- the `?lang` on return URLs;
- the analytics `locale`.

Teach and Support also resolve `system` from the browser. They gain a "Follow device" option and
store a one-time `?lang` hand-off. The work ships in five PRs, with no feature flag.

## How the existing system works, per this document

- **Language controls and coverage.**
  - The only language control is on the signed-in Profile tab.
  - Only navigation and Profile are translated. Home, sign-in, verify, course detail, checkout
    and the course card are English literals.
  - `lib/format.ts` hard-codes `en-SG`.
- **The stored preference.** It defaults to `en` and is written back on first load, so the app
  can't tell a choice from the default. Nothing reads the device language.
- **The server knows no language.**
  - `users` has no language column, and the sign-in request carries none.
  - Emails are English, as ADR 008 records.
  - Three of the four learner emails come from server-side triggers with no learner request:
    the Stripe webhook, course completion, and a Support refund.
- **Links out of the app carry no language.** That covers the email sign-in link, native
  checkout in the system browser, and Stripe Checkout.
- **Teach and Support** share a `web-ui` preferences provider and identical
  `preferences-init.js` pre-paint scripts.
- **Analytics.** A `sign_in` event is defined but never sent.

## Findings

### Major

1. **`PATCH /me` has a different trigger in the feature section and in item 31.**
   _Lines 259 and 316–318 against 916–923, and Alternative B at 460–471._
   - **The feature section** says the PATCH fires "on every switch" (259) and "when a signed-in
     learner picks `en` or `zh`" (316).
   - **Item 31** sends it whenever the stored value is `en` or `zh` and differs from the cached
     `user.locale`, after `signIn` and `refreshUser`.
   - **Consequence 1:** an upgraded, signed-in install that holds the old auto-written `en`
     pushes `en` to the account on first launch, with no switch.
   - **Consequence 2:** two signed-in devices with different stored choices overwrite each
     other on every refresh. That's the failure Alternative B was rejected for.
   - **Gap:** neither consequence can be predicted from the feature section, so the document
     should state the real trigger.
2. **"The language the learner was using" isn't defined.**
   _Goals 5 and 6 (lines 110–116), and lines 351, 421–422 and 796–799._
   - **What the goals promise:** Stripe Checkout and the return pages are in "the chosen
     language", and events carry "the language the learner was using".
   - **What the plan uses:** `users.locale`, which can be null or differ from the UI.
   - **An example:** a learner signed in before release, with a stored `system` on a Chinese
     device, sees Chinese. Adoption is skipped, because `user.locale` is null, and no PATCH is
     sent, because the stored value is `system`. So Stripe gets no locale and the events record
     `null`.
   - **Gap:** the doc doesn't say whether it means the account value or the resolved UI value.
     It also doesn't say what `<locale>` in the return URLs is when `users.locale` is null.

### Nit

3. **"Home", "Explore page", "home and Explore" and "the Explore hero"** read as if they might
   be two screens. Lines 42 and 956 say they're the same file, but the table at line 365 lists
   them separately.
4. **The sign-in email is never explained.** The document never says that one email holds both a
   code (typed in the app) and a link (which opens `/verify`), backed by one `magic_links` row.
   It also never maps "the sign-in request" and "sign-in itself" to `requestMagicLink` and
   `verify`.
5. **"The Teach banner design" has no link or description**, although this design depends on it
   (lines 26–29, 133, 237, 410, 416).
6. **Teach, Support, `web-ui` and `TEACH_URL` are never introduced** (lines 123, 129, 202–221,
   279, 396).
7. **`audience` is never defined**, although the sign-in request and the `sign_in` event both
   carry it (lines 249, 766).
8. **The init scripts are miscounted and misdescribed.** Line 279 says "both" init scripts, but
   the design ends with three. Line 288 calls the learner script "the same" as Teach's, but only
   Teach's stores `?lang`.
9. **Where `?lang` is read is described three ways.**
   - §1 limits it to three pages, while item 30 reads it once from `window.location` on any page.
   - It isn't said whether the value lasts after navigating away.
   - Item 33's "native deep link" carrying `?lang` is unexplained, since the email link and
     checkout open a browser.
10. **The native language input differs between sections.** §2 reads `languageCode`, while
    item 29 maps to `languageTag` (line 291 against 896).
11. **Money formatting is listed as a problem and then left unchanged.** The Problem lists it as
    English-only, but the plan keeps `formatSgd` as it is (lines 48–49, 95, 380).
12. **The Open Questions are numbered 5 and 7 only**, so a reader can't tell whether 1–4 and 6
    were resolved or lost.
13. **Some references are unexplained:** "the spec" (line 441), and the process terms "brainstorm
    review", "when approving the Technical Plan" and "Goldfish review".
14. **The area table omits `learnerCommon`**, which the plan uses. "Area" itself is never defined,
    nor are `localeNames`, `intlLocale`, `translate` and `fillSlots`.
15. **The two quotations of ADR 008 differ** (line 429 against 719).
16. **The manual walkthrough covers CUJs 1–6**, but item 49 relies on CUJ 7 too (line 1105
    against 1087).
17. **"A text diff of every learner route in `zh`"** doesn't say how it's produced or what it's
    compared with (line 1107).
18. **The checkout items assume unexplained knowledge.** The `&lang` / `?lang` URL edits and
    "both `checkout_completed` calls" rely on the current URL shapes and the two completion
    paths, and explain neither (lines 797, 799).
