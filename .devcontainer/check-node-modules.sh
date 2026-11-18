#!/bin/sh
# Exits non-zero unless every workspace's node_modules is its own mount (the named volumes in
# compose.yaml). Without them, node_modules is the host's directory through the source bind
# mount, and npm here would put Linux binaries (esbuild, rolldown, Biome, ...) into the host's
# node_modules, breaking `npm run dev` on the host. Used by the npm wrapper and the entrypoint.
set -u

WORKSPACE=/workspaces/elevate-mvp
missing=""

for pkg in "$WORKSPACE"/package.json "$WORKSPACE"/apps/*/package.json \
  "$WORKSPACE"/packages/*/package.json; do
  [ -f "$pkg" ] || continue
  dir="$(dirname "$pkg")/node_modules"
  if ! mountpoint -q "$dir"; then
    missing="$missing  ${dir#"$WORKSPACE"/}
"
  fi
done

[ -z "$missing" ] && exit 0

cat >&2 <<EOF
elevate dev container: these node_modules are not volumes, so they are the host's directories:
$missing
npm here would write Linux binaries into the host's node_modules. Recreate the container so
Docker mounts its volumes again (from the host):

  docker compose -f docker-compose.yml -f .devcontainer/compose.yaml up -d --force-recreate dev

or "Rebuild Container" in your editor. A workspace added under apps/ or packages/ also needs a
volume in .devcontainer/compose.yaml. See docs/runbooks/dev-container.md.
EOF
exit 1
