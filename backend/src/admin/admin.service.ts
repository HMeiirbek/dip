import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AppRole, SecurityService } from '../auth/security.service';
import { AuthService } from '../auth/auth.service';
import { CallsService } from '../calls/calls.service';
import { BlacklistService } from '../blacklist/blacklist.service';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private auth: AuthService,
    private callsService: CallsService,
    private blacklistService: BlacklistService,
    private securityService: SecurityService,
  ) {}

  async dashboard() {
    const [users, totalCalls, ongoingCalls, endedCalls] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.call.count(),
      this.prisma.call.count({ where: { status: { in: ['pending', 'accepted', 'active'] } } }),
      this.prisma.call.count({ where: { status: 'ended' } }),
    ]);

    const [reports, blacklist, systemLogs] = await Promise.all([
      this.callsService.listReports(),
      this.blacklistService.list(),
      this.systemLogs(),
    ]);

    return {
      users,
      totalCalls,
      ongoingCalls,
      endedCalls,
      reports: reports.length,
      blacklistEntries: blacklist.length,
      activeThreats: ongoingCalls + reports.slice(0, 24).length,
      recentSystemEvents: systemLogs.slice(0, 10),
    };
  }

  async users() {
    return this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        username: true,
        createdAt: true,
      },
      take: 300,
    });
  }

  async updateUserRole(id: string, role: string) {
    const normalized = role as AppRole;
    if (!['user', 'admin', 'moderator'].includes(normalized)) {
      return { success: false, message: 'Role must be user/admin/moderator' };
    }
    return this.auth.setRole(id, normalized);
  }

  async deleteUser(id: string) {
    await this.prisma.user.delete({ where: { id } });
    return { success: true };
  }

  async calls() {
    return this.prisma.call.findMany({
      orderBy: { createdAt: 'desc' },
      take: 300,
      include: {
        caller: { select: { id: true, username: true } },
        callee: { select: { id: true, username: true } },
      },
    });
  }

  async reports() {
    const reports = await this.callsService.listReports();
    const grouped = new Map<string, number>();
    for (const report of reports) {
      grouped.set(report.phoneNumber, (grouped.get(report.phoneNumber) || 0) + 1);
    }

    const topNumbers = Array.from(grouped.entries())
      .map(([phoneNumber, count]) => ({ phoneNumber, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    return {
      total: reports.length,
      topNumbers,
      items: reports.slice(0, 200),
    };
  }

  async analytics() {
    const [calls, users] = await Promise.all([
      this.prisma.call.findMany({
        orderBy: { createdAt: 'desc' },
        take: 2000,
        select: { status: true, createdAt: true },
      }),
      this.prisma.user.count(),
    ]);

    const reports = await this.callsService.listReports();
    const blacklist = await this.blacklistService.list();
    const roleDistribution = await this.securityService.getRoleDistribution();

    const byStatus: Record<string, number> = {
      pending: 0,
      accepted: 0,
      active: 0,
      rejected: 0,
      ended: 0,
    };

    for (const call of calls) {
      byStatus[call.status] = (byStatus[call.status] || 0) + 1;
    }

    const daily = this.buildDailySeries(calls.map((c) => c.createdAt), 7);

    return {
      users,
      callsAnalyzed: calls.length,
      byStatus,
      dailyCallVolume: daily,
      reportsCount: reports.length,
      blacklistCount: blacklist.length,
      roleDistribution,
    };
  }

  async systemLogs() {
    const securityEvents = (await this.securityService.getAllSecurityActivity()).map((event) => ({
      level: event.action.includes('failed') ? 'warning' : 'info',
      type: 'security',
      userId: event.userId,
      action: event.action,
      ipAddress: event.ipAddress,
      deviceInfo: event.deviceInfo,
      createdAt: event.at,
    }));

    const reports = (await this.callsService.listReports())
      .slice(0, 200)
      .map((report) => ({
        level: 'warning',
        type: 'report',
        userId: report.userId,
        action: `reported_number:${report.phoneNumber}`,
        createdAt: report.createdAt,
      }));

    return [...securityEvents, ...reports]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 500);
  }

  async blacklist() {
    return this.blacklistService.list();
  }

  private buildDailySeries(dates: Date[], days: number) {
    const buckets: Array<{ day: string; count: number }> = [];
    const now = new Date();
    for (let i = days - 1; i >= 0; i -= 1) {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      buckets.push({ day: d.toISOString().slice(0, 10), count: 0 });
    }

    const index = new Map(buckets.map((b, i) => [b.day, i]));
    for (const date of dates) {
      const key = new Date(date).toISOString().slice(0, 10);
      const idx = index.get(key);
      if (idx !== undefined) {
        buckets[idx].count += 1;
      }
    }

    return buckets;
  }
}
