import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { WsPresenceService } from '../ws/ws-presence.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import * as bcrypt from 'bcrypt';
import { AddToBlacklistDto } from './dto/manage-blacklist.dto';
import { UpdatePrivacyDto } from './dto/update-privacy.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';
import * as crypto from 'crypto';
import { AddContactDto } from './dto/manage-contacts.dto';
import { SecurityService } from '../auth/security.service';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private auth: AuthService,
    private presence: WsPresenceService,
    private security: SecurityService,
  ) {}

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        username: true,
        avatarUrl: true,
        createdAt: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async findAll() {
    const users = await this.prisma.user.findMany({
      select: {
        id: true,
        username: true,
        createdAt: true,
      },
    });

    const onlineSet = new Set(this.presence.getOnlineUserIds());
    return users.map((user) => ({
      ...user,
      online: onlineSet.has(user.id),
    }));
  }

  async updateMe(userId: string, data: UpdateProfileDto) {
    const normalizedUsername = data.username?.trim();
    const normalizedName = data.name?.trim();
    const normalizedAvatarUrl = data.avatarUrl?.trim();

    if (data.username !== undefined && !normalizedUsername) {
      throw new BadRequestException('username cannot be empty');
    }
    if (data.name !== undefined && !normalizedName) {
      throw new BadRequestException('name cannot be empty');
    }
    if (data.avatarUrl !== undefined && !normalizedAvatarUrl) {
      throw new BadRequestException('avatarUrl cannot be empty');
    }

    try {
      return await this.prisma.user.update({
        where: { id: userId },
        data: {
          name: normalizedName,
          username: normalizedUsername,
          avatarUrl: normalizedAvatarUrl,
        },
        select: {
          id: true,
          name: true,
          username: true,
          avatarUrl: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new ConflictException('username already exists');
      }
      throw error;
    }
  }

  async updateAvatar(userId: string, avatarUrl: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
      select: {
        id: true,
        name: true,
        username: true,
        avatarUrl: true,
        updatedAt: true,
      },
    });
  }

  async deleteById(id: string) {
    await this.prisma.user.delete({ where: { id } });
    return { success: true };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    if (dto.oldPassword === dto.newPassword) {
      throw new BadRequestException('new password must be different from old password');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, password: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const oldPasswordValid = await bcrypt.compare(dto.oldPassword, user.password);
    if (!oldPasswordValid) {
      throw new UnauthorizedException('old password is incorrect');
    }

    const newHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: newHash },
    });

    await this.auth.logout(userId, { allDevices: true });
    return { success: true };
  }

  async getSessions(userId: string) {
    return this.auth.listSessions(userId);
  }

  async terminateSession(userId: string, sessionId: string) {
    return this.auth.terminateSession(userId, sessionId);
  }

  async getSecurityActivity(userId: string) {
    return this.auth.getSecurityActivity(userId);
  }

  async getMyPrivacy(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, allowMessagesFrom: true, loginNotifications: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async updateMyPrivacy(userId: string, dto: UpdatePrivacyDto) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { allowMessagesFrom: dto.allowMessagesFrom },
      select: { id: true, allowMessagesFrom: true, loginNotifications: true },
    });
  }

  async getMyBlacklist(userId: string) {
    const rows = await this.prisma.userBlacklist.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        blockedUserId: true,
        createdAt: true,
        blockedUser: {
          select: {
            id: true,
            username: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    });
    return rows;
  }

  async addToMyBlacklist(userId: string, dto: AddToBlacklistDto) {
    if (dto.blockedUserId === userId) {
      throw new BadRequestException('cannot block yourself');
    }

    const targetUser = await this.prisma.user.findUnique({
      where: { id: dto.blockedUserId },
      select: { id: true },
    });
    if (!targetUser) {
      throw new NotFoundException('User to block not found');
    }

    try {
      return await this.prisma.userBlacklist.create({
        data: {
          userId,
          blockedUserId: dto.blockedUserId,
        },
        select: {
          id: true,
          blockedUserId: true,
          createdAt: true,
        },
      });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new ConflictException('user already blocked');
      }
      throw error;
    }
  }

  async removeFromMyBlacklist(userId: string, blockedUserId: string) {
    await this.prisma.userBlacklist.deleteMany({
      where: { userId, blockedUserId },
    });
    return { success: true };
  }

  async getMyContacts(userId: string) {
    return this.prisma.contact.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        contactUserId: true,
        createdAt: true,
        contactUser: {
          select: {
            id: true,
            username: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    });
  }

  async addMyContact(userId: string, dto: AddContactDto) {
    if (dto.contactUserId === userId) {
      throw new BadRequestException('cannot add yourself to contacts');
    }

    const target = await this.prisma.user.findUnique({
      where: { id: dto.contactUserId },
      select: { id: true },
    });
    if (!target) {
      throw new NotFoundException('Contact user not found');
    }

    try {
      return await this.prisma.contact.create({
        data: {
          userId,
          contactUserId: dto.contactUserId,
        },
        select: {
          id: true,
          contactUserId: true,
          createdAt: true,
        },
      });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new ConflictException('contact already exists');
      }
      throw error;
    }
  }

  async requestDeleteAccountCode(userId: string) {
    const code = await this.security.issueDeleteAccountCode(userId);
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

  async removeMyContact(userId: string, contactUserId: string) {
    await this.prisma.contact.deleteMany({
      where: { userId, contactUserId },
    });
    return { success: true };
  }

  async exportMyAccount(userId: string, includeMessages: boolean) {
    const profile = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        username: true,
        avatarUrl: true,
        email: true,
        phone: true,
        createdAt: true,
        updatedAt: true,
        allowMessagesFrom: true,
        loginNotifications: true,
      },
    });
    if (!profile) {
      throw new NotFoundException('User not found');
    }

    const chats = await this.prisma.chatMember.findMany({
      where: { userId },
      orderBy: { chat: { updatedAt: 'desc' } },
      select: {
        chat: {
          select: {
            id: true,
            type: true,
            title: true,
            createdAt: true,
            updatedAt: true,
            members: {
              select: {
                user: {
                  select: {
                    id: true,
                    username: true,
                    name: true,
                    avatarUrl: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const chatIds = chats.map((item) => item.chat.id);
    const messages = includeMessages
      ? await this.prisma.chatMessage.findMany({
          where: { chatId: { in: chatIds } },
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            chatId: true,
            senderId: true,
            content: true,
            createdAt: true,
            editedAt: true,
            deletedAt: true,
          },
        })
      : undefined;

    return {
      exportedAt: new Date().toISOString(),
      profile,
      chats: chats.map((item) => ({
        ...item.chat,
        members: item.chat.members.map((member) => member.user),
      })),
      ...(includeMessages ? { messages } : {}),
    };
  }

  async deleteMe(userId: string, dto: DeleteAccountDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, password: true, deletedAt: true },
    });
    if (!user) throw new NotFoundException('User not found');
    if (user.deletedAt) {
      return { success: true };
    }

    const pwd = dto.password?.trim();
    const code = dto.confirmationCode?.trim();
    if (pwd && code) {
      throw new BadRequestException('provide either password or confirmation code, not both');
    }
    if (!pwd && !code) {
      throw new BadRequestException('password or confirmation code is required');
    }

    if (code) {
      const okCode = await this.security.checkDeleteAccountCode(userId, code);
      if (!okCode) {
        throw new UnauthorizedException('invalid or expired confirmation code');
      }
    } else if (pwd) {
      const ok = await bcrypt.compare(pwd, user.password);
      if (!ok) {
        throw new UnauthorizedException('password is incorrect');
      }
    }

    const deletionTag = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
    const anonymizedUsername = `deleted_${deletionTag}`;
    const now = new Date();
    const randomPassword = crypto.randomBytes(32).toString('hex');
    const randomHash = await bcrypt.hash(randomPassword, 10);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        deletedAt: now,
        username: anonymizedUsername,
        name: null,
        avatarUrl: null,
        email: null,
        phone: null,
        password: randomHash,
        allowMessagesFrom: 'NOBODY',
        loginNotifications: false,
      },
    });

    await this.auth.logout(userId, { allDevices: true });
    return { success: true, deletedAt: now.toISOString() };
  }
}
