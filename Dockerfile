# syntax=docker/dockerfile:1

# ---- builder: install all deps and compile TypeScript ----
FROM node:20-bookworm-slim AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---- deps: production-only node_modules ----
FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ---- runtime: slim image with compiled output + prod deps ----
# Debian (glibc) is required: @temporalio/core-bridge ships prebuilt glibc
# binaries and will not run on Alpine/musl.
FROM node:20-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json ./
EXPOSE 3000
# Default command runs the API; docker-compose overrides it for the worker.
CMD ["node", "dist/api/server.js"]
