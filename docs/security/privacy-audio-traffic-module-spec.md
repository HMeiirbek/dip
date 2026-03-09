# Technical Specification
## Privacy Protection Module for Network Audio Traffic (Pilot v1)

### 1. Purpose

This module provides secure real-time audio communication for users over the Internet.

The module must ensure:
- confidentiality of audio data in transit;
- protection against interception of signaling and media traffic;
- minimized metadata exposure through standard encrypted transports;
- secure and stable end-to-end audio session establishment.

This specification defines functional scope, security controls, performance targets, and acceptance criteria for the pilot release.

### 2. Scope

In scope:
- secure signaling over HTTPS/WSS;
- encrypted media transfer with WebRTC (DTLS-SRTP);
- NAT traversal using STUN/TURN, including TURN over TLS:443;
- JWT-based signaling/API authentication with refresh flow;
- quality monitoring (RTT, jitter, packet loss, MOS-like score);
- operational SLO/SLA targets for pilot.

Out of scope:
- compromised endpoint devices;
- ISP/provider infrastructure compromise;
- custom traffic obfuscation mechanisms intended to bypass network policy controls.

### 3. System Architecture

High-level flow:

Client A (React + WebRTC)
  -> HTTPS/WSS (JWT auth)
Signaling Server (NestJS)
  -> STUN/TURN (ICE)
Client B (React + WebRTC)
  <-> DTLS-SRTP media path (P2P or TURN relay)

Data/storage path:
- Backend (NestJS) <-> PostgreSQL for users, sessions, call metadata, security events.

### 4. Technology Stack

Frontend:
- React
- WebRTC
- socket.io-client (WSS signaling)

Backend:
- NestJS (Node.js)
- WebSocket Gateway (socket.io)
- JWT auth and refresh session management

Database:
- PostgreSQL

### 5. Security Requirements

#### 5.1 Signaling Security
- All signaling and control requests must be accepted only over HTTPS/WSS.
- Plain HTTP/WS must be rejected in production deployment.
- WebSocket handshake must require a valid JWT.
- Session continuation must use refresh-token flow with secure rotation/revocation.

#### 5.2 Media Security
- Media transport must use DTLS-SRTP.
- Minimum protocol versions:
  - TLS 1.2+
  - DTLS 1.2
  - SRTP with AES-GCM
- Raw media payload must never be stored on signaling/backend systems.

#### 5.3 Metadata Protection
- Use standard encrypted transports (HTTPS/WSS/TURN-TLS) for signaling and relay paths.
- Avoid exposing sensitive internal identifiers in external logs.
- Minimize retained traffic metadata to operationally required fields only.

#### 5.4 Optional E2EE Layer
- Optional end-to-end encryption above SRTP may be enabled via WebRTC Insertable Streams.
- If enabled, key material must remain client-side only.

### 6. NAT Traversal & Connectivity

- ICE must support STUN and TURN candidates.
- TURN over TLS on port 443 must be supported for restricted networks.
- Connection fallback policy:
  1. direct candidate pair;
  2. TURN UDP/TCP (if available);
  3. TURN TLS:443.

### 7. Performance & Reliability Targets (Pilot Baseline)

- Concurrent calls per instance (`N`): 100
- Packet loss tolerance (`Y`): up to 5% without call drop
- End-to-end audio latency target: <= 200 ms (target network conditions)
- Session setup time target: <= 5-8 seconds in >=95% of attempts
- Stability mechanisms:
  - jitter buffer
  - FEC
  - PLC

### 8. SLA / SRE Targets (Pilot)

- Availability: 99.5%
- RTO: <= 30 minutes
- Retry policy for reconnect:
  - 1s -> 2s -> 5s
  - random jitter added to avoid synchronized reconnect storms

### 9. Observability & Logging

Required telemetry:
- RTT
- jitter
- packet loss
- MOS-like score
- call setup time
- reconnect attempts and failures

Logging policy:
- log technical connection events, signaling errors, and quality metrics;
- do not log raw audio content;
- avoid storing direct PII where not required;
- apply masking for sensitive fields;
- apply bounded retention period per environment policy.

### 10. Scalability Requirements

- Architecture must support horizontal scaling:
  - multiple signaling instances;
  - load balancer in front of signaling/API;
  - shared persistence for auth/session/call metadata.
- Session and call-state consistency must be preserved under multi-instance deployment.

### 11. Threat Model Summary

System is designed to mitigate:
- passive interception of network traffic;
- unauthorized signaling/API access;
- inspection of unencrypted transport payloads.

Not covered:
- compromised end-user devices;
- provider-side infrastructure compromise;
- attacks outside system trust boundaries.

### 12. Acceptance Criteria

The module is accepted when all conditions below are met:

1. Signaling requests are served only via HTTPS/WSS.
2. WebRTC session setup completes in <= 5-8s in at least 95% of test attempts.
3. Audio latency remains <= 200ms under target conditions.
4. Calls remain established with up to 5% packet loss (degradation allowed).
5. TURN TLS:443 path works in restricted network scenarios.
6. Signaling connection without valid JWT is denied.
7. No downgrade to insecure protocol versions is possible.
8. Load test confirms stable operation at 100 concurrent calls per instance.

### 13. Implementation Roadmap

Phase 1 - Transport hardening:
- enforce HTTPS/WSS in deployment;
- ensure TLS/DTLS/SRTP minimums.

Phase 2 - Connectivity robustness:
- integrate/validate TURN TLS:443 fallback;
- verify ICE candidate policy in restricted networks.

Phase 3 - Auth/session controls:
- finalize JWT + refresh token rotation/revocation;
- enforce socket auth guardrails.

Phase 4 - Observability:
- collect and store quality metrics;
- add dashboards/alerts for SLA indicators.

Phase 5 - Validation:
- execute security checks and load tests;
- publish pilot verification report against acceptance criteria.

