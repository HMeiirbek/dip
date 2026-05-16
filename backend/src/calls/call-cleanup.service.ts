import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CallCleanupService implements OnModuleInit, OnModuleDestroy {
  private logger = new Logger('CallCleanupService');
  private interval?: NodeJS.Timeout;
  private isRunning = false;
  private readonly CHECK_INTERVAL = 30000; // every 30 seconds

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    this.interval = setInterval(() => this.cleanupExpired(), this.CHECK_INTERVAL);
    this.logger.log('CallCleanupService (SFU version) started');
  }

  async onModuleDestroy() {
    if (this.interval) clearInterval(this.interval);
  }

  private async cleanupExpired() {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      const now = new Date();
      // Clean up rooms that have no participants for more than 5 minutes (heuristic)
      // or rooms that are active but older than 12 hours (timeout)
      const twelveHoursAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000);

      const staleRooms = await this.prisma.room.findMany({
        where: {
          status: 'active',
          createdAt: { lte: twelveHoursAgo },
        },
      });

      for (const room of staleRooms) {
        await this.prisma.room.update({
          where: { id: room.id },
          data: { status: 'ended', endedAt: now },
        });
        this.logger.log(`Auto-ended stale room ${room.id}`);
      }
    } catch (err) {
      this.logger.error(`Error in CallCleanupService: ${err.message}`);
    } finally {
      this.isRunning = false;
    }
  }
}
