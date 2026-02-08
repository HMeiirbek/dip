# DIP — Secure End-to-End Encrypted Voice (Prototype)

Lightweight prototype that demonstrates end-to-end encrypted (E2EE) peer-to-peer voice calls using WebRTC for media and a NestJS signaling server (Socket.io + REST) for session setup.

Highlights
- Privacy-first: media encryption keys are generated and kept on clients.
- Signaling-only server: server routes offers/answers and ICE candidates; it never has access to raw audio.
- Simple developer setup: Docker for database, NestJS backend, React + TypeScript frontend.

Quick Links
- Backend: `/backend` (NestJS)
- Frontend: `/frontend` (React + TypeScript)
- DB schema: `/backend/prisma/schema.prisma`
- Documentation index: `docs/index.md`

Requirements
- Node.js 18+ and npm
- Docker & docker-compose (for PostgreSQL)
- Modern browser with WebRTC support (Chrome/Firefox/Edge/Safari)

Quick Start (3 commands)
1. Start PostgreSQL:

```bash
cd /home/mq/dip
docker-compose up -d postgres
```

2. Start backend (dev):

```bash
cd backend
npm install
npm run prisma:generate
npm run prisma:migrate
npm run start:dev
# Backend API: http://localhost:3000/api/v1
```

3. Start frontend (dev, new terminal):

```bash
cd frontend
npm install
cp .env.example .env.local
npm start
# Frontend: http://localhost:3000 (or 3001 if 3000 is busy)
```

How to test
1. Open two browser windows (or one normal + one incognito).
2. Register two accounts and log in.
3. Use the user list to initiate a call; accept on the other side.

Project structure (short)

- backend/: NestJS server (auth, users, calls, ws gateway, Prisma client)
- frontend/: React app (LoginForm, UserList, CallStatus, AudioStream)
- docker-compose.yml: PostgreSQL service
- docs/: design, security, API references

Design & Security Notes
- Media is transmitted P2P via WebRTC; DTLS/SRTP provides media encryption.
- The server performs signaling only and stores minimal call metadata; it does not receive audio payloads or client private keys.
- Authentication uses JWT for API access and Socket.io connection.

Troubleshooting
- If `react-scripts: not found` — run `npm install` inside `/frontend`.
- If Docker cannot start (permission denied) — run Docker commands with `sudo` or add your user to the `docker` group.
- If ports clash, frontend will suggest a different port (e.g. 3001). Use the port printed by the dev server.

Maintenance & next steps
- Add automated tests for signaling flows.
- Harden auth (refresh tokens, CSRF protections for web clients) for production.
- Add HTTPS / reverse proxy for production deployment.

Contributing
- Read `docs/` for architecture and security rationale before making changes.

License & contact
- This repository is a research/prototype. Check the repo root for license information.

---
Simple, practical, and ready for local testing. If you want, I can further expand any section (installation, deployment, API examples).
