import { Module } from '@nestjs/common';
import { RiskController } from './risk.controller';
import { RiskService } from './risk.service';
import { CallsModule } from '../calls/calls.module';
import { BlacklistModule } from '../blacklist/blacklist.module';

@Module({
  imports: [CallsModule, BlacklistModule],
  controllers: [RiskController],
  providers: [RiskService],
  exports: [RiskService],
})
export class RiskModule {}
