# Signaling Flow

Client-side perspective of the call setup and teardown sequence.

## Flow

1. **Connect** — Client connects to the signaling server
2. **Initiate / Receive** — One client sends a call request; the other receives notification
3. **Exchange parameters** — SDP and ICE candidates are exchanged via the server
4. **Establish P2P** — Direct peer-to-peer connection is formed
5. **Handshake** — DTLS handshake generates session keys
6. **Media** — Encrypted SRTP media flows directly between clients
7. **Teardown** — Call ends; connection and session keys are destroyed

## Client Responsibilities

- Send and receive signaling messages
- Generate and process SDP offers/answers
- Gather and exchange ICE candidates
- Establish WebRTC peer connection
- Never expose keys or media to the server
