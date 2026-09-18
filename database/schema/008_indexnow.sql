-- ============================================================================
-- Pickixo — 008_indexnow.sql
-- IndexNow submission ledger.
--
-- The point of this table is restraint. IndexNow is a way to tell Bing, Yandex
-- and others that a URL changed; submitting a URL that has not changed is at
-- best ignored and at worst gets the key throttled. So nothing is submitted
-- because a page was rendered, or because a counter moved — only when the
-- content behind a URL is genuinely newer than the last time we announced it.
--
-- content_changed_at is what makes that decidable: it is the source row's
-- updated_at at submission time, so "has it changed since?" is one comparison
-- rather than a guess.
-- ============================================================================

CREATE TABLE IF NOT EXISTS indexnow_submissions (
    url                 text PRIMARY KEY,

    -- The content timestamp that was current when we last announced this URL.
    -- A URL is resubmitted only when its source is newer than this.
    content_changed_at  timestamptz NOT NULL,

    last_submitted_at   timestamptz NOT NULL DEFAULT now(),
    -- 'pending'   queued, not yet sent
    -- 'submitted' accepted by the endpoint (202/200)
    -- 'failed'    rejected or unreachable; retried on the next sync
    status              text NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'submitted', 'failed')),
    attempts            integer NOT NULL DEFAULT 0,
    last_error          text,
    created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS indexnow_status_idx
    ON indexnow_submissions (status, last_submitted_at);
