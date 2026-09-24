-- ============================================================================
-- Pickixo — 016_class2_math.sql
-- Class 2 Maths in the product registry.
--
-- Same lesson as 013: the page at /education/class-2/math was built and
-- deployed before this row existed, which meant it was invisible — the
-- Education section, search, My Apps, recommendations and sitemap.xml are all
-- driven by the `apps` table, so a page with no row is a page nobody can find
-- except by typing the URL exactly. This is that missing row.
--
-- Same category as Class 2 English ('classes'), since the 013 migration
-- created it for exactly this: "the section will grow by class and subject
-- rather than by topic." Class 2 Maths is that growth arriving.
-- ============================================================================

INSERT INTO apps (
    slug, vertical, category_id, name, name_bn, tagline, description, icon, route,
    status, is_featured, is_public, is_indexable, supports_my_apps, requires_auth,
    seo_title, seo_description, structured_data_type, sort_order, launched_at,
    metadata
)
VALUES (
    'class-2-math', 'education',
    (SELECT id FROM app_categories WHERE vertical = 'education' AND slug = 'classes'),
    'Class 2 Maths', 'ক্লাস টু গণিত',
    'দ্বিতীয় শ্রেণির গণিত — শিখি, খেলি, অনুশীলন করি',
    'Interactive Maths lessons for Class 2, following the NCTB textbook '
    '"প্রাথমিক গণিত". Every number is shown as base-ten blocks and has a '
    'listen button. Children work through a chapter, play a game, answer a '
    'short quiz and collect stars. No account needed, and every answer in the '
    'app is computed from the book''s own numbers rather than typed by hand.',
    'calculator', '/education/class-2/math',
    -- Beta, not live: all seven chapters and thirty-nine topics are complete
    -- and working, but it has just shipped and has not yet had real
    -- classroom use the way Class 2 English has.
    'beta', true, true, true, true, false,
    'Class 2 Maths - Learn, Play and Practise Free',
    'Free interactive Maths lessons for Class 2, following the Bangladesh '
    'NCTB textbook "প্রাথমিক গণিত". Numbers, addition, subtraction, '
    'multiplication, shapes, measurement, money and data — all seven '
    'chapters, playable in Bangla.',
    'WebApplication', 2, now(),
    jsonb_build_object(
        'curriculum',       'NCTB প্রাথমিক গণিত, দ্বিতীয় শ্রেণি',
        'class',             2,
        'subject',           'math',
        'language',          'Bangla throughout; the textbook has no English',
        'chapters_total',    7,
        'chapters_available', 7,
        'topics_available',  39,
        'needs_account',     false,
        'offline_capable',   false,
        -- Recorded so the honesty claim on the page is checkable from the
        -- registry too, not only from the page copy.
        'answers',           'computed from the book''s own numbers at build time, never typed by hand',
        'illustrations',     'original; textbook artwork is not reused'
    )
)
ON CONFLICT (slug) DO UPDATE SET
    status          = EXCLUDED.status,
    route           = EXCLUDED.route,
    category_id     = EXCLUDED.category_id,
    description     = EXCLUDED.description,
    seo_title       = EXCLUDED.seo_title,
    seo_description = EXCLUDED.seo_description,
    metadata        = EXCLUDED.metadata,
    launched_at     = COALESCE(apps.launched_at, EXCLUDED.launched_at),
    updated_at      = now()
-- Same guard as 010, 013 and 014: only touch updated_at when something
-- actually changed, because sitemap.xml publishes it as lastmod and IndexNow
-- announces anything newer than its last submission.
WHERE (apps.status, apps.route, apps.category_id, apps.description,
       apps.seo_title, apps.seo_description, apps.metadata)
   IS DISTINCT FROM
      (EXCLUDED.status, EXCLUDED.route, EXCLUDED.category_id, EXCLUDED.description,
       EXCLUDED.seo_title, EXCLUDED.seo_description, EXCLUDED.metadata);
