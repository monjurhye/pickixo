-- ============================================================================
-- Pickixo — 020_facebook_reels.sql
-- Lets the Facebook agent publish Reels.
--
-- 011 kept reels out on purpose: the CHECK constraints were what stopped a
-- hallucinated "publish_reel" from reaching the dispatcher before there was
-- code to handle one. That code now exists (app/services/video, and
-- actions.publish_reel), so the value is added to exactly the constraints that
-- gate it, and nothing wider.
--
-- Reels get their own daily ceiling rather than sharing max_feed_posts_per_day.
-- They are the Page's growth format and the two budgets answer different
-- questions: "how many reels can we afford to render" is not "how many photo
-- posts is too many". Spacing is shared — a reel is a feed item, and a reel
-- ten minutes after a photo post buries one of them.
--
-- Apply as the owner:
--   C:\Pickixo\pgsql\bin\psql.exe -h 127.0.0.1 -U pickixo_admin -d pickixo `
--     -v ON_ERROR_STOP=1 -f database\schema\020_facebook_reels.sql
-- ============================================================================
SET client_encoding = 'UTF8';

BEGIN;

-- --- decisions, actions, plans ---------------------------------------------
ALTER TABLE facebook_agent_decisions
    DROP CONSTRAINT facebook_agent_decisions_decision_check,
    ADD CONSTRAINT facebook_agent_decisions_decision_check
        CHECK (decision IN ('do_nothing', 'wait', 'publish_text_post',
                            'publish_image_post', 'publish_story',
                            'publish_reel', 'reply_to_comments',
                            'flag_for_review'));

ALTER TABLE facebook_agent_actions
    DROP CONSTRAINT facebook_agent_actions_action_type_check,
    ADD CONSTRAINT facebook_agent_actions_action_type_check
        CHECK (action_type IN ('publish_text_post', 'publish_image_post',
                               'publish_story', 'publish_reel',
                               'reply_to_comment', 'fetch_insights',
                               'verify_connection'));

ALTER TABLE facebook_content_plans
    DROP CONSTRAINT facebook_content_plans_content_type_check,
    ADD CONSTRAINT facebook_content_plans_content_type_check
        CHECK (content_type IN ('text_post', 'image_post', 'story', 'reel'));

-- --- the reel budget ---------------------------------------------------------
ALTER TABLE facebook_agent_settings
    ADD COLUMN IF NOT EXISTS max_reels_per_day integer NOT NULL DEFAULT 2
        CHECK (max_reels_per_day BETWEEN 0 AND 10);

-- ---------------------------------------------------------------------------
-- agent_activity_today — now counts reels
--
-- The return type changes, so the function has to be dropped rather than
-- replaced. agent_may_act calls it from plpgsql, which Postgres does not track
-- as a dependency; it is recreated below in the same transaction anyway.
--
-- Reels count toward spacing (last_feed_post_at, minutes_since_feed_post) but
-- not toward feed_posts, which stays the text/photo budget.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS agent_activity_today(uuid);

CREATE FUNCTION agent_activity_today(p_page_id uuid)
RETURNS TABLE (
    feed_posts           integer,
    image_posts          integer,
    text_posts           integer,
    stories              integer,
    reels                integer,
    comment_replies      integer,
    replies_last_hour    integer,
    last_feed_post_at    timestamptz,
    minutes_since_feed_post integer
)
LANGUAGE sql STABLE AS $$
    WITH day AS (
        SELECT (now() AT TIME ZONE 'utc')::date AS d
    ),
    acts AS (
        SELECT action_type, started_at, external_id
          FROM facebook_agent_actions, day
         WHERE page_id = p_page_id
           AND status = 'succeeded'
           AND (started_at AT TIME ZONE 'utc')::date = day.d
    ),
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
        (SELECT count(*) FROM acts WHERE action_type = 'publish_reel')::integer,
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
-- agent_may_act — with the reel branch
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
    END IF;

    IF p_action_type IN ('publish_text_post', 'publish_image_post', 'publish_reel')
       AND a.minutes_since_feed_post IS NOT NULL
       AND a.minutes_since_feed_post < s.min_minutes_between_feed_posts THEN
        RETURN QUERY SELECT false,
            format('only %s minutes since the last feed post, minimum is %s',
                   a.minutes_since_feed_post, s.min_minutes_between_feed_posts);
        RETURN;
    END IF;

    IF p_action_type = 'publish_image_post'
       AND a.image_posts >= s.max_image_posts_per_day THEN
        RETURN QUERY SELECT false,
            format('daily image post limit reached (%s/%s)',
                   a.image_posts, s.max_image_posts_per_day);
        RETURN;
    END IF;

    IF p_action_type = 'publish_reel'
       AND a.reels >= s.max_reels_per_day THEN
        RETURN QUERY SELECT false,
            format('daily reel limit reached (%s/%s)',
                   a.reels, s.max_reels_per_day);
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
END;
$$;

-- A dropped function loses its grants. 006's default privileges would cover
-- the recreation only if it ran as the same role that set them, so say it
-- outright rather than depend on who applied this file.
GRANT EXECUTE ON FUNCTION agent_activity_today(uuid) TO pickixo_app;

COMMIT;
