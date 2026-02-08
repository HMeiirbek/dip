# DIP Frontend

React TypeScript frontend for the DIP (Secure Voice Communication) system.

## Features

- 🔐 User authentication (login/registration)
- 👥 Real-time user list
- ☎️ WebRTC peer-to-peer voice calls
- 🎤 Audio stream visualization
- 🔌 WebSocket signaling
- 📱 Responsive design

## Tech Stack

- **React 18** — UI framework
- **TypeScript** — Type-safe programming
- **Socket.io** — Real-time WebSocket communication
- **WebRTC** — Peer-to-peer audio/video
- **Axios** — HTTP client

## Project Structure

```
frontend/
├── public/
│   └── index.html
├── src/
│   ├── components/
│   │   ├── LoginForm.tsx      # Auth form
│   │   ├── UserList.tsx       # List of online users
│   │   ├── CallButton.tsx     # Initiate call
│   │   ├── CallStatus.tsx     # Call state display
│   │   └── AudioStream.tsx    # Audio playback component
│   ├── services/
│   │   ├── api.ts             # REST API client
│   │   └── socket.ts          # WebSocket client
│   ├── types.ts               # TypeScript types
│   ├── App.tsx                # Main app component
│   └── index.tsx              # Entry point
├── package.json
├── tsconfig.json
└── README.md
```

## Installation

```bash
cd frontend
npm install
```

## Configuration

Create a `.env.local` file in the frontend directory:

```env
REACT_APP_API_URL=http://localhost:3000/api/v1
REACT_APP_SOCKET_URL=http://localhost:3000
```

## Running the Application

### Development

```bash
npm start
```

The app will open at `http://localhost:3000`

### Production Build

```bash
npm build
```

## How It Works

### 1. Authentication Flow

```
User enters credentials
    ↓
POST /auth/register or /auth/login
    ↓
JWT token received
    ↓
Stored in localStorage
    ↓
User logged in
```

### 2. Call Initiation Flow

```
User clicks "Call" button
    ↓
POST /api/v1/calls → creates Call in DB
    ↓
WebRTC setup: capture mic, create RTCPeerConnection
    ↓
Generate SDP offer
    ↓
Send offer via WebSocket
    ↓
Signaling server relays to remote peer
    ↓
Remote peer generates answer
    ↓
Answer relayed back
    ↓
ICE candidates exchanged
    ↓
P2P connection established
    ↓
Audio encrypted with SRTP
```

### 3. Component Communication

```
App.tsx (Main)
├─ LoginForm
│  └─ apiService (login/register)
│
├─ UserList
│  ├─ apiService (getUsers)
│  └─ CallButton
│     └─ initiateCall()
│
└─ CallStatus
   └─ Shows call state
       ├─ Incoming
       ├─ Calling
       ├─ Active
       └─ Ended
   └─ AudioStream x2
      └─ Local + Remote audio
```

## API Endpoints Used

### Authentication

```
POST /api/v1/auth/register
POST /api/v1/auth/login
```

### Users

```
GET /api/v1/users           # Get all users
GET /api/v1/users/:id       # Get specific user
```

### Calls

```
POST /api/v1/calls          # Create call
GET /api/v1/calls/:id       # Get call details
PUT /api/v1/calls/:id/end   # End call
```

### WebSocket Events

```
webrtc:offer           # SDP offer for establishing connection
webrtc:answer          # SDP answer response
webrtc:ice-candidate   # ICE candidate for NAT traversal
```

## WebRTC Configuration

The app uses:
- **STUN Server:** `stun:stun.l.google.com:19302` (for NAT traversal)
- **Codec:** Opus (audio)
- **Protocol:** SRTP (encrypted RTP)
- **Key Exchange:** DTLS

## Error Handling

- Network connectivity errors
- WebRTC connection failures
- Socket.io connection errors
- API request failures

All errors are caught and displayed to the user.

## Browser Support

- Chrome/Chromium 90+
- Firefox 88+
- Safari 14.1+
- Edge 90+

(WebRTC support varies by browser)

## Security Notes

- JWT tokens stored in localStorage (consider sessionStorage for higher security)
- HTTPS recommended for production
- WebRTC media encrypted with SRTP by default
- Server never has access to encryption keys

## Future Improvements

- [ ] Video calling
- [ ] Screen sharing
- [ ] Call history
- [ ] User profiles
- [ ] Mute/unmute controls
- [ ] Recording (client-side)
- [ ] End-to-end encrypted text messaging
- [ ] Mobile app (React Native)
- [ ] Dark mode

## Troubleshooting

### Microphone not working

- Check browser permissions
- Ensure HTTPS in production
- Check audio device connection

### WebRTC connection fails

- Check firewall settings
- Ensure backend is running
- Check console for error messages
- Test STUN server connectivity

### Socket.io connection issues

- Verify backend is running
- Check CORS settings
- Ensure correct socket URL in .env

## License

MIT
