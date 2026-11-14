# ADR 008 — Per-portal palettes, device preferences and typed i18n

**Status:** accepted · 2026-11-09 · extended 2026-11-12 (teaching-profile screens translated; the
pre-paint script became a file; renumbered from 005, which is the AWS hosting ADR)

## Context

The three portals shared one green "Atelier" palette and had no user-facing preferences. Product
wants Teach to read as light blue and Support as yellow (Learner stays green), a Dark/Light mode
choice, and a language choice (English, 中文), all reachable from each portal's Settings. These must
be easy to extend: new preferences, new languages and new palettes should be additive changes that
cannot corrupt what users already have stored.

## Decision

### Palettes live in `@elevate/tokens`

- `colorScales.light|dark` stays the single Atelier source of truth. `portalPalettes.{teach,support}`
  are _partial_ overrides of the same token names.
- `scripts/build-css.ts` emits `dist/portal-<id>.css` next to `tokens.css`, using the **same three
  selector blocks** (`:root`, `@media (prefers-color-scheme: dark) :root:not([data-theme="light"])`,
  `:root[data-theme="dark"]`). A portal imports its file _after_ `theme.css`, so it wins by source
  order with identical specificity in light, OS-dark and forced-dark. Tailwind utilities are mapped
  through `@theme inline` onto `var(--token)`, so nothing else changes.
- The learner app imports `colorScales` as TypeScript and is untouched by portal CSS.
- New token **`brandFg`**: brand used as a foreground (text, icons, links). It equals `brand` in
  Atelier and Teach; Support's yellow fill cannot pass AA as text on white, so its `brandFg` is a
  dark amber. Text uses `text-brand-fg`; fills use `bg-brand` with `text-brand-ink` on top.
  `packages/tokens/test/palettes.test.ts` enforces AA contrast for every palette.
- Forced themes also set `color-scheme` on `:root[data-theme]` so native controls and scrollbars
  follow the choice.

### Preferences are a `@elevate/core` contract, stored on the device

- `contracts/preferences.ts`: `preferencesSchema` (zod) where **every field has a default**, plus
  `parseStoredPreferences(unknown)` which parses field by field, drops unknown keys and falls back
  to the default for any invalid value. It never throws.
- Storage key `elevate.preferences`: `localStorage` on web (Teach, Support, Learner web),
  `AsyncStorage` on native. Teach and Support run on different origins, so the shared key is safe.
- Web: `@elevate/web-ui/preferences` exports `PreferencesProvider` (reads synchronously, applies
  `data-theme` and `lang` to `<html>`, persists, follows other tabs), `usePreferences`, `useT`, and
  the `PreferencesCard` used by both portals' Settings pages. `public/preferences-init.js` in each
  portal applies the stored theme and language before first paint. It is a file loaded by a
  classic `<script src>` in `<head>`, not an inline script, because the deployed sites send
  `script-src 'self'` (ADR 005, `infra/terraform/modules/environment/sites.tf`).
- Pages that come before Settings can be reached (Teach's application and set-up pages, an
  invitation link) carry a `PreferencesButton` in their header. It opens the same rows
  (`PreferenceRows`) in a dialog.
- Learner: `src/lib/preferences.tsx` + platform `preferences-storage(.web).ts`; `ThemeProvider`
  resolves `system | light | dark`, and the splash screen stays up until preferences are loaded.
  The native read and the ready gate are unit-tested with jest-expo and the AsyncStorage mock
  (`apps/learner/src/lib/__tests__/preferences.test.tsx`); `.maestro/learner-preferences.yaml` checks a
  cold relaunch on a simulator via the `app-root-<scheme>` testID on the root view.
- Not synced to the account for now. If that is wanted later: add `users.preferences jsonb`,
  `updateMeSchema.preferences = preferencesSchema.partial()`, and merge server values through the
  same `parseStoredPreferences` — the UI does not change.

### i18n is a small typed catalog package, `@elevate/i18n`

- `messages/en.ts` is the source of truth; its keys form `MessageKey`, so a typo in `t('…')` is a
  compile error. `catalogs: Record<Locale, Partial<Messages>>` forces one catalog per locale in
  `supportedLocales` and falls back to English at runtime. `{var}` interpolation only.
- The catalog is written one area at a time: `messages/areas/<area>.en.ts` and `<area>.zh.ts`, put
  together by `messages/en.ts` and `messages/zh.ts`. A Chinese area is checked against its English
  file with `satisfies`, so a missing or unknown key is a compile error in that file.
- Translated today: navigation, the Settings/Preferences/Profile screens, and the teaching-profile
  screens: in Teach the profile switcher and staff banner, the start page, the dashboard, Members,
  the invitation page, the company application and set-up, the Stripe card and return pages,
  Settings, and the review of a writer's held changes; in Support the profiles list, the profile
  page, the company card, the legal-name check and owner recovery; and the text inside the shared
  shell drawer, uploader, media preview, dialog and toast. Other pages stay English until they are translated whole, as do error messages from the
  API and emails.
- `test/catalog.test.ts` fails when a catalog has untranslated keys, unknown keys or mismatched
  placeholders, when two areas define the same key, or when an area is missing from a catalog.
- Patterns, all without a new i18n API:
  - A label for an enum value is a key that ends in the stored value, read with a template literal
    written inside the call: ``t(`status.course.${course.status}`)``. An enum member without a key
    is then a compile error. `statusLabel()` is for English-only pages.
  - A message is a whole sentence. Nothing is put together from fragments, and punctuation,
    brackets and possessives are inside the message, because Chinese orders and punctuates a
    sentence differently.
  - Plurals are two keys chosen in code: `t(n === 1 ? 'x.one' : 'x.other', { count: n })`.
  - A sentence with a link, a button or bold text in it stays one message with a `{slot}`, filled
    with React nodes by `fillSlots` from `@elevate/web-ui/preferences`.
  - Dates and lists go through `useFormatDate()` and `useFormatList()`, which follow the language.
  - A failed request is worded by `useErrorMessage()`: the server's message as it is (the API
    answers in English), and the two sentences the client words itself in the chosen language.
- Chosen over i18next: two locales, three runtimes (Vite ×2, React Native), zero runtime
  dependencies, and compile-time key checking. The catalog has grown from a few dozen strings to
  several hundred and the plural pairs above are still few; if ICU plurals or lazy namespaces
  become necessary, swap the body of `translate` for i18next; callers only use `useT()`.

## How to extend

- **New preference:** add a field with a `.default()` to `preferencesSchema`; add a `PreferenceRow`
  in `PreferencesCard` and a row in the learner Profile "Preferences" card. Old stored JSON keeps
  parsing.
- **New language:** append to `supportedLocales`, add `messages/<locale>.ts` and its area files, add a
  `localeNames` entry. Typecheck and the catalog test guide the rest.
- **New string on a translated page:** a key in that page's area, in `areas/<area>.en.ts` and
  `<area>.zh.ts`. **A newly translated page:** its own area (two files), added to the two lists in
  `messages/en.ts` and in `messages/zh.ts`. The header of `zh.ts` holds the Chinese terms to use.
- **New palette or colour tweak:** edit `portalPalettes` and run `npm -w @elevate/tokens run build`;
  the palettes test checks contrast.

## Consequences

- `@elevate/tokens` must be built before the portals compile CSS (turbo `^build` already does this).
- `text-brand` is no longer used for text anywhere; Biome does not enforce this, so review for it
  (`git grep -nP 'text-brand(?![-\w])' -- apps packages` should find only a comment in the tokens).
- The shared components that carry text (`Dialog`, `Toast`, `MediaUploader`, `MediaPreview`,
  `FullPageSpinner`) call `useT()`, so they must be rendered inside `PreferencesProvider`. Both
  portals put it outermost in `App.tsx`.
- A portal's stored language is per origin: Teach and Support each remember their own.
- Favicons: portals ship `public/favicon.svg` + PNG fallbacks in their brand colour; the learner's
  `assets/images/favicon.png` is the green mark (Expo derives `favicon.ico` from it).
