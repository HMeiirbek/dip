import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { CallsService } from '../calls/calls.service';
import { JwtService } from '@nestjs/jwt';
import { CallEventsService } from '../calls/call-events.service';
import { WsPresenceService } from './ws-presence.service';

interface WebRTCOffer {
  callId: string;
  targetUserId: string;
  offer: RTCSessionDescription;
}

interface WebRTCAnswer {
  callId: string;
  targetUserId: string;
  answer: RTCSessionDescription;
}

interface ICECandidate {
  callId: string;
  targetUserId: string;
  candidate: RTCIceCandidate;
}

@WebSocketGateway({ cors: true })
@Injectable()
export class WsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private logger = new Logger('WsGateway');

  private isSecureHandshake(client: Socket): boolean {
    const xfProto = `${client.handshake.headers['x-forwarded-proto'] || ''}`.toLowerCase();
    const referer = `${client.handshake.headers.referer || ''}`.toLowerCase();
    const origin = `${client.handshake.headers.origin || ''}`.toLowerCase();
    const host = `${client.handshake.headers.host || ''}`.toLowerCase();

    if (xfProto.includes('https') || xfProto.includes('wss')) return true;
    if (referer.startsWith('https://') || origin.startsWith('https://')) return true;
    if (host.startsWith('localhost') || host.startsWith('127.0.0.1')) return true;
    return false;
  }

  constructor(
    private callsService: CallsService,
    private jwtService: JwtService,
    private callEvents: CallEventsService,
    private presence: WsPresenceService,
  ) {
    // subscribe to server-side incoming call events
    this.callEvents.onIncoming((e) => {
      const calleeSocketId = this.presence.getSocketIdByUserId(e.calleeId);
      if (calleeSocketId) {
        this.server.to(calleeSocketId).emit('call:incoming', {
          callId: e.callId,
          callerId: e.callerId,
          callerName: e.callerName,
        });
      }
    });

    this.callEvents.onEnded((e) => {
      const payload = {
        callId: e.callId,
        reason: e.reason || 'ended',
        endedBy: e.endedBy || null,
      };
      const callerSocketId = this.presence.getSocketIdByUserId(e.callerId);
      if (callerSocketId) {
        this.server.to(callerSocketId).emit('call:ended', payload);
      }
      const calleeSocketId = this.presence.getSocketIdByUserId(e.calleeId);
      if (calleeSocketId) {
        this.server.to(calleeSocketId).emit('call:ended', payload);
      }
    });
  }

  async handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);

    const enforceSecure = process.env.ENFORCE_SECURE_SIGNALING === 'true';
    if (enforceSecure && !this.isSecureHandshake(client)) {
      this.logger.warn(`Rejected insecure socket connection: ${client.id}`);
      client.emit('error', { message: 'Secure signaling required (HTTPS/WSS)' });
      client.disconnect();
      return;
    }

    const token = (client.handshake.auth && client.handshake.auth.token) || client.handshake.query?.token;
    if (!token) {
      this.logger.warn(`Socket ${client.id} connected without token`);
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

      this.presence.setOnline(userId, client.id);
      this.logger.log(`User ${userId} authenticated on socket ${client.id}`);
      this.broadcastOnlineUsers();
    } catch (err) {
      this.logger.warn(`JWT verification failed for socket ${client.id}: ${err?.message || err}`);
      client.emit('error', { message: 'Invalid token' });
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = this.presence.getUserIdBySocketId(client.id);
    if (userId) {
      this.presence.clearSocket(client.id);
      this.logger.log(`User ${userId} disconnected`);
      this.broadcastOnlineUsers();
    }
  }

  @SubscribeMessage('user:register')
  handleRegisterUser(
    @MessageBody() data: { userId: string },
    @ConnectedSocket() client: Socket,
  ) {
    if (!data?.userId) {
      client.emit('error', { message: 'userId required' });
      return;
    }

    this.presence.setOnline(data.userId, client.id);
    this.logger.log(`User registered: ${data.userId} (socket: ${client.id})`);

    this.broadcastOnlineUsers();
  }

  @SubscribeMessage('call:incoming')
  async handleIncomingCall(
    @MessageBody() data: { callId: string; calleeId: string; callerName?: string },
    @ConnectedSocket() client: Socket,
  ) {
    if (!data?.callId || !data?.calleeId) {
      client.emit('error', { message: 'callId and calleeId required' });
      return;
    }
    // validate that the sender is participant of this call
    const senderId = this.presence.getUserIdBySocketId(client.id);
    if (!senderId) {
      client.emit('error', { message: 'Not authenticated' });
      return;
    }
    try {
      await this.callsService.findById(data.callId, senderId);
    } catch (err) {
      client.emit('error', { message: 'Not authorized for this call' });
      return;
    }

    const calleeSocketId = this.presence.getSocketIdByUserId(data.calleeId);
    if (!calleeSocketId) {
      // let the client know callee is offline; server-side create flow will still emit when callee reconnects
      client.emit('error', { message: 'Callee is not online' });
      return;
    }

    this.logger.log(`Incoming call: ${data.callId} to ${data.calleeId}`);
    this.server.to(calleeSocketId).emit('call:incoming', {
      callId: data.callId,
      callerId: senderId,
      callerName: data.callerName,
    });
  }

  @SubscribeMessage('call:rejected')
  async handleCallRejected(
    @MessageBody() data: { callId: string; callerId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const senderId = this.presence.getUserIdBySocketId(client.id);
    if (!senderId) {
      client.emit('error', { message: 'Not authenticated' });
      return;
    }
    try {
      await this.callsService.findById(data.callId, senderId);
    } catch (err) {
      client.emit('error', { message: 'Not authorized for this call' });
      return;
    }

    const callerSocketId = this.presence.getSocketIdByUserId(data.callerId);
    if (callerSocketId) {
      this.logger.log(`Call rejected: ${data.callId}`);
      this.server.to(callerSocketId).emit('call:rejected', {
        callId: data.callId,
      });
    }
  }

  @SubscribeMessage('call:accepted')
  async handleCallAccepted(
    @MessageBody() data: { callId: string; callerId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const senderId = this.presence.getUserIdBySocketId(client.id);
    if (!senderId) {
      client.emit('error', { message: 'Not authenticated' });
      return;
    }
    try {
      await this.callsService.findById(data.callId, senderId);
    } catch (err) {
      client.emit('error', { message: 'Not authorized for this call' });
      return;
    }

    const callerSocketId = this.presence.getSocketIdByUserId(data.callerId);
    if (callerSocketId) {
      this.logger.log(`Call accepted: ${data.callId}`);
      this.server.to(callerSocketId).emit('call:accepted', {
        callId: data.callId,
      });
    }
  }

  @SubscribeMessage('webrtc:offer')
  async handleOffer(
    @MessageBody() data: WebRTCOffer,
    @ConnectedSocket() client: Socket,
  ) {
    if (!data?.callId || !data?.targetUserId || !data?.offer) {
      client.emit('error', { message: 'callId, targetUserId and offer required' });
      return;
    }

    const senderId = this.presence.getUserIdBySocketId(client.id);
    if (!senderId) {
      client.emit('error', { message: 'Not authenticated' });
      return;
    }
    try {
      await this.callsService.findById(data.callId, senderId);
    } catch (err) {
      client.emit('error', { message: 'Not authorized for this call' });
      return;
    }

    const targetSocketId = this.presence.getSocketIdByUserId(data.targetUserId);
    if (!targetSocketId) {
      client.emit('error', { message: 'Target user is not online' });
      return;
    }

    this.logger.debug(`WebRTC offer: ${data.callId} from ${senderId} to ${data.targetUserId}`);

    this.server.to(targetSocketId).emit('webrtc:offer', {
      callId: data.callId,
      senderId,
      offer: data.offer,
    });
  }

  @SubscribeMessage('webrtc:answer')
  async handleAnswer(
    @MessageBody() data: WebRTCAnswer,
    @ConnectedSocket() client: Socket,
  ) {
    if (!data?.callId || !data?.targetUserId || !data?.answer) {
      client.emit('error', { message: 'callId, targetUserId and answer required' });
      return;
    }

    const senderId = this.presence.getUserIdBySocketId(client.id);
    if (!senderId) {
      client.emit('error', { message: 'Not authenticated' });
      return;
    }
    try {
      await this.callsService.findById(data.callId, senderId);
    } catch (err) {
      client.emit('error', { message: 'Not authorized for this call' });
      return;
    }

    const targetSocketId = this.presence.getSocketIdByUserId(data.targetUserId);
    if (!targetSocketId) {
      client.emit('error', { message: 'Target user is not online' });
      return;
    }

    this.logger.debug(`WebRTC answer: ${data.callId} from ${senderId} to ${data.targetUserId}`);

    this.server.to(targetSocketId).emit('webrtc:answer', {
      callId: data.callId,
      senderId,
      answer: data.answer,
    });
  }

  @SubscribeMessage('webrtc:ice-candidate')
  async handleIce(
    @MessageBody() data: ICECandidate,
    @ConnectedSocket() client: Socket,
  ) {
    if (!data?.callId || !data?.targetUserId || !data?.candidate) {
      client.emit('error', { message: 'callId, targetUserId and candidate required' });
      return;
    }

    const senderId = this.presence.getUserIdBySocketId(client.id);
    if (!senderId) {
      client.emit('error', { message: 'Not authenticated' });
      return;
    }
    try {
      await this.callsService.findById(data.callId, senderId);
    } catch (err) {
      client.emit('error', { message: 'Not authorized for this call' });
      return;
    }

    const targetSocketId = this.presence.getSocketIdByUserId(data.targetUserId);
    if (!targetSocketId) {
      // Silently ignore if target is offline
      return;
    }

    this.server.to(targetSocketId).emit('webrtc:ice-candidate', {
      callId: data.callId,
      senderId,
      candidate: data.candidate,
    });
  }

  private broadcastOnlineUsers() {
    const onlineUserIds = this.presence.getOnlineUserIds();
    this.logger.debug(`Broadcasting online users: ${onlineUserIds.length}`);
    this.server.emit('users:online', { userIds: onlineUserIds });
  }
}
