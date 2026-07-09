#!/bin/sh
# Container entrypoint: bring the schema up to date, then start the server.
# Migrations are idempotent (the runner treats "already exists" as success), so
# re-running on every boot is safe. A `memory://` DATABASE_URL is skipped by the
# migrate script (ephemeral) — hosted deploys should point at a real Postgres.
set -e

echo "[minitor] running database migrations…"
node scripts/db-migrate.mjs

echo "[minitor] starting server on ${HOSTNAME:-0.0.0.0}:${PORT:-3000}"
exec node server.js
