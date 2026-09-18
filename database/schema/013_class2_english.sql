-- ============================================================================
-- Pickixo — 013_class2_english.sql
-- Class 2 English in the product registry.
--
-- The page at /education/class-2/english was built and deployed before this
-- row existed, which meant it was invisible: the Education section, search,
-- My Apps, recommendations and sitemap.xml are all driven by the `apps` table,
-- so a page with no row is a page nobody can find except by typing the URL.
--
-- Note the route. Every other product follows /vertical/slug, but this one is
-- /education/class-2/english — a class and a subject, because Class 3 English
-- and Class 2 Maths are coming and "class-2-english" as a flat slug would be
-- a dead end. The registry stores `route` explicitly for exactly this reason,
-- so a product that does not follow the default shape still links correctly
-- from every listing.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- A category for school curriculum work
--
-- The existing education categories are Courses, Scholarships and Study Tools.
-- None of them is right: this is a school textbook, not an online course, and
-- the section will grow by class and subject rather than by topic.
-- ---------------------------------------------------------------------------
INSERT INTO app_categories (vertical, slug, name, name_bn, sort_order)
VALUES ('education', 'classes', 'Class Lessons', 'ক্লাসের পড়া', 5)
ON CONFLICT (vertical, slug) DO NOTHING;

INSERT INTO apps (
    slug, vertical, category_id, name, name_bn, tagline, description, icon, route,
    status, is_featured, is_public, is_indexable, supports_my_apps, requires_auth,
    seo_title, seo_description, structured_data_type, sort_order, launched_at,
    metadata
)
VALUES (
    'class-2-english', 'education',
    (SELECT id FROM app_categories WHERE vertical = 'education' AND slug = 'classes'),
    'Class 2 English', 'ক্লাস টু ইংরেজি',
    'Learn, play and practise — with Bangla meanings',
    'Interactive English lessons for Class 2, following the NCTB textbook '
    '"English for Today". Every word has a picture, a listen button and its '
    'Bangla meaning. Children listen, speak, play a game and answer a short '
    'quiz, then collect stars. No account needed.',
    'graduation-cap', '/education/class-2/english',
    -- Beta rather than live: Units 1 and 2 of ten are complete and working,
    -- and calling it finished would promise eight units that are not there yet.
    'beta', true, true, true, true, false,
    'Class 2 English - Learn, Play and Practise Free',
    'Free interactive English lessons for Class 2, following the Bangladesh '
    'NCTB textbook. Listen, play and practise, with the Bangla meaning for '
    'every word.',
    'WebApplication', 1, now(),
    jsonb_build_object(
        'curriculum',      'NCTB English for Today, Class Two',
        'class',           2,
        'subject',         'english',
        'units_total',     10,
        'units_available', 2,
        'needs_account',   false,
        'offline_capable', false,
        -- Recorded so the honesty claim on the page is checkable from the
        -- registry too, not only from the page copy.
        'bangla_meanings', 'added by Pickixo; the textbook has no glosses',
        'illustrations',   'original; textbook artwork is not reused'
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
-- Same guard as 010: only touch updated_at when something actually changed,
-- because sitemap.xml publishes it as lastmod and IndexNow announces anything
-- newer than its last submission.
WHERE (apps.status, apps.route, apps.category_id, apps.description,
       apps.seo_title, apps.seo_description, apps.metadata)
   IS DISTINCT FROM
      (EXCLUDED.status, EXCLUDED.route, EXCLUDED.category_id, EXCLUDED.description,
       EXCLUDED.seo_title, EXCLUDED.seo_description, EXCLUDED.metadata);
