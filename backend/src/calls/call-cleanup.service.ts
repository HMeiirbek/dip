import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CallEventsService } from './call-events.service';

@Injectable()
export class CallCleanupService implements OnModuleInit, OnModuleDestroy {
  private logger = new Logger('CallCleanupService');
  private interval?: NodeJS.Timeout;
  private isRunning = false;
  private isEnabled = true;
  private readonly CHECK_INTERVAL = 5000; // every 5 seconds

  constructor(private prisma: PrismaService, private callEvents: CallEventsService) {}

  async onModuleInit() {
    const canRun = await this.canRunCleanup();
    if (!canRun) {
      this.isEnabled = false;
      this.logger.warn(
        'CallCleanupService disabled: call schema is not ready or required columns are missing.',
      );
      return;
    }

    this.interval = setInterval(() => this.cleanupExpired(), this.CHECK_INTERVAL);
    this.logger.log('CallCleanupService started');
  }

  async onModuleDestroy() {
    if (this.interval) clearInterval(this.interval);
  }

  private async canRunCleanup(): Promise<boolean> {
    try {
      const result = await this.prisma.$queryRawUnsafe<
        Array<{ exists: boolean }>
      >(
        `SELECT COUNT(*) = 5 AS "exists"
         FROM information_schema.columns
         WHERE lower(table_name) = 'call'
           AND lower(column_name) IN ('id', 'callerid', 'calleeid', 'status', 'expiresat')`,
      );
      return Boolean(result[0]?.exists);
    } catch (err) {
      this.logger.warn(
        `CallCleanupService disabled because schema check failed: ${err?.message || err}`,
      );
      return false;
    }
  }

  private async cleanupExpired() {
    if (!this.isEnabled || this.isRunning) {
      return;
    }

    this.isRunning = true;
    try {
      const now = new Date();
      const expiredPending = await this.prisma.call.findMany({
        where: {
          status: 'pending',
          expiresAt: { not: null, lte: now },
        },
      });

      const expiredAccepted = await this.prisma.call.findMany({
        where: {
          status: 'accepted',
          expiresAt: { not: null, lte: now },
        },
      });

      for (const c of expiredPending) {
        await this.prisma.call.update({
          where: { id: c.id },
          data: { status: 'rejected', endedAt: new Date() },
        });

        this.logger.log(`Auto-rejected expired call ${c.id}`);
        // notify interested parties via events
        try {
          this.callEvents.emitRejected({
            callId: c.id,
            callerId: c.callerId,
            calleeId: c.calleeId,
            reason: 'ring-timeout',
          });
        } catch (e) {
          this.logger.debug(`Failed to emit rejected event: ${e?.message || e}`);
        }
      }

      for (const c of expiredAccepted) {
        await this.prisma.call.update({
          where: { id: c.id },
          data: { status: 'ended', endedAt: new Date() },
        });
        this.logger.log(`Auto-ended stale accepted call ${c.id}`);
        this.callEvents.emitEnded({
          callId: c.id,
          callerId: c.callerId,
          calleeId: c.calleeId,
          reason: 'accepted-session-timeout',
        });
      }
    } catch (err) {
      const message = err?.message || err;
      this.logger.error(`Error cleaning up expired calls: ${message}`);
      if (typeof message === 'string' && message.includes('Invalid prisma.call.findMany() invocation')) {
        this.logger.error(
          'CallCleanupService disabled due to invalid Prisma cleanup query. Check database schema or generated Prisma client.',
        );
        this.isEnabled = false;
      }
    } finally {
      this.isRunning = false;
    }
  }
}
