-- ============================================================================
-- Pickixo — 018_class2_math_live.sql
-- Class 2 Maths: beta → live.
--
-- A new file rather than an edit to 016, because 016 has already been applied
-- and RUNNING.md is explicit: "Never edit an already-applied file — add a new
-- numbered one." Editing it would also mean the file on disk no longer
-- describes what was run, which is the thing numbered migrations exist to
-- prevent.
--
-- Why the status changes. 016 recorded the reason for beta: "all seven
-- chapters and thirty-nine topics are complete and working, but it has just
-- shipped and has not yet had real classroom use." That was a statement about
-- how new it was, not about anything missing from it — and it is no longer
-- new. The course covers its whole book, so there is no part of "প্রাথমিক
-- গণিত" a child can reach and find absent, which is what beta warns about.
--
-- Only `status` moves. Everything else 016 set stays as it is.
-- ============================================================================

-- psql on Windows defaults client_encoding to the console codepage (WIN1252),
-- and every file here is UTF-8 with Bangla in it. Without this line the server
-- decodes those bytes as WIN1252: bytes it has no mapping for abort the run,
-- and — worse — bytes it *does* map are silently inserted as mojibake. Setting
-- it in the file means the run is correct however psql was invoked.
SET client_encoding TO 'UTF8';

UPDATE apps
   SET status     = 'live',
       updated_at = now()
 WHERE slug   = 'class-2-math'
   -- Same guard as every registry migration here: do not touch updated_at
   -- when nothing actually changes, because sitemap.xml publishes it as
   -- lastmod and IndexNow announces anything newer than its last submission.
   -- Re-running this file after it has taken effect is then a no-op.
   AND status IS DISTINCT FROM 'live';
