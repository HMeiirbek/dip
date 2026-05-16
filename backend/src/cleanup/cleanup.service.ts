import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);

  constructor(private prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleCron() {
    this.logger.debug('Running scheduled cache and DB cleanup tasks');
    await this.cleanupExpiredSessions();
    await this.cleanupStaleRooms();
  }

  private async cleanupExpiredSessions() {
    try {
      // Clean up sessions from the manual runtime table
      const result = await this.prisma.$executeRawUnsafe(
        `DELETE FROM security_sessions WHERE expires_at < NOW() OR revoked_at < NOW() - INTERVAL '7 days'`
      );
      if (result > 0) {
        this.logger.log(`Deleted ${result} expired security sessions`);
      }
    } catch (error) {
      this.logger.error('Failed to cleanup expired sessions', error);
    }
  }

  private async cleanupStaleRooms() {
    try {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const staleRooms = await this.prisma.room.updateMany({
        where: {
          status: 'active',
          createdAt: { lt: yesterday }
        },
        data: {
          status: 'ended',
          endedAt: new Date()
        }
      });
      if (staleRooms.count > 0) {
        this.logger.log(`Marked ${staleRooms.count} stale rooms as ended`);
      }
    } catch (error) {
      this.logger.error('Failed to cleanup stale rooms', error);
    }
  }
}
