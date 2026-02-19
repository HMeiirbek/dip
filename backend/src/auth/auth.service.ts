import {
  ConflictException,
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AppRole, SecurityService } from './security.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private security: SecurityService,
  ) {}

  async register(username: string, password: string) {
    if (!username?.trim() || !password) {
      throw new UnauthorizedException('Username and password required');
    }
    const hash = await bcrypt.hash(password, 10);
    try {
      const user = await this.prisma.user.create({
        data: { username: username.trim(), password: hash },
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
    if (!username || !password) {
      throw new UnauthorizedException('Username and password required');
    }
    const user = await this.prisma.user.findUnique({ where: { username } });
    if (!user) throw new UnauthorizedException();

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) throw new UnauthorizedException();

    const role = await this.security.resolveRole(user.id, user.username);
    const { session, refreshToken } = await this.security.createSession({
      userId: user.id,
      role,
      deviceInfo: meta?.deviceInfo,
      userAgent: meta?.userAgent,
      ipAddress: meta?.ipAddress,
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

  private buildAuthResponse(
    userId: string,
    role: AppRole,
    sessionId: string,
    refreshToken: string,
  ) {
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
}
