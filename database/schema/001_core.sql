-- ============================================================================
-- Pickixo — 001_core.sql
-- Identity, sessions and profile.
--
-- Pickixo owns its own authentication: there is no third-party auth service
-- behind this. Passwords are argon2id hashes produced by the API and are never
-- reversible here. A user may hold several identities (email, google) that all
-- resolve to one Pickixo account — that is the whole point of §12, one account
-- across AI, Apps, Tools, Games, Jobs and Education.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email               citext NOT NULL UNIQUE,
    -- NULL for an account that has only ever signed in with Google: there is
    -- no password to check, and a NULL hash can never match a supplied one.
    password_hash       text,
    email_verified_at   timestamptz,
    display_name        text,
    avatar_url          text,
    -- 'user' | 'admin'. Changing this is guarded by a trigger in 005 so that
    -- application code alone can never promote an account.
    role                text NOT NULL DEFAULT 'user'
                        CHECK (role IN ('user', 'admin')),
    status              text NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'suspended', 'deleted')),
    locale              text NOT NULL DEFAULT 'en' CHECK (locale IN ('en', 'bn')),
    last_login_at       timestamptz,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS users_status_idx ON users (status) WHERE status <> 'active';

-- ---------------------------------------------------------------------------
-- identities — one row per sign-in method attached to a user
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS identities (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    provider        text NOT NULL CHECK (provider IN ('email', 'google')),
    -- Google's stable subject claim ('sub'); for email, the address itself.
    -- Never the raw email for Google: Google users can change their address,
    -- and 'sub' is the only identifier Google guarantees is stable.
    provider_uid    text NOT NULL,
    -- Non-sensitive profile fields returned by the provider. No tokens here.
    provider_data   jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (provider, provider_uid)
);

CREATE INDEX IF NOT EXISTS identities_user_idx ON identities (user_id);

-- ---------------------------------------------------------------------------
-- sessions — refresh-token family, one row per active device
--
-- The browser holds an opaque refresh token; only its SHA-256 lives here, so a
-- database leak does not hand out sessions. Rotation is enforced: presenting a
-- token that has already been rotated means it was stolen and replayed, so the
-- whole family is revoked rather than just that token.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sessions (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    family_id           uuid NOT NULL,
    refresh_token_hash  bytea NOT NULL UNIQUE,
    user_agent          text,
    ip                  inet,
    expires_at          timestamptz NOT NULL,
    rotated_at          timestamptz,
    revoked_at          timestamptz,
    created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sessions_user_idx   ON sessions (user_id);
CREATE INDEX IF NOT EXISTS sessions_family_idx ON sessions (family_id);
CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions (expires_at)
    WHERE revoked_at IS NULL;

-- ---------------------------------------------------------------------------
-- auth_tokens — single-use tokens for email verification and password reset
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS auth_tokens (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    purpose     text NOT NULL CHECK (purpose IN ('verify_email', 'reset_password')),
    token_hash  bytea NOT NULL UNIQUE,
    expires_at  timestamptz NOT NULL,
    consumed_at timestamptz,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auth_tokens_user_idx ON auth_tokens (user_id, purpose);

-- ---------------------------------------------------------------------------
-- user_settings — per-user preferences, one row per user
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_settings (
    user_id             uuid PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    theme               text NOT NULL DEFAULT 'system'
                        CHECK (theme IN ('light', 'dark', 'system')),
    email_notifications boolean NOT NULL DEFAULT true,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);
