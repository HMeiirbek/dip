import React, { useEffect, useMemo, useState } from 'react';
import {
  AdminCallQualityHistory,
  AdminAnalytics,
  AdminDashboard,
  AdminLogItem,
  AdminReports,
  AdminSlaSummary,
  AdminUser,
  BlacklistEntry,
  MlMetrics,
  MlStatus,
  ModeratorCallFlag,
  ModeratorOverview,
} from '../types';
import apiService from '../services/api';

interface AdminPanelProps {
  isAdminLike: boolean;
  role?: string;
  adminDashboard: AdminDashboard | null;
  adminAnalytics: AdminAnalytics | null;
  adminSlaSummary: AdminSlaSummary | null;
  adminReports: AdminReports | null;
  adminLogs: AdminLogItem[];
  adminUsers: AdminUser[];
  mlStatus: MlStatus | null;
  mlMetrics: MlMetrics | null;
  adminLoading: boolean;
  moderatorOverview: ModeratorOverview | null;
  callFlags: ModeratorCallFlag[];
  callFlagsStatus: 'open' | 'resolved' | 'all';
  setCallFlagsStatus: React.Dispatch<React.SetStateAction<'open' | 'resolved' | 'all'>>;
  callFlagsQuery: string;
  setCallFlagsQuery: React.Dispatch<React.SetStateAction<string>>;
  callFlagsOffset: number;
  setCallFlagsOffset: React.Dispatch<React.SetStateAction<number>>;
  callFlagsLimit: number;
  callFlagsTotal: number;
  callFlagsSortBy: 'createdAt' | 'status' | 'actorRole';
  setCallFlagsSortBy: React.Dispatch<React.SetStateAction<'createdAt' | 'status' | 'actorRole'>>;
  callFlagsSortDir: 'asc' | 'desc';
  setCallFlagsSortDir: React.Dispatch<React.SetStateAction<'asc' | 'desc'>>;
  blacklist: BlacklistEntry[];
  blacklistPhone: string;
  setBlacklistPhone: React.Dispatch<React.SetStateAction<string>>;
  blacklistReason: string;
  setBlacklistReason: React.Dispatch<React.SetStateAction<string>>;
  onReloadAdmin: () => Promise<void> | void;
  onReloadMl: () => Promise<void> | void;
  onAddBlacklist: () => Promise<void> | void;
  onDeleteBlacklist: (id: string) => Promise<void> | void;
  onUpdateUserRole: (id: string, role: 'user' | 'admin' | 'moderator') => Promise<void> | void;
  onForceEndCall: (id: string) => Promise<void> | void;
  onFlagCall: (id: string, reason?: string) => Promise<void> | void;
  onResolveCallFlag: (flagId: string) => Promise<void> | void;
  onResolveAllFlagsForCall: (callId: string) => Promise<void> | void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  isAdminLike,
  role,
  adminDashboard,
  adminAnalytics,
  adminSlaSummary,
  adminReports,
  adminLogs,
  adminUsers,
  mlStatus,
  mlMetrics,
  adminLoading,
  moderatorOverview,
  callFlags,
  callFlagsStatus,
  setCallFlagsStatus,
  callFlagsQuery,
  setCallFlagsQuery,
  callFlagsOffset,
  setCallFlagsOffset,
  callFlagsLimit,
  callFlagsTotal,
  callFlagsSortBy,
  setCallFlagsSortBy,
  callFlagsSortDir,
  setCallFlagsSortDir,
  blacklist,
  blacklistPhone,
  setBlacklistPhone,
  blacklistReason,
  setBlacklistReason,
  onReloadAdmin,
  onReloadMl,
  onAddBlacklist,
  onDeleteBlacklist,
  onUpdateUserRole,
  onForceEndCall,
  onFlagCall,
  onResolveCallFlag,
  onResolveAllFlagsForCall,
}) => {
  const isMobile = useMediaQuery('(max-width: 840px)');
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const [qualityHistory, setQualityHistory] = useState<AdminCallQualityHistory | null>(null);
  const [alertFilter, setAlertFilter] = useState<'all' | 'warning' | 'critical' | 'clean'>('all');
  const [actionBusyCallId, setActionBusyCallId] = useState<string | null>(null);
  const [forceEndTarget, setForceEndTarget] = useState<string | null>(null);
  const [flagTarget, setFlagTarget] = useState<string | null>(null);
  const [flagReason, setFlagReason] = useState('');
  const [flagSearchDraft, setFlagSearchDraft] = useState(callFlagsQuery);

  useEffect(() => {
    const firstCallId = moderatorOverview?.calls?.[0]?.id || null;
    if (!selectedCallId && firstCallId) {
      setSelectedCallId(firstCallId);
    }
  }, [moderatorOverview, selectedCallId]);

  useEffect(() => {
    let cancelled = false;
    const loadHistory = async () => {
      if (!selectedCallId) {
        setQualityHistory(null);
        return;
      }
      try {
        const data = await apiService.getAdminCallQualityHistory(selectedCallId, 120);
        if (!cancelled) setQualityHistory(data);
      } catch {
        if (!cancelled) setQualityHistory(null);
      }
    };
    loadHistory();
    const interval = window.setInterval(loadHistory, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [selectedCallId]);

  useEffect(() => {
    onReloadAdmin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callFlagsStatus, callFlagsOffset, callFlagsQuery, callFlagsSortBy, callFlagsSortDir]);

  useEffect(() => {
    setFlagSearchDraft(callFlagsQuery);
  }, [callFlagsQuery]);

  useEffect(() => {
    const next = flagSearchDraft.trim();
    if (next === callFlagsQuery) return;
    const timer = window.setTimeout(() => {
      setCallFlagsOffset(0);
      setCallFlagsQuery(next);
    }, 450);
    return () => window.clearTimeout(timer);
  }, [flagSearchDraft, callFlagsQuery, setCallFlagsOffset, setCallFlagsQuery]);

  const callAlertLevel = useMemo(() => {
    const map = new Map<string, 'warning' | 'critical'>();
    for (const alert of moderatorOverview?.qualitySummary?.alerts || []) {
      const prev = map.get(alert.callId);
      if (!prev || alert.level === 'critical') {
        map.set(alert.callId, alert.level);
      }
    }
    return map;
  }, [moderatorOverview?.qualitySummary?.alerts]);

  const sortedCalls = useMemo(() => {
    const calls = [...(moderatorOverview?.calls || [])];
    const severityWeight = (id: string) => {
      const level = callAlertLevel.get(id);
      if (level === 'critical') return 2;
      if (level === 'warning') return 1;
      return 0;
    };
    calls.sort((a, b) => {
      const severityDelta = severityWeight(b.id) - severityWeight(a.id);
      if (severityDelta !== 0) return severityDelta;
      return (b.durationSec || 0) - (a.durationSec || 0);
    });
    return calls;
  }, [moderatorOverview?.calls, callAlertLevel]);

  const filteredCalls = useMemo(() => {
    if (alertFilter === 'all') return sortedCalls;
    if (alertFilter === 'clean') {
      return sortedCalls.filter((c) => !callAlertLevel.get(c.id));
    }
    return sortedCalls.filter((c) => callAlertLevel.get(c.id) === alertFilter);
  }, [sortedCalls, callAlertLevel, alertFilter]);

  const runCallAction = async (callId: string, action: 'flag' | 'force-end', reason?: string) => {
    try {
      setActionBusyCallId(callId);
      if (action === 'flag') {
        await onFlagCall(callId, reason);
        return;
      }
      await onForceEndCall(callId);
    } finally {
      setActionBusyCallId(null);
    }
  };

  const openFlagModal = (callId: string) => {
    const severity = callAlertLevel.get(callId) || 'clean';
    setFlagReason(`manual_review:${severity}`);
    setFlagTarget(callId);
  };

  const submitFlag = async () => {
    if (!flagTarget || !flagReason.trim()) return;
    await runCallAction(flagTarget, 'flag', flagReason.trim());
    setFlagTarget(null);
    setFlagReason('');
  };

  const submitForceEnd = async () => {
    if (!forceEndTarget) return;
    await runCallAction(forceEndTarget, 'force-end');
    setForceEndTarget(null);
  };

  const flagsTotalPages = Math.max(1, Math.ceil(callFlagsTotal / Math.max(1, callFlagsLimit)));
  const safeFlagsPage = Math.floor(callFlagsOffset / Math.max(1, callFlagsLimit)) + 1;

  if (!isAdminLike) {
    return <div style={styles.card}>No access. Admin/Moderator role required.</div>;
  }

  return (
    <div style={{ ...styles.grid2, gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))' }}>
      <div style={styles.card}>
        <h3 style={styles.cardTitle}>Dashboard / Analytics</h3>
        <div style={styles.row}>
          <button style={styles.secondaryButton} onClick={onReloadAdmin}>Reload Admin Data</button>
          {role === 'admin' && <button style={styles.primaryButton} onClick={onReloadMl}>Reload ML</button>}
        </div>
        <pre style={styles.pre}>{JSON.stringify(adminDashboard, null, 2)}</pre>
        <pre style={styles.pre}>{JSON.stringify(adminAnalytics, null, 2)}</pre>
        <pre style={styles.pre}>{JSON.stringify(adminSlaSummary, null, 2)}</pre>
        <pre style={styles.pre}>{JSON.stringify(mlStatus, null, 2)}</pre>
        <pre style={styles.pre}>{JSON.stringify(mlMetrics, null, 2)}</pre>
      </div>

      <div style={styles.card}>
        <h3 style={styles.cardTitle}>Moderator Live Ops</h3>
        <div style={styles.metaRow}>
          <span>Online users: {moderatorOverview?.onlineCount ?? 0}</span>
          <span>Active calls: {moderatorOverview?.callCount ?? 0}</span>
          <span>
            Updated:{' '}
            {moderatorOverview?.generatedAt
              ? new Date(moderatorOverview.generatedAt).toLocaleTimeString()
              : '-'}
          </span>
        </div>

        <h4 style={{ marginTop: 12 }}>Online Users</h4>
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>IP</th>
                <th>Device</th>
                <th>Socket</th>
                <th>Connected</th>
              </tr>
            </thead>
            <tbody>
              {(moderatorOverview?.onlineUsers || []).map((user) => (
                <tr key={user.userId}>
                  <td>{user.username}</td>
                  <td>{user.role}</td>
                  <td>{user.ipAddress}</td>
                  <td>{user.deviceInfo}</td>
                  <td>{user.socketId.slice(0, 8)}...</td>
                  <td>{new Date(user.connectedAt).toLocaleTimeString()}</td>
                </tr>
              ))}
              {!moderatorOverview?.onlineUsers?.length && (
                <tr>
                  <td colSpan={6}>No online users</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <h4 style={{ marginTop: 12 }}>Current Calls</h4>
        <div style={styles.row}>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>Filter by quality:</span>
          <select
            value={alertFilter}
            onChange={(e) => setAlertFilter(e.target.value as 'all' | 'warning' | 'critical' | 'clean')}
            style={styles.select}
          >
            <option value="all">All</option>
            <option value="critical">Critical</option>
            <option value="warning">Warning</option>
            <option value="clean">Clean</option>
          </select>
        </div>
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th>Status</th>
                <th>Duration</th>
                <th>RTT</th>
                <th>Jitter</th>
                <th>Loss</th>
                <th>MOS</th>
                <th>Quality</th>
                <th>Caller</th>
                <th>Caller IP</th>
                <th>Callee</th>
                <th>Callee IP</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCalls.map((call) => (
                <tr
                  key={call.id}
                  style={selectedCallId === call.id ? styles.selectedRow : undefined}
                  onClick={() => setSelectedCallId(call.id)}
                >
                  <td>{call.status}</td>
                  <td>{formatDuration(call.durationSec)}</td>
                  <td>{formatMetric(call.quality?.rttMs, 'ms')}</td>
                  <td>{formatMetric(call.quality?.jitterMs, 'ms')}</td>
                  <td>{formatMetric(call.quality?.packetLossPct, '%')}</td>
                  <td>{formatMetric(call.quality?.mosLike, '')}</td>
                  <td>{renderQualityBadge(callAlertLevel.get(call.id))}</td>
                  <td>
                    {call.caller.username} {call.caller.online ? '●' : '○'}
                  </td>
                  <td>{call.caller.ipAddress}</td>
                  <td>
                    {call.callee.username} {call.callee.online ? '●' : '○'}
                  </td>
                  <td>{call.callee.ipAddress}</td>
                  <td>
                    <div style={styles.row}>
                      <button
                        style={styles.smallButton}
                        disabled={actionBusyCallId === call.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          openFlagModal(call.id);
                        }}
                      >
                        Flag
                      </button>
                      <button
                        style={styles.smallDanger}
                        disabled={actionBusyCallId === call.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setForceEndTarget(call.id);
                        }}
                      >
                        Force End
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!filteredCalls.length && (
                <tr>
                  <td colSpan={12}>No active calls</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <h4 style={{ marginTop: 12 }}>Call Quality Monitor</h4>
        <div style={styles.qualityGrid}>
          <div style={styles.metricCard}>
            <strong>RTT (ms)</strong>
            <small>p50: {formatMetric(moderatorOverview?.qualitySummary?.aggregate.rttMs.p50, '')}</small>
            <small>p95: {formatMetric(moderatorOverview?.qualitySummary?.aggregate.rttMs.p95, '')}</small>
            <small>avg: {formatMetric(moderatorOverview?.qualitySummary?.aggregate.rttMs.avg, '')}</small>
          </div>
          <div style={styles.metricCard}>
            <strong>Jitter (ms)</strong>
            <small>p50: {formatMetric(moderatorOverview?.qualitySummary?.aggregate.jitterMs.p50, '')}</small>
            <small>p95: {formatMetric(moderatorOverview?.qualitySummary?.aggregate.jitterMs.p95, '')}</small>
            <small>avg: {formatMetric(moderatorOverview?.qualitySummary?.aggregate.jitterMs.avg, '')}</small>
          </div>
          <div style={styles.metricCard}>
            <strong>Packet Loss (%)</strong>
            <small>p50: {formatMetric(moderatorOverview?.qualitySummary?.aggregate.packetLossPct.p50, '')}</small>
            <small>p95: {formatMetric(moderatorOverview?.qualitySummary?.aggregate.packetLossPct.p95, '')}</small>
            <small>avg: {formatMetric(moderatorOverview?.qualitySummary?.aggregate.packetLossPct.avg, '')}</small>
          </div>
          <div style={styles.metricCard}>
            <strong>MOS-like</strong>
            <small>p50: {formatMetric(moderatorOverview?.qualitySummary?.aggregate.mosLike.p50, '')}</small>
            <small>p95: {formatMetric(moderatorOverview?.qualitySummary?.aggregate.mosLike.p95, '')}</small>
            <small>avg: {formatMetric(moderatorOverview?.qualitySummary?.aggregate.mosLike.avg, '')}</small>
          </div>
        </div>

        <div style={styles.alertBox}>
          <strong>Quality Alerts ({moderatorOverview?.qualitySummary?.alerts?.length || 0})</strong>
          <div style={styles.alertList}>
            {(moderatorOverview?.qualitySummary?.alerts || []).slice(0, 30).map((alert, idx) => (
              <div key={`${alert.callId}-${alert.metric}-${idx}`} style={styles.alertItem}>
                <span style={alert.level === 'critical' ? styles.criticalBadge : styles.warningBadge}>
                  {alert.level.toUpperCase()}
                </span>
                <span>{alert.message}</span>
              </div>
            ))}
            {!moderatorOverview?.qualitySummary?.alerts?.length && <small>No active quality alerts</small>}
          </div>
        </div>

        <div style={styles.alertBox}>
          <strong>Selected Call Trend</strong>
          <div style={styles.row}>
            <button
              style={styles.smallButton}
              disabled={!selectedCallId}
              onClick={() => {
                if (!selectedCallId) return;
                onResolveAllFlagsForCall(selectedCallId);
              }}
            >
              Resolve All Flags For Selected Call
            </button>
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--muted)' }}>
            {qualityHistory?.call
              ? `${qualityHistory.call.caller.username} -> ${qualityHistory.call.callee.username} (${qualityHistory.call.status})`
              : 'Select an active call to inspect trend'}
          </div>
          <div style={{ marginTop: 8 }}>
            <QualitySparkline
              label="RTT (ms)"
              color="#ef4444"
              values={(qualityHistory?.points || []).map((p) => p.rttMs)}
              threshold={350}
              thresholdMode="above"
            />
          </div>
          <div style={{ marginTop: 8 }}>
            <QualitySparkline
              label="Packet loss (%)"
              color="#f59e0b"
              values={(qualityHistory?.points || []).map((p) => p.packetLossPct)}
              threshold={5}
              thresholdMode="above"
            />
          </div>
          <div style={{ marginTop: 10, fontSize: 12, color: 'var(--muted)' }}>
            <strong>Trend status:</strong>{' '}
            RTT {renderTrendBadge(qualityHistory?.summary?.trends.rttMs.status)} |{' '}
            Jitter {renderTrendBadge(qualityHistory?.summary?.trends.jitterMs.status)} |{' '}
            Loss {renderTrendBadge(qualityHistory?.summary?.trends.packetLossPct.status)} |{' '}
            MOS {renderTrendBadge(qualityHistory?.summary?.trends.mosLike.status)}
          </div>
          <div style={{ marginTop: 8 }}>
            <small>
              Anomalies in selected call: {qualityHistory?.summary?.anomalies?.length || 0}
            </small>
          </div>
          <div style={{ marginTop: 10 }}>
            <strong style={{ fontSize: 12 }}>Audit Timeline</strong>
            <div style={{ ...styles.listBox, marginTop: 6, maxHeight: 180 }}>
              {(qualityHistory?.timeline || []).map((event, idx) => (
                <div key={`${event.type}-${event.at}-${idx}`} style={styles.listItemColumn}>
                  <small>
                    {new Date(event.at).toLocaleString()} | {event.type}
                  </small>
                  <small>
                    {event.actorName || 'system'}: {event.message}
                  </small>
                  {event.metadata && (
                  <small style={{ color: 'var(--muted)' }}>
                      {JSON.stringify(event.metadata)}
                    </small>
                  )}
                </div>
              ))}
              {!qualityHistory?.timeline?.length && <small>No timeline events</small>}
            </div>
          </div>
        </div>

        <div style={styles.alertBox}>
          <div style={styles.row}>
            <strong>Flagged Calls ({callFlagsTotal})</strong>
            <select
              value={callFlagsStatus}
              onChange={(e) => {
                setCallFlagsOffset(0);
                setCallFlagsStatus(e.target.value as 'open' | 'resolved' | 'all');
              }}
              style={styles.select}
            >
              <option value="open">Open</option>
              <option value="resolved">Resolved</option>
              <option value="all">All</option>
            </select>
            <button style={styles.smallButton} onClick={onReloadAdmin}>Refresh</button>
            <button
              style={styles.smallButton}
              onClick={() => {
                setCallFlagsOffset(0);
                setCallFlagsStatus('open');
                setCallFlagsQuery('');
                setFlagSearchDraft('');
                setCallFlagsSortBy('createdAt');
                setCallFlagsSortDir('desc');
              }}
            >
              Clear Filters
            </button>
          </div>
          <div style={styles.row}>
            <input
              style={styles.input}
              value={flagSearchDraft}
              onChange={(e) => setFlagSearchDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setCallFlagsOffset(0);
                  setCallFlagsQuery(flagSearchDraft.trim());
                }
              }}
              placeholder="Search by call id/reason/user"
            />
            <button
              style={styles.smallButton}
              onClick={() => {
                setCallFlagsOffset(0);
                setCallFlagsQuery(flagSearchDraft.trim());
              }}
            >
              Search
            </button>
            <select
              value={callFlagsSortBy}
              onChange={(e) => {
                setCallFlagsOffset(0);
                setCallFlagsSortBy(e.target.value as 'createdAt' | 'status' | 'actorRole');
              }}
              style={styles.select}
            >
              <option value="createdAt">Sort: Created</option>
              <option value="status">Sort: Status</option>
              <option value="actorRole">Sort: Actor Role</option>
            </select>
            <select
              value={callFlagsSortDir}
              onChange={(e) => {
                setCallFlagsOffset(0);
                setCallFlagsSortDir(e.target.value as 'asc' | 'desc');
              }}
              style={styles.select}
            >
              <option value="desc">Desc</option>
              <option value="asc">Asc</option>
            </select>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>
              Page {safeFlagsPage}/{flagsTotalPages}
            </span>
            {adminLoading && <span style={{ fontSize: 12, color: 'var(--muted)' }}>Loading...</span>}
            <button
              style={styles.smallButton}
              disabled={safeFlagsPage <= 1}
              onClick={() => setCallFlagsOffset(Math.max(0, callFlagsOffset - callFlagsLimit))}
            >
              Prev
            </button>
            <button
              style={styles.smallButton}
              disabled={safeFlagsPage >= flagsTotalPages}
              onClick={() => setCallFlagsOffset(callFlagsOffset + callFlagsLimit)}
            >
              Next
            </button>
          </div>
          <div style={styles.listBox}>
            {callFlags.map((f) => (
              <div key={f.id} style={styles.listItemColumn}>
                <strong>
                  {f.call
                    ? `${f.call.caller.username} -> ${f.call.callee.username}`
                    : f.callId}
                </strong>
                <small>
                  {new Date(f.createdAt).toLocaleString()} | {f.status} | by {f.actorRole}
                </small>
                <small>Reason: {f.reason}</small>
                <div>
                  <button
                    style={styles.smallButton}
                    onClick={() => {
                      setSelectedCallId(f.callId);
                    }}
                  >
                    Inspect
                  </button>
                </div>
                {f.status === 'open' && (
                  <div>
                    <button style={styles.smallButton} onClick={() => onResolveCallFlag(f.id)}>
                      Resolve
                    </button>
                  </div>
                )}
              </div>
            ))}
            {!callFlags.length && <small>No flags in this view</small>}
          </div>
        </div>
      </div>

      <div style={styles.card}>
        <h3 style={styles.cardTitle}>Reports / Logs / Blacklist</h3>
        <pre style={styles.pre}>{JSON.stringify(adminReports, null, 2)}</pre>

        <h4>Blacklist ({blacklist.length})</h4>
        <div style={styles.stack}>
          <input
            style={styles.input}
            placeholder="Phone number"
            value={blacklistPhone}
            onChange={(e) => setBlacklistPhone(e.target.value)}
          />
          <input
            style={styles.input}
            placeholder="Reason"
            value={blacklistReason}
            onChange={(e) => setBlacklistReason(e.target.value)}
          />
          <button style={styles.secondaryButton} onClick={onAddBlacklist}>Add to Blacklist</button>
        </div>

        <div style={styles.listBox}>
          {blacklist.map((b) => (
            <div key={b.id} style={styles.listItem}>
              <div>
                <div>{b.phoneNumber}</div>
                <small>{b.reason || '-'} | {b.source || '-'}</small>
              </div>
              <button style={styles.smallDanger} onClick={() => onDeleteBlacklist(b.id)}>Delete</button>
            </div>
          ))}
        </div>

        <h4 style={{ marginTop: 16 }}>Admin Users ({adminUsers.length})</h4>
        <div style={styles.listBox}>
          {adminUsers.map((u) => (
            <div key={u.id} style={styles.listItem}>
              <span>{u.username}</span>
              <div style={styles.row}>
                <button style={styles.smallButton} onClick={() => onUpdateUserRole(u.id, 'user')}>user</button>
                <button style={styles.smallButton} onClick={() => onUpdateUserRole(u.id, 'moderator')}>mod</button>
                <button style={styles.smallButton} onClick={() => onUpdateUserRole(u.id, 'admin')}>admin</button>
              </div>
            </div>
          ))}
        </div>

        <h4 style={{ marginTop: 16 }}>System Logs ({adminLogs.length})</h4>
        <div style={styles.listBox}>
          {adminLogs.slice(0, 80).map((l, idx) => (
            <div key={`${idx}-${l.action || l.message}`} style={styles.listItemColumn}>
              <strong>{l.action || l.message}</strong>
              <small>{new Date(l.createdAt).toLocaleString()} | {l.level || l.type || 'info'}</small>
            </div>
          ))}
        </div>
      </div>

      {forceEndTarget && (
        <div style={styles.modalBackdrop}>
          <div style={styles.modalCard}>
            <h4 style={{ marginTop: 0 }}>Force End Call</h4>
            <p style={{ marginTop: 0, fontSize: 13, color: 'var(--muted)' }}>
              End call <code>{forceEndTarget}</code> for both participants?
            </p>
            <div style={styles.row}>
              <button
                style={styles.smallDanger}
                disabled={actionBusyCallId === forceEndTarget}
                onClick={submitForceEnd}
              >
                Confirm Force End
              </button>
              <button
                style={styles.smallButton}
                disabled={actionBusyCallId === forceEndTarget}
                onClick={() => setForceEndTarget(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {flagTarget && (
        <div style={styles.modalBackdrop}>
          <div style={styles.modalCard}>
            <h4 style={{ marginTop: 0 }}>Flag Call</h4>
            <p style={{ marginTop: 0, fontSize: 13, color: 'var(--muted)' }}>
              Add moderation reason for call <code>{flagTarget}</code>.
            </p>
            <input
              style={styles.input}
              value={flagReason}
              onChange={(e) => setFlagReason(e.target.value)}
              placeholder="Reason"
            />
            <div style={styles.row}>
              <button
                style={styles.smallButton}
                disabled={!flagReason.trim() || actionBusyCallId === flagTarget}
                onClick={submitFlag}
              >
                Save Flag
              </button>
              <button
                style={styles.smallButton}
                disabled={actionBusyCallId === flagTarget}
                onClick={() => {
                  setFlagTarget(null);
                  setFlagReason('');
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  grid2: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 },
  card: { background: 'var(--surface)', borderRadius: 12, padding: 14, boxShadow: 'var(--shadow)', border: '1px solid var(--border)', color: 'var(--text)' },
  cardTitle: { marginTop: 0, marginBottom: 10 },
  row: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 },
  stack: { display: 'flex', flexDirection: 'column', gap: 8 },
  input: { padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, minWidth: 180, background: 'var(--surface)', color: 'var(--text)' },
  select: { padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 8, minWidth: 140, background: 'var(--surface)', color: 'var(--text)' },
  listBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    maxHeight: 260,
    overflowY: 'auto',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: 8,
    background: 'var(--surface2)',
  },
  listItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    borderBottom: '1px solid var(--border)',
    paddingBottom: 6,
  },
  listItemColumn: { display: 'flex', flexDirection: 'column', gap: 2, borderBottom: '1px solid var(--border)', paddingBottom: 6 },
  metaRow: { display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 13, color: 'var(--muted)' },
  tableWrap: { overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface2)' },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 12,
  },
  selectedRow: { background: 'rgba(12,108,255,0.10)', cursor: 'pointer' },
  qualityGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 },
  metricCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: 8,
    background: 'var(--surface2)',
    fontSize: 12,
  },
  alertBox: {
    marginTop: 10,
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: 8,
    background: 'var(--surface)',
  },
  alertList: { display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8, maxHeight: 160, overflowY: 'auto' },
  alertItem: { display: 'flex', gap: 8, alignItems: 'center', fontSize: 12 },
  warningBadge: {
    display: 'inline-block',
    minWidth: 64,
    textAlign: 'center' as const,
    padding: '2px 6px',
    borderRadius: 10,
    background: 'var(--warn)',
    color: '#fff',
    fontWeight: 700,
    fontSize: 11,
  },
  criticalBadge: {
    display: 'inline-block',
    minWidth: 64,
    textAlign: 'center' as const,
    padding: '2px 6px',
    borderRadius: 10,
    background: 'var(--danger)',
    color: '#fff',
    fontWeight: 700,
    fontSize: 11,
  },
  pre: {
    background: 'rgba(13,17,23,0.75)',
    color: 'rgba(233,239,255,0.92)',
    padding: 10,
    borderRadius: 8,
    fontSize: 12,
    overflowX: 'auto',
    maxHeight: 240,
    overflowY: 'auto',
  },
  primaryButton: { padding: '8px 12px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: '#fff', cursor: 'pointer', fontWeight: 800 },
  secondaryButton: { padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer', fontWeight: 800 },
  smallButton: { padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', fontWeight: 800, fontSize: 12, color: 'var(--text)' },
  smallDanger: { padding: '4px 8px', borderRadius: 6, border: 'none', background: 'var(--danger)', color: '#fff', cursor: 'pointer', fontWeight: 800, fontSize: 12 },
  modalBackdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(8, 18, 44, 0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modalCard: {
    width: 'min(520px, calc(100vw - 32px))',
    background: 'var(--surface)',
    borderRadius: 12,
    padding: 16,
    boxShadow: 'var(--shadow-strong)',
    border: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
};

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    }
    mql.addListener(onChange);
    return () => mql.removeListener(onChange);
  }, [query]);

  return matches;
}

function formatDuration(totalSec: number) {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatMetric(value: number | null | undefined, suffix: string) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '-';
  return `${value}${suffix}`;
}

const QualitySparkline: React.FC<{
  label: string;
  values: Array<number | null | undefined>;
  color: string;
  threshold?: number;
  thresholdMode?: 'above' | 'below';
}> = ({
  label,
  values,
  color,
  threshold,
  thresholdMode = 'above',
}) => {
  const width = 420;
  const height = 64;
  const clean = values
    .map((v) => (typeof v === 'number' && Number.isFinite(v) ? v : null))
    .filter((v): v is number => v !== null);

  if (!clean.length) {
    return <small>{label}: no samples</small>;
  }

  const min = Math.min(...clean);
  const max = Math.max(...clean);
  const range = max - min || 1;

  const pointList = values
    .map((v, i) => {
      if (typeof v !== 'number' || Number.isNaN(v)) return null;
      const x = (i / Math.max(1, values.length - 1)) * (width - 8) + 4;
      const y = height - 4 - ((v - min) / range) * (height - 8);
      return { x, y, value: v };
    })
    .filter((p): p is { x: number; y: number; value: number } => Boolean(p));

  const points = pointList.map((p) => `${p.x},${p.y}`).join(' ');
  const isAnomaly = (v: number) =>
    thresholdMode === 'above' ? threshold !== undefined && v > threshold : threshold !== undefined && v < threshold;

  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 2 }}>
        {label} | min {min.toFixed(1)} / max {max.toFixed(1)}
      </div>
      <svg
        width={width}
        height={height}
        style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6 }}
      >
        {threshold !== undefined && (
          <line
            x1={0}
            y1={height - 4 - ((threshold - min) / range) * (height - 8)}
            x2={width}
            y2={height - 4 - ((threshold - min) / range) * (height - 8)}
            stroke="rgba(148, 163, 184, 0.9)"
            strokeDasharray="4 3"
            strokeWidth="1"
          />
        )}
        <polyline fill="none" stroke={color} strokeWidth="2" points={points} />
        {pointList
          .filter((p) => isAnomaly(p.value))
          .map((p, i) => (
            <circle key={`${label}-anomaly-${i}`} cx={p.x} cy={p.y} r="2.8" fill="var(--danger)" />
          ))}
      </svg>
    </div>
  );
};

function renderTrendBadge(status?: 'degrading' | 'improving' | 'stable' | 'insufficient') {
  if (!status || status === 'insufficient') return 'n/a';
  if (status === 'degrading') return 'degrading';
  if (status === 'improving') return 'improving';
  return 'stable';
}

function renderQualityBadge(level?: 'warning' | 'critical') {
  if (!level) return 'clean';
  return level;
}
