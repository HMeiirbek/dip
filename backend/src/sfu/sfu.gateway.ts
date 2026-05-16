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
import { SfuService } from './sfu.service';
import { UseGuards } from '@nestjs/common';
// Depending on auth strategy, you might need a WS guard.
// import { WsJwtGuard } from '../auth/ws-jwt.guard';

@WebSocketGateway({
  cors: { origin: '*' },
})
export class SfuGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private readonly sfuService: SfuService) {}

  private peerToRoom = new Map<string, string>();

  async handleConnection(client: Socket) {
    console.log(`[SFU] Client connected: ${client.id}`);
  }

  async handleDisconnect(client: Socket) {
    console.log(`[SFU] Client disconnected: ${client.id}`);
    const roomId = this.peerToRoom.get(client.id);
    if (roomId) {
      client.leave(roomId);
      this.server.to(roomId).emit('peerDisconnected', { peerId: client.id });
      this.peerToRoom.delete(client.id);
    }
    await this.sfuService.removePeer(client.id);
  }

  @SubscribeMessage('joinRoom')
  async joinRoom(@ConnectedSocket() client: Socket, @MessageBody() data: { roomId: string }) {
    client.join(data.roomId);
    this.peerToRoom.set(client.id, data.roomId);
    console.log(`[SFU] Peer ${client.id} joined room ${data.roomId}`);
    return { success: true };
  }

  @SubscribeMessage('getRouterRtpCapabilities')
  async getRouterRtpCapabilities(@MessageBody() data: any) {
    return this.sfuService.getRouterRtpCapabilities();
  }

  @SubscribeMessage('createWebRtcTransport')
  async createWebRtcTransport(@ConnectedSocket() client: Socket) {
    return this.sfuService.createWebRtcTransport(client.id);
  }

  @SubscribeMessage('connectWebRtcTransport')
  async connectWebRtcTransport(@ConnectedSocket() client: Socket, @MessageBody() data: any) {
    return this.sfuService.connectWebRtcTransport(client.id, data.transportId, data.dtlsParameters);
  }

  @SubscribeMessage('produce')
  async produce(@ConnectedSocket() client: Socket, @MessageBody() data: any) {
    const result = await this.sfuService.produce(client.id, data.transportId, data.kind, data.rtpParameters);
    
    // Broadcast to others in the room
    const roomId = this.peerToRoom.get(client.id);
    if (roomId) {
      this.server.to(roomId).except(client.id).emit('newProducer', {
        producerId: result.id,
        peerId: client.id,
        kind: data.kind
      });
    }

    return result;
  }

  @SubscribeMessage('consume')
  async consume(@ConnectedSocket() client: Socket, @MessageBody() data: any) {
    return this.sfuService.consume(client.id, data.transportId, data.producerId, data.rtpCapabilities);
  }
}
