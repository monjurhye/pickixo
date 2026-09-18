-- ============================================================================
-- Pickixo — 005_functions.sql
-- Triggers and the operations that must be atomic.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- touch_updated_at — keep updated_at honest without trusting callers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END $$;

DO $$
DECLARE t text;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'users', 'identities', 'user_settings', 'app_categories', 'apps',
        'user_apps', 'ai_providers'
    ] LOOP
        EXECUTE format(
            'DROP TRIGGER IF EXISTS %I ON %I; '
            'CREATE TRIGGER %I BEFORE UPDATE ON %I '
            'FOR EACH ROW EXECUTE FUNCTION touch_updated_at()',
            t || '_touch', t, t || '_touch', t);
    END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- guard_user_privileges — a user can never promote themselves
--
-- Enforced here rather than in the API, because application code is exactly
-- what an attacker who finds a mass-assignment bug gets to run. Role and status
-- changes must set pickixo.privileged, which only the admin path does.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION guard_user_privileges() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.role IS DISTINCT FROM OLD.role
       AND current_setting('pickixo.privileged', true) IS DISTINCT FROM 'on' THEN
        RAISE EXCEPTION 'role may not be changed through this path';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status
       AND current_setting('pickixo.privileged', true) IS DISTINCT FROM 'on' THEN
        RAISE EXCEPTION 'status may not be changed through this path';
    END IF;
    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS users_guard_privileges ON users;
CREATE TRIGGER users_guard_privileges BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION guard_user_privileges();

-- ---------------------------------------------------------------------------
-- consume_quota — take one unit, atomically, or refuse
--
-- The INSERT ... ON CONFLICT ... WHERE is the whole point: the row is created
-- and incremented in one statement, and the WHERE clause means two concurrent
-- requests for the last remaining unit cannot both succeed. Returns the state
-- after the attempt, so the caller needs no second query.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION consume_quota(
    p_user_id   uuid,
    p_guest_key bytea,
    p_kind      text,
    p_limit     integer
) RETURNS TABLE (allowed boolean, used integer, quota_limit integer)
LANGUAGE plpgsql AS $$
DECLARE
    v_day  date := (now() AT TIME ZONE 'utc')::date;
    v_used integer;
BEGIN
    IF num_nonnulls(p_user_id, p_guest_key) <> 1 THEN
        RAISE EXCEPTION 'exactly one of user_id or guest_key is required';
    END IF;

    IF p_user_id IS NOT NULL THEN
        INSERT INTO usage_counters (user_id, kind, day, used)
        VALUES (p_user_id, p_kind, v_day, 1)
        ON CONFLICT (user_id, kind, day) WHERE user_id IS NOT NULL
        DO UPDATE SET used = usage_counters.used + 1
        WHERE usage_counters.used < p_limit
        RETURNING usage_counters.used INTO v_used;
    ELSE
        INSERT INTO usage_counters (guest_key, kind, day, used)
        VALUES (p_guest_key, p_kind, v_day, 1)
        ON CONFLICT (guest_key, kind, day) WHERE guest_key IS NOT NULL
        DO UPDATE SET used = usage_counters.used + 1
        WHERE usage_counters.used < p_limit
        RETURNING usage_counters.used INTO v_used;
    END IF;

    IF v_used IS NULL THEN
        -- The conflict target matched but the WHERE refused: already at limit.
        SELECT uc.used INTO v_used FROM usage_counters uc
        WHERE uc.kind = p_kind AND uc.day = v_day
          AND (uc.user_id = p_user_id OR uc.guest_key = p_guest_key);
        RETURN QUERY SELECT false, coalesce(v_used, p_limit), p_limit;
    ELSE
        RETURN QUERY SELECT true, v_used, p_limit;
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- release_quota — give a unit back when the work never happened
--
-- Called when every provider failed, so a user is not charged for an outage
-- that was ours. Never drops below zero.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION release_quota(
    p_user_id uuid, p_guest_key bytea, p_kind text
) RETURNS void
LANGUAGE sql AS $$
    UPDATE usage_counters
       SET used = greatest(used - 1, 0)
     WHERE kind = p_kind
       AND day = (now() AT TIME ZONE 'utc')::date
       AND (user_id = p_user_id OR guest_key = p_guest_key);
$$;

-- ---------------------------------------------------------------------------
-- record_app_use — Recently Used, in one round trip
--
-- Updates the per-user stat, the global counter and the activity log together,
-- so Recently Used can never disagree with what was actually opened.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION record_app_use(
    p_user_id uuid, p_app_id uuid, p_event text DEFAULT 'app_opened'
) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO activity_events (user_id, app_id, event)
    VALUES (p_user_id, p_app_id, p_event);

    UPDATE apps SET use_count = use_count + 1 WHERE id = p_app_id;

    IF p_user_id IS NOT NULL THEN
        INSERT INTO user_app_stats (user_id, app_id, use_count, last_used_at)
        VALUES (p_user_id, p_app_id, 1, now())
        ON CONFLICT (user_id, app_id) DO UPDATE
            SET use_count    = user_app_stats.use_count + 1,
                last_used_at = now();
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- add_to_my_apps — append at the end of the order, idempotently
--
-- Re-adding something already in My Apps is a no-op that returns the existing
-- row rather than an error: the button that calls this is one a user can
-- double-click, and that should not be a 500.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION add_to_my_apps(p_user_id uuid, p_app_id uuid)
RETURNS uuid
LANGUAGE plpgsql AS $$
DECLARE
    v_id   uuid;
    v_next integer;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM apps
         WHERE id = p_app_id AND supports_my_apps AND status <> 'disabled'
    ) THEN
        RAISE EXCEPTION 'app % cannot be added to My Apps', p_app_id
            USING ERRCODE = 'check_violation';
    END IF;

    SELECT coalesce(max(sort_order), -1) + 1 INTO v_next
      FROM user_apps WHERE user_id = p_user_id;

    INSERT INTO user_apps (user_id, app_id, sort_order)
    VALUES (p_user_id, p_app_id, v_next)
    ON CONFLICT (user_id, app_id) DO UPDATE SET updated_at = now()
    RETURNING id INTO v_id;

    INSERT INTO activity_events (user_id, app_id, event)
    VALUES (p_user_id, p_app_id, 'app_added');

    RETURN v_id;
END $$;

-- ---------------------------------------------------------------------------
-- reorder_my_apps — apply a whole new order in one statement
--
-- Takes the complete ordered array of app ids. Anything not sent keeps its
-- place after the ones that were, so a partial payload cannot silently destroy
-- the ordering of apps added on another device.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION reorder_my_apps(p_user_id uuid, p_app_ids uuid[])
RETURNS integer
LANGUAGE plpgsql AS $$
DECLARE v_count integer;
BEGIN
    UPDATE user_apps ua
       SET sort_order = pos.ord - 1
      FROM unnest(p_app_ids) WITH ORDINALITY AS pos(app_id, ord)
     WHERE ua.user_id = p_user_id AND ua.app_id = pos.app_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;

    -- Push everything not named in the payload behind what was.
    UPDATE user_apps
       SET sort_order = sort_order + coalesce(array_length(p_app_ids, 1), 0)
     WHERE user_id = p_user_id AND NOT (app_id = ANY (p_app_ids));

    RETURN v_count;
END $$;

-- ---------------------------------------------------------------------------
-- search_apps — the one query behind global search (§10)
--
-- Live products outrank planned ones, then text relevance, then popularity, so
-- searching "CV" surfaces something usable before something announced.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION search_apps(p_query text, p_limit integer DEFAULT 20)
RETURNS TABLE (
    id uuid, slug text, name text, vertical text, tagline text,
    icon text, route text, status text, rank real
)
LANGUAGE sql STABLE AS $$
    SELECT a.id, a.slug, a.name, a.vertical, a.tagline, a.icon, a.route, a.status,
           ts_rank(a.search_vector, websearch_to_tsquery('english', p_query)) AS rank
      FROM apps a
     WHERE a.is_public
       AND a.status <> 'disabled'
       AND (a.search_vector @@ websearch_to_tsquery('english', p_query)
            OR a.name ILIKE '%' || p_query || '%'
            OR a.name_bn ILIKE '%' || p_query || '%')
     ORDER BY (a.status = 'live') DESC, rank DESC, a.use_count DESC
     LIMIT p_limit;
$$;
