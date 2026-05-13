-- =============================================================================
-- Pic Shift — extensions, audit immutability, RLS scaffolding
-- =============================================================================
-- This migration runs ONCE before Prisma's generated migrations. It enables the
-- Postgres extensions our schema depends on and installs DB-level guarantees
-- that the application layer cannot accidentally violate.
-- =============================================================================

-- Required extensions (enabled at DB level by Prisma, but kept here for clarity
-- and so the SQL is replayable on any fresh Postgres 16+ database).
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";
-- pgvector is optional (Phase 2 AI assistant). Enable if installed.
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS "vector";
EXCEPTION WHEN undefined_file THEN
  RAISE NOTICE 'pgvector not installed — AI knowledge base will be disabled';
END $$;

-- -----------------------------------------------------------------------------
-- Helper: set the current org context for RLS. Application calls this at the
-- start of every request after auth has resolved the user's org.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_set_current_org(_org_id text) RETURNS void AS $$
BEGIN
  PERFORM set_config('app.current_org_id', COALESCE(_org_id, ''), true);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION app_current_org() RETURNS text AS $$
BEGIN
  RETURN current_setting('app.current_org_id', true);
END;
$$ LANGUAGE plpgsql STABLE;
