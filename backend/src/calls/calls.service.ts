import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CallsService {
  constructor(private prisma: PrismaService) {}

  async create(callerId: string, calleeId: string) {
    if (!calleeId?.trim()) {
      throw new BadRequestException('calleeId required');
    }
    const callee = await this.prisma.user.findUnique({
      where: { id: calleeId },
    });
    if (!callee) {
      throw new NotFoundException('Callee not found');
    }
    if (callerId === calleeId) {
      throw new BadRequestException('Cannot call yourself');
    }
    return this.prisma.call.create({
      data: {
        callerId,
        calleeId,
        status: 'created',
      },
    });
  }

  async findById(id: string, userId: string) {
    const call = await this.prisma.call.findUnique({
      where: { id },
    });
    if (!call) throw new NotFoundException('Call not found');
    if (call.callerId !== userId && call.calleeId !== userId) {
      throw new ForbiddenException('Not a participant of this call');
    }
    return call;
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
      data: { status: 'ended' },
    });
  }
}
