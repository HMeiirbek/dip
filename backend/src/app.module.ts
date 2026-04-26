import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CallsModule } from './calls/calls.module';
import { WsModule } from './ws/ws.module';
import { PrismaModule } from './prisma/prisma.module';
import { RiskModule } from './risk/risk.module';
import { BlacklistModule } from './blacklist/blacklist.module';
import { NotificationsModule } from './notifications/notifications.module';
import { MessagesModule } from './messages/messages.module';
import { SettingsModule } from './settings/settings.module';
import { AdminModule } from './admin/admin.module';
import { MlModule } from './ml/ml.module';
import { ChatsModule } from './chats/chats.module';
import { SupportModule } from './support/support.module';
import { WsThrottlerGuard } from './ws/ws-throttler.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ envFilePath: ['.env.local', '.env'] }),
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 1000,
    }]),
    PrismaModule,
    AuthModule,
    UsersModule,
    CallsModule,
    WsModule,
    RiskModule,
    BlacklistModule,
    NotificationsModule,
    MessagesModule,
    SettingsModule,
    AdminModule,
    MlModule,
    ChatsModule,
    SupportModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: WsThrottlerGuard,
    },
  ],
})
export class AppModule {}
