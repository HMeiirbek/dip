import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  async updateGeneral(userId: string, data: { username?: string }) {
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

  async updateSecurity() {
    return { success: true };
  }

  async updateNotifications() {
    return { success: true };
  }

  async createApiKey() {
    return { apiKey: crypto.randomBytes(24).toString('hex') };
  }
}
