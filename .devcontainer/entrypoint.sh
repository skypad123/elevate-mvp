#!/bin/sh
# Dev container entrypoint (runs as root): prepare volumes and SSH, then run sshd in the foreground.
set -eu

WORKSPACE=/workspaces/elevate-mvp

# Named volumes are created root-owned; hand the mount points to the `node` user.
for dir in "$WORKSPACE"/node_modules "$WORKSPACE"/apps/*/node_modules \
  "$WORKSPACE"/packages/*/node_modules /home/node/.claude; do
  if [ -d "$dir" ]; then chown node:node "$dir"; fi
done

# Host identity lives in a volume, so it survives image rebuilds.
if [ ! -f /etc/ssh/host_keys/ssh_host_ed25519_key ]; then
  ssh-keygen -q -t ed25519 -N '' -f /etc/ssh/host_keys/ssh_host_ed25519_key
fi

# The host's authorized_keys is mounted read-only; copy it so sshd sees root-owned 0644.
if [ -f /run/host-authorized-keys ]; then
  install -m 0644 -o root -g root /run/host-authorized-keys /etc/ssh/authorized_keys.d/node
else
  echo "dev-entrypoint: no authorized_keys mounted; SSH logins are disabled" >&2
  : > /etc/ssh/authorized_keys.d/node
fi

# SSH sessions do not inherit the container environment. Publish the Compose overrides through
# /etc/environment (read by pam_env) so `npm run dev` behaves the same over SSH as over exec.
: > /etc/environment
for name in DATABASE_URL SMTP_HOST API_URL LEARNER_URL TEACH_URL SUPPORT_URL DEV_HOST \
  REACT_NATIVE_PACKAGER_HOSTNAME CERTIFICATE_FALLBACK_FONTS VITEST_MAX_WORKERS; do
  if printenv "$name" > /dev/null; then
    printf '%s="%s"\n' "$name" "$(printenv "$name")" >> /etc/environment
  fi
done

exec /usr/sbin/sshd -D -e
