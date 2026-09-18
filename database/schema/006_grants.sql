-- ============================================================================
-- Pickixo — 006_grants.sql
-- What the application role is allowed to touch.
--
-- The API connects as pickixo_app, which is not a superuser and does not own
-- these tables. It gets exactly the verbs it needs and nothing structural: it
-- cannot DROP, ALTER or TRUNCATE anything, so a SQL injection that slips past
-- parameterised queries still cannot destroy the schema.
--
-- Ownership checks live in the API query layer (every user-scoped statement
-- carries its own user_id predicate). Row-level security is the next hardening
-- step and is tracked in docs/SECURITY.md — it is deliberately not claimed here,
-- because it is not yet in place.
-- ============================================================================

GRANT CONNECT ON DATABASE pickixo TO pickixo_app;
GRANT USAGE  ON SCHEMA public     TO pickixo_app;

-- Read/write on data the application manages.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO pickixo_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO pickixo_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO pickixo_app;

-- Anything created later gets the same treatment, so a new migration does not
-- silently leave the application unable to read its own new table.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO pickixo_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO pickixo_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT EXECUTE ON FUNCTIONS TO pickixo_app;

-- The application must never rewrite its own privileges or the audit trail.
REVOKE UPDATE, DELETE ON audit_logs FROM pickixo_app;

-- Deleting a users row would cascade away sessions, My Apps and activity. The
-- account-deletion path sets status = 'deleted' instead; a real erase is an
-- admin operation run as the owner.
REVOKE DELETE ON users FROM pickixo_app;

-- Nobody but the owner creates objects in public.
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
