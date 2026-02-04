# Secure Voice Communication System (E2EE)

End-to-end encrypted voice communication over the Internet. Two users establish a voice call where all audio data is transmitted directly between clients; the server is used only for signaling.

## Overview

The system demonstrates how modern web technologies can be used to build privacy-preserving voice communication, resistant to interception and unauthorized access.

## Problem Statement

Traditional voice calls and some VoIP solutions are vulnerable to:

- **Call interception** — traffic can be captured and decoded
- **Server-side access to voice data** — providers can store or inspect audio
- **Lack of transparency** — encryption mechanisms are opaque to users

This project addresses these issues by designing a system where:

- Encryption keys are generated on user devices
- Voice data is never accessible to the server
- Communication remains secure even if the server is compromised

## Project Goal

Demonstrate the design and implementation of a secure voice communication system using existing cryptographic mechanisms, focusing on architecture, security, and practical feasibility rather than building a commercial telecommunication product.

## Scope and Limitations

- Designed as a prototype for academic purposes
- Does not integrate with mobile network operators or traditional telephony systems
- User identification is based on logical identifiers rather than phone numbers

## Documentation

- [System Architecture](docs/architecture/system-architecture.md)
- [Threat Model](docs/security/threat-model.md)
- [Encryption Overview](docs/security/encryption-overview.md)
- [Security Assumptions](docs/security/security-assumptions.md)

## Project Structure

```
secure-voice-call/
│
├── docs/
│   ├── architecture/
│   ├── security/
│   └── research/
│
├── client/
│   ├── ui/
│   ├── media/
│   ├── signaling/
│   └── security/
│
├── server/
│   ├── signaling/
│   └── security/
│
├── tests/
│   ├── security/
│   └── connectivity/
│
└── deployment/
```
