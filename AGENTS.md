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
  `production` deploy on push via `.github/workflows/deploy.yml`; `main` is local-only dev.
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
- Translated pages (the whole learner app, navigation, Settings/Preferences/Profile, the Teach
  dashboard and start page, the teaching-profile screens of Teach and Support, their sign-in and
  verify pages, and Teach's personal application) have no English literals: a new string there is a key in that page's area (a learner screen's in a `learner*` area),
  `packages/i18n/src/messages/areas/<area>.en.ts` and `<area>.zh.ts`. A message is a whole sentence;
  enum labels, plurals, sentences with links, dates, lists and error text (`useErrorMessage()`)
  follow the patterns in `docs/adr/008-*`. A page may map an `error.code` it knows to a message
  key; the server's message is the fallback. Other pages are English until one is translated whole.
- The learner app words API errors from their codes, never from the API's English `message`: an
  error a learner can reach has a code in `USER_ERROR_CODES` (`packages/core/src/contracts/errors.ts`)
  and a message `apiError.<code>`, one code per meaning, with variable parts in `details` (ADR 010).
- No inline `<script>` in a portal's `index.html`: the deployed sites send `script-src 'self'`.
  The pre-paint theme script is `public/preferences-init.js`.
- Learner unit tests use jest-expo (`npm -w @elevate/learner test`, files under `src/**/__tests__`); the
  AsyncStorage jest mock is wired in `apps/learner/jest.setup.ts`. Device flows live in `.maestro/` (manual).
- Teaching is not a platform role. A teacher is whoever owns (or belongs to) a teaching profile;
  `user_roles` holds staff roles only. Courses, payments and course media belong to a profile.
- Every Teach API route lives under `/teach/profiles/:profileId` and uses `requireProfile` with a
  capability from the route table in `docs/designs/teacher-profiles.md` (item 1.15), or, for the
  class routes, in `docs/designs/scheduled-classes-attendance.md`; the Teach portal mirrors it
  under `/p/:profileId`. The role table is `packages/core/src/domain/permissions.ts`;
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
- Learner emails: the receipt, certificate, refund and second-payment refund emails use
  `users.locale ?? 'en'`; the sign-in code email uses the request's `locale`. See ADR 010. A new
  string in a learner email is a key in the `email` area. Teacher and Support emails stay English.
- A course's hover-preview clip is made, replaced or cleared only by `CoursePreviewService`. A clip
  always gets a new `public/previews/` key, because public files are cached as immutable. A direct
  edit to a live course's lessons or items finishes through `CoursesService.edited`, which deletes a
  clip whose video has left the course; nothing checks that again when the catalog is read
  (ADR 011).
- Only `attendance.service.ts` inserts into `attendance_events` and `attendance_event_locations`,
  and nothing updates or deletes `attendance_events`; a correction is a new row
  (`apps/api/test/class-guards.test.ts`, ADR 012). The one delete is `eraseCoordinates`, which
  removes a learner's `attendance_event_locations` rows on request and records it.
- A learner-facing read of an enrollment goes through `deps.learnerDb`, whose `enrollments` is the
  `self_paced_enrollments` view, so a class enrollment is never found there. A full-client lookup
  by learner and course adds `classId: { isNull: true }`.
- A lookup of a class for Teach goes through `ClassesService.load`, which filters by the actor's
  profile (and a writer's assignment) in the same query and answers 404 when no row matches.
- The API runs as the database user `elevate_api`, which owns no table, cannot create one and
  cannot update or delete `attendance_events`; the API tests run as it too. Anything that needs
  the owner, such as a migration or `reset-schema.js`, runs from the migration task
  (`infra/README.md`).
- A refund of a class seat is a `seat_refunds` row written by `SeatRefundsService.request`. Its
  amounts come only from `seatRefund()`, and a profile's share of a payment after refunds only from
  `profileShareAfterRefunds()`, both in `money.ts` (ADR 013).
- No request handler calls Stripe to refund, reverse or pay out for a class seat: only the release
  job does, through `SeatRefundsService.send` and `PayoutsService`. Support's "Refund in full"
  (`TransactionsService.refund`) is the one exception and is refused while a seat refund is
  unfinished. Only `PayoutsService` creates a payout or sets `released_run_id` or `payout_id`.
- `seatsTaken` in `class-checkout.service.ts` is the only count of a class's seats. Only
  `class-checkout.service.ts` and `seats.service.ts` set an enrollment's `class_id`
  (`class-guards.test.ts`). A transaction that locks a class and an enrollment locks the class
  first.
- "Attended", in a money rule, means counted as attended by `moneyAttendance` in `packages/core`,
  not any check-in or mark.
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

<!-- BEGIN AWS Agent Toolkit rules -->

# AWS Guidance for the new AWS experience

This user has signed up for the new AWS experience. This experience lets you sign into AWS using a social provider and requires the following additional context.

Where this guidance conflicts with the project's own instructions, the project's instructions take precedence.

## Context

### Terminology:

- Say "project" instead of "account" — a project contains an AWS account and settings for sharing with other collaborators
- Say "team member" instead of "IAM user" — users are invited by email, not created or federated in IAM
- Say "AWS Settings" when referring to management tasks at [settings.aws.com](https://settings.aws.com/) (project management, billing, team members, spend limits). Users view their actual AWS resources in the AWS Management Console.
- Say "selected Region" when referring to the user's Region — not "home Region"
- The user has a managed IAM experience. This includes a managed service control policies (SCP) and resource control policies (RCP) that govern the use of AWS. They will still need to use IAM to create policies to let services work with each other. If there are questions about the SCPs or RCPs, go to the documentation at https://docs.aws.amazon.com/accounts/latest/reference/scps-and-rcps-for-projects.html

### Constraints:

- All projects share a single AWS Region determined by the user's contact address. Resources cannot be created in other Regions
- When developing:
  - MUST create all Regional resources in the project's assigned Region
  - You CAN create AWS WAF and Cloudwatch Logs resources in us-east-1 when there are global resources (like a global WAF instance) that require a connection to dependencies in us-east-1. You should not use these for any other reason, because resources in the selected Region will provide lower cost (due to no cross-Region traffic), increased availability (due to no cross-Region traffic), and easier manageability (due to not needing to look in another Region). When you need to do an inventory of resources, you need to look in both the selected Region and us-east-1 for Cloudwatch Logs or WAF resources.
  - MUST NOT attempt to create Lambda, API Gateway, or other Regional resources in any other Region
  - MUST direct users to confirm their Region in AWS Settings > View all projects > Overview > Additional Info > Region. If the user cannot confirm their Region, check in ~/.aws/config
  - MUST NOT use Lambda@Edge — excluded from both Lambda and CloudFront
  - MUST NOT use CloudFormation StackSets — no multi-account or multi-Region deployments
  - MUST NOT attempt cross-Region actions — no cross-Region replication for DynamoDB/S3/RDS, no multi-Region KMS keys
  - MUST NOT use Route 53 cross-Region routing — geolocation, latency-based, and failover routing policies are not available
  - CloudFront is a global service and its actions ARE allowed in `us-east-1`. A user can create a CloudFront distribution pointing to their project-region Lambda function URL or API Gateway. However, Lambda and API Gateway themselves MUST NOT be created in `us-east-1` — they must be in the project Region.
  - Reduced availability in `eu-north-1` specifically: Amazon Rekognition, Amazon Textract, Amazon Personalize, AWS App Runner are not available in that Region.
- IAM permissions for human access are managed by AWS. Don't assign roles to team members unless absolutely necessary
- The user may have a spend limit if they are on the paid plan. The limit that pauses their project if it's exceeded. If resources suddenly become inaccessible, ask if they have a spend limit configured. Only project owners can modify a spend limit.
- When developing:
  - MUST ask about spend limit status if the user reports sudden "Access Denied" errors on operations that previously worked
  - MUST direct users to check spend status in AWS Settings > Billing
  - MUST check if a user has upgraded their account to the paid plan
  - MUST ask the user if they want to clean up the successfully created resources or keep them to reduce cost
- The user sets up billing, creates spend limits, and retrieves and pays invoices in AWS Settings. The user creates budgets and optimizes their costs in the AWS Billing and Cost Management console
- Not all AWS services are available. If a service isn't working, do the following:
  1. Run the command `aws freetier get-account-plan-state`
  2. If accountPlanType": "FREE", check the [Free Tier supported services list](https://docs.aws.amazon.com/accounts/latest/reference/supported-services-sign-up-new.html#supported-services-free-tier) next,
  3. If accountPlanType": "PAID", check the [Paid Tier supported services list](https://docs.aws.amazon.com/accounts/latest/reference/supported-services-sign-up-new.html#supported-services-paid-plan).
  4. If neither list shows the service, check the [Not supported for this experience list](https://docs.aws.amazon.com/accounts/latest/reference/supported-services-sign-up-new.html#unsupported-services). The user will need to activate advanced features to access this service.
- Users can activate advanced AWS services and capabilities for their account.
- For any AWS task or question — building, configuring, migrating, debugging, or operating a service, writing SDK code, authoring CDK/CloudFormation, or answering how a service works — first call `aws___search_documentation` with topic `agent_skills` and load the matching skill with `aws___retrieve_skill`. Do this even when you believe you know the answer: skills carry current service behavior that your training may not. Prefer the skill's guidance over general knowledge. Skip it only for work that does not involve AWS.

### Help level

- help_level (required): LOW, MEDIUM, or HIGH. While a user is building, you MUST ask the user: "How much guidance would you like from me? Low (I only flag security risks), medium (I ask a couple of clarifying questions if something seems off), or high (I explain what I'm doing, suggest alternatives, and flag best practices)."

You CAN update this rule file to save a user's help_level.

Constraints for each level:

**LOW:**

- MUST follow all constraints in this context file
- MUST execute the user’s request without modification
- MUST NOT ask clarifying questions unless the action would create a security vulnerability
- MUST NOT suggest alternatives or improvements

**MEDIUM:**

- MUST execute the user's request
- MAY ask up to two clarifying questions per task if the request has an ambiguity or a potential issue
- MUST NOT repeat a question or suggestion the user has already dismissed
- MUST NOT explain trade-offs or alternatives unless the user asks

**HIGH:**

- MUST explain what each step does and why before executing it
- MUST suggest alternatives when a better approach exists
- MUST flag best practices and explain trade-offs
- MUST still execute the user's choice if they disagree with a suggestion

<!-- END AWS Agent Toolkit rules -->
