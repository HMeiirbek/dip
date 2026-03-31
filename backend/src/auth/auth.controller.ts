import { Body, Controller, Post, Get, UseGuards, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @ApiOperation({ summary: 'Register User' })
  @Post('register')
  async register(
    @Body('username') username: string,
    @Body('password') password: string,
  ) {
    return this.auth.register(username, password);
  }

  @ApiOperation({ summary: 'Login User' })
  @Post('login')
  async login(
    @Req() req: {
      headers: Record<string, string | string[] | undefined>;
      ip?: string;
      socket?: { remoteAddress?: string };
    },
    @Body('username') username: string,
    @Body('password') password: string,
  ) {
    return this.auth.login(username, password, this.extractClientMeta(req));
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout User' })
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(
    @Req() req: { user: { sub: string; sid?: string } },
    @Body('refreshToken') refreshToken?: string,
    @Body('allDevices') allDevices?: boolean,
  ) {
    return this.auth.logout(req.user.sub, {
      refreshToken,
      allDevices,
      sessionId: req.user.sid,
    });
  }

  @ApiOperation({ summary: 'Refresh Access Token' })
  @Post('refresh')
  async refresh(
    @Req() req: {
      headers: Record<string, string | string[] | undefined>;
      ip?: string;
      socket?: { remoteAddress?: string };
    },
    @Body('refreshToken') refreshToken: string,
  ) {
    return this.auth.refresh(refreshToken, this.extractClientMeta(req));
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Request Verify Code' })
  @UseGuards(JwtAuthGuard)
  @Post('verify/request')
  async requestVerifyCode(@Req() req: { user: { sub: string } }) {
    return this.auth.requestVerifyCode(req.user.sub);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify Account (Email/2FA)' })
  @UseGuards(JwtAuthGuard)
  @Post('verify')
  async verify(
    @Req() req: { user: { sub: string } },
    @Body('code') code: string,
  ) {
    return this.auth.verify(req.user.sub, code);
  }

  @ApiOperation({ summary: 'Forgot Password' })
  @Post('forgot-password')
  async forgotPassword(
    @Body('identifier') identifier: string,
  ) {
    return this.auth.forgotPassword(identifier);
  }

  @ApiOperation({ summary: 'Reset Password' })
  @Post('reset-password')
  async resetPassword(
    @Body('identifier') identifier: string,
    @Body('code') code: string,
    @Body('newPassword') newPassword: string,
  ) {
    return this.auth.resetPassword(identifier, code, newPassword);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get Current User' })
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Req() req: { user: { sub: string } }) {
    console.log('[Auth] /me requested by user:', req.user.sub);
    return this.auth.getUserById(req.user.sub);
  }

  private extractClientMeta(req: {
    headers: Record<string, string | string[] | undefined>;
    ip?: string;
    socket?: { remoteAddress?: string };
  }) {
    const deviceInfo = this.readHeader(req.headers, 'x-device-info');
    const userAgent = this.readHeader(req.headers, 'user-agent');
    const xff = this.readHeader(req.headers, 'x-forwarded-for');
    const ipAddress = xff?.split(',')[0]?.trim() || req.ip || req.socket?.remoteAddress || 'unknown';
    return { deviceInfo, userAgent, ipAddress };
  }

  private readHeader(
    headers: Record<string, string | string[] | undefined>,
    key: string,
  ) {
    const value = headers[key];
    if (Array.isArray(value)) return value[0] || '';
    return value || '';
  }
}
