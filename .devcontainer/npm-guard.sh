#!/bin/sh
# /usr/local/bin/npm in the dev container links here: refuses to run npm when node_modules is
# the host's directory (see check-node-modules.sh). ELEVATE_SKIP_NODE_MODULES_CHECK=1 bypasses it.
if [ "${ELEVATE_SKIP_NODE_MODULES_CHECK:-}" != 1 ]; then
  /usr/local/bin/dev-check-node-modules || exit 1
fi
exec /usr/local/lib/node_modules/npm/bin/npm-cli.js "$@"
