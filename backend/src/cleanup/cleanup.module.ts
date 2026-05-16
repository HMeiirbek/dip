import { Module } from '@nestjs/common';
import { CleanupService } from './cleanup.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [CleanupService],
})
export class CleanupModule {}
