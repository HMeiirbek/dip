import { Injectable } from '@nestjs/common';

type PresenceEntry = {
  socketId: string;
  connectedAt: Date;
};

@Injectable()
export class WsPresenceService {
  private readonly userSockets = new Map<string, PresenceEntry>(); // userId -> entry
  private readonly socketUsers = new Map<string, string>(); // socketId -> userId

  setOnline(userId: string, socketId: string) {
    this.userSockets.set(userId, {
      socketId,
      connectedAt: new Date(),
    });
    this.socketUsers.set(socketId, userId);
  }

  clearSocket(socketId: string) {
    const userId = this.socketUsers.get(socketId);
    if (!userId) return;

    this.socketUsers.delete(socketId);
    const current = this.userSockets.get(userId);
    if (current?.socketId === socketId) {
      this.userSockets.delete(userId);
    }
  }

  getSocketIdByUserId(userId: string) {
    return this.userSockets.get(userId)?.socketId;
  }

  getUserIdBySocketId(socketId: string) {
    return this.socketUsers.get(socketId);
  }

  getOnlineUserIds() {
    return Array.from(this.userSockets.keys());
  }

  getPresenceSnapshot() {
    return Array.from(this.userSockets.entries()).map(([userId, entry]) => ({
      userId,
      socketId: entry.socketId,
      connectedAt: entry.connectedAt,
    }));
  }
}

