# DIP — Secure End-to-End Encrypted Voice Calls (Prototype)

> A lightweight research prototype demonstrating privacy-first peer-to-peer voice communication with end-to-end encryption (E2EE). Uses WebRTC for media transmission and a NestJS signaling server for session setup.

## Overview

**DIP** combines WebRTC for encrypted media streaming with a minimal signaling server to enable secure voice calls. Communication keys remain on clients; the server never accesses raw audio or private keys.

### Key Features

- 🔐 **End-to-End Encrypted**: Media encryption keys are generated and stored on clients
- 🌐 **Peer-to-Peer**: Direct audio transmission between users via WebRTC (DTLS/SRTP)
- 🔌 **Signaling-Only Server**: Handles connection negotiation but never receives audio payloads
- 🔑 **JWT Authentication**: Secure API access and WebSocket connections
- 📊 **Real-Time UI**: User list, call status, and audio visualization

## Table of Contents

1. [Requirements](#requirements)
2. [Quick Start](#quick-start)
3. [Architecture](#architecture)
4. [Testing](#testing)
5. [API Reference](#api-reference)
6. [Troubleshooting](#troubleshooting)
7. [Documentation](#documentation)
8. [License](#license)

## Requirements

- **Node.js** 18 or higher with npm
- **Docker** & **docker-compose** (for PostgreSQL database)
- **Browser** with WebRTC support (Chrome, Firefox, Edge, Safari 15+)
- One terminal session or multiple terminal windows

## Quick Start

### 1. Start the Database

```bash
cd /home/mq/dip
docker-compose up -d postgres
```

### 2. Start Backend (NestJS + Signaling Server)

```bash
cd backend
npm install
npm run prisma:generate
npm run prisma:migrate dev
npm run start:dev
```

**API Server**: `http://localhost:3000/api/v1`

Optional backend security envs:
```bash
# comma-separated allowed origins
export CORS_ORIGIN="http://localhost:3001,https://your-domain"
# enforce HTTPS/WSS-only signaling (recommended in production)
export ENFORCE_SECURE_SIGNALING="true"
```

### 3. Start Frontend (React + WebRTC Client)

Open a **new terminal** and run:

```bash
cd frontend
npm install
npm start
```

**Frontend**: `http://localhost:3000` (or `3001` if port 3000 is in use)

Optional WebRTC ICE/TURN envs (`frontend/.env.local`):
```bash
REACT_APP_STUN_URLS=stun:stun.l.google.com:19302
# TURN over TLS 443 for restricted networks
REACT_APP_TURN_URLS=turns:turn.example.com:443?transport=tcp
REACT_APP_TURN_USERNAME=turn-user
REACT_APP_TURN_CREDENTIAL=turn-password
```

## Testing

### Quick User Setup (Script)

For rapid testing with multiple users (including mobile), use the create user script:

```bash
cd backend
node scripts/create_user.js --username alice --password secret123
node scripts/create_user.js --username bob --password secret123
node scripts/create_user.js --username mobile-user --password phone123
```

### Manual Testing Flow

1. **Open two browser windows** (or incognito + normal, or two different browsers)
2. **Create accounts**: Use script above or register via UI
3. **Log in**: Each user logs in with their credentials
4. **Initiate call**: User A clicks on User B's name in the user list
5. **Accept call**: User B receives the incoming call notification and accepts
6. **Audio test**: Both users should hear each other through encrypted P2P connection

### Mobile/Phone Testing

To use DIP from a mobile phone:

1. **Find your machine's IP address**:
   ```bash
   # macOS/Linux
   ipconfig getifaddr en0  # or check `ifconfig`
   # On Linux: hostname -I
   ```

2. **Update frontend API URL** (configure in `.env.local`):
   ```bash
   cd frontend
  echo "REACT_APP_API_URL=http://YOUR_MACHINE_IP:3000/api/v1" >> .env.local
  echo "REACT_APP_SOCKET_URL=http://YOUR_MACHINE_IP:3000" >> .env.local
   ```

3. **Access from mobile browser**: Open `http://YOUR_MACHINE_IP:3000` on your phone

4. **Login with mobile user**:
   ```bash
   # Create a user for mobile testing
   cd backend
  node scripts/create_user.js --username alice-mobile --password mobile123
   ```

5. **Test cross-device calls**: 
   - User on desktop calls user on mobile (or vice versa)
   - Both should hear encrypted audio through P2P connection

### Mobile Access (debugging checklist)

If the frontend opens on your phone but login fails, follow these steps to debug and fix common issues:

1. Verify device network: ensure phone is on the same LAN as the host machine.

2. Confirm frontend and backend URLs in `/frontend/.env.local` (use your host IP):
```bash
# Example (replace with your IP):
REACT_APP_API_URL=http://192.168.1.213:3000/api/v1
REACT_APP_SOCKET_URL=http://192.168.1.213:3000
```

3. Restart the frontend so it picks up the `.env.local` changes:
```bash
cd frontend
npm start
```

4. Check login network requests from the phone (use browser devtools, remote debugging, or a proxy):
  - POST /api/v1/auth/login should return 200 and an `accessToken`.
  - GET /api/v1/auth/me with `Authorization: Bearer <token>` should return user info.

5. Firewall / routing: ensure your host machine firewall allows inbound TCP on ports `3000` (backend) and `3001` (frontend dev server) or use `iptables`/ufw to open them.

6. If WebSocket signaling fails, check the browser console for `ws` connection errors and ensure the `REACT_APP_SOCKET_URL` is correct and reachable.

### WebSocket Authentication

The signaling server requires clients to authenticate their WebSocket connections with a JWT. Include the token in the socket.io handshake `auth` field. Example (frontend):

```javascript
// after login: store token in localStorage
const token = localStorage.getItem('accessToken');
const socket = io(process.env.REACT_APP_SOCKET_URL || 'http://localhost:3000', {
  auth: { token },
});

socket.on('connect', () => console.log('socket connected', socket.id));
```

Server expectation (backend): the server reads `handshake.auth.token` or `handshake.query.token`, verifies the JWT, and maps the authenticated `userId` to the socket. This allows the server to send addressable notifications (for example, `call:incoming`) only to the intended recipient.

If you use a different env var name, update both frontend `.env.local` and the README examples accordingly.

7. If audio does not transmit: verify microphone permissions in the mobile browser and that WebRTC is supported (modern mobile browsers only).

If you want, I can add a short troubleshooting subsection to `frontend/README.md` with these steps.

### REST API Testing

**Register a new user:**
```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","password":"secret123"}'
```

**Login:**
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","password":"secret123"}'
# Response: { "accessToken": "JWT_TOKEN", "userId": "..." }
```

**Get all online users (requires JWT):**
```bash
curl http://localhost:3000/api/v1/users \
  -H "Authorization: Bearer JWT_TOKEN"
```

**Initiate a call:**
```bash
curl -X POST http://localhost:3000/api/v1/calls \
  -H "Authorization: Bearer JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"calleeId":"USER_ID"}'
```

Full API documentation: [Backend API Reference](docs/api/backend-api.md)

### Pilot Acceptance Report

After running test calls/load, generate a measurable acceptance report from DB data:

```bash
cd backend
npm run acceptance:report
```

The report includes:
- call setup KPI (`p95`, `% <= 8s`)
- quality KPI in last 24h (`RTT`, `jitter`, `packet loss`)
- pass/partial status for pilot acceptance checks.

## Architecture

### System Overview

```
┌─────────────────┐                    ┌──────────────────┐
│ Browser (User A)│◄──── P2P/WebRTC ──►│ Browser (User B) │
│   • React UI    │    DTLS/SRTP       │   • React UI     │
│   • WebRTC      │   (Encrypted)      │   • WebRTC       │
│   • Socket.io   │                    │   • Socket.io    │
└────────┬────────┘                    └────────┬─────────┘
         │                                      │
         │    JSON Signaling (offers/answers)   │
         │    Socket.io + REST                  │
         └──────────────┬───────────────────────┘
                        │
                   ┌────▼──────┐
                   │ NestJS    │
                   │ Server    │
                   │ (Routes   │
                   │Signaling) │
                   └────┬──────┘
                        │
                   ┌────▼──────┐
                   │PostgreSQL │
                   │  (Calls & │
                   │  Metadata)│
                   └───────────┘
```

### Component Details

**Backend (`/backend` - NestJS)**
- Auth Module: User registration and JWT authentication
- Users Module: User management and online status tracking
- Calls Module: Call state management (initiated, accepted, rejected, ended)
- WebSocket Gateway: Real-time signaling (offers, answers, ICE candidates)
- Prisma ORM: Database abstraction for PostgreSQL

**Frontend (`/frontend` - React + TypeScript)**
- LoginForm: User authentication UI
- UserList: Online users display and call initiation  
- CallStatus: Call state visualization
- AudioStream: WebRTC audio handling and visualization
- Services: API client (`api.ts`) and WebSocket client (`socket.ts`)

**Database (`/backend/prisma/schema.prisma`)**
- Users table: authentication and profile data
- Calls table: call metadata and state tracking

## Project Structure

```
dip/
├── backend/                    # NestJS signaling server
│   ├── src/
│   │   ├── auth/              # Authentication & JWT
│   │   ├── users/             # User management
│   │   ├── calls/             # Call metadata
│   │   ├── ws/                # WebSocket signaling gateway
│   │   ├── prisma/            # Database client
│   │   ├── app.module.ts      # Root module
│   │   └── main.ts            # Entry point
│   ├── prisma/
│   │   └── schema.prisma      # Database schema
│   └── package.json
│
├── frontend/                   # React UI & WebRTC client
│   ├── src/
│   │   ├── components/
│   │   │   ├── LoginForm.tsx
│   │   │   ├── UserList.tsx
│   │   │   ├── CallButton.tsx
│   │   │   ├── CallStatus.tsx
│   │   │   └── AudioStream.tsx
│   │   ├── services/
│   │   │   ├── api.ts         # REST API client
│   │   │   └── socket.ts      # WebSocket client
│   │   ├── types.ts           # TypeScript types
│   │   ├── App.tsx
│   │   └── index.tsx
│   └── package.json
│
├── docs/                       # Detailed documentation
│   ├── index.md               # Documentation index
│   ├── quick-start.md         # Getting started guide
│   ├── architecture/          # Design and architecture
│   ├── api/                   # API reference
│   ├── implementation/        # Setup guides
│   ├── security/              # Security analysis
│   └── research/              # Research & technology review
│
├── deployment/                # Deployment guides
├── tests/                      # Testing & analysis
├── docker-compose.yml         # PostgreSQL container config
└── README.md                  # This file
```

## API Reference

For comprehensive API documentation, see [Backend API Reference](docs/api/backend-api.md)

### Key Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/register` | Create new user account |
| POST | `/api/v1/auth/login` | Get JWT authentication token |
| GET | `/api/v1/users` | List online users |
| POST | `/api/v1/calls` | Initiate a call |
| WS | `/ws` | WebSocket signaling endpoint |

## Security Architecture

- **Media Encryption**: WebRTC uses DTLS/SRTP for automatic media encryption in transit
- **Key Management**: Encryption keys generated and stored only on client devices
- **Server Role**: Signaling server handles connection negotiation but never receives:
  - Raw audio payloads
  - Client private keys
  - Media encryption material
- **Authentication**: JWT tokens protect API access and WebSocket connections
- **Database**: Stores only user metadata and call state, no media content

For detailed security analysis, see [Security Assumptions](docs/security/security-assumptions.md) and [Threat Model](docs/security/threat-model.md)

## Pilot Baseline (v1)

The following values are fixed for the pilot version and can be adjusted only after load testing.

### Platform & Security Baseline

- **Backend stack**: NestJS
- **Signaling transport**: HTTPS/WSS only
- **Signaling auth**: JWT + refresh token flow
- **NAT traversal**: STUN + TURN, including TURN over TLS on port `443`
- **Crypto minimums**:
  - TLS `1.2+`
  - DTLS `1.2`
  - SRTP with `AES-GCM`
- **E2EE**: optional (via WebRTC Insertable Streams)

### Performance & Reliability Targets

- **Concurrency target (`N`)**: `100` simultaneous calls per server instance
- **Packet-loss tolerance (`Y`)**: up to `5%` without call drop
- **Audio latency target**: `<= 200 ms` under target network conditions
- **SLA availability**: `99.5%`
- **RTO**: `<= 30 minutes`
- **Retry policy**: reconnect attempts at `1s -> 2s -> 5s` with random jitter

### Operational Requirements

- Horizontal scaling must be supported (multiple signaling servers + load balancer)
- Connection quality metrics must be collected:
  - RTT
  - jitter
  - packet loss
  - MOS-like score
- Logging policy:
  - log technical connection events, signaling errors, quality stats
  - do not log raw audio payloads or direct PII
  - apply PII masking and bounded retention

### Pilot Acceptance Criteria

- All signaling requests are accepted only via HTTPS/WSS
- Audio session setup between clients is `<= 5-8s` in at least `95%` of attempts
- Calls remain established with up to `5%` packet loss (quality degradation allowed)
- TURN TLS `443` path works in restricted networks
- No signaling access without a valid JWT
- No downgrade to insecure protocol versions
- Load test confirms stable operation at `100` parallel calls per instance

## Troubleshooting

### Issue: `Cannot find module 'react-scripts'`
**Solution**: Ensure you ran `npm install` in the `/frontend` directory:
```bash
cd frontend
npm install
```

### Issue: Docker permission denied
**Solution**: Either use `sudo` or add your user to the `docker` group:
```bash
sudo usermod -aG docker $USER
# Log out and back in to apply group changes
```

### Issue: Port 3000 already in use
**Solution**: The frontend dev server will automatically use port 3001 (or higher). Check the terminal output for the assigned port:
```bash
# Check which process uses port 3000
lsof -i :3000
# Or kill it
kill -9 <PID>
```

### Issue: Backend won't connect to database
**Solution**: Verify PostgreSQL is running:
```bash
# Check container status
docker-compose ps

# View logs
docker-compose logs postgres

# Restart if needed
docker-compose restart postgres
```

### Issue: WebSocket connection fails
**Causes**: Check that backend is running, frontend has correct backend URL in `.env.local`

## Documentation

### For Users & Developers
- [Quick Start Guide](docs/quick-start.md) — Step-by-step setup
- [System Architecture](docs/architecture/system-architecture.md) — System design & data flow
- [Backend Setup](docs/implementation/backend-setup.md) — Backend development guide
- [Frontend Guide](docs/implementation/frontend-guide.md) — Frontend development guide

### For Security & Deployment
- [Security Overview](docs/security/encryption-overview.md) — Encryption & security model
- [Threat Model](docs/security/threat-model.md) — Threat analysis
- [Privacy Audio Traffic Module Spec](docs/security/privacy-audio-traffic-module-spec.md) — Formal module requirements and pilot acceptance criteria
- [Deployment Guide](deployment/local-setup.md) — Local deployment setup

### For Research
- [Technology Review](docs/research/technology-review.md) — Technology choices
- [Related Work](docs/research/related-work.md) — Similar projects & research
- [Checkup Report](docs/reports/checkup-report.md) — Project status report

## Development Workflow

### Contributing
1. Read the [System Architecture](docs/architecture/system-architecture.md) documentation
2. Understand the [Security Model](docs/security/security-assumptions.md) before making changes
3. Test changes in both backend and frontend
4. Update relevant documentation

### Next Steps (Future Enhancements)
- [ ] Automated test suite for signaling flows
- [ ] Refresh token implementation for production
- [ ] CSRF protection for web clients
- [ ] HTTPS/TLS reverse proxy for production
- [ ] Error recovery and reconnection logic
- [ ] Multi-party call support

## Files & Directories Quick Reference

| Path | Purpose |
|------|---------|
| `backend/` | NestJS server with signaling, auth, and APIs |
| `frontend/` | React TypeScript UI and WebRTC client |
| `backend/prisma/schema.prisma` | PostgreSQL database schema |
| `docker-compose.yml` | Docker Compose configuration for PostgreSQL |
| `docs/` | Complete documentation (architecture, security, guides) |
| `docs/api/backend-api.md` | Full REST API reference |

## License & Contact

This repository is a research prototype. For license information, see the LICENSE file in the repository root.

---

**Ready to get started?** Begin with [Quick Start](#quick-start) or read [Quick Start Guide](docs/quick-start.md) for detailed instructions.
