import { Module } from '@nestjs/common';
import { ChatsController } from './chats.controller';
import { ChatsService } from './chats.service';
import { WsModule } from '../ws/ws.module';
import { AuthModule } from '../auth/auth.module';
import { ChatsGateway } from './chats.gateway';

@Module({
  imports: [WsModule, AuthModule],
  controllers: [ChatsController],
  providers: [ChatsService, ChatsGateway],
})
export class ChatsModule {}
