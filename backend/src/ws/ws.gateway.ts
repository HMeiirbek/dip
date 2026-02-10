import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ cors: true })
export class WsGateway {
  @WebSocketServer()
  server: Server;

  @SubscribeMessage('webrtc:offer')
  handleOffer(@MessageBody() data: unknown, @ConnectedSocket() client: Socket) {
    // Log offer for debugging
    console.log(`webrtc:offer from ${client.id}:`, JSON.stringify(data));
    this.server.emit('webrtc:offer', data);
  }

  @SubscribeMessage('webrtc:answer')
  handleAnswer(@MessageBody() data: unknown, @ConnectedSocket() client: Socket) {
    console.log(`webrtc:answer from ${client.id}:`, JSON.stringify(data));
    this.server.emit('webrtc:answer', data);
  }

  @SubscribeMessage('webrtc:ice-candidate')
  handleIce(@MessageBody() data: unknown, @ConnectedSocket() client: Socket) {
    console.log(`webrtc:ice-candidate from ${client.id}:`, JSON.stringify(data));
    this.server.emit('webrtc:ice-candidate', data);
  }
}
