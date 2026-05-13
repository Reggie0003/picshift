#!/usr/bin/env bash
# Initialise a brand-new Postgres database with the extensions Pic Shift needs.
# Idempotent — safe to run repeatedly.
set -euo pipefail
: "${DATABASE_URL:?required}"

psql "$DATABASE_URL" <<'SQL'
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS vector;
EXCEPTION WHEN undefined_file THEN
  RAISE NOTICE 'pgvector not installed — AI features will be disabled';
END $$;
SQL
echo "[init-postgres] extensions ready"
