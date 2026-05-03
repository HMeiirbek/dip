# DIP - Secure Voice Signaling and Advanced Call Monitoring

DIP is a robust, privacy-centric WebRTC voice communication platform designed as a research prototype for secure peer-to-peer calling. It features a NestJS-powered signaling server, real-time quality monitoring, ML-driven threat detection, and advanced risk scoring to ensure secure and reliable communication.

## 🚀 Key Features

- **End-to-End Secure Media**: Peer-to-peer audio streams encrypted with DTLS/SRTP. The signaling server never touches raw audio data.
- **Advanced Signaling**: JWT-authenticated WebSocket signaling (Socket.io) with strict session management.
- **ML-Monitoring & Risk Scoring**: Real-time analysis of call patterns and network metadata using machine learning to detect anomalies and fraudulent behavior.
- **Anti-Fraud System**: Integrated blacklisting and risk-based moderation tools for administrators.
- **Network Traffic Visualizer**: Built-in tool for analyzing PCAP/Wireshark data, demonstrating traffic patterns and obfuscation techniques (TCP Cloaking).
- **Quality of Service (QoS)**: Comprehensive metrics collection including RTT, jitter, and packet loss with automated acceptance reporting.
- **Resilient Connectivity**: Full STUN/TURN support, including TURN over TLS (port 443) for bypass restricted firewalls.

## 🛠 Project Structure

```text
dip/
├── backend/                # NestJS signaling & management server
│   ├── src/
│   │   ├── admin/          # Moderation & SLA reporting
│   │   ├── auth/           # JWT & Session logic
│   │   ├── blacklist/      # Anti-fraud blacklisting
│   │   ├── calls/          # Call lifecycle management
│   │   ├── ml/             # ML-driven monitoring & anomaly detection
│   │   ├── risk/           # Real-time risk scoring
│   │   ├── ws/             # WebSocket signaling gateway
│   │   └── prisma/         # Database persistence layer
├── frontend/               # React-based WebRTC client & Admin Dashboard
│   ├── src/
│   │   ├── components/     # UI Components (TrafficVisualizer, CallInterface, etc.)
│   │   ├── services/       # API & Socket clients
│   │   └── utils/          # PCAP parsing & network math
├── docs/                   # Technical specifications & architecture diagrams
├── deployment/             # Docker & CI/CD configuration
└── scripts/                # Utility scripts for maintenance and reporting
```

## 📋 Requirements

- **Node.js**: v18.0 or higher
- **PostgreSQL**: v14+ (via Docker or local installation)
- **Docker & Docker Compose**: For local environment setup

## 🚦 Quick Start

### 1. Environment Setup

Copy `.env.example` to `.env` in both `backend/` and `frontend/` directories and adjust variables as needed.

### 2. Launch Infrastructure

```bash
# Start PostgreSQL
docker-compose up -d postgres
```

### 3. Start Backend

```bash
cd backend
npm install
npm run prisma:generate
npm run prisma:migrate:dev
npm run start:dev
```

### 4. Start Frontend

```bash
cd frontend
npm install
npm start
```

Default access:
- **API**: `http://localhost:3000/api/v1`
- **Web UI**: `http://localhost:3001` (or 3000 if backend is on another port)

## 📊 Security & Monitoring

### Acceptance Reporting
Generate a detailed KPI report based on database metrics:
```bash
cd backend
npm run acceptance:report
```

### ML Monitoring
The system tracks runtime model accuracy and drift. Status can be checked via:
- `GET /api/v1/ml/status`
- `GET /api/v1/ml/metrics`

### Risk Analysis
Each user and call session is assigned a risk score based on historical behavior and real-time signals:
- `GET /api/v1/risk/stats`
- `GET /api/v1/risk/monitor`

## 📖 Documentation

For more detailed information, please refer to the `docs/` directory:
- [System Architecture](docs/architecture/system-architecture.md)
- [Security Specifications](docs/security/privacy-audio-traffic-module-spec.md)
- [Backend API Reference](docs/api/backend-api.md)

## 🔒 License

This project is a research prototype. See the [LICENSE](LICENSE) file for details.
