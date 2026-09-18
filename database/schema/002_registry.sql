-- ============================================================================
-- Pickixo — 002_registry.sql
-- The product registry (§19, §145, §146).
--
-- One row per public Pickixo product, whatever vertical it belongs to. This is
-- deliberately a single table rather than one per vertical: navigation, global
-- search, My Apps, recommendations, the sitemap and the admin panel all need
-- "every product" and none of them should have to UNION seven tables to get it.
--
-- The SEO columns live here too, so a product's canonical URL and metadata have
-- exactly one home (§145: avoid maintaining the same product information in
-- many unrelated places).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- app_categories — the second level of the taxonomy (AI > Chat, Tools > PDF)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_categories (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Matches the top-level route segment: ai | apps | tools | games | jobs |
    -- education | bangladesh.
    vertical    text NOT NULL CHECK (vertical IN
                ('ai', 'apps', 'tools', 'games', 'jobs', 'education', 'bangladesh')),
    slug        text NOT NULL,
    name        text NOT NULL,
    name_bn     text,
    description text,
    icon        text,
    sort_order  integer NOT NULL DEFAULT 0,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE (vertical, slug)
);

-- ---------------------------------------------------------------------------
-- apps — the product registry
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS apps (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Unique across the whole platform, not per vertical: a slug is how a
    -- product is named in My Apps, activity and search, and those are global.
    slug                text NOT NULL UNIQUE,
    vertical            text NOT NULL CHECK (vertical IN
                        ('ai', 'apps', 'tools', 'games', 'jobs', 'education', 'bangladesh')),
    category_id         uuid REFERENCES app_categories (id) ON DELETE SET NULL,

    name                text NOT NULL,
    name_bn             text,
    tagline             text,
    description         text,
    icon                text,

    -- The path a user lands on, e.g. '/tools/pdf-compressor'. Stored rather
    -- than derived because a few products will not follow /vertical/slug.
    route               text NOT NULL,

    -- 'live'      — built and usable
    -- 'beta'      — usable, rough edges, shown with a badge
    -- 'planned'   — listed so the shape of the platform is visible; the page
    --               says so plainly and never pretends to work (§123)
    -- 'disabled'  — hidden everywhere
    status              text NOT NULL DEFAULT 'planned'
                        CHECK (status IN ('live', 'beta', 'planned', 'disabled')),

    is_featured         boolean NOT NULL DEFAULT false,
    -- Whether the product appears in public listings at all.
    is_public           boolean NOT NULL DEFAULT true,
    -- Whether it may enter sitemap.xml and IndexNow. A public page can still be
    -- non-indexable (thin content, duplicates), so these are two columns.
    is_indexable        boolean NOT NULL DEFAULT true,

    -- Whether a signed-in user may pin this to My Apps. False for things that
    -- are pages rather than products (a category index, an article).
    supports_my_apps    boolean NOT NULL DEFAULT true,

    requires_auth       boolean NOT NULL DEFAULT false,

    -- --- SEO (§146) --------------------------------------------------------
    seo_title           text,
    seo_description     text,
    og_image            text,
    -- Schema.org type for this page, when one genuinely applies (§60).
    structured_data_type text CHECK (structured_data_type IN
                        ('WebApplication', 'SoftwareApplication', 'Course',
                         'JobPosting', 'Article', 'VideoGame')),

    -- Free-form, vertical-specific detail (a tool's input schema, a game's
    -- control scheme). Kept out of columns so adding a vertical does not mean
    -- adding columns every other vertical leaves NULL.
    metadata            jsonb NOT NULL DEFAULT '{}'::jsonb,

    -- Denormalised counters, updated by the activity writer. Cheap to read on
    -- every listing page; a COUNT over activity_events would not be.
    use_count           bigint NOT NULL DEFAULT 0,
    sort_order          integer NOT NULL DEFAULT 0,

    launched_at         timestamptz,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS apps_vertical_idx ON apps (vertical, sort_order)
    WHERE is_public AND status <> 'disabled';
CREATE INDEX IF NOT EXISTS apps_category_idx ON apps (category_id);
CREATE INDEX IF NOT EXISTS apps_featured_idx ON apps (is_featured)
    WHERE is_featured AND is_public;
-- Drives sitemap generation: exactly the rows §55 allows in.
CREATE INDEX IF NOT EXISTS apps_indexable_idx ON apps (updated_at)
    WHERE is_public AND is_indexable AND status IN ('live', 'beta');

-- --- global search (§10) ----------------------------------------------------
-- One generated tsvector rather than an ad-hoc ILIKE: searching "CV" should
-- reach the CV Builder, the CV Analyzer and the Job Matcher, and ranking that
-- sensibly needs real full-text search. English config only for now; Bengali
-- has no stemmer shipped with Postgres, so bn names are indexed as 'simple'
-- through the same vector and still match exactly.
ALTER TABLE apps ADD COLUMN IF NOT EXISTS search_vector tsvector
    GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce(name, '')),        'A') ||
        setweight(to_tsvector('simple',  coalesce(name_bn, '')),     'A') ||
        setweight(to_tsvector('english', coalesce(tagline, '')),     'B') ||
        setweight(to_tsvector('english', coalesce(description, '')), 'C')
    ) STORED;

CREATE INDEX IF NOT EXISTS apps_search_idx ON apps USING gin (search_vector);
