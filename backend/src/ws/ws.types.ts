/**
 * WebSocket message types and interfaces for the DIP application
 */

export interface IncomingCallPayload {
  callId: string;
  calleeId?: string;
  callerName?: string;
}

export interface CallRejectedPayload {
  callId: string;
  callerId: string;
}

export interface CallAcceptedPayload {
  callId: string;
  callerId: string;
}

export interface WebRTCOfferPayload {
  callId: string;
  targetUserId: string;
  offer: RTCSessionDescription;
}

export interface WebRTCAnswerPayload {
  callId: string;
  targetUserId: string;
  answer: RTCSessionDescription;
}

export interface ICECandidatePayload {
  callId: string;
  targetUserId: string;
  candidate: RTCIceCandidate;
}

/**
 * Incoming WebSocket events (from client)
 */
export interface WebSocketIncomingEvents {
  'call:incoming': (data: IncomingCallPayload) => void;
  'call:rejected': (data: CallRejectedPayload) => void;
  'call:accepted': (data: CallAcceptedPayload) => void;
  'webrtc:offer': (data: WebRTCOfferPayload) => void;
  'webrtc:answer': (data: WebRTCAnswerPayload) => void;
  'webrtc:ice-candidate': (data: ICECandidatePayload) => void;
}

/**
 * Outgoing WebSocket events (to client)
 */
export interface WebSocketOutgoingEvents {
  'moderation:presence-changed': (data: { onlineCount: number; at: string }) => void;
  'call:incoming': (data: {
    callId: string;
    callerId: string;
    callerName: string;
  }) => void;
  'call:rejected': (data: { callId: string }) => void;
  'call:accepted': (data: { callId: string }) => void;
  'webrtc:offer': (data: {
    callId: string;
    senderId: string;
    offer: RTCSessionDescription;
  }) => void;
  'webrtc:answer': (data: {
    callId: string;
    senderId: string;
    answer: RTCSessionDescription;
  }) => void;
  'webrtc:ice-candidate': (data: {
    callId: string;
    senderId: string;
    candidate: RTCIceCandidate;
  }) => void;
  error: (data: { message: string }) => void;
}
