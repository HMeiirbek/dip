import { Controller, Post, Body, UseGuards, Req, Get } from '@nestjs/common';
import { PushService } from './push.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('push')
@Controller('push')
export class PushController {
  constructor(private pushService: PushService) {}

  @Get('vapidPublicKey')
  getVapidPublicKey() {
    return { publicKey: process.env.VAPID_PUBLIC_KEY };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('subscribe')
  async subscribe(@Req() req: any, @Body() subscription: any) {
    return this.pushService.subscribe(req.user.sub, subscription);
  }
}
