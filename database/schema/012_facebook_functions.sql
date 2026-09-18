-- ============================================================================
-- Pickixo — 012_facebook_functions.sql
-- The Facebook agent operations that must be atomic.
--
-- Same reasoning as consume_quota in 005: these decide whether something
-- irreversible may happen, and two agent processes (or one agent and a manual
-- "publish now" from the dashboard) can ask at the same moment. Doing the
-- check in Python would mean a read, a think, and a write with a gap in the
-- middle — and the gap is exactly where the double post lives.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- claim_agent_action — the gate in front of every call that reaches Facebook
--
-- Returns:
--   claimed = true   → you own this action, go and perform it
--   claimed = false  → somebody already did, or is doing it. `status` and
--                      `external_id` say which, so the caller can report the
--                      existing result instead of repeating the work.
--
-- The caller derives idempotency_key from the *intent* (page + type + a hash
-- of the content), never from a clock or a random value. That is what makes a
-- retry collide with its own first attempt instead of sailing past it.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION claim_agent_action(
    p_page_id         uuid,
    p_action_type     text,
    p_idempotency_key text,
    p_run_id          uuid DEFAULT NULL,
    p_request         jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE (claimed boolean, action_id uuid, status text, external_id text)
LANGUAGE plpgsql AS $$
DECLARE
    v_id     uuid;
    v_status text;
    v_ext    text;
BEGIN
    INSERT INTO facebook_agent_actions (
        page_id, run_id, action_type, idempotency_key, request, status, attempt
    )
    VALUES (
        p_page_id, p_run_id, p_action_type, p_idempotency_key, p_request,
        'claimed', 1
    )
    ON CONFLICT (idempotency_key) DO NOTHING
    RETURNING facebook_agent_actions.id INTO v_id;

    IF v_id IS NOT NULL THEN
        RETURN QUERY SELECT true, v_id, 'claimed'::text, NULL::text;
        RETURN;
    END IF;

    -- Somebody got there first. Hand back what they ended up with.
    SELECT a.id, a.status, a.external_id
      INTO v_id, v_status, v_ext
      FROM facebook_agent_actions a
     WHERE a.idempotency_key = p_idempotency_key;

    -- One exception to "never retry": an attempt that failed *without*
    -- reaching Facebook left no external_id, so retrying cannot duplicate
    -- anything. Re-open it rather than making the agent give up permanently on
    -- a transient DNS blip.
    IF v_status = 'failed' AND v_ext IS NULL THEN
        UPDATE facebook_agent_actions
           SET status = 'claimed',
               attempt = attempt + 1,
               error = NULL,
               started_at = now(),
               finished_at = NULL,
               run_id = COALESCE(p_run_id, run_id)
         WHERE id = v_id
           AND attempt < 5;     -- a genuinely broken action must stop eventually

        IF FOUND THEN
            RETURN QUERY SELECT true, v_id, 'claimed'::text, NULL::text;
            RETURN;
        END IF;
    END IF;

    RETURN QUERY SELECT false, v_id, v_status, v_ext;
END $$;


-- ---------------------------------------------------------------------------
-- finish_agent_action — close the claim, one way or the other
--
-- Separate function so that the "succeeded without an external id" mistake is
-- impossible to make by hand: it is rejected here.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION finish_agent_action(
    p_action_id   uuid,
    p_status      text,
    p_external_id text DEFAULT NULL,
    p_result      jsonb DEFAULT NULL,
    p_error       text DEFAULT NULL,
    p_retry_after timestamptz DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
    IF p_status NOT IN ('succeeded', 'failed', 'abandoned', 'in_progress') THEN
        RAISE EXCEPTION 'invalid action status: %', p_status;
    END IF;

    -- A success is a claim that produced something real on Facebook. Without
    -- an id there is no evidence it happened, and recording it as success is
    -- how a "published" post that nobody can find comes about.
    IF p_status = 'succeeded' AND (p_external_id IS NULL OR p_external_id = '') THEN
        RAISE EXCEPTION 'an action cannot succeed without an external id';
    END IF;

    UPDATE facebook_agent_actions
       SET status      = p_status,
           external_id = COALESCE(p_external_id, external_id),
           result      = COALESCE(p_result, result),
           error       = p_error,
           retry_after = p_retry_after,
           finished_at = CASE WHEN p_status = 'in_progress' THEN NULL ELSE now() END
     WHERE id = p_action_id;
END $$;


-- ---------------------------------------------------------------------------
-- agent_activity_today — what the Page has already had done to it
--
-- One round trip for every number the limit checks and the dashboard need.
-- "Today" is UTC, matching usage_counters elsewhere in this schema.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION agent_activity_today(p_page_id uuid)
RETURNS TABLE (
    feed_posts           integer,
    image_posts          integer,
    text_posts           integer,
    stories              integer,
    comment_replies      integer,
    replies_last_hour    integer,
    last_feed_post_at    timestamptz,
    minutes_since_feed_post integer
)
LANGUAGE sql STABLE AS $$
    WITH day AS (
        SELECT (now() AT TIME ZONE 'utc')::date AS d
    ),
    -- Counted from the action ledger, not from the posts table: the ledger is
    -- what the limits are really about (an attempt that reached Facebook
    -- counts), and it is written before the post record exists.
    acts AS (
        SELECT action_type, started_at, external_id
          FROM facebook_agent_actions, day
         WHERE page_id = p_page_id
           AND status = 'succeeded'
           AND (started_at AT TIME ZONE 'utc')::date = day.d
    ),
    -- Feed posts include anything a human published on the Page today. The
    -- agent's job is to keep the Page healthy, not to hit its own quota: if
    -- the owner posted twice by hand this morning, a third from the agent is
    -- still a third post today.
    human AS (
        SELECT count(*)::integer AS n
          FROM facebook_posts, day
         WHERE page_id = p_page_id
           AND created_by = 'human'
           AND post_type IN ('text', 'photo', 'video', 'link')
           AND (published_at AT TIME ZONE 'utc')::date = day.d
    )
    SELECT
        (SELECT count(*) FROM acts
          WHERE action_type IN ('publish_text_post', 'publish_image_post'))::integer
          + (SELECT n FROM human),
        (SELECT count(*) FROM acts WHERE action_type = 'publish_image_post')::integer,
        (SELECT count(*) FROM acts WHERE action_type = 'publish_text_post')::integer,
        (SELECT count(*) FROM acts WHERE action_type = 'publish_story')::integer,
        (SELECT count(*) FROM acts WHERE action_type = 'reply_to_comment')::integer,
        (SELECT count(*) FROM facebook_agent_actions
          WHERE page_id = p_page_id
            AND action_type = 'reply_to_comment'
            AND status = 'succeeded'
            AND started_at > now() - interval '1 hour')::integer,
        (SELECT max(published_at) FROM facebook_posts
          WHERE page_id = p_page_id
            AND post_type IN ('text', 'photo', 'video', 'link')),
        (SELECT EXTRACT(EPOCH FROM (now() - max(published_at))) / 60
           FROM facebook_posts
          WHERE page_id = p_page_id
            AND post_type IN ('text', 'photo', 'video', 'link'))::integer;
$$;


-- ---------------------------------------------------------------------------
-- agent_may_act — the deterministic gate, before any AI call
--
-- Answers "is this action type allowed right now?" from settings and today's
-- activity alone. No model is consulted to work out that the daily limit is
-- already spent.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION agent_may_act(p_page_id uuid, p_action_type text)
RETURNS TABLE (allowed boolean, reason text)
LANGUAGE plpgsql STABLE AS $$
DECLARE
    s        facebook_agent_settings%ROWTYPE;
    a        record;
BEGIN
    SELECT * INTO s FROM facebook_agent_settings WHERE page_id = p_page_id;
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'no agent settings for this page'; RETURN;
    END IF;

    IF s.emergency_stopped THEN
        RETURN QUERY SELECT false, 'emergency stop is engaged'; RETURN;
    END IF;
    IF NOT s.enabled THEN
        RETURN QUERY SELECT false, 'agent is disabled'; RETURN;
    END IF;
    IF s.mode = 'PAUSED' THEN
        RETURN QUERY SELECT false, 'agent is paused'; RETURN;
    END IF;

    SELECT * INTO a FROM agent_activity_today(p_page_id);

    IF p_action_type IN ('publish_text_post', 'publish_image_post') THEN
        IF a.feed_posts >= s.max_feed_posts_per_day THEN
            RETURN QUERY SELECT false,
                format('daily feed post limit reached (%s/%s)',
                       a.feed_posts, s.max_feed_posts_per_day);
            RETURN;
        END IF;
        IF a.minutes_since_feed_post IS NOT NULL
           AND a.minutes_since_feed_post < s.min_minutes_between_feed_posts THEN
            RETURN QUERY SELECT false,
                format('only %s minutes since the last feed post, minimum is %s',
                       a.minutes_since_feed_post, s.min_minutes_between_feed_posts);
            RETURN;
        END IF;
    END IF;

    IF p_action_type = 'publish_image_post'
       AND a.image_posts >= s.max_image_posts_per_day THEN
        RETURN QUERY SELECT false,
            format('daily image post limit reached (%s/%s)',
                   a.image_posts, s.max_image_posts_per_day);
        RETURN;
    END IF;

    IF p_action_type = 'publish_story'
       AND a.stories >= s.max_stories_per_day THEN
        RETURN QUERY SELECT false,
            format('daily story limit reached (%s/%s)',
                   a.stories, s.max_stories_per_day);
        RETURN;
    END IF;

    IF p_action_type = 'reply_to_comment'
       AND a.replies_last_hour >= s.max_comment_replies_per_hour THEN
        RETURN QUERY SELECT false,
            format('hourly reply limit reached (%s/%s)',
                   a.replies_last_hour, s.max_comment_replies_per_hour);
        RETURN;
    END IF;

    RETURN QUERY SELECT true, 'within limits';
END $$;


-- ---------------------------------------------------------------------------
-- agent_content_is_fresh — duplicate rejection, before generation
--
-- Called with a hash of a normalised topic/animal/caption. Returns false when
-- the Page has covered it inside the diversity window, so the agent can pick
-- something else *before* spending an image generation on it.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION agent_content_is_fresh(
    p_page_id uuid,
    p_kind    text,
    p_hash    text,
    p_days    integer DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql STABLE AS $$
DECLARE
    v_days integer;
BEGIN
    v_days := COALESCE(
        p_days,
        (SELECT diversity_days FROM facebook_agent_settings WHERE page_id = p_page_id),
        14
    );
    RETURN NOT EXISTS (
        SELECT 1 FROM facebook_content_memory
         WHERE page_id = p_page_id
           AND kind = p_kind
           AND hash = p_hash
           AND created_at > now() - make_interval(days => v_days)
    );
END $$;


-- ---------------------------------------------------------------------------
-- agent_topic_performance — measured, never guessed
--
-- The AI is allowed to interpret these numbers. It is not allowed to invent
-- them, which is why they are computed here in SQL from stored metrics and
-- handed to the model as facts.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION agent_topic_performance(
    p_page_id uuid,
    p_days    integer DEFAULT 60
)
RETURNS TABLE (
    topic           text,
    post_type       text,
    posts           integer,
    avg_engagement  numeric,
    avg_reach       numeric
)
LANGUAGE sql STABLE AS $$
    -- One snapshot per post, taken as close to 24h as we have, so a fresh post
    -- is not compared against a week-old one on raw totals.
    WITH snapshot AS (
        SELECT DISTINCT ON (m.post_id)
               m.post_id, m.reactions, m.comments, m.shares, m.reach
          FROM facebook_post_metrics m
          JOIN facebook_posts p ON p.id = m.post_id
         WHERE p.page_id = p_page_id
           AND p.published_at > now() - make_interval(days => p_days)
         ORDER BY m.post_id, abs(m.age_hours - 24)
    )
    SELECT p.topic,
           p.post_type,
           count(*)::integer,
           round(avg(COALESCE(s.reactions, 0) + COALESCE(s.comments, 0)
                     + COALESCE(s.shares, 0)), 2),
           round(avg(COALESCE(s.reach, 0)), 2)
      FROM facebook_posts p
      JOIN snapshot s ON s.post_id = p.id
     WHERE p.page_id = p_page_id
       AND p.topic IS NOT NULL
     GROUP BY p.topic, p.post_type
     -- A single post is an anecdote. Two is the minimum this will report on,
     -- so one viral accident cannot rewrite the content strategy.
    HAVING count(*) >= 2
     ORDER BY 4 DESC;
$$;
