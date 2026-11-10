# Device flows (Maestro)

End-to-end flows for the learner app's native behaviour that unit tests cannot cover: the stored
theme being applied from the first frame after a cold relaunch, and preferences persisting through
AsyncStorage.

## Prerequisites

- [Maestro CLI](https://maestro.mobile.dev) (`curl -Ls "https://get.maestro.mobile.dev" | bash`).
- A dev build of the learner app on a simulator/emulator: `cd apps/learner && npx expo run:ios`
  (or `run:android`). Bundle id / package: `sg.elevate.learner`.
- The API running locally with `DEV_ENDPOINTS_ENABLED=true` (the default `.env`), seeded with
  `npm run db:seed` so `learner@example.com` exists.

## Run

```bash
maestro test .maestro/learner-preferences.yaml
```

Android emulator: `-e API_URL=http://10.0.2.2:4400`. Screenshots land in the current directory.

## What is asserted

- `app-root-<scheme>` testID on the root view (`apps/learner/src/app/_layout.tsx`) reports the
  resolved colour scheme; it is checked immediately after each relaunch.
- The selected chip exposes `accessibilityState.selected`, so `selected: true` assertions work.
- Translated labels (`我的学习`, `偏好设置`) confirm the language preference survived the relaunch.

The flow ends by restoring `System` and `English`.

## Unit tests

The AsyncStorage path and the `ready` gate are unit-tested with jest-expo in
`apps/learner/src/lib/__tests__/preferences.test.tsx` (`npm -w @elevate/learner test`), which runs
in CI. Maestro flows are run manually or from an EAS Workflow with a `maestro` job.
