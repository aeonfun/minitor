# syntax=docker/dockerfile:1
# Minitor production image — one artifact that Railway, Render, Fly, and any
# Docker host can build straight from source. Pairs with a Postgres database
# (docker-compose bundles one; Railway/Render provide a managed one).

# ---- deps: install all deps (incl. dev) for the build ----
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- builder: produce the standalone Next.js server ----
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Build in hosted mode. NEXT_PUBLIC_MINITOR_HOSTED is inlined into the client
# bundle here (build-time only), so the Settings dialog renders read-only.
# DATABASE_URL=memory:// guarantees the build never touches disk or a real DB
# (the app instantiates its DB client at import time).
ENV NEXT_TELEMETRY_DISABLED=1 \
    NEXT_PUBLIC_MINITOR_HOSTED=1 \
    DATABASE_URL=memory://
RUN npm run build

# ---- runner: minimal image, runs migrations then the server ----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    MINITOR_HOSTED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

# Standalone server + its assets (static + public aren't bundled into it).
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
# The migration runner isn't part of the app's trace, so copy it and the SQL
# explicitly. It reuses the DB drivers already present in standalone/node_modules.
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/docker-entrypoint.sh ./docker-entrypoint.sh

RUN chmod +x ./docker-entrypoint.sh && chown -R nextjs:nodejs /app
USER nextjs

EXPOSE 3000
# Runs `db:migrate` against DATABASE_URL, then starts the standalone server.
ENTRYPOINT ["./docker-entrypoint.sh"]
