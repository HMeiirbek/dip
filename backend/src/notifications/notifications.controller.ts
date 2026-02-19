import { Controller, Get, Param, Put, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @ApiOperation({ summary: 'List Notifications' })
  @Get()
  async list(@Req() req: { user: { sub: string } }) {
    return this.notifications.list(req.user.sub);
  }

  @ApiOperation({ summary: 'Mark Notification Read' })
  @Put(':id/read')
  async markRead(
    @Req() req: { user: { sub: string } },
    @Param('id') id: string,
  ) {
    return this.notifications.markRead(req.user.sub, id);
  }
}
