-- ============================================================================
-- Pickixo — 011_facebook.sql
-- Facebook Page connection and the autonomous Page agent.
--
-- Two things in this file carry the weight, and both are constraints rather
-- than application code, because application code is what crashes halfway:
--
--   1. facebook_agent_actions.idempotency_key is UNIQUE. Every call that
--      reaches Facebook claims a row *before* the network request. A retry
--      after a timeout re-claims the same key, sees the claim, and refuses —
--      so "did my post actually go out?" can never be answered by posting it
--      again. This is the single most important line in the file: a duplicate
--      post is visible to every follower and cannot be un-seen.
--
--   2. facebook_comments is UNIQUE per (page, comment_id) and carries the
--      reply on the same row. A comment cannot be processed twice and cannot
--      receive two replies, regardless of how many times the agent wakes.
--
-- Page access tokens are stored encrypted (AES-256-GCM, key in the
-- environment, never in the database). A stolen database dump therefore does
-- not yield a credential that can post to anyone's Page. That is the real
-- protection here — row-level security is still not in place anywhere in this
-- schema, and this file does not pretend otherwise; see docs/SECURITY.md.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- The connected Page
--
-- One row per Facebook Page. Single-Page today, but keyed by user_id and
-- page_id rather than assuming one, because "there is only ever one" is the
-- assumption that is most expensive to undo later.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS facebook_pages (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,

    -- Facebook's own identifiers.
    page_id                 text NOT NULL UNIQUE,
    page_name               text NOT NULL,
    category                text,

    -- AES-256-GCM, format "v1.<nonce>.<ciphertext>". Never returned by any
    -- endpoint, never logged, never placed in an AI prompt.
    access_token_encrypted  text NOT NULL,
    -- A hash of the ciphertext, so "the token changed" is visible in logs
    -- without any part of the token being visible.
    token_fingerprint       text,
    -- Page tokens derived from a long-lived user token generally do not
    -- expire, but Meta may invalidate one at any time (password change,
    -- permission removal). NULL means "no stated expiry", not "valid forever".
    token_expires_at        timestamptz,

    -- What Meta actually granted, as opposed to what was requested. These are
    -- the source of truth for the capability flags below.
    granted_scopes          text[] NOT NULL DEFAULT '{}',
    -- Page-level tasks on the token, e.g. CREATE_CONTENT, MODERATE, MANAGE.
    page_tasks              text[] NOT NULL DEFAULT '{}',

    -- Derived, and deliberately stored rather than recomputed on every read:
    -- the dashboard must be able to say "Stories: unavailable" without making
    -- a Graph call. Recomputed whenever the connection is verified.
    capabilities            jsonb NOT NULL DEFAULT '{}'::jsonb,

    status                  text NOT NULL DEFAULT 'connected'
                            CHECK (status IN ('connected', 'token_invalid',
                                              'revoked', 'disconnected')),
    connected_at            timestamptz NOT NULL DEFAULT now(),
    last_verified_at        timestamptz,
    -- When posts and comments were last pulled from the Graph API. The agent
    -- wakes far more often than the Page changes, so this throttles the only
    -- part of observation that costs API calls; everything else is answered
    -- from tables this system already owns.
    last_synced_at          timestamptz,
    -- Why the connection stopped working, in our words, for the dashboard.
    status_detail           text,

    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS facebook_pages_user_idx ON facebook_pages (user_id);

-- ---------------------------------------------------------------------------
-- Agent settings — one row per Page
--
-- Every limit here is a *ceiling the agent may not exceed*, not a target. The
-- agent is expected to do less than these allow, most of the time.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS facebook_agent_settings (
    page_id                     uuid PRIMARY KEY
                                REFERENCES facebook_pages (id) ON DELETE CASCADE,

    enabled                     boolean NOT NULL DEFAULT false,
    mode                        text NOT NULL DEFAULT 'APPROVAL_REQUIRED'
                                CHECK (mode IN ('FULL_AUTO', 'APPROVAL_REQUIRED',
                                                'PAUSED')),

    -- Daily and hourly ceilings. Defaults are deliberately conservative: a
    -- Page that posts twice a day looks run by a person, one that posts eight
    -- times looks automated.
    max_feed_posts_per_day      integer NOT NULL DEFAULT 2  CHECK (max_feed_posts_per_day BETWEEN 0 AND 20),
    max_image_posts_per_day     integer NOT NULL DEFAULT 2  CHECK (max_image_posts_per_day BETWEEN 0 AND 20),
    max_stories_per_day         integer NOT NULL DEFAULT 5  CHECK (max_stories_per_day BETWEEN 0 AND 30),
    max_comment_replies_per_hour integer NOT NULL DEFAULT 10 CHECK (max_comment_replies_per_hour BETWEEN 0 AND 60),
    min_minutes_between_feed_posts integer NOT NULL DEFAULT 180
                                CHECK (min_minutes_between_feed_posts BETWEEN 0 AND 1440),

    -- Target share of each content type. Starting point only — the evaluator
    -- adjusts it from measured performance, which is why it is data and not a
    -- constant in the code.
    content_mix                 jsonb NOT NULL
                                DEFAULT '{"text": 25, "image": 50, "story": 25}'::jsonb,

    -- Below this the agent does not reply to a comment on its own. A wrong
    -- reply under a wildlife post is a public correction, so the bar is high.
    comment_reply_confidence    numeric(3,2) NOT NULL DEFAULT 0.75
                                CHECK (comment_reply_confidence BETWEEN 0 AND 1),

    -- How far back the duplicate check looks when deciding whether a topic or
    -- an animal has been covered recently.
    diversity_days              integer NOT NULL DEFAULT 14
                                CHECK (diversity_days BETWEEN 1 AND 365),

    -- Hours of the day (0-23, UTC) the agent may publish feed content in.
    -- Empty means "no restriction"; the agent then decides from measured
    -- performance rather than from a hardcoded 8 PM.
    preferred_hours             integer[] NOT NULL DEFAULT '{}',

    -- The stop button. Separate from `enabled` and from `mode` on purpose:
    -- it is meant to be hit in a hurry and released deliberately, and it must
    -- not be cleared as a side effect of someone toggling something else.
    emergency_stopped           boolean NOT NULL DEFAULT false,
    emergency_stopped_at        timestamptz,
    emergency_stop_reason       text,

    created_at                  timestamptz NOT NULL DEFAULT now(),
    updated_at                  timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Agent runs — one row per wake, whether or not anything happened
--
-- A run that decided to do nothing is still recorded. Without those rows the
-- log only shows action, and "why did it not post this afternoon?" becomes
-- unanswerable.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS facebook_agent_runs (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    page_id         uuid NOT NULL REFERENCES facebook_pages (id) ON DELETE CASCADE,

    started_at      timestamptz NOT NULL DEFAULT now(),
    finished_at     timestamptz,

    state           text NOT NULL DEFAULT 'observing'
                    CHECK (state IN ('idle', 'observing', 'analyzing', 'deciding',
                                     'waiting', 'generating', 'publishing',
                                     'verifying', 'learning', 'error', 'paused')),
    status          text NOT NULL DEFAULT 'running'
                    CHECK (status IN ('running', 'completed', 'failed', 'skipped')),

    trigger         text NOT NULL DEFAULT 'scheduled'
                    CHECK (trigger IN ('scheduled', 'manual', 'startup')),

    -- The compact state the agent saw. Never contains a token; see observer.py.
    observation     jsonb,
    decision        text,
    reason          text,
    actions_taken   integer NOT NULL DEFAULT 0,

    -- Whether this wake cost an AI call at all. The whole point of the cheap
    -- deterministic pass is that most wakes should show false here, and that
    -- claim is only checkable if it is recorded.
    used_ai         boolean NOT NULL DEFAULT false,

    error           text,
    duration_ms     integer
);

CREATE INDEX IF NOT EXISTS facebook_agent_runs_page_time_idx
    ON facebook_agent_runs (page_id, started_at DESC);

-- ---------------------------------------------------------------------------
-- Decisions — what the agent chose, and why
--
-- Deliberately excludes publish_reel and friends. Reels are a later phase and
-- the CHECK is what stops a prompt-injected or hallucinated decision string
-- from reaching the action dispatcher.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS facebook_agent_decisions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id          uuid NOT NULL REFERENCES facebook_agent_runs (id) ON DELETE CASCADE,
    page_id         uuid NOT NULL REFERENCES facebook_pages (id) ON DELETE CASCADE,

    decision        text NOT NULL
                    CHECK (decision IN ('do_nothing', 'wait', 'publish_text_post',
                                        'publish_image_post', 'publish_story',
                                        'reply_to_comments', 'flag_for_review')),
    reason          text NOT NULL,
    priority        text NOT NULL DEFAULT 'normal'
                    CHECK (priority IN ('low', 'normal', 'high')),
    confidence      numeric(3,2) CHECK (confidence BETWEEN 0 AND 1),

    content_type    text,
    topic           text,
    -- Caption, visual prompt, wait duration — whatever this decision needs.
    payload         jsonb NOT NULL DEFAULT '{}'::jsonb,

    -- Set when the decision came from the reasoning model rather than from a
    -- deterministic rule, so the cost of AI reasoning is attributable.
    source          text NOT NULL DEFAULT 'rules'
                    CHECK (source IN ('rules', 'model')),

    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS facebook_agent_decisions_page_time_idx
    ON facebook_agent_decisions (page_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Actions — the idempotency ledger
--
-- Read the file header. Every operation that leaves this machine claims a row
-- here first. The UNIQUE on idempotency_key is what makes a duplicate post
-- impossible rather than merely unlikely.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS facebook_agent_actions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id          uuid REFERENCES facebook_agent_runs (id) ON DELETE SET NULL,
    page_id         uuid NOT NULL REFERENCES facebook_pages (id) ON DELETE CASCADE,

    action_type     text NOT NULL
                    CHECK (action_type IN ('publish_text_post', 'publish_image_post',
                                           'publish_story', 'reply_to_comment',
                                           'fetch_insights', 'verify_connection')),

    -- Derived from the content itself, not from a clock or a random value, so
    -- that a retry of the *same* intent produces the same key and collides.
    idempotency_key text NOT NULL UNIQUE,

    status          text NOT NULL DEFAULT 'claimed'
                    CHECK (status IN ('claimed', 'in_progress', 'succeeded',
                                      'failed', 'abandoned')),
    attempt         integer NOT NULL DEFAULT 0,

    -- Facebook's id for whatever was created. Its presence is the proof the
    -- action really happened; a NULL here with status 'succeeded' is a bug.
    external_id     text,

    request         jsonb NOT NULL DEFAULT '{}'::jsonb,
    result          jsonb,
    error           text,
    -- Set when Meta reports a rate limit, so the whole action type can be
    -- backed off instead of retried into a harder block.
    retry_after     timestamptz,

    started_at      timestamptz NOT NULL DEFAULT now(),
    finished_at     timestamptz
);

CREATE INDEX IF NOT EXISTS facebook_agent_actions_page_type_time_idx
    ON facebook_agent_actions (page_id, action_type, started_at DESC);
CREATE INDEX IF NOT EXISTS facebook_agent_actions_status_idx
    ON facebook_agent_actions (page_id, status)
    WHERE status IN ('claimed', 'in_progress');

-- ---------------------------------------------------------------------------
-- Published posts
--
-- Our own record. Kept separately from the action ledger because a post
-- outlives the action that created it, and because posts made by a human on
-- the Page also belong here once observed.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS facebook_posts (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    page_id         uuid NOT NULL REFERENCES facebook_pages (id) ON DELETE CASCADE,

    fb_post_id      text NOT NULL,
    post_type       text NOT NULL DEFAULT 'text'
                    CHECK (post_type IN ('text', 'photo', 'story', 'video',
                                         'reel', 'link', 'other')),

    message         text,
    topic           text,
    animal          text,
    -- Where the generated image lives on disk, when we made one.
    image_path      text,
    permalink       text,

    -- 'agent' for anything this system published; 'human' for posts observed
    -- on the Page that we did not create. The agent must be able to tell the
    -- difference, or it will count someone's manual post against its own
    -- limits incorrectly — or worse, not count it at all.
    created_by      text NOT NULL DEFAULT 'agent'
                    CHECK (created_by IN ('agent', 'human')),

    published_at    timestamptz NOT NULL,
    observed_at     timestamptz NOT NULL DEFAULT now(),

    UNIQUE (page_id, fb_post_id)
);

CREATE INDEX IF NOT EXISTS facebook_posts_page_time_idx
    ON facebook_posts (page_id, published_at DESC);

-- ---------------------------------------------------------------------------
-- Post performance — the input to learning
--
-- A snapshot, not a running total: engagement on a post keeps changing, and
-- comparing a six-hour-old post against a six-day-old one on raw numbers would
-- teach the agent that older topics perform better.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS facebook_post_metrics (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id         uuid NOT NULL REFERENCES facebook_posts (id) ON DELETE CASCADE,

    collected_at    timestamptz NOT NULL DEFAULT now(),
    -- Hours between publication and this snapshot, so like is compared with
    -- like when the evaluator ranks topics.
    age_hours       integer NOT NULL,

    impressions     integer,
    reach           integer,
    reactions       integer,
    comments        integer,
    shares          integer,
    clicks          integer,

    UNIQUE (post_id, age_hours)
);

-- ---------------------------------------------------------------------------
-- Comments
--
-- One row per Facebook comment, ever. The UNIQUE is what guarantees a comment
-- is classified once and replied to at most once, no matter how many times the
-- agent observes it.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS facebook_comments (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    page_id             uuid NOT NULL REFERENCES facebook_pages (id) ON DELETE CASCADE,

    comment_id          text NOT NULL,
    fb_post_id          text NOT NULL,
    parent_comment_id   text,

    -- A commenter is a member of the public. Their name is kept because a
    -- reply reads wrong without it, and nothing here is exposed beyond the
    -- owner's own dashboard.
    author_id           text,
    author_name         text,
    message             text NOT NULL,
    created_time        timestamptz NOT NULL,

    -- Set by the classifier. 'unclassified' means seen but not yet reasoned
    -- about, which is a normal resting state for a cheap wake.
    classification      text NOT NULL DEFAULT 'unclassified'
                        CHECK (classification IN ('unclassified', 'positive',
                                                  'compliment', 'question',
                                                  'information_request', 'negative',
                                                  'criticism', 'spam', 'abuse',
                                                  'hate', 'sensitive', 'unclear')),
    confidence          numeric(3,2) CHECK (confidence BETWEEN 0 AND 1),

    action              text NOT NULL DEFAULT 'pending'
                        CHECK (action IN ('pending', 'reply', 'ignore', 'flag')),
    action_reason       text,

    -- The reply, on the same row as the comment it answers. Two replies to one
    -- comment is then not a race the application has to win — it is a row that
    -- already has a reply_comment_id.
    reply_text          text,
    reply_comment_id    text,
    replied_at          timestamptz,

    -- Sensitive or high-risk comments land here for a person to look at.
    needs_review        boolean NOT NULL DEFAULT false,
    reviewed_at         timestamptz,

    processed_at        timestamptz,
    observed_at         timestamptz NOT NULL DEFAULT now(),

    UNIQUE (page_id, comment_id)
);

CREATE INDEX IF NOT EXISTS facebook_comments_pending_idx
    ON facebook_comments (page_id, action, created_time DESC);
CREATE INDEX IF NOT EXISTS facebook_comments_review_idx
    ON facebook_comments (page_id, needs_review)
    WHERE needs_review = true;
-- Finding unanswered comments is the single most frequent query the observer
-- makes, so it gets its own partial index rather than a scan.
CREATE INDEX IF NOT EXISTS facebook_comments_unanswered_idx
    ON facebook_comments (page_id, created_time DESC)
    WHERE reply_comment_id IS NULL AND action <> 'ignore';

-- ---------------------------------------------------------------------------
-- Content memory — what the Page has recently talked about
--
-- This is what stops the agent posting "did you know tigers can swim?" twice
-- in a fortnight. Deterministic: a normalised hash, checked in SQL, before any
-- expensive generation happens.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS facebook_content_memory (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    page_id         uuid NOT NULL REFERENCES facebook_pages (id) ON DELETE CASCADE,

    kind            text NOT NULL
                    CHECK (kind IN ('topic', 'animal', 'fact', 'caption',
                                    'visual_concept', 'image_phash')),
    -- As written, for the dashboard and for prompting.
    value           text NOT NULL,
    -- Lowercased, punctuation-stripped, stopwords removed — see memory.py.
    normalized      text NOT NULL,
    -- sha256 of `normalized`, or a perceptual hash for image_phash.
    hash            text NOT NULL,

    post_id         uuid REFERENCES facebook_posts (id) ON DELETE SET NULL,
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- The duplicate check is (page, kind, hash) restricted by date, so that is
-- exactly the index.
CREATE INDEX IF NOT EXISTS facebook_content_memory_lookup_idx
    ON facebook_content_memory (page_id, kind, hash, created_at DESC);
CREATE INDEX IF NOT EXISTS facebook_content_memory_recent_idx
    ON facebook_content_memory (page_id, kind, created_at DESC);

-- ---------------------------------------------------------------------------
-- Content plans — the calendar
--
-- Everything the agent intends to publish, before it does. In
-- APPROVAL_REQUIRED mode a plan waits here for a person; in FULL_AUTO it is
-- created and executed in the same run, and still leaves a record of what was
-- intended as distinct from what happened.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS facebook_content_plans (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    page_id             uuid NOT NULL REFERENCES facebook_pages (id) ON DELETE CASCADE,
    run_id              uuid REFERENCES facebook_agent_runs (id) ON DELETE SET NULL,

    scheduled_for       timestamptz,
    content_type        text NOT NULL
                        CHECK (content_type IN ('text_post', 'image_post', 'story')),

    topic               text,
    animal              text,
    caption             text,
    visual_prompt       text,
    image_path          text,

    status              text NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'planned', 'generating', 'ready',
                                          'publishing', 'published', 'failed',
                                          'cancelled', 'needs_review')),
    status_detail       text,

    created_by          text NOT NULL DEFAULT 'agent'
                        CHECK (created_by IN ('agent', 'human')),
    approved_by         uuid REFERENCES users (id) ON DELETE SET NULL,
    approved_at         timestamptz,

    published_post_id   uuid REFERENCES facebook_posts (id) ON DELETE SET NULL,

    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS facebook_content_plans_page_status_idx
    ON facebook_content_plans (page_id, status, scheduled_for);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'facebook_pages', 'facebook_agent_settings', 'facebook_content_plans'
    ] LOOP
        EXECUTE format(
            'DROP TRIGGER IF EXISTS %I ON %I; '
            'CREATE TRIGGER %I BEFORE UPDATE ON %I '
            'FOR EACH ROW EXECUTE FUNCTION touch_updated_at()',
            t || '_touch', t, t || '_touch', t);
    END LOOP;
END $$;
