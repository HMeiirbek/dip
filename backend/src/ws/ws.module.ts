import { Module } from '@nestjs/common';
import { WsGateway } from './ws.gateway';
import { CallsModule } from '../calls/calls.module';
import { AuthModule } from '../auth/auth.module';
import { WsPresenceService } from './ws-presence.service';

@Module({
  imports: [CallsModule, AuthModule],
  providers: [WsGateway, WsPresenceService],
  exports: [WsGateway, WsPresenceService],
})
export class WsModule {}
