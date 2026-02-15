import React, { useEffect, useState, useRef } from 'react';
import apiService from './services/api';
import socketService from './services/socket';
import { LoginForm } from './components/LoginForm';
import { UserList } from './components/UserList';
import { CallStatus } from './components/CallStatus';
import { AudioStream } from './components/AudioStream';
import { User, Call, CallStatus as CallStatusType, RTCOfferData, RTCAnswerData, RTCICECandidateData } from './types';

export const App: React.FC = () => {
  // Auth state
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const currentUserRef = useRef<User | null>(null);

  // Call state
  const [callStatus, setCallStatus] = useState<CallStatusType>('idle');
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const activeCallRef = useRef<Call | null>(null);
  const [incomingCall, setIncomingCall] = useState<Call | null>(null);
  const [remoteUsername, setRemoteUsername] = useState<string | null>(null);

  // WebRTC state
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const pendingOfferRef = useRef<RTCSessionDescriptionInit | null>(null);
  const pendingIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  useEffect(() => {
    activeCallRef.current = activeCall;
  }, [activeCall]);

  // Helper to get user details
  const getUserDetails = async (userId: string): Promise<User | null> => {
    try {
      return await apiService.getUser(userId);
    } catch (error) {
      console.error('Error getting user details:', error);
      return null;
    }
  };

  const connectSocketWithToken = async (token: string) => {
    try {
      socketService.disconnect();
      await socketService.connect(token);
      setupSocketListeners();
    } catch (error) {
      console.error('Failed to connect to socket:', error);
    }
  };

  // Initialize handler
  useEffect(() => {
    const initializeAuth = async () => {
      const token = localStorage.getItem('accessToken');
      if (token) {
        try {
          // Fetch current user details with the stored token
          const user = await apiService.getMe();
          setCurrentUser(user);
          await connectSocketWithToken(token);
        } catch (error) {
          console.log('Token was invalid or expired, clearing');
          localStorage.removeItem('accessToken');
        }
      }
    };

    initializeAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      socketService.disconnect();
    };
  }, []);

  // Setup WebRTC
  const setupWebRTC = async (call: Call, localUserId: string) => {
    try {
      // Get local audio stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setLocalStream(stream);

      // Create peer connection
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: ['stun:stun.l.google.com:19302'] }],
      });

      // Add local stream tracks
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      // Handle remote stream
      pc.ontrack = (event) => {
        console.log('Received remote track:', event.track.kind);
        setRemoteStream(event.streams[0]);
      };

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (!event.candidate) return;
        const remoteUserId = call.callerId === localUserId ? call.calleeId : call.callerId;
        socketService.sendICECandidate({
          callId: call.id,
          from: localUserId,
          to: remoteUserId,
          candidate: event.candidate.toJSON(),
        });
      };

      // Handle connection state changes
      pc.onconnectionstatechange = () => {
        console.log('Connection state:', pc.connectionState);
        if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          setCallStatus('ended');
          endCall();
        }
      };

      peerConnectionRef.current = pc;
      return pc;
    } catch (error) {
      console.error('Error setting up WebRTC:', error);
      if (!window.isSecureContext) {
        console.error('WebRTC requires a secure context (HTTPS) on mobile browsers.');
      }
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.error('MediaDevices API unavailable: getUserMedia is not supported here.');
      }
      setCallStatus('error');
      return null;
    }
  };

  // Handle incoming call
  const handleIncomingCall = async (data: any) => {
    console.log('Incoming call:', data);
    const caller = await getUserDetails(data.from);
    if (caller) {
      setRemoteUsername(caller.username);
    }
    const callObj: Call = {
      id: data.id,
      callerId: data.from,
      calleeId: data.to || currentUserRef.current?.id || '',
      status: 'created',
      createdAt: new Date().toISOString(),
    };
    setIncomingCall(callObj);
    setCallStatus('incoming');
  };

  // Accept incoming call
  const acceptCall = async () => {
    if (!incomingCall || !currentUser) return;

    try {
      setCallStatus('active');
      const pc = await setupWebRTC(incomingCall, currentUser.id);
      if (!pc) {
        await apiService.rejectCall(incomingCall.id);
        setIncomingCall(null);
        setCallStatus('error');
        return;
      }

      if (!pendingOfferRef.current) {
        console.error('No pending remote offer when accepting call');
        setCallStatus('error');
        return;
      }

      await pc.setRemoteDescription(new RTCSessionDescription(pendingOfferRef.current));
      pendingOfferRef.current = null;

      while (pendingIceCandidatesRef.current.length > 0) {
        const candidate = pendingIceCandidatesRef.current.shift();
        if (candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
      }

      // Create and send answer
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socketService.sendAnswer({
        callId: incomingCall.id,
        from: currentUser.id,
        to: incomingCall.callerId,
        answer: answer as RTCSessionDescriptionInit,
      });

      try {
        await apiService.acceptCall(incomingCall.id);
      } catch (error: any) {
        // Do not fail the call setup if REST accept is transiently failing on mobile.
        console.error('acceptCall API failed:', error?.response?.data || error?.message || error);
      }

      try {
        await apiService.markCallActive(incomingCall.id);
      } catch (error: any) {
        console.error('markCallActive (callee side) failed:', error?.response?.data || error?.message || error);
      }

      const callObj: Call = {
        id: incomingCall.id,
        callerId: incomingCall.callerId,
        calleeId: currentUser.id,
        status: 'active',
        createdAt: incomingCall.createdAt,
      };
      setActiveCall(callObj);
      setIncomingCall(null);
    } catch (error) {
      console.error('Error accepting call:', error);
      try {
        await apiService.rejectCall(incomingCall.id);
      } catch (rejectError) {
        console.error('Error rejecting failed incoming call:', rejectError);
      }
      setCallStatus('error');
    }
  };

  // Reject incoming call
  const rejectCall = async () => {
    if (incomingCall) {
      try {
        await apiService.rejectCall(incomingCall.id);
      } catch (error) {
        console.error('Error rejecting call:', error);
      }
    }
    pendingOfferRef.current = null;
    pendingIceCandidatesRef.current = [];
    setIncomingCall(null);
    setCallStatus('idle');
  };

  // Initiate call
  const assertWebRTCAvailable = () => {
    if (!window.isSecureContext) {
      throw new Error('WebRTC requires secure context. Open the app via HTTPS (or localhost).');
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('MediaDevices API is unavailable in this browser/context.');
    }
  };

  const startOutgoingCall = async (calleeId: string, currentUserId: string) => {
    // Do not create backend call if media capture cannot start.
    assertWebRTCAvailable();

    console.log('📞 [initiateCall] Creating call in backend...');
    const call = await apiService.createCall(calleeId);
    console.log('✅ [initiateCall] Call created, id:', call.id);
    setActiveCall(call);

    // Setup WebRTC
    console.log('📞 [initiateCall] Setting up WebRTC...');
    const pc = await setupWebRTC(call, currentUserId);
    if (!pc) {
      console.error('❌ [initiateCall] WebRTC setup failed');
      await apiService.endCall(call.id);
      setActiveCall(null);
      return;
    }

    // Create and send offer
    console.log('📞 [initiateCall] Creating offer...');
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    console.log('📞 [initiateCall] Sending offer via WebSocket...');

    socketService.sendOffer({
      callId: call.id,
      from: currentUserId,
      to: calleeId,
      offer: offer as RTCSessionDescriptionInit,
    });
    console.log('✅ [initiateCall] Offer sent');
  };

  const releaseConflictingCall = async (calleeId: string, currentUserId: string): Promise<boolean> => {
    let released = false;
    const samePair = (call: Call | null) =>
      !!call &&
      ((call.callerId === currentUserId && call.calleeId === calleeId) ||
        (call.callerId === calleeId && call.calleeId === currentUserId));

    try {
      const pending = await apiService.getPendingCallMe();
      if (pending && samePair(pending)) {
        await apiService.endCall(pending.id);
        released = true;
      }
    } catch (error) {
      console.error('Failed to release pending conflicting call:', error);
    }

    try {
      const active = await apiService.getActiveCallMe();
      if (active && samePair(active)) {
        await apiService.endCall(active.id);
        released = true;
      }
    } catch (error) {
      console.error('Failed to release active conflicting call:', error);
    }

    return released;
  };

  const initiateCall = async (calleeId: string) => {
    if (!currentUser) return;

    try {
      console.log('📞 [initiateCall] Starting call to:', calleeId);
      setCallStatus('calling');
      const callee = await getUserDetails(calleeId);
      if (callee) {
        console.log('📞 [initiateCall] Callee:', callee.username);
        setRemoteUsername(callee.username);
      }

      await startOutgoingCall(calleeId, currentUser.id);
    } catch (error) {
      const err = error as any;
      console.error('❌ [initiateCall] Error:', err);
      console.error('❌ [initiateCall] Backend message:', err?.response?.data);

      if (err?.response?.data?.message === 'There is already an active call between these users') {
        const released = await releaseConflictingCall(calleeId, currentUser.id);
        if (released) {
          try {
            console.log('🔄 [initiateCall] Retrying after releasing conflicting call');
            await startOutgoingCall(calleeId, currentUser.id);
            return;
          } catch (retryError) {
            console.error('❌ [initiateCall] Retry failed:', retryError);
          }
        }
      }

      setCallStatus('error');
    }
  };

  // End call
  const endCall = async () => {
    if (!activeCall) return;

    try {
      await apiService.endCall(activeCall.id);
    } catch (error) {
      console.error('Error ending call:', error);
    }

    // Clean up WebRTC
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    // Stop local stream
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
      setLocalStream(null);
    }

    setRemoteStream(null);
    setActiveCall(null);
    setRemoteUsername(null);
    pendingOfferRef.current = null;
    pendingIceCandidatesRef.current = [];
    setCallStatus('idle');
  };

  // Setup socket listeners
  const setupSocketListeners = () => {
    console.log('📡 [SocketListeners] Setting up WebRTC signal handlers');
    
    socketService.onOffer(async (data: RTCOfferData) => {
      console.log('📬 [webrtc:offer] Received offer from:', data.from, 'callId:', data.callId);
      if (!currentUserRef.current) {
        console.warn('⚠️ [webrtc:offer] currentUser not ready');
        return;
      }

      try {
        pendingOfferRef.current = data.offer;
        pendingIceCandidatesRef.current = [];
        console.log('✅ [webrtc:offer] Offer buffered until accept');

        // Get caller details
        const caller = await getUserDetails(data.from);
        if (caller) {
          setRemoteUsername(caller.username);
        }

        // Signal incoming call
        console.log('🔔 [webrtc:offer] Calling handleIncomingCall');
        handleIncomingCall({
          id: data.callId,
          from: data.from,
          to: data.to,
        });
      } catch (error) {
        console.error('❌ [webrtc:offer] Error:', error);
      }
    });

    socketService.onAnswer(async (data: RTCAnswerData) => {
      console.log('📬 [webrtc:answer] Received answer from:', data.from);
      if (!peerConnectionRef.current) {
        console.warn('⚠️ [webrtc:answer] PC not ready');
        return;
      }

      try {
        const answer = new RTCSessionDescription(data.answer);
        await peerConnectionRef.current.setRemoteDescription(answer);
        console.log('✅ [webrtc:answer] Remote description set');

        while (pendingIceCandidatesRef.current.length > 0) {
          const candidate = pendingIceCandidatesRef.current.shift();
          if (candidate) {
            await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
          }
        }

        if (activeCallRef.current) {
          await apiService.markCallActive(activeCallRef.current.id);
        }

        setCallStatus('active');
      } catch (error) {
        console.error('❌ [webrtc:answer] Error:', error);
      }
    });

    socketService.onICECandidate(async (data: RTCICECandidateData) => {
      console.log('📬 [webrtc:ice] Received ICE candidate');
      if (!peerConnectionRef.current || !peerConnectionRef.current.remoteDescription) {
        pendingIceCandidatesRef.current.push(data.candidate);
        console.log('🧊 [webrtc:ice] Candidate buffered');
        return;
      }

      try {
        const candidate = new RTCIceCandidate(data.candidate);
        await peerConnectionRef.current.addIceCandidate(candidate);
      } catch (error) {
        console.error('❌ [webrtc:ice] Error:', error);
      }
    });
  };

  // Login handler
  const handleLogin = async (token: string, username: string) => {
    try {
      await connectSocketWithToken(token);
      const user = await apiService.getMe();
      setCurrentUser(user);
    } catch (error) {
      console.error('Failed to get user details after login:', error);
      // If getMe fails, try the fallback method
      const users = await apiService.getUsers();
      const user = users.find((u) => u.username === username);
      if (user) {
        setCurrentUser(user);
      }
    }
  };

  // Logout handler
  const handleLogout = () => {
    apiService.logout();
    socketService.disconnect();
    setCurrentUser(null);
    setActiveCall(null);
    setIncomingCall(null);
    setRemoteStream(null);
    setLocalStream(null);
    pendingOfferRef.current = null;
    pendingIceCandidatesRef.current = [];
    setCallStatus('idle');
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
  };

  if (!currentUser) {
    return <LoginForm onSuccess={handleLogin} />
  }

  return (
    <div style={styles.app}>
      <div style={styles.container}>
        {/* Header */}
        <div style={styles.header}>
          <div>
            <h1 style={styles.appTitle}>🔐 DIP</h1>
            <p style={styles.appSubtitle}>Secure Voice Communication</p>
          </div>
          <div>
            <span style={styles.username}>👤 {currentUser.username}</span>
            <button onClick={handleLogout} style={styles.logoutButton}>
              Logout
            </button>
          </div>
        </div>

        {/* Main content */}
        <div style={styles.content}>
          {/* Left: Users list */}
          <div style={styles.leftPanel}>
            <UserList
              currentUserId={currentUser.id}
              onCall={initiateCall}
              activeCallId={activeCall?.id || null}
            />
          </div>

          {/* Right: Call status and audio */}
          <div style={styles.rightPanel}>
            <div style={styles.statusSection}>
              <CallStatus
                status={callStatus}
                activeCall={activeCall}
                incomingCall={incomingCall}
                remoteUsername={remoteUsername}
                onAccept={acceptCall}
                onReject={rejectCall}
                onEnd={endCall}
              />
            </div>

            {(callStatus === 'active' || callStatus === 'calling') && (
              <div style={styles.audioSection}>
                <div style={styles.audioGrid}>
                  <AudioStream
                    stream={localStream}
                    isMuted={true}
                    label="Your Audio (Local)"
                  />
                  <AudioStream
                    stream={remoteStream}
                    isMuted={false}
                    label="Remote Audio"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const styles = {
  app: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    padding: '20px',
  } as React.CSSProperties,

  container: {
    maxWidth: '1200px',
    margin: '0 auto',
  } as React.CSSProperties,

  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: 'white',
    padding: '20px',
    borderRadius: '12px',
    marginBottom: '20px',
    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
  } as React.CSSProperties,

  appTitle: {
    color: '#667eea',
    margin: 0,
    fontSize: '28px',
  } as React.CSSProperties,

  appSubtitle: {
    color: '#888',
    margin: '5px 0 0 0',
    fontSize: '12px',
  } as React.CSSProperties,

  username: {
    color: '#666',
    marginRight: '15px',
    fontSize: '14px',
    fontWeight: '500',
  } as React.CSSProperties,

  logoutButton: {
    padding: '8px 16px',
    background: '#e74c3c',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
  } as React.CSSProperties,

  content: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '20px',
  } as React.CSSProperties,

  leftPanel: {
    minHeight: '400px',
  } as React.CSSProperties,

  rightPanel: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '20px',
  } as React.CSSProperties,

  statusSection: {
    display: 'flex',
    justifyContent: 'center',
    minHeight: '200px',
    alignItems: 'center',
  } as React.CSSProperties,

  audioSection: {
    background: 'white',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
  } as React.CSSProperties,

  audioGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '15px',
  } as React.CSSProperties,
};

export default App;
