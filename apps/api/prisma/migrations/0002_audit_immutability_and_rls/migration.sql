-- =============================================================================
-- Audit immutability + Row-Level Security policies
-- =============================================================================
-- Runs AFTER Prisma's generated migrations create the tables. The .sql file
-- name uses a high lexical order so Prisma executes it last.
-- =============================================================================

-- Audit log immutability: reject any UPDATE or DELETE on audit_log.
-- This is the cornerstone of our SOC 2 / Ghana DPA evidence trail.
CREATE OR REPLACE FUNCTION audit_log_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_log entries are immutable (op=%, id=%)', TG_OP, OLD.id
    USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_log') THEN
    DROP TRIGGER IF EXISTS audit_log_no_update ON audit_log;
    DROP TRIGGER IF EXISTS audit_log_no_delete ON audit_log;

    CREATE TRIGGER audit_log_no_update
      BEFORE UPDATE ON audit_log
      FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();

    CREATE TRIGGER audit_log_no_delete
      BEFORE DELETE ON audit_log
      FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- Row-Level Security policies
-- ----------------------------------------------------------------------------
-- We use RLS as defence-in-depth: even if application code forgets to filter
-- by organizationId, Postgres will enforce it. The session variable
-- `app.current_org_id` is set by middleware/orgContext.ts at request start.
-- ----------------------------------------------------------------------------

DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY[
    'employee_profiles',
    'pto_policies',
    'pto_requests',
    'shifts',
    'documents',
    'consent_records',
    'webhook_endpoints',
    'payroll_runs'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = tbl) THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
      EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tbl);

      EXECUTE format(
        'DROP POLICY IF EXISTS %I_org_isolation ON %I',
        tbl, tbl
      );

      -- The policy allows access only when the row's organizationId matches
      -- the session-scoped app.current_org_id. We allow an empty value to
      -- bypass for migrations / superuser tasks.
      EXECUTE format($p$
        CREATE POLICY %I_org_isolation ON %I
          USING (
            COALESCE(NULLIF(current_setting('app.current_org_id', true), ''), 'NO_ORG')
              IN (organization_id::text, 'NO_ORG')
          )
          WITH CHECK (
            COALESCE(NULLIF(current_setting('app.current_org_id', true), ''), 'NO_ORG')
              IN (organization_id::text, 'NO_ORG')
          )
      $p$, tbl, tbl);
    END IF;
  END LOOP;
END $$;
