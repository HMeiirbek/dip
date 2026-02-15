import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CallsService } from './calls.service';
import { CallEventsService } from './call-events.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('calls')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('calls')
export class CallsController {
  constructor(
    private calls: CallsService,
    private callEvents: CallEventsService,
  ) {}

  @ApiOperation({ summary: 'Create Call' })
  @Post()
  async create(
    @Req() req: { user: { sub: string } },
    @Body('calleeId') calleeId: string,
  ) {
    const call = await this.calls.create(req.user.sub, calleeId);

    // notify via server-side event so WsGateway can forward to callee if online
    this.callEvents.emitIncoming({
      callId: call.id,
      callerId: call.callerId,
      calleeId: call.calleeId,
    });

    return call;
  }

  @ApiOperation({ summary: 'Accept Call' })
  @Post(':id/accept')
  async accept(
    @Req() req: { user: { sub: string } },
    @Param('id') id: string,
  ) {
    return this.calls.accept(id, req.user.sub);
  }

  @ApiOperation({ summary: 'Reject Call' })
  @Post(':id/reject')
  async reject(
    @Req() req: { user: { sub: string } },
    @Param('id') id: string,
  ) {
    return this.calls.reject(id, req.user.sub);
  }

  @ApiOperation({ summary: 'Mark Call Active' })
  @Post(':id/active')
  async markActive(
    @Req() req: { user: { sub: string } },
    @Param('id') id: string,
  ) {
    return this.calls.markActive(id, req.user.sub);
  }

  @ApiOperation({ summary: 'End Call (Only For Tests)' })
  @Post(':id/end')
  async end(
    @Req() req: { user: { sub: string } },
    @Param('id') id: string,
  ) {
    return this.calls.end(id, req.user.sub);
  }

  @ApiOperation({ summary: 'Get My Pending Call' })
  @Get('pending/me')
  async getPending(
    @Req() req: { user: { sub: string } },
  ) {
    return this.calls.getPendingCallForUser(req.user.sub);
  }

  @ApiOperation({ summary: 'Get My Active Call' })
  @Get('active/me')
  async getActive(
    @Req() req: { user: { sub: string } },
  ) {
    return this.calls.getActiveCallForUser(req.user.sub);
  }

  @ApiOperation({ summary: 'Get Call By ID' })
  @Get(':id')
  async get(
    @Req() req: { user: { sub: string } },
    @Param('id') id: string,
  ) {
    return this.calls.findById(id, req.user.sub);
  }
}
