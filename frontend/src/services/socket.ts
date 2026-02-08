import { io, Socket } from 'socket.io-client';
import {
  RTCOfferData,
  RTCAnswerData,
  RTCICECandidateData,
} from '../types';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:3000';

class SocketService {
  private socket: Socket | null = null;

  connect(token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.socket = io(SOCKET_URL, {
          auth: {
            token,
          },
          reconnection: true,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          reconnectionAttempts: 5,
        });

        this.socket.on('connect', () => {
          console.log('Socket connected');
          resolve();
        });

        this.socket.on('connect_error', (error) => {
          console.error('Socket connection error:', error);
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  // WebRTC signaling methods
  sendOffer(data: RTCOfferData): void {
    if (!this.socket) return;
    this.socket.emit('webrtc:offer', data);
  }

  onOffer(callback: (data: RTCOfferData) => void): void {
    if (!this.socket) return;
    this.socket.on('webrtc:offer', callback);
  }

  sendAnswer(data: RTCAnswerData): void {
    if (!this.socket) return;
    this.socket.emit('webrtc:answer', data);
  }

  onAnswer(callback: (data: RTCAnswerData) => void): void {
    if (!this.socket) return;
    this.socket.on('webrtc:answer', callback);
  }

  sendICECandidate(data: RTCICECandidateData): void {
    if (!this.socket) return;
    this.socket.emit('webrtc:ice-candidate', data);
  }

  onICECandidate(callback: (data: RTCICECandidateData) => void): void {
    if (!this.socket) return;
    this.socket.on('webrtc:ice-candidate', callback);
  }

  // Call notification events
  onIncomingCall(callback: (data: { from: string; callId: string }) => void): void {
    if (!this.socket) return;
    this.socket.on('call:incoming', callback);
  }

  onCallEnded(callback: (data: { callId: string }) => void): void {
    if (!this.socket) return;
    this.socket.on('call:ended', callback);
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

  offCallEnded(): void {
    if (!this.socket) return;
    this.socket.off('call:ended');
  }
}

const socketService = new SocketService();
export default socketService;
