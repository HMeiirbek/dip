import React, { useEffect, useMemo, useState } from 'react';
import apiService, { getAxiosErrorMessage } from '../services/api';
import {
  AdminAnalytics,
  AdminDashboard,
  AdminLogItem,
  AdminManagedSession,
  AdminReports,
  AdminSecurityEvent,
  AdminSlaSummary,
  AdminTrafficLog,
  AdminUser,
  AdminUserDetail,
  BlacklistEntry,
  MlMetrics,
  MlStatus,
  ModeratorOverview,
  ModeratorPresenceSnapshot,
} from '../types';

type Props = {
  isAdmin: boolean;
  currentUserId?: string;
  loading: boolean;
  adminDashboard: AdminDashboard | null;
  adminAnalytics: AdminAnalytics | null;
  adminSlaSummary: AdminSlaSummary | null;
  adminReports: AdminReports | null;
  adminLogs: AdminLogItem[];
  adminUsers: AdminUser[];
  adminSessions: AdminManagedSession[];
  adminSecurityActivity: AdminSecurityEvent[];
  adminTrafficLogs: AdminTrafficLog[];
  moderatorPresence: ModeratorPresenceSnapshot | null;
  moderatorOverview: ModeratorOverview | null;
  mlStatus: MlStatus | null;
  mlMetrics: MlMetrics | null;
  blacklist: BlacklistEntry[];
  blacklistPhone: string;
  setBlacklistPhone: React.Dispatch<React.SetStateAction<string>>;
  blacklistReason: string;
  setBlacklistReason: React.Dispatch<React.SetStateAction<string>>;
  onReloadAdmin: () => Promise<void> | void;
  onReloadLiveOps: () => Promise<void> | void;
  onReloadMl: () => Promise<void> | void;
  onAddBlacklist: () => Promise<void> | void;
  onDeleteBlacklist: (id: string) => Promise<void> | void;
  onUpdateUserRole: (id: string, role: 'user' | 'admin' | 'moderator') => Promise<void> | void;
  onDeleteUser: (id: string) => Promise<void> | void;
  onForceEndCall: (id: string) => Promise<void> | void;
};

export const AdminPage: React.FC<Props> = ({
  isAdmin,
  currentUserId,
  loading,
  adminDashboard,
  adminAnalytics,
  adminSlaSummary,
  adminReports,
  adminLogs,
  adminUsers,
  adminSessions,
  adminSecurityActivity,
  adminTrafficLogs,
  moderatorPresence,
  moderatorOverview,
  mlStatus,
  mlMetrics,
  blacklist,
  blacklistPhone,
  setBlacklistPhone,
  blacklistReason,
  setBlacklistReason,
  onReloadAdmin,
  onReloadLiveOps,
  onReloadMl,
  onAddBlacklist,
  onDeleteBlacklist,
  onUpdateUserRole,
  onDeleteUser,
  onForceEndCall,
}) => {
  const [userQuery, setUserQuery] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userDetail, setUserDetail] = useState<AdminUserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [passwordDraft, setPasswordDraft] = useState('');
  const [actionBusy, setActionBusy] = useState<string>('');

  const filteredUsers = useMemo(() => {
    const query = userQuery.trim().toLowerCase();
    if (!query) return adminUsers;
    return adminUsers.filter((user) => {
      return (
        user.username.toLowerCase().includes(query) ||
        user.id.toLowerCase().includes(query) ||
        user.role.toLowerCase().includes(query)
      );
    });
  }, [adminUsers, userQuery]);

  useEffect(() => {
    if (!selectedUserId && filteredUsers[0]) {
      setSelectedUserId(filteredUsers[0].id);
      return;
    }
    if (selectedUserId && !filteredUsers.find((user) => user.id === selectedUserId)) {
      setSelectedUserId(filteredUsers[0]?.id || null);
    }
  }, [filteredUsers, selectedUserId]);

  useEffect(() => {
    let cancelled = false;
    const loadDetail = async () => {
      if (!selectedUserId) {
        setUserDetail(null);
        return;
      }
      setDetailLoading(true);
      setDetailError('');
      try {
        const detail = await apiService.getAdminUserDetail(selectedUserId);
        if (!cancelled) setUserDetail(detail);
      } catch (error) {
        if (!cancelled) {
          setUserDetail(null);
          setDetailError(getAxiosErrorMessage(error));
        }
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    };
    loadDetail();
    return () => {
      cancelled = true;
    };
  }, [selectedUserId]);

  if (!isAdmin) {
    return <div style={styles.empty}>No access. Admin role required.</div>;
  }

  const refreshSelectedUser = async () => {
    if (!selectedUserId) return;
    const detail = await apiService.getAdminUserDetail(selectedUserId);
    setUserDetail(detail);
  };

  const runUserAction = async (key: string, callback: () => Promise<void>) => {
    try {
      setActionBusy(key);
      setDetailError('');
      await callback();
      await onReloadAdmin();
      await refreshSelectedUser();
    } catch (error) {
      setDetailError(getAxiosErrorMessage(error));
    } finally {
      setActionBusy('');
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.pageHeader}>
        <div>
          <div style={styles.eyebrow}>Admin Workspace</div>
          <h2 style={styles.heading}>Users, sessions, logs and platform control</h2>
          <div style={styles.subtle}>Full operational access with role and password management.</div>
        </div>
        <div style={styles.headerActions}>
          <button style={styles.secondaryButton} onClick={onReloadAdmin}>Reload admin data</button>
          <button style={styles.primaryButton} onClick={onReloadMl}>Reload ML</button>
        </div>
      </div>

      <div style={styles.summaryGrid}>
        <SummaryCard label="Users" value={String(adminDashboard?.users ?? adminUsers.length)} hint={`online ${adminUsers.filter((user) => user.online).length}`} />
        <SummaryCard label="Calls" value={String(adminDashboard?.totalCalls ?? 0)} hint={`ongoing ${adminDashboard?.ongoingCalls ?? 0}`} />
        <SummaryCard label="Live online" value={String(moderatorPresence?.onlineCount ?? 0)} hint="socket presence" />
        <SummaryCard label="Live calls" value={String(moderatorOverview?.callCount ?? 0)} hint={`alerts ${moderatorOverview?.qualitySummary?.alerts?.length || 0}`} />
        <SummaryCard label="Reports" value={String(adminReports?.total ?? adminDashboard?.reports ?? 0)} hint={`blacklist ${blacklist.length}`} />
        <SummaryCard label="SLA setup p95" value={formatMetric(adminSlaSummary?.callSetup.p95Sec, 's')} hint={`<=8s target`} />
        <SummaryCard label="RTT ok 24h" value={formatMetric(adminSlaSummary?.quality24h.rttLe200Pct, '%')} hint={`samples ${adminSlaSummary?.quality24h.samples ?? 0}`} />
        <SummaryCard label="ML" value={mlStatus?.active ? (mlStatus.model?.version || 'active') : 'inactive'} hint={`acc ${formatMetric(mlMetrics?.accuracy, '%')}`} />
      </div>

      <div style={styles.gridSecondary}>
        <section style={styles.card}>
          <div style={styles.cardHeaderRow}>
            <h3 style={styles.cardTitle}>Live presence</h3>
            <button style={styles.smallButton} onClick={onReloadLiveOps}>Refresh live ops</button>
          </div>
          <div style={styles.tableWrapShort}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>IP</th>
                  <th>Device</th>
                  <th>Connected</th>
                </tr>
              </thead>
              <tbody>
                {(moderatorPresence?.onlineUsers || []).map((user) => (
                  <tr key={user.userId}>
                    <td>{user.username}</td>
                    <td>{user.role}</td>
                    <td>{user.ipAddress}</td>
                    <td>{user.deviceInfo}</td>
                    <td>{new Date(user.connectedAt).toLocaleTimeString()}</td>
                  </tr>
                ))}
                {!moderatorPresence?.onlineUsers?.length && (
                  <tr>
                    <td colSpan={5}>No online users</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section style={styles.card}>
          <div style={styles.cardHeaderRow}>
            <h3 style={styles.cardTitle}>Live calls and quality</h3>
            <span style={styles.subtleSmall}>{moderatorOverview?.qualitySummary?.alerts?.length || 0} alerts</span>
          </div>
          <div style={styles.tableWrapShort}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Duration</th>
                  <th>Caller</th>
                  <th>Callee</th>
                  <th>Metrics</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {(moderatorOverview?.calls || []).map((call) => (
                  <tr key={call.id}>
                    <td>{call.status}</td>
                    <td>{formatDuration(call.durationSec)}</td>
                    <td>{call.caller.username}</td>
                    <td>{call.callee.username}</td>
                    <td>
                      RTT {formatMetric(call.quality?.rttMs, 'ms')}<br />
                      J {formatMetric(call.quality?.jitterMs, 'ms')}<br />
                      L {formatMetric(call.quality?.packetLossPct, '%')}
                    </td>
                    <td>
                      <button style={styles.smallDanger} onClick={() => onForceEndCall(call.id)}>
                        Force End
                      </button>
                    </td>
                  </tr>
                ))}
                {!moderatorOverview?.calls?.length && (
                  <tr>
                    <td colSpan={6}>No live calls</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div style={styles.listBoxCompact}>
            {(moderatorOverview?.qualitySummary?.alerts || []).slice(0, 12).map((alert, idx) => (
              <div key={`${alert.callId}-${alert.metric}-${idx}`} style={styles.listRowColumn}>
                <strong>{alert.level.toUpperCase()} | {alert.metric}</strong>
                <small>{alert.message}</small>
              </div>
            ))}
            {!moderatorOverview?.qualitySummary?.alerts?.length && <small>No live quality alerts</small>}
          </div>
        </section>
      </div>

      <div style={styles.gridMain}>
        <section style={styles.card}>
          <div style={styles.cardHeaderRow}>
            <h3 style={styles.cardTitle}>User directory</h3>
            {loading && <span style={styles.subtleSmall}>Loading...</span>}
          </div>
          <div style={styles.inlineControlsWrap}>
            <input
              style={styles.input}
              placeholder="Search user / id / role"
              value={userQuery}
              onChange={(e) => setUserQuery(e.target.value)}
            />
            <span style={styles.subtleSmall}>Total {filteredUsers.length}</span>
          </div>
          <div style={styles.tableWrapTall}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Verified</th>
                  <th>Sessions</th>
                  <th>Calls</th>
                  <th>Reports</th>
                  <th>Last seen</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr
                    key={user.id}
                    style={selectedUserId === user.id ? styles.selectedRow : undefined}
                    onClick={() => setSelectedUserId(user.id)}
                  >
                    <td>
                      <div style={styles.listRowColumn}>
                        <strong>{user.username}</strong>
                        <small>{user.id.slice(0, 8)}... {user.online ? '● online' : '○ offline'}</small>
                      </div>
                    </td>
                    <td>{user.role}</td>
                    <td>{user.verified ? 'yes' : 'no'}</td>
                    <td>{user.activeSessions}/{user.totalSessions}</td>
                    <td>{user.totalCalls}</td>
                    <td>{user.reportsSubmitted}</td>
                    <td>{user.lastSeenAt ? new Date(user.lastSeenAt).toLocaleString() : '-'}</td>
                  </tr>
                ))}
                {!filteredUsers.length && (
                  <tr>
                    <td colSpan={7}>No users found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section style={styles.card}>
          <div style={styles.cardHeaderRow}>
            <h3 style={styles.cardTitle}>Selected user</h3>
            {detailLoading && <span style={styles.subtleSmall}>Loading user...</span>}
          </div>
          {detailError && <div style={styles.errorBox}>{detailError}</div>}
          {userDetail ? (
            <>
              <div style={styles.detailHero}>
                <div>
                  <div style={styles.detailTitle}>{userDetail.user.username}</div>
                  <div style={styles.subtleSmall}>
                    {userDetail.user.id} | role {userDetail.user.role} | {userDetail.user.verified ? 'verified' : 'unverified'}
                  </div>
                </div>
                <div style={styles.inlineControls}>
                  <button style={styles.smallButton} onClick={() => runUserAction('role-user', async () => onUpdateUserRole(userDetail.user.id, 'user'))}>user</button>
                  <button style={styles.smallButton} onClick={() => runUserAction('role-moderator', async () => onUpdateUserRole(userDetail.user.id, 'moderator'))}>moderator</button>
                  <button style={styles.smallButton} onClick={() => runUserAction('role-admin', async () => onUpdateUserRole(userDetail.user.id, 'admin'))}>admin</button>
                </div>
              </div>

              <div style={styles.metricGrid}>
                <MetricTile label="Total calls" value={String(userDetail.stats.totalCalls)} />
                <MetricTile label="Initiated" value={String(userDetail.stats.initiatedCalls)} />
                <MetricTile label="Received" value={String(userDetail.stats.receivedCalls)} />
                <MetricTile label="Active sessions" value={String(userDetail.stats.activeSessions)} />
                <MetricTile label="Reports" value={String(userDetail.stats.reportsSubmitted)} />
                <MetricTile label="Open flags" value={String(userDetail.stats.openFlags)} />
              </div>

              <div style={styles.sectionBlock}>
                <div style={styles.cardHeaderRow}>
                  <strong>Password and sessions</strong>
                  <span style={styles.subtleSmall}>Current password is never visible.</span>
                </div>
                <div style={styles.inlineControlsWrap}>
                  <input
                    style={styles.input}
                    type="password"
                    placeholder="New password (min 8 chars)"
                    value={passwordDraft}
                    onChange={(e) => setPasswordDraft(e.target.value)}
                  />
                  <button
                    style={styles.smallButton}
                    disabled={passwordDraft.trim().length < 8 || actionBusy === 'password-reset'}
                    onClick={() => runUserAction('password-reset', async () => {
                      await apiService.resetAdminUserPassword(userDetail.user.id, passwordDraft.trim());
                      setPasswordDraft('');
                    })}
                  >
                    Reset password
                  </button>
                  <button
                    style={styles.smallButton}
                    disabled={actionBusy === 'revoke-sessions'}
                    onClick={() => runUserAction('revoke-sessions', async () => {
                      await apiService.revokeAdminUserSessions(userDetail.user.id);
                    })}
                  >
                    Revoke all sessions
                  </button>
                  <button
                    style={styles.smallDanger}
                    disabled={currentUserId === userDetail.user.id || actionBusy === 'delete-user'}
                    onClick={async () => {
                      try {
                        setActionBusy('delete-user');
                        setDetailError('');
                        await onDeleteUser(userDetail.user.id);
                        setUserDetail(null);
                        setSelectedUserId(null);
                        await onReloadAdmin();
                      } catch (error) {
                        setDetailError(getAxiosErrorMessage(error));
                      } finally {
                        setActionBusy('');
                      }
                    }}
                    title={currentUserId === userDetail.user.id ? 'Self delete disabled' : 'Delete user'}
                  >
                    Delete user
                  </button>
                </div>
              </div>

              <div style={styles.sectionBlock}>
                <strong>Presence</strong>
                <div style={styles.listBoxCompact}>
                  {userDetail.presence.map((entry) => (
                    <div key={entry.socketId} style={styles.listRowColumn}>
                      <small>socket {entry.socketId}</small>
                      <small>connected {new Date(entry.connectedAt).toLocaleString()}</small>
                    </div>
                  ))}
                  {!userDetail.presence.length && <small>No active socket presence</small>}
                </div>
              </div>

              <div style={styles.sectionBlock}>
                <strong>Sessions ({userDetail.sessions.length})</strong>
                <div style={styles.tableWrapShort}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th>State</th>
                        <th>Device</th>
                        <th>IP</th>
                        <th>Last seen</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {userDetail.sessions.map((session) => (
                        <tr key={session.id}>
                          <td>{session.active ? 'active' : 'inactive'}</td>
                          <td>{session.deviceInfo}</td>
                          <td>{session.ipAddress}</td>
                          <td>{new Date(session.lastSeenAt).toLocaleString()}</td>
                          <td>
                            <button
                              style={styles.smallButton}
                              disabled={actionBusy === `session-${session.id}`}
                              onClick={() => runUserAction(`session-${session.id}`, async () => {
                                await apiService.revokeAdminUserSession(userDetail.user.id, session.id);
                              })}
                            >
                              Revoke
                            </button>
                          </td>
                        </tr>
                      ))}
                      {!userDetail.sessions.length && (
                        <tr>
                          <td colSpan={5}>No sessions</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div style={styles.sectionBlock}>
                <strong>Call history ({userDetail.callHistory.length})</strong>
                <div style={styles.listBoxCompact}>
                  {userDetail.callHistory.map((call) => (
                    <div key={call.id} style={styles.listRowColumn}>
                      <strong>{call.direction} | {call.counterpart.username}</strong>
                      <small>{call.status} | {new Date(call.createdAt).toLocaleString()} | {formatMetric(call.durationSec, 's')}</small>
                    </div>
                  ))}
                  {!userDetail.callHistory.length && <small>No calls</small>}
                </div>
              </div>

              <div style={styles.sectionBlock}>
                <strong>Security activity ({userDetail.securityActivity.length})</strong>
                <div style={styles.listBoxCompact}>
                  {userDetail.securityActivity.map((event, idx) => (
                    <div key={`${event.createdAt}-${idx}`} style={styles.listRowColumn}>
                      <strong>{event.action}</strong>
                      <small>{new Date(event.createdAt).toLocaleString()} | {event.ipAddress || '-'} | {event.deviceInfo || '-'}</small>
                    </div>
                  ))}
                  {!userDetail.securityActivity.length && <small>No security activity</small>}
                </div>
              </div>

              <div style={styles.sectionBlock}>
                <strong>Reports ({userDetail.reports.length})</strong>
                <div style={styles.listBoxCompact}>
                  {userDetail.reports.map((report) => (
                    <div key={report.id} style={styles.listRowColumn}>
                      <strong>{report.phoneNumber}</strong>
                      <small>{report.status || 'pending'} | {new Date(report.createdAt).toLocaleString()}</small>
                      {report.description && <small>{report.description}</small>}
                    </div>
                  ))}
                  {!userDetail.reports.length && <small>No reports</small>}
                </div>
              </div>
            </>
          ) : (
            <div style={styles.subtle}>Select a user to inspect full details.</div>
          )}
        </section>
      </div>

      <div style={styles.gridSecondary}>
        <section style={styles.card}>
          <div style={styles.cardHeaderRow}>
            <h3 style={styles.cardTitle}>Platform sessions</h3>
            <span style={styles.subtleSmall}>{adminSessions.length} recent sessions</span>
          </div>
          <div style={styles.tableWrapShort}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Device</th>
                  <th>IP</th>
                  <th>Last seen</th>
                  <th>State</th>
                </tr>
              </thead>
              <tbody>
                {adminSessions.slice(0, 80).map((session) => (
                  <tr key={session.id}>
                    <td>{session.username}</td>
                    <td>{session.role}</td>
                    <td>{session.deviceInfo}</td>
                    <td>{session.ipAddress}</td>
                    <td>{new Date(session.lastSeenAt).toLocaleString()}</td>
                    <td>{session.active ? 'active' : 'inactive'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section style={styles.card}>
          <div style={styles.cardHeaderRow}>
            <h3 style={styles.cardTitle}>Traffic logs</h3>
            <span style={styles.subtleSmall}>{adminTrafficLogs.length} samples</span>
          </div>
          <div style={styles.tableWrapShort}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th>When</th>
                  <th>User</th>
                  <th>Call</th>
                  <th>Metrics</th>
                </tr>
              </thead>
              <tbody>
                {adminTrafficLogs.slice(0, 80).map((row) => (
                  <tr key={row.id}>
                    <td>{new Date(row.createdAt).toLocaleString()}</td>
                    <td>{row.username}</td>
                    <td>{`${row.callerUsername} -> ${row.calleeUsername} (${row.callStatus})`}</td>
                    <td>
                      RTT {formatMetric(row.rttMs, 'ms')}<br />
                      J {formatMetric(row.jitterMs, 'ms')}<br />
                      L {formatMetric(row.packetLossPct, '%')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <div style={styles.gridSecondary}>
        <section style={styles.card}>
          <div style={styles.cardHeaderRow}>
            <h3 style={styles.cardTitle}>Security and system logs</h3>
            <span style={styles.subtleSmall}>{adminSecurityActivity.length} security events</span>
          </div>
          <div style={styles.listBox}>
            {adminSecurityActivity.slice(0, 120).map((event, idx) => (
              <div key={`${event.createdAt}-${event.userId}-${idx}`} style={styles.listRowColumn}>
                <strong>{event.username}</strong>
                <small>{event.action}</small>
                <small>{new Date(event.createdAt).toLocaleString()} | {event.ipAddress || '-'} | {event.deviceInfo || '-'}</small>
              </div>
            ))}
          </div>
          <div style={styles.listBoxCompact}>
            {adminLogs.slice(0, 40).map((log, idx) => (
              <div key={`${idx}-${log.action || log.message}`} style={styles.listRowColumn}>
                <strong>{log.action || log.message}</strong>
                <small>{new Date(log.createdAt).toLocaleString()} | {log.level || log.type || 'info'}</small>
              </div>
            ))}
          </div>
        </section>

        <section style={styles.card}>
          <div style={styles.cardHeaderRow}>
            <h3 style={styles.cardTitle}>Reports and blacklist</h3>
            <span style={styles.subtleSmall}>Top numbers and global blocklist</span>
          </div>
          <div style={styles.metricGrid}>
            {(adminReports?.topNumbers || []).slice(0, 4).map((item) => (
              <MetricTile key={item.phoneNumber} label={item.phoneNumber} value={String(item.count)} />
            ))}
            {!adminReports?.topNumbers?.length && <MetricTile label="Top numbers" value="-" />}
          </div>

          <div style={styles.inlineControlsWrap}>
            <input style={styles.input} placeholder="Phone number" value={blacklistPhone} onChange={(e) => setBlacklistPhone(e.target.value)} />
            <input style={styles.input} placeholder="Reason" value={blacklistReason} onChange={(e) => setBlacklistReason(e.target.value)} />
            <button style={styles.smallButton} onClick={onAddBlacklist}>Add to blacklist</button>
          </div>

          <div style={styles.listBoxCompact}>
            {blacklist.map((item) => (
              <div key={item.id} style={styles.listItemBetween}>
                <div style={styles.listRowColumn}>
                  <strong>{item.phoneNumber}</strong>
                  <small>{item.reason || '-'} | {item.source || '-'}</small>
                </div>
                <button style={styles.smallDanger} onClick={() => onDeleteBlacklist(item.id)}>Delete</button>
              </div>
            ))}
            {!blacklist.length && <small>No blacklist entries</small>}
          </div>
        </section>
      </div>
    </div>
  );
};

const SummaryCard: React.FC<{ label: string; value: string; hint?: string }> = ({ label, value, hint }) => (
  <div style={styles.summaryCard}>
    <div style={styles.summaryLabel}>{label}</div>
    <div style={styles.summaryValue}>{value}</div>
    <div style={styles.subtleSmall}>{hint || '\u00a0'}</div>
  </div>
);

const MetricTile: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={styles.metricCard}>
    <div style={styles.summaryLabel}>{label}</div>
    <div style={styles.metricValue}>{value}</div>
  </div>
);

function formatMetric(value: number | null | undefined, suffix: string) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '-';
  return `${value.toFixed(2)}${suffix}`;
}

function formatDuration(totalSec?: number) {
  const value = Math.max(0, totalSec || 0);
  const min = Math.floor(value / 60);
  const sec = value % 60;
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

const styles: Record<string, React.CSSProperties> = {
  page: { display: 'flex', flexDirection: 'column', gap: 16 },
  pageHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' },
  headerActions: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  eyebrow: { textTransform: 'uppercase', letterSpacing: 1.4, fontSize: 11, color: 'var(--muted)' },
  heading: { margin: '6px 0 4px', fontSize: 24 },
  subtle: { fontSize: 13, color: 'var(--muted)' },
  subtleSmall: { fontSize: 12, color: 'var(--muted)' },
  summaryGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 },
  gridMain: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 },
  gridSecondary: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16 },
  card: { background: 'var(--panel-bg)', border: '1px solid var(--border)', borderRadius: 20, padding: 16, boxShadow: 'var(--shadow-soft)', display: 'flex', flexDirection: 'column', gap: 12 },
  cardHeaderRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  cardTitle: { margin: 0, fontSize: 18 },
  summaryCard: { background: 'var(--panel-bg)', border: '1px solid var(--border)', borderRadius: 18, padding: 16, boxShadow: 'var(--shadow-soft)' },
  summaryLabel: { color: 'var(--muted)', fontSize: 12, marginBottom: 6 },
  summaryValue: { fontSize: 28, fontWeight: 900 },
  tableWrap: { overflowX: 'auto' },
  tableWrapTall: { overflow: 'auto', maxHeight: 680 },
  tableWrapShort: { overflow: 'auto', maxHeight: 360 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  selectedRow: { background: 'rgba(12,108,255,0.08)' },
  inlineControls: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  inlineControlsWrap: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  input: { borderRadius: 10, border: '1px solid var(--border)', background: 'var(--panel-bg2)', color: 'var(--text)', padding: '8px 10px', minWidth: 180 },
  primaryButton: { borderRadius: 12, border: 'none', background: 'var(--primary)', color: '#fff', padding: '10px 14px', fontWeight: 800, cursor: 'pointer' },
  secondaryButton: { borderRadius: 12, border: '1px solid var(--border)', background: 'var(--panel-bg2)', color: 'var(--text)', padding: '10px 14px', fontWeight: 800, cursor: 'pointer' },
  smallButton: { borderRadius: 10, border: '1px solid var(--border)', background: 'var(--panel-bg2)', color: 'var(--text)', padding: '6px 10px', cursor: 'pointer' },
  smallDanger: { borderRadius: 10, border: '1px solid rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.12)', color: '#ef4444', padding: '6px 10px', cursor: 'pointer' },
  metricGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 },
  metricCard: { background: 'var(--panel-bg2)', borderRadius: 14, padding: 12, border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 6 },
  metricValue: { fontSize: 20, fontWeight: 800 },
  detailHero: { display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' },
  detailTitle: { fontSize: 20, fontWeight: 900 },
  sectionBlock: { display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 8, borderTop: '1px solid var(--border)' },
  listBox: { display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto', paddingRight: 4 },
  listBoxCompact: { display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 220, overflowY: 'auto', paddingRight: 4 },
  listRowColumn: { display: 'flex', flexDirection: 'column', gap: 4, padding: 10, borderRadius: 12, background: 'var(--panel-bg2)' },
  listItemBetween: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: 10, borderRadius: 12, background: 'var(--panel-bg2)' },
  errorBox: { borderRadius: 12, padding: 10, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.22)', color: '#ef4444' },
  empty: { padding: 20, borderRadius: 16, background: 'var(--panel-bg)', border: '1px solid var(--border)' },
};
