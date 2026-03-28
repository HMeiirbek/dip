import React, { useEffect, useMemo, useRef, useState } from 'react';
import apiService from '../services/api';
import {
  AdminCallQualityHistory,
  ModeratorCallFlag,
  ModeratorOnlineUser,
  ModeratorOverview,
} from '../types';

type PageProps = {
  isModeratorLike: boolean;
  role?: string;
  loading: boolean;
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
  onReloadModerator: () => Promise<void> | void;
  onForceEndCall: (id: string) => Promise<void> | void;
  onFlagCall: (id: string, reason?: string) => Promise<void> | void;
  onResolveCallFlag: (flagId: string) => Promise<void> | void;
  onResolveAllFlagsForCall: (callId: string) => Promise<void> | void;
};

export const ModeratorPage: React.FC<PageProps> = ({
  isModeratorLike,
  role,
  loading,
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
  onReloadModerator,
  onForceEndCall,
  onFlagCall,
  onResolveCallFlag,
  onResolveAllFlagsForCall,
}) => {
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const [qualityHistory, setQualityHistory] = useState<AdminCallQualityHistory | null>(null);
  const [callFilter, setCallFilter] = useState<'all' | 'critical' | 'warning' | 'clean'>('all');
  const [flagSearchDraft, setFlagSearchDraft] = useState(callFlagsQuery);
  const [flagReasonByCallId, setFlagReasonByCallId] = useState<Record<string, string>>({});
  const [busyCallId, setBusyCallId] = useState<string | null>(null);
  const [stableOnlineUsers, setStableOnlineUsers] = useState<ModeratorOnlineUser[]>([]);
  const [changedUserIds, setChangedUserIds] = useState<string[]>([]);
  const pulseTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const firstCallId = moderatorOverview?.calls?.[0]?.id || null;
    if (!selectedCallId && firstCallId) {
      setSelectedCallId(firstCallId);
    }
  }, [moderatorOverview, selectedCallId]);

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

  useEffect(() => {
    const nextUsers = sortOnlineUsers(moderatorOverview?.onlineUsers || []);
    setStableOnlineUsers((prev) => {
      const reconciled = reconcileOnlineUsers(prev, nextUsers);
      if (reconciled.changedIds.length) {
        setChangedUserIds(reconciled.changedIds);
        if (pulseTimerRef.current) {
          window.clearTimeout(pulseTimerRef.current);
        }
        pulseTimerRef.current = window.setTimeout(() => setChangedUserIds([]), 900);
      }
      return reconciled.changed ? reconciled.users : prev;
    });
  }, [moderatorOverview?.onlineUsers]);

  useEffect(() => {
    return () => {
      if (pulseTimerRef.current) {
        window.clearTimeout(pulseTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
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

    load();
    const interval = window.setInterval(load, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [selectedCallId]);

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

  const calls = useMemo(() => {
    const rows = [...(moderatorOverview?.calls || [])];
    rows.sort((a, b) => {
      const severityWeight = (id: string) => {
        const level = callAlertLevel.get(id);
        if (level === 'critical') return 2;
        if (level === 'warning') return 1;
        return 0;
      };
      const severityDelta = severityWeight(b.id) - severityWeight(a.id);
      if (severityDelta !== 0) return severityDelta;
      return (b.durationSec || 0) - (a.durationSec || 0);
    });
    if (callFilter === 'all') return rows;
    if (callFilter === 'clean') return rows.filter((call) => !callAlertLevel.get(call.id));
    return rows.filter((call) => callAlertLevel.get(call.id) === callFilter);
  }, [moderatorOverview?.calls, callAlertLevel, callFilter]);

  const totalPages = Math.max(1, Math.ceil(callFlagsTotal / Math.max(1, callFlagsLimit)));
  const currentPage = Math.floor(callFlagsOffset / Math.max(1, callFlagsLimit)) + 1;

  if (!isModeratorLike) {
    return <div style={styles.empty}>No access. Moderator or admin role required.</div>;
  }

  return (
    <div style={styles.page}>
      <div style={styles.pageHeader}>
        <div>
          <div style={styles.eyebrow}>Moderator Workspace</div>
          <h2 style={styles.heading}>Live moderation and call operations</h2>
          <div style={styles.subtle}>
            Role: <b>{role || 'moderator'}</b>
          </div>
        </div>
        <button style={styles.primaryButton} onClick={onReloadModerator}>Refresh live data</button>
      </div>

      <div style={styles.summaryGrid}>
        <SummaryCard label="Online users" value={String(stableOnlineUsers.length)} />
        <SummaryCard label="Active calls" value={String(moderatorOverview?.callCount ?? 0)} />
        <SummaryCard label="Open flags" value={String(callFlags.filter((flag) => flag.status === 'open').length)} />
        <SummaryCard label="Live alerts" value={String(moderatorOverview?.qualitySummary?.alerts?.length || 0)} />
      </div>

      <div style={styles.grid}>
        <section style={styles.card}>
          <div style={styles.cardHeaderRow}>
            <h3 style={styles.cardTitle}>Online users</h3>
            <span style={styles.subtleSmall}>
              Updated {moderatorOverview?.generatedAt ? new Date(moderatorOverview.generatedAt).toLocaleTimeString() : '-'}
            </span>
          </div>
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
                {stableOnlineUsers.map((user) => (
                  <OnlineUserRow
                    key={user.userId}
                    user={user}
                    changed={changedUserIds.includes(user.userId)}
                  />
                ))}
                {!stableOnlineUsers.length && (
                  <tr>
                    <td colSpan={6}>No online users</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section style={styles.card}>
          <div style={styles.cardHeaderRow}>
            <h3 style={styles.cardTitle}>Call quality summary</h3>
            <div style={styles.inlineControls}>
              <label style={styles.subtleSmall}>Filter</label>
              <select value={callFilter} onChange={(e) => setCallFilter(e.target.value as typeof callFilter)} style={styles.select}>
                <option value="all">All</option>
                <option value="critical">Critical</option>
                <option value="warning">Warning</option>
                <option value="clean">Clean</option>
              </select>
            </div>
          </div>

          <div style={styles.metricGrid}>
            <MetricTile label="RTT p95" value={formatMetric(moderatorOverview?.qualitySummary?.aggregate.rttMs.p95, 'ms')} />
            <MetricTile label="Jitter p95" value={formatMetric(moderatorOverview?.qualitySummary?.aggregate.jitterMs.p95, 'ms')} />
            <MetricTile label="Loss p95" value={formatMetric(moderatorOverview?.qualitySummary?.aggregate.packetLossPct.p95, '%')} />
            <MetricTile label="MOS avg" value={formatMetric(moderatorOverview?.qualitySummary?.aggregate.mosLike.avg, '')} />
          </div>

          <div style={styles.listBox}>
            {(moderatorOverview?.qualitySummary?.alerts || []).slice(0, 24).map((alert, idx) => (
              <div key={`${alert.callId}-${alert.metric}-${idx}`} style={styles.alertRow}>
                <span style={alert.level === 'critical' ? styles.badgeCritical : styles.badgeWarning}>
                  {alert.level.toUpperCase()}
                </span>
                <span>{alert.message}</span>
              </div>
            ))}
            {!moderatorOverview?.qualitySummary?.alerts?.length && <small>No live quality alerts</small>}
          </div>
        </section>
      </div>

      <section style={styles.card}>
        <div style={styles.cardHeaderRow}>
          <h3 style={styles.cardTitle}>Current calls</h3>
          {loading && <span style={styles.subtleSmall}>Loading...</span>}
        </div>
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th>Status</th>
                <th>Duration</th>
                <th>Quality</th>
                <th>Caller</th>
                <th>Caller IP</th>
                <th>Callee</th>
                <th>Callee IP</th>
                <th>Metrics</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {calls.map((call) => {
                const reasonDraft = flagReasonByCallId[call.id] || '';
                return (
                  <tr
                    key={call.id}
                    style={selectedCallId === call.id ? styles.selectedRow : undefined}
                    onClick={() => setSelectedCallId(call.id)}
                  >
                    <td>{call.status}</td>
                    <td>{formatDuration(call.durationSec)}</td>
                    <td>{renderQualityBadge(callAlertLevel.get(call.id))}</td>
                    <td>{call.caller.username}</td>
                    <td>{call.caller.ipAddress}</td>
                    <td>{call.callee.username}</td>
                    <td>{call.callee.ipAddress}</td>
                    <td>
                      RTT {formatMetric(call.quality?.rttMs, 'ms')}<br />
                      Jitter {formatMetric(call.quality?.jitterMs, 'ms')}<br />
                      Loss {formatMetric(call.quality?.packetLossPct, '%')}
                    </td>
                    <td>
                      <div style={styles.actionColumn}>
                        <input
                          style={styles.inputCompact}
                          placeholder="flag reason"
                          value={reasonDraft}
                          onChange={(e) => setFlagReasonByCallId((prev) => ({ ...prev, [call.id]: e.target.value }))}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div style={styles.inlineControls}>
                          <button
                            style={styles.smallButton}
                            disabled={busyCallId === call.id}
                            onClick={async (e) => {
                              e.stopPropagation();
                              try {
                                setBusyCallId(call.id);
                                await onFlagCall(call.id, reasonDraft || undefined);
                                setFlagReasonByCallId((prev) => ({ ...prev, [call.id]: '' }));
                              } finally {
                                setBusyCallId(null);
                              }
                            }}
                          >
                            Flag
                          </button>
                          <button
                            style={styles.smallDanger}
                            disabled={busyCallId === call.id}
                            onClick={async (e) => {
                              e.stopPropagation();
                              try {
                                setBusyCallId(call.id);
                                await onForceEndCall(call.id);
                              } finally {
                                setBusyCallId(null);
                              }
                            }}
                          >
                            Force End
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!calls.length && (
                <tr>
                  <td colSpan={9}>No live calls</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div style={styles.grid}>
        <section style={styles.card}>
          <div style={styles.cardHeaderRow}>
            <h3 style={styles.cardTitle}>Selected call inspection</h3>
            {selectedCallId && (
              <button style={styles.smallButton} onClick={() => onResolveAllFlagsForCall(selectedCallId)}>
                Resolve all flags
              </button>
            )}
          </div>
          {qualityHistory?.call ? (
            <>
              <div style={styles.detailMeta}>
                <span>{`${qualityHistory.call.caller.username} -> ${qualityHistory.call.callee.username}`}</span>
                <span>{qualityHistory.call.status}</span>
              </div>
              <div style={styles.metricGrid}>
                <MetricTile label="Samples" value={String(qualityHistory.summary?.sampleCount || 0)} />
                <MetricTile label="RTT p95" value={formatMetric(qualityHistory.summary?.rttMs.p95, 'ms')} />
                <MetricTile label="Loss p95" value={formatMetric(qualityHistory.summary?.packetLossPct.p95, '%')} />
                <MetricTile label="MOS avg" value={formatMetric(qualityHistory.summary?.mosLike.avg, '')} />
              </div>
              <div style={styles.listBox}>
                {(qualityHistory.summary?.anomalies || []).slice(-30).map((item, idx) => (
                  <div key={`${item.at}-${item.metric}-${idx}`} style={styles.listRowColumn}>
                    <strong>{item.metric}</strong>
                    <small>{new Date(item.at).toLocaleString()} | {item.level} | {item.value} ({item.threshold})</small>
                  </div>
                ))}
                {!qualityHistory.summary?.anomalies?.length && <small>No anomalies detected</small>}
              </div>
              <div style={styles.listBox}>
                {(qualityHistory.timeline || []).slice(-20).map((event, idx) => (
                  <div key={`${event.at}-${event.type}-${idx}`} style={styles.listRowColumn}>
                    <strong>{event.type}</strong>
                    <small>{new Date(event.at).toLocaleString()} | {event.actorName || 'system'}</small>
                    <small>{event.message}</small>
                  </div>
                ))}
                {!qualityHistory.timeline?.length && <small>No timeline events</small>}
              </div>
            </>
          ) : (
            <div style={styles.subtle}>Select a live call to inspect quality history.</div>
          )}
        </section>

        <section style={styles.card}>
          <div style={styles.cardHeaderRow}>
            <h3 style={styles.cardTitle}>Flag queue</h3>
            <div style={styles.inlineControls}>
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
              <button style={styles.smallButton} onClick={onReloadModerator}>Refresh</button>
            </div>
          </div>

          <div style={styles.inlineControlsWrap}>
            <input
              style={styles.input}
              placeholder="Search call/reason/user"
              value={flagSearchDraft}
              onChange={(e) => setFlagSearchDraft(e.target.value)}
            />
            <select value={callFlagsSortBy} onChange={(e) => setCallFlagsSortBy(e.target.value as typeof callFlagsSortBy)} style={styles.select}>
              <option value="createdAt">Created</option>
              <option value="status">Status</option>
              <option value="actorRole">Actor Role</option>
            </select>
            <select value={callFlagsSortDir} onChange={(e) => setCallFlagsSortDir(e.target.value as typeof callFlagsSortDir)} style={styles.select}>
              <option value="desc">Desc</option>
              <option value="asc">Asc</option>
            </select>
          </div>

          <div style={styles.listBox}>
            {callFlags.map((flag) => (
              <div key={flag.id} style={styles.listRowColumn}>
                <strong>{flag.call ? `${flag.call.caller.username} -> ${flag.call.callee.username}` : flag.callId}</strong>
                <small>{new Date(flag.createdAt).toLocaleString()} | {flag.status} | by {flag.actorRole}</small>
                <small>Reason: {flag.reason}</small>
                <div style={styles.inlineControls}>
                  <button style={styles.smallButton} onClick={() => setSelectedCallId(flag.callId)}>Inspect</button>
                  {flag.status === 'open' && (
                    <button style={styles.smallButton} onClick={() => onResolveCallFlag(flag.id)}>Resolve</button>
                  )}
                </div>
              </div>
            ))}
            {!callFlags.length && <small>No flags in this view</small>}
          </div>

          <div style={styles.paginationRow}>
            <span style={styles.subtleSmall}>Page {currentPage}/{totalPages}</span>
            <button
              style={styles.smallButton}
              disabled={currentPage <= 1}
              onClick={() => setCallFlagsOffset(Math.max(0, callFlagsOffset - callFlagsLimit))}
            >
              Prev
            </button>
            <button
              style={styles.smallButton}
              disabled={currentPage >= totalPages}
              onClick={() => setCallFlagsOffset(callFlagsOffset + callFlagsLimit)}
            >
              Next
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};

const SummaryCard: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={styles.summaryCard}>
    <div style={styles.summaryLabel}>{label}</div>
    <div style={styles.summaryValue}>{value}</div>
  </div>
);

const OnlineUserRow = React.memo(
  ({ user, changed }: { user: ModeratorOnlineUser; changed: boolean }) => (
    <tr style={changed ? styles.updatedRow : styles.tableRow}>
      <td>{user.username}</td>
      <td>{user.role}</td>
      <td>{user.ipAddress}</td>
      <td>{user.deviceInfo}</td>
      <td>{user.socketId.slice(0, 8)}...</td>
      <td>{new Date(user.connectedAt).toLocaleTimeString()}</td>
    </tr>
  ),
);

const MetricTile: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={styles.metricCard}>
    <div style={styles.summaryLabel}>{label}</div>
    <div style={styles.metricValue}>{value}</div>
  </div>
);

function formatDuration(totalSec?: number) {
  const value = Math.max(0, totalSec || 0);
  const min = Math.floor(value / 60);
  const sec = value % 60;
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function formatMetric(value: number | null | undefined, suffix: string) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '-';
  return `${value.toFixed(2)}${suffix}`;
}

function renderQualityBadge(level?: 'warning' | 'critical') {
  if (level === 'critical') return <span style={styles.badgeCritical}>critical</span>;
  if (level === 'warning') return <span style={styles.badgeWarning}>warning</span>;
  return <span style={styles.badgeHealthy}>clean</span>;
}

function sortOnlineUsers(users: ModeratorOnlineUser[]) {
  return [...users].sort((a, b) => {
    const usernameDelta = a.username.localeCompare(b.username);
    if (usernameDelta !== 0) return usernameDelta;
    return a.userId.localeCompare(b.userId);
  });
}

function isSameOnlineUser(a: ModeratorOnlineUser, b: ModeratorOnlineUser) {
  return (
    a.userId === b.userId &&
    a.username === b.username &&
    a.role === b.role &&
    a.socketId === b.socketId &&
    a.ipAddress === b.ipAddress &&
    a.deviceInfo === b.deviceInfo &&
    a.userAgent === b.userAgent &&
    a.connectedAt === b.connectedAt &&
    a.lastSeenAt === b.lastSeenAt &&
    a.sessionActive === b.sessionActive
  );
}

function reconcileOnlineUsers(prev: ModeratorOnlineUser[], next: ModeratorOnlineUser[]) {
  const previousById = new Map(prev.map((user) => [user.userId, user]));
  let changed = prev.length !== next.length;
  const changedIds: string[] = [];

  const users = next.map((nextUser) => {
    const previous = previousById.get(nextUser.userId);
    if (previous && isSameOnlineUser(previous, nextUser)) {
      return previous;
    }
    changed = true;
    changedIds.push(nextUser.userId);
    return nextUser;
  });

  if (!changed) {
    for (let index = 0; index < users.length; index += 1) {
      if (users[index].userId !== prev[index]?.userId) {
        changed = true;
        break;
      }
    }
  }

  return { users, changed, changedIds };
}

const styles: Record<string, React.CSSProperties> = {
  page: { display: 'flex', flexDirection: 'column', gap: 16 },
  pageHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' },
  eyebrow: { textTransform: 'uppercase', letterSpacing: 1.4, fontSize: 11, color: 'var(--muted)' },
  heading: { margin: '6px 0 4px', fontSize: 24 },
  subtle: { fontSize: 13, color: 'var(--muted)' },
  subtleSmall: { fontSize: 12, color: 'var(--muted)' },
  summaryGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 },
  summaryCard: { background: 'var(--panel-bg)', border: '1px solid var(--border)', borderRadius: 18, padding: 16, boxShadow: 'var(--shadow-soft)' },
  summaryLabel: { color: 'var(--muted)', fontSize: 12, marginBottom: 6 },
  summaryValue: { fontSize: 28, fontWeight: 900 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 },
  card: { background: 'var(--panel-bg)', border: '1px solid var(--border)', borderRadius: 20, padding: 16, boxShadow: 'var(--shadow-soft)', display: 'flex', flexDirection: 'column', gap: 12 },
  cardHeaderRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  cardTitle: { margin: 0, fontSize: 18 },
  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  tableRow: {
    transition: 'background-color 220ms ease, transform 220ms ease',
  },
  updatedRow: {
    background: 'rgba(35,165,90,0.12)',
    transform: 'translateZ(0)',
    transition: 'background-color 220ms ease, transform 220ms ease',
  },
  metricGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 },
  metricCard: { background: 'var(--panel-bg2)', borderRadius: 14, padding: 12, border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 6 },
  metricValue: { fontSize: 20, fontWeight: 800 },
  listBox: { display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto', paddingRight: 4 },
  alertRow: { display: 'flex', gap: 10, alignItems: 'center', padding: 10, borderRadius: 12, background: 'var(--panel-bg2)' },
  badgeCritical: { display: 'inline-flex', padding: '3px 8px', borderRadius: 999, background: 'rgba(239,68,68,0.18)', color: '#ef4444', fontSize: 11, fontWeight: 800 },
  badgeWarning: { display: 'inline-flex', padding: '3px 8px', borderRadius: 999, background: 'rgba(245,158,11,0.18)', color: '#f59e0b', fontSize: 11, fontWeight: 800 },
  badgeHealthy: { display: 'inline-flex', padding: '3px 8px', borderRadius: 999, background: 'rgba(34,197,94,0.18)', color: '#22c55e', fontSize: 11, fontWeight: 800 },
  inlineControls: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  inlineControlsWrap: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  select: { borderRadius: 10, border: '1px solid var(--border)', background: 'var(--panel-bg2)', color: 'var(--text)', padding: '8px 10px' },
  input: { borderRadius: 10, border: '1px solid var(--border)', background: 'var(--panel-bg2)', color: 'var(--text)', padding: '8px 10px', minWidth: 180 },
  inputCompact: { borderRadius: 10, border: '1px solid var(--border)', background: 'var(--panel-bg2)', color: 'var(--text)', padding: '6px 8px', width: 140 },
  primaryButton: { borderRadius: 12, border: 'none', background: 'var(--primary)', color: '#fff', padding: '10px 14px', fontWeight: 800, cursor: 'pointer' },
  smallButton: { borderRadius: 10, border: '1px solid var(--border)', background: 'var(--panel-bg2)', color: 'var(--text)', padding: '6px 10px', cursor: 'pointer' },
  smallDanger: { borderRadius: 10, border: '1px solid rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.12)', color: '#ef4444', padding: '6px 10px', cursor: 'pointer' },
  actionColumn: { display: 'flex', flexDirection: 'column', gap: 8 },
  selectedRow: { background: 'rgba(12,108,255,0.08)' },
  detailMeta: { display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 13, color: 'var(--muted)' },
  listRowColumn: { display: 'flex', flexDirection: 'column', gap: 4, padding: 10, borderRadius: 12, background: 'var(--panel-bg2)' },
  paginationRow: { display: 'flex', justifyContent: 'flex-end', gap: 8, alignItems: 'center' },
  empty: { padding: 20, borderRadius: 16, background: 'var(--panel-bg)', border: '1px solid var(--border)' },
};
