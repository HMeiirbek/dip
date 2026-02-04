# Encryption Overview

## Cryptographic Mechanisms

- **SRTP** (Secure Real-time Transport Protocol) — encrypts audio streams in transit
- **DTLS** (Datagram Transport Layer Security) — performs secure key exchange for the session
- **Ephemeral keys** — generated per-call on client devices and destroyed when the call ends

## Data Flow

1. Session keys are derived during the DTLS handshake between peers
2. Outgoing audio is encrypted with SRTP before transmission
3. Incoming audio is decrypted on the receiver's device only
4. The server never has access to keys or plaintext media

## Interception Resistance

Captured network traffic contains only ciphertext. Without the session keys (which exist only on the two client devices), the audio cannot be reconstructed.
