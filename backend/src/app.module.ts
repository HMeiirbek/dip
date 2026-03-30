import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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

@Module({
  imports: [
    ConfigModule.forRoot({ envFilePath: ['.env.local', '.env'] }),
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
  ],
})
export class AppModule {}
