-- ============================================================================
-- Pickixo — 010_products.sql
-- Registry rows for the products that have actually shipped.
--
-- 007_seed.sql holds the catalogue as it was planned. This file holds what has
-- since been built, so that rebuilding from database/schema/ reproduces the
-- live registry rather than an older version of it.
--
-- That drift was real: the YouTube Transcript Generator had been live and
-- serving traffic for a day while existing in no migration at all. It was
-- inserted straight into the running database, so a fresh build — including
-- the throwaway database scripts/test-api.sh creates — came up without it, and
-- its page would have found no registry row. It is backfilled below.
--
-- Re-runnable: every statement is ON CONFLICT DO UPDATE, so applying this to a
-- database that already has these rows corrects them instead of failing.
--
-- Each update carries a WHERE that compares the columns it would write. Without
-- it a re-run touches `updated_at` on rows whose content is identical, and
-- `updated_at` is not decoration here: sitemap.xml publishes it as `lastmod`
-- and IndexNow announces anything newer than its last submission. Re-running
-- this file would therefore have told Bing that a tool had changed when nothing
-- about it had — which is precisely the false-freshness problem the sitemap was
-- already fixed once to avoid. A feed that cries wolf gets its dates ignored.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Backfill: YouTube Transcript Generator (live since 2026-09-12)
-- ---------------------------------------------------------------------------
INSERT INTO apps (
    slug, vertical, category_id, name, name_bn, tagline, description, icon, route,
    status, is_featured, is_public, is_indexable, supports_my_apps, requires_auth,
    seo_title, seo_description, structured_data_type, sort_order, launched_at
)
VALUES (
    'youtube-transcript', 'tools',
    (SELECT id FROM app_categories WHERE vertical = 'tools' AND slug = 'text'),
    'YouTube Transcript Generator', 'ইউটিউব ট্রান্সক্রিপ্ট জেনারেটর',
    'Any YouTube video, as text',
    'Paste a YouTube link and get the spoken words as text with timestamps. '
    'Copy it, or download it as a plain text file or an SRT subtitle file. '
    'Works with normal videos, Shorts and share links.',
    'captions', '/tools/youtube-transcript',
    'live', true, true, true, true, false,
    'YouTube Transcript Generator - Free YouTube Transcript Tool',
    'Get YouTube video transcripts instantly with Pickixo. Paste a YouTube URL, '
    'extract the transcript, copy it, or download it as TXT or SRT.',
    'WebApplication', 5, '2026-09-12 18:01:11.760567+00'
)
ON CONFLICT (slug) DO UPDATE SET
    status          = EXCLUDED.status,
    route           = EXCLUDED.route,
    description     = EXCLUDED.description,
    seo_title       = EXCLUDED.seo_title,
    seo_description = EXCLUDED.seo_description,
    launched_at     = COALESCE(apps.launched_at, EXCLUDED.launched_at),
    updated_at      = now()
WHERE (apps.status, apps.route, apps.description,
       apps.seo_title, apps.seo_description)
   IS DISTINCT FROM
      (EXCLUDED.status, EXCLUDED.route, EXCLUDED.description,
       EXCLUDED.seo_title, EXCLUDED.seo_description);

-- ---------------------------------------------------------------------------
-- AI Background Remover
--
-- Unlike every other product here, this one does no work on the server: the
-- model is downloaded to the browser and runs there. That is why it has no
-- quota, needs no account, and why `metadata` records the model and its
-- licence — the page makes a specific privacy claim, and the thing that makes
-- the claim true is worth recording next to the product rather than only in a
-- document. See docs/MODELS.md.
-- ---------------------------------------------------------------------------
INSERT INTO apps (
    slug, vertical, category_id, name, name_bn, tagline, description, icon, route,
    status, is_featured, is_public, is_indexable, supports_my_apps, requires_auth,
    seo_title, seo_description, structured_data_type, sort_order, launched_at,
    metadata
)
VALUES (
    'background-remover', 'tools',
    (SELECT id FROM app_categories WHERE vertical = 'tools' AND slug = 'image'),
    'AI Background Remover', 'এআই ব্যাকগ্রাউন্ড রিমুভার',
    'Cut the background out of a photo',
    'Remove the background from a photo and download a transparent PNG at full '
    'resolution. The AI runs inside your browser, so the image never leaves '
    'your device and there is no limit on how many you do. Strongest on '
    'photographs of people.',
    'scissors', '/tools/background-remover',
    'live', true, true, true, true, false,
    'AI Background Remover - Remove Image Backgrounds Free',
    'Remove the background from a photo in your browser. The image never leaves '
    'your device, there is no sign-up, and you get a transparent PNG at full '
    'resolution.',
    'WebApplication', 6, now(),
    jsonb_build_object(
        'execution',    'client-side',
        'uploads_image', false,
        'model',         'ormbg',
        'model_licence', 'Apache-2.0',
        'model_source',  'https://huggingface.co/schirrmacher/ormbg',
        'model_bytes',   88171951,
        'best_for',      jsonb_build_array('people', 'portraits', 'single clear objects'),
        'weak_for',      jsonb_build_array('cluttered scenes', 'multiple animals')
    )
)
ON CONFLICT (slug) DO UPDATE SET
    status          = EXCLUDED.status,
    route           = EXCLUDED.route,
    description     = EXCLUDED.description,
    seo_title       = EXCLUDED.seo_title,
    seo_description = EXCLUDED.seo_description,
    metadata        = EXCLUDED.metadata,
    launched_at     = COALESCE(apps.launched_at, EXCLUDED.launched_at),
    updated_at      = now()
WHERE (apps.status, apps.route, apps.description,
       apps.seo_title, apps.seo_description, apps.metadata)
   IS DISTINCT FROM
      (EXCLUDED.status, EXCLUDED.route, EXCLUDED.description,
       EXCLUDED.seo_title, EXCLUDED.seo_description, EXCLUDED.metadata);
