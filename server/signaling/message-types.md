# Message Types

WebSocket signaling events — см. [Backend API](../../docs/api/backend-api.md#4-websocket-api-signaling).

| Event | Payload |
|-------|---------|
| `call:incoming` | `callId`, `from` |
| `call:accept` | `callId` |
| `call:reject` | `callId` |
| `webrtc:offer` | `callId`, `sdp` |
| `webrtc:answer` | `callId`, `sdp` |
| `webrtc:ice-candidate` | `callId`, `candidate` |
