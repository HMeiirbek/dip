import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, UseGuards, ValidationPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ChatsService } from './chats.service';
import { CreateChatDto } from './dto/create-chat.dto';
import { SendChatMessageDto } from './dto/send-chat-message.dto';
import { MarkChatReadDto } from './dto/mark-chat-read.dto';
import { SearchChatsDto } from './dto/search-chats.dto';
import { AddChatMemberDto } from './dto/add-chat-member.dto';

@ApiTags('chats')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('chats')
export class ChatsController {
  constructor(private readonly chats: ChatsService) {}

  @ApiOperation({ summary: 'Create Chat' })
  @Post()
  async create(
    @Req() req: { user: { sub: string } },
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: CreateChatDto,
  ) {
    return this.chats.createChat(req.user.sub, dto);
  }

  @ApiOperation({ summary: 'List My Chats' })
  @Get()
  async list(@Req() req: { user: { sub: string } }) {
    return this.chats.listChats(req.user.sub);
  }

  @ApiOperation({ summary: 'Search Users and Groups' })
  @Get('search')
  async search(
    @Req() req: { user: { sub: string } },
    @Query(new ValidationPipe({ whitelist: true, transform: true }))
    query: SearchChatsDto,
  ) {
    return this.chats.search(req.user.sub, query.q);
  }

  @ApiOperation({ summary: 'Add Group Member' })
  @Post(':id/members')
  async addMember(
    @Req() req: { user: { sub: string } },
    @Param('id') chatId: string,
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: AddChatMemberDto,
  ) {
    return this.chats.addGroupMember(req.user.sub, chatId, dto.memberId);
  }

  @ApiOperation({ summary: 'Remove Group Member (or leave)' })
  @Delete(':id/members/:userId')
  async removeMember(
    @Req() req: { user: { sub: string } },
    @Param('id') chatId: string,
    @Param('userId') userId: string,
  ) {
    return this.chats.removeGroupMember(req.user.sub, chatId, userId);
  }

  @ApiOperation({ summary: 'Get Chat Messages' })
  @Get(':id/messages')
  async getMessages(
    @Req() req: { user: { sub: string } },
    @Param('id') chatId: string,
  ) {
    return this.chats.getMessages(req.user.sub, chatId);
  }

  @ApiOperation({ summary: 'Send Chat Message' })
  @Post(':id/messages')
  async sendMessage(
    @Req() req: { user: { sub: string } },
    @Param('id') chatId: string,
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: SendChatMessageDto,
  ) {
    return this.chats.sendMessage(req.user.sub, chatId, dto);
  }

  @ApiOperation({ summary: 'Mark Chat As Read' })
  @Put(':id/read')
  async markRead(
    @Req() req: { user: { sub: string } },
    @Param('id') chatId: string,
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: MarkChatReadDto,
  ) {
    return this.chats.markAsRead(req.user.sub, chatId, dto);
  }
}
