import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ChatType, PrivacyWriteMode } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateChatDto } from './dto/create-chat.dto';
import { SendChatMessageDto } from './dto/send-chat-message.dto';
import { MarkChatReadDto } from './dto/mark-chat-read.dto';

@Injectable()
export class ChatsService {
  constructor(private readonly prisma: PrismaService) {}

  async search(userId: string, query: string) {
    const q = query.trim();

    const [users, groups] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          id: { not: userId },
          deletedAt: null,
          username: {
            contains: q,
            mode: 'insensitive',
          },
        },
        take: 20,
        orderBy: { username: 'asc' },
        select: {
          id: true,
          username: true,
          name: true,
          avatarUrl: true,
        },
      }),
      this.prisma.chat.findMany({
        where: {
          type: ChatType.GROUP,
          title: {
            contains: q,
            mode: 'insensitive',
          },
          members: {
            some: { userId },
          },
        },
        take: 20,
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          type: true,
          title: true,
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
      }),
    ]);

    return {
      users,
      groups: groups.map((group) => ({
        ...group,
        members: group.members.map((member) => member.user),
      })),
    };
  }

  async createChat(userId: string, dto: CreateChatDto) {
    const uniqueMemberIds = Array.from(new Set([userId, ...dto.memberIds]));
    if (dto.type === ChatType.PRIVATE && uniqueMemberIds.length !== 2) {
      throw new BadRequestException('private chat must contain exactly 2 unique members');
    }
    if (dto.type === ChatType.GROUP && uniqueMemberIds.length < 2) {
      throw new BadRequestException('group chat must contain at least 2 unique members');
    }
    if (dto.type === ChatType.GROUP && !dto.title?.trim()) {
      throw new BadRequestException('group chat title is required');
    }

    const users = await this.prisma.user.findMany({
      where: { id: { in: uniqueMemberIds }, deletedAt: null },
      select: { id: true },
    });
    if (users.length !== uniqueMemberIds.length) {
      throw new NotFoundException('one or more chat members not found');
    }

    if (dto.type === ChatType.PRIVATE) {
      const existing = await this.findExistingPrivateChat(uniqueMemberIds);
      if (existing) {
        return existing;
      }
    }

    const chat = await this.prisma.chat.create({
      data: {
        type: dto.type,
        title: dto.type === ChatType.GROUP ? dto.title?.trim() : null,
        ownerId: dto.type === ChatType.GROUP ? userId : null,
        members: {
          create: uniqueMemberIds.map((memberId) => ({
            userId: memberId,
          })),
        },
      },
      select: {
        id: true,
        type: true,
        title: true,
        ownerId: true,
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
    });

    return {
      ...chat,
      members: chat.members.map((member) => member.user),
    };
  }

  async listChats(userId: string) {
    const memberships = await this.prisma.chatMember.findMany({
      where: { userId },
      orderBy: { chat: { updatedAt: 'desc' } },
      select: {
        chatId: true,
        lastReadMessageId: true,
        chat: {
          select: {
            id: true,
            type: true,
            title: true,
            ownerId: true,
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
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: {
                id: true,
                content: true,
                createdAt: true,
                senderId: true,
              },
            },
          },
        },
      },
    });

    const messageIds = memberships
      .map((membership) => membership.lastReadMessageId)
      .filter((value): value is string => Boolean(value));

    const readMessages = messageIds.length
      ? await this.prisma.chatMessage.findMany({
          where: { id: { in: messageIds } },
          select: { id: true, createdAt: true },
        })
      : [];

    const readMessageMap = new Map(readMessages.map((message) => [message.id, message.createdAt]));

    const unreadCounts = await Promise.all(
      memberships.map(async (membership) => {
        const lastReadAt = membership.lastReadMessageId
          ? readMessageMap.get(membership.lastReadMessageId)
          : undefined;
        return this.prisma.chatMessage.count({
          where: {
            chatId: membership.chatId,
            senderId: { not: userId },
            ...(lastReadAt ? { createdAt: { gt: lastReadAt } } : {}),
          },
        });
      }),
    );

    return memberships.map((membership, index) => {
      const members = membership.chat.members.map((member) => member.user);
      const otherUser = members.find((member) => member.id !== userId) || null;
      const lastMessage = membership.chat.messages[0] || null;

      return {
        id: membership.chat.id,
        type: membership.chat.type,
        title:
          membership.chat.type === ChatType.GROUP
            ? membership.chat.title
            : otherUser?.name || otherUser?.username || null,
        ownerId: membership.chat.type === ChatType.GROUP ? membership.chat.ownerId : null,
        createdAt: membership.chat.createdAt,
        updatedAt: membership.chat.updatedAt,
        members,
        lastMessage,
        unreadCount: unreadCounts[index],
      };
    });
  }

  async addGroupMember(actorId: string, chatId: string, memberId: string) {
    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
      select: {
        id: true,
        type: true,
        ownerId: true,
        members: { select: { userId: true } },
      },
    });
    if (!chat || chat.type !== ChatType.GROUP) {
      throw new BadRequestException('only group chats support adding members');
    }
    if (chat.ownerId !== actorId) {
      throw new ForbiddenException('only the group owner can add members');
    }
    const memberIds = chat.members.map((m) => m.userId);
    if (memberIds.includes(memberId)) {
      throw new ConflictException('user is already a member');
    }
    const nextMemberIds = [...memberIds, memberId];
    for (const senderId of nextMemberIds) {
      const others = nextMemberIds.filter((id) => id !== senderId);
      await this.assertMessagingAllowed(senderId, others);
    }

    await this.prisma.chatMember.create({
      data: { userId: memberId, chatId },
    });
    await this.prisma.chat.update({
      where: { id: chatId },
      data: { updatedAt: new Date() },
    });
    return { success: true as const, chatId, memberId };
  }

  async removeGroupMember(actorId: string, chatId: string, targetUserId: string) {
    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
      select: {
        id: true,
        type: true,
        ownerId: true,
        members: { select: { userId: true } },
      },
    });
    if (!chat || chat.type !== ChatType.GROUP) {
      throw new BadRequestException('only group chats support removing members');
    }
    const memberIds = chat.members.map((m) => m.userId);
    if (!memberIds.includes(targetUserId)) {
      throw new NotFoundException('user is not in this chat');
    }
    const removingSelf = targetUserId === actorId;
    const isOwner = chat.ownerId === actorId;
    if (!removingSelf && !isOwner) {
      throw new ForbiddenException('only the owner can remove other members');
    }
    if (removingSelf && chat.ownerId === actorId && memberIds.length > 1) {
      const nextOwner = memberIds.find((id) => id !== targetUserId);
      if (nextOwner) {
        await this.prisma.chat.update({
          where: { id: chatId },
          data: { ownerId: nextOwner },
        });
      }
    }

    await this.prisma.chatMember.delete({
      where: {
        chat_member_user_chat_unique: {
          userId: targetUserId,
          chatId,
        },
      },
    });
    await this.prisma.chat.update({
      where: { id: chatId },
      data: { updatedAt: new Date() },
    });
    return { success: true as const, chatId, removedUserId: targetUserId };
  }

  async getMessages(userId: string, chatId: string) {
    await this.assertChatMember(chatId, userId);

    return this.prisma.chatMessage.findMany({
      where: { chatId },
      orderBy: { createdAt: 'asc' },
      take: 200,
      select: {
        id: true,
        chatId: true,
        senderId: true,
        content: true,
        createdAt: true,
        editedAt: true,
        deletedAt: true,
        sender: {
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

  async sendMessage(userId: string, chatId: string, dto: SendChatMessageDto) {
    const membership = await this.assertChatMember(chatId, userId);
    const memberIds = membership.chat.members.map((member) => member.userId);

    await this.assertMessagingAllowed(userId, memberIds);

    const message = await this.prisma.chatMessage.create({
      data: {
        chatId,
        senderId: userId,
        content: dto.content.trim(),
      },
      select: {
        id: true,
        chatId: true,
        senderId: true,
        content: true,
        createdAt: true,
        sender: {
          select: {
            id: true,
            username: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    });

    await this.prisma.chat.update({
      where: { id: chatId },
      data: { updatedAt: new Date() },
    });

    return message;
  }

  async markAsRead(userId: string, chatId: string, dto: MarkChatReadDto) {
    await this.assertChatMember(chatId, userId);

    const message = await this.prisma.chatMessage.findFirst({
      where: {
        id: dto.messageId,
        chatId,
      },
      select: { id: true },
    });
    if (!message) {
      throw new NotFoundException('message not found in this chat');
    }

    await this.prisma.chatMember.update({
      where: {
        chat_member_user_chat_unique: {
          userId,
          chatId,
        },
      },
      data: {
        lastReadMessageId: dto.messageId,
      },
    });

    return { success: true, chatId, messageId: dto.messageId };
  }

  private async assertChatMember(chatId: string, userId: string) {
    const membership = await this.prisma.chatMember.findUnique({
      where: {
        chat_member_user_chat_unique: {
          userId,
          chatId,
        },
      },
      select: {
        userId: true,
        chatId: true,
        chat: {
          select: {
            id: true,
            type: true,
            members: {
              select: {
                userId: true,
              },
            },
          },
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException('access to chat denied');
    }

    return membership;
  }

  private async assertMessagingAllowed(senderId: string, memberIds: string[]) {
    const otherMemberIds = memberIds.filter((memberId) => memberId !== senderId);
    if (otherMemberIds.length === 0) {
      return;
    }

    const otherUsers = await this.prisma.user.findMany({
      where: { id: { in: otherMemberIds } },
      select: { id: true, allowMessagesFrom: true },
    });

    const blacklists = await this.prisma.userBlacklist.findMany({
      where: {
        OR: [
          { userId: { in: otherMemberIds }, blockedUserId: senderId },
          { userId: senderId, blockedUserId: { in: otherMemberIds } },
        ],
      },
      select: { userId: true, blockedUserId: true },
    });

    const blockedByOthers = new Set(
      blacklists.filter((entry) => entry.blockedUserId === senderId).map((entry) => entry.userId),
    );
    const blockedBySender = new Set(
      blacklists.filter((entry) => entry.userId === senderId).map((entry) => entry.blockedUserId),
    );

    for (const otherUser of otherUsers) {
      if (blockedByOthers.has(otherUser.id) || blockedBySender.has(otherUser.id)) {
        throw new ConflictException('message cannot be sent because one of the users is blocked');
      }
      if (otherUser.allowMessagesFrom === PrivacyWriteMode.NOBODY) {
        throw new ForbiddenException('recipient does not allow incoming messages');
      }
      if (otherUser.allowMessagesFrom === PrivacyWriteMode.CONTACTS_ONLY) {
        const hasContact = await this.prisma.contact.findFirst({
          where: {
            userId: otherUser.id,
            contactUserId: senderId,
          },
          select: { id: true },
        });
        if (!hasContact) {
          throw new ForbiddenException('recipient allows messages only from contacts');
        }
      }
    }
  }

  private async findExistingPrivateChat(memberIds: string[]) {
    const chats = await this.prisma.chat.findMany({
      where: {
        type: ChatType.PRIVATE,
        members: {
          every: {
            userId: { in: memberIds },
          },
        },
      },
      select: {
        id: true,
        type: true,
        title: true,
        ownerId: true,
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
    });

    const exactMatch = chats.find((chat) => chat.members.length === memberIds.length);
    if (!exactMatch) {
      return null;
    }

    return {
      ...exactMatch,
      members: exactMatch.members.map((member) => member.user),
    };
  }
}
