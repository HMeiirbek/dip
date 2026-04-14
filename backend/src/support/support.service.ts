import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSupportRequestDto } from './dto/create-support-request.dto';

@Injectable()
export class SupportService {
  constructor(private readonly prisma: PrismaService) {}

  async createRequest(userId: string, dto: CreateSupportRequestDto) {
    return this.prisma.supportRequest.create({
      data: {
        userId,
        topic: dto.topic.trim(),
        text: dto.text.trim(),
      },
      select: {
        id: true,
        topic: true,
        text: true,
        status: true,
        createdAt: true,
      },
    });
  }

  async listAllForAdmin() {
    return this.prisma.supportRequest.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true,
        userId: true,
        topic: true,
        text: true,
        status: true,
        createdAt: true,
        user: { select: { username: true } },
      },
    });
  }

  async updateRequestStatus(id: string, status: string) {
    const existing = await this.prisma.supportRequest.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('support request not found');
    }
    return this.prisma.supportRequest.update({
      where: { id },
      data: { status },
      select: {
        id: true,
        userId: true,
        topic: true,
        text: true,
        status: true,
        createdAt: true,
        user: { select: { username: true } },
      },
    });
  }

  getInfoPage(slug: string) {
    if (slug === 'faq') {
      return {
        slug,
        title: 'FAQ',
        content: [
          { q: 'Как начать звонок?', a: 'Откройте список пользователей и нажмите кнопку вызова.' },
          { q: 'Как работают чаты?', a: 'Чаты доступны как вспомогательный канал коммуникации.' },
          { q: 'Как сменить пароль?', a: 'Профиль → безопасность → сменить пароль.' },
        ],
        updatedAt: new Date().toISOString(),
      };
    }
    if (slug === 'terms') {
      return {
        slug,
        title: 'Условия использования',
        content:
          'Используя DIP, вы соглашаетесь не нарушать закон, не выполнять злоупотребления сервисом и соблюдать правила безопасности.',
        updatedAt: new Date().toISOString(),
      };
    }
    if (slug === 'privacy') {
      return {
        slug,
        title: 'Политика конфиденциальности',
        content:
          'DIP хранит только необходимые данные аккаунта и настройки. Вы можете экспортировать данные и удалить аккаунт (с анонимизацией).',
        updatedAt: new Date().toISOString(),
      };
    }
    return null;
  }
}
