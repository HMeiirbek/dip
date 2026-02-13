import { Module } from '@nestjs/common';
import { WsGateway } from './ws.gateway';
import { CallsModule } from '../calls/calls.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [CallsModule, AuthModule],
  providers: [WsGateway],
  exports: [WsGateway],
})
export class WsModule {}
