import React, { useEffect, useMemo, useRef, useState } from 'react';
import apiService, { getAxiosErrorMessage } from './services/api';
import socketService from './services/socket';
import { LoginForm } from './components/LoginForm';
import { CallsPanel } from './components/CallsPanel';
import { SecurityPanel } from './components/SecurityPanel';
import { RiskPanel } from './components/RiskPanel';
import { AdminPanel } from './components/AdminPanel';
import { useControlCenterData } from './hooks/useControlCenterData';
import {
  User,
  Call,
  CallStatus as CallStatusType,
  RTCOfferData,
  RTCAnswerData,
  RTCICECandidateData,
} from './types';

type TabKey = 'calls' | 'security' | 'risk' | 'admin';

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

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('calls');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const currentUserRef = useRef<User | null>(null);

  const [callStatus, setCallStatus] = useState<CallStatusType>('idle');
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const activeCallRef = useRef<Call | null>(null);
  const [incomingCall, setIncomingCall] = useState<Call | null>(null);
  const incomingCallRef = useRef<Call | null>(null);
  const [remoteUsername, setRemoteUsername] = useState<string | null>(null);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const qualityTimerRef = useRef<number | null>(null);
  const qualityBytesRef = useRef<{ bytes: number; ts: number } | null>(null);
  const pendingOfferRef = useRef<RTCSessionDescriptionInit | null>(null);
  const pendingIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const [notice, setNotice] = useState<string>('');
  const [error, setError] = useState<string>('');

  const isAdminLike = useMemo(
    () => currentUser?.role === 'admin' || currentUser?.role === 'moderator',
    [currentUser],
  );

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

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
    isAdminLike,
    setCurrentUser,
    notify: setMessage,
    notifyError: setErrorMessage,
  });
  const { security, risk, admin } = controlCenter;

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
      if (!token) return;
      try {
        const user = await apiService.getMe();
        setCurrentUser(user);
        await connectSocketWithToken(token);
      } catch {
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
    if (activeTab === 'admin') {
      admin.loadAdminData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, currentUser, isAdminLike]);

  useEffect(() => {
    if (!currentUser || !isAdminLike || activeTab !== 'admin') return;
    const id = window.setInterval(() => {
      admin.loadAdminData();
    }, 5000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, currentUser?.id, isAdminLike]);

  const setupWebRTC = async (call: Call, localUserId: string) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setLocalStream(stream);

      const pc = new RTCPeerConnection({
        iceServers: getIceServers(),
      });

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      pc.ontrack = (event) => {
        setRemoteStream(event.streams[0]);
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
          if (activeCallRef.current?.id) {
            markCallActiveIfNeeded(activeCallRef.current.id).catch((e) => {
              console.error('Failed to mark call active:', e);
            });
          }
          setCallStatus('active');
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
    setRemoteStream(null);
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

  const handleIncomingCall = async (data: { id: string; from: string; to?: string }) => {
    const caller = await getUserDetails(data.from);
    if (caller) setRemoteUsername(caller.username);

    const callObj: Call = {
      id: data.id,
      callerId: data.from,
      calleeId: data.to || currentUserRef.current?.id || '',
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    setIncomingCall(callObj);
    setCallStatus('incoming');
  };

  const acceptCall = async () => {
    if (!incomingCall || !currentUser) return;

    try {
      setCallStatus('calling');
      const pc = await setupWebRTC(incomingCall, currentUser.id);
      if (!pc) {
        await apiService.rejectCall(incomingCall.id);
        setIncomingCall(null);
        setCallStatus('error');
        return;
      }

      if (!pendingOfferRef.current) {
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

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      await apiService.acceptCall(incomingCall.id);

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
      setActiveCall(callObj);
      setIncomingCall(null);
    } catch (e) {
      console.error('Error accepting call:', e);
      stopQualityReporter();
      resetRtcState();
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
    setActiveCall(call);

    const pc = await setupWebRTC(call, currentUserId);
    if (!pc) {
      await apiService.endCall(call.id);
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
    socketService.offCallEnded();

    socketService.onOffer(async (data: RTCOfferData) => {
      if (!currentUserRef.current) return;
      pendingOfferRef.current = data.offer;
      pendingIceCandidatesRef.current = [];

      const caller = await getUserDetails(data.from);
      if (caller) setRemoteUsername(caller.username);

      handleIncomingCall({ id: data.callId, from: data.from, to: data.to });
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
          await markCallActiveIfNeeded(activeCallRef.current.id);
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
      setIncomingCall(null);
      setActiveCall(null);
      setRemoteUsername(null);
      setCallStatus('ended');
      setMessage(`Call ended: ${data.reason || 'remote end'}`);
      window.setTimeout(() => setCallStatus('idle'), 1200);
    });
  };

  const handleLogin = async (token: string, username: string) => {
    try {
      const user = await apiService.getMe();
      setCurrentUser(user);
      await connectSocketWithToken(token);
      setMessage(`Logged in as ${user.username}`);
    } catch (e) {
      console.error('Login follow-up failed for user:', username, e);
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
    setActiveCall(null);
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

  return (
    <div style={styles.app}>
      <div style={styles.container}>
        <div style={styles.header}>
          <div>
            <h1 style={styles.appTitle}>DIP Control Center</h1>
            <p style={styles.appSubtitle}>Calls, security, risk and admin tools</p>
          </div>
          <div style={styles.headerActions}>
            <span style={styles.username}>
              {currentUser.username} {currentUser.role ? `(${currentUser.role})` : ''}
            </span>
            <button onClick={handleRefreshAuth} style={styles.secondaryButton}>Refresh Token</button>
            <button onClick={handleLogout} style={styles.logoutButton}>Logout</button>
          </div>
        </div>

        <div style={styles.tabBar}>
          <button style={tabStyle(activeTab === 'calls')} onClick={() => setActiveTab('calls')}>Calls</button>
          <button style={tabStyle(activeTab === 'security')} onClick={() => setActiveTab('security')}>Security</button>
          <button style={tabStyle(activeTab === 'risk')} onClick={() => setActiveTab('risk')}>Risk</button>
          <button style={tabStyle(activeTab === 'admin')} onClick={() => setActiveTab('admin')}>Admin</button>
        </div>

        {notice && <div style={styles.notice}>{notice}</div>}
        {error && <div style={styles.error}>{error}</div>}

        {activeTab === 'calls' && (
          <CallsPanel
            currentUserId={currentUser.id}
            onCall={initiateCall}
            activeCallId={activeCall?.id || null}
            callStatus={callStatus}
            activeCall={activeCall}
            incomingCall={incomingCall}
            remoteUsername={remoteUsername}
            onAccept={acceptCall}
            onReject={rejectCall}
            onEnd={endCall}
            localStream={localStream}
            remoteStream={remoteStream}
          />
        )}

        {activeTab === 'security' && (
          <SecurityPanel
            securitySessions={security.securitySessions}
            securityActivity={security.securityActivity}
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

        {activeTab === 'admin' && (
          <AdminPanel
            isAdminLike={isAdminLike}
            role={currentUser.role}
            adminDashboard={admin.adminDashboard}
            adminAnalytics={admin.adminAnalytics}
            adminSlaSummary={admin.adminSlaSummary}
            adminReports={admin.adminReports}
            adminLogs={admin.adminLogs}
            adminUsers={admin.adminUsers}
            mlStatus={admin.mlStatus}
            mlMetrics={admin.mlMetrics}
            adminLoading={admin.adminLoading}
            moderatorOverview={admin.moderatorOverview}
            callFlags={admin.callFlags}
            callFlagsStatus={admin.callFlagsStatus}
            setCallFlagsStatus={admin.setCallFlagsStatus}
            callFlagsQuery={admin.callFlagsQuery}
            setCallFlagsQuery={admin.setCallFlagsQuery}
            callFlagsOffset={admin.callFlagsOffset}
            setCallFlagsOffset={admin.setCallFlagsOffset}
            callFlagsLimit={admin.callFlagsLimit}
            callFlagsTotal={admin.callFlagsTotal}
            callFlagsSortBy={admin.callFlagsSortBy}
            setCallFlagsSortBy={admin.setCallFlagsSortBy}
            callFlagsSortDir={admin.callFlagsSortDir}
            setCallFlagsSortDir={admin.setCallFlagsSortDir}
            blacklist={admin.blacklist}
            blacklistPhone={admin.blacklistPhone}
            setBlacklistPhone={admin.setBlacklistPhone}
            blacklistReason={admin.blacklistReason}
            setBlacklistReason={admin.setBlacklistReason}
            onReloadAdmin={admin.loadAdminData}
            onReloadMl={admin.handleReloadMl}
            onAddBlacklist={admin.handleAddBlacklist}
            onDeleteBlacklist={admin.deleteBlacklist}
            onUpdateUserRole={admin.updateRole}
            onForceEndCall={admin.forceEndCall}
            onFlagCall={admin.flagCall}
            onResolveCallFlag={admin.resolveCallFlag}
            onResolveAllFlagsForCall={admin.resolveAllFlagsForCall}
          />
        )}
      </div>
    </div>
  );
};

const tabStyle = (active: boolean): React.CSSProperties => ({
  padding: '10px 16px',
  borderRadius: 8,
  border: active ? '2px solid #0c6cff' : '1px solid #d0d0d0',
  background: active ? '#ebf3ff' : '#fff',
  fontWeight: 600,
  cursor: 'pointer',
});

const styles: Record<string, React.CSSProperties> = {
  app: {
    minHeight: '100vh',
    background: 'linear-gradient(160deg, #f2f7ff 0%, #f8fff4 100%)',
    padding: 16,
  },
  container: {
    maxWidth: 1280,
    margin: '0 auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
  },
  headerActions: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
  },
  appTitle: {
    margin: 0,
    fontSize: 28,
    color: '#0f1f44',
  },
  appSubtitle: {
    margin: '4px 0 0 0',
    fontSize: 13,
    color: '#4f5d7a',
  },
  tabBar: {
    display: 'flex',
    gap: 8,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  notice: {
    background: '#e8fff1',
    border: '1px solid #8ce7ae',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    color: '#0f6d35',
    fontWeight: 600,
  },
  error: {
    background: '#ffeff0',
    border: '1px solid #ff9fa6',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    color: '#a01828',
    fontWeight: 600,
  },
  username: {
    marginRight: 6,
    fontWeight: 600,
  },
  logoutButton: {
    padding: '8px 12px',
    borderRadius: 8,
    border: 'none',
    background: '#d6223b',
    color: '#fff',
    cursor: 'pointer',
    fontWeight: 700,
  },
  primaryButton: {
    padding: '8px 12px',
    borderRadius: 8,
    border: 'none',
    background: '#0c6cff',
    color: '#fff',
    cursor: 'pointer',
    fontWeight: 700,
  },
  secondaryButton: {
    padding: '8px 12px',
    borderRadius: 8,
    border: '1px solid #b5c3de',
    background: '#fff',
    color: '#1a3369',
    cursor: 'pointer',
    fontWeight: 700,
  },
  smallButton: {
    padding: '4px 8px',
    borderRadius: 6,
    border: '1px solid #b5c3de',
    background: '#fff',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: 12,
  },
  smallDanger: {
    padding: '4px 8px',
    borderRadius: 6,
    border: 'none',
    background: '#d6223b',
    color: '#fff',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: 12,
  },
  content: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 12,
  },
  leftPanel: {
    minHeight: 360,
  },
  rightPanel: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  statusSection: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 220,
  },
  card: {
    background: '#fff',
    borderRadius: 12,
    padding: 14,
    boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
  },
  cardTitle: {
    marginTop: 0,
    marginBottom: 10,
  },
  audioGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 10,
  },
  grid2: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 12,
  },
  row: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  stack: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  input: {
    padding: '8px 10px',
    border: '1px solid #c5d1e8',
    borderRadius: 8,
    minWidth: 180,
  },
  listBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    maxHeight: 260,
    overflowY: 'auto',
    border: '1px solid #e5ebf5',
    borderRadius: 8,
    padding: 8,
    background: '#fbfdff',
  },
  listItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    borderBottom: '1px solid #eef2f9',
    paddingBottom: 6,
  },
  listItemColumn: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    borderBottom: '1px solid #eef2f9',
    paddingBottom: 6,
  },
  pre: {
    background: '#0d1117',
    color: '#c9d1d9',
    padding: 10,
    borderRadius: 8,
    fontSize: 12,
    overflowX: 'auto',
    maxHeight: 240,
    overflowY: 'auto',
  },
};

export default App;
