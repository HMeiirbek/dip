# Server-Side Architecture and Security

## 1. Общая серверная архитектура

```
[ Client (Browser) ]
        |
        |  HTTPS + WebSocket
        v
[ Backend API / Signaling Server ]
        |
        |  SQL
        v
[ Database ]
```

**Важно:** backend **НЕ** передаёт аудио-трафик.

Он нужен для:

- аутентификации пользователей
- создания и управления звонками
- signaling (SDP, ICE) для WebRTC
- логирования и хранения метаданных

## 2. Backend (Server Side)

### Роль backend

Backend:

- управляет пользователями и их сессиями
- создаёт и ведёт `call sessions`
- передаёт signaling-сообщения между клиентами
- хранит метаданные звонков в БД

### Технологический стек

| Слой        | Технология         | Причина                               |
|------------|--------------------|---------------------------------------|
| Runtime    | Node.js            | Асинхронная модель, удобна для WS     |
| Framework  | NestJS             | Архитектура, DI, читаемость для диплома |
| Protocol   | REST + WebSocket   | REST — auth/API, WS — signaling       |
| Security   | JWT                | Простая и понятная авторизация        |
| Validation | class-validator    | Формальная валидация DTO              |
| Logging    | Winston            | Структурированные логи                |
| Config     | dotenv             | Конфигурация через переменные среды   |

> NestJS подчёркивает enterprise-архитектуру, что удобно описывать в дипломе.

## 3. Signaling Server (часть backend)

**Signaling** — это:

- обмен SDP offer/answer
- передача ICE-кандидатов
- уведомления о входящем звонке / статусе звонка

Реализация:

- канал связи: WebSocket (WSS)
- backend **не расшифровывает** и **не обрабатывает** медиаданные
- сервер лишь пересылает signaling-сообщения между браузерами

## 4. Database

### Назначение БД

В базе данных хранятся:

- пользователи
- история и состояние звонков
- активные сессии
- (опционально) signaling-сообщения для логирования

### Стек БД

| Компонент | Технология |
|----------|------------|
| DB       | PostgreSQL |
| ORM      | Prisma     |
| Migrations | Prisma   |
| UUID     | UUID v4    |

PostgreSQL — классический выбор для дипломных проектов, Prisma даёт типобезопасную схему и удобные миграции.

### Основные таблицы (логическая модель)

**`users`**

| поле          | тип        |
|--------------|-----------|
| `id`         | UUID      |
| `username`   | string    |
| `password_hash` | string |
| `created_at` | timestamp |

**`calls`**

| поле        | тип                             |
|------------|----------------------------------|
| `id`       | UUID                             |
| `caller_id`| UUID (FK → users.id)             |
| `callee_id`| UUID (FK → users.id)             |
| `status`   | enum (`created`, `active`, `ended`) |
| `created_at` | timestamp                       |
| `ended_at` | timestamp \| null                |

**`signaling_messages` (опционально)**

| поле        | тип        |
|------------|-----------|
| `id`       | UUID      |
| `call_id`  | UUID      |
| `sender_id`| UUID      |
| `type`     | enum (`SDP`, `ICE`) |
| `created_at` | timestamp |

Эта таблица может использоваться только для логирования и отладки, либо быть опущена в конечной реализации.

## 5. Auth & Security

### Аутентификация

- регистрация пользователя
- логин по username/password
- выдача **JWT access token** после успешного логина
- защита REST и WebSocket-эндпоинтов через JWT

### Безопасность

- **HTTPS** для REST API
- **WSS (WebSocket over TLS)** для signaling
- **E2E-шифрование** медиаданных через WebRTC (DTLS-SRTP)
- backend не имеет доступа к аудио и ключам шифрования

Ключевая формулировка для диплома:

> Даже при компрометации backend-сервера медиаданные остаются недоступными благодаря end-to-end шифрованию между клиентами.

## 6. Серверное окружение и деплой

### Окружение (target)

| Компонент   | Технология    |
|------------|---------------|
| OS         | Linux (Ubuntu)|
| Container  | Docker        |
| Reverse proxy | Nginx      |
| TLS        | Let’s Encrypt |

Типовой сценарий:

- backend и БД запускаются в Docker-контейнерах
- Nginx выступает в роли reverse proxy
- TLS-сертификаты выдаются через Let’s Encrypt

## 7. Итоговая серверная схема

```
Browser A  <── WSS ──>  Backend (NestJS)  <── WSS ──>  Browser B
                              |
                              └── PostgreSQL (через Prisma)
```

Backend остаётся stateless по отношению к медиапотоку: он хранит только состояние и метаданные, но не обрабатывает содержимое аудио.

