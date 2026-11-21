# syntax=docker/dockerfile:1

# ---- builder: install all deps, compile, then prune to prod deps ----
# A single `npm ci` keeps peak build memory low (the Temporal SDK's native
# dependency is heavy); dev deps are pruned in place afterwards.
FROM node:20-bookworm-slim AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build
RUN npm prune --omit=dev

# ---- runtime: slim image with compiled output + prod deps ----
# Debian (glibc) is required: @temporalio/core-bridge ships prebuilt glibc
# binaries and will not run on Alpine/musl.
FROM node:20-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json ./
EXPOSE 3000
# Default command runs the API; docker-compose overrides it for the worker.
CMD ["node", "dist/api/server.js"]
