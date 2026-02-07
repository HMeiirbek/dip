# Backend Implementation Guide

## 1. Создание проекта

```bash
npm i -g @nestjs/cli
nest new backend
cd backend
```

Установка зависимостей:

```bash
npm install @nestjs/jwt @nestjs/passport passport passport-jwt
npm install bcrypt class-validator class-transformer
npm install @nestjs/websockets socket.io
npm install prisma @prisma/client
```

## 2. Структура backend

```
backend/
├── src/
│   ├── auth/
│   ├── users/
│   ├── calls/
│   ├── ws/
│   ├── prisma/
│   ├── app.module.ts
│   └── main.ts
├── prisma/
│   └── schema.prisma
└── .env
```

## 3. Prisma (БД)

**prisma/schema.prisma**

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model User {
  id        String   @id @default(uuid())
  username  String   @unique
  password  String
  createdAt DateTime @default(now())
}

model Call {
  id        String   @id @default(uuid())
  callerId  String
  calleeId  String
  status    String
  createdAt DateTime @default(now())
}
```

```bash
npx prisma migrate dev --name init
```

## 4. Auth (регистрация + логин)

**auth/auth.service.ts**

```typescript
@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwt: JwtService) {}

  async register(username: string, password: string) {
    const hash = await bcrypt.hash(password, 10);
    return this.prisma.user.create({
      data: { username, password: hash },
    });
  }

  async login(username: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { username } });
    if (!user) throw new UnauthorizedException();

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) throw new UnauthorizedException();

    return {
      accessToken: this.jwt.sign({ sub: user.id }),
    };
  }
}
```

## 5. Calls API

**calls/calls.controller.ts**

```typescript
@UseGuards(JwtAuthGuard)
@Controller('calls')
export class CallsController {
  constructor(private prisma: PrismaService) {}

  @Post()
  async create(@Req() req, @Body('calleeId') calleeId: string) {
    return this.prisma.call.create({
      data: {
        callerId: req.user.sub,
        calleeId,
        status: 'created',
      },
    });
  }

  @Post(':id/end')
  async end(@Param('id') id: string) {
    return this.prisma.call.update({
      where: { id },
      data: { status: 'ended' },
    });
  }
}
```

## 6. WebSocket Signaling

**ws/ws.gateway.ts**

```typescript
@WebSocketGateway({ cors: true })
export class WsGateway {
  @WebSocketServer()
  server: Server;

  @SubscribeMessage('webrtc:offer')
  handleOffer(@MessageBody() data) {
    this.server.emit('webrtc:offer', data);
  }

  @SubscribeMessage('webrtc:answer')
  handleAnswer(@MessageBody() data) {
    this.server.emit('webrtc:answer', data);
  }

  @SubscribeMessage('webrtc:ice-candidate')
  handleIce(@MessageBody() data) {
    this.server.emit('webrtc:ice-candidate', data);
  }
}
```

> Backend не читает SDP, только пересылает сообщения.

## 7. main.ts

```typescript
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  await app.listen(3000);
}
bootstrap();
```
