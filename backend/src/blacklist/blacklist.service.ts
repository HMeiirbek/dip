import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BlacklistService implements OnModuleInit {
  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    await this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS risk_blacklist (
        id TEXT PRIMARY KEY,
        phone_number TEXT NOT NULL UNIQUE,
        reason TEXT NULL,
        source TEXT NOT NULL DEFAULT 'user',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
  }

  async list() {
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        id: string;
        phone_number: string;
        reason: string | null;
        source: string;
        created_at: Date;
      }>
    >(
      `SELECT id, phone_number, reason, source, created_at
       FROM risk_blacklist
       ORDER BY created_at DESC
       LIMIT 1000`,
    );

    return rows.map((row) => ({
      id: row.id,
      phoneNumber: row.phone_number,
      reason: row.reason ?? undefined,
      source: row.source,
      createdAt: new Date(row.created_at),
    }));
  }

  async create(phoneNumber: string, reason?: string, source = 'user') {
    const normalized = phoneNumber?.trim();
    if (!normalized) {
      throw new BadRequestException('phoneNumber required');
    }

    const id = crypto.randomUUID();
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO risk_blacklist (id, phone_number, reason, source, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (phone_number)
       DO UPDATE SET reason = EXCLUDED.reason, source = EXCLUDED.source`,
      id,
      normalized,
      reason ?? null,
      source,
    );

    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        id: string;
        phone_number: string;
        reason: string | null;
        source: string;
        created_at: Date;
      }>
    >(
      `SELECT id, phone_number, reason, source, created_at
       FROM risk_blacklist
       WHERE phone_number = $1
       LIMIT 1`,
      normalized,
    );

    const row = rows[0];
    return {
      id: row.id,
      phoneNumber: row.phone_number,
      reason: row.reason ?? undefined,
      source: row.source,
      createdAt: new Date(row.created_at),
    };
  }

  async remove(id: string) {
    await this.prisma.$executeRawUnsafe(`DELETE FROM risk_blacklist WHERE id = $1`, id);
    return { success: true };
  }
}
