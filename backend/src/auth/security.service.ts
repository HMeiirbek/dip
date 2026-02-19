import { Injectable, OnModuleInit } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

export type AppRole = 'user' | 'admin' | 'moderator';

type SecurityActivity = {
  userId?: string;
  action: string;
  at: Date;
  ipAddress?: string;
  deviceInfo?: string;
};

@Injectable()
export class SecurityService implements OnModuleInit {
  private readonly refreshTtlMs = 1000 * 60 * 60 * 24 * 30;

  private readonly adminUsernames = new Set(
    (process.env.ADMIN_USERNAMES || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );

  private readonly moderatorUsernames = new Set(
    (process.env.MODERATOR_USERNAMES || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    await this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS security_user_state (
        user_id TEXT PRIMARY KEY,
        role TEXT NOT NULL DEFAULT 'user',
        is_verified BOOLEAN NOT NULL DEFAULT FALSE,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await this.prisma.$executeRawUnsafe(`
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
    `);

    await this.prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS idx_security_sessions_user_id ON security_sessions(user_id);`,
    );
    await this.prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS idx_security_sessions_refresh_hash ON security_sessions(refresh_token_hash);`,
    );

    await this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS security_logs (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        ip_address TEXT NULL,
        device TEXT NULL,
        action TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS security_codes (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        code_hash TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        consumed_at TIMESTAMPTZ NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await this.prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS idx_security_codes_user_kind ON security_codes(user_id, kind);`,
    );
  }

  determineRoleByUsername(username: string): AppRole {
    if (this.adminUsernames.has(username)) return 'admin';
    if (this.moderatorUsernames.has(username)) return 'moderator';
    return 'user';
  }

  async resolveRole(userId: string, username?: string): Promise<AppRole> {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ role: string }>>(
      `SELECT role FROM security_user_state WHERE user_id = $1 LIMIT 1`,
      userId,
    );

    const role = rows[0]?.role;
    if (role === 'admin' || role === 'moderator' || role === 'user') {
      return role;
    }

    const derived = username ? this.determineRoleByUsername(username) : 'user';
    await this.setRole(userId, derived);
    return derived;
  }

  async setRole(userId: string, role: AppRole) {
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO security_user_state (user_id, role, is_verified, updated_at)
       VALUES ($1, $2, FALSE, NOW())
       ON CONFLICT (user_id)
       DO UPDATE SET role = EXCLUDED.role, updated_at = NOW()`,
      userId,
      role,
    );
  }

  async isVerified(userId: string) {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ is_verified: boolean }>>(
      `SELECT is_verified FROM security_user_state WHERE user_id = $1 LIMIT 1`,
      userId,
    );
    return Boolean(rows[0]?.is_verified);
  }

  async setVerified(userId: string) {
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO security_user_state (user_id, role, is_verified, updated_at)
       VALUES ($1, 'user', TRUE, NOW())
       ON CONFLICT (user_id)
       DO UPDATE SET is_verified = TRUE, updated_at = NOW()`,
      userId,
    );
  }

  async issueVerifyCode(userId: string) {
    const code = this.generateCode();
    await this.storeCode(userId, 'verify', code);
    return code;
  }

  async checkVerifyCode(userId: string, code: string) {
    const ok = await this.consumeCode(userId, 'verify', code);
    if (ok) {
      await this.setVerified(userId);
    }
    return ok;
  }

  async issueResetCode(userId: string) {
    const code = this.generateCode();
    await this.storeCode(userId, 'reset', code);
    return code;
  }

  async checkResetCode(userId: string, code: string) {
    return this.consumeCode(userId, 'reset', code);
  }

  async createSession(input: {
    userId: string;
    role: AppRole;
    deviceInfo?: string;
    ipAddress?: string;
    userAgent?: string;
  }) {
    const refreshToken = crypto.randomBytes(48).toString('hex');
    const now = new Date();
    const session = {
      id: crypto.randomUUID(),
      userId: input.userId,
      role: input.role,
      refreshTokenHash: this.hash(refreshToken),
      deviceInfo: input.deviceInfo || 'unknown',
      ipAddress: input.ipAddress || 'unknown',
      userAgent: input.userAgent || 'unknown',
      createdAt: now,
      expiresAt: new Date(now.getTime() + this.refreshTtlMs),
      lastSeenAt: now,
    };

    await this.prisma.$executeRawUnsafe(
      `INSERT INTO security_sessions
      (id, user_id, role, refresh_token_hash, device_info, ip_address, user_agent, created_at, expires_at, last_seen_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      session.id,
      session.userId,
      session.role,
      session.refreshTokenHash,
      session.deviceInfo,
      session.ipAddress,
      session.userAgent,
      session.createdAt,
      session.expiresAt,
      session.lastSeenAt,
    );

    await this.logActivity(input.userId, {
      action: 'login',
      at: now,
      ipAddress: session.ipAddress,
      deviceInfo: session.deviceInfo,
    });

    return { session, refreshToken };
  }

  async rotateRefreshToken(refreshToken: string, meta?: { ipAddress?: string; deviceInfo?: string; userAgent?: string }) {
    const hash = this.hash(refreshToken);
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        id: string;
        user_id: string;
        role: string;
        ip_address: string | null;
        device_info: string | null;
        user_agent: string | null;
        expires_at: Date;
        revoked_at: Date | null;
      }>
    >(
      `SELECT id, user_id, role, ip_address, device_info, user_agent, expires_at, revoked_at
       FROM security_sessions
       WHERE refresh_token_hash = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      hash,
    );

    const session = rows[0];
    if (!session) return null;
    if (session.revoked_at || new Date(session.expires_at).getTime() < Date.now()) return null;

    const nextRefreshToken = crypto.randomBytes(48).toString('hex');
    const nextHash = this.hash(nextRefreshToken);
    const now = new Date();
    const ipAddress = meta?.ipAddress || session.ip_address || 'unknown';
    const deviceInfo = meta?.deviceInfo || session.device_info || 'unknown';
    const userAgent = meta?.userAgent || session.user_agent || 'unknown';

    await this.prisma.$executeRawUnsafe(
      `UPDATE security_sessions
       SET refresh_token_hash = $1, last_seen_at = $2, ip_address = $3, device_info = $4, user_agent = $5
       WHERE id = $6`,
      nextHash,
      now,
      ipAddress,
      deviceInfo,
      userAgent,
      session.id,
    );

    await this.logActivity(session.user_id, {
      action: 'refresh',
      at: now,
      ipAddress,
      deviceInfo,
    });

    const role = (session.role === 'admin' || session.role === 'moderator' || session.role === 'user'
      ? session.role
      : 'user') as AppRole;

    return {
      session: {
        id: session.id,
        userId: session.user_id,
        role,
      },
      refreshToken: nextRefreshToken,
    };
  }

  async revokeByRefreshToken(userId: string, refreshToken: string) {
    const hash = this.hash(refreshToken);
    const result = await this.prisma.$executeRawUnsafe(
      `UPDATE security_sessions
       SET revoked_at = NOW()
       WHERE user_id = $1 AND refresh_token_hash = $2 AND revoked_at IS NULL`,
      userId,
      hash,
    );
    if (result > 0) {
      await this.logActivity(userId, { action: 'logout', at: new Date() });
    }
    return Number(result);
  }

  async revokeBySessionId(userId: string, sessionId: string) {
    const result = await this.prisma.$executeRawUnsafe(
      `UPDATE security_sessions
       SET revoked_at = NOW()
       WHERE user_id = $1 AND id = $2 AND revoked_at IS NULL`,
      userId,
      sessionId,
    );
    if (result > 0) {
      await this.logActivity(userId, { action: 'session_terminated', at: new Date() });
    }
    return Number(result);
  }

  async revokeAll(userId: string) {
    const result = await this.prisma.$executeRawUnsafe(
      `UPDATE security_sessions
       SET revoked_at = NOW()
       WHERE user_id = $1 AND revoked_at IS NULL`,
      userId,
    );
    if (result > 0) {
      await this.logActivity(userId, { action: 'logout_all', at: new Date() });
    }
    return Number(result);
  }

  async listSessions(userId: string) {
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        id: string;
        role: string;
        device_info: string | null;
        ip_address: string | null;
        user_agent: string | null;
        created_at: Date;
        last_seen_at: Date;
        expires_at: Date;
        revoked_at: Date | null;
      }>
    >(
      `SELECT id, role, device_info, ip_address, user_agent, created_at, last_seen_at, expires_at, revoked_at
       FROM security_sessions
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 500`,
      userId,
    );

    return rows.map((row) => ({
      id: row.id,
      role: row.role,
      deviceInfo: row.device_info || 'unknown',
      ipAddress: row.ip_address || 'unknown',
      userAgent: row.user_agent || 'unknown',
      createdAt: new Date(row.created_at),
      lastSeenAt: new Date(row.last_seen_at),
      expiresAt: new Date(row.expires_at),
      revokedAt: row.revoked_at ? new Date(row.revoked_at) : null,
      active: !row.revoked_at && new Date(row.expires_at).getTime() > Date.now(),
    }));
  }

  async getSecurityActivity(userId: string) {
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        user_id: string;
        action: string;
        created_at: Date;
        ip_address: string | null;
        device: string | null;
      }>
    >(
      `SELECT user_id, action, created_at, ip_address, device
       FROM security_logs
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 200`,
      userId,
    );

    return rows.map((row) => ({
      userId: row.user_id,
      action: row.action,
      at: new Date(row.created_at),
      ipAddress: row.ip_address || undefined,
      deviceInfo: row.device || undefined,
    }));
  }

  async getAllSecurityActivity() {
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        user_id: string;
        action: string;
        created_at: Date;
        ip_address: string | null;
        device: string | null;
      }>
    >(
      `SELECT user_id, action, created_at, ip_address, device
       FROM security_logs
       ORDER BY created_at DESC
       LIMIT 1000`,
    );

    return rows.map((row) => ({
      userId: row.user_id,
      action: row.action,
      at: new Date(row.created_at),
      ipAddress: row.ip_address || undefined,
      deviceInfo: row.device || undefined,
    }));
  }

  async getRoleDistribution() {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ role: string; count: string }>>(
      `SELECT role, COUNT(*)::text AS count
       FROM security_user_state
       GROUP BY role`,
    );

    const stats: Record<AppRole, number> = { user: 0, moderator: 0, admin: 0 };
    for (const row of rows) {
      if (row.role === 'user' || row.role === 'moderator' || row.role === 'admin') {
        stats[row.role] = Number(row.count);
      }
    }
    return stats;
  }

  async logActivity(userId: string, event: SecurityActivity) {
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO security_logs (id, user_id, ip_address, device, action, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      crypto.randomUUID(),
      userId,
      event.ipAddress || null,
      event.deviceInfo || null,
      event.action,
      event.at,
    );
  }

  private async storeCode(userId: string, kind: 'verify' | 'reset', code: string) {
    await this.prisma.$executeRawUnsafe(
      `UPDATE security_codes
       SET consumed_at = NOW()
       WHERE user_id = $1 AND kind = $2 AND consumed_at IS NULL`,
      userId,
      kind,
    );

    await this.prisma.$executeRawUnsafe(
      `INSERT INTO security_codes (id, user_id, kind, code_hash, expires_at, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      crypto.randomUUID(),
      userId,
      kind,
      this.hash(code),
      new Date(Date.now() + 10 * 60 * 1000),
    );
  }

  private async consumeCode(userId: string, kind: 'verify' | 'reset', code: string) {
    const codeHash = this.hash(code);
    const rows = await this.prisma.$queryRawUnsafe<Array<{ id: string; expires_at: Date; consumed_at: Date | null }>>(
      `SELECT id, expires_at, consumed_at
       FROM security_codes
       WHERE user_id = $1 AND kind = $2 AND code_hash = $3
       ORDER BY created_at DESC
       LIMIT 1`,
      userId,
      kind,
      codeHash,
    );

    const row = rows[0];
    if (!row) return false;
    if (row.consumed_at) return false;
    if (new Date(row.expires_at).getTime() < Date.now()) return false;

    await this.prisma.$executeRawUnsafe(
      `UPDATE security_codes SET consumed_at = NOW() WHERE id = $1`,
      row.id,
    );
    return true;
  }

  private hash(token: string) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private generateCode() {
    return `${Math.floor(100000 + Math.random() * 900000)}`;
  }
}
