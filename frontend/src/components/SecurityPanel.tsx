import React, { useEffect, useState } from 'react';
import { SecurityActivityItem, SecuritySession } from '../types';

interface SecurityPanelProps {
  securitySessions: SecuritySession[];
  securityActivity: SecurityActivityItem[];
  verifyCode: string;
  setVerifyCode: React.Dispatch<React.SetStateAction<string>>;
  resetIdentifier: string;
  setResetIdentifier: React.Dispatch<React.SetStateAction<string>>;
  resetCode: string;
  setResetCode: React.Dispatch<React.SetStateAction<string>>;
  newPassword: string;
  setNewPassword: React.Dispatch<React.SetStateAction<string>>;
  onRequestVerify: () => Promise<void> | void;
  onVerify: () => Promise<void> | void;
  onRefreshSecurity: () => Promise<void> | void;
  onTerminateSession: (id: string) => Promise<void> | void;
  onRequestResetCode: () => Promise<void> | void;
  onResetPassword: () => Promise<void> | void;
}

export const SecurityPanel: React.FC<SecurityPanelProps> = ({
  securitySessions,
  securityActivity,
  verifyCode,
  setVerifyCode,
  resetIdentifier,
  setResetIdentifier,
  resetCode,
  setResetCode,
  newPassword,
  setNewPassword,
  onRequestVerify,
  onVerify,
  onRefreshSecurity,
  onTerminateSession,
  onRequestResetCode,
  onResetPassword,
}) => {
  const isMobile = useMediaQuery('(max-width: 840px)');
  const activeSessions = securitySessions.filter((session) => session.active);
  return (
    <div style={{ ...styles.grid2, gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))' }}>
      <div style={styles.card}>
        <h3 style={styles.cardTitle}>Verification & Sessions</h3>
        <div style={styles.row}>
          <button style={styles.primaryButton} onClick={onRequestVerify}>Request Verify Code</button>
          <button style={styles.secondaryButton} onClick={onRefreshSecurity}>Refresh</button>
        </div>
        <div style={styles.row}>
          <input
            style={styles.input}
            placeholder="Verify code"
            value={verifyCode}
            onChange={(e) => setVerifyCode(e.target.value)}
          />
          <button style={styles.primaryButton} onClick={onVerify}>Verify</button>
        </div>

        <h4>Active Sessions ({activeSessions.length})</h4>
        <div style={styles.listBox}>
          {activeSessions.map((s) => (
            <div key={s.id} style={styles.listItem}>
              <div>
                <div>{s.deviceInfo} | {s.ipAddress}</div>
                <small>{new Date(s.createdAt).toLocaleString()}</small>
              </div>
              <button style={styles.smallDanger} onClick={() => onTerminateSession(s.id)}>Terminate</button>
            </div>
          ))}
          {!activeSessions.length && <div style={styles.emptyState}>No active sessions</div>}
        </div>
      </div>

      <div style={styles.card}>
        <h3 style={styles.cardTitle}>Forgot / Reset Password</h3>
        <div style={styles.stack}>
          <input
            style={styles.input}
            placeholder="Username"
            value={resetIdentifier}
            onChange={(e) => setResetIdentifier(e.target.value)}
          />
          <button style={styles.secondaryButton} onClick={onRequestResetCode}>Request Reset Code</button>
          <input
            style={styles.input}
            placeholder="Reset code"
            value={resetCode}
            onChange={(e) => setResetCode(e.target.value)}
          />
          <input
            style={styles.input}
            placeholder="New password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <button style={styles.primaryButton} onClick={onResetPassword}>Reset Password</button>
        </div>

        <h4 style={{ marginTop: 16 }}>Security Activity ({securityActivity.length})</h4>
        <div style={styles.listBox}>
          {securityActivity.map((a, idx) => (
            <div key={`${a.action}-${idx}`} style={styles.listItemColumn}>
              <strong>{a.action}</strong>
              <small>{new Date(a.at).toLocaleString()} | {a.ipAddress || 'n/a'}</small>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  grid2: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 },
  card: { background: 'var(--surface)', borderRadius: 12, padding: 14, boxShadow: 'var(--shadow)', border: '1px solid var(--border)' },
  cardTitle: { marginTop: 0, marginBottom: 10 },
  row: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 },
  stack: { display: 'flex', flexDirection: 'column', gap: 8 },
  input: { padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, minWidth: 180, background: 'var(--surface)', color: 'var(--text)' },
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
  emptyState: { color: 'var(--muted)', fontSize: 13, padding: '8px 4px' },
  primaryButton: { padding: '8px 12px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: '#fff', cursor: 'pointer', fontWeight: 800 },
  secondaryButton: { padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer', fontWeight: 800 },
  smallDanger: { padding: '4px 8px', borderRadius: 6, border: 'none', background: 'var(--danger)', color: '#fff', cursor: 'pointer', fontWeight: 800, fontSize: 12 },
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
