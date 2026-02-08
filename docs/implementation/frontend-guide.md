# Frontend Development Guide

## Overview

The DIP frontend is a React + TypeScript application that provides a user interface for secure voice communication. It connects to the NestJS backend via REST API and WebSocket (Socket.io).

## Architecture

### Component Hierarchy

```
App (Main)
├── LoginForm (Authentication)
├── Header (User info + Logout)
├── UserList (Display online users)
│   └── CallButton (Initiate call)
├── CallStatus (Call state display)
│   └── AudioStream x2 (Local + Remote)
```

### Data Flow

```
User Action
    ↓
React Component
    ↓
Service (api.ts or socket.ts)
    ↓
Backend API or WebSocket
    ↓
State Update (useState)
    ↓
Re-render
```

## Services

### api.ts - REST Client

Handles HTTP requests to backend:

```typescript
// Authentication
apiService.register(username, password)
apiService.login(username, password)
apiService.logout()

// Users
apiService.getUsers()
apiService.getUser(id)

// Calls
apiService.createCall(calleeId)
apiService.getCall(id)
apiService.endCall(id)
```

### socket.ts - WebSocket Client

Handles real-time WebSocket signaling:

```typescript
// Connection
socketService.connect(token)
socketService.disconnect()
socketService.isConnected()

// Signaling
socketService.sendOffer(data)
socketService.onOffer(callback)
socketService.sendAnswer(data)
socketService.onAnswer(callback)
socketService.sendICECandidate(data)
socketService.onICECandidate(callback)

// Call events
socketService.onIncomingCall(callback)
socketService.onCallEnded(callback)
```

## WebRTC Integration

### Flow

1. **Setup WebRTC**
   ```typescript
   const pc = new RTCPeerConnection({
     iceServers: [{ urls: ['stun:stun.l.google.com:19302'] }]
   })
   ```

2. **Get Local Stream**
   ```typescript
   const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
   stream.getTracks().forEach(track => pc.addTrack(track, stream))
   ```

3. **Create Offer (Caller)**
   ```typescript
   const offer = await pc.createOffer()
   await pc.setLocalDescription(offer)
   socketService.sendOffer({ callId, from, to, offer })
   ```

4. **Receive Offer & Create Answer (Receiver)**
   ```typescript
   const offer = new RTCSessionDescription(remoteOffer)
   await pc.setRemoteDescription(offer)
   const answer = await pc.createAnswer()
   await pc.setLocalDescription(answer)
   socketService.sendAnswer({ callId, from, to, answer })
   ```

5. **Exchange ICE Candidates**
   ```typescript
   pc.onicecandidate = (event) => {
     if (event.candidate) {
       socketService.sendICECandidate({ callId, from, to, candidate })
     }
   }

   socketService.onICECandidate(async (data) => {
     await pc.addIceCandidate(new RTCIceCandidate(data.candidate))
   })
   ```

6. **Handle Remote Stream**
   ```typescript
   pc.ontrack = (event) => {
     setRemoteStream(event.streams[0])
   }
   ```

## State Management

### Auth State
```typescript
const [currentUser, setCurrentUser] = useState<User | null>(null)
const [authError, setAuthError] = useState<string | null>(null)
```

### Call State
```typescript
const [callStatus, setCallStatus] = useState<CallStatusType>('idle')
const [activeCall, setActiveCall] = useState<Call | null>(null)
const [incomingCall, setIncomingCall] = useState<Call | null>(null)
```

### Media State
```typescript
const [localStream, setLocalStream] = useState<MediaStream | null>(null)
const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
```

### Call Status Types
```typescript
type CallStatus = 'idle' | 'incoming' | 'calling' | 'active' | 'ended' | 'error'
```

## Components

### LoginForm
**Props:**
- `onSuccess: (username: string) => void` — Called after login
- `onError: (error: string) => void` — Called on error

**Features:**
- Register new user
- Login existing user
- Toggle between register/login modes
- Error display

### UserList
**Props:**
- `currentUserId: string` — Current user ID
- `onCall: (userId: string) => void` — Callback to initiate call
- `activeCallId: string | null` — Current active call

**Features:**
- Auto-refresh every 5 seconds
- Filter out current user
- Show call button per user
- Disable button if already in call

### CallButton
**Props:**
- `userId: string` — User to call
- `username: string` — Display name
- `onCall: (userId: string) => void` — Callback
- `isInCall: boolean` — Disable if in call

**Features:**
- Loading state
- Disabled while in call
- Tooltip with user name

### CallStatus
**Props:**
- `status: CallStatusType` — Current status
- `activeCall: Call | null` — Active call details
- `incomingCall: Call | null` — Incoming call details
- `remoteUsername: string | null` — Remote user name
- `onAccept?: () => void` — Accept incoming
- `onReject?: () => void` — Reject incoming
- `onEnd?: () => void` — End active call

**Displays:**
- Idle state
- Incoming call with Accept/Reject
- Calling with spinner
- Active with user name and end button
- Ended confirmation
- Error state

### AudioStream
**Props:**
- `stream: MediaStream | null` — Audio stream
- `isMuted?: boolean` — Mute local audio
- `label?: string` — Display label

**Features:**
- Autoplay remote audio
- Mute local audio
- Stream status indicator

## Styling

All styling is done with inline CSS objects for simplicity. Key color scheme:

```
Primary: #667eea (Purple)
Secondary: #764ba2 (Dark Purple)
Success: #27ae60 (Green)
Error: #e74c3c (Red)
```

## Environment Configuration

Create `.env.local` in frontend directory:

```
REACT_APP_API_URL=http://localhost:3000/api/v1
REACT_APP_SOCKET_URL=http://localhost:3000
```

For production:

```
REACT_APP_API_URL=https://api.example.com/api/v1
REACT_APP_SOCKET_URL=https://api.example.com
```

## Testing

### Manual Testing Workflow

1. **Setup**
   - Start backend: `cd backend && npm run start:dev`
   - Start frontend: `cd frontend && npm start`

2. **Registration**
   - Open two browser windows
   - Register user1 and user2

3. **Call Flow**
   - User1 clicks "Call user2"
   - User2 sees incoming call notification
   - User2 clicks "Accept"
   - Both see "Connected" state
   - Verify audio works
   - User1 clicks "End Call"
   - Verify disconnect

4. **Error Testing**
   - Restart backend while in call
   - Close one browser tab
   - Disable microphone
   - Test with bad network (DevTools throttling)

### Browser DevTools Tips

- **Console**: See errors and WebRTC logs
- **Network**: Filter by "socket.io" to see WebSocket events
- **Application**: Check localStorage for JWT token
- **DevTools → Connection → Throttling**: Simulate slow network

## Performance Optimization

### Current Implementation
- Components use React.FC functional components
- Uses useState for state management
- Socket connection established once on mount
- WebRTC peer connection reused per call

### Future Optimizations
- [ ] Implement useCallback for event handlers
- [ ] Memoize User components
- [ ] Lazy load heavy components
- [ ] Implement virtual scrolling for large user lists
- [ ] Use Context API or Redux for global state
- [ ] Code splitting by route

## Security Considerations

### Current
- JWT stored in localStorage
- HTTPS should be used in production
- Socket.io uses same domain as API

### Improvements
- Move JWT to sessionStorage (less persistent)
- Implement token refresh mechanism
- Add CSRF protection
- Sanitize user input
- Add Content Security Policy headers
- Implement certificate pinning for mobile

## Deployment

### Development
```bash
npm start
```

### Production Build
```bash
npm build
npm install -g serve
serve -s build
```

### Docker (Future)
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package.json .
RUN npm install
COPY . .
RUN npm build
EXPOSE 3000
CMD ["npm", "start"]
```

## Troubleshooting

### "Cannot GET /"
- React server not running on correct port
- Check if port 3000/3001 is already in use

### "Failed to connect to socket"
- Backend not running
- Check REACT_APP_SOCKET_URL
- Check CORS settings in backend

### "Microphone permission denied"
- Grant in browser privacy settings
- Check browser console for exact error
- May require HTTPS in production

### "Call not connecting"
- Check WebRTC logs in console
- Verify STUN server is reachable
- Check firewall/NAT settings
- Try different network (if behind corporate proxy)

### "React DevTools not showing"
- Install React Developer Tools browser extension
- Check if running in development mode

## File Organization Best Practices

```
frontend/
├── public/              # Static files (favicon, etc)
├── src/
│   ├── components/      # Reusable React components
│   │   └── index.ts     # Re-exports for cleaner imports
│   ├── services/        # API/WebSocket clients
│   ├── hooks/           # Custom React hooks (future)
│   ├── utils/           # Helper functions (future)
│   ├── context/         # React Context (future)
│   ├── types/           # TypeScript types (current: types.ts)
│   ├── App.tsx          # Main component
│   ├── index.tsx        # Entry point
│   └── App.css          # Global styles (future)
├── .env.example         # Environment template
├── package.json
├── tsconfig.json
└── README.md
```

## Next Steps

1. **Add Video** — Extend WebRTC to include video tracks
2. **Add Messaging** — Implement text chat with E2EE
3. **State Management** — Integrate Redux or Zustand
4. **Testing** — Add Jest + React Testing Library tests
5. **Mobile** — React Native version
6. **UI Framework** — Material-UI or Tailwind CSS
7. **Analytics** — Add telemetry (privacy-preserving)
8. **Offline Support** — Service Workers for PWA

For more details, see [Main README](README.md).
