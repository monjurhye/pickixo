-- ============================================================================
-- Pickixo — 007_seed.sql
-- The product registry contents, feature flags and provider registry.
--
-- IMPORTANT, and the reason every row carries an honest status:
--
--   status = 'live'     the product is built and works
--   status = 'beta'     built and usable, rough edges, badged as such
--   status = 'planned'  NOT built. It is listed so the shape of the platform is
--                       visible and so navigation, search and the sitemap have
--                       something real to be tested against. Its page says
--                       plainly that it is not ready and offers no controls
--                       that pretend to work (§123).
--
-- Nothing here is marked live to make the catalogue look fuller. When a product
-- ships, its row is flipped and its landing page becomes indexable.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Feature flags (§77). Paid paths ship off and stay off until they are real.
-- ---------------------------------------------------------------------------
INSERT INTO app_settings (key, value, description) VALUES
    ('AI_ENABLED',           'true',  'Master switch for the AI router'),
    ('AI_FREE_MODE',         'true',  'AI is free to use; no credits are consumed'),
    ('PAID_PLANS_ENABLED',   'false', 'No paid plans exist; no pricing is shown'),
    ('CREDITS_ENABLED',      'false', 'No credit ledger is active'),
    ('ADS_ENABLED',          'false', 'No advertising is served'),
    ('GAMES_ENABLED',        'false', 'Games vertical not built yet'),
    ('JOBS_ENABLED',         'false', 'Jobs vertical not built yet'),
    ('EDUCATION_ENABLED',    'false', 'Education vertical not built yet'),
    ('BANGLADESH_ENABLED',   'false', 'Bangladesh vertical not built yet'),
    ('BETA_FEATURES_ENABLED','false', 'Gate for unfinished features'),
    ('GUEST_AI_ENABLED',     'true',  'Signed-out visitors may try AI within a lower daily limit'),
    ('SIGNUP_ENABLED',       'true',  'New account registration is open')
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Categories
-- ---------------------------------------------------------------------------
INSERT INTO app_categories (vertical, slug, name, name_bn, sort_order) VALUES
    ('ai',          'chat',        'Chat',              'চ্যাট',            10),
    ('ai',          'writing',     'Writing',           'লেখালেখি',         20),
    ('ai',          'documents',   'Documents',         'ডকুমেন্ট',          30),
    ('ai',          'image',       'Image',             'ছবি',              40),
    ('ai',          'study',       'Study',             'পড়াশোনা',          50),
    ('ai',          'coding',      'Coding',            'কোডিং',            60),
    ('tools',       'pdf',         'PDF',               'পিডিএফ',           10),
    ('tools',       'image',       'Image',             'ছবি',              20),
    ('tools',       'text',        'Text',              'টেক্সট',            30),
    ('tools',       'developer',   'Developer',         'ডেভেলপার',         40),
    ('tools',       'seo',         'SEO',               'এসইও',             50),
    ('apps',        'productivity','Productivity',      'প্রোডাক্টিভিটি',     10),
    ('games',       'puzzle',      'Puzzle',            'পাজল',             10),
    ('games',       'casual',      'Casual',            'ক্যাজুয়াল',          20),
    ('jobs',        'government',  'Government',        'সরকারি',           10),
    ('jobs',        'remote',      'Remote',            'রিমোট',            20),
    ('jobs',        'career-tools','Career Tools',      'ক্যারিয়ার টুলস',    30),
    ('education',   'courses',     'Courses',           'কোর্স',            10),
    ('education',   'scholarships','Scholarships',      'বৃত্তি',            20),
    ('education',   'study-tools', 'Study Tools',       'স্টাডি টুলস',       30)
ON CONFLICT (vertical, slug) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Products
-- ---------------------------------------------------------------------------
WITH c AS (SELECT id, vertical, slug FROM app_categories)
INSERT INTO apps (
    slug, vertical, category_id, name, name_bn, tagline, description, icon, route,
    status, is_featured, supports_my_apps, requires_auth,
    seo_title, seo_description, structured_data_type, sort_order
)
VALUES
    -- === AI ================================================================
    ('ai-chat', 'ai', (SELECT id FROM c WHERE vertical='ai' AND slug='chat'),
     'AI Chat', 'এআই চ্যাট',
     'Ask anything, in English or Bangla',
     'A single chat box backed by several AI providers. If one provider is rate limited or down, Pickixo moves to the next one automatically, so you get an answer instead of an error.',
     'message-circle', '/ai/chat',
     'beta', true, true, false,
     'Free AI Chat — ask anything in English or Bangla',
     'Chat with AI for free on Pickixo. Backed by multiple providers with automatic failover, so answers keep coming even when one provider is busy.',
     'WebApplication', 10),

    ('ai-image', 'ai', (SELECT id FROM c WHERE vertical='ai' AND slug='image'),
     'AI Image Generator', 'এআই ইমেজ জেনারেটর',
     'Describe a picture, get a picture',
     'Turn a written description into an image. Runs on free-tier image providers, with a daily limit so the service stays available to everyone.',
     'image', '/ai/image',
     'planned', true, true, false,
     'Free AI Image Generator — text to image',
     'Generate images from a text description, free on Pickixo.',
     'WebApplication', 20),

    ('ai-writer', 'ai', (SELECT id FROM c WHERE vertical='ai' AND slug='writing'),
     'AI Writer', 'এআই রাইটার',
     'Drafts, rewrites and summaries',
     'Write and rewrite posts, emails and descriptions with AI assistance.',
     'pen-line', '/ai/writer',
     'planned', false, true, false,
     'AI Writer — draft, rewrite and summarise',
     'Draft, rewrite and summarise text with free AI on Pickixo.',
     'WebApplication', 30),

    ('ai-documents', 'ai', (SELECT id FROM c WHERE vertical='ai' AND slug='documents'),
     'Document AI', 'ডকুমেন্ট এআই',
     'Ask questions about your files',
     'Upload a PDF, Word file or spreadsheet and ask questions, get a summary, or extract the parts you need.',
     'file-text', '/ai/documents',
     'planned', false, true, true,
     'Document AI — summarise and question your PDFs',
     'Upload a document and ask questions about it, summarise it, or extract data. Free on Pickixo.',
     'WebApplication', 40),

    ('ai-study', 'ai', (SELECT id FROM c WHERE vertical='ai' AND slug='study'),
     'AI Tutor', 'এআই টিউটর',
     'Explanations that fit your level',
     'Ask a question about what you are studying and get an explanation, worked examples and practice.',
     'graduation-cap', '/ai/study',
     'planned', false, true, false,
     'AI Tutor — free study help in English and Bangla',
     'Get explanations, worked examples and practice questions from a free AI tutor.',
     'WebApplication', 50),

    -- === TOOLS =============================================================
    ('pdf-compressor', 'tools', (SELECT id FROM c WHERE vertical='tools' AND slug='pdf'),
     'PDF Compressor', 'পিডিএফ কম্প্রেসর',
     'Make a PDF smaller without wrecking it',
     'Reduce the file size of a PDF so it fits an upload limit or an email attachment.',
     'file-down', '/tools/pdf-compressor',
     'planned', true, true, false,
     'Free PDF Compressor — reduce PDF file size online',
     'Compress a PDF online for free. No sign-up needed.',
     'WebApplication', 10),

    ('pdf-merger', 'tools', (SELECT id FROM c WHERE vertical='tools' AND slug='pdf'),
     'PDF Merger', 'পিডিএফ মার্জার',
     'Join several PDFs into one',
     'Combine multiple PDF files into a single document, in the order you choose.',
     'files', '/tools/pdf-merger',
     'planned', false, true, false,
     'Free PDF Merger — combine PDF files online',
     'Merge several PDFs into one file, free and without sign-up.',
     'WebApplication', 20),

    ('image-compressor', 'tools', (SELECT id FROM c WHERE vertical='tools' AND slug='image'),
     'Image Compressor', 'ইমেজ কম্প্রেসর',
     'Smaller images, same picture',
     'Shrink JPEG and PNG files for faster pages and smaller uploads.',
     'image-down', '/tools/image-compressor',
     'planned', false, true, false,
     'Free Image Compressor — compress JPG and PNG',
     'Compress images online for free without losing visible quality.',
     'WebApplication', 30),

    ('json-formatter', 'tools', (SELECT id FROM c WHERE vertical='tools' AND slug='developer'),
     'JSON Formatter', 'জেসন ফরম্যাটার',
     'Format, validate and inspect JSON',
     'Paste JSON to pretty-print it, find the syntax error, or collapse it to one line.',
     'braces', '/tools/json-formatter',
     'planned', false, true, false,
     'Free JSON Formatter and Validator',
     'Format, validate and minify JSON in your browser. Free on Pickixo.',
     'WebApplication', 40),

    ('word-counter', 'tools', (SELECT id FROM c WHERE vertical='tools' AND slug='text'),
     'Word Counter', 'ওয়ার্ড কাউন্টার',
     'Words, characters and reading time',
     'Count words, characters, sentences and paragraphs, and estimate reading time.',
     'type', '/tools/word-counter',
     'planned', false, true, false,
     'Free Word Counter — words, characters and reading time',
     'Count words and characters and estimate reading time, free on Pickixo.',
     'WebApplication', 50),

    ('qr-generator', 'tools', (SELECT id FROM c WHERE vertical='tools' AND slug='developer'),
     'QR Code Generator', 'কিউআর কোড জেনারেটর',
     'Any link, one QR code',
     'Turn a link, text or contact detail into a QR code you can download.',
     'qr-code', '/tools/qr-generator',
     'planned', false, true, false,
     'Free QR Code Generator — download PNG and SVG',
     'Create a QR code from a link or text and download it free.',
     'WebApplication', 60),

    -- === JOBS ==============================================================
    ('cv-builder', 'jobs', (SELECT id FROM c WHERE vertical='jobs' AND slug='career-tools'),
     'CV Builder', 'সিভি বিল্ডার',
     'Build a CV that gets read',
     'Put together a clean, readable CV and export it as a PDF.',
     'file-user', '/jobs/cv-builder',
     'planned', true, true, true,
     'Free CV Builder — make a professional CV online',
     'Build and download a professional CV for free on Pickixo.',
     'WebApplication', 10),

    ('cv-analyzer', 'jobs', (SELECT id FROM c WHERE vertical='jobs' AND slug='career-tools'),
     'CV Analyzer', 'সিভি অ্যানালাইজার',
     'What your CV is missing',
     'Upload a CV and get specific, actionable feedback on what to fix before you send it.',
     'search-check', '/jobs/cv-analyzer',
     'planned', false, true, true,
     'Free CV Analyzer — get feedback on your CV',
     'Upload your CV and get free AI feedback on how to improve it.',
     'WebApplication', 20),

    ('government-jobs', 'jobs', (SELECT id FROM c WHERE vertical='jobs' AND slug='government'),
     'Government Jobs', 'সরকারি চাকরি',
     'Circulars with deadlines you can trust',
     'Government job circulars, each one carrying its official source, publication date and deadline.',
     'landmark', '/jobs/government',
     'planned', false, true, false,
     'Government Job Circulars — with official sources and deadlines',
     'Browse government job circulars with verified sources and application deadlines.',
     'JobPosting', 30),

    -- === EDUCATION =========================================================
    ('scholarship-finder', 'education', (SELECT id FROM c WHERE vertical='education' AND slug='scholarships'),
     'Scholarship Finder', 'বৃত্তি খুঁজুন',
     'Scholarships you are actually eligible for',
     'Find scholarships filtered by what you study, where you want to go and what you qualify for.',
     'award', '/education/scholarships',
     'planned', true, true, false,
     'Scholarship Finder — search scholarships by eligibility',
     'Find scholarships you are eligible for, with official sources and deadlines.',
     'WebApplication', 10),

    ('study-planner', 'education', (SELECT id FROM c WHERE vertical='education' AND slug='study-tools'),
     'Study Planner', 'স্টাডি প্ল্যানার',
     'A plan that survives contact with the week',
     'Turn a syllabus and an exam date into a realistic day-by-day study plan.',
     'calendar-check', '/education/study-planner',
     'planned', false, true, true,
     'Free Study Planner — build a revision timetable',
     'Turn your syllabus and exam date into a day-by-day study plan, free.',
     'WebApplication', 20),

    -- === GAMES =============================================================
    ('snake', 'games', (SELECT id FROM c WHERE vertical='games' AND slug='casual'),
     'Snake', 'স্নেক',
     'The one you already know how to play',
     'Classic snake, in the browser, with a daily high score.',
     'gamepad-2', '/games/snake',
     'planned', false, true, false,
     'Play Snake online free — no download',
     'Play the classic Snake game free in your browser, with daily high scores.',
     'VideoGame', 10)
ON CONFLICT (slug) DO NOTHING;

-- ---------------------------------------------------------------------------
-- AI provider registry (§31, §37)
--
-- enabled is false everywhere. A provider turns on when an operator supplies
-- its key in the server environment AND enables it here — the router treats a
-- provider with no key as not configured and skips it silently, so an untouched
-- install never pretends a provider is available.
--
-- No API key column exists on this table by design (§38).
-- ---------------------------------------------------------------------------
INSERT INTO ai_providers (slug, display_name, capabilities, priority, enabled, default_model, models) VALUES
    ('groq',        'Groq',              ARRAY['text','code'],          10, false, 'openai/gpt-oss-120b',                     ARRAY['openai/gpt-oss-120b']),
    ('cerebras',    'Cerebras',          ARRAY['text','code'],          20, false, 'gpt-oss-120b',                            ARRAY['gpt-oss-120b']),
    ('openrouter',  'OpenRouter',        ARRAY['text','code','vision'], 30, false, 'meta-llama/llama-3.3-70b-instruct:free',  ARRAY['meta-llama/llama-3.3-70b-instruct:free']),
    ('mistral',     'Mistral',           ARRAY['text','code'],          40, false, 'mistral-small-latest',                    ARRAY['mistral-small-latest']),
    ('nvidia_nim',  'NVIDIA NIM',        ARRAY['text','code'],          50, false, 'meta/llama-3.3-70b-instruct',             ARRAY['meta/llama-3.3-70b-instruct']),
    ('gemini',      'Google Gemini',     ARRAY['text','vision','code'], 60, false, 'gemini-2.5-flash',                        ARRAY['gemini-2.5-flash']),
    ('pollinations_text',  'Pollinations Text',  ARRAY['text'],         70, false, 'openai',                                  ARRAY['openai']),
    ('ollama',      'Ollama (local)',    ARRAY['text','code'],          80, false, 'qwen3:1.7b',                              ARRAY['qwen3:1.7b']),
    ('cloudflare_image',   'Cloudflare Workers AI', ARRAY['image'],     10, false, '@cf/black-forest-labs/flux-1-schnell',     ARRAY['@cf/black-forest-labs/flux-1-schnell']),
    ('pollinations_image', 'Pollinations Image',    ARRAY['image'],     20, false, 'flux',                                    ARRAY['flux'])
ON CONFLICT (slug) DO NOTHING;
