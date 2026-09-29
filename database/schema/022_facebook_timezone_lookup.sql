-- ============================================================================
-- Pickixo — 022_facebook_timezone_lookup.sql
-- A time zone lookup that does not read the time zone database from disk.
--
-- 021's agent_page_timezone() checked the setting against pg_timezone_names.
-- That view is built by reading every zone file on each query: ~0.5 s on this
-- server for 598 zones. best_posting_hours called the function once per post,
-- and at 17 posts the agent's observe step hit the 15 s statement timeout.
--
-- The check is now "can Postgres convert a time into this zone?", which uses
-- the zone cache and costs microseconds. An unknown zone raises 22023
-- (invalid_parameter_value) and falls back to UTC, exactly as before.
--
-- Same signature, return value and grant as 021, so every caller is unchanged.
-- ============================================================================

CREATE OR REPLACE FUNCTION agent_page_timezone(p_page_id uuid)
RETURNS text
LANGUAGE plpgsql STABLE AS $$
DECLARE
    v_tz text;
BEGIN
    SELECT s.posting_timezone INTO v_tz
      FROM facebook_agent_settings s
     WHERE s.page_id = p_page_id;

    IF v_tz IS NULL OR v_tz = '' THEN
        RETURN 'UTC';
    END IF;

    PERFORM now() AT TIME ZONE v_tz;
    RETURN v_tz;
EXCEPTION
    WHEN invalid_parameter_value THEN
        RETURN 'UTC';
END;
$$;

GRANT EXECUTE ON FUNCTION agent_page_timezone(uuid) TO pickixo_app;
