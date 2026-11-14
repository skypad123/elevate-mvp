# syntax=docker/dockerfile:1
# Build from the repo root:  docker build -f apps/api/Dockerfile -t elevate-api .
#
# The image runs the API (`node dist/server.js`, the default) and the one-off migration task
# (`node dist/migrate.js`) that the deploy pipeline starts before rolling a new version.

FROM node:24-bookworm-slim AS base
WORKDIR /app
ENV NPM_CONFIG_UPDATE_NOTIFIER=false NPM_CONFIG_FUND=false NPM_CONFIG_AUDIT=false

# ── bundle: dist/server.js + dist/migrate.js with the workspace packages inlined ──
FROM base AS build
COPY . .
RUN npm ci --workspace @elevate/api --include-workspace-root
RUN npm run build --workspace @elevate/api

# ── production node_modules for the API workspace only ──
FROM base AS deps
COPY . .
RUN npm ci --omit=dev --workspace @elevate/api \
  && mkdir -p apps/api/node_modules

FROM base AS runtime
ENV NODE_ENV=production \
  API_PORT=4400 \
  MIGRATIONS_DIR=/app/packages/db/drizzle \
  NODE_EXTRA_CA_CERTS=/app/rds-global-bundle.pem

# Amazon RDS certificate authorities, so `sslmode=verify-full` works against RDS.
ADD --chmod=644 https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem \
  /app/rds-global-bundle.pem

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY apps/api/package.json ./apps/api/package.json
COPY apps/api/assets ./apps/api/assets
COPY packages/db/drizzle ./packages/db/drizzle

USER node
WORKDIR /app/apps/api
EXPOSE 4400
CMD ["node", "dist/server.js"]
