import * as React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import apiService, { getAxiosErrorMessage } from './services/api';
import socketService from './services/socket';
import { LoginForm } from './components/LoginForm';
import { CallsPanel } from './components/CallsPanel';
import { SecurityPanel } from './components/SecurityPanel';
import { RiskPanel } from './components/RiskPanel';
import { AdminPage } from './components/AdminPage';
import { ModeratorPage } from './components/ModeratorPage';
import { UserDrawer } from './components/UserPage';
import { ChatsPanel } from './components/ChatsPanel';
import { SupportPanel } from './components/SupportPanel';
import { useControlCenterData } from './hooks/useControlCenterData';
import { TrafficVisualizer } from './components/TrafficVisualizer';
import s from './App.module.css';
import {
  User,
  Call,
  CallStatus as CallStatusType,
  RTCOfferData,
  RTCAnswerData,
  RTCICECandidateData,
} from './types';

type TabKey = 'calls' | 'security' | 'risk' | 'chats' | 'support' | 'moderator' | 'admin' | 'traffic';
type ThemeMode = 'light' | 'dark';

const parseCsv = (value?: string) =>
  (value || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

const getIceServers = (): RTCIceServer[] => {
  const json = process.env.REACT_APP_ICE_SERVERS_JSON;
  if (json) {
    try {
      const parsed = JSON.parse(json);
      if (Array.isArray(parsed) && parsed.length) return parsed;
    } catch {
      // fallback to env-based parsing below
    }
  }

  const stunUrls = parseCsv(process.env.REACT_APP_STUN_URLS);
  const turnUrls = parseCsv(process.env.REACT_APP_TURN_URLS);
  const turnUsername = process.env.REACT_APP_TURN_USERNAME;
  const turnCredential = process.env.REACT_APP_TURN_CREDENTIAL;

  const servers: RTCIceServer[] = [];
  if (stunUrls.length) {
    servers.push({ urls: stunUrls });
  } else {
    servers.push({ urls: ['stun:stun.l.google.com:19302'] });
  }

  if (turnUrls.length && turnUsername && turnCredential) {
    servers.push({
      urls: turnUrls,
      username: turnUsername,
      credential: turnCredential,
    });
  }

  return servers;
};

const getIceTransportPolicy = (): RTCIceTransportPolicy => {
  const value = `${process.env.REACT_APP_ICE_TRANSPORT_POLICY || 'all'}`.toLowerCase();
  return value === 'relay' ? 'relay' : 'all';
};

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('calls');
  const activeTabRef = useRef<TabKey>('calls');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const currentUserRef = useRef<User | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
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
  const remoteMediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const [incomingOfferReady, setIncomingOfferReady] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [audioPlaybackUnlockKey, setAudioPlaybackUnlockKey] = useState(0);

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

  const unlockAudioPlayback = async () => {
    if (typeof window === 'undefined') {
      return;
    }

    const AudioContextCtor =
      window.AudioContext ||
      ((window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);

    if (!AudioContextCtor) {
      setAudioPlaybackUnlockKey((value) => value + 1);
      return;
    }

    try {
      const context = audioContextRef.current ?? new AudioContextCtor();
      audioContextRef.current = context;
      if (context.state === 'suspended') {
        await context.resume();
      }
    } catch (e) {
      console.error('Failed to unlock audio playback:', e);
    } finally {
      setAudioPlaybackUnlockKey((value) => value + 1);
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
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
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
    localUserId: string,
    options?: { allowReceiveOnlyFallback?: boolean },
  ) => {
    try {
      let stream: MediaStream | null = null;
      let receiveOnly = false;

      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('MediaDevices API unavailable.');
        }
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setLocalStream(stream);
      } catch (mediaError) {
        if (!options?.allowReceiveOnlyFallback) {
          throw mediaError;
        }
        receiveOnly = true;
        setLocalStream(null);
        setMessage(
          window.isSecureContext
            ? 'Microphone unavailable. Joining in listen-only mode.'
            : 'Microphone access is blocked on insecure HTTP. Joining in listen-only mode.',
        );
      }

      const pc = new RTCPeerConnection({
        iceServers: getIceServers(),
        iceTransportPolicy: getIceTransportPolicy(),
        iceCandidatePoolSize: 4,
      });
      remoteMediaStreamRef.current = null;

      if (stream) {
        stream.getTracks().forEach((track) => pc.addTrack(track, stream!));
      } else if (receiveOnly) {
        pc.addTransceiver('audio', { direction: 'recvonly' });
      }

      pc.ontrack = (event) => {
        const targetStream = remoteMediaStreamRef.current || new MediaStream();
        remoteMediaStreamRef.current = targetStream;
        const publishRemoteStream = () => {
          setRemoteStream(new MediaStream(targetStream.getTracks()));
        };

        if (event.streams?.[0]) {
          event.streams[0].getTracks().forEach((track) => {
            if (!targetStream.getTracks().some((existing) => existing.id === track.id)) {
              targetStream.addTrack(track);
            }
          });
        } else if (!targetStream.getTracks().some((existing) => existing.id === event.track.id)) {
          targetStream.addTrack(event.track);
        }

        event.track.onunmute = publishRemoteStream;
        event.track.onmute = publishRemoteStream;
        event.track.onended = publishRemoteStream;
        publishRemoteStream();
      };

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

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') {
          setActiveCall((prev) => (prev ? { ...prev, status: 'active' } : prev));
          setCallStatus('active');
          if (activeCallRef.current?.id) {
            markCallActiveIfNeeded(activeCallRef.current.id).catch((e) => {
              console.error('Failed to mark call active:', e);
            });
          }
          return;
        }

        if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          setCallStatus('ended');
          stopQualityReporter();
          endCall();
        }
      };

      peerConnectionRef.current = pc;
      return pc;
    } catch (e) {
      console.error('Error setting up WebRTC:', e);
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
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    setLocalStream((prev) => {
      prev?.getTracks().forEach((track) => track.stop());
      return null;
    });
    remoteMediaStreamRef.current = null;
    setRemoteStream(null);
    pendingOfferRef.current = null;
    pendingIceCandidatesRef.current = [];
    setIncomingOfferReady(false);
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

    try {
      await unlockAudioPlayback();
      setCallStatus('calling');
      const pc = await setupWebRTC(incomingCall, currentUser.id, {
        allowReceiveOnlyFallback: true,
      });
      if (!pc) {
        setCallStatus('incoming');
        setErrorMessage(
          window.isSecureContext
            ? 'Unable to initialize WebRTC audio on this device.'
            : 'On mobile browsers microphone access requires HTTPS or localhost. Open the app through a secure tunnel.',
        );
        return;
      }

      if (!pendingOfferRef.current) {
        setMessage('Waiting for call signaling...');
        setCallStatus('incoming');
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

      const answer = await pc.createAnswer();
      const localDescriptionSet = pc.setLocalDescription(answer);
      const acceptRequest = apiService.acceptCall(incomingCall.id).catch((e) => {
        console.error('DB accept failed:', e);
        return null;
      });

      await localDescriptionSet;

      socketService.sendAnswer({
        callId: incomingCall.id,
        from: currentUser.id,
        to: incomingCall.callerId,
        answer: answer as RTCSessionDescriptionInit,
      });

      const callObj: Call = {
        id: incomingCall.id,
        callerId: incomingCall.callerId,
        calleeId: currentUser.id,
        status: 'accepted',
        createdAt: incomingCall.createdAt,
      };
      activeCallRef.current = callObj;
      incomingCallRef.current = null;
      setActiveCall(callObj);
      setIncomingCall(null);
      setIncomingOfferReady(false);
      setCallStatus('active');

      void acceptRequest;
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
    setIncomingOfferReady(false);
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

  const startOutgoingCall = async (calleeId: string, currentUserId: string) => {
    assertWebRTCAvailable();
    const call = await apiService.createCall(calleeId);
    activeCallRef.current = call;
    setActiveCall(call);

    const pc = await setupWebRTC(call, currentUserId);
    if (!pc) {
      await apiService.endCall(call.id);
      activeCallRef.current = null;
      setActiveCall(null);
      return;
    }

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    socketService.sendOffer({
      callId: call.id,
      from: currentUserId,
      to: calleeId,
      offer: offer as RTCSessionDescriptionInit,
    });
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
      await unlockAudioPlayback();
      setCallStatus('calling');
      const callee = await getUserDetails(calleeId);
      if (callee) setRemoteUsername(callee.username);
      await startOutgoingCall(calleeId, currentUser.id);
    } catch (e: unknown) {
      const maybeAxios = e as { response?: { data?: { message?: string } } };
      const message = maybeAxios?.response?.data?.message;
      if (message === 'There is already an active call between these users') {
        const released = await releaseConflictingCall(calleeId, currentUser.id);
        if (released) {
          await startOutgoingCall(calleeId, currentUser.id);
          return;
        }
      }
      setCallStatus('error');
      setErrorMessage(getAxiosErrorMessage(e));
    }
  };

  const endCall = async () => {
    if (!activeCall) return;
    stopQualityReporter();
    try {
      await apiService.endCall(activeCall.id);
    } catch {}

    resetRtcState();
    activeCallRef.current = null;
    setActiveCall(null);
    setRemoteUsername(null);
    setCallStatus('idle');
  };

  useEffect(() => {
    if (callStatus === 'active' && activeCall?.id && peerConnectionRef.current) {
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
    socketService.offCallEnded();
    if (moderationPresenceListenerRef.current) {
      socketService.offPresenceChanged(moderationPresenceListenerRef.current);
    }

    socketService.onIncomingCall(async (data: { from: string; callId: string; callerName?: string }) => {
      if (activeCallRef.current || incomingCallRef.current?.id === data.callId) {
        return;
      }
      setIncomingOfferReady(false);
      await handleIncomingCall({
        id: data.callId,
        from: data.from,
        callerName: data.callerName,
      });
    });

    socketService.onOffer(async (data: RTCOfferData) => {
      if (!currentUserRef.current) return;
      pendingOfferRef.current = data.offer;
      pendingIceCandidatesRef.current = [];
      setIncomingOfferReady(true);

      if (incomingCallRef.current?.id !== data.callId) {
        void handleIncomingCall({ id: data.callId, from: data.from, to: data.to });
      } else {
        setCallStatus('incoming');
        setActiveTab('calls');
        getUserDetails(data.from)
          .then((caller) => {
            if (caller) setRemoteUsername(caller.username);
          })
          .catch(() => {});
      }
    });

    socketService.onCallAccepted((data: { callId: string }) => {
      if (activeCallRef.current?.id !== data.callId) {
        return;
      }

      activeCallRef.current = activeCallRef.current
        ? { ...activeCallRef.current, status: 'accepted' }
        : activeCallRef.current;
      setActiveCall((prev) => (prev && prev.id === data.callId ? { ...prev, status: 'accepted' } : prev));
      setMessage('Call accepted. Connecting audio...');
      setCallStatus((prev) => (prev === 'active' ? prev : 'calling'));
      setActiveTab('calls');
    });

    socketService.onAnswer(async (data: RTCAnswerData) => {
      if (!peerConnectionRef.current) return;
      try {
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
        while (pendingIceCandidatesRef.current.length > 0) {
          const candidate = pendingIceCandidatesRef.current.shift();
          if (candidate) {
            await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
          }
        }
        if (activeCallRef.current) {
          activeCallRef.current = { ...activeCallRef.current, status: 'active' };
          setActiveCall((prev) => (prev ? { ...prev, status: 'active' } : prev));
          setCallStatus('active');
          markCallActiveIfNeeded(activeCallRef.current.id).catch((e) => {
            console.error('Failed to mark call active after answer:', e);
          });
          return;
        }
        setCallStatus('active');
      } catch (e) {
        console.error(e);
      }
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
    setIncomingCall(null);
    setRemoteStream(null);
    setLocalStream(null);
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
    <div className={s.appShell}>
      <aside className={s.sidebar}>
        <div className={s.brand}>
          <div className={s.brandDot} />
          <div className={s.brandText}>
            <div className={s.brandTitle}>DIP</div>
            <div className={s.brandSub}>control</div>
          </div>
        </div>

        <div className={s.nav}>
          <NavItem active={activeTab === 'calls'} label="Calls" onClick={() => setActiveTab('calls')} />
          <NavItem active={activeTab === 'chats'} label="Chats" onClick={() => setActiveTab('chats')} />
          <NavItem active={activeTab === 'security'} label="Security" onClick={() => setActiveTab('security')} />
          <NavItem active={activeTab === 'risk'} label="Risk" onClick={() => setActiveTab('risk')} />
          {!isAdmin && isModeratorLike && (
            <NavItem active={activeTab === 'moderator'} label="Moderator" onClick={() => setActiveTab('moderator')} />
          )}
          {isAdmin && (
            <NavItem active={activeTab === 'admin'} label="Admin" onClick={() => setActiveTab('admin')} />
          )}
        </div>

        <div className={s.sidebarFooter}>
          <button type="button" className={s.profileBtn} onClick={() => setProfileOpen(true)} title="Profile">
            <span className={s.profileAvatar} aria-hidden="true">
              {(currentUser.username?.[0] || 'U').toUpperCase()}
            </span>
            <span className={s.profileText}>
              <span className={s.profileName}>{currentUser.username}</span>
              <span className={s.profileMeta}>{currentUser.role || 'user'}</span>
            </span>
          </button>
        </div>
      </aside>

      <main className={s.main}>
        <div className={s.topbar}>
          <div className={s.topbarLeft}>
            <div className={s.topbarTitle}>{activeTab.toUpperCase()}</div>
            <div className={s.topbarHint}>DIP Control Center</div>
          </div>
          <div className={s.topbarActions}>
            <button
              type="button"
              onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
              className={s.topbarButton}
              title="Toggle theme"
            >
              {theme === 'dark' ? 'Light' : 'Dark'}
            </button>
            <button onClick={handleRefreshAuth} className={s.topbarButton}>Refresh</button>
            <button onClick={handleLogout} className={s.topbarDanger}>Logout</button>
          </div>
        </div>

        {notice && <div className={s.notice}>{notice}</div>}
        {error && <div className={s.error}>{error}</div>}

        <div className={s.contentWrap}>
          {activeTab === 'calls' && (
            <CallsPanel
              currentUserId={currentUser.id}
              onCall={initiateCall}
              activeCallId={activeCall?.id || null}
              callStatus={callStatus}
              activeCall={activeCall}
              incomingCall={incomingCall}
              remoteUsername={remoteUsername}
              canAcceptIncoming={incomingOfferReady}
              onAccept={acceptCall}
              onReject={rejectCall}
              onEnd={endCall}
              localStream={localStream}
              remoteStream={remoteStream}
              playbackContext={audioContextRef.current}
              audioPlaybackUnlockKey={audioPlaybackUnlockKey}
            />
          )}

          {activeTab === 'chats' && (
            <ChatsPanel currentUser={currentUser} accessToken={accessToken} />
          )}

          {activeTab === 'security' && (
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

          {activeTab === 'traffic' && (
            <TrafficVisualizer />
          )}
        </div>

        <UserDrawer
          open={profileOpen}
          user={currentUser}
          onClose={() => setProfileOpen(false)}
          onLogout={async () => {
            setProfileOpen(false);
            await handleLogout();
          }}
          onRefreshAuth={handleRefreshAuth}
          onReloadProfile={reloadCurrentUser}
          onNavigate={(tab) => {
            setActiveTab(tab);
            setProfileOpen(false);
          }}
        />
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
