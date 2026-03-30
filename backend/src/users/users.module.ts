import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { AuthModule } from '../auth/auth.module';
import { WsModule } from '../ws/ws.module';

@Module({
  imports: [AuthModule, WsModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
