-- ============================================================================
-- Pickixo — 004_ai.sql
-- AI provider health, usage accounting and quota (§31, §36, §39, §40).
--
-- The router keeps live health in process because it consults it on every
-- request and a database round trip per provider per call would be absurd.
-- These tables are the durable mirror: what the admin panel reads, and what
-- survives a restart so a provider known to be quota-exhausted until midnight
-- is not retried the moment the service comes back up.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- ai_providers — registry + health mirror (§31, §37)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_providers (
    slug                text PRIMARY KEY,
    display_name        text NOT NULL,
    -- What this provider can actually do. The router refuses to fail over to a
    -- provider whose capability set does not cover the request (§29).
    capabilities        text[] NOT NULL DEFAULT '{}',
    -- Lower runs first. Admin-editable (§30) rather than hardcoded.
    priority            integer NOT NULL DEFAULT 100,
    enabled             boolean NOT NULL DEFAULT false,

    status              text NOT NULL DEFAULT 'unknown' CHECK (status IN
                        ('unknown', 'healthy', 'degraded', 'rate_limited',
                         'quota_exhausted', 'temporarily_unavailable',
                         'authentication_error', 'disabled')),

    default_model       text,
    -- Ordered fallback list within this one provider (§34).
    models              text[] NOT NULL DEFAULT '{}',

    last_success_at     timestamptz,
    last_failure_at     timestamptz,
    last_error          text,
    failure_count       integer NOT NULL DEFAULT 0,
    -- Honoured from Retry-After when the vendor sends one, else a per-failure
    -- default. The router skips the provider entirely until this passes.
    cooldown_until      timestamptz,
    -- Whatever the vendor tells us about what is left. NULL means "not stated".
    remaining_requests  integer,
    remaining_tokens    bigint,
    quota_reset_at      timestamptz,
    avg_latency_ms      integer,

    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

-- NOTE: there is no api_key column, and there must never be one. Keys live in
-- the server environment only (§38). The admin panel shows configured/not
-- configured, never a value.

CREATE INDEX IF NOT EXISTS ai_providers_priority_idx ON ai_providers (priority)
    WHERE enabled;

-- ---------------------------------------------------------------------------
-- ai_usage — one row per attempt, successful or not (§39)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_usage (
    id              bigserial PRIMARY KEY,
    -- Correlates every attempt of one user request, so a fallback chain reads
    -- as a chain rather than as unrelated rows (§36, §80).
    request_id      uuid NOT NULL,
    user_id         uuid REFERENCES users (id) ON DELETE SET NULL,
    app_id          uuid REFERENCES apps (id) ON DELETE SET NULL,
    capability      text NOT NULL,
    provider        text NOT NULL,
    model           text,
    attempt         smallint NOT NULL DEFAULT 1,
    -- True when this attempt only happened because an earlier provider failed.
    fallback_used   boolean NOT NULL DEFAULT false,
    status          text NOT NULL CHECK (status IN ('success', 'failure')),
    -- Stable internal code (RATE_LIMITED, QUOTA_EXHAUSTED, ...), never the raw
    -- upstream body — that goes to the logs (§122).
    failure_reason  text,
    input_tokens    integer,
    output_tokens   integer,
    latency_ms      integer,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_usage_request_idx  ON ai_usage (request_id);
CREATE INDEX IF NOT EXISTS ai_usage_user_day_idx ON ai_usage (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_usage_provider_idx ON ai_usage (provider, created_at DESC);

-- ---------------------------------------------------------------------------
-- usage_counters — the quota ledger (§40, §88)
--
-- Enforced in the database, not the frontend, and consumed atomically, so two
-- parallel requests cannot both take the last unit. Guests are counted by a
-- hashed client key instead of a user id.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usage_counters (
    id          bigserial PRIMARY KEY,
    user_id     uuid REFERENCES users (id) ON DELETE CASCADE,
    -- SHA-256 of the guest's IP + a server salt. Set only when user_id is NULL.
    guest_key   bytea,
    kind        text NOT NULL,
    day         date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
    used        integer NOT NULL DEFAULT 0,
    CHECK (num_nonnulls(user_id, guest_key) = 1)
);

CREATE UNIQUE INDEX IF NOT EXISTS usage_counters_user_key
    ON usage_counters (user_id, kind, day) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS usage_counters_guest_key
    ON usage_counters (guest_key, kind, day) WHERE guest_key IS NOT NULL;

-- ---------------------------------------------------------------------------
-- app_settings — runtime configuration and feature flags (§77)
--
-- Values an operator changes without a redeploy. Secrets are NOT settings and
-- never appear here.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_settings (
    key         text PRIMARY KEY,
    value       jsonb NOT NULL,
    description text,
    updated_by  uuid REFERENCES users (id) ON DELETE SET NULL,
    updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- audit_logs — privileged actions (§119, §79)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
    id          bigserial PRIMARY KEY,
    actor_id    uuid REFERENCES users (id) ON DELETE SET NULL,
    action      text NOT NULL,
    target      text,
    result      text NOT NULL DEFAULT 'success' CHECK (result IN ('success', 'failure')),
    -- Never secrets (§119).
    detail      jsonb NOT NULL DEFAULT '{}'::jsonb,
    ip          inet,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_logs_actor_idx ON audit_logs (actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_action_idx ON audit_logs (action, created_at DESC);
