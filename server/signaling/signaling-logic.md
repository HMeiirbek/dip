# Signaling Logic

Server-side responsibilities for call coordination.

## Functions

- **User registration** — Associate clients with logical identifiers
- **Presence** — Track which users are online and available
- **Call notification** — Deliver incoming-call alerts to the callee
- **Parameter relay** — Forward SDP and ICE candidates between callers

## Constraints

The server does **not**:

- Transmit voice data
- Generate or store encryption keys
- Inspect or modify media
- Participate in the DTLS/SRTP session

Signaling is limited to coordination; all media and cryptography remain client-to-client.
