-- ============================================================================
-- Pickixo — foundation database tests
--
-- Run:  psql -d pickixo -v ON_ERROR_STOP=1 -f tests/db/01_foundation_test.sql
--
-- Every assertion raises rather than prints, so a regression fails the run
-- instead of scrolling past. The whole file runs in a transaction that is
-- rolled back at the end: it leaves no rows behind and is safe to re-run.
-- ============================================================================

BEGIN;

\set ON_ERROR_STOP on
\echo '--- Pickixo foundation tests -------------------------------------------'

CREATE OR REPLACE FUNCTION assert(cond boolean, label text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
    IF cond THEN
        RAISE NOTICE '  PASS  %', label;
    ELSE
        RAISE EXCEPTION 'FAIL  %', label;
    END IF;
END $$;

DO $$
DECLARE
    u1        uuid;
    u2        uuid;
    a_chat    uuid;
    a_pdf     uuid;
    r         record;
    v_count   integer;
    v_ids     uuid[];
    v_err     text;
BEGIN
    -- --- fixtures ---------------------------------------------------------
    INSERT INTO users (email, display_name) VALUES ('t1@pickixo.test', 'T1') RETURNING id INTO u1;
    INSERT INTO users (email, display_name) VALUES ('t2@pickixo.test', 'T2') RETURNING id INTO u2;
    SELECT id INTO a_chat FROM apps WHERE slug = 'ai-chat';
    SELECT id INTO a_pdf  FROM apps WHERE slug = 'pdf-compressor';

    -- =====================================================================
    -- Quota: the last unit can be taken once and only once
    -- =====================================================================
    SELECT * INTO r FROM consume_quota(u1, NULL, 'text', 2);
    PERFORM assert(r.allowed AND r.used = 1, 'quota: first unit granted');

    SELECT * INTO r FROM consume_quota(u1, NULL, 'text', 2);
    PERFORM assert(r.allowed AND r.used = 2, 'quota: second unit granted');

    SELECT * INTO r FROM consume_quota(u1, NULL, 'text', 2);
    PERFORM assert(NOT r.allowed AND r.used = 2,
                   'quota: third refused at limit, counter not inflated');

    PERFORM release_quota(u1, NULL, 'text');
    SELECT used INTO v_count FROM usage_counters
     WHERE user_id = u1 AND kind = 'text' AND day = (now() AT TIME ZONE 'utc')::date;
    PERFORM assert(v_count = 1, 'quota: release gives the unit back');

    -- A refusal for one user must not touch another.
    SELECT * INTO r FROM consume_quota(u2, NULL, 'text', 2);
    PERFORM assert(r.allowed AND r.used = 1, 'quota: users are counted separately');

    -- Guests are counted on their own key, not pooled with users.
    SELECT * INTO r FROM consume_quota(NULL, sha256('1.2.3.4'::bytea), 'text', 1);
    PERFORM assert(r.allowed, 'quota: guest key granted');
    SELECT * INTO r FROM consume_quota(NULL, sha256('1.2.3.4'::bytea), 'text', 1);
    PERFORM assert(NOT r.allowed, 'quota: guest key enforced');

    -- Supplying both, or neither, is a programming error and must be loud.
    BEGIN
        PERFORM consume_quota(u1, sha256('x'::bytea), 'text', 5);
        RAISE EXCEPTION 'FAIL  quota: both user_id and guest_key was accepted';
    EXCEPTION WHEN raise_exception THEN
        GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
        IF v_err LIKE 'FAIL%' THEN RAISE; END IF;
        PERFORM assert(true, 'quota: refuses both user_id and guest_key');
    END;

    -- =====================================================================
    -- My Apps
    -- =====================================================================
    PERFORM add_to_my_apps(u1, a_chat);
    PERFORM add_to_my_apps(u1, a_pdf);
    SELECT count(*) INTO v_count FROM user_apps WHERE user_id = u1;
    PERFORM assert(v_count = 2, 'my apps: two products added');

    -- Double-click must not 500 and must not duplicate.
    PERFORM add_to_my_apps(u1, a_chat);
    SELECT count(*) INTO v_count FROM user_apps WHERE user_id = u1;
    PERFORM assert(v_count = 2, 'my apps: re-adding is idempotent');

    SELECT sort_order INTO v_count FROM user_apps WHERE user_id = u1 AND app_id = a_pdf;
    PERFORM assert(v_count = 1, 'my apps: second product appended after the first');

    -- Reorder: put the PDF tool first.
    PERFORM reorder_my_apps(u1, ARRAY[a_pdf, a_chat]);
    SELECT array_agg(app_id ORDER BY sort_order) INTO v_ids
      FROM user_apps WHERE user_id = u1;
    PERFORM assert(v_ids[1] = a_pdf AND v_ids[2] = a_chat,
                   'my apps: reorder applies the requested order');

    -- One user cannot see or reorder another user's list.
    PERFORM reorder_my_apps(u2, ARRAY[a_chat]);
    SELECT count(*) INTO v_count FROM user_apps WHERE user_id = u2;
    PERFORM assert(v_count = 0, 'my apps: reorder cannot create rows for another user');

    -- A product that opts out of My Apps must be refused.
    UPDATE apps SET supports_my_apps = false WHERE id = a_pdf;
    BEGIN
        PERFORM add_to_my_apps(u2, a_pdf);
        RAISE EXCEPTION 'FAIL  my apps: opted-out product was accepted';
    EXCEPTION WHEN check_violation THEN
        PERFORM assert(true, 'my apps: product opting out of My Apps is refused');
    END;
    UPDATE apps SET supports_my_apps = true WHERE id = a_pdf;

    -- =====================================================================
    -- Activity / Recently Used
    -- =====================================================================
    PERFORM record_app_use(u1, a_chat);
    PERFORM record_app_use(u1, a_chat);
    SELECT use_count INTO v_count FROM user_app_stats WHERE user_id = u1 AND app_id = a_chat;
    PERFORM assert(v_count = 2, 'activity: per-user use count accumulates');

    SELECT count(*) INTO v_count FROM activity_events
     WHERE user_id = u1 AND app_id = a_chat AND event = 'app_opened';
    PERFORM assert(v_count = 2, 'activity: an event row is written per use');

    -- =====================================================================
    -- Privilege guard: an account cannot promote itself
    -- =====================================================================
    BEGIN
        UPDATE users SET role = 'admin' WHERE id = u1;
        RAISE EXCEPTION 'FAIL  privilege: self-promotion to admin succeeded';
    EXCEPTION WHEN raise_exception THEN
        GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
        IF v_err LIKE 'FAIL%' THEN RAISE; END IF;
        PERFORM assert(true, 'privilege: role change blocked by trigger');
    END;

    BEGIN
        UPDATE users SET status = 'active' WHERE id = u1 AND status = 'suspended';
        PERFORM set_config('pickixo.privileged', 'on', true);
        UPDATE users SET role = 'admin' WHERE id = u1;
        PERFORM set_config('pickixo.privileged', 'off', true);
        PERFORM assert((SELECT role FROM users WHERE id = u1) = 'admin',
                       'privilege: admin path may change role');
    END;

    -- =====================================================================
    -- Registry integrity
    -- =====================================================================
    SELECT count(*) INTO v_count FROM apps WHERE route NOT LIKE '/%';
    PERFORM assert(v_count = 0, 'registry: every route is an absolute path');

    SELECT count(*) INTO v_count FROM apps a
     WHERE a.is_indexable AND (a.seo_title IS NULL OR a.seo_description IS NULL);
    PERFORM assert(v_count = 0, 'registry: every indexable product has SEO metadata');

    -- This used to assert that nothing was live, which was true when nothing
    -- had shipped and became wrong the moment something did. What it was really
    -- protecting is that `live` is never set casually, so that is what it now
    -- checks: a live product must carry the things a shipped product has.
    SELECT count(*) INTO v_count
      FROM apps
     WHERE status = 'live'
       AND (launched_at IS NULL
            OR description IS NULL
            OR seo_title IS NULL
            OR seo_description IS NULL);
    PERFORM assert(v_count = 0,
                   'registry: every live product has a launch date and real copy');

    -- A live product that cannot be reached is worse than one still marked
    -- planned, because the catalogue promises it works.
    SELECT count(*) INTO v_count
      FROM apps WHERE status = 'live' AND (NOT is_public OR route IS NULL);
    PERFORM assert(v_count = 0, 'registry: every live product is publicly routable');

    RAISE NOTICE '--- all foundation tests passed ---------------------------------';
END $$;

ROLLBACK;
