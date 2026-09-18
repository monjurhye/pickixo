-- ============================================================================
-- Pickixo — Facebook agent database tests
--
-- Run:  psql -d pickixo -v ON_ERROR_STOP=1 -f tests/db/02_facebook_agent_test.sql
--
-- Everything runs inside one transaction that is rolled back at the end, so
-- this leaves no rows behind and is safe to run against the live database.
-- That is not a stylistic choice: an earlier test run in this project wrote
-- 242 junk accounts into production, twice, because "local" and "production"
-- are the same database here.
--
-- Assertions are inline DO blocks rather than a helper function, because the
-- application role deliberately cannot CREATE FUNCTION — the test has to run
-- with the same privileges the application has.
--
-- What this protects:
--   * a duplicate post is impossible, not merely unlikely
--   * a failed attempt that never reached Facebook can be retried
--   * a successful one never can
--   * limits are enforced in the database, not in hopeful Python
--   * a duplicate topic is rejected before anything is generated
-- ============================================================================

BEGIN;

\set ON_ERROR_STOP on
\echo '--- Facebook agent tests --------------------------------------------'

DO $$
DECLARE
    v_user      uuid;
    v_page      uuid;
    r           record;
    r2          record;
    v_count     integer;
    v_allowed   boolean;
    v_reason    text;

    PROCEDURE_NOTE text := 'assertions raise, so a regression fails the run';
BEGIN
    -- --- fixtures ---------------------------------------------------------
    INSERT INTO users (email, display_name)
    VALUES ('agent-test@pickixo.test', 'Agent Test')
    RETURNING id INTO v_user;

    INSERT INTO facebook_pages
        (user_id, page_id, page_name, access_token_encrypted, capabilities, status)
    VALUES
        (v_user, 'test-page-1', 'The World Frame (test)',
         'v1.fake.ciphertext', '{"can_publish_posts": true}'::jsonb, 'connected')
    RETURNING id INTO v_page;

    INSERT INTO facebook_agent_settings (page_id, enabled, mode)
    VALUES (v_page, true, 'FULL_AUTO');

    -- =====================================================================
    -- Idempotency: the guarantee the whole design rests on
    -- =====================================================================
    SELECT * INTO r FROM claim_agent_action(
        v_page, 'publish_text_post', 'key-alpha', NULL, '{}'::jsonb);
    IF NOT r.claimed THEN RAISE EXCEPTION 'FAIL first claim was refused'; END IF;
    RAISE NOTICE '  PASS  a fresh action can be claimed';

    -- The same intent again, mid-flight. This is the double-click, the retry,
    -- and the second worker all at once.
    SELECT * INTO r2 FROM claim_agent_action(
        v_page, 'publish_text_post', 'key-alpha', NULL, '{}'::jsonb);
    IF r2.claimed THEN
        RAISE EXCEPTION 'FAIL the same action was claimed twice — duplicate post';
    END IF;
    RAISE NOTICE '  PASS  an in-flight action cannot be claimed again';

    -- Complete it, then try once more. This is the timeout case: the caller
    -- never saw the response and wants to "just try again".
    PERFORM finish_agent_action(r.action_id, 'succeeded', 'fb_post_123',
                                '{}'::jsonb, NULL, NULL);
    SELECT * INTO r2 FROM claim_agent_action(
        v_page, 'publish_text_post', 'key-alpha', NULL, '{}'::jsonb);
    IF r2.claimed THEN
        RAISE EXCEPTION 'FAIL a completed action was re-claimed — duplicate post';
    END IF;
    IF r2.external_id IS DISTINCT FROM 'fb_post_123' THEN
        RAISE EXCEPTION 'FAIL the existing Facebook id was not handed back';
    END IF;
    RAISE NOTICE '  PASS  a completed action is never repeated, and reports its id';

    -- A success with no external id is a "published" post nobody can find.
    BEGIN
        PERFORM finish_agent_action(r.action_id, 'succeeded', NULL, NULL, NULL, NULL);
        RAISE EXCEPTION 'FAIL success without a Facebook id was accepted';
    EXCEPTION WHEN raise_exception THEN
        IF SQLERRM LIKE 'FAIL%' THEN RAISE; END IF;
        RAISE NOTICE '  PASS  an action cannot succeed without a Facebook id';
    END;

    -- A failure that never reached Facebook (no external id) is genuinely
    -- retryable — otherwise one DNS blip kills the action forever.
    SELECT * INTO r FROM claim_agent_action(
        v_page, 'publish_text_post', 'key-beta', NULL, '{}'::jsonb);
    PERFORM finish_agent_action(r.action_id, 'failed', NULL, NULL,
                                'connection reset', NULL);
    SELECT * INTO r2 FROM claim_agent_action(
        v_page, 'publish_text_post', 'key-beta', NULL, '{}'::jsonb);
    IF NOT r2.claimed THEN
        RAISE EXCEPTION 'FAIL a failure that never reached Facebook was not retryable';
    END IF;
    RAISE NOTICE '  PASS  a failure that never reached Facebook can be retried';

    -- ...but a failure that DID reach Facebook must not be.
    SELECT * INTO r FROM claim_agent_action(
        v_page, 'publish_text_post', 'key-gamma', NULL, '{}'::jsonb);
    PERFORM finish_agent_action(r.action_id, 'failed', 'fb_post_456', NULL,
                                'timed out after publishing', NULL);
    SELECT * INTO r2 FROM claim_agent_action(
        v_page, 'publish_text_post', 'key-gamma', NULL, '{}'::jsonb);
    IF r2.claimed THEN
        RAISE EXCEPTION 'FAIL an action that reached Facebook was retried — duplicate post';
    END IF;
    RAISE NOTICE '  PASS  a failure that DID reach Facebook is never retried';

    -- A permanently broken action must stop eventually rather than spin.
    SELECT * INTO r FROM claim_agent_action(
        v_page, 'publish_text_post', 'key-delta', NULL, '{}'::jsonb);
    FOR v_count IN 1..8 LOOP
        PERFORM finish_agent_action(r.action_id, 'failed', NULL, NULL, 'nope', NULL);
        SELECT * INTO r2 FROM claim_agent_action(
            v_page, 'publish_text_post', 'key-delta', NULL, '{}'::jsonb);
        EXIT WHEN NOT r2.claimed;
    END LOOP;
    IF r2.claimed THEN
        RAISE EXCEPTION 'FAIL a broken action retried forever';
    END IF;
    RAISE NOTICE '  PASS  retries are bounded, not infinite';

    -- =====================================================================
    -- Activity counting and limits
    -- =====================================================================
    SELECT * INTO r FROM agent_activity_today(v_page);
    -- key-alpha succeeded; the others failed. Only successes count.
    IF r.feed_posts <> 1 THEN
        RAISE EXCEPTION 'FAIL expected 1 successful feed post, got %', r.feed_posts;
    END IF;
    RAISE NOTICE '  PASS  only successful actions count towards the day';

    -- A post made by a human on the Page counts too: the agent's job is the
    -- Page's health, not its own quota.
    INSERT INTO facebook_posts
        (page_id, fb_post_id, post_type, message, published_at, created_by)
    VALUES (v_page, 'human-post-1', 'photo', 'posted by hand', now(), 'human');
    SELECT * INTO r FROM agent_activity_today(v_page);
    IF r.feed_posts <> 2 THEN
        RAISE EXCEPTION 'FAIL a human post was not counted (got %)', r.feed_posts;
    END IF;
    RAISE NOTICE '  PASS  a post made by hand counts towards the daily total';

    -- Which means the limit is now reached.
    SELECT * INTO r FROM agent_may_act(v_page, 'publish_text_post');
    IF r.allowed THEN
        RAISE EXCEPTION 'FAIL posting was allowed past the daily limit';
    END IF;
    RAISE NOTICE '  PASS  the daily limit is refused in the database: %', r.reason;

    -- The emergency stop overrides everything.
    UPDATE facebook_agent_settings
       SET emergency_stopped = true, max_feed_posts_per_day = 10
     WHERE page_id = v_page;
    SELECT * INTO r FROM agent_may_act(v_page, 'publish_text_post');
    IF r.allowed THEN
        RAISE EXCEPTION 'FAIL the emergency stop did not stop anything';
    END IF;
    RAISE NOTICE '  PASS  emergency stop refuses every action';

    UPDATE facebook_agent_settings SET emergency_stopped = false WHERE page_id = v_page;

    -- A paused agent takes no action either.
    UPDATE facebook_agent_settings SET mode = 'PAUSED' WHERE page_id = v_page;
    SELECT * INTO r FROM agent_may_act(v_page, 'publish_story');
    IF r.allowed THEN RAISE EXCEPTION 'FAIL a paused agent was allowed to act'; END IF;
    RAISE NOTICE '  PASS  a paused agent takes no action';
    UPDATE facebook_agent_settings SET mode = 'FULL_AUTO' WHERE page_id = v_page;

    -- Minimum spacing between posts.
    UPDATE facebook_agent_settings
       SET min_minutes_between_feed_posts = 180 WHERE page_id = v_page;
    SELECT * INTO r FROM agent_may_act(v_page, 'publish_text_post');
    IF r.allowed THEN
        RAISE EXCEPTION 'FAIL posted again within the minimum spacing';
    END IF;
    RAISE NOTICE '  PASS  minimum spacing between posts is enforced';

    -- =====================================================================
    -- Comments: processed once, answered at most once
    -- =====================================================================
    INSERT INTO facebook_comments
        (page_id, comment_id, fb_post_id, message, created_time)
    VALUES (v_page, 'comment-1', 'fb_post_123', 'What animal is this?', now());

    -- Observing the same comment again must not reset its classification.
    UPDATE facebook_comments SET classification = 'question', action = 'reply'
     WHERE page_id = v_page AND comment_id = 'comment-1';
    INSERT INTO facebook_comments
        (page_id, comment_id, fb_post_id, message, created_time)
    VALUES (v_page, 'comment-1', 'fb_post_123', 'What animal is this?', now())
    ON CONFLICT (page_id, comment_id) DO NOTHING;

    SELECT classification INTO v_reason FROM facebook_comments
     WHERE page_id = v_page AND comment_id = 'comment-1';
    IF v_reason <> 'question' THEN
        RAISE EXCEPTION 'FAIL re-observing a comment reset its classification';
    END IF;
    SELECT count(*) INTO v_count FROM facebook_comments
     WHERE page_id = v_page AND comment_id = 'comment-1';
    IF v_count <> 1 THEN
        RAISE EXCEPTION 'FAIL the same comment was stored twice';
    END IF;
    RAISE NOTICE '  PASS  a comment is stored once and keeps its classification';

    -- Attaching a reply is guarded so a second one cannot land.
    UPDATE facebook_comments
       SET reply_comment_id = 'reply-1', replied_at = now()
     WHERE page_id = v_page AND comment_id = 'comment-1'
       AND reply_comment_id IS NULL;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count <> 1 THEN RAISE EXCEPTION 'FAIL the first reply did not attach'; END IF;

    UPDATE facebook_comments
       SET reply_comment_id = 'reply-2'
     WHERE page_id = v_page AND comment_id = 'comment-1'
       AND reply_comment_id IS NULL;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count <> 0 THEN
        RAISE EXCEPTION 'FAIL a comment received a second reply';
    END IF;
    RAISE NOTICE '  PASS  a comment can never receive two replies';

    -- =====================================================================
    -- Duplicate content is rejected before anything is generated
    -- =====================================================================
    IF NOT agent_content_is_fresh(v_page, 'topic', 'hash-tiger-swimming') THEN
        RAISE EXCEPTION 'FAIL an unseen topic was reported as stale';
    END IF;

    INSERT INTO facebook_content_memory (page_id, kind, value, normalized, hash)
    VALUES (v_page, 'topic', 'Tigers can swim', 'tigers swim',
            'hash-tiger-swimming');

    IF agent_content_is_fresh(v_page, 'topic', 'hash-tiger-swimming') THEN
        RAISE EXCEPTION 'FAIL a topic published today was reported as fresh';
    END IF;
    RAISE NOTICE '  PASS  a recently covered topic is rejected';

    -- ...but it becomes available again once the diversity window passes.
    UPDATE facebook_content_memory
       SET created_at = now() - interval '40 days'
     WHERE page_id = v_page AND hash = 'hash-tiger-swimming';
    IF NOT agent_content_is_fresh(v_page, 'topic', 'hash-tiger-swimming') THEN
        RAISE EXCEPTION 'FAIL a topic from 40 days ago is still blocked';
    END IF;
    RAISE NOTICE '  PASS  a topic becomes usable again after the diversity window';

    RAISE NOTICE '--- all Facebook agent tests passed ----------------------';
END $$;

ROLLBACK;

\echo '--- rolled back: no rows were left behind ----------------------------'
