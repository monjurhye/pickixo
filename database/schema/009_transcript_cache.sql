-- ============================================================================
-- Pickixo — 009_transcript_cache.sql
-- YouTube transcript cache.
--
-- The provider charges one credit per successful fetch, so the point of this
-- table is to pay that once per video rather than once per request. Two people
-- asking for the same video, or one person double-clicking, must cost nothing
-- the second time.
--
-- Only successes are stored. A "no transcript available" answer is not cached
-- as a transcript — captions get added to videos later, and a cached failure
-- would keep serving the old answer forever.
-- ============================================================================

CREATE TABLE IF NOT EXISTS transcript_cache (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    -- YouTube's 11-character id, already normalised out of whatever URL shape
    -- the user pasted. The cache key is the video, never the URL: the same
    -- video reaches us as youtu.be/X, /watch?v=X and /shorts/X.
    youtube_video_id  text NOT NULL,
    -- Which caption track this is. A video can have several, so it is part of
    -- the key rather than an attribute.
    language          text NOT NULL,

    video_url         text,
    video_title       text,
    channel_name      text,
    channel_url       text,
    thumbnail_url     text,
    duration_seconds  integer,

    -- The normalised segments: [{start, duration, text}, ...]. Stored in our
    -- own shape, not the provider's, so swapping providers does not invalidate
    -- the cache or require a migration.
    transcript_data   jsonb NOT NULL,
    segment_count     integer NOT NULL DEFAULT 0,

    -- Which provider produced it, for when there is more than one.
    provider          text NOT NULL DEFAULT 'transcriptapi',

    -- How often this cached row spared us a provider call. The whole
    -- justification for the table, made measurable.
    hit_count         integer NOT NULL DEFAULT 0,
    last_accessed_at  timestamptz NOT NULL DEFAULT now(),

    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now(),

    -- A transcript with no segments is a failed fetch wearing a success badge.
    CONSTRAINT transcript_not_empty CHECK (jsonb_array_length(transcript_data) > 0),
    UNIQUE (youtube_video_id, language)
);

CREATE INDEX IF NOT EXISTS transcript_cache_video_idx
    ON transcript_cache (youtube_video_id);
CREATE INDEX IF NOT EXISTS transcript_cache_recent_idx
    ON transcript_cache (last_accessed_at DESC);

DROP TRIGGER IF EXISTS transcript_cache_touch ON transcript_cache;
CREATE TRIGGER transcript_cache_touch BEFORE UPDATE ON transcript_cache
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
