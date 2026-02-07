# Local Setup

## Backend

1. Настройка PostgreSQL (локально или Docker)
2. Создание и запуск backend — см. [Backend Implementation Guide](../docs/implementation/backend-setup.md)
3. `.env` с `DATABASE_URL`

## Переменные окружения (.env)

```
DATABASE_URL="postgresql://user:password@localhost:5432/dip"
JWT_SECRET="your-secret-key"
```
