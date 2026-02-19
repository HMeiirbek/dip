import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AuthModule } from '../auth/auth.module';
import { CallsModule } from '../calls/calls.module';
import { BlacklistModule } from '../blacklist/blacklist.module';

@Module({
  imports: [AuthModule, CallsModule, BlacklistModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
