import {
  ConflictException,
  Injectable,
  UnauthorizedException,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AppRole, SecurityService } from './security.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private security: SecurityService,
    private notifications: NotificationsService,
  ) {}

  async register(username: string, password: string) {
    const normalizedUsername = username?.trim();
    if (!normalizedUsername || !password) {
      throw new BadRequestException('Username and password required');
    }
    this.validatePassword(password);
    const hash = await bcrypt.hash(password, 10);
    try {
      const user = await this.prisma.user.create({
        data: { username: normalizedUsername, password: hash },
      });
      const role = await this.security.resolveRole(user.id, user.username);
      return { id: user.id, username: user.username, role };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Username already exists');
      }
      throw e;
    }
  }

  async login(
    username: string,
    password: string,
    meta?: { deviceInfo?: string; userAgent?: string; ipAddress?: string },
  ) {
    const ipAddress = meta?.ipAddress || '';
    if (ipAddress && this.security.isIpBlocked(ipAddress)) {
      throw new HttpException('Too many failed login attempts. Try again later.', HttpStatus.TOO_MANY_REQUESTS);
    }

    const normalizedUsername = username?.trim();
    if (!normalizedUsername || !password) {
      throw new BadRequestException('Username and password required');
    }
    const user = await this.prisma.user.findUnique({ where: { username: normalizedUsername } });

    if (!user) {
      if (ipAddress) {
        const { blocked, justBlocked } = this.security.recordFailedLoginAttempt(ipAddress);
        if (justBlocked) {
          await this.notifySecurityTeam(ipAddress);
        }
      }
      throw new UnauthorizedException('Authentication failed');
    }

    if (this.security.isUserBlocked(user.id)) {
      throw new UnauthorizedException('Account temporarily blocked due to security incident');
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      if (ipAddress) {
        const { blocked, justBlocked } = this.security.recordFailedLoginAttempt(ipAddress);
        await this.security.logActivity(user.id, {
          action: 'login_failure',
          at: new Date(),
          ipAddress,
          deviceInfo: meta?.deviceInfo,
        });
        if (justBlocked) {
          await this.notifySecurityTeam(ipAddress);
        }
      }
      throw new UnauthorizedException('Authentication failed');
    }

    if (ipAddress) {
      this.security.clearFailedLoginAttempts(ipAddress);
    }

    const role = await this.security.resolveRole(user.id, user.username);
    const { session, refreshToken } = await this.security.createSession({
      userId: user.id,
      role,
      deviceInfo: meta?.deviceInfo,
      userAgent: meta?.userAgent,
      ipAddress: meta?.ipAddress,
    });
    await this.notifyUserLoginIfEnabled(user.id, {
      ipAddress: meta?.ipAddress,
      deviceInfo: meta?.deviceInfo,
    });

    return this.buildAuthResponse(user.id, role, session.id, refreshToken);
  }

  async logout(
    userId: string,
    options?: {
      refreshToken?: string;
      allDevices?: boolean;
      sessionId?: string;
    },
  ) {
    if (options?.allDevices) {
      const revoked = await this.security.revokeAll(userId);
      return { success: true, revoked };
    }

    if (options?.refreshToken) {
      const revoked = await this.security.revokeByRefreshToken(userId, options.refreshToken);
      return { success: true, revoked };
    }

    if (options?.sessionId) {
      const revoked = await this.security.revokeBySessionId(userId, options.sessionId);
      return { success: true, revoked };
    }

    return { success: true, revoked: 0 };
  }

  async refresh(
    refreshToken: string,
    meta?: { deviceInfo?: string; userAgent?: string; ipAddress?: string },
  ) {
    if (!refreshToken?.trim()) {
      throw new UnauthorizedException('Refresh token required');
    }
    const rotated = await this.security.rotateRefreshToken(refreshToken, meta);
    if (!rotated) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return this.buildAuthResponse(
      rotated.session.userId,
      rotated.session.role,
      rotated.session.id,
      rotated.refreshToken,
    );
  }

  async requestVerifyCode(userId: string) {
    const code = await this.security.issueVerifyCode(userId);
    const response: Record<string, unknown> = {
      success: true,
      delivery: 'out-of-band',
      expiresInSec: 600,
    };
    if (process.env.AUTH_DEBUG_CODES === 'true') {
      response.code = code;
    }
    return response;
  }

  async verify(userId: string, code: string) {
    if (!code?.trim()) {
      throw new BadRequestException('Verification code required');
    }
    if (!(await this.security.checkVerifyCode(userId, code))) {
      throw new BadRequestException('Invalid or expired verification code');
    }
    return { success: true };
  }

  async forgotPassword(identifier: string) {
    if (!identifier?.trim()) {
      throw new BadRequestException('Identifier is required');
    }
    const user = await this.prisma.user.findUnique({
      where: { username: identifier },
    });

    if (!user) {
      return { success: true };
    }

    const code = await this.security.issueResetCode(user.id);
    const response: Record<string, unknown> = {
      success: true,
      delivery: 'out-of-band',
      expiresInSec: 600,
    };
    if (process.env.AUTH_DEBUG_CODES === 'true') {
      response.code = code;
    }
    return response;
  }

  async resetPassword(identifier: string, code: string, newPassword: string) {
    if (!identifier?.trim() || !newPassword?.trim() || !code?.trim()) {
      throw new BadRequestException('Identifier, code and new password required');
    }

    this.validatePassword(newPassword);

    const hash = await bcrypt.hash(newPassword, 10);
    const user = await this.prisma.user.findUnique({
      where: { username: identifier },
    });
    if (!user) throw new UnauthorizedException();
    if (!(await this.security.checkResetCode(user.id, code))) {
      throw new UnauthorizedException('Invalid or expired reset code');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { password: hash },
    });
    return { success: true };
  }

  async getUserById(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new UnauthorizedException();
    return {
      id: user.id,
      username: user.username,
      role: await this.security.resolveRole(user.id, user.username),
      verified: await this.security.isVerified(user.id),
    };
  }

  async listSessions(userId: string) {
    return this.security.listSessions(userId);
  }

  async terminateSession(userId: string, sessionId: string) {
    const revoked = await this.security.revokeBySessionId(userId, sessionId);
    return { success: true, revoked };
  }

  async getSecurityActivity(userId: string) {
    return this.security.getSecurityActivity(userId);
  }

  async setRole(userId: string, role: AppRole) {
    await this.security.setRole(userId, role);
    return { success: true, userId, role };
  }

  private async notifySecurityTeam(ipAddress: string) {
    const userIds = await this.security.getAdminAndModeratorUserIds();
    const message = `IP ${ipAddress} blocked for 30 minutes after excessive failed login attempts.`;
    for (const userId of userIds) {
      this.notifications.seed(userId, 'security', message);
    }
  }

  private async notifyUserLoginIfEnabled(
    userId: string,
    input: { ipAddress?: string; deviceInfo?: string },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { loginNotifications: true },
    });
    if (!user?.loginNotifications) {
      return;
    }

    const ip = input.ipAddress || 'unknown ip';
    const device = input.deviceInfo || 'unknown device';
    const message = `New login: ${new Date().toISOString()} | IP: ${ip} | Device: ${device}`;
    await this.notifications.seed(userId, 'security_login', message);
  }

  private buildAuthResponse(
    userId: string,
    role: AppRole,
    sessionId: string,
    refreshToken: string,
  ) {
    const secretLength = (process.env.JWT_SECRET || 'secret').length;
    console.log('[AuthService] Building token for user:', userId, 'using secret length:', secretLength);
    return {
      accessToken: this.jwt.sign({
        sub: userId,
        role,
        sid: sessionId,
      }),
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: 60 * 15,
      sessionId,
      role,
    };
  }

  private validatePassword(password: string) {
    const minLength = 8;
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

    if (password.length < minLength || !hasUppercase || !hasLowercase || !hasNumber || !hasSpecialChar) {
      throw new BadRequestException(
        'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character.',
      );
    }
  }
}
