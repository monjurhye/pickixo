-- ============================================================================
-- Pickixo — 021_facebook_daily_mix.sql
-- A fixed daily mix, published in the audience's hours.
--
-- Two problems with 011/020 as they stood:
--
-- 1. Text posts and photo quizzes shared one budget, max_feed_posts_per_day.
--    With a budget of three and a quiz limit of two, nothing stopped the agent
--    spending all three on text and publishing no quiz at all. Text posts now
--    have their own ceiling, so a text post can never take a quiz's place.
--
-- 2. "Today" was the UTC day and preferred_hours were UTC hours. The Page's
--    audience is in the United States: the UTC day rolls over at 8 PM
--    Eastern, in the middle of the evening, which handed out a second day's
--    budget the same US evening — and UTC hours drift by an hour twice a year
--    against a US clock. Both now use posting_timezone, so a setting of
--    America/New_York means Eastern hours with daylight saving handled by
--    the database's time zone rules, not by anybody remembering in March.
--
-- Same function signatures as 020, for the reason given there: Deploy-Web.ps1
-- re-applies every migration in order, and a changed return type would make
-- the older CREATE OR REPLACE fail.
--
-- Apply as the owner:
--   C:\Pickixo\pgsql\bin\psql.exe -h 127.0.0.1 -U pickixo_admin -d pickixo `
--     -v ON_ERROR_STOP=1 -f database\schema\021_facebook_daily_mix.sql
-- ============================================================================
SET client_encoding = 'UTF8';

BEGIN;

ALTER TABLE facebook_agent_settings
    ADD COLUMN IF NOT EXISTS max_text_posts_per_day integer NOT NULL DEFAULT 1
        CHECK (max_text_posts_per_day BETWEEN 0 AND 20),
    -- An IANA zone name. Validated by the API before it is stored; the
    -- functions below fall back to UTC rather than fail a run on a bad one.
    ADD COLUMN IF NOT EXISTS posting_timezone text NOT NULL DEFAULT 'UTC';

COMMENT ON COLUMN facebook_agent_settings.preferred_hours IS
    'Hours of the day (0-23) in posting_timezone the agent may publish in. '
    'Empty means no restriction. Comment replies are not restricted.';

-- ---------------------------------------------------------------------------
-- The Page's time zone, and the calendar day it is in there
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION agent_page_timezone(p_page_id uuid)
RETURNS text
LANGUAGE sql STABLE AS $$
    SELECT COALESCE(
        (SELECT s.posting_timezone
           FROM facebook_agent_settings s
          WHERE s.page_id = p_page_id
            AND EXISTS (SELECT 1 FROM pg_timezone_names z
                         WHERE z.name = s.posting_timezone)),
        'UTC');
$$;

GRANT EXECUTE ON FUNCTION agent_page_timezone(uuid) TO pickixo_app;

-- ---------------------------------------------------------------------------
-- agent_activity_today — the day is the Page's local day
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
    WITH tz AS (
        SELECT agent_page_timezone(p_page_id) AS name
    ),
    day AS (
        SELECT (now() AT TIME ZONE tz.name)::date AS d, tz.name FROM tz
    ),
    acts AS (
        SELECT action_type, started_at, external_id
          FROM facebook_agent_actions, day
         WHERE page_id = p_page_id
           AND status = 'succeeded'
           AND (started_at AT TIME ZONE day.name)::date = day.d
    ),
    human AS (
        SELECT count(*)::integer AS n
          FROM facebook_posts, day
         WHERE page_id = p_page_id
           AND created_by = 'human'
           AND post_type IN ('text', 'photo', 'video', 'link')
           AND (published_at AT TIME ZONE day.name)::date = day.d
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
            AND post_type IN ('text', 'photo', 'video', 'reel', 'link')),
        (SELECT EXTRACT(EPOCH FROM (now() - max(published_at))) / 60
           FROM facebook_posts
          WHERE page_id = p_page_id
            AND post_type IN ('text', 'photo', 'video', 'reel', 'link'))::integer;
$$;

-- ---------------------------------------------------------------------------
-- agent_reels_today — outside agent_activity_today for the reason in 020
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION agent_reels_today(p_page_id uuid)
RETURNS integer
LANGUAGE sql STABLE AS $$
    WITH tz AS (
        SELECT agent_page_timezone(p_page_id) AS name
    )
    SELECT count(*)::integer
      FROM facebook_agent_actions, tz
     WHERE page_id = p_page_id
       AND action_type = 'publish_reel'
       AND status = 'succeeded'
       AND (started_at AT TIME ZONE tz.name)::date
           = (now() AT TIME ZONE tz.name)::date;
$$;

GRANT EXECUTE ON FUNCTION agent_reels_today(uuid) TO pickixo_app;

-- ---------------------------------------------------------------------------
-- agent_may_act — text budget, local day, posting hours
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION agent_may_act(p_page_id uuid, p_action_type text)
RETURNS TABLE (allowed boolean, reason text)
LANGUAGE plpgsql STABLE AS $$
DECLARE
    s        facebook_agent_settings%ROWTYPE;
    a        record;
    v_reels  integer;
    v_tz     text;
    v_hour   integer;
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

    -- Publishing only in the audience's hours. Replies are not held back:
    -- somebody who asked a question is waiting whatever the time.
    IF p_action_type IN ('publish_text_post', 'publish_image_post',
                         'publish_story', 'publish_reel')
       AND cardinality(s.preferred_hours) > 0 THEN
        v_tz := agent_page_timezone(p_page_id);
        v_hour := EXTRACT(HOUR FROM (now() AT TIME ZONE v_tz))::integer;
        IF NOT (v_hour = ANY (s.preferred_hours)) THEN
            RETURN QUERY SELECT false,
                format('outside posting hours (%s:00 in %s)', v_hour, v_tz);
            RETURN;
        END IF;
    END IF;

    SELECT * INTO a FROM agent_activity_today(p_page_id);

    IF p_action_type IN ('publish_text_post', 'publish_image_post') THEN
        IF a.feed_posts >= s.max_feed_posts_per_day THEN
            RETURN QUERY SELECT false,
                format('daily feed post limit reached (%s/%s)',
                       a.feed_posts, s.max_feed_posts_per_day);
            RETURN;
        END IF;
    END IF;

    IF p_action_type IN ('publish_text_post', 'publish_image_post', 'publish_reel')
       AND a.minutes_since_feed_post IS NOT NULL
       AND a.minutes_since_feed_post < s.min_minutes_between_feed_posts THEN
        RETURN QUERY SELECT false,
            format('only %s minutes since the last feed post, minimum is %s',
                   a.minutes_since_feed_post, s.min_minutes_between_feed_posts);
        RETURN;
    END IF;

    IF p_action_type = 'publish_text_post'
       AND a.text_posts >= s.max_text_posts_per_day THEN
        RETURN QUERY SELECT false,
            format('daily text post limit reached (%s/%s)',
                   a.text_posts, s.max_text_posts_per_day);
        RETURN;
    END IF;

    IF p_action_type = 'publish_image_post'
       AND a.image_posts >= s.max_image_posts_per_day THEN
        RETURN QUERY SELECT false,
            format('daily image post limit reached (%s/%s)',
                   a.image_posts, s.max_image_posts_per_day);
        RETURN;
    END IF;

    IF p_action_type = 'publish_reel' THEN
        v_reels := agent_reels_today(p_page_id);
        IF v_reels >= s.max_reels_per_day THEN
            RETURN QUERY SELECT false,
                format('daily reel limit reached (%s/%s)',
                       v_reels, s.max_reels_per_day);
            RETURN;
        END IF;
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
END;
$$;

COMMIT;
