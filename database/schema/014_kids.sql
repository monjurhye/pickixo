-- ============================================================================
-- Pickixo — 014_kids.sql
-- Pickixo Kids in the product registry.
--
-- Same lesson as 013: the Education section, search, My Apps, recommendations
-- and sitemap.xml are all driven by the `apps` table, so a page with no row is
-- a page nobody can find except by typing the URL.
--
-- Note the route. This is /kids, not /education/pre-primary/bangla, because
-- unlike Class 2 English it is not one class and one subject — it is a single
-- adaptive platform covering Bangla, numbers and the rest of the NCTB
-- pre-primary curriculum, for both the 4+ and 5+ bands at once. A route that
-- named a class or a subject would misdescribe it and would have to change the
-- first time a second subject shipped.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- A category for early-years learning
--
-- The existing education categories are Courses, Scholarships, Study Tools and
-- Class Lessons. None fits: this is pre-primary, it is not organised by class,
-- and it is not a course a parent enrols in.
-- ---------------------------------------------------------------------------
INSERT INTO app_categories (vertical, slug, name, name_bn, sort_order)
VALUES ('education', 'early-years', 'Early Learning', 'শিশুশিক্ষা', 6)
ON CONFLICT (vertical, slug) DO NOTHING;

INSERT INTO apps (
    slug, vertical, category_id, name, name_bn, tagline, description, icon, route,
    status, is_featured, is_public, is_indexable, supports_my_apps, requires_auth,
    seo_title, seo_description, structured_data_type, sort_order, launched_at,
    metadata
)
VALUES (
    'pickixo-kids', 'education',
    (SELECT id FROM app_categories WHERE vertical = 'education' AND slug = 'early-years'),
    'Pickixo Kids', 'পিকজিকো কিডস',
    'শিশুদের খেলতে খেলতে নিজে নিজে শেখার প্ল্যাটফর্ম',
    'Bangla letters, words and numbers for 4+ and 5+ children, following the '
    'NCTB pre-primary curriculum and the textbook "আমার বই". One platform for '
    'both ages: the child is never asked how old they are, and the difficulty '
    'adapts to how they are actually doing, letter by letter. Picture-first, '
    'audio-first, playable without reading. No account needed.',
    'sparkles', '/kids',
    -- Beta rather than live, and the reason is specific: the curriculum data
    -- covers the whole alphabet and 0-20, every picture-word is drawn and all
    -- eighteen game types are playable, but there is no recorded audio and
    -- only two of the five subjects in the plan are built.
    'beta', true, true, true, true, false,
    'পিকজিকো কিডস — শিশুদের বাংলা ও সংখ্যা শেখার প্ল্যাটফর্ম',
    'বাংলাদেশের এনসিটিবি প্রাক-প্রাথমিক শিক্ষাক্রম অনুসরণ করে ৪+ ও ৫+ বয়সি '
    'শিশুদের জন্য বিনামূল্যে বাংলা বর্ণ, শব্দ ও সংখ্যা শেখার প্ল্যাটফর্ম। '
    'ছবি, শব্দ ও খেলার মাধ্যমে শিশু নিজে নিজেই শিখতে পারে।',
    'WebApplication', 0, now(),
    jsonb_build_object(
        'curriculum',       'NCTB প্রাক-প্রাথমিক শিক্ষাক্রম ২০২২ (পরিমার্জিত ২০২৫)',
        'textbook',         'আমার বই — প্রাক-প্রাথমিক শিক্ষা, NCTB (2018)',
        'age_bands',        jsonb_build_array('4+', '5+'),
        -- Recorded because it is the product's central design claim and it
        -- should be checkable from the registry, not only from the page copy.
        'single_platform',  'one adaptive engine for both bands; the child is never asked their age',
        'subjects',         jsonb_build_array('bangla', 'numbers'),
        'lessons_total',    36,
        'lessons_available', 20,
        'letters',          jsonb_build_object('vowels', 11, 'consonants', 39),
        'numbers',          '0-20',
        'needs_account',    false,
        'offline_capable',  true,
        'audio',            'browser speech synthesis (bn-BD); no recordings yet',
        'illustrations',    'original inline SVG; textbook artwork is not reused',
        'picture_words',    99,
        'game_types',       18,
        'data_leaves_device', false
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
-- Same guard as 010 and 013: only touch updated_at when something actually
-- changed, because sitemap.xml publishes it as lastmod and IndexNow announces
-- anything newer than its last submission.
WHERE (apps.status, apps.route, apps.category_id, apps.description,
       apps.seo_title, apps.seo_description, apps.metadata)
   IS DISTINCT FROM
      (EXCLUDED.status, EXCLUDED.route, EXCLUDED.category_id, EXCLUDED.description,
       EXCLUDED.seo_title, EXCLUDED.seo_description, EXCLUDED.metadata);
