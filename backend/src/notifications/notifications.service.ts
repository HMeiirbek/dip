import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class NotificationsService {
  private readonly items: Array<{
    id: string;
    userId: string;
    type: string;
    message: string;
    isRead: boolean;
    createdAt: Date;
  }> = [];

  async list(userId: string) {
    return this.items.filter((item) => item.userId === userId);
  }

  async markRead(userId: string, id: string) {
    const target = this.items.find((item) => item.id === id && item.userId === userId);
    if (target) {
      target.isRead = true;
    }
    return { success: true };
  }

  seed(userId: string, type: string, message: string) {
    this.items.unshift({
      id: crypto.randomUUID(),
      userId,
      type,
      message,
      isRead: false,
      createdAt: new Date(),
    });
  }
}
