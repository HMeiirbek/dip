// User types
export interface User {
  id: string;
  username: string;
  role?: 'user' | 'admin' | 'moderator';
  verified?: boolean;
  createdAt?: string;
  online?: boolean;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken?: string;
  tokenType?: string;
  expiresIn?: number;
  sessionId?: string;
  role?: 'user' | 'admin' | 'moderator';
}

export interface RegisterResponse {
  id: string;
  username: string;
  role?: 'user' | 'admin' | 'moderator';
}

// Call types
export interface Call {
  id: string;
  callerId: string;
  calleeId: string;
  status: 'pending' | 'accepted' | 'rejected' | 'active' | 'ended' | 'created';
  createdAt: string;
  startedAt?: string;
  endedAt?: string;
  caller?: { id: string; username: string };
  callee?: { id: string; username: string };
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

// Security DTOs
export interface SecuritySession {
  id: string;
  role: string;
  deviceInfo: string;
  ipAddress: string;
  userAgent: string;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  revokedAt: string | null;
  active: boolean;
}

export interface SecurityActivityItem {
  userId?: string;
  action: string;
  at: string;
  ipAddress?: string;
  deviceInfo?: string;
}

// Risk DTOs
export interface RiskAnalysis {
  userId: string;
  totalCalls: number;
  riskyCalls: number;
  reportedByUser: number;
  riskScore: number;
  confidence: number;
  recent: Call[];
}

export interface NumberCheckResult {
  phoneNumber: string;
  status: string;
  riskScore: number;
  reportsCount: number;
  source: string;
}

export interface RiskMonitor {
  streamAt: string;
  liveCalls: Call[];
  highPriorityReports: ReportItem[];
  blacklistPreview: BlacklistEntry[];
}

export interface RiskStats {
  calls: Record<string, number>;
  reports: number;
  blacklist: number;
  suspiciousLoad: number;
}

// Admin/ML DTOs
export interface ReportItem {
  id: string;
  userId: string;
  phoneNumber: string;
  description?: string;
  status?: string;
  createdAt: string;
}

export interface BlacklistEntry {
  id: string;
  phoneNumber: string;
  reason?: string;
  source: string;
  createdAt: string;
}

export interface AdminUser {
  id: string;
  username: string;
  createdAt?: string;
  role: string;
  verified: boolean;
  activeSessions: number;
  totalSessions: number;
  totalCalls: number;
  reportsSubmitted: number;
  lastSeenAt?: string | null;
  online: boolean;
}

export interface AdminManagedSession {
  id: string;
  userId: string;
  username: string;
  role: string;
  deviceInfo: string;
  ipAddress: string;
  userAgent: string;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  revokedAt: string | null;
  active: boolean;
}

export interface AdminSecurityEvent {
  userId: string;
  username: string;
  action: string;
  createdAt: string;
  ipAddress?: string;
  deviceInfo?: string;
}

export interface AdminTrafficLog {
  id: string;
  callId: string;
  userId: string;
  username: string;
  createdAt: string;
  rttMs: number | null;
  jitterMs: number | null;
  packetLossPct: number | null;
  mosLike: number | null;
  bitrateKbps: number | null;
  callStatus: string;
  callerUsername: string;
  calleeUsername: string;
}

export interface AdminUserDetail {
  user: {
    id: string;
    username: string;
    createdAt: string;
    role: string;
    verified: boolean;
    online: boolean;
  };
  presence: Array<{
    userId: string;
    socketId: string;
    connectedAt: string;
  }>;
  stats: {
    totalCalls: number;
    initiatedCalls: number;
    receivedCalls: number;
    reportsSubmitted: number;
    activeSessions: number;
    openFlags: number;
  };
  sessions: SecuritySession[];
  securityActivity: Array<{
    action: string;
    createdAt: string;
    ipAddress?: string;
    deviceInfo?: string;
  }>;
  callHistory: Array<{
    id: string;
    status: string;
    createdAt: string;
    startedAt?: string;
    endedAt?: string;
    durationSec: number;
    direction: 'incoming' | 'outgoing';
    counterpart: {
      id: string;
      username: string;
    };
  }>;
  reports: ReportItem[];
}

export interface AdminDashboard {
  users: number;
  totalCalls: number;
  ongoingCalls: number;
  endedCalls: number;
  reports: number;
  blacklistEntries: number;
  activeThreats: number;
  recentSystemEvents: Array<Record<string, unknown>>;
}

export interface AdminAnalytics {
  users: number;
  callsAnalyzed: number;
  byStatus: Record<string, number>;
  dailyCallVolume: Array<{ day: string; count: number }>;
  reportsCount: number;
  blacklistCount: number;
  roleDistribution: Record<string, number>;
}

export interface AdminSlaSummary {
  generatedAt: string;
  targets: {
    setup95LeSec: number;
    latencyLeMs: number;
    packetLossLePct: number;
  };
  callSetup: {
    samples: number;
    p50Sec: number | null;
    p95Sec: number | null;
    avgSec: number | null;
    le5SecPct: number | null;
    le8SecPct: number | null;
  };
  quality24h: {
    samples: number;
    rttLe200Pct: number | null;
    jitterLe80Pct: number | null;
    packetLossLe5Pct: number | null;
  };
}

export interface AdminReports {
  total: number;
  topNumbers: Array<{ phoneNumber: string; count: number }>;
  items: ReportItem[];
}

export interface AdminLogItem {
  level?: string;
  type?: string;
  userId?: string;
  action?: string;
  message?: string;
  ipAddress?: string;
  deviceInfo?: string;
  createdAt: string;
}

export interface ModeratorOnlineUser {
  userId: string;
  username: string;
  role: string;
  socketId: string;
  connectedAt: string;
  ipAddress: string;
  deviceInfo: string;
  userAgent: string;
  lastSeenAt: string | null;
  sessionActive: boolean;
}

export interface ModeratorLiveCall {
  id: string;
  status: string;
  createdAt: string;
  startedAt?: string;
  expiresAt?: string;
  durationSec: number;
  quality?: {
    rttMs?: number | null;
    jitterMs?: number | null;
    packetLossPct?: number | null;
    mosLike?: number | null;
    bitrateKbps?: number | null;
    sampledAt?: string;
  } | null;
  caller: {
    id: string;
    username: string;
    online: boolean;
    ipAddress: string;
    deviceInfo: string;
  };
  callee: {
    id: string;
    username: string;
    online: boolean;
    ipAddress: string;
    deviceInfo: string;
  };
}

export interface CallQualitySample {
  rttMs?: number;
  jitterMs?: number;
  packetLossPct?: number;
  mosLike?: number;
  bitrateKbps?: number;
}

export interface ModeratorOverview {
  generatedAt: string;
  onlineCount: number;
  onlineUsers: ModeratorOnlineUser[];
  callCount: number;
  calls: ModeratorLiveCall[];
  qualitySummary?: {
    activeCallsWithQuality: number;
    aggregate: {
      rttMs: { p50: number | null; p95: number | null; avg: number | null };
      jitterMs: { p50: number | null; p95: number | null; avg: number | null };
      packetLossPct: { p50: number | null; p95: number | null; avg: number | null };
      mosLike: { p50: number | null; p95: number | null; avg: number | null };
      bitrateKbps: { p50: number | null; p95: number | null; avg: number | null };
    };
    alerts: Array<{
      level: 'warning' | 'critical';
      callId: string;
      metric: string;
      value: number;
      threshold: string;
      message: string;
    }>;
  };
}

export interface ModeratorPresenceSnapshot {
  generatedAt: string;
  onlineCount: number;
  onlineUsers: ModeratorOnlineUser[];
}

export interface ModeratorCallFlag {
  id: string;
  callId: string;
  actorId: string;
  actorRole: string;
  reason: string;
  status: 'open' | 'resolved' | string;
  createdAt: string;
  resolvedAt?: string | null;
  resolvedBy?: string | null;
  call: {
    caller: { id: string; username: string };
    callee: { id: string; username: string };
  } | null;
}

export interface ModeratorCallFlagsPage {
  items: ModeratorCallFlag[];
  total: number;
  limit: number;
  offset: number;
  sortBy?: 'createdAt' | 'status' | 'actorRole';
  sortDir?: 'asc' | 'desc';
}

export interface AdminCallQualityPoint {
  at: string;
  userId: string;
  rttMs: number | null;
  jitterMs: number | null;
  packetLossPct: number | null;
  mosLike: number | null;
  bitrateKbps: number | null;
}

export interface AdminCallQualityHistory {
  call: {
    id: string;
    status: string;
    caller: { id: string; username: string };
    callee: { id: string; username: string };
    createdAt: string;
    startedAt?: string;
  } | null;
  points: AdminCallQualityPoint[];
  summary: {
    sampleCount: number;
    rttMs: { p50: number | null; p95: number | null; avg: number | null };
    jitterMs: { p50: number | null; p95: number | null; avg: number | null };
    packetLossPct: { p50: number | null; p95: number | null; avg: number | null };
    mosLike: { p50: number | null; p95: number | null; avg: number | null };
    bitrateKbps: { p50: number | null; p95: number | null; avg: number | null };
    trends: {
      rttMs: { status: 'degrading' | 'improving' | 'stable' | 'insufficient'; delta: number | null; fromAvg: number | null; toAvg: number | null };
      jitterMs: { status: 'degrading' | 'improving' | 'stable' | 'insufficient'; delta: number | null; fromAvg: number | null; toAvg: number | null };
      packetLossPct: { status: 'degrading' | 'improving' | 'stable' | 'insufficient'; delta: number | null; fromAvg: number | null; toAvg: number | null };
      mosLike: { status: 'degrading' | 'improving' | 'stable' | 'insufficient'; delta: number | null; fromAvg: number | null; toAvg: number | null };
    };
    anomalies: Array<{
      at: string;
      userId: string;
      metric: 'rttMs' | 'jitterMs' | 'packetLossPct' | 'mosLike';
      value: number;
      threshold: string;
      level: 'warning' | 'critical';
    }>;
  } | null;
  timeline?: Array<{
    at: string;
    type: string;
    actorId: string | null;
    actorName: string | null;
    message: string;
    metadata?: Record<string, unknown>;
  }>;
}

export interface MlModelInfo {
  id: string;
  version: string;
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  isActive: boolean;
  loadedAt: string;
}

export interface MlStatus {
  active: boolean;
  model: MlModelInfo | null;
  totalVersions: number;
}

export interface MlMetrics {
  version: string;
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  driftScore: number;
  evaluatedAt: string;
}
