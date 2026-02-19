import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private auth: AuthService,
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
    return this.prisma.user.findMany({
      select: {
        id: true,
        username: true,
        createdAt: true,
      },
    });
  }

  async updateMe(userId: string, data: { username?: string }) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        username: data.username,
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
