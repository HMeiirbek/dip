import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

export type CallStatus = 'pending' | 'accepted' | 'rejected' | 'active' | 'ended';

@Injectable()
export class CallsService {
  private readonly CALL_RING_TIMEOUT = 30000; // 30 seconds
  constructor(private prisma: PrismaService) { }

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
      },
      include: {
        caller: { select: { id: true, username: true } },
      },
    });
  }

  async getActiveCallForUser(userId: string) {
    return this.prisma.call.findFirst({
      where: {
        OR: [
          { callerId: userId },
          { calleeId: userId },
        ],
        status: { in: ['accepted', 'active'] },
      },
      include: {
        caller: { select: { id: true, username: true } },
        callee: { select: { id: true, username: true } },
      },
    });
  }

  private setCallTimeout(callId: string, callerId: string) {
    // No-op: in-memory timeouts removed in favor of DB-driven cleanup
  }

  private clearCallTimeout(callId: string) {
    // No-op: kept for compatibility but does nothing now
  }
}
