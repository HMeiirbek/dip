import { io, Socket } from 'socket.io-client';
import {
  RTCOfferData,
  RTCAnswerData,
  RTCICECandidateData,
} from '../types';

const getSocketUrl = () => {
  if (process.env.REACT_APP_SOCKET_URL) return process.env.REACT_APP_SOCKET_URL;
  // Fallback: derive socket origin from API URL (backend), because in prod
  // frontend origin (Vercel) differs from backend origin (Render).
  //
  // IMPORTANT: In CRA dev REACT_APP_API_URL might be relative (e.g. '/api/v1'),
  // so we only derive when it's an absolute URL.
  const apiBaseRaw = process.env.REACT_APP_API_URL?.trim();
  if (apiBaseRaw && /^https?:\/\//i.test(apiBaseRaw)) {
    const normalized = apiBaseRaw.replace(/\/+$/, '');
    return normalized
      .replace(/\/api\/v1$/i, '')
      .replace(/\/api$/i, '');
  }

  if (typeof window !== 'undefined') return window.location.origin;
  return 'http://localhost:3000';
};

class SocketService {
  private socket: Socket | null = null;

  connect(token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const socketUrl = getSocketUrl();
        console.log('🔌 [SocketService] Connecting to:', socketUrl);
        console.log('   Environment:', {
          REACT_APP_SOCKET_URL: process.env.REACT_APP_SOCKET_URL,
          REACT_APP_API_URL: process.env.REACT_APP_API_URL,
        });

        this.socket = io(socketUrl, {
          auth: {
            token,
          },
          autoConnect: false,
          reconnection: true,
          reconnectionDelay: 2000,
          reconnectionDelayMax: 10000,
          randomizationFactor: 0.5,
          reconnectionAttempts: 5,
          timeout: 10000,
          transports: ['websocket'],
        });

        this.socket.on('connect', () => {
          console.log('✅ Socket connected, id:', this.socket?.id);
          resolve();
        });

        this.socket.on('connect_error', (error) => {
          console.error('❌ Socket connection error:', error);
          if (this.socket) {
            this.socket.disconnect();
          }
          reject(error);
        });

        this.socket.connect();
      } catch (error) {
        reject(error);
      }
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  updateToken(token: string): void {
    if (this.socket) {
      if (this.socket.auth) {
        (this.socket.auth as any).token = token;
      } else {
        this.socket.auth = { token };
      }
    }
  }

  // WebRTC signaling methods
  sendOffer(data: RTCOfferData): void {
    if (!this.socket) return;
    this.socket.emit('webrtc:offer', {
      callId: data.callId,
      targetUserId: data.to,
      offer: data.offer,
    });
  }

  onOffer(callback: (data: RTCOfferData) => void): void {
    if (!this.socket) return;
    this.socket.on('webrtc:offer', (payload: any) => {
      callback({
        callId: payload.callId,
        from: payload.senderId ?? payload.from,
        to: payload.targetUserId ?? payload.to ?? '',
        offer: payload.offer,
      });
    });
  }

  sendAnswer(data: RTCAnswerData): void {
    if (!this.socket) return;
    this.socket.emit('webrtc:answer', {
      callId: data.callId,
      targetUserId: data.to,
      answer: data.answer,
    });
  }

  onAnswer(callback: (data: RTCAnswerData) => void): void {
    if (!this.socket) return;
    this.socket.on('webrtc:answer', (payload: any) => {
      callback({
        callId: payload.callId,
        from: payload.senderId ?? payload.from,
        to: payload.targetUserId ?? payload.to ?? '',
        answer: payload.answer,
      });
    });
  }

  sendICECandidate(data: RTCICECandidateData): void {
    if (!this.socket) return;
    this.socket.emit('webrtc:ice-candidate', {
      callId: data.callId,
      targetUserId: data.to,
      candidate: data.candidate,
    });
  }

  onICECandidate(callback: (data: RTCICECandidateData) => void): void {
    if (!this.socket) return;
    this.socket.on('webrtc:ice-candidate', (payload: any) => {
      callback({
        callId: payload.callId,
        from: payload.senderId ?? payload.from,
        to: payload.targetUserId ?? payload.to ?? '',
        candidate: payload.candidate,
      });
    });
  }

  // Call notification events
  onIncomingCall(callback: (data: { from: string; callId: string; callerName?: string }) => void): void {
    if (!this.socket) return;
    this.socket.on('call:incoming', (payload: any) => {
      callback({
        from: payload.callerId ?? payload.from,
        callId: payload.callId,
        callerName: payload.callerName,
      });
    });
  }

  onCallAccepted(callback: (data: { callId: string }) => void): void {
    if (!this.socket) return;
    this.socket.on('call:accepted', callback);
  }

  onCallEnded(callback: (data: { callId: string }) => void): void {
    if (!this.socket) return;
    this.socket.on('call:ended', callback);
  }

  onModerationPresenceChanged(callback: (data: { onlineCount: number; at: string }) => void): void {
    if (!this.socket) return;
    this.socket.on('moderation:presence-changed', callback);
  }

  onPresenceChanged(callback: (data: { onlineCount: number; at: string }) => void): void {
    this.onModerationPresenceChanged(callback);
  }

  // Remove listeners
  offOffer(): void {
    if (!this.socket) return;
    this.socket.off('webrtc:offer');
  }

  offAnswer(): void {
    if (!this.socket) return;
    this.socket.off('webrtc:answer');
  }

  offICECandidate(): void {
    if (!this.socket) return;
    this.socket.off('webrtc:ice-candidate');
  }

  offIncomingCall(): void {
    if (!this.socket) return;
    this.socket.off('call:incoming');
  }

  offCallAccepted(): void {
    if (!this.socket) return;
    this.socket.off('call:accepted');
  }

  offCallEnded(): void {
    if (!this.socket) return;
    this.socket.off('call:ended');
  }

  offModerationPresenceChanged(callback?: (data: { onlineCount: number; at: string }) => void): void {
    if (!this.socket) return;
    if (callback) {
      this.socket.off('moderation:presence-changed', callback);
      return;
    }
    this.socket.off('moderation:presence-changed');
  }

  offPresenceChanged(callback?: (data: { onlineCount: number; at: string }) => void): void {
    this.offModerationPresenceChanged(callback);
  }
}

const socketService = new SocketService();
export default socketService;
