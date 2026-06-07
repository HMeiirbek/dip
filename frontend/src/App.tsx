import * as React from 'react';
import { useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react';
import apiService, { getAxiosErrorMessage } from './services/api';
import socketService from './services/socket';
import { LoginForm } from './components/LoginForm';
import { UserList } from './components/UserList';
import { CallsPanel } from './components/CallsPanel';
import { SecurityPanel } from './components/SecurityPanel';
import { RiskPanel } from './components/RiskPanel';
import { AdminPage } from './components/AdminPage';
import { ModeratorPage } from './components/ModeratorPage';
import { UserProfileSettings } from './components/UserPage';
import { ChatsPanel } from './components/ChatsPanel';
import { SupportPanel } from './components/SupportPanel';
import { useControlCenterData } from './hooks/useControlCenterData';

import { TunnelShowcase } from './components/TunnelShowcase';
import { sfuClient } from './services/sfu';
import s from './App.module.css';
import {
  User,
  Call,
  CallStatus as CallStatusType,
  RTCICECandidateData,
} from './types';
import { Users, Phone, MessageCircle, Settings as SettingsIcon, Menu } from 'lucide-react';

const TrafficVisualizer = lazy(() => import('./components/admin/traffic/TrafficVisualizer'));

type TabKey = 'contacts' | 'calls' | 'security' | 'risk' | 'chats' | 'support' | 'moderator' | 'admin' | 'traffic' | 'showcase';
type ThemeMode = 'light' | 'dark';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('calls');
  const activeTabRef = useRef<TabKey>('calls');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const currentUserRef = useRef<User | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('theme') as ThemeMode | null;
    if (saved === 'light' || saved === 'dark') return saved;
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)')?.matches;
    return prefersDark ? 'dark' : 'light';
  });

  const [callStatus, setCallStatus] = useState<CallStatusType>('idle');
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const activeCallRef = useRef<Call | null>(null);
  const [incomingCall, setIncomingCall] = useState<Call | null>(null);
  const incomingCallRef = useRef<Call | null>(null);
  const [remoteUsername, setRemoteUsername] = useState<string | null>(null);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const qualityTimerRef = useRef<number | null>(null);
  const qualityBytesRef = useRef<{ bytes: number; ts: number } | null>(null);
  const moderationPresenceRefreshTimerRef = useRef<number | null>(null);
  const moderationPresenceListenerRef = useRef<((data: { onlineCount: number; at: string }) => void) | null>(null);
  const pendingOfferRef = useRef<RTCSessionDescriptionInit | null>(null);
  const pendingIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);

  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());

  const [notice, setNotice] = useState<string>('');
  const [error, setError] = useState<string>('');

  const isModeratorLike = useMemo(
    () => currentUser?.role === 'admin' || currentUser?.role === 'moderator',
    [currentUser],
  );
  const isAdmin = useMemo(() => currentUser?.role === 'admin', [currentUser]);
  const isModeratorLikeRef = useRef(false);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    isModeratorLikeRef.current = isModeratorLike;
  }, [isModeratorLike]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    activeCallRef.current = activeCall;
  }, [activeCall]);

  useEffect(() => {
    incomingCallRef.current = incomingCall;
  }, [incomingCall]);

  const setMessage = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(''), 3500);
  };

  const setErrorMessage = (msg: string) => {
    setError(msg);
    setTimeout(() => setError(''), 5000);
  };

  const controlCenter = useControlCenterData({
    currentUser,
    isAdmin,
    isModeratorLike,
    setCurrentUser,
    notify: setMessage,
    notifyError: setErrorMessage,
  });
  const { security, risk, admin, moderator } = controlCenter;
  const loadModeratorPresenceRef = useRef(moderator.loadModeratorPresence);

  useEffect(() => {
    loadModeratorPresenceRef.current = moderator.loadModeratorPresence;
  }, [moderator.loadModeratorPresence]);

  const getUserDetails = async (userId: string): Promise<User | null> => {
    try {
      return await apiService.getUser(userId);
    } catch (e) {
      console.error('Error getting user details:', e);
      return null;
    }
  };

  const connectSocketWithToken = async (token: string) => {
    try {
      socketService.disconnect();
      await socketService.connect(token);
      setupSocketListeners();
    } catch (e) {
      console.error('Failed to connect socket:', e);
    }
  };

  const reloadCurrentUser = async () => {
    const base = await apiService.getMe();
    let profile: any = null;
    try {
      profile = await apiService.getMyProfile();
    } catch {
      profile = null;
    }
    setCurrentUser({ ...base, ...(profile || {}) });
  };

  const markCallActiveIfNeeded = async (callId: string) => {
    try {
      await apiService.markCallActive(callId);
    } catch (e: unknown) {
      const message = getAxiosErrorMessage(e);
      if (
        message.includes('call status is active') ||
        message.includes('call status is ended') ||
        message.includes('call has expired')
      ) {
        return;
      }
      throw e;
    }
  };

  useEffect(() => {
    const initializeAuth = async () => {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        console.log('[App] No token in localStorage');
        return;
      }
      console.log('[App] Found token in localStorage, length:', token.length);
      try {
        const user = await apiService.getMe();
        console.log('[App] getMe() succeeded for user:', user.username);
        setCurrentUser(user);
        reloadCurrentUser().catch(() => {});
        await connectSocketWithToken(token);
      } catch (e) {
        console.error('[App] getMe() failed during init:', e);
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
      }
    };
    initializeAuth();

    const handleStreamAdded = (peerId: string, stream: MediaStream) => {
      setRemoteStreams(prev => {
        const next = new Map(prev);
        next.set(peerId, stream);
        return next;
      });
    };
    sfuClient.on('streamAdded', handleStreamAdded);

    return () => {
      sfuClient.off('streamAdded', handleStreamAdded);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      socketService.disconnect();
      stopQualityReporter();
      if (moderationPresenceRefreshTimerRef.current !== null) {
        window.clearTimeout(moderationPresenceRefreshTimerRef.current);
      }
      if (moderationPresenceListenerRef.current) {
        socketService.offPresenceChanged(moderationPresenceListenerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    if (activeTab === 'security') {
      security.loadSecurityData();
    }
    if (activeTab === 'risk') {
      risk.loadRiskData();
    }
    if (activeTab === 'moderator') {
      moderator.loadModeratorOverview();
    }
    if (activeTab === 'admin') {
      admin.loadAdminData();
      moderator.loadModeratorOverview();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, currentUser, isAdmin, isModeratorLike]);

  useEffect(() => {
    if (!currentUser || !isModeratorLike || (activeTab !== 'moderator' && activeTab !== 'admin')) return;
    const id = window.setInterval(() => {
      moderator.loadModeratorOverview({ silent: true });
    }, 15000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, currentUser?.id, isModeratorLike]);

  useEffect(() => {
    if (!currentUser || !isModeratorLike || (activeTab !== 'moderator' && activeTab !== 'admin')) return;
    moderator.loadModeratorPresence();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, currentUser?.id, isModeratorLike]);

  useEffect(() => {
    if (!currentUser || !isModeratorLike || activeTab !== 'moderator') return;
    moderator.loadModeratorFlags();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeTab,
    currentUser?.id,
    isModeratorLike,
    moderator.callFlagsStatus,
    moderator.callFlagsOffset,
    moderator.callFlagsQuery,
    moderator.callFlagsSortBy,
    moderator.callFlagsSortDir,
  ]);

  useEffect(() => {
    if (!currentUser || !isAdmin || activeTab !== 'admin') return;
    const id = window.setInterval(() => {
      admin.loadAdminData();
    }, 15000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, currentUser?.id, isAdmin]);

  useEffect(() => {
    if (activeTab === 'admin' && !isAdmin) {
      setActiveTab(isModeratorLike ? 'moderator' : 'calls');
      return;
    }
    if (activeTab === 'moderator' && isAdmin) {
      setActiveTab('admin');
      return;
    }
    if (activeTab === 'moderator' && !isModeratorLike) {
      setActiveTab('calls');
    }
  }, [activeTab, isAdmin, isModeratorLike]);

  const setupWebRTC = async (
    call: Call,
    options?: { allowReceiveOnlyFallback?: boolean },
  ): Promise<true | null | 'cancelled'> => {
    try {
      let stream: MediaStream | null = null;

      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('MediaDevices API unavailable.');
        }
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log('[SFU] Microphone acquired.');
      } catch (mediaError) {
        if (!options?.allowReceiveOnlyFallback) {
          throw mediaError;
        }
        setMessage('Microphone unavailable. Joining in listen-only mode.');
      }

      await sfuClient.joinRoom(call.id);

      // If destroy() was called while joinRoom was running — clean abort
      if (sfuClient.isDestroyed()) return 'cancelled';

      if (stream) {
        const track = stream.getAudioTracks()[0];
        if (track) {
          await sfuClient.produce(track);
        }
      }

      if (activeCallRef.current?.id) {
        markCallActiveIfNeeded(activeCallRef.current.id).catch(console.error);
      }
      setCallStatus('active');
      return true;
    } catch (e: any) {
      // AwaitQueueStoppedError = call was ended while SFU was setting up; not a real error
      const isQueueStopped =
        e?.name === 'AwaitQueueStoppedError' ||
        e?.message?.includes('queue stopped') ||
        e?.message === 'SFU is destroyed' ||
        e?.message === 'SFU destroyed';
      if (isQueueStopped) {
        console.log('[SFU] Setup cancelled — call ended during connection.');
        return 'cancelled';
      }
      console.error('Error setting up SFU:', e);
      setCallStatus('error');
      return null;
    }
  };

  const stopQualityReporter = () => {
    if (qualityTimerRef.current !== null) {
      window.clearInterval(qualityTimerRef.current);
      qualityTimerRef.current = null;
    }
    qualityBytesRef.current = null;
  };

  const resetRtcState = () => {
    sfuClient.destroy();
    setRemoteStreams(new Map());
    pendingOfferRef.current = null;
    pendingIceCandidatesRef.current = [];

  };

  const collectQualitySample = async (pc: RTCPeerConnection) => {
    const stats = await pc.getStats();
    let rttMs: number | undefined;
    let jitterMs: number | undefined;
    let packetLossPct: number | undefined;
    let bitrateKbps: number | undefined;

    stats.forEach((report) => {
      const asAny = report as any;
      if (report.type === 'candidate-pair' && asAny.state === 'succeeded') {
        if (typeof asAny.currentRoundTripTime === 'number') {
          rttMs = Math.round(asAny.currentRoundTripTime * 1000);
        }
      }

      if (report.type === 'inbound-rtp' && asAny.kind === 'audio') {
        if (typeof asAny.jitter === 'number') {
          jitterMs = Math.round(asAny.jitter * 1000);
        }
        const lost = typeof asAny.packetsLost === 'number' ? asAny.packetsLost : 0;
        const received = typeof asAny.packetsReceived === 'number' ? asAny.packetsReceived : 0;
        const total = lost + received;
        if (total > 0) {
          packetLossPct = Number(((lost / total) * 100).toFixed(2));
        }

        if (typeof asAny.bytesReceived === 'number') {
          const now = Date.now();
          const prev = qualityBytesRef.current;
          if (prev && now > prev.ts) {
            const deltaBytes = Math.max(0, asAny.bytesReceived - prev.bytes);
            const deltaSec = (now - prev.ts) / 1000;
            bitrateKbps = Number((((deltaBytes * 8) / 1000) / deltaSec).toFixed(2));
          }
          qualityBytesRef.current = { bytes: asAny.bytesReceived, ts: now };
        }
      }
    });

    const safeRtt = rttMs ?? 80;
    const safeJitter = jitterMs ?? 12;
    const safeLoss = packetLossPct ?? 0.5;
    const penalty = (safeRtt / 300) + (safeJitter / 120) + (safeLoss / 12);
    const mosLike = Number(Math.max(1, Math.min(5, 5 - penalty)).toFixed(2));

    return {
      rttMs,
      jitterMs,
      packetLossPct,
      mosLike,
      bitrateKbps,
    };
  };

  const startQualityReporter = (callId: string) => {
    stopQualityReporter();
    qualityTimerRef.current = window.setInterval(async () => {
      if (!peerConnectionRef.current) return;
      try {
        const sample = await collectQualitySample(peerConnectionRef.current);
        await apiService.submitCallQuality(callId, sample);
      } catch {
        // ignore transient stats/network errors during call quality reporting
      }
    }, 5000);
  };

  const handleIncomingCall = async (data: { id: string; from: string; to?: string; callerName?: string }) => {
    const callObj: Call = {
      id: data.id,
      callerId: data.from,
      calleeId: data.to || currentUserRef.current?.id || '',
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    incomingCallRef.current = callObj;
    setIncomingCall(callObj);
    setCallStatus('incoming');
    setActiveTab('calls');

    if (data.callerName) {
      setRemoteUsername(data.callerName);
      return;
    }

    getUserDetails(data.from)
      .then((caller) => {
        if (caller) setRemoteUsername(caller.username);
      })
      .catch(() => {});
  };

  const acceptCall = async () => {
    if (!incomingCall || !currentUser) return;

    const callId = incomingCall.id;
    try {
      console.log('[Calls] Accepting call:', callId);
      setCallStatus('calling');
      
      await apiService.acceptCall(callId);

      const joined = await setupWebRTC(incomingCall, {
        allowReceiveOnlyFallback: true,
      });

      // 'cancelled' means the call was ended by the other side during SFU setup — UI already reset
      if (joined === 'cancelled') {
        console.log('[Calls] SFU setup cancelled — call was ended remotely during accept.');
        return;
      }

      if (!joined) {
        console.error('[Calls] Failed to setup SFU for accepting call');
        // Only show error if the call wasn't already ended from the outside
        if (callStatus !== 'idle' && callStatus !== 'ended') {
          setCallStatus('incoming');
          setErrorMessage('Unable to initialize WebRTC audio on this device.');
        }
        return;
      }

      const callObj: Call = {
        id: callId,
        callerId: incomingCall.callerId,
        calleeId: currentUser.id,
        status: 'accepted',
        createdAt: incomingCall.createdAt,
      };
      activeCallRef.current = callObj;
      incomingCallRef.current = null;
      setActiveCall(callObj);
      setIncomingCall(null);
      setCallStatus('active');
    } catch (e) {
      console.error('Error accepting call:', e);
      stopQualityReporter();
      resetRtcState();
      incomingCallRef.current = null;
      setIncomingCall(null);
      setCallStatus('error');
    }
  };

  const rejectCall = async () => {
    if (incomingCall) {
      try {
        await apiService.rejectCall(incomingCall.id);
      } catch (e) {
        console.error('Error rejecting call:', e);
      }
    }
    pendingOfferRef.current = null;
    pendingIceCandidatesRef.current = [];

    incomingCallRef.current = null;
    setIncomingCall(null);
    setCallStatus('idle');
  };

  const assertWebRTCAvailable = () => {
    if (!window.isSecureContext) {
      throw new Error('WebRTC requires secure context. Open via HTTPS or localhost.');
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('MediaDevices API unavailable.');
    }
  };

  const startOutgoingCall = async (calleeId: string) => {
    assertWebRTCAvailable();
    console.log('[Calls] Starting outgoing call to:', calleeId);
    const call = await apiService.createCall(calleeId);
    console.log('[Calls] Call created:', call.id);
    activeCallRef.current = call;
    setActiveCall(call);
    // Do NOT join SFU room yet — wait for callee to accept first
    // SFU join happens in onCallAccepted handler
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
    } catch {}

    try {
      const active = await apiService.getActiveCallMe();
      if (active && samePair(active)) {
        await apiService.endCall(active.id);
        released = true;
      }
    } catch {}

    return released;
  };

  const initiateCall = async (calleeId: string) => {
    if (!currentUser) return;

    try {
      setCallStatus('calling');
      const callee = await getUserDetails(calleeId);
      if (callee) setRemoteUsername(callee.username);
      await startOutgoingCall(calleeId);
    } catch (e: unknown) {
      const maybeAxios = e as { response?: { data?: { message?: string } } };
      const message = maybeAxios?.response?.data?.message;
      if (message === 'There is already an active call between these users') {
        const released = await releaseConflictingCall(calleeId, currentUser.id);
        if (released) {
          await startOutgoingCall(calleeId);
          return;
        }
      }
      setCallStatus('error');
      setErrorMessage(getAxiosErrorMessage(e));
    }
  };

  const endCall = async () => {
    const callToEnd = activeCall || (callStatus === 'calling' ? activeCallRef.current : null);
    if (!callToEnd) {
      // Nothing active — just reset UI
      resetRtcState();
      incomingCallRef.current = null;
      activeCallRef.current = null;
      setActiveCall(null);
      setIncomingCall(null);
      setRemoteUsername(null);
      setCallStatus('idle');
      return;
    }
    stopQualityReporter();
    try {
      await apiService.endCall(callToEnd.id);
    } catch {}

    resetRtcState();
    activeCallRef.current = null;
    setActiveCall(null);
    setRemoteUsername(null);
    setCallStatus('idle');
  };

  useEffect(() => {
    if (callStatus === 'active' && activeCall?.id) {
      startQualityReporter(activeCall.id);
      return;
    }
    stopQualityReporter();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callStatus, activeCall?.id]);

  const setupSocketListeners = () => {
    socketService.offOffer();
    socketService.offAnswer();
    socketService.offICECandidate();
    socketService.offIncomingCall();
    socketService.offCallAccepted();
    socketService.offCallRejected();
    socketService.offCallEnded();
    if (moderationPresenceListenerRef.current) {
      socketService.offPresenceChanged(moderationPresenceListenerRef.current);
    }

    socketService.onIncomingCall(async (data: { from: string; callId: string; callerName?: string }) => {
      if (activeCallRef.current || incomingCallRef.current?.id === data.callId) {
        return;
      }

      await handleIncomingCall({
        id: data.callId,
        from: data.from,
        callerName: data.callerName,
      });
    });

    socketService.onOffer(async () => {
      // Unused in SFU
    });

    socketService.onAnswer(async () => {
      // Unused in SFU
    });

    socketService.onCallAccepted(async (data: { callId: string }) => {
      const call = activeCallRef.current;
      if (!call || call.id !== data.callId) return;
      console.log('[Calls] Call accepted by callee, joining SFU room:', data.callId);
      const joined = await setupWebRTC(call);
      if (!joined) {
        console.error('[Calls] Failed to setup SFU after acceptance');
        try { await apiService.endCall(call.id); } catch {}
        activeCallRef.current = null;
        setActiveCall(null);
        setCallStatus('error');
        setErrorMessage('Failed to establish audio connection.');
        return;
      }
      setCallStatus('active');
    });

    socketService.onCallRejected((data: { callId: string }) => {
      if (activeCallRef.current?.id !== data.callId) return;
      resetRtcState();
      activeCallRef.current = null;
      setActiveCall(null);
      setRemoteUsername(null);
      setCallStatus('ended');
      setMessage('Звонок отклонён.');
      window.setTimeout(() => setCallStatus('idle'), 1500);
    });

    socketService.onICECandidate(async (data: RTCICECandidateData) => {
      if (!peerConnectionRef.current || !peerConnectionRef.current.remoteDescription) {
        pendingIceCandidatesRef.current.push(data.candidate);
        return;
      }
      try {
        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch (e) {
        console.error(e);
      }
    });

    socketService.onCallEnded(async (data: { callId: string; reason?: string }) => {
      const activeMatches = activeCallRef.current?.id === data.callId;
      const incomingMatches = incomingCallRef.current?.id === data.callId;
      if (!activeMatches && !incomingMatches) {
        return;
      }
      stopQualityReporter();
      resetRtcState();
      incomingCallRef.current = null;
      activeCallRef.current = null;
      setIncomingCall(null);
      setActiveCall(null);
      setRemoteUsername(null);
      setCallStatus('ended');
      setMessage(`Call ended: ${data.reason || 'remote end'}`);
      window.setTimeout(() => setCallStatus('idle'), 1200);
    });

    moderationPresenceListenerRef.current = () => {
      if (!isModeratorLikeRef.current || (activeTabRef.current !== 'moderator' && activeTabRef.current !== 'admin')) return;
      if (moderationPresenceRefreshTimerRef.current !== null) {
        window.clearTimeout(moderationPresenceRefreshTimerRef.current);
      }
      moderationPresenceRefreshTimerRef.current = window.setTimeout(() => {
        loadModeratorPresenceRef.current();
      }, 250);
    };
    socketService.onPresenceChanged(moderationPresenceListenerRef.current);
  };

  const handleLogin = async (token: string, username: string) => {
    console.log('[App] handleLogin called for user:', username, 'token length:', token.length);
    try {
      const user = await apiService.getMe();
      console.log('[App] handleLogin: getMe() succeeded');
      setCurrentUser(user);
      reloadCurrentUser().catch(() => {});
      await connectSocketWithToken(token);
      setMessage(`Logged in as ${user.username}`);
    } catch (e) {
      console.error('[App] handleLogin: getMe() failed for user:', username, e);
      setErrorMessage('Login completed but failed to initialize the session');
    }
  };

  const handleLogout = async () => {
    try {
      await apiService.logoutRequest(false);
    } catch {}
    apiService.logout();
    socketService.disconnect();
    setCurrentUser(null);
    activeCallRef.current = null;
    setActiveCall(null);
    incomingCallRef.current = null;
    resetRtcState();
    pendingOfferRef.current = null;
    pendingIceCandidatesRef.current = [];
    setCallStatus('idle');
    stopQualityReporter();
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
  };

  const handleRefreshAuth = async () => {
    try {
      const refreshed = await apiService.refreshAuth();
      await connectSocketWithToken(refreshed.accessToken);
      const user = await apiService.getMe();
      setCurrentUser(user);
      setMessage('Access token refreshed');
    } catch (e) {
      setErrorMessage(getAxiosErrorMessage(e));
    }
  };

  if (!currentUser) {
    return <LoginForm onSuccess={handleLogin} />;
  }

  const accessToken = localStorage.getItem('accessToken') || '';

  return (
    <div className={[s.appShell, isSidebarCollapsed ? s.appShellCollapsed : ''].join(' ')}>
      <aside className={[s.sidebar, isSidebarCollapsed ? s.sidebarHidden : ''].join(' ')}>
        <div className={s.brand}>
          <div className={s.brandDot} />
          <div className={s.brandText}>
            <div className={s.brandTitle}>DIP</div>
            <div className={s.brandSub}>control</div>
          </div>
        </div>

        <div className={s.nav}>
          <NavItem active={activeTab === 'contacts'} label="Contacts" onClick={() => setActiveTab('contacts')} />
          <NavItem active={activeTab === 'calls'} label="Calls" onClick={() => setActiveTab('calls')} />
          <NavItem active={activeTab === 'chats'} label="Chats" onClick={() => setActiveTab('chats')} />
          <NavItem active={activeTab === 'security'} label="Settings" onClick={() => setActiveTab('security')} />
          <NavItem active={activeTab === 'risk'} label="Risk" onClick={() => setActiveTab('risk')} />
          {!isAdmin && isModeratorLike && (
            <NavItem active={activeTab === 'moderator'} label="Moderator" onClick={() => setActiveTab('moderator')} />
          )}
          {isAdmin && (
            <NavItem active={activeTab === 'admin'} label="Admin" onClick={() => setActiveTab('admin')} />
          )}
          {isModeratorLike && (
            <NavItem active={activeTab === 'traffic'} label="Traffic Cloaking" onClick={() => setActiveTab('traffic')} />
          )}
          <NavItem active={activeTab === 'showcase'} label="Security Demo" onClick={() => setActiveTab('showcase')} />
        </div>

      </aside>

      <main className={s.main}>
        <div className={s.topbar}>
          <div className={s.topbarLeft}>
            <button 
              className={s.menuToggleBtn} 
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              title="Toggle Menu"
            >
              <Menu size={20} />
            </button>
            <div>
              <div className={s.topbarTitle}>{activeTab.toUpperCase()}</div>
              <div className={s.topbarHint}>DIP Control Center</div>
            </div>
          </div>
        </div>

        {notice && <div className={s.notice}>{notice}</div>}
        {error && <div className={s.error}>{error}</div>}

        <div className={s.contentWrap}>
          {activeTab === 'contacts' && (
            <UserList
              currentUserId={currentUser.id}
              onCall={initiateCall}
              activeCallId={activeCall?.id || null}
            />
          )}

          {activeTab === 'calls' && (
            <CallsPanel
              currentUserId={currentUser.id}
              callStatus={callStatus}
              activeCall={activeCall}
              incomingCall={incomingCall}
              remoteUsername={remoteUsername}
              canAcceptIncoming={callStatus === 'incoming'}
              onAccept={acceptCall}
              onReject={rejectCall}
              onEnd={endCall}
              remoteStreams={remoteStreams}
              onNavigate={setActiveTab}
            />
          )}

          {activeTab === 'chats' && (
            <ChatsPanel currentUser={currentUser} accessToken={accessToken} />
          )}

          {activeTab === 'security' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <UserProfileSettings
                user={currentUser}
                onLogout={handleLogout}
                onRefreshAuth={handleRefreshAuth}
                onReloadProfile={reloadCurrentUser}
                onNavigate={setActiveTab}
                theme={theme}
                setTheme={setTheme}
              />
              <SecurityPanel
              securitySessions={security.securitySessions}
              securityActivity={security.securityActivity}
              accountNotifications={security.accountNotifications}
              verifyCode={security.verifyCode}
              setVerifyCode={security.setVerifyCode}
              resetIdentifier={security.resetIdentifier}
              setResetIdentifier={security.setResetIdentifier}
              resetCode={security.resetCode}
              setResetCode={security.setResetCode}
              newPassword={security.newPassword}
              setNewPassword={security.setNewPassword}
              onRequestVerify={security.handleVerifyRequest}
              onVerify={security.handleVerifySubmit}
              onRefreshSecurity={security.loadSecurityData}
              onTerminateSession={security.terminateSession}
              onRequestResetCode={security.handleForgotPassword}
              onResetPassword={security.handleResetPassword}
              onMarkNotificationRead={security.markAccountNotificationRead}
            />
            </div>
          )}

          {activeTab === 'risk' && (
            <RiskPanel
              riskAnalysis={risk.riskAnalysis}
              riskMonitor={risk.riskMonitor}
              riskStats={risk.riskStats}
              checkPhone={risk.checkPhone}
              setCheckPhone={risk.setCheckPhone}
              checkPhoneResult={risk.checkPhoneResult}
              reportPhone={risk.reportPhone}
              setReportPhone={risk.setReportPhone}
              reportDescription={risk.reportDescription}
              setReportDescription={risk.setReportDescription}
              onReloadRisk={risk.loadRiskData}
              onCheckNumber={risk.handleCheckNumber}
              onReportNumber={risk.handleReportNumber}
            />
          )}

          {activeTab === 'support' && (
            <SupportPanel />
          )}

          {activeTab === 'moderator' && (
            <ModeratorPage
              isModeratorLike={isModeratorLike}
              role={currentUser.role}
              loading={moderator.moderatorLoading}
              moderatorOverview={moderator.moderatorOverview}
              moderatorPresence={moderator.moderatorPresence}
              callFlags={moderator.callFlags}
              callFlagsStatus={moderator.callFlagsStatus}
              setCallFlagsStatus={moderator.setCallFlagsStatus}
              callFlagsQuery={moderator.callFlagsQuery}
              setCallFlagsQuery={moderator.setCallFlagsQuery}
              callFlagsOffset={moderator.callFlagsOffset}
              setCallFlagsOffset={moderator.setCallFlagsOffset}
              callFlagsLimit={moderator.callFlagsLimit}
              callFlagsTotal={moderator.callFlagsTotal}
              callFlagsSortBy={moderator.callFlagsSortBy}
              setCallFlagsSortBy={moderator.setCallFlagsSortBy}
              callFlagsSortDir={moderator.callFlagsSortDir}
              setCallFlagsSortDir={moderator.setCallFlagsSortDir}
              onReloadModerator={moderator.loadModeratorData}
              onForceEndCall={moderator.forceEndCall}
              onFlagCall={moderator.flagCall}
              onResolveCallFlag={moderator.resolveCallFlag}
              onResolveAllFlagsForCall={moderator.resolveAllFlagsForCall}
            />
          )}

          {activeTab === 'admin' && (
            <AdminPage
              isAdmin={isAdmin}
              currentUserId={currentUser.id}
              loading={admin.adminLoading}
              adminDashboard={admin.adminDashboard}
              adminAnalytics={admin.adminAnalytics}
              adminSlaSummary={admin.adminSlaSummary}
              adminReports={admin.adminReports}
              adminLogs={admin.adminLogs}
              adminUsers={admin.adminUsers}
              adminSessions={admin.adminSessions}
              adminSecurityActivity={admin.adminSecurityActivity}
              adminTrafficLogs={admin.adminTrafficLogs}
              moderatorPresence={moderator.moderatorPresence}
              moderatorOverview={moderator.moderatorOverview}
              mlStatus={admin.mlStatus}
              mlMetrics={admin.mlMetrics}
              blacklist={admin.blacklist}
              blacklistPhone={admin.blacklistPhone}
              setBlacklistPhone={admin.setBlacklistPhone}
              blacklistReason={admin.blacklistReason}
              setBlacklistReason={admin.setBlacklistReason}
              onReloadAdmin={admin.loadAdminData}
              onReloadLiveOps={async () => {
                await Promise.all([
                  moderator.loadModeratorPresence(),
                  moderator.loadModeratorOverview(),
                ]);
              }}
              onReloadMl={admin.handleReloadMl}
              onAddBlacklist={admin.handleAddBlacklist}
              onDeleteBlacklist={admin.deleteBlacklist}
              onUpdateUserRole={admin.updateRole}
              onDeleteUser={admin.deleteUser}
              onForceEndCall={moderator.forceEndCall}
              supportRequests={admin.supportRequests}
              onUpdateSupportRequestStatus={admin.updateSupportRequestStatus}
            />
          )}

          {activeTab === 'traffic' && isModeratorLike && (
            <Suspense fallback={<div style={{ padding: '20px', color: 'var(--muted)' }}>Loading module...</div>}>
              <TrafficVisualizer moderatorOverview={moderator.moderatorOverview} />
            </Suspense>
          )}

          {activeTab === 'showcase' && (
            <TunnelShowcase />
          )}
        </div>
        
        {/* Mobile Bottom Navigation */}
        <div className={s.mobileBottomNav}>
          <button 
            className={[s.mobileNavItem, activeTab === 'contacts' ? s.mobileNavItemActive : ''].join(' ')} 
            onClick={() => setActiveTab('contacts')}
          >
            <Users className={s.mobileNavIcon} size={24} />
            <span className={s.mobileNavLabel}>Контакты</span>
          </button>
          
          <button 
            className={[s.mobileNavItem, activeTab === 'calls' ? s.mobileNavItemActive : ''].join(' ')} 
            onClick={() => setActiveTab('calls')}
          >
            <Phone className={s.mobileNavIcon} size={24} />
            <span className={s.mobileNavLabel}>Звонки</span>
          </button>
          
          <button 
            className={[s.mobileNavItem, activeTab === 'chats' ? s.mobileNavItemActive : ''].join(' ')} 
            onClick={() => setActiveTab('chats')}
          >
            <MessageCircle className={s.mobileNavIcon} size={24} />
            <span className={s.mobileNavLabel}>Чаты</span>
          </button>
          
          <button 
            className={[s.mobileNavItem, activeTab === 'security' ? s.mobileNavItemActive : ''].join(' ')} 
            onClick={() => setActiveTab('security')}
          >
            <SettingsIcon className={s.mobileNavIcon} size={24} />
            <span className={s.mobileNavLabel}>Настройки</span>
          </button>
        </div>
      </main>
    </div>
  );
};

const NavItem: React.FC<{ active: boolean; label: string; onClick: () => void }> = ({
  active,
  label,
  onClick,
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[s.navItem, active ? s.navItemActive : ''].filter(Boolean).join(' ')}
    >
      <span className={[s.navPill, active ? s.navPillActive : ''].filter(Boolean).join(' ')} aria-hidden="true" />
      <span className={s.navLabel}>{label}</span>
    </button>
  );
};
// styles moved to App.module.css

export default App;
