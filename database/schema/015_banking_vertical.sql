-- ============================================================================
-- Pickixo — 015_banking_vertical.sql
-- Adds the `banking` vertical (header menu: "Banking Services").
--
-- The vertical list is a CHECK constraint on both `apps` and `app_categories`
-- (see 002_registry.sql), so a new top-level section needs the constraint
-- widened before any row can use it. 002 has been updated for fresh installs;
-- this migration brings an existing database in line.
-- ============================================================================

ALTER TABLE app_categories DROP CONSTRAINT IF EXISTS app_categories_vertical_check;
ALTER TABLE app_categories ADD CONSTRAINT app_categories_vertical_check CHECK (vertical IN
    ('ai', 'apps', 'tools', 'games', 'jobs', 'education', 'banking', 'bangladesh'));

ALTER TABLE apps DROP CONSTRAINT IF EXISTS apps_vertical_check;
ALTER TABLE apps ADD CONSTRAINT apps_vertical_check CHECK (vertical IN
    ('ai', 'apps', 'tools', 'games', 'jobs', 'education', 'banking', 'bangladesh'));

-- ---------------------------------------------------------------------------
-- Submenu categories
--
-- Same slugs as SUBMENUS.banking in apps/web/src/lib/verticals.ts: the submenu
-- pages list apps with /apps?vertical=banking&category=<slug>.
-- ---------------------------------------------------------------------------
INSERT INTO app_categories (vertical, slug, name, name_bn, sort_order) VALUES
    ('banking', 'loans',          'Loans',              'ঋণ',              10),
    ('banking', 'savings',        'Savings & Deposits', 'সঞ্চয় ও আমানত',    20),
    ('banking', 'cards',          'Cards',              'কার্ড',            30),
    ('banking', 'mobile-banking', 'Mobile Banking',     'মোবাইল ব্যাংকিং',   40),
    ('banking', 'bank-directory', 'Bank Directory',     'ব্যাংক ডিরেক্টরি',   50),
    ('banking', 'calculators',    'Calculators',        'ক্যালকুলেটর',       60)
ON CONFLICT (vertical, slug) DO NOTHING;
