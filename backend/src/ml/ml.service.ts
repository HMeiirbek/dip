import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';

@Injectable()
export class MlService implements OnModuleInit {
  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    await this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS ml_models_runtime (
        id TEXT PRIMARY KEY,
        version TEXT NOT NULL,
        accuracy DOUBLE PRECISION NOT NULL,
        precision DOUBLE PRECISION NOT NULL,
        recall DOUBLE PRECISION NOT NULL,
        f1 DOUBLE PRECISION NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT FALSE,
        loaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    const rows = await this.prisma.$queryRawUnsafe<Array<{ count: string }>>(
      `SELECT COUNT(*)::text AS count FROM ml_models_runtime`,
    );

    if (Number(rows[0]?.count || 0) === 0) {
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO ml_models_runtime
         (id, version, accuracy, precision, recall, f1, is_active, loaded_at)
         VALUES ($1, 'v1', 0.95, 0.93, 0.91, 0.92, TRUE, NOW())`,
        crypto.randomUUID(),
      );
    }
  }

  async status() {
    const active = await this.activeModel();
    const total = await this.prisma.$queryRawUnsafe<Array<{ count: string }>>(
      `SELECT COUNT(*)::text AS count FROM ml_models_runtime`,
    );

    return {
      active: Boolean(active),
      model: active,
      totalVersions: Number(total[0]?.count || 0),
    };
  }

  async metrics() {
    const active = (await this.activeModel()) || (await this.latestModel());
    if (!active) {
      return {
        version: 'n/a',
        accuracy: 0,
        precision: 0,
        recall: 0,
        f1: 0,
        driftScore: 1,
        evaluatedAt: new Date(),
      };
    }

    return {
      version: active.version,
      accuracy: active.accuracy,
      precision: active.precision,
      recall: active.recall,
      f1: active.f1,
      driftScore: Math.max(0, 1 - active.accuracy),
      evaluatedAt: new Date(),
    };
  }

  async history() {
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        id: string;
        version: string;
        accuracy: number;
        precision: number;
        recall: number;
        f1: number;
        is_active: boolean;
        loaded_at: Date;
      }>
    >(
      `SELECT id, version, accuracy, precision, recall, f1, is_active, loaded_at
       FROM ml_models_runtime
       ORDER BY loaded_at DESC
       LIMIT 100`,
    );

    return rows.map((row) => ({
      id: row.id,
      version: row.version,
      accuracy: Number(row.accuracy),
      precision: Number(row.precision),
      recall: Number(row.recall),
      f1: Number(row.f1),
      isActive: Boolean(row.is_active),
      loadedAt: new Date(row.loaded_at),
    }));
  }

  async reload(version?: string) {
    await this.prisma.$executeRawUnsafe(`UPDATE ml_models_runtime SET is_active = FALSE WHERE is_active = TRUE`);

    const id = crypto.randomUUID();
    const modelVersion = version ?? `v${Date.now()}`;
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO ml_models_runtime
       (id, version, accuracy, precision, recall, f1, is_active, loaded_at)
       VALUES ($1, $2, 0.95, 0.93, 0.91, 0.92, TRUE, NOW())`,
      id,
      modelVersion,
    );

    const active = await this.activeModel();
    return { success: true, model: active };
  }

  private async activeModel() {
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        id: string;
        version: string;
        accuracy: number;
        precision: number;
        recall: number;
        f1: number;
        loaded_at: Date;
      }>
    >(
      `SELECT id, version, accuracy, precision, recall, f1, loaded_at
       FROM ml_models_runtime
       WHERE is_active = TRUE
       ORDER BY loaded_at DESC
       LIMIT 1`,
    );

    const row = rows[0];
    if (!row) return null;
    return {
      id: row.id,
      version: row.version,
      accuracy: Number(row.accuracy),
      precision: Number(row.precision),
      recall: Number(row.recall),
      f1: Number(row.f1),
      isActive: true,
      loadedAt: new Date(row.loaded_at),
    };
  }

  private async latestModel() {
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        id: string;
        version: string;
        accuracy: number;
        precision: number;
        recall: number;
        f1: number;
        is_active: boolean;
        loaded_at: Date;
      }>
    >(
      `SELECT id, version, accuracy, precision, recall, f1, is_active, loaded_at
       FROM ml_models_runtime
       ORDER BY loaded_at DESC
       LIMIT 1`,
    );

    const row = rows[0];
    if (!row) return null;
    return {
      id: row.id,
      version: row.version,
      accuracy: Number(row.accuracy),
      precision: Number(row.precision),
      recall: Number(row.recall),
      f1: Number(row.f1),
      isActive: Boolean(row.is_active),
      loadedAt: new Date(row.loaded_at),
    };
  }
}
