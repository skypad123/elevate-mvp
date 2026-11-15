# Dev container

A Linux container with Node 24, npm 11 and the repo tooling, running next to Postgres and Mailpit in
the same Compose project. It turns one always-on machine (for example a Mac mini with Docker
Desktop) into the development environment: editors and terminals attach to it over SSH, and the apps
it serves are reachable from other devices.

Running on the host (`npm run dev`, see [local-dev.md](local-dev.md)) keeps working; the two share
the source tree, `.env`, the database and the published ports, so run one or the other, not both.

## Start

```bash
npm run container:up      # build the image, start elevate-dev (and db + mail if they are stopped)
npm run container:shell   # shell inside it as the `node` user
npm ci                    # first time only, inside the container
npm run dev               # api :4400 · learner :8081 · teach :5173 · support :5174
```

`container:up` is `docker compose -f docker-compose.yml -f .devcontainer/compose.yaml up -d --build
dev`. The container restarts with Docker (`restart: unless-stopped`); enable "Start Docker Desktop
when you sign in" for it to survive a reboot.

## How it is put together

- **Source** is bind-mounted at `/workspaces/elevate-mvp`. Every `node_modules` directory is a named
  volume, so Linux and host binaries (esbuild, Rollup, Tailwind, Biome) never mix. Run `npm ci`
  again inside the container after the lockfile changes.
- **Environment**: the repo-root `.env` is used as is. The Compose file overrides what differs in
  the container (`DATABASE_URL` → `db`, `SMTP_HOST` → `mail`, the `*_URL` values → `DEV_HOST`);
  real environment variables win over `node --env-file`. The same values reach SSH sessions through
  `/etc/environment`.
- **`DEV_HOST`** in `.env` is the hostname other devices use for this machine (a LAN or tailnet
  name). Links in emails point at it and Vite accepts it as a `Host` header. Leave it unset for
  localhost-only use.
- **Tests** run with `VITEST_MAX_WORKERS=2` (`DEV_TEST_WORKERS` in `.env` to change it): each worker
  holds its own PGlite database, and one per core gets the API tests OOM-killed in an 8 GB Docker VM.

## Connecting from another machine

The container runs its own SSH server, published on port 2222 (`DEV_SSH_PORT`): keys only, user
`node`, no root login. It accepts the keys in the host's `~/.ssh/authorized_keys` (override the
file with `DEV_AUTHORIZED_KEYS`); restart the container after adding a key.

```bash
ssh -p 2222 node@<host>
```

- **Zed**: `zed ssh://node@<host>:2222/workspaces/elevate-mvp`, or add the host under
  "Connect to SSH server". Language servers, terminals and tasks run inside the container.
- **VS Code**: Remote-SSH to `node@<host>:2222`, or on the machine itself "Reopen in Container"
  (`.devcontainer/devcontainer.json`).
- **Browser / phone**: `http://<host>:5173` (Teach), `:5174` (Support), `:8081` (Learner),
  `:8025` (Mailpit). The apps find the API on the same hostname, port 4400.

Over a private network such as Tailscale, `<host>` is the machine's tailnet name and nothing is
exposed publicly. The published ports are also reachable from the local network.

## Limits

- iOS and Android native builds and simulators need the macOS host. The container covers the API,
  the portals, Expo web and Metro (Expo Go connects to `DEV_HOST`).
- Git worktrees created on the host use host paths and are not usable from inside the container.
- Certificate fallback fonts: put the files in `apps/api/assets/fonts/fallback/`; a host font path
  in `CERTIFICATE_FALLBACK_FONTS` is ignored in the container.
- Git credentials and `gh auth login` are per container home and are not copied from the host.
