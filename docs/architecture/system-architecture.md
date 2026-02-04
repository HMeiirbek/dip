# System Architecture

The system follows a **peer-to-peer architecture** with a centralized signaling server.

## Logical View

```
Client A  <==== Encrypted Media (SRTP) ====>  Client B
   ↑                                         ↑
   |           Signaling (SDP, ICE)           |
   └─────────────── Signaling Server ─────────┘
```

## Main Components

### 1. Client

The client runs on a user device (mobile phone or laptop) using a browser or Progressive Web Application (PWA).

**Responsibilities:**

- Capture audio from the microphone
- Encode audio data
- Encrypt outgoing audio streams
- Decrypt incoming audio streams
- Transmit and receive voice data
- Display call-related user interface

All cryptographic operations are performed exclusively on the client side.

### 2. Signaling Server

A lightweight web server used only to coordinate call setup.

**Responsibilities:**

- User registration and presence management
- Notifying users about incoming calls
- Exchanging connection parameters between clients

**The signaling server does NOT:**

- Transmit voice data
- Generate or store encryption keys
- Participate in media transmission

### 3. Media Transport Layer

After signaling is completed, clients establish a direct connection.

**Characteristics:**

- Peer-to-peer communication
- UDP-based media transport
- Encrypted audio using SRTP
- Secure key exchange using DTLS

## Call Flow

1. Both clients connect to the signaling server
2. One client initiates a call request
3. The signaling server notifies the receiving client
4. Clients exchange connection parameters through the server
5. A direct peer-to-peer connection is established
6. A secure handshake is performed and session keys are generated
7. Encrypted voice data is transmitted directly between clients
8. When the call ends, the connection is closed and session keys are destroyed
