import React, { useEffect, useState } from 'react';
import { SecurityActivityItem, SecuritySession } from '../types';
import s from './SecurityPanel.module.css';

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
    <div className={[s.grid, isMobile ? s.gridMobile : ''].filter(Boolean).join(' ')}>
      <div className={s.card}>
        <h3 className={s.cardTitle}>Verification & Sessions</h3>
        <div className={s.row}>
          <button className={s.primaryButton} onClick={onRequestVerify}>Request Verify Code</button>
          <button className={s.secondaryButton} onClick={onRefreshSecurity}>Refresh</button>
        </div>
        <div className={s.row}>
          <input
            className={s.input}
            placeholder="Verify code"
            value={verifyCode}
            onChange={(e) => setVerifyCode(e.target.value)}
          />
          <button className={s.primaryButton} onClick={onVerify}>Verify</button>
        </div>

        <h4>Active Sessions ({activeSessions.length})</h4>
        <div className={s.listBox}>
          {activeSessions.map((session) => (
            <div key={session.id} className={s.listItem}>
              <div>
                <div>{session.deviceInfo} | {session.ipAddress}</div>
                <small>{new Date(session.createdAt).toLocaleString()}</small>
              </div>
              <button className={s.smallDanger} onClick={() => onTerminateSession(session.id)}>Terminate</button>
            </div>
          ))}
          {!activeSessions.length && <div className={s.emptyState}>No active sessions</div>}
        </div>
      </div>

      <div className={s.card}>
        <h3 className={s.cardTitle}>Forgot / Reset Password</h3>
        <div className={s.stack}>
          <input
            className={s.input}
            placeholder="Username"
            value={resetIdentifier}
            onChange={(e) => setResetIdentifier(e.target.value)}
          />
          <button className={s.secondaryButton} onClick={onRequestResetCode}>Request Reset Code</button>
          <input
            className={s.input}
            placeholder="Reset code"
            value={resetCode}
            onChange={(e) => setResetCode(e.target.value)}
          />
          <input
            className={s.input}
            placeholder="New password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <button className={s.primaryButton} onClick={onResetPassword}>Reset Password</button>
        </div>

        <h4 className={s.activityTitle}>Security Activity ({securityActivity.length})</h4>
        <div className={s.listBox}>
          {securityActivity.map((a, idx) => (
            <div key={`${a.action}-${idx}`} className={s.listItemColumn}>
              <strong>{a.action}</strong>
              <small>{new Date(a.at).toLocaleString()} | {a.ipAddress || 'n/a'}</small>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// styles moved to SecurityPanel.module.css

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
