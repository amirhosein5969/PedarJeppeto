# syntax=docker/dockerfile:1
# =============================================================================
# Handcrafted Hearthwood — TanStack Start frontend
#
# Stage 1 (build)   : Bun installs dependencies and builds the app with
#                     NITRO_PRESET=node-server, producing a self-contained
#                     Nitro bundle in .output/.
# Stage 2 (runtime) : slim Node image serving .output/server/index.mjs
#                     on port 8080.
#
# Build (from repo root):   docker compose build frontend
# =============================================================================

# ---------- Stage 1: build ----------------------------------------------------
FROM oven/bun:1 AS build
WORKDIR /app

# Dependency manifests first (layer cache for code-only changes).
COPY package.json bun.lock* bunfig.toml* ./
RUN bun install --frozen-lockfile

# Application sources.
COPY . .

# The Nitro preset is a BUILD-TIME setting. The Lovable vite config defaults
# to the cloudflare target; node-server emits a plain Node bundle runnable
# with `node .output/server/index.mjs`.
ARG NITRO_PRESET=node-server
ENV NITRO_PRESET=${NITRO_PRESET}

# The API base URL the storefront calls. Wired into the build so it can be
# made env-driven later without changing the build pipeline.
ARG VITE_API_BASE_URL=http://localhost:8010/api/v1
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

RUN bun run build

# ---------- Stage 2: runtime ----------------------------------------------------
FROM node:22-alpine
WORKDIR /app

ENV NODE_ENV=production \
    NITRO_PORT=8080

# Nitro's self-contained output (server bundle + public assets).
# NOTE: no trailing slash on the source — `COPY /app/.output/. ./` would
# flatten the contents into /app instead of /app/.output.
COPY --from=build --chown=node:node /app/.output /app/.output

EXPOSE 8080
USER node

CMD ["node", ".output/server/index.mjs"]