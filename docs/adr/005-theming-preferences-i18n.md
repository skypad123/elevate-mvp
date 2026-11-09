# ADR 005 — Per-portal palettes, device preferences and typed i18n

**Status:** accepted · 2026-11-09

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
  the `PreferencesCard` used by both portals' Settings pages. An inline script in each `index.html`
  applies the stored theme before first paint.
- Learner: `src/lib/preferences.tsx` + platform `preferences-storage(.web).ts`; `ThemeProvider`
  resolves `system | light | dark`, and the splash screen stays up until preferences are loaded.
- Not synced to the account for now. If that is wanted later: add `users.preferences jsonb`,
  `updateMeSchema.preferences = preferencesSchema.partial()`, and merge server values through the
  same `parseStoredPreferences` — the UI does not change.

### i18n is a small typed catalog package, `@elevate/i18n`

- `messages/en.ts` is the source of truth; its keys form `MessageKey`, so a typo in `t('…')` is a
  compile error. `catalogs: Record<Locale, Partial<Messages>>` forces one catalog per locale in
  `supportedLocales` and falls back to English at runtime. `{var}` interpolation only.
- Scope today: navigation chrome and the Settings/Preferences/Profile screens. Everything else stays
  English until keys are added. `test/catalog.test.ts` fails when a catalog has untranslated keys,
  unknown keys or mismatched placeholders.
- Chosen over i18next: two locales, a few dozen strings, three runtimes (Vite ×2, React Native), zero
  runtime dependencies, and compile-time key checking. If plurals/ICU or lazy namespaces become
  necessary, swap the body of `translate` for i18next; callers only use `useT()`.

## How to extend

- **New preference:** add a field with a `.default()` to `preferencesSchema`; add a `PreferenceRow`
  in `PreferencesCard` and a row in the learner Profile "Preferences" card. Old stored JSON keeps
  parsing.
- **New language:** append to `supportedLocales`, add `messages/<locale>.ts`, add a `localeNames`
  entry. Typecheck and the catalog test guide the rest.
- **New palette or colour tweak:** edit `portalPalettes` and run `npm -w @elevate/tokens run build`;
  the palettes test checks contrast.

## Consequences

- `@elevate/tokens` must be built before the portals compile CSS (turbo `^build` already does this).
- `text-brand` is no longer used for text anywhere; Biome does not enforce this, so review for it.
- Favicons: portals ship `public/favicon.svg` + PNG fallbacks in their brand colour; the learner's
  `assets/images/favicon.png` is the green mark (Expo derives `favicon.ico` from it).
