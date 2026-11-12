# Elevate — agent notes

## Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v58.0.0/ before writing any Expo code.
This repo is on **SDK 58** (React Native 0.88, React 19.3): inside `apps/learner`, add packages only
with `npx expo install <pkg>` so versions come from SDK 58's bundled module list.

## Repo map

- `apps/learner` — Expo (expo-router) learner app: web + iOS + Android.
- `apps/teach` — Vite + React teacher portal. `apps/support` — Vite + React internal portal.
- `apps/api` — Hono API (Drizzle, Stripe, Mux, pdf-lib). Exports `@elevate/api/client` for typed RPC.
- `packages/core` — zod contracts + pure domain logic (DAG, money, grading, lesson states, permissions).
- `packages/db` — Drizzle schema, migrations, seed. `packages/tokens` — design tokens → CSS, plus
  per-portal palette overrides (`portal-teach.css`, `portal-support.css`).
- `packages/web-ui` — Radix + Tailwind components for the two web portals; `./preferences` holds the
  shared PreferencesProvider/PreferencesCard. `packages/i18n` — typed message catalogs (`en`, `zh`).
- `infra/terraform` — AWS staging and production (see `infra/README.md`). Branches `staging` and
  `production` deploy on push via `.github/workflows/deploy.yml`; `main` and `v0` are local-only dev.
- `docs/spec.md` is the product spec; `docs/adr/` records the architecture decisions.

## Rules

- One copy of `react`, `react-dom`, `react-native`, `react-native-svg`, `react-native-worklets`, `hono`, `zod`,
  `drizzle-orm`: pinned via root `overrides` (React versions follow the Expo SDK); `npm run check:dupes` and
  `expo-doctor` verify.
- `react-router` stays on 7.x (8.x needs a newer React than Expo ships). `typescript` stays `~6.0.3`.
- Every API handler returns `c.json(body, 200)` with an explicit status so RPC response types narrow.
- Money is integer cents; the only fee computation lives in `packages/core/src/domain/money.ts`.
- Course status can reach `live` only through the Support approve route.
- Brand colour as text/icon is `text-brand-fg`; as a fill it is `bg-brand` + `text-brand-ink`.
  Never `text-brand` (Support's yellow fails contrast as text). See `docs/adr/008-*`.
- New user preference = a field with a `.default()` in `packages/core/src/contracts/preferences.ts`
  plus a row in `PreferenceRows` (web) and the learner Profile card.
- Translated pages (navigation, Settings/Preferences/Profile, and the teaching-profile screens of
  Teach and Support) have no English literals: a new string there is a key in that page's area,
  `packages/i18n/src/messages/areas/<area>.en.ts` and `<area>.zh.ts`. A message is a whole sentence;
  enum labels, plurals, sentences with links, dates, lists and error text (`useErrorMessage()`)
  follow the patterns in `docs/adr/008-*`. Other pages are English until one is translated whole.
- No inline `<script>` in a portal's `index.html`: the deployed sites send `script-src 'self'`.
  The pre-paint theme script is `public/preferences-init.js`.
- Learner unit tests use jest-expo (`npm -w @elevate/learner test`, files under `src/**/__tests__`); the
  AsyncStorage jest mock is wired in `apps/learner/jest.setup.ts`. Device flows live in `.maestro/` (manual).
- Teaching is not a platform role. A teacher is whoever owns (or belongs to) a teaching profile;
  `user_roles` holds staff roles only. Courses, payments and course media belong to a profile.
- Every Teach API route lives under `/teach/profiles/:profileId` and uses `requireProfile` with a
  capability from the route table in `docs/designs/teacher-profiles.md` (item 1.15); the Teach
  portal mirrors it under `/p/:profileId`. The role table is `packages/core/src/domain/permissions.ts`;
  a new route also needs a row in `apps/api/test/role-routes.test.ts`.
- A lookup of a course, lesson or artefact for Teach filters by the actor's profile in the same
  query and answers 404 when it is not there. Money queries select payments by `payout_account_id`.
- `lessons`, `artefacts`, `quizzes` and `lesson_prerequisites` hold a writer's draft rows beside
  the live ones (a row with a `change_set_id` is a draft). Only `courses.service.ts` and
  `change-sets.service.ts` touch those tables. Everything a learner is shown or sold reads the live
  views through `deps.learnerDb`, whose relation keys are `liveLessons`, `liveArtefacts`,
  `liveQuiz` and `livePrerequisites`; `apps/api/test/schema-guard.test.ts` fails on anything else.
- Course media belongs to a profile. A file put on a course is looked up with
  `MediaService.getProfileAsset(profileId, id)`, so one profile's media cannot go on another's
  course; uploads for a course send `profileId`.
- A payout account's status is decided only by `ConnectService.applyAccountState` (via
  `payoutStatus`): a company account needs a recorded legal-name match as well as charges. A
  profile's owner changes only through `RecoveryService` (Support, `super_admin`).
- Text that a person typed (names, titles, notes) goes into an email only through `simpleEmail`,
  which escapes it. Invitations reach addresses that are not Elevate users yet.
- Run `npm run lint` (Biome) and `npx turbo run typecheck test` before committing.

## Expo conventions (apps/learner)

- Routes live in `src/app/`; keep components, hooks and lib code outside it (`src/ui`, `src/lib`, `src/features`).
- Import `Link`, `router`, `useLocalSearchParams`, `ThemeProvider`, `Stack`, `Tabs` from `expo-router`; never from `@react-navigation/*`.
- `npx expo install <pkg>` for anything Expo/React Native; `npx expo install --fix` and `npx expo-doctor` to diagnose.
- `ios/` and `android/` are generated (CNG). Configure native behaviour in `app.json` and config plugins only.
- Expo Go only has its bundled native modules; a library with native code needs a dev build.
- React Native's strict TypeScript API is on: style types are readonly (build styles up with
  `MutableTextStyle` from `src/theme`), refs use instance types such as `TextInputInstance`, and
  `react-native/Libraries/*` deep imports are off-limits.

## Drizzle conventions (packages/db, apps/api)

The repo is on **Drizzle 1.0**: `drizzle-orm` and `drizzle-kit` are pinned to exactly `1.0.0-rc.5`. Code written
for 0.x does not compile here; see https://orm.drizzle.team/docs/relations-v1-v2 and
https://orm.drizzle.team/docs/rqb-v2.

- Move the pins only on purpose and together: root `overrides`, root `devDependencies` (the root entry is what
  keeps `drizzle-orm` to one copy), `packages/db` and `apps/api`.
- Tables are `snakeCase.table(...)` and views `snakeCase.view(...)` from `drizzle-orm/pg-core`; there is no
  global `casing` option. All relations live in the one `defineRelations` call in
  `packages/db/src/schema/relations.ts`.
- `db.query.*` takes object filters, such as `where: { id }`, `{ consumedAt: { isNull: true } }` and
  `{ OR: [...] }`, and `orderBy: { createdAt: 'desc' }`. Never pass `undefined` as a filter or a filter value:
  it compiles and then throws. Leave the key out, or return `EmptyFilter`.
- SQL expressions inside a filter go in `RAW: (table) => ...` and must use the callback's `table`, not the
  imported one, because the query aliases its table.
- Migrations are folders, `packages/db/drizzle/<timestamp>_<name>/` with `migration.sql` and `snapshot.json`.
  Generate them with `npm run db:generate -- --name <name>`, never `drizzle-kit generate` directly: the
  script also keeps the `CREATE EXTENSION` lines in the `init` migration. There are no numbered `.sql`
  files and no `meta/` folder.
