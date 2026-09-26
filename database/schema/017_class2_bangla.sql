-- ============================================================================
-- Pickixo — 017_class2_bangla.sql
-- Class 2 Bangla in the product registry.
--
-- Same lesson as 013 and 016: the Education section, search, My Apps,
-- recommendations and sitemap.xml are all driven by the `apps` table, so a
-- page with no row is a page nobody can find except by typing the URL
-- exactly. This is that row, written alongside the page rather than after it.
--
-- Same category as Class 2 English and Maths ('classes'), which 013 created
-- for exactly this: "the section will grow by class and subject rather than
-- by topic." Class 2 Bangla is the third subject in that growth.
-- ============================================================================

-- psql on Windows defaults client_encoding to the console codepage (WIN1252),
-- and every file here is UTF-8 with Bangla in it. Without this line the server
-- decodes those bytes as WIN1252: bytes it has no mapping for abort the run,
-- and — worse — bytes it *does* map are silently inserted as mojibake. Setting
-- it in the file means the run is correct however psql was invoked.
SET client_encoding TO 'UTF8';

INSERT INTO apps (
    slug, vertical, category_id, name, name_bn, tagline, description, icon, route,
    status, is_featured, is_public, is_indexable, supports_my_apps, requires_auth,
    seo_title, seo_description, structured_data_type, sort_order, launched_at,
    metadata
)
VALUES (
    'class-2-bangla', 'education',
    (SELECT id FROM app_categories WHERE vertical = 'education' AND slug = 'classes'),
    'Class 2 Bangla', 'ক্লাস টু বাংলা',
    'দ্বিতীয় শ্রেণির বাংলা — পড়ি, শিখি, খেলি',
    'Interactive Bangla lessons for Class 2, following the NCTB textbook '
    '"আমার বাংলা বই". All 29 পাঠ are covered: the alphabet, vowel signs '
    '(কারচিহ্ন), conjuncts (যুক্তবর্ণ), ফলা and রেফ, five stories, six poems, '
    'and the sentence-writing lessons. Every text has a listen button and '
    'every letter is tappable. Children work through a chapter, play a game, '
    'answer a short quiz and collect stars. No account needed.',
    'book-open', '/education/class-2/bangla',
    -- Live, unlike 013 and 016, because the reason those two are beta does not
    -- apply here: English ships 2 of its 10 units and Maths had not been used
    -- in a classroom yet, whereas this covers all 29 পাঠ of its book, with
    -- every lesson citing the page it came from and every বর্ণযোগ verified.
    -- There is no part of the book a child can reach and find missing.
    'live', true, true, true, true, false,
    'Class 2 Bangla - Read, Learn and Play Free',
    'Free interactive Bangla lessons for Class 2, following the Bangladesh '
    'NCTB textbook "আমার বাংলা বই". Alphabet, kar signs, conjunct letters, '
    'fola and reph, stories, rhymes and sentence writing — all 29 lessons, '
    'playable in Bangla.',
    'WebApplication', 3, now(),
    jsonb_build_object(
        'curriculum',        'NCTB আমার বাংলা বই, দ্বিতীয় শ্রেণি',
        'class',              2,
        'subject',            'bangla',
        'language',           'Bangla throughout; the textbook has no English',
        'chapters_total',     8,
        'chapters_available', 8,
        'lessons_available',  29,
        'lessons_in_book',    29,
        'words_available',    100,
        'letter_builds',      42,
        'needs_account',      false,
        'offline_capable',    false,
        -- Recorded so the honesty claims on the page are checkable from the
        -- registry too, not only from the page copy.
        'letter_arithmetic',  'every কার/যুক্তবর্ণ/ফলা/রেফ is verified to compose in Unicode at build time',
        'glosses',            'the book''s own শব্দ শিখি entries are marked textbook; Pickixo''s additions are marked enrichment',
        'illustrations',      'original; textbook artwork is not reused'
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
-- Same guard as 010, 013, 014 and 016: only touch updated_at when something
-- actually changed, because sitemap.xml publishes it as lastmod and IndexNow
-- announces anything newer than its last submission.
WHERE (apps.status, apps.route, apps.category_id, apps.description,
       apps.seo_title, apps.seo_description, apps.metadata)
   IS DISTINCT FROM
      (EXCLUDED.status, EXCLUDED.route, EXCLUDED.category_id, EXCLUDED.description,
       EXCLUDED.seo_title, EXCLUDED.seo_description, EXCLUDED.metadata);
