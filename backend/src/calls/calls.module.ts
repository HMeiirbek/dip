import { Module } from '@nestjs/common';
import { CallsController } from './calls.controller';
import { CallsService } from './calls.service';
import { CallEventsService } from './call-events.service';
import { CallCleanupService } from './call-cleanup.service';

@Module({
  controllers: [CallsController],
  providers: [CallsService, CallEventsService, CallCleanupService],
  exports: [CallsService, CallEventsService],
})
export class CallsModule {}
