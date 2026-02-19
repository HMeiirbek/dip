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
    const calls = await this.prisma.call.findMany({
      where: {
        OR: [{ callerId: userId }, { calleeId: userId }],
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        caller: { select: { id: true, username: true } },
        callee: { select: { id: true, username: true } },
      },
    });

    const reports = await this.callsService.listReports();
    const reportedByUser = reports.filter((r) => r.userId === userId).length;
    const riskyCalls = calls.filter((c) => ['pending', 'rejected'].includes(c.status)).length;
    const riskScore = Math.min(100, riskyCalls * 8 + reportedByUser * 5);

    return {
      userId,
      totalCalls: calls.length,
      riskyCalls,
      reportedByUser,
      riskScore,
      confidence: Math.min(0.99, 0.5 + riskScore / 200),
      recent: calls.slice(0, 30),
    };
  }

  async monitor() {
    const [liveCalls, reports, blacklist] = await Promise.all([
      this.prisma.call.findMany({
        where: { status: { in: ['pending', 'accepted', 'active'] } },
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: {
          caller: { select: { id: true, username: true } },
          callee: { select: { id: true, username: true } },
        },
      }),
      this.callsService.listReports(),
      this.blacklistService.list(),
    ]);

    return {
      streamAt: new Date(),
      liveCalls,
      highPriorityReports: reports.slice(0, 20),
      blacklistPreview: blacklist.slice(0, 20),
    };
  }

  async stats() {
    const [total, pending, accepted, active, rejected, ended] = await Promise.all([
      this.prisma.call.count(),
      this.prisma.call.count({ where: { status: 'pending' } }),
      this.prisma.call.count({ where: { status: 'accepted' } }),
      this.prisma.call.count({ where: { status: 'active' } }),
      this.prisma.call.count({ where: { status: 'rejected' } }),
      this.prisma.call.count({ where: { status: 'ended' } }),
    ]);

    const reports = await this.callsService.listReports();
    const blacklist = await this.blacklistService.list();

    return {
      calls: { total, pending, accepted, active, rejected, ended },
      reports: reports.length,
      blacklist: blacklist.length,
      suspiciousLoad: pending + active + reports.length,
    };
  }
}
