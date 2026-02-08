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

  // Call state
  const [callStatus, setCallStatus] = useState<CallStatusType>('idle');
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const [incomingCall, setIncomingCall] = useState<RTCOfferData | null>(null);
  const [remoteUsername, setRemoteUsername] = useState<string | null>(null);

  // WebRTC state
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  // Helper to get user details
  const getUserDetails = async (userId: string): Promise<User | null> => {
    try {
      return await apiService.getUser(userId);
    } catch (error) {
      console.error('Error getting user details:', error);
      return null;
    }
  };

  // Initialize handler
  useEffect(() => {
    const initializeAuth = async () => {
      const token = localStorage.getItem('accessToken');
      if (token) {
        try {
          // Try to load current user (this requires a GET /auth/me endpoint)
          // For now, we'll assume auth is valid if token exists
          // In production, you'd want to validate the token
          setCurrentUser({ id: '', username: '' });
        } catch (error) {
          localStorage.removeItem('accessToken');
        }
      }
    };

    initializeAuth();
  }, []);

  // Connect to socket when authenticated
  useEffect(() => {
    if (!currentUser) return;

    const token = localStorage.getItem('accessToken');
    if (!token) return;

    const connectSocket = async () => {
      try {
        await socketService.connect(token);
        setupSocketListeners();
      } catch (error) {
        console.error('Failed to connect to socket:', error);
      }
    };

    connectSocket();

    return () => {
      socketService.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  // Setup WebRTC
  const setupWebRTC = async () => {
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
        if (event.candidate && activeCall) {
          socketService.sendICECandidate({
            callId: activeCall.id,
            from: currentUser!.id,
            to: activeCall.callerId === currentUser!.id ? activeCall.calleeId : activeCall.callerId,
            candidate: event.candidate.toJSON(),
          });
        }
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
    setIncomingCall(data);
    setCallStatus('incoming');
  };

  // Accept incoming call
  const acceptCall = async () => {
    if (!incomingCall || !currentUser) return;

    try {
      setCallStatus('active');
      const pc = await setupWebRTC();
      if (!pc) return;

      // Create and send answer
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socketService.sendAnswer({
        callId: incomingCall.callId,
        from: currentUser.id,
        to: incomingCall.from,
        answer: answer as RTCSessionDescriptionInit,
      });

      const callObj: Call = {
        id: incomingCall.callId,
        callerId: incomingCall.from,
        calleeId: currentUser.id,
        status: 'active',
        createdAt: new Date().toISOString(),
      };
      setActiveCall(callObj);
      setIncomingCall(null);
    } catch (error) {
      console.error('Error accepting call:', error);
      setCallStatus('error');
    }
  };

  // Reject incoming call
  const rejectCall = () => {
    setIncomingCall(null);
    setCallStatus('idle');
  };

  // Initiate call
  const initiateCall = async (calleeId: string) => {
    if (!currentUser) return;

    try {
      setCallStatus('calling');
      const callee = await getUserDetails(calleeId);
      if (callee) {
        setRemoteUsername(callee.username);
      }

      // Create call in backend
      const call = await apiService.createCall(calleeId);
      setActiveCall(call);

      // Setup WebRTC
      const pc = await setupWebRTC();
      if (!pc) return;

      // Create and send offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socketService.sendOffer({
        callId: call.id,
        from: currentUser.id,
        to: calleeId,
        offer: offer as RTCSessionDescriptionInit,
      });
    } catch (error) {
      console.error('Error initiating call:', error);
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
    setCallStatus('idle');
  };

  // Setup socket listeners
  const setupSocketListeners = () => {
    socketService.onOffer(async (data: RTCOfferData) => {
      if (!peerConnectionRef.current || !currentUser) return;

      try {
        const offer = new RTCSessionDescription(data.offer);
        await peerConnectionRef.current.setRemoteDescription(offer);

        // Get caller details
        const caller = await getUserDetails(data.from);
        if (caller) {
          setRemoteUsername(caller.username);
        }

        // Signal incoming call
        handleIncomingCall({
          id: data.callId,
          from: data.from,
          to: data.to,
        });
      } catch (error) {
        console.error('Error handling offer:', error);
      }
    });

    socketService.onAnswer(async (data: RTCAnswerData) => {
      if (!peerConnectionRef.current) return;

      try {
        const answer = new RTCSessionDescription(data.answer);
        await peerConnectionRef.current.setRemoteDescription(answer);
        setCallStatus('active');
      } catch (error) {
        console.error('Error handling answer:', error);
      }
    });

    socketService.onICECandidate(async (data: RTCICECandidateData) => {
      if (!peerConnectionRef.current) return;

      try {
        const candidate = new RTCIceCandidate(data.candidate);
        await peerConnectionRef.current.addIceCandidate(candidate);
      } catch (error) {
        console.error('Error adding ICE candidate:', error);
      }
    });
  };

  // Login handler
  const handleLogin = async (username: string) => {
    // In a real app, you'd fetch the full user object from the server
    const users = await apiService.getUsers();
    const user = users.find((u) => u.username === username);
    if (user) {
      setCurrentUser(user);
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
                incomingCall={null}
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
