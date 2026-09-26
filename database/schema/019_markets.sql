-- ============================================================================
-- Pickixo — 019_markets.sql
-- Adds the "Markets" category under the `apps` vertical and registers
-- Pickbot: a systematic crypto momentum bot, with its decisions and its
-- paper-trading results shown in full.
--
-- Deliberate choices, because this product touches money and law:
--
--   requires_auth = true   It is a signed-in dashboard, not published trading
--                          calls. Crypto trading is prohibited in Bangladesh,
--                          and pickixo's audience is students and job seekers —
--                          buy/sell calls do not belong in front of them.
--                          Running the bot is admin-only on top of that.
--   status = 'planned'     The page is built but has days of paper data, not
--                          months. Per docs/ADDING-A-PRODUCT.md, `planned` keeps
--                          it out of the sitemap and tells the visitor the truth.
--                          Flip it to 'beta' once the record means something
--                          (see the bottom of this file).
--   supports_my_apps       true: it is a thing you come back to.
--   is_featured            false: nothing about this belongs on the home page.
--
-- Pickbot trades only its own paper book. It holds no visitor's exchange keys,
-- offers no advice, and cannot place an order for anyone reading the page.
-- ============================================================================

-- psql on Windows defaults client_encoding to the console codepage (WIN1252 here),
-- which cannot represent the Bangla below and fails with "byte sequence 0x8d ...
-- has no equivalent in encoding UTF8". Declaring it in the file makes this work
-- whatever codepage the console happens to be in.
SET client_encoding = 'UTF8';

INSERT INTO app_categories (vertical, slug, name, name_bn, sort_order) VALUES
    ('apps', 'markets', 'Markets', 'মার্কেটস', 20)
ON CONFLICT (vertical, slug) DO NOTHING;

INSERT INTO apps (
    slug, vertical, category_id, name, name_bn, tagline, description, icon, route,
    status, is_featured, supports_my_apps, requires_auth,
    seo_title, seo_description, structured_data_type, sort_order
) VALUES (
    'pickbot',
    'apps',
    (SELECT id FROM app_categories WHERE vertical = 'apps' AND slug = 'markets'),
    'Pickbot',
    'পিকবট',
    'A trading bot that shows its losses too',
    'Pickbot ranks liquid crypto pairs by momentum, holds the strongest few, and '
        || 'sells them when they turn. Every decision it has ever made is on the page, '
        || 'with the paper-trading result beside it. Educational research, not financial '
        || 'advice, and nothing here can trade on your behalf.',
    'bot',
    '/apps/pickbot',
    'planned',
    false,
    true,
    true,
    'Pickbot — a crypto momentum bot with a public track record',
    'The decisions and paper results of a systematic crypto momentum bot, published '
        || 'in full including the losing periods. Not financial advice.',
    'WebApplication',
    30
)
ON CONFLICT (slug) DO NOTHING;

-- When the paper record is long enough to be worth reading (weeks, not days):
--
--   UPDATE apps SET status = 'beta', launched_at = now() WHERE slug = 'pickbot';
--
-- Note that `beta` makes the landing page indexable. If you would rather keep it
-- private indefinitely, leave requires_auth = true and it stays behind sign-in
-- regardless of status.
