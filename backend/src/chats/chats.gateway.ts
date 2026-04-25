import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { ChatsService } from './chats.service';

const wsCorsOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000,http://localhost:3001')
  .split(',')
  .map((v) => v.trim())
  .filter(Boolean);

@WebSocketGateway({
  namespace: '/chat',
  cors: {
    origin: wsCorsOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  },
  transports: ['websocket'],
})
export class ChatsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private logger = new Logger('ChatsGateway');

  constructor(
    private readonly jwtService: JwtService,
    private readonly chatsService: ChatsService,
  ) {}

  async handleConnection(client: Socket) {
    const token = (client.handshake.auth && client.handshake.auth.token) || client.handshake.query?.token;
    if (!token) {
      client.emit('error', { message: 'Authentication token required' });
      client.disconnect();
      return;
    }

    try {
      const payload = this.jwtService.verify(token as string);
      const userId = (payload as any).sub || (payload as any).userId || (payload as any).id;
      if (!userId) {
        client.emit('error', { message: 'Invalid token payload' });
        client.disconnect();
        return;
      }
      client.data.userId = userId;
      this.logger.log(`Chat socket connected: ${client.id} user=${userId}`);
    } catch (error: any) {
      client.emit('error', { message: 'Invalid token' });
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data.userId;
    if (userId) {
      this.logger.log(`Chat socket disconnected: ${client.id} user=${userId}`);
    }
  }

  @SubscribeMessage('chat:join')
  async joinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { chatId?: string },
  ) {
    const userId = this.getUserId(client);
    const chatId = payload?.chatId;
    if (!chatId) {
      client.emit('error', { message: 'chatId required' });
      return;
    }

    try {
      await this.chatsService.getMessages(userId, chatId);
      await client.join(this.room(chatId));
      client.emit('chat:joined', { chatId });
    } catch (error: any) {
      client.emit('error', { message: error?.message || 'unable to join chat room' });
    }
  }

  @SubscribeMessage('chat:leave')
  async leaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { chatId?: string },
  ) {
    const chatId = payload?.chatId;
    if (!chatId) {
      client.emit('error', { message: 'chatId required' });
      return;
    }
    await client.leave(this.room(chatId));
    client.emit('chat:left', { chatId });
  }

  @SubscribeMessage('chat:typing')
  async typing(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { chatId?: string; isTyping?: boolean },
  ) {
    const userId = this.getUserId(client);
    const chatId = payload?.chatId;
    if (!chatId) {
      client.emit('error', { message: 'chatId required' });
      return;
    }

    try {
      await this.chatsService.getMessages(userId, chatId);
      client.to(this.room(chatId)).emit('chat:typing', {
        chatId,
        userId,
        isTyping: Boolean(payload?.isTyping),
      });
    } catch {
      client.emit('error', { message: 'access to chat denied' });
    }
  }

  @SubscribeMessage('chat:send')
  async send(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { chatId?: string; content?: string },
  ) {
    const userId = this.getUserId(client);
    const chatId = payload?.chatId;
    const content = payload?.content?.trim();
    if (!chatId || !content) {
      client.emit('error', { message: 'chatId and content required' });
      return;
    }

    try {
      const message = await this.chatsService.sendMessage(userId, chatId, { content });
      this.server.to(this.room(chatId)).emit('chat:message', {
        chatId,
        message,
      });
      client.emit('chat:sent', { chatId, messageId: message.id });
    } catch (error: any) {
      client.emit('error', { message: error?.message || 'message not sent' });
    }
  }

  @SubscribeMessage('chat:read')
  async read(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { chatId?: string; messageId?: string },
  ) {
    const userId = this.getUserId(client);
    const chatId = payload?.chatId;
    const messageId = payload?.messageId;
    if (!chatId || !messageId) {
      client.emit('error', { message: 'chatId and messageId required' });
      return;
    }

    try {
      await this.chatsService.markAsRead(userId, chatId, { messageId });
      this.server.to(this.room(chatId)).emit('chat:read', {
        chatId,
        userId,
        messageId,
      });
    } catch (error: any) {
      client.emit('error', { message: error?.message || 'unable to mark as read' });
    }
  }

  private getUserId(client: Socket): string {
    const userId = client.data.userId as string | undefined;
    if (!userId) {
      throw new Error('socket is not authenticated');
    }
    return userId;
  }

  private room(chatId: string) {
    return `chat:${chatId}`;
  }
}
