import { Module, forwardRef } from '@nestjs/common';
import { SfuService } from './sfu.service';
import { RiskModule } from '../risk/risk.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [forwardRef(() => RiskModule), forwardRef(() => AuthModule)],
  providers: [SfuService],
  exports: [SfuService],
})
export class SfuModule {}
