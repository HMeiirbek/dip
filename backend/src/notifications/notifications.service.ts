import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true,
        userId: true,
        type: true,
        message: true,
        isRead: true,
        createdAt: true,
      },
    });
  }

  async markRead(userId: string, id: string) {
    await this.prisma.notification.updateMany({
      where: { id, userId },
      data: { isRead: true },
    });
    return { success: true };
  }

  async seed(userId: string, type: string, message: string) {
    return this.prisma.notification.create({
      data: {
        userId,
        type,
        message,
      },
      select: {
        id: true,
        userId: true,
        type: true,
        message: true,
        isRead: true,
        createdAt: true,
      },
    });
  }
}
