import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MessagesService } from './messages.service';

@ApiTags('messages')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('messages')
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @ApiOperation({ summary: 'List Messages' })
  @Get()
  async list(@Req() req: { user: { sub: string } }) {
    return this.messages.list(req.user.sub);
  }

  @ApiOperation({ summary: 'Send Message' })
  @Post()
  async create(
    @Req() req: { user: { sub: string } },
    @Body('receiverId') receiverId: string,
    @Body('message') message: string,
  ) {
    return this.messages.create(req.user.sub, receiverId, message);
  }
}
