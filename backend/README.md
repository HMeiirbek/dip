# Backend (NestJS + Prisma)

Signaling server for secure voice calls. See [Backend Implementation Guide](../docs/implementation/backend-setup.md) for details.

## Setup

```bash
npm install
cp .env.example .env
# Edit .env with DATABASE_URL and JWT_SECRET
npx prisma migrate dev --name init
npm run start:dev
```

## API Base

`http://localhost:3000/api/v1`
