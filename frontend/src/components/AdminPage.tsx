import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import apiService, { getAxiosErrorMessage } from '../services/api';
import s from './AdminPage.module.css';
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
  adminAnalytics: _adminAnalytics,
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

  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'user'|'admin'|'moderator'>('user');
  const [createError, setCreateError] = useState('');

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
    return <div className={s.empty}>No access. Admin role required.</div>;
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

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim()) return;
    try {
      setActionBusy('create-user');
      setCreateError('');
      await apiService.createAdminUser(newUsername, newPassword, newRole);
      setNewUsername('');
      setNewPassword('');
      setNewRole('user');
      await onReloadAdmin();
    } catch (error) {
      setCreateError(getAxiosErrorMessage(error));
    } finally {
      setActionBusy('');
    }
  };

  return (
    <div className={s.page}>
      <div className={s.pageHeader}>
        <div>
          <div className={s.eyebrow}>Admin Workspace</div>
          <h2 className={s.heading}>Users, sessions, logs and platform control</h2>
          <div className={s.subtle}>Full operational access with role and password management.</div>
        </div>
        <div className={s.headerActions}>
          <button className={s.secondaryButton} onClick={onReloadAdmin}>Reload admin data</button>
          <button className={s.primaryButton} onClick={onReloadMl}>Reload ML</button>
        </div>
      </div>

      <div className={s.summaryGrid}>
        <SummaryCard label="Users" value={String(adminDashboard?.users ?? adminUsers.length)} hint={`online ${adminUsers.filter((user) => user.online).length}`} />
        <SummaryCard label="Calls" value={String(adminDashboard?.totalCalls ?? 0)} hint={`ongoing ${adminDashboard?.ongoingCalls ?? 0}`} />
        <SummaryCard label="Live online" value={String(moderatorPresence?.onlineCount ?? 0)} hint="socket presence" />
        <SummaryCard label="Live calls" value={String(moderatorOverview?.callCount ?? 0)} hint={`alerts ${moderatorOverview?.qualitySummary?.alerts?.length || 0}`} />
        <SummaryCard label="Reports" value={String(adminReports?.total ?? adminDashboard?.reports ?? 0)} hint={`blacklist ${blacklist.length}`} />
        <SummaryCard label="SLA setup p95" value={formatMetric(adminSlaSummary?.callSetup.p95Sec, 's')} hint={`<=8s target`} />
        <SummaryCard label="RTT ok 24h" value={formatMetric(adminSlaSummary?.quality24h.rttLe200Pct, '%')} hint={`samples ${adminSlaSummary?.quality24h.samples ?? 0}`} />
        <SummaryCard label="ML" value={mlStatus?.active ? (mlStatus.model?.version || 'active') : 'inactive'} hint={`acc ${formatMetric(mlMetrics?.accuracy, '%')}`} />
      </div>

      <div className={s.gridSecondary}>
        <section className={s.card}>
          <div className={s.cardHeaderRow}>
            <h3 className={s.cardTitle}>Live presence</h3>
            <button className={s.smallButton} onClick={onReloadLiveOps}>Refresh live ops</button>
          </div>
          <div className={s.tableWrapShort}>
            <table className={s.table}>
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

        <section className={s.card}>
          <div className={s.cardHeaderRow}>
            <h3 className={s.cardTitle}>Live calls and quality</h3>
            <span className={s.subtleSmall}>{moderatorOverview?.qualitySummary?.alerts?.length || 0} alerts</span>
          </div>
          <div className={s.tableWrapShort}>
            <table className={s.table}>
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
                      <button className={s.smallDanger} onClick={() => onForceEndCall(call.id)}>
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

          <div className={s.listBoxCompact}>
            {(moderatorOverview?.qualitySummary?.alerts || []).slice(0, 12).map((alert, idx) => (
              <div key={`${alert.callId}-${alert.metric}-${idx}`} className={s.listRowColumn}>
                <strong>{alert.level.toUpperCase()} | {alert.metric}</strong>
                <small>{alert.message}</small>
              </div>
            ))}
            {!moderatorOverview?.qualitySummary?.alerts?.length && <small>No live quality alerts</small>}
          </div>
        </section>
      </div>

      <div className={s.gridMain}>
        <section className={s.card}>
          <div className={s.cardHeaderRow}>
            <h3 className={s.cardTitle}>Add User</h3>
          </div>
          {createError && <div className={s.errorBox}>{createError}</div>}
          <form className={s.inlineControlsWrap} onSubmit={handleCreateUser}>
            <input
              className={s.input}
              placeholder="Username"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              required
            />
            <input
              className={s.input}
              placeholder="Password (optional)"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <select
              className={s.input}
              style={{ width: 'auto' }}
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as any)}
            >
              <option value="user">User</option>
              <option value="moderator">Moderator</option>
              <option value="admin">Admin</option>
            </select>
            <button
              type="submit"
              className={s.primaryButton}
              disabled={actionBusy === 'create-user' || !newUsername.trim()}
            >
              {actionBusy === 'create-user' ? 'Creating...' : 'Create User'}
            </button>
          </form>
        </section>

        <section className={s.card}>
          <div className={s.cardHeaderRow}>
            <h3 className={s.cardTitle}>User directory</h3>
            {loading && <span className={s.subtleSmall}>Loading...</span>}
          </div>
          <div className={s.inlineControlsWrap}>
            <input
              className={s.input}
              placeholder="Search user / id / role"
              value={userQuery}
              onChange={(e) => setUserQuery(e.target.value)}
            />
            <span className={s.subtleSmall}>Total {filteredUsers.length}</span>
          </div>
          <div className={s.tableWrapTall}>
            <table className={s.table}>
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
                    className={[
                      s.clickableRow,
                      selectedUserId === user.id ? s.selectedRow : '',
                    ].filter(Boolean).join(' ')}
                    onClick={() => setSelectedUserId(user.id)}
                  >
                    <td>
                      <div className={s.listRowColumn}>
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

        <section className={s.card}>
          <div className={s.cardHeaderRow}>
            <h3 className={s.cardTitle}>Selected user</h3>
            {detailLoading && <span className={s.subtleSmall}>Loading user...</span>}
          </div>
          {detailError && <div className={s.errorBox}>{detailError}</div>}
          {userDetail ? (
            <>
              <div className={s.detailHero}>
                <div>
                  <div className={s.detailTitle}>{userDetail.user.username}</div>
                  <div className={s.subtleSmall}>
                    {userDetail.user.id} | role {userDetail.user.role} | {userDetail.user.verified ? 'verified' : 'unverified'}
                  </div>
                </div>
                <div className={s.inlineControls}>
                  <button className={s.smallButton} onClick={() => runUserAction('role-user', async () => onUpdateUserRole(userDetail.user.id, 'user'))}>user</button>
                  <button className={s.smallButton} onClick={() => runUserAction('role-moderator', async () => onUpdateUserRole(userDetail.user.id, 'moderator'))}>moderator</button>
                  <button className={s.smallButton} onClick={() => runUserAction('role-admin', async () => onUpdateUserRole(userDetail.user.id, 'admin'))}>admin</button>
                </div>
              </div>

              <div className={s.metricGrid}>
                <MetricTile label="Total calls" value={String(userDetail.stats.totalCalls)} />
                <MetricTile label="Initiated" value={String(userDetail.stats.initiatedCalls)} />
                <MetricTile label="Received" value={String(userDetail.stats.receivedCalls)} />
                <MetricTile label="Active sessions" value={String(userDetail.stats.activeSessions)} />
                <MetricTile label="Reports" value={String(userDetail.stats.reportsSubmitted)} />
                <MetricTile label="Open flags" value={String(userDetail.stats.openFlags)} />
              </div>

              <div className={s.sectionBlock}>
                <div className={s.cardHeaderRow}>
                  <strong>Password and sessions</strong>
                  <span className={s.subtleSmall}>Current password is never visible.</span>
                </div>
                <div className={s.inlineControlsWrap}>
                  <input
                    className={s.input}
                    type="password"
                    placeholder="New password (min 8 chars)"
                    value={passwordDraft}
                    onChange={(e) => setPasswordDraft(e.target.value)}
                  />
                  <button
                    className={s.smallButton}
                    disabled={passwordDraft.trim().length < 8 || actionBusy === 'password-reset'}
                    onClick={() => runUserAction('password-reset', async () => {
                      await apiService.resetAdminUserPassword(userDetail.user.id, passwordDraft.trim());
                      setPasswordDraft('');
                    })}
                  >
                    Reset password
                  </button>
                  <button
                    className={s.smallButton}
                    disabled={actionBusy === 'revoke-sessions'}
                    onClick={() => runUserAction('revoke-sessions', async () => {
                      await apiService.revokeAdminUserSessions(userDetail.user.id);
                    })}
                  >
                    Revoke all sessions
                  </button>
                  <button
                    className={s.smallDanger}
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

              <div className={s.sectionBlock}>
                <strong>Presence</strong>
                <div className={s.listBoxCompact}>
                  {userDetail.presence.map((entry) => (
                    <div key={entry.socketId} className={s.listRowColumn}>
                      <small>socket {entry.socketId}</small>
                      <small>connected {new Date(entry.connectedAt).toLocaleString()}</small>
                    </div>
                  ))}
                  {!userDetail.presence.length && <small>No active socket presence</small>}
                </div>
              </div>

              <div className={s.sectionBlock}>
                <strong>Sessions ({userDetail.sessions.length})</strong>
                <div className={s.tableWrapShort}>
                  <table className={s.table}>
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
                              className={s.smallButton}
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

              <div className={s.sectionBlock}>
                <strong>Call history ({userDetail.callHistory.length})</strong>
                <div className={s.listBoxCompact}>
                  {userDetail.callHistory.map((call) => (
                    <div key={call.id} className={s.listRowColumn}>
                      <strong>{call.direction} | {call.counterpart.username}</strong>
                      <small>{call.status} | {new Date(call.createdAt).toLocaleString()} | {formatMetric(call.durationSec, 's')}</small>
                    </div>
                  ))}
                  {!userDetail.callHistory.length && <small>No calls</small>}
                </div>
              </div>

              <div className={s.sectionBlock}>
                <strong>Security activity ({userDetail.securityActivity.length})</strong>
                <div className={s.listBoxCompact}>
                  {userDetail.securityActivity.map((event, idx) => (
                    <div key={`${event.createdAt}-${idx}`} className={s.listRowColumn}>
                      <strong>{event.action}</strong>
                      <small>{new Date(event.createdAt).toLocaleString()} | {event.ipAddress || '-'} | {event.deviceInfo || '-'}</small>
                    </div>
                  ))}
                  {!userDetail.securityActivity.length && <small>No security activity</small>}
                </div>
              </div>

              <div className={s.sectionBlock}>
                <strong>Reports ({userDetail.reports.length})</strong>
                <div className={s.listBoxCompact}>
                  {userDetail.reports.map((report) => (
                    <div key={report.id} className={s.listRowColumn}>
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
            <div className={s.subtle}>Select a user to inspect full details.</div>
          )}
        </section>
      </div>

      <div className={s.gridSecondary}>
        <section className={s.card}>
          <div className={s.cardHeaderRow}>
            <h3 className={s.cardTitle}>Platform sessions</h3>
            <span className={s.subtleSmall}>{adminSessions.length} recent sessions</span>
          </div>
          <div className={s.tableWrapShort}>
            <table className={s.table}>
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

        <section className={s.card}>
          <div className={s.cardHeaderRow}>
            <h3 className={s.cardTitle}>Traffic logs</h3>
            <span className={s.subtleSmall}>{adminTrafficLogs.length} samples</span>
          </div>
          <div className={s.tableWrapShort}>
            <table className={s.table}>
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

      <div className={s.gridSecondary}>
        <section className={s.card}>
          <div className={s.cardHeaderRow}>
            <h3 className={s.cardTitle}>Security and system logs</h3>
            <span className={s.subtleSmall}>{adminSecurityActivity.length} security events</span>
          </div>
          <div className={s.listBox}>
            {adminSecurityActivity.slice(0, 120).map((event, idx) => (
              <div key={`${event.createdAt}-${event.userId}-${idx}`} className={s.listRowColumn}>
                <strong>{event.username}</strong>
                <small>{event.action}</small>
                <small>{new Date(event.createdAt).toLocaleString()} | {event.ipAddress || '-'} | {event.deviceInfo || '-'}</small>
              </div>
            ))}
          </div>
          <div className={s.listBoxCompact}>
            {adminLogs.slice(0, 40).map((log, idx) => (
              <div key={`${idx}-${log.action || log.message}`} className={s.listRowColumn}>
                <strong>{log.action || log.message}</strong>
                <small>{new Date(log.createdAt).toLocaleString()} | {log.level || log.type || 'info'}</small>
              </div>
            ))}
          </div>
        </section>

        <section className={s.card}>
          <div className={s.cardHeaderRow}>
            <h3 className={s.cardTitle}>Reports and blacklist</h3>
            <span className={s.subtleSmall}>Top numbers and global blocklist</span>
          </div>
          <div className={s.metricGrid}>
            {(adminReports?.topNumbers || []).slice(0, 4).map((item) => (
              <MetricTile key={item.phoneNumber} label={item.phoneNumber} value={String(item.count)} />
            ))}
            {!adminReports?.topNumbers?.length && <MetricTile label="Top numbers" value="-" />}
          </div>

          <div className={s.inlineControlsWrap}>
            <input className={s.input} placeholder="Phone number" value={blacklistPhone} onChange={(e) => setBlacklistPhone(e.target.value)} />
            <input className={s.input} placeholder="Reason" value={blacklistReason} onChange={(e) => setBlacklistReason(e.target.value)} />
            <button className={s.smallButton} onClick={onAddBlacklist}>Add to blacklist</button>
          </div>

          <div className={s.listBoxCompact}>
            {blacklist.map((item) => (
              <div key={item.id} className={s.listItemBetween}>
                <div className={s.listRowColumn}>
                  <strong>{item.phoneNumber}</strong>
                  <small>{item.reason || '-'} | {item.source || '-'}</small>
                </div>
                <button className={s.smallDanger} onClick={() => onDeleteBlacklist(item.id)}>Delete</button>
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
  <div className={s.summaryCard}>
    <div className={s.summaryLabel}>{label}</div>
    <div className={s.summaryValue}>{value}</div>
    <div className={s.subtleSmall}>{hint || '\u00a0'}</div>
  </div>
);

const MetricTile: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className={s.metricCard}>
    <div className={s.summaryLabel}>{label}</div>
    <div className={s.metricValue}>{value}</div>
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
