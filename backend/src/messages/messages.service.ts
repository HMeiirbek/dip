import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class MessagesService {
  private readonly items: Array<{
    id: string;
    senderId: string;
    receiverId: string;
    message: string;
    createdAt: Date;
  }> = [];

  async list(userId: string) {
    return this.items
      .filter((item) => item.senderId === userId || item.receiverId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 100);
  }

  async create(senderId: string, receiverId: string, message: string) {
    const item = {
      id: crypto.randomUUID(),
      senderId,
      receiverId,
      message,
      createdAt: new Date(),
    };
    this.items.unshift(item);
    return item;
  }
}
