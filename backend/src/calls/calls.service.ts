import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

export type CallQualitySampleInput = {
  rttMs?: number;
  jitterMs?: number;
  packetLossPct?: number;
  mosLike?: number;
  bitrateKbps?: number;
};

@Injectable()
export class CallsService {
  constructor(private prisma: PrismaService) {}

  async create(hostId: string) {
    const room = await this.prisma.room.create({
      data: {
        hostId,
        status: 'active',
        startedAt: new Date(),
      },
    });

    // Host is the first participant
    await this.prisma.roomParticipant.create({
      data: {
        roomId: room.id,
        userId: hostId,
      },
    });

    return room;
  }

  async findById(id: string, userId: string, strict = true) {
    const room = await this.prisma.room.findUnique({
      where: { id },
      include: {
        host: { select: { id: true, username: true } },
        participants: {
          include: {
            user: { select: { id: true, username: true } },
          },
        },
      },
    });

    if (!room) throw new NotFoundException('Room not found');

    if (strict) {
      // Allow host OR any registered participant to access the room.
      // We intentionally do NOT reject callee who hasn't joined yet — that scenario
      // is handled by the WebSocket gateway which resolves the counterparty from
      // the participants list and host; the callee will join once they accept.
      const isHost = room.hostId === userId;
      const isParticipant = room.participants.some(p => p.userId === userId);
      if (!isHost && !isParticipant) {
        throw new ForbiddenException('Not a participant of this room');
      }
    }

    return room;
  }

  async join(roomId: string, userId: string) {
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      include: { participants: true },
    });

    if (!room) throw new NotFoundException('Room not found');
    if (room.status !== 'active') {
      throw new BadRequestException('Room is already ended');
    }

    const alreadyParticipant = room.participants.some(p => p.userId === userId);
    if (alreadyParticipant) {
      return room;
    }

    await this.prisma.roomParticipant.create({
      data: {
        roomId,
        userId,
      },
    });

    return this.findById(roomId, userId);
  }

  async leave(roomId: string, userId: string) {
    await this.prisma.roomParticipant.updateMany({
      where: {
        roomId,
        userId,
        leftAt: null,
      },
      data: {
        leftAt: new Date(),
      },
    });

    // If it was the host or last participant, maybe end the room?
    // For now, keep it simple.
  }

  async end(id: string, userId: string) {
    const room = await this.prisma.room.findUnique({
      where: { id },
      include: {
        participants: { select: { userId: true } },
      },
    });

    if (!room) throw new NotFoundException('Room not found');

    // Allow any participant OR the host to end the call
    const isParticipant = room.participants.some(p => p.userId === userId);
    if (!isParticipant && room.hostId !== userId) {
      throw new ForbiddenException('Not a participant of this room');
    }

    // If already ended, just return without error
    if (room.status === 'ended') {
      return { ...room, participantIds: room.participants.map(p => p.userId) };
    }

    const updated = await this.prisma.room.update({
      where: { id },
      data: {
        status: 'ended',
        endedAt: new Date(),
      },
    });

    return { ...updated, participantIds: room.participants.map(p => p.userId) };
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
    return this.prisma.room.findMany({
      where: {
        participants: {
          some: { userId },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        host: { select: { id: true, username: true } },
        participants: {
          include: {
            user: { select: { id: true, username: true } },
          },
        },
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

  async ingestQualitySample(roomId: string, userId: string, sample: CallQualitySampleInput) {
    const clamp = (value: unknown, min: number, max: number) => {
      if (typeof value !== 'number' || Number.isNaN(value)) return null;
      return Math.max(min, Math.min(max, value));
    };

    await this.prisma.callQualityMetrics.create({
      data: {
        roomId,
        userId,
        rttMs: clamp(sample.rttMs, 0, 60000),
        jitterMs: clamp(sample.jitterMs, 0, 60000),
        packetLossPct: clamp(sample.packetLossPct, 0, 100),
        mosLike: clamp(sample.mosLike, 1, 5),
        bitrateKbps: clamp(sample.bitrateKbps, 0, 100000),
      },
    });

    return { success: true };
  }
  
  // Compatibility methods for old P2P logic if needed
  async getPendingCallForUser(userId: string) { return null; }
  async getActiveCallForUser(userId: string) {
    return this.prisma.room.findFirst({
      where: {
        status: 'active',
        participants: { some: { userId } }
      },
      include: {
        host: { select: { id: true, username: true } },
        participants: { include: { user: { select: { id: true, username: true } } } }
      }
    });
  }
  async markActive(id: string, userId: string) { return { id, status: 'active' }; }
  async reject(id: string, userId: string) {
    const room = await this.prisma.room.findUnique({
      where: { id },
    });
    if (!room) throw new NotFoundException('Room not found');

    if (room.status === 'ended' || room.status === 'rejected') {
      return room;
    }

    const updated = await this.prisma.room.update({
      where: { id },
      data: {
        status: 'rejected',
        endedAt: new Date(),
      },
    });
    return updated;
  }
}
