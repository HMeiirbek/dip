-- Production persistence for security/risk/moderation raw tables.
-- Replaces runtime CREATE TABLE calls in services.

CREATE TABLE IF NOT EXISTS security_user_state (
  user_id TEXT PRIMARY KEY,
  role TEXT NOT NULL DEFAULT 'user',
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS security_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  refresh_token_hash TEXT NOT NULL,
  device_info TEXT NULL,
  ip_address TEXT NULL,
  user_agent TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_security_sessions_user_id
  ON security_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_security_sessions_refresh_hash
  ON security_sessions(refresh_token_hash);

CREATE TABLE IF NOT EXISTS security_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  ip_address TEXT NULL,
  device TEXT NULL,
  action TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS security_codes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_codes_user_kind
  ON security_codes(user_id, kind);

CREATE TABLE IF NOT EXISTS risk_reports (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  description TEXT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS risk_blacklist (
  id TEXT PRIMARY KEY,
  phone_number TEXT NOT NULL UNIQUE,
  reason TEXT NULL,
  source TEXT NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS call_quality_metrics (
  id TEXT PRIMARY KEY,
  call_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  rtt_ms DOUBLE PRECISION NULL,
  jitter_ms DOUBLE PRECISION NULL,
  packet_loss_pct DOUBLE PRECISION NULL,
  mos_like DOUBLE PRECISION NULL,
  bitrate_kbps DOUBLE PRECISION NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_call_quality_call_created
  ON call_quality_metrics(call_id, created_at DESC);

CREATE TABLE IF NOT EXISTS moderation_call_flags (
  id TEXT PRIMARY KEY,
  call_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ NULL,
  resolved_by TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_moderation_call_flags_call_id_created
  ON moderation_call_flags(call_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_moderation_call_flags_status_created
  ON moderation_call_flags(status, created_at DESC);
