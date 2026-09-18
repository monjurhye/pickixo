-- ============================================================================
-- Pickixo — 003_my_apps.sql
-- My Apps, Favourites and Activity (§15-§24).
--
-- The distinction §22 insists on is enforced by the schema, not by convention:
--   user_apps  references a PRODUCT  (apps.id)     — "take me back to this tool"
--   favorites  references an ITEM    (type + ref)  — "save this job listing"
-- They are different tables because they answer different questions.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- user_apps — My Apps (§20)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_apps (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    -- References the registry rather than copying name/icon/route, so a product
    -- rename reaches every user's My Apps immediately (§20).
    app_id      uuid NOT NULL REFERENCES apps (id) ON DELETE CASCADE,
    is_pinned   boolean NOT NULL DEFAULT false,
    -- Dense integers maintained by the reorder endpoint. Gaps are harmless;
    -- ties are broken by created_at so ordering is always total.
    sort_order  integer NOT NULL DEFAULT 0,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, app_id)
);

-- Covers the only read that matters: "my apps, pinned first, in my order".
CREATE INDEX IF NOT EXISTS user_apps_order_idx
    ON user_apps (user_id, is_pinned DESC, sort_order, created_at);

-- ---------------------------------------------------------------------------
-- favorites — saved items (§22)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS favorites (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    item_type   text NOT NULL CHECK (item_type IN
                ('job', 'course', 'scholarship', 'university', 'article',
                 'game', 'generation', 'file')),
    -- Deliberately text, not a uuid FK: the referenced row may live in a table
    -- that does not exist yet, or be an external record keyed by its source id.
    item_ref    text NOT NULL,
    -- A display snapshot so a saved item still renders if its source goes away.
    -- This is a cache for display, never the source of truth.
    snapshot    jsonb NOT NULL DEFAULT '{}'::jsonb,
    app_id      uuid REFERENCES apps (id) ON DELETE SET NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, item_type, item_ref)
);

CREATE INDEX IF NOT EXISTS favorites_user_idx ON favorites (user_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- activity_events — Recently Used (§21) and product analytics (§81)
--
-- Product-level only. §21 is explicit that this must not become a log of what
-- users typed: there is no prompt, no file content and no result here, just
-- "this account opened this product at this time".
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS activity_events (
    id          bigserial PRIMARY KEY,
    user_id     uuid REFERENCES users (id) ON DELETE CASCADE,
    app_id      uuid REFERENCES apps (id) ON DELETE CASCADE,
    event       text NOT NULL CHECK (event IN
                ('app_opened', 'app_used', 'app_added', 'app_removed',
                 'app_pinned', 'search_used', 'signup', 'login')),
    -- Small, non-sensitive context: which vertical, which result count. Never
    -- user content.
    context     jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS activity_user_recent_idx
    ON activity_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS activity_app_idx
    ON activity_events (app_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- user_app_stats — "recently used" and the §142 prompt to add a product
--
-- Kept as its own upserted row rather than aggregated from activity_events on
-- every dashboard load: the dashboard reads this on every visit, and scanning a
-- month of events per user to answer it would not stay cheap.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_app_stats (
    user_id       uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    app_id        uuid NOT NULL REFERENCES apps (id) ON DELETE CASCADE,
    use_count     integer NOT NULL DEFAULT 0,
    last_used_at  timestamptz NOT NULL DEFAULT now(),
    -- Set once the user has been offered "Add to My Apps" for this product, so
    -- §142's "do not aggressively interrupt the user" is enforceable.
    prompted_at   timestamptz,
    PRIMARY KEY (user_id, app_id)
);

CREATE INDEX IF NOT EXISTS user_app_stats_recent_idx
    ON user_app_stats (user_id, last_used_at DESC);
