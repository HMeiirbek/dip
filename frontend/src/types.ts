// User types
export interface User {
  id: string;
  username: string;
}

export interface AuthResponse {
  accessToken: string;
}

export interface RegisterResponse {
  id: string;
  username: string;
}

// Call types
export interface Call {
  id: string;
  callerId: string;
  calleeId: string;
  status: 'created' | 'active' | 'ended';
  createdAt: string;
}

// WebRTC types
export interface RTCOfferData {
  callId: string;
  from: string;
  to: string;
  offer: RTCSessionDescriptionInit;
}

export interface RTCAnswerData {
  callId: string;
  from: string;
  to: string;
  answer: RTCSessionDescriptionInit;
}

export interface RTCICECandidateData {
  callId: string;
  from: string;
  to: string;
  candidate: RTCIceCandidateInit;
}

// App state types
export type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'error';
export type CallStatus = 'idle' | 'incoming' | 'calling' | 'active' | 'ended' | 'error';

export interface AppState {
  authStatus: AuthStatus;
  authError: string | null;
  currentUser: User | null;
  users: User[];
  callStatus: CallStatus;
  activeCall: Call | null;
  incomingCall: Call | null;
  remoteStream: MediaStream | null;
  localStream: MediaStream | null;
}
