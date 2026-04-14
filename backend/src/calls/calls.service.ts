import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

export type CallStatus = 'pending' | 'accepted' | 'rejected' | 'active' | 'ended';
export type CallQualitySampleInput = {
  rttMs?: number;
  jitterMs?: number;
  packetLossPct?: number;
  mosLike?: number;
  bitrateKbps?: number;
};
@Injectable()
export class CallsService {
  private readonly CALL_RING_TIMEOUT = 30000; // 30 seconds
  constructor(private prisma: PrismaService) {}

  private isExpired(call: { expiresAt?: Date | null }, now = new Date()) {
    return Boolean(call.expiresAt && new Date(call.expiresAt).getTime() <= now.getTime());
  }

  async create(callerId: string, calleeId: string) {
    if (!calleeId?.trim()) {
      throw new BadRequestException('calleeId required');
    }

    // Verify callee exists
    const callee = await this.prisma.user.findUnique({
      where: { id: calleeId },
    });
    if (!callee) {
      throw new NotFoundException('Callee not found');
    }

    if (callerId === calleeId) {
      throw new BadRequestException('Cannot call yourself');
    }

    const userBlock = await this.prisma.userBlacklist.findFirst({
      where: {
        OR: [
          { userId: callerId, blockedUserId: calleeId },
          { userId: calleeId, blockedUserId: callerId },
        ],
      },
      select: { id: true },
    });
    if (userBlock) {
      throw new ForbiddenException('Calls are not allowed between blocked users');
    }

    const now = new Date();

    // Cleanup stale calls for this pair before checking active state
    await this.prisma.call.updateMany({
      where: {
        OR: [
          { callerId, calleeId },
          { callerId: calleeId, calleeId: callerId },
        ],
        status: 'pending',
        expiresAt: { lte: now },
      },
      data: {
        status: 'rejected',
        endedAt: now,
      },
    });

    await this.prisma.call.updateMany({
      where: {
        OR: [
          { callerId, calleeId },
          { callerId: calleeId, calleeId: callerId },
        ],
        status: 'accepted',
        expiresAt: { lte: now },
      },
      data: {
        status: 'ended',
        endedAt: now,
      },
    });

    // Check for currently active calls between these users
    const activeCall = await this.prisma.call.findFirst({
      where: {
        OR: [
          {
            callerId,
            calleeId,
            OR: [
              { status: 'active' },
              { status: 'pending', expiresAt: { gt: now } },
              { status: 'accepted', expiresAt: { gt: now } },
            ],
          },
          {
            callerId: calleeId,
            calleeId: callerId,
            OR: [
              { status: 'active' },
              { status: 'pending', expiresAt: { gt: now } },
              { status: 'accepted', expiresAt: { gt: now } },
            ],
          },
        ],
      },
    });

    if (activeCall) {
      throw new BadRequestException('There is already an active call between these users');
    }

    const expiresAt = new Date(Date.now() + this.CALL_RING_TIMEOUT);
    try {
      const call = await this.prisma.call.create({
        data: {
          callerId,
          calleeId,
          status: 'pending',
          expiresAt,
        },
      });
      return call;
    } catch (err) {
      // handle unique constraint from DB partial index
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new BadRequestException('There is already an active call between these users');
      }
      throw err;
    }
  }

  async findById(id: string, userId: string) {
    const call = await this.prisma.call.findUnique({
      where: { id },
      include: {
        caller: { select: { id: true, username: true } },
        callee: { select: { id: true, username: true } },
      },
    });

    if (!call) throw new NotFoundException('Call not found');
    if (call.callerId !== userId && call.calleeId !== userId) {
      throw new ForbiddenException('Not a participant of this call');
    }

    return call;
  }

  async accept(id: string, userId: string) {
    const call = await this.prisma.call.findUnique({
      where: { id },
    });

    if (!call) throw new NotFoundException('Call not found');
    if (call.calleeId !== userId) {
      throw new ForbiddenException('Only the callee can accept this call');
    }
    if (this.isExpired(call)) {
      await this.prisma.call.update({
        where: { id },
        data: {
          status: 'rejected',
          endedAt: new Date(),
        },
      });
      throw new BadRequestException('Call has expired');
    }
    if (call.status === 'accepted') {
      return call;
    }
    if (call.status !== 'pending') {
      throw new BadRequestException(`Cannot accept a call with status: ${call.status}`);
    }

    return this.prisma.call.update({
      where: { id },
      data: {
        status: 'accepted',
        startedAt: new Date(),
      },
    });
  }

  async reject(id: string, userId: string) {
    const call = await this.prisma.call.findUnique({
      where: { id },
    });

    if (!call) throw new NotFoundException('Call not found');
    if (call.calleeId !== userId) {
      throw new ForbiddenException('Only the callee can reject this call');
    }
    if (call.status !== 'pending' && call.status !== 'accepted') {
      throw new BadRequestException(`Cannot reject a call with status: ${call.status}`);
    }

    return this.prisma.call.update({
      where: { id },
      data: {
        status: 'rejected',
        endedAt: new Date(),
      },
    });
  }

  async markActive(id: string, userId: string) {
    const call = await this.prisma.call.findUnique({
      where: { id },
    });

    if (!call) throw new NotFoundException('Call not found');
    if (call.callerId !== userId && call.calleeId !== userId) {
      throw new ForbiddenException('Not a participant of this call');
    }
    if (call.status === 'active') {
      return call;
    }
    if (this.isExpired(call)) {
      await this.prisma.call.update({
        where: { id },
        data: {
          status: 'ended',
          endedAt: new Date(),
        },
      });
      throw new BadRequestException('Cannot mark as active: call has expired');
    }
    if (call.status !== 'accepted') {
      throw new BadRequestException(`Cannot mark as active: call status is ${call.status}`);
    }

    return this.prisma.call.update({
      where: { id },
      data: { status: 'active' },
    });
  }

  async end(id: string, userId: string) {
    const call = await this.prisma.call.findUnique({
      where: { id },
    });

    if (!call) throw new NotFoundException('Call not found');
    if (call.callerId !== userId && call.calleeId !== userId) {
      throw new ForbiddenException('Not a participant of this call');
    }

    return this.prisma.call.update({
      where: { id },
      data: {
        status: 'ended',
        endedAt: new Date(),
      },
    });
  }

  async getPendingCallForUser(userId: string) {
    return this.prisma.call.findFirst({
      where: {
        calleeId: userId,
        status: 'pending',
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
      include: {
        caller: { select: { id: true, username: true } },
      },
    });
  }

  async getActiveCallForUser(userId: string) {
    return this.prisma.call.findFirst({
      where: {
        AND: [
          {
            OR: [
              { callerId: userId },
              { calleeId: userId },
            ],
          },
          {
            OR: [
              { status: 'active' },
              {
                status: 'accepted',
                OR: [
                  { expiresAt: null },
                  { expiresAt: { gt: new Date() } },
                ],
              },
            ],
          },
        ],
      },
      include: {
        caller: { select: { id: true, username: true } },
        callee: { select: { id: true, username: true } },
      },
    });
  }

  async checkNumber(phoneNumber: string) {
    const normalized = phoneNumber?.trim();
    if (!normalized) {
      throw new BadRequestException('phoneNumber required');
    }

    const [reportRows, blacklistRows] = await Promise.all([
      this.prisma.$queryRawUnsafe<Array<{ count: string }>>(
        `SELECT COUNT(*)::text AS count FROM risk_reports WHERE phone_number = $1`,
        normalized,
      ),
      this.prisma.$queryRawUnsafe<Array<{ count: string }>>(
        `SELECT COUNT(*)::text AS count FROM risk_blacklist WHERE phone_number = $1`,
        normalized,
      ),
    ]);

    const reportsCount = Number(reportRows?.[0]?.count || 0);
    const inBlacklist = Number(blacklistRows?.[0]?.count || 0) > 0;
    const riskScore = Math.min(100, (inBlacklist ? 70 : 0) + reportsCount * 10);
    const status = inBlacklist ? 'blacklisted' : reportsCount > 0 ? 'reported' : 'clear';

    return {
      phoneNumber: normalized,
      status,
      riskScore,
      reportsCount,
      source: 'postgres',
    };
  }

  async history(userId: string) {
    return this.prisma.call.findMany({
      where: {
        OR: [{ callerId: userId }, { calleeId: userId }],
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        caller: { select: { id: true, username: true } },
        callee: { select: { id: true, username: true } },
      },
    });
  }

  async report(userId: string, phoneNumber: string, description?: string) {
    const normalized = phoneNumber?.trim();
    if (!normalized) {
      throw new BadRequestException('phoneNumber required');
    }

    const item = {
      id: crypto.randomUUID(),
      userId,
      phoneNumber: normalized,
      description,
      createdAt: new Date(),
    };

    await this.prisma.$executeRawUnsafe(
      `INSERT INTO risk_reports (id, user_id, phone_number, description, status, created_at)
       VALUES ($1, $2, $3, $4, 'pending', $5)`,
      item.id,
      item.userId,
      item.phoneNumber,
      item.description ?? null,
      item.createdAt,
    );

    return item;
  }

  async listReports() {
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        id: string;
        user_id: string;
        phone_number: string;
        description: string | null;
        status: string;
        created_at: Date;
      }>
    >(
      `SELECT id, user_id, phone_number, description, status, created_at
       FROM risk_reports
       ORDER BY created_at DESC
       LIMIT 500`,
    );

    return rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      phoneNumber: row.phone_number,
      description: row.description ?? undefined,
      status: row.status,
      createdAt: new Date(row.created_at),
    }));
  }

  async live(userId: string) {
    return this.prisma.call.findFirst({
      where: {
        AND: [
          {
            OR: [{ callerId: userId }, { calleeId: userId }],
          },
          {
            OR: [
              { status: 'active' },
              {
                status: 'pending',
                OR: [
                  { expiresAt: null },
                  { expiresAt: { gt: new Date() } },
                ],
              },
              {
                status: 'accepted',
                OR: [
                  { expiresAt: null },
                  { expiresAt: { gt: new Date() } },
                ],
              },
            ],
          },
        ],
      },
      orderBy: { createdAt: 'desc' },
      include: {
        caller: { select: { id: true, username: true } },
        callee: { select: { id: true, username: true } },
      },
    });
  }

  async ingestQualitySample(callId: string, userId: string, sample: CallQualitySampleInput) {
    const call = await this.findById(callId, userId);
    if (!['pending', 'accepted', 'active'].includes(call.status)) {
      throw new BadRequestException('Cannot ingest quality metrics for closed calls');
    }

    const clamp = (value: unknown, min: number, max: number) => {
      if (typeof value !== 'number' || Number.isNaN(value)) return null;
      return Math.max(min, Math.min(max, value));
    };

    await this.prisma.$executeRawUnsafe(
      `INSERT INTO call_quality_metrics
        (id, call_id, user_id, rtt_ms, jitter_ms, packet_loss_pct, mos_like, bitrate_kbps, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
      crypto.randomUUID(),
      callId,
      userId,
      clamp(sample.rttMs, 0, 60000),
      clamp(sample.jitterMs, 0, 60000),
      clamp(sample.packetLossPct, 0, 100),
      clamp(sample.mosLike, 1, 5),
      clamp(sample.bitrateKbps, 0, 100000),
    );

    return { success: true };
  }

  private setCallTimeout(callId: string, callerId: string) {
    // No-op: in-memory timeouts removed in favor of DB-driven cleanup
  }

  private clearCallTimeout(callId: string) {
    // No-op: kept for compatibility but does nothing now
  }
}
