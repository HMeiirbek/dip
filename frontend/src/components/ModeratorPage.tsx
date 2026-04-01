import React, { useEffect, useMemo, useRef, useState } from 'react';
import apiService from '../services/api';
import {
  AdminCallQualityHistory,
  ModeratorCallFlag,
  ModeratorOnlineUser,
  ModeratorOverview,
  ModeratorPresenceSnapshot,
} from '../types';
import s from './ModeratorPage.module.css';

type PageProps = {
  isModeratorLike: boolean;
  role?: string;
  loading: boolean;
  moderatorOverview: ModeratorOverview | null;
  moderatorPresence: ModeratorPresenceSnapshot | null;
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
  moderatorPresence,
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
  const changedUserIdSet = useMemo(() => new Set(changedUserIds), [changedUserIds]);

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
    const nextUsers = sortOnlineUsers(moderatorPresence?.onlineUsers || []);
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
  }, [moderatorPresence?.onlineUsers]);

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
    return <div className={s.empty}>No access. Moderator or admin role required.</div>;
  }

  return (
    <div className={s.page}>
      <div className={s.pageHeader}>
        <div>
          <div className={s.eyebrow}>Moderator Workspace</div>
          <h2 className={s.heading}>Live moderation and call operations</h2>
          <div className={s.subtle}>
            Role: <b>{role || 'moderator'}</b>
          </div>
        </div>
        <button className={s.primaryButton} onClick={onReloadModerator}>Refresh live data</button>
      </div>

      <div className={s.summaryGrid}>
        <SummaryCard label="Online users" value={String(stableOnlineUsers.length)} />
        <SummaryCard label="Active calls" value={String(moderatorOverview?.callCount ?? 0)} />
        <SummaryCard label="Open flags" value={String(callFlags.filter((flag) => flag.status === 'open').length)} />
        <SummaryCard label="Live alerts" value={String(moderatorOverview?.qualitySummary?.alerts?.length || 0)} />
      </div>

      <div className={s.grid}>
        <section className={s.card}>
          <div className={s.cardHeaderRow}>
            <h3 className={s.cardTitle}>Online users</h3>
            <span className={s.subtleSmall}>
              Updated {moderatorPresence?.generatedAt ? new Date(moderatorPresence.generatedAt).toLocaleTimeString() : '-'}
            </span>
          </div>
          <div className={s.tableWrap}>
            <table className={s.table}>
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
                    changed={changedUserIdSet.has(user.userId)}
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

        <section className={s.card}>
          <div className={s.cardHeaderRow}>
            <h3 className={s.cardTitle}>Call quality summary</h3>
            <div className={s.inlineControls}>
              <label className={s.subtleSmall}>Filter</label>
              <select value={callFilter} onChange={(e) => setCallFilter(e.target.value as typeof callFilter)} className={s.select}>
                <option value="all">All</option>
                <option value="critical">Critical</option>
                <option value="warning">Warning</option>
                <option value="clean">Clean</option>
              </select>
            </div>
          </div>

          <div className={s.metricGrid}>
            <MetricTile label="RTT p95" value={formatMetric(moderatorOverview?.qualitySummary?.aggregate.rttMs.p95, 'ms')} />
            <MetricTile label="Jitter p95" value={formatMetric(moderatorOverview?.qualitySummary?.aggregate.jitterMs.p95, 'ms')} />
            <MetricTile label="Loss p95" value={formatMetric(moderatorOverview?.qualitySummary?.aggregate.packetLossPct.p95, '%')} />
            <MetricTile label="MOS avg" value={formatMetric(moderatorOverview?.qualitySummary?.aggregate.mosLike.avg, '')} />
          </div>

          <div className={s.listBox}>
            {(moderatorOverview?.qualitySummary?.alerts || []).slice(0, 24).map((alert, idx) => (
              <div key={`${alert.callId}-${alert.metric}-${idx}`} className={s.alertRow}>
                <span className={alert.level === 'critical' ? s.badgeCritical : s.badgeWarning}>
                  {alert.level.toUpperCase()}
                </span>
                <span>{alert.message}</span>
              </div>
            ))}
            {!moderatorOverview?.qualitySummary?.alerts?.length && <small>No live quality alerts</small>}
          </div>
        </section>
      </div>

      <section className={s.card}>
        <div className={s.cardHeaderRow}>
          <h3 className={s.cardTitle}>Current calls</h3>
          {loading && <span className={s.subtleSmall}>Loading...</span>}
        </div>
        <div className={s.tableWrap}>
          <table className={s.table}>
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
                    className={selectedCallId === call.id ? s.selectedRow : undefined}
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
                      <div className={s.actionColumn}>
                        <input
                          className={s.inputCompact}
                          placeholder="flag reason"
                          value={reasonDraft}
                          onChange={(e) => setFlagReasonByCallId((prev) => ({ ...prev, [call.id]: e.target.value }))}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div className={s.inlineControls}>
                          <button
                            className={s.smallButton}
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
                            className={s.smallDanger}
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

      <div className={s.grid}>
        <section className={s.card}>
          <div className={s.cardHeaderRow}>
            <h3 className={s.cardTitle}>Selected call inspection</h3>
            {selectedCallId && (
              <button className={s.smallButton} onClick={() => onResolveAllFlagsForCall(selectedCallId)}>
                Resolve all flags
              </button>
            )}
          </div>
          {qualityHistory?.call ? (
            <>
              <div className={s.detailMeta}>
                <span>{`${qualityHistory.call.caller.username} -> ${qualityHistory.call.callee.username}`}</span>
                <span>{qualityHistory.call.status}</span>
              </div>
              <div className={s.metricGrid}>
                <MetricTile label="Samples" value={String(qualityHistory.summary?.sampleCount || 0)} />
                <MetricTile label="RTT p95" value={formatMetric(qualityHistory.summary?.rttMs.p95, 'ms')} />
                <MetricTile label="Loss p95" value={formatMetric(qualityHistory.summary?.packetLossPct.p95, '%')} />
                <MetricTile label="MOS avg" value={formatMetric(qualityHistory.summary?.mosLike.avg, '')} />
              </div>
              <div className={s.listBox}>
                {(qualityHistory.summary?.anomalies || []).slice(-30).map((item, idx) => (
                  <div key={`${item.at}-${item.metric}-${idx}`} className={s.listRowColumn}>
                    <strong>{item.metric}</strong>
                    <small>{new Date(item.at).toLocaleString()} | {item.level} | {item.value} ({item.threshold})</small>
                  </div>
                ))}
                {!qualityHistory.summary?.anomalies?.length && <small>No anomalies detected</small>}
              </div>
              <div className={s.listBox}>
                {(qualityHistory.timeline || []).slice(-20).map((event, idx) => (
                  <div key={`${event.at}-${event.type}-${idx}`} className={s.listRowColumn}>
                    <strong>{event.type}</strong>
                    <small>{new Date(event.at).toLocaleString()} | {event.actorName || 'system'}</small>
                    <small>{event.message}</small>
                  </div>
                ))}
                {!qualityHistory.timeline?.length && <small>No timeline events</small>}
              </div>
            </>
          ) : (
            <div className={s.subtle}>Select a live call to inspect quality history.</div>
          )}
        </section>

        <section className={s.card}>
          <div className={s.cardHeaderRow}>
            <h3 className={s.cardTitle}>Flag queue</h3>
            <div className={s.inlineControls}>
              <select
                value={callFlagsStatus}
                onChange={(e) => {
                  setCallFlagsOffset(0);
                  setCallFlagsStatus(e.target.value as 'open' | 'resolved' | 'all');
                }}
                className={s.select}
              >
                <option value="open">Open</option>
                <option value="resolved">Resolved</option>
                <option value="all">All</option>
              </select>
              <button className={s.smallButton} onClick={onReloadModerator}>Refresh</button>
            </div>
          </div>

          <div className={s.inlineControlsWrap}>
            <input
              className={s.input}
              placeholder="Search call/reason/user"
              value={flagSearchDraft}
              onChange={(e) => setFlagSearchDraft(e.target.value)}
            />
            <select value={callFlagsSortBy} onChange={(e) => setCallFlagsSortBy(e.target.value as typeof callFlagsSortBy)} className={s.select}>
              <option value="createdAt">Created</option>
              <option value="status">Status</option>
              <option value="actorRole">Actor Role</option>
            </select>
            <select value={callFlagsSortDir} onChange={(e) => setCallFlagsSortDir(e.target.value as typeof callFlagsSortDir)} className={s.select}>
              <option value="desc">Desc</option>
              <option value="asc">Asc</option>
            </select>
          </div>

          <div className={s.listBox}>
            {callFlags.map((flag) => (
              <div key={flag.id} className={s.listRowColumn}>
                <strong>{flag.call ? `${flag.call.caller.username} -> ${flag.call.callee.username}` : flag.callId}</strong>
                <small>{new Date(flag.createdAt).toLocaleString()} | {flag.status} | by {flag.actorRole}</small>
                <small>Reason: {flag.reason}</small>
                <div className={s.inlineControls}>
                  <button className={s.smallButton} onClick={() => setSelectedCallId(flag.callId)}>Inspect</button>
                  {flag.status === 'open' && (
                    <button className={s.smallButton} onClick={() => onResolveCallFlag(flag.id)}>Resolve</button>
                  )}
                </div>
              </div>
            ))}
            {!callFlags.length && <small>No flags in this view</small>}
          </div>

          <div className={s.paginationRow}>
            <span className={s.subtleSmall}>Page {currentPage}/{totalPages}</span>
            <button
              className={s.smallButton}
              disabled={currentPage <= 1}
              onClick={() => setCallFlagsOffset(Math.max(0, callFlagsOffset - callFlagsLimit))}
            >
              Prev
            </button>
            <button
              className={s.smallButton}
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
  <div className={s.summaryCard}>
    <div className={s.summaryLabel}>{label}</div>
    <div className={s.summaryValue}>{value}</div>
  </div>
);

const OnlineUserRow = React.memo(
  ({ user, changed }: { user: ModeratorOnlineUser; changed: boolean }) => (
    <tr className={[s.tableRow, changed ? s.updatedRow : ''].filter(Boolean).join(' ')}>
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
  <div className={s.metricCard}>
    <div className={s.summaryLabel}>{label}</div>
    <div className={s.metricValue}>{value}</div>
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
  if (level === 'critical') return <span className={s.badgeCritical}>critical</span>;
  if (level === 'warning') return <span className={s.badgeWarning}>warning</span>;
  return <span className={s.badgeHealthy}>clean</span>;
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

// styles moved to ModeratorPage.module.css
