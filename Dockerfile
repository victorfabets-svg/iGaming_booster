# Multi-stage Dockerfile for monorepo
# Same image serves both api and worker — Northflank service overrides CMD

# ---------- Builder ----------
FROM node:20-alpine AS builder
WORKDIR /repo

# Workspace manifests (cached layer)
COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/worker/package.json ./apps/worker/
COPY apps/web/package.json ./apps/web/

# Install everything (workspaces)
RUN npm install --workspaces --include-workspace-root

# Source
COPY shared ./shared
COPY apps/api ./apps/api
COPY apps/worker ./apps/worker

# Build api (tsc + tsc-alias) and worker (esbuild bundle)
RUN npm run build:api && npm run build:worker

# Strip dev deps for smaller production image
RUN npm prune --omit=dev --workspaces --include-workspace-root

# ---------- Runtime ----------
FROM node:20-alpine
WORKDIR /repo

# Copy node_modules + built artifacts from builder
COPY --from=builder /repo/node_modules ./node_modules
COPY --from=builder /repo/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /repo/apps/api/dist ./apps/api/dist
COPY --from=builder /repo/apps/api/package.json ./apps/api/package.json
COPY --from=builder /repo/apps/worker/dist ./apps/worker/dist
COPY --from=builder /repo/apps/worker/package.json ./apps/worker/package.json
COPY --from=builder /repo/shared ./shared
COPY --from=builder /repo/package.json ./package.json
COPY --from=builder /repo/tsconfig.base.json ./tsconfig.base.json

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8080

EXPOSE 8080

# Default CMD = api server. Worker service in Northflank overrides with:
#   CMD ["node", "apps/worker/dist/worker.js"]
CMD ["node", "apps/api/dist/apps/api/src/server/index.js"]
