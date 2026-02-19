import { Body, Controller, Post, Put, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SettingsService } from './settings.service';

@ApiTags('settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @ApiOperation({ summary: 'Update Settings' })
  @Put()
  async updateGeneral(
    @Req() req: { user: { sub: string } },
    @Body('username') username?: string,
  ) {
    return this.settings.updateGeneral(req.user.sub, { username });
  }

  @ApiOperation({ summary: 'Update Security Settings' })
  @Put('security')
  async updateSecurity() {
    return this.settings.updateSecurity();
  }

  @ApiOperation({ summary: 'Update Notification Settings' })
  @Put('notifications')
  async updateNotifications() {
    return this.settings.updateNotifications();
  }

  @ApiOperation({ summary: 'Generate API Key' })
  @Post('api-key')
  async createApiKey() {
    return this.settings.createApiKey();
  }
}
