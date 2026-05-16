import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CallsService } from '../calls/calls.service';
import { BlacklistService } from '../blacklist/blacklist.service';

@Injectable()
export class RiskService {
  constructor(
    private prisma: PrismaService,
    private callsService: CallsService,
    private blacklistService: BlacklistService,
  ) {}

  async analysis(userId: string) {
    const rooms = await this.prisma.room.findMany({
      where: {
        participants: {
          some: { userId },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        host: { select: { id: true, username: true } },
        participants: {
          include: {
            user: { select: { id: true, username: true } },
          },
        },
      },
    });

    const reports = await this.callsService.listReports();
    const reportedByUser = reports.filter((r) => r.userId === userId).length;
    const riskyCalls = rooms.filter((c) => c.status === 'ended').length; // Heuristic
    const riskScore = Math.min(100, riskyCalls * 8 + reportedByUser * 5);

    return {
      userId,
      totalCalls: rooms.length,
      riskyCalls,
      reportedByUser,
      riskScore,
      confidence: Math.min(0.99, 0.5 + riskScore / 200),
      recent: rooms.slice(0, 30),
    };
  }

  async monitor() {
    const [liveRooms, reports, blacklist] = await Promise.all([
      this.prisma.room.findMany({
        where: { status: 'active' },
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: {
          host: { select: { id: true, username: true } },
          participants: {
            include: {
              user: { select: { id: true, username: true } },
            },
          },
        },
      }),
      this.callsService.listReports(),
      this.blacklistService.list(),
    ]);

    return {
      streamAt: new Date(),
      liveCalls: liveRooms,
      highPriorityReports: reports.slice(0, 20),
      blacklistPreview: blacklist.slice(0, 20),
    };
  }

  async stats() {
    const [total, active, ended] = await Promise.all([
      this.prisma.room.count(),
      this.prisma.room.count({ where: { status: 'active' } }),
      this.prisma.room.count({ where: { status: 'ended' } }),
    ]);

    const reports = await this.callsService.listReports();
    const blacklist = await this.blacklistService.list();

    return {
      calls: { total, active, ended, pending: 0, accepted: 0, rejected: 0 },
      reports: reports.length,
      blacklist: blacklist.length,
      suspiciousLoad: active + reports.length,
    };
  }
}
