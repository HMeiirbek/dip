# DIP - Secure Voice Signaling and Call Monitoring (Prototype)

DIP is a privacy-focused WebRTC voice calling prototype with a NestJS signaling server, JWT-authenticated REST and WebSocket APIs, and PostgreSQL persistence for calls, sessions, risk signals, moderation, and quality metrics. Media flows peer-to-peer; the server never receives raw audio.

## Features

- WebRTC media with DTLS/SRTP encryption in transit
- JWT auth for REST APIs and WSS signaling
- Call lifecycle tracking (pending, accepted, rejected, active, ended)
- Admin and moderation endpoints (flags, force-end, SLA summary)
- Quality metrics capture (RTT, jitter, packet loss) and acceptance report
- STUN/TURN support, including TURN over TLS 443
- Optional E2EE via Insertable Streams (not enabled by default)

## Requirements

- Node.js 18+
- Docker + docker-compose (local PostgreSQL)
- Modern browser with WebRTC support

## Quick Start

### 1) Start the database

```bash
cd /home/mq/dip
docker-compose up -d postgres
```

### 2) Start backend (NestJS)

```bash
cd backend
npm install
npm run prisma:generate
npm run prisma:migrate
npm run start:dev
```

Default API base: `http://localhost:3000/api/v1`

### 3) Start frontend (React)

```bash
cd frontend
npm install
npm start
```

The React dev server uses port 3000 by default. If backend is already on 3000, the frontend will switch to 3001.

## Configuration

### Backend environment

Use `backend/.env.example` as a template.

Required:
- `DATABASE_URL` (PostgreSQL)
- `JWT_SECRET`

Optional:
- `CORS_ORIGIN` (comma-separated list of allowed origins)
- `ENFORCE_SECURE_SIGNALING` (`true` to reject non-HTTPS/WSS)

Example:

```bash
DATABASE_URL="postgresql://user:pass@host:5432/db"
JWT_SECRET="change-me"
CORS_ORIGIN="http://localhost:3001,https://your-domain"
ENFORCE_SECURE_SIGNALING="false"
```

### Frontend environment

Use `frontend/.env.example` as a template (or create `frontend/.env.local`).

Required:
- `REACT_APP_API_URL`
- `REACT_APP_SOCKET_URL`

Optional ICE / TURN:

```bash
REACT_APP_STUN_URLS=stun:stun.l.google.com:19302
REACT_APP_TURN_URLS=turns:turn.example.com:443?transport=tcp
REACT_APP_TURN_USERNAME=turn-user
REACT_APP_TURN_CREDENTIAL=turn-password
# Optional full JSON override (takes precedence)
# REACT_APP_ICE_SERVERS_JSON=[{"urls":["stun:stun.l.google.com:19302"]}]
```

## Acceptance Report

Generate a measurable acceptance report from DB data:

```bash
cd backend
npm run acceptance:report
```

The report includes:
- Call setup KPI (p95, percent <= 8s)
- Quality KPI in last 24h (RTT, jitter, packet loss)
- PASS or PARTIAL summary

## Admin and Moderation (selected endpoints)

- `GET /api/v1/admin/moderation/overview`
- `GET /api/v1/admin/calls/flags`
- `POST /api/v1/admin/calls/:id/flag`
- `POST /api/v1/admin/calls/:id/flags/resolve-all`
- `POST /api/v1/admin/calls/:id/force-end`
- `GET /api/v1/admin/sla-summary`

All admin routes require JWT and appropriate roles (`admin` or `moderator`).

## Project Structure

```
dip/
├── backend/                 # NestJS signaling server
│   ├── src/
│   │   ├── auth/
│   │   ├── users/
│   │   ├── calls/
│   │   ├── ws/              # WebSocket signaling
│   │   ├── admin/           # moderation + SLA summary
│   │   ├── risk/            # risk APIs
│   │   ├── notifications/
│   │   ├── messages/
│   │   └── prisma/
│   ├── prisma/
│   └── scripts/
├── frontend/                # React UI & WebRTC client
│   ├── src/
│   │   ├── components/
│   │   ├── services/
│   │   └── App.tsx
├── docs/
├── deployment/
├── tests/
└── docker-compose.yml
```

## Documentation

- `docs/quick-start.md`
- `docs/architecture/system-architecture.md`
- `docs/api/backend-api.md`
- `docs/security/`
- `docs/reports/checkup-report.md`

## Troubleshooting

### getUserMedia is undefined on mobile
WebRTC requires a secure context. Use HTTPS and WSS or a tunnel that terminates TLS.

### CORS errors
Set `CORS_ORIGIN` on the backend to match the frontend origin and restart the server.

### WebSocket auth failures
Ensure the JWT is passed in the socket handshake `auth` field and the backend accepts the token.

## License

Research prototype. See LICENSE in repository root.
