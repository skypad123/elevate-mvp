# Elevate dev container: Node + tooling on Linux, with an SSH server so editors (Zed, VS Code,
# JetBrains) and terminals can attach from another machine. See docs/runbooks/dev-container.md.
FROM node:24-bookworm

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    gh less openssh-server postgresql-client procps ripgrep sudo \
  && rm -rf /var/lib/apt/lists/* /etc/ssh/ssh_host_* \
  && mkdir -p /run/sshd /etc/ssh/host_keys /etc/ssh/authorized_keys.d \
  && echo 'node ALL=(ALL) NOPASSWD:ALL' > /etc/sudoers.d/node \
  && chmod 0440 /etc/sudoers.d/node

# Same npm as `packageManager` in the root package.json.
RUN npm install -g npm@11.19.1 @anthropic-ai/claude-code

# Keys only, one user, host keys kept in a volume so rebuilds do not change the host identity.
RUN printf '%s\n' \
    'PasswordAuthentication no' \
    'KbdInteractiveAuthentication no' \
    'PermitRootLogin no' \
    'AllowUsers node' \
    'AuthorizedKeysFile /etc/ssh/authorized_keys.d/%u' \
    'HostKey /etc/ssh/host_keys/ssh_host_ed25519_key' \
    > /etc/ssh/sshd_config.d/elevate.conf \
  && git config --system --add safe.directory /workspaces/elevate-mvp

COPY entrypoint.sh /usr/local/bin/dev-entrypoint
RUN chmod 0755 /usr/local/bin/dev-entrypoint

WORKDIR /workspaces/elevate-mvp
ENTRYPOINT ["/usr/local/bin/dev-entrypoint"]
