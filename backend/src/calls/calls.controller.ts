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
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('calls')
export class CallsController {
  constructor(private calls: CallsService) {}

  @Post()
  async create(
    @Req() req: { user: { sub: string } },
    @Body('calleeId') calleeId: string,
  ) {
    return this.calls.create(req.user.sub, calleeId);
  }

  @Get(':id')
  async get(
    @Req() req: { user: { sub: string } },
    @Param('id') id: string,
  ) {
    return this.calls.findById(id, req.user.sub);
  }

  @Post(':id/end')
  async end(
    @Req() req: { user: { sub: string } },
    @Param('id') id: string,
  ) {
    return this.calls.end(id, req.user.sub);
  }
}
