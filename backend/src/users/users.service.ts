import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { WsPresenceService } from '../ws/ws-presence.service';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private auth: AuthService,
    private presence: WsPresenceService,
  ) {}

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        createdAt: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async findAll() {
    const users = await this.prisma.user.findMany({
      select: {
        id: true,
        username: true,
        createdAt: true,
      },
    });

    const sessionRows = await this.prisma.$queryRawUnsafe<Array<{ user_id: string }>>(
      `SELECT DISTINCT user_id
       FROM security_sessions
       WHERE revoked_at IS NULL
         AND expires_at > NOW()
         AND last_seen_at >= NOW() - INTERVAL '2 minutes'`,
    );
    const onlineSet = new Set([
      ...this.presence.getOnlineUserIds(),
      ...sessionRows.map((row) => row.user_id),
    ]);
    return users.map((user) => ({
      ...user,
      online: onlineSet.has(user.id),
    }));
  }

  async updateMe(userId: string, data: { username?: string }) {
    const normalizedUsername = data.username?.trim();
    if (data.username !== undefined && !normalizedUsername) {
      throw new BadRequestException('username cannot be empty');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        username: normalizedUsername,
      },
      select: {
        id: true,
        username: true,
        createdAt: true,
      },
    });
  }

  async deleteById(id: string) {
    await this.prisma.user.delete({ where: { id } });
    return { success: true };
  }

  async getSessions(userId: string) {
    return this.auth.listSessions(userId);
  }

  async terminateSession(userId: string, sessionId: string) {
    return this.auth.terminateSession(userId, sessionId);
  }

  async getSecurityActivity(userId: string) {
    return this.auth.getSecurityActivity(userId);
  }
}
