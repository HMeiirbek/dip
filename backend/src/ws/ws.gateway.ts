import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
} from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({ cors: true })
export class WsGateway {
  @WebSocketServer()
  server: Server;

  @SubscribeMessage('webrtc:offer')
  handleOffer(@MessageBody() data: unknown) {
    this.server.emit('webrtc:offer', data);
  }

  @SubscribeMessage('webrtc:answer')
  handleAnswer(@MessageBody() data: unknown) {
    this.server.emit('webrtc:answer', data);
  }

  @SubscribeMessage('webrtc:ice-candidate')
  handleIce(@MessageBody() data: unknown) {
    this.server.emit('webrtc:ice-candidate', data);
  }
}
