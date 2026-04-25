# Backend API Architecture (REST + WebSocket)

**Base URL:** `/api/v1`

Этот документ описывает базовый контур DIP и **расширения по ТЗ** (профиль, конфиденциальность, чаты, поддержка). Актуальные контракты также доступны в **Swagger** при запуске backend (если включён).

---

## 0. Нефункциональные требования (ТЗ §10) — как закрываются в проекте

| Требование | Реализация |
|------------|------------|
| **HTTPS** | Настраивается на reverse-proxy / хостинге (Render, Nginx и т.д.), не в коде Nest. |
| **JWT** | `Authorization: Bearer`, access + refresh-сессии. |
| **XSS** | React по умолчанию экранирует текст; пользовательский контент в UI не вставляется как `dangerouslySetInnerHTML`. |
| **CSRF** | REST для SPA с Bearer-токеном не использует cookie-сессию для API; при размещении на одном origin с cookie — настройте SameSite/CORS. |
| **Производительность поиска чатов (&lt;300 ms)** | Индексы БД + ограничение выборки; для отчёта замерьте на стенде (DevTools Network). |

---

## 1. Auth API

### POST /auth/register

**Назначение:** регистрация пользователя

**Request:**
```json
{
  "username": "user1",
  "password": "password123"
}
```

**Response:**
```json
{
  "id": "uuid",
  "username": "user1"
}
```

### POST /auth/login

**Назначение:** аутентификация

**Request:**
```json
{
  "username": "user1",
  "password": "password123"
}
```

**Response (фактическая):** access + refresh, профильные поля — см. Swagger / тип `AuthResponse` во frontend.

> JWT передаётся в заголовке `Authorization: Bearer <token>`

### POST /auth/refresh

Обновление access по `refreshToken` (тело JSON).

---

## 2. User API (профиль и аккаунт по ТЗ)

Все маршруты ниже требуют `Authorization: Bearer` кроме явно публичных.

### GET /users/me

Текущий пользователь: `username`, `name`, `avatarUrl`, роль, флаги верификации и т.д.

### PUT /users/me

Обновление профиля: имя, `username` (3–20 символов, `[A-Za-z0-9_]`), опционально `avatarUrl` (URL картинки jpg/png).

### PUT /users/me/avatar

`multipart/form-data`, поле `file` — jpg/png, ≤ 5 MB.

### PUT /users/me/password

Смена пароля: старый + новый (bcrypt на сервере).

### GET /users/me/export?includeMessages=true|false

JSON-экспорт: профиль, чаты, опционально сообщения чатов (`ChatMessage`).

### DELETE /users/me

Удаление аккаунта (анонимизация / soft-delete). Тело:

```json
{ "password": "........" }
```

**или**

```json
{ "confirmationCode": "123456" }
```

(ровно один способ.) Код запрашивается отдельно:

### POST /users/me/delete-account-code

Выдаёт одноразовый 6-значный код (хранится в `security_codes`, срок ~10 мин). Если задано `AUTH_DEBUG_CODES=true`, код возвращается в JSON для демо.

### GET /users/me/privacy — PUT /users/me/privacy

Настройки «кто может писать»: `EVERYONE` | `CONTACTS_ONLY` | `NOBODY`, уведомления о входе.

### Blacklist / Contacts

`GET/POST/DELETE /users/me/blacklist`, `GET/POST/DELETE /users/me/contacts` — по ТЗ блокировка и режим «только контакты».

### GET /users

Список пользователей (демо / выбор собеседника).

---

## 2b. Chats API

### GET /chats

Список чатов пользователя: тип `PRIVATE` | `GROUP`, заголовок, участники, **последнее сообщение** (включая `createdAt` — время для списка), `unreadCount`.

### GET /chats/search?q=

Поиск пользователей по никнейму и групп по названию (частичное совпадение, case-insensitive).

### POST /chats

Создание чата: тип, для группы — `title`, `memberIds`.

### GET /chats/:id/messages — POST /chats/:id/messages — PUT /chats/:id/read

Сообщения, отправка, отметка прочитанного.

### POST /chats/:id/members — DELETE /chats/:id/members/:userId

Участники группы (владелец добавляет; выход или удаление по правилам ТЗ).

### WebSocket namespace `/chat`

События `chat:join`, сообщения, typing, read — см. `ChatsGateway`.

---

## 2c. Support API

### POST /support/feedback

Тема + текст обращения.

### GET /support/pages/:slug

`faq` | `terms` | `privacy` — статический контент.

### GET /support/admin/requests — PATCH /support/admin/requests/:id

Только роль `admin`: список заявок и смена статуса.

---

## 3. Call API

### POST /calls

**Назначение:** создать звонок

**Request:**
```json
{
  "calleeId": "uuid"
}
```

**Response:**
```json
{
  "callId": "uuid",
  "status": "created"
}
```

**Backend:**
- создаёт call session
- уведомляет callee через WebSocket

### GET /calls/:id

**Назначение:** статус звонка

**Response:**
```json
{
  "callId": "uuid",
  "status": "active"
}
```

### POST /calls/:id/end

**Назначение:** завершить звонок

**Response:**
```json
{
  "status": "ended"
}
```

---

## 4. WebSocket API (Signaling, звонки)

**Endpoint:** `/ws`

**Auth:** JWT при подключении

### WebSocket Events

| Event | Payload | Описание |
|-------|---------|----------|
| `call:incoming` | `{ "callId": "uuid", "from": "userA" }` | Входящий звонок |
| `call:accept` | `{ "callId": "uuid" }` | Принятие звонка |
| `call:reject` | `{ "callId": "uuid" }` | Отклонение звонка |
| `webrtc:offer` | `{ "callId": "uuid", "sdp": "..." }` | SDP offer |
| `webrtc:answer` | `{ "callId": "uuid", "sdp": "..." }` | SDP answer |
| `webrtc:ice-candidate` | `{ "callId": "uuid", "candidate": "..." }` | ICE candidate |

> Backend не анализирует содержимое payload, только маршрутизирует сообщения между участниками звонка.

---

## 5. Error Handling

| Code | Meaning |
|------|---------|
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Resource not found |
| 409 | Conflict (e.g. duplicate username, duplicate block) |

---

## 6. Преимущества для диплома

- Чёткое разделение REST и WebSocket (сигналинг + отдельный namespace чатов)
- Единая модель пользователей и JWT
- Профиль, конфиденциальность и чаты как вспомогательный канал к аудиосвязи
- Удобно описывать в UML и sequence diagram
