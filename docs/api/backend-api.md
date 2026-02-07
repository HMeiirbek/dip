# Backend API Architecture (REST + WebSocket)

**Base URL:** `/api/v1`

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

**Response:**
```json
{
  "accessToken": "jwt-token"
}
```

> JWT передаётся в заголовке `Authorization: Bearer <token>`

---

## 2. User API

### GET /users/me

**Назначение:** получить текущего пользователя

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "id": "uuid",
  "username": "user1"
}
```

### GET /users

**Назначение:** список пользователей (для демо)

**Response:**
```json
[
  {
    "id": "uuid",
    "username": "user2"
  }
]
```

> В реальных системах — контакты; для диплома достаточно списка пользователей.

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

## 4. WebSocket API (Signaling)

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
| 404 | Call not found |
| 409 | Call already active |

---

## 6. Преимущества для диплома

- Чёткое разделение REST и WebSocket
- Stateless backend
- Минимум бизнес-логики
- Удобно описывать в UML и sequence diagram
- Легко продемонстрировать на защите
