-- Recreate security tables required by AuthService/SecurityService.
-- These tables are used via raw SQL (Prisma $queryRawUnsafe / $executeRawUnsafe)
-- and are not represented in schema.prisma models.

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

CREATE INDEX IF NOT EXISTS idx_security_sessions_user_id ON security_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_security_sessions_refresh_hash ON security_sessions(refresh_token_hash);

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

CREATE INDEX IF NOT EXISTS idx_security_codes_user_kind ON security_codes(user_id, kind);

