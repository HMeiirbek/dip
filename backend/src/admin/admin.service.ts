import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AppRole, SecurityService } from '../auth/security.service';
import { AuthService } from '../auth/auth.service';
import { CallsService } from '../calls/calls.service';
import { CallEventsService } from '../calls/call-events.service';
import { BlacklistService } from '../blacklist/blacklist.service';
import { WsPresenceService } from '../ws/ws-presence.service';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private auth: AuthService,
    private callsService: CallsService,
    private callEvents: CallEventsService,
    private blacklistService: BlacklistService,
    private securityService: SecurityService,
    private presence: WsPresenceService,
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

  async moderationOverview() {
    const snapshot = this.presence.getPresenceSnapshot();
    const onlineIds = snapshot.map((entry) => entry.userId);

    const [users, roles, sessionRows, activeCalls] = await Promise.all([
      onlineIds.length
        ? this.prisma.user.findMany({
            where: { id: { in: onlineIds } },
            select: { id: true, username: true },
          })
        : Promise.resolve([]),
      onlineIds.length
        ? this.prisma.$queryRawUnsafe<Array<{ user_id: string; role: string }>>(
            `SELECT user_id, role FROM security_user_state WHERE user_id = ANY($1::text[])`,
            onlineIds,
          )
        : Promise.resolve([]),
      onlineIds.length
        ? this.prisma.$queryRawUnsafe<
            Array<{
              user_id: string;
              ip_address: string | null;
              device_info: string | null;
              user_agent: string | null;
              last_seen_at: Date;
              expires_at: Date;
              revoked_at: Date | null;
            }>
          >(
            `SELECT DISTINCT ON (user_id)
              user_id, ip_address, device_info, user_agent, last_seen_at, expires_at, revoked_at
             FROM security_sessions
             WHERE user_id = ANY($1::text[])
             ORDER BY user_id, last_seen_at DESC`,
            onlineIds,
          )
        : Promise.resolve([]),
      this.prisma.call.findMany({
        where: { status: { in: ['pending', 'accepted', 'active'] } },
        orderBy: { createdAt: 'desc' },
        take: 200,
        include: {
          caller: { select: { id: true, username: true } },
          callee: { select: { id: true, username: true } },
        },
      }),
    ]);

    const callIds = activeCalls.map((call) => call.id);
    const qualityRows = callIds.length
      ? await this.prisma.$queryRawUnsafe<
          Array<{
            call_id: string;
            rtt_ms: number | null;
            jitter_ms: number | null;
            packet_loss_pct: number | null;
            mos_like: number | null;
            bitrate_kbps: number | null;
            created_at: Date;
          }>
        >(
          `SELECT DISTINCT ON (call_id)
            call_id, rtt_ms, jitter_ms, packet_loss_pct, mos_like, bitrate_kbps, created_at
           FROM call_quality_metrics
           WHERE call_id = ANY($1::text[])
           ORDER BY call_id, created_at DESC`,
          callIds,
        )
      : [];
    const trendRows = callIds.length
      ? await this.prisma.$queryRawUnsafe<
          Array<{
            call_id: string;
            created_at: Date;
            rtt_ms: number | null;
            jitter_ms: number | null;
            packet_loss_pct: number | null;
            mos_like: number | null;
          }>
        >(
          `SELECT call_id, created_at, rtt_ms, jitter_ms, packet_loss_pct, mos_like
           FROM (
             SELECT
               call_id, created_at, rtt_ms, jitter_ms, packet_loss_pct, mos_like,
               ROW_NUMBER() OVER (PARTITION BY call_id ORDER BY created_at DESC) AS rn
             FROM call_quality_metrics
             WHERE call_id = ANY($1::text[])
           ) ranked
           WHERE rn <= 24
           ORDER BY call_id ASC, created_at ASC`,
          callIds,
        )
      : [];

    const usersById = new Map(users.map((user) => [user.id, user]));
    const rolesById = new Map(roles.map((row) => [row.user_id, row.role]));
    const sessionById = new Map(sessionRows.map((row) => [row.user_id, row]));
    const qualityByCallId = new Map(qualityRows.map((row) => [row.call_id, row]));
    const trendByCallId = new Map<
      string,
      {
        rttMs: ReturnType<AdminService['evaluateTrend']>;
        jitterMs: ReturnType<AdminService['evaluateTrend']>;
        packetLossPct: ReturnType<AdminService['evaluateTrend']>;
        mosLike: ReturnType<AdminService['evaluateTrend']>;
      }
    >();
    for (const callId of callIds) {
      const samples = trendRows.filter((row) => row.call_id === callId);
      trendByCallId.set(callId, {
        rttMs: this.evaluateTrend(samples.map((s) => s.rtt_ms), true),
        jitterMs: this.evaluateTrend(samples.map((s) => s.jitter_ms), true),
        packetLossPct: this.evaluateTrend(samples.map((s) => s.packet_loss_pct), true),
        mosLike: this.evaluateTrend(samples.map((s) => s.mos_like), false),
      });
    }
    const onlineSet = new Set(onlineIds);

    const onlineUsers = snapshot
      .map((entry) => {
        const user = usersById.get(entry.userId);
        const session = sessionById.get(entry.userId);
        return {
          userId: entry.userId,
          username: user?.username || 'unknown',
          role: rolesById.get(entry.userId) || 'user',
          socketId: entry.socketId,
          connectedAt: entry.connectedAt,
          ipAddress: session?.ip_address || 'unknown',
          deviceInfo: session?.device_info || 'unknown',
          userAgent: session?.user_agent || 'unknown',
          lastSeenAt: session?.last_seen_at || null,
          sessionActive: Boolean(
            session &&
              !session.revoked_at &&
              new Date(session.expires_at).getTime() > Date.now(),
          ),
        };
      })
      .sort((a, b) => a.username.localeCompare(b.username));

    const calls = activeCalls.map((call) => {
      const started = call.startedAt || call.createdAt;
      const durationSec = Math.max(
        0,
        Math.floor((Date.now() - new Date(started).getTime()) / 1000),
      );

      const callerSession = sessionById.get(call.callerId);
      const calleeSession = sessionById.get(call.calleeId);
      const quality = qualityByCallId.get(call.id);

      return {
        id: call.id,
        status: call.status,
        createdAt: call.createdAt,
        startedAt: call.startedAt,
        expiresAt: call.expiresAt,
        durationSec,
        quality: quality
          ? {
              rttMs: quality.rtt_ms,
              jitterMs: quality.jitter_ms,
              packetLossPct: quality.packet_loss_pct,
              mosLike: quality.mos_like,
              bitrateKbps: quality.bitrate_kbps,
              sampledAt: quality.created_at,
            }
          : null,
        caller: {
          id: call.callerId,
          username: call.caller?.username || call.callerId,
          online: onlineSet.has(call.callerId),
          ipAddress: callerSession?.ip_address || 'unknown',
          deviceInfo: callerSession?.device_info || 'unknown',
        },
        callee: {
          id: call.calleeId,
          username: call.callee?.username || call.calleeId,
          online: onlineSet.has(call.calleeId),
          ipAddress: calleeSession?.ip_address || 'unknown',
          deviceInfo: calleeSession?.device_info || 'unknown',
        },
      };
    });

    const aggregate = {
      rttMs: this.percentiles(calls.map((c) => c.quality?.rttMs)),
      jitterMs: this.percentiles(calls.map((c) => c.quality?.jitterMs)),
      packetLossPct: this.percentiles(calls.map((c) => c.quality?.packetLossPct)),
      mosLike: this.percentiles(calls.map((c) => c.quality?.mosLike)),
      bitrateKbps: this.percentiles(calls.map((c) => c.quality?.bitrateKbps)),
    };

    const alerts = calls
      .flatMap((call) => {
        const items: Array<{
          level: 'warning' | 'critical';
          callId: string;
          metric: string;
          value: number;
          threshold: string;
          message: string;
        }> = [];
        const q = call.quality;
        if (!q) return items;

        if (typeof q.rttMs === 'number' && q.rttMs > 350) {
          items.push({
            level: q.rttMs > 500 ? 'critical' : 'warning',
            callId: call.id,
            metric: 'rttMs',
            value: q.rttMs,
            threshold: '>350ms',
            message: `High RTT on call ${call.id.slice(0, 8)} (${q.rttMs}ms)`,
          });
        }
        if (typeof q.jitterMs === 'number' && q.jitterMs > 80) {
          items.push({
            level: q.jitterMs > 120 ? 'critical' : 'warning',
            callId: call.id,
            metric: 'jitterMs',
            value: q.jitterMs,
            threshold: '>80ms',
            message: `High jitter on call ${call.id.slice(0, 8)} (${q.jitterMs}ms)`,
          });
        }
        if (typeof q.packetLossPct === 'number' && q.packetLossPct > 5) {
          items.push({
            level: q.packetLossPct > 10 ? 'critical' : 'warning',
            callId: call.id,
            metric: 'packetLossPct',
            value: q.packetLossPct,
            threshold: '>5%',
            message: `Packet loss threshold exceeded on call ${call.id.slice(0, 8)} (${q.packetLossPct}%)`,
          });
        }
        if (typeof q.mosLike === 'number' && q.mosLike < 3.5) {
          items.push({
            level: q.mosLike < 2.8 ? 'critical' : 'warning',
            callId: call.id,
            metric: 'mosLike',
            value: q.mosLike,
            threshold: '<3.5',
            message: `Low MOS-like quality on call ${call.id.slice(0, 8)} (${q.mosLike})`,
          });
        }

        const trend = trendByCallId.get(call.id);
        if (trend?.rttMs.status === 'degrading' && typeof trend.rttMs.delta === 'number' && trend.rttMs.delta > 20) {
          items.push({
            level: trend.rttMs.delta > 60 ? 'critical' : 'warning',
            callId: call.id,
            metric: 'trend:rttMs',
            value: trend.rttMs.delta,
            threshold: 'delta > 20',
            message: `RTT trend degrading on call ${call.id.slice(0, 8)} (Δ ${trend.rttMs.delta}ms)`,
          });
        }
        if (
          trend?.packetLossPct.status === 'degrading' &&
          typeof trend.packetLossPct.delta === 'number' &&
          trend.packetLossPct.delta > 1.5
        ) {
          items.push({
            level: trend.packetLossPct.delta > 3 ? 'critical' : 'warning',
            callId: call.id,
            metric: 'trend:packetLossPct',
            value: trend.packetLossPct.delta,
            threshold: 'delta > 1.5',
            message: `Packet loss trend degrading on call ${call.id.slice(0, 8)} (Δ ${trend.packetLossPct.delta}%)`,
          });
        }
        if (
          trend?.jitterMs.status === 'degrading' &&
          typeof trend.jitterMs.delta === 'number' &&
          trend.jitterMs.delta > 10
        ) {
          items.push({
            level: trend.jitterMs.delta > 25 ? 'critical' : 'warning',
            callId: call.id,
            metric: 'trend:jitterMs',
            value: trend.jitterMs.delta,
            threshold: 'delta > 10',
            message: `Jitter trend degrading on call ${call.id.slice(0, 8)} (Δ ${trend.jitterMs.delta}ms)`,
          });
        }
        if (
          trend?.mosLike.status === 'degrading' &&
          typeof trend.mosLike.delta === 'number' &&
          trend.mosLike.delta < -0.2
        ) {
          items.push({
            level: trend.mosLike.delta < -0.5 ? 'critical' : 'warning',
            callId: call.id,
            metric: 'trend:mosLike',
            value: trend.mosLike.delta,
            threshold: 'delta < -0.2',
            message: `MOS trend degrading on call ${call.id.slice(0, 8)} (Δ ${trend.mosLike.delta})`,
          });
        }
        return items;
      })
      .slice(0, 100);

    return {
      generatedAt: new Date(),
      onlineCount: onlineUsers.length,
      onlineUsers,
      callCount: calls.length,
      calls,
      qualitySummary: {
        activeCallsWithQuality: calls.filter((c) => !!c.quality).length,
        aggregate,
        alerts,
      },
    };
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

  async callQualityHistory(callId: string, limit = 120) {
    const safeLimit = Math.max(20, Math.min(600, Number(limit) || 120));
    const call = await this.prisma.call.findUnique({
      where: { id: callId },
      include: {
        caller: { select: { id: true, username: true } },
        callee: { select: { id: true, username: true } },
      },
    });

    if (!call) {
      return {
        call: null,
        points: [],
        summary: null,
      };
    }

    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        created_at: Date;
        user_id: string;
        rtt_ms: number | null;
        jitter_ms: number | null;
        packet_loss_pct: number | null;
        mos_like: number | null;
        bitrate_kbps: number | null;
      }>
    >(
      `SELECT created_at, user_id, rtt_ms, jitter_ms, packet_loss_pct, mos_like, bitrate_kbps
       FROM call_quality_metrics
       WHERE call_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      callId,
      safeLimit,
    );

    const [flagRows, moderationLogRows] = await Promise.all([
      this.prisma.$queryRawUnsafe<
        Array<{
          id: string;
          actor_id: string;
          actor_role: string;
          reason: string;
          status: string;
          created_at: Date;
          resolved_at: Date | null;
          resolved_by: string | null;
        }>
      >(
        `SELECT id, actor_id, actor_role, reason, status, created_at, resolved_at, resolved_by
         FROM moderation_call_flags
         WHERE call_id = $1
         ORDER BY created_at DESC
         LIMIT 200`,
        callId,
      ),
      this.prisma.$queryRawUnsafe<
        Array<{
          user_id: string;
          action: string;
          created_at: Date;
        }>
      >(
        `SELECT user_id, action, created_at
         FROM security_logs
         WHERE action ILIKE $1
         ORDER BY created_at DESC
         LIMIT 200`,
        `%call=${callId}%`,
      ),
    ]);

    const actorIds = Array.from(
      new Set(
        [
          ...flagRows.map((r) => r.actor_id),
          ...flagRows.map((r) => r.resolved_by).filter(Boolean),
          ...moderationLogRows.map((r) => r.user_id),
        ].filter(Boolean),
      ),
    ) as string[];
    const actorUsers = actorIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, username: true },
        })
      : [];
    const actorNameById = new Map(actorUsers.map((u) => [u.id, u.username]));

    const points = rows
      .slice()
      .reverse()
      .map((row) => ({
        at: row.created_at,
        userId: row.user_id,
        rttMs: row.rtt_ms,
        jitterMs: row.jitter_ms,
        packetLossPct: row.packet_loss_pct,
        mosLike: row.mos_like,
        bitrateKbps: row.bitrate_kbps,
      }));

    const timeline: Array<{
      at: Date;
      type: string;
      actorId: string | null;
      actorName: string | null;
      message: string;
      metadata?: Record<string, unknown>;
    }> = [];

    timeline.push({
      at: call.createdAt,
      type: 'call.created',
      actorId: call.callerId,
      actorName: call.caller?.username || call.callerId,
      message: 'Call created',
    });
    if (call.startedAt) {
      timeline.push({
        at: call.startedAt,
        type: 'call.started',
        actorId: call.calleeId,
        actorName: call.callee?.username || call.calleeId,
        message: 'Call started/accepted',
      });
    }
    if (call.endedAt) {
      timeline.push({
        at: call.endedAt,
        type: 'call.ended',
        actorId: null,
        actorName: null,
        message: `Call ended (${call.status})`,
      });
    }

    for (const flag of flagRows) {
      timeline.push({
        at: flag.created_at,
        type: 'moderation.flag',
        actorId: flag.actor_id,
        actorName: actorNameById.get(flag.actor_id) || flag.actor_id,
        message: `Flag created: ${flag.reason}`,
        metadata: {
          actorRole: flag.actor_role,
          status: flag.status,
          flagId: flag.id,
        },
      });
      if (flag.resolved_at) {
        timeline.push({
          at: flag.resolved_at,
          type: 'moderation.flag.resolved',
          actorId: flag.resolved_by || null,
          actorName: flag.resolved_by
            ? actorNameById.get(flag.resolved_by) || flag.resolved_by
            : null,
          message: `Flag resolved: ${flag.reason}`,
          metadata: { flagId: flag.id },
        });
      }
    }

    for (const event of moderationLogRows) {
      if (event.action.startsWith('moderator_flag ')) continue;
      if (event.action.startsWith('moderator_flag_resolve ')) continue;
      timeline.push({
        at: event.created_at,
        type: 'moderation.log',
        actorId: event.user_id,
        actorName: actorNameById.get(event.user_id) || event.user_id,
        message: event.action,
      });
    }

    timeline.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

    return {
      call: {
        id: call.id,
        status: call.status,
        caller: call.caller,
        callee: call.callee,
        createdAt: call.createdAt,
        startedAt: call.startedAt,
      },
      points,
      summary: {
        sampleCount: points.length,
        rttMs: this.percentiles(points.map((p) => p.rttMs)),
        jitterMs: this.percentiles(points.map((p) => p.jitterMs)),
        packetLossPct: this.percentiles(points.map((p) => p.packetLossPct)),
        mosLike: this.percentiles(points.map((p) => p.mosLike)),
        bitrateKbps: this.percentiles(points.map((p) => p.bitrateKbps)),
        trends: {
          rttMs: this.evaluateTrend(points.map((p) => p.rttMs), true),
          jitterMs: this.evaluateTrend(points.map((p) => p.jitterMs), true),
          packetLossPct: this.evaluateTrend(points.map((p) => p.packetLossPct), true),
          mosLike: this.evaluateTrend(points.map((p) => p.mosLike), false),
        },
        anomalies: this.collectAnomalies(points),
      },
      timeline: timeline.slice(-300),
    };
  }

  async forceEndCall(callId: string, actorId: string, actorRole: string) {
    const call = await this.prisma.call.findUnique({ where: { id: callId } });
    if (!call) throw new NotFoundException('Call not found');

    if (!['pending', 'accepted', 'active'].includes(call.status)) {
      throw new BadRequestException(`Call is not active: ${call.status}`);
    }

    const endedAt = new Date();
    const updated = await this.prisma.call.update({
      where: { id: callId },
      data: {
        status: 'ended',
        endedAt,
      },
    });

    await this.prisma.$executeRawUnsafe(
      `INSERT INTO security_logs (id, user_id, ip_address, device, action, created_at)
       VALUES ($1, $2, NULL, NULL, $3, NOW())`,
      crypto.randomUUID(),
      actorId,
      `moderator_force_end call=${callId} role=${actorRole}`,
    );

    this.callEvents.emitEnded({
      callId: updated.id,
      callerId: updated.callerId,
      calleeId: updated.calleeId,
      reason: 'force-ended-by-moderator',
      endedBy: actorId,
    });

    return {
      success: true,
      callId: updated.id,
      status: updated.status,
      endedAt: updated.endedAt,
    };
  }

  async flagCall(callId: string, actorId: string, actorRole: string, reason?: string) {
    const call = await this.prisma.call.findUnique({
      where: { id: callId },
      select: { id: true, status: true },
    });
    if (!call) throw new NotFoundException('Call not found');

    const normalizedReason = reason?.trim() || 'manual_review_requested';
    const flagId = crypto.randomUUID();
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO moderation_call_flags
        (id, call_id, actor_id, actor_role, reason, status, created_at)
       VALUES
        ($1, $2, $3, $4, $5, 'open', NOW())`,
      flagId,
      callId,
      actorId,
      actorRole,
      normalizedReason,
    );

    await this.prisma.$executeRawUnsafe(
      `INSERT INTO security_logs (id, user_id, ip_address, device, action, created_at)
       VALUES ($1, $2, NULL, NULL, $3, NOW())`,
      crypto.randomUUID(),
      actorId,
      `moderator_flag call=${callId} role=${actorRole} reason=${normalizedReason}`,
    );

    return {
      success: true,
      flagId,
      callId,
      status: call.status,
      reason: normalizedReason,
    };
  }

  async callFlags(input?: {
    status?: 'open' | 'resolved' | 'all';
    limit?: number;
    offset?: number;
    q?: string;
    sortBy?: 'createdAt' | 'status' | 'actorRole';
    sortDir?: 'asc' | 'desc';
  }) {
    const status = input?.status || 'open';
    const safeLimit = Math.max(1, Math.min(300, Number(input?.limit) || 100));
    const safeOffset = Math.max(0, Number(input?.offset) || 0);
    const search = (input?.q || '').trim();
    const sortBy = input?.sortBy || 'createdAt';
    const sortDir = input?.sortDir === 'asc' ? 'ASC' : 'DESC';
    const orderColumn =
      sortBy === 'status'
        ? 'status'
        : sortBy === 'actorRole'
          ? 'actor_role'
          : 'created_at';

    const whereClauses: string[] = [];
    const params: unknown[] = [];
    const pushParam = (value: unknown) => {
      params.push(value);
      return `$${params.length}`;
    };

    if (status !== 'all') {
      whereClauses.push(`status = ${pushParam(status === 'resolved' ? 'resolved' : 'open')}`);
    }

    if (search) {
      const like = `%${search}%`;
      const p1 = pushParam(like);
      const p2 = pushParam(like);
      const p3 = pushParam(like);
      const p4 = pushParam(like);
      whereClauses.push(`(call_id ILIKE ${p1} OR reason ILIKE ${p2} OR actor_role ILIKE ${p3} OR actor_id ILIKE ${p4})`);
    }

    const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const limitParam = pushParam(safeLimit);
    const offsetParam = pushParam(safeOffset);

    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        id: string;
        call_id: string;
        actor_id: string;
        actor_role: string;
        reason: string;
        status: string;
        created_at: Date;
        resolved_at: Date | null;
        resolved_by: string | null;
      }>
    >(
      `SELECT id, call_id, actor_id, actor_role, reason, status, created_at, resolved_at, resolved_by
       FROM moderation_call_flags
       ${whereSql}
       ORDER BY ${orderColumn} ${sortDir}, created_at DESC
       LIMIT ${limitParam}
       OFFSET ${offsetParam}`,
      ...params,
    );

    const countRows = await this.prisma.$queryRawUnsafe<Array<{ count: string }>>(
      `SELECT COUNT(*)::text AS count
       FROM moderation_call_flags
       ${whereSql}`,
      ...params.slice(0, params.length - 2),
    );
    const total = Number(countRows?.[0]?.count || 0);

    const callIds = Array.from(new Set(rows.map((r) => r.call_id)));
    const calls = callIds.length
      ? await this.prisma.call.findMany({
          where: { id: { in: callIds } },
          select: {
            id: true,
            callerId: true,
            calleeId: true,
            caller: { select: { id: true, username: true } },
            callee: { select: { id: true, username: true } },
          },
        })
      : [];
    const callsById = new Map(calls.map((c) => [c.id, c]));

    const items = rows.map((row) => {
      const callData = callsById.get(row.call_id);
      return {
        id: row.id,
        callId: row.call_id,
        actorId: row.actor_id,
        actorRole: row.actor_role,
        reason: row.reason,
        status: row.status,
        createdAt: row.created_at,
        resolvedAt: row.resolved_at,
        resolvedBy: row.resolved_by,
        call: callData
          ? {
              caller: {
                id: callData.callerId,
                username: callData.caller?.username || callData.callerId,
              },
              callee: {
                id: callData.calleeId,
                username: callData.callee?.username || callData.calleeId,
              },
            }
          : null,
      };
    });

    return {
      items,
      total,
      limit: safeLimit,
      offset: safeOffset,
      sortBy,
      sortDir: sortDir.toLowerCase(),
    };
  }

  async resolveCallFlag(flagId: string, actorId: string) {
    const existing = await this.prisma.$queryRawUnsafe<
      Array<{ id: string; status: string; call_id: string }>
    >(
      `SELECT id, status, call_id FROM moderation_call_flags WHERE id = $1 LIMIT 1`,
      flagId,
    );
    if (!existing[0]) throw new NotFoundException('Flag not found');
    if (existing[0].status === 'resolved') {
      return { success: true, flagId, status: 'resolved' };
    }

    await this.prisma.$executeRawUnsafe(
      `UPDATE moderation_call_flags
       SET status = 'resolved', resolved_at = NOW(), resolved_by = $2
       WHERE id = $1`,
      flagId,
      actorId,
    );

    await this.prisma.$executeRawUnsafe(
      `INSERT INTO security_logs (id, user_id, ip_address, device, action, created_at)
       VALUES ($1, $2, NULL, NULL, $3, NOW())`,
      crypto.randomUUID(),
      actorId,
      `moderator_flag_resolve call=${existing[0].call_id} flag=${flagId}`,
    );

    return { success: true, flagId, status: 'resolved' };
  }

  async resolveAllCallFlags(callId: string, actorId: string) {
    const openRows = await this.prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT id FROM moderation_call_flags WHERE call_id = $1 AND status = 'open'`,
      callId,
    );

    if (!openRows.length) {
      return { success: true, callId, resolved: 0 };
    }

    const updated = await this.prisma.$executeRawUnsafe(
      `UPDATE moderation_call_flags
       SET status = 'resolved', resolved_at = NOW(), resolved_by = $2
       WHERE call_id = $1 AND status = 'open'`,
      callId,
      actorId,
    );

    await this.prisma.$executeRawUnsafe(
      `INSERT INTO security_logs (id, user_id, ip_address, device, action, created_at)
       VALUES ($1, $2, NULL, NULL, $3, NOW())`,
      crypto.randomUUID(),
      actorId,
      `moderator_flag_resolve_all call=${callId} count=${Number(updated)}`,
    );

    return {
      success: true,
      callId,
      resolved: Number(updated),
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

  async slaSummary() {
    const calls = await this.prisma.call.findMany({
      orderBy: { createdAt: 'desc' },
      take: 3000,
      select: {
        createdAt: true,
        startedAt: true,
        status: true,
      },
    });

    const completedSetups = calls
      .filter((c) => !!c.startedAt)
      .map((c) => Math.max(0, (new Date(c.startedAt as Date).getTime() - new Date(c.createdAt).getTime()) / 1000));

    const setupStats = this.percentiles(completedSetups);
    const setupLe8 = completedSetups.filter((v) => v <= 8).length;
    const setupLe5 = completedSetups.filter((v) => v <= 5).length;

    const qualityRow = await this.prisma.$queryRawUnsafe<
      Array<{
        total: string;
        rtt_ok: string;
        jitter_ok: string;
        loss_ok: string;
      }>
    >(
      `SELECT
        COUNT(*)::text AS total,
        SUM(CASE WHEN rtt_ms IS NOT NULL AND rtt_ms <= 200 THEN 1 ELSE 0 END)::text AS rtt_ok,
        SUM(CASE WHEN jitter_ms IS NOT NULL AND jitter_ms <= 80 THEN 1 ELSE 0 END)::text AS jitter_ok,
        SUM(CASE WHEN packet_loss_pct IS NOT NULL AND packet_loss_pct <= 5 THEN 1 ELSE 0 END)::text AS loss_ok
       FROM call_quality_metrics
       WHERE created_at >= NOW() - INTERVAL '24 hours'`,
    );

    const q = qualityRow?.[0] || { total: '0', rtt_ok: '0', jitter_ok: '0', loss_ok: '0' };
    const total = Number(q.total || 0);
    const rttOk = Number(q.rtt_ok || 0);
    const jitterOk = Number(q.jitter_ok || 0);
    const lossOk = Number(q.loss_ok || 0);

    const pct = (num: number, den: number) => (den > 0 ? Number(((num / den) * 100).toFixed(2)) : null);

    return {
      generatedAt: new Date(),
      targets: {
        setup95LeSec: 8,
        latencyLeMs: 200,
        packetLossLePct: 5,
      },
      callSetup: {
        samples: completedSetups.length,
        p50Sec: setupStats.p50,
        p95Sec: setupStats.p95,
        avgSec: setupStats.avg,
        le5SecPct: pct(setupLe5, completedSetups.length),
        le8SecPct: pct(setupLe8, completedSetups.length),
      },
      quality24h: {
        samples: total,
        rttLe200Pct: pct(rttOk, total),
        jitterLe80Pct: pct(jitterOk, total),
        packetLossLe5Pct: pct(lossOk, total),
      },
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

  private percentiles(input: Array<number | null | undefined>) {
    const values = input
      .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
      .sort((a, b) => a - b);

    if (!values.length) {
      return { p50: null, p95: null, avg: null };
    }

    const pick = (p: number) => {
      const idx = Math.min(
        values.length - 1,
        Math.max(0, Math.ceil((p / 100) * values.length) - 1),
      );
      return Number(values[idx].toFixed(2));
    };

    const avg = Number(
      (values.reduce((sum, n) => sum + n, 0) / values.length).toFixed(2),
    );

    return {
      p50: pick(50),
      p95: pick(95),
      avg,
    };
  }

  private evaluateTrend(
    input: Array<number | null | undefined>,
    higherIsWorse: boolean,
  ) {
    const values = input.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
    if (values.length < 6) {
      return {
        status: 'insufficient',
        delta: null,
        fromAvg: null,
        toAvg: null,
      };
    }

    const windowSize = Math.max(3, Math.floor(values.length / 3));
    const start = values.slice(0, windowSize);
    const end = values.slice(values.length - windowSize);

    const avg = (arr: number[]) => arr.reduce((sum, n) => sum + n, 0) / arr.length;
    const fromAvg = avg(start);
    const toAvg = avg(end);
    const rawDelta = toAvg - fromAvg;
    const normalizedDelta = higherIsWorse ? rawDelta : -rawDelta;

    const status =
      normalizedDelta > 3
        ? 'degrading'
        : normalizedDelta < -3
          ? 'improving'
          : 'stable';

    return {
      status,
      delta: Number(rawDelta.toFixed(2)),
      fromAvg: Number(fromAvg.toFixed(2)),
      toAvg: Number(toAvg.toFixed(2)),
    };
  }

  private collectAnomalies(
    points: Array<{
      at: Date;
      userId: string;
      rttMs: number | null;
      jitterMs: number | null;
      packetLossPct: number | null;
      mosLike: number | null;
      bitrateKbps: number | null;
    }>,
  ) {
    const anomalies: Array<{
      at: Date;
      userId: string;
      metric: 'rttMs' | 'jitterMs' | 'packetLossPct' | 'mosLike';
      value: number;
      threshold: string;
      level: 'warning' | 'critical';
    }> = [];

    for (const p of points) {
      if (typeof p.rttMs === 'number' && p.rttMs > 350) {
        anomalies.push({
          at: p.at,
          userId: p.userId,
          metric: 'rttMs',
          value: p.rttMs,
          threshold: '>350',
          level: p.rttMs > 500 ? 'critical' : 'warning',
        });
      }
      if (typeof p.jitterMs === 'number' && p.jitterMs > 80) {
        anomalies.push({
          at: p.at,
          userId: p.userId,
          metric: 'jitterMs',
          value: p.jitterMs,
          threshold: '>80',
          level: p.jitterMs > 120 ? 'critical' : 'warning',
        });
      }
      if (typeof p.packetLossPct === 'number' && p.packetLossPct > 5) {
        anomalies.push({
          at: p.at,
          userId: p.userId,
          metric: 'packetLossPct',
          value: p.packetLossPct,
          threshold: '>5',
          level: p.packetLossPct > 10 ? 'critical' : 'warning',
        });
      }
      if (typeof p.mosLike === 'number' && p.mosLike < 3.5) {
        anomalies.push({
          at: p.at,
          userId: p.userId,
          metric: 'mosLike',
          value: p.mosLike,
          threshold: '<3.5',
          level: p.mosLike < 2.8 ? 'critical' : 'warning',
        });
      }
    }

    return anomalies.slice(-200);
  }
}
