import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
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
      return { id: user.id, username: user.username };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Username already exists');
      }
      throw e;
    }
  }

  async login(username: string, password: string) {
    if (!username || !password) {
      throw new UnauthorizedException('Username and password required');
    }
    const user = await this.prisma.user.findUnique({ where: { username } });
    if (!user) throw new UnauthorizedException();

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) throw new UnauthorizedException();

    return {
      accessToken: this.jwt.sign({ sub: user.id }),
    };
  }

  async getUserById(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new UnauthorizedException();
    return { id: user.id, username: user.username };
  }
}
