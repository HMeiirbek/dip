import React, { useEffect, useMemo, useState } from 'react';
import { User } from '../types';
import s from './UserPage.module.css';

type TabKey = 'calls' | 'security' | 'risk' | 'moderator' | 'admin';

export const UserDrawer: React.FC<{
  open: boolean;
  user: User;
  onClose: () => void;
  onLogout: () => Promise<void> | void;
  onRefreshAuth: () => Promise<void> | void;
  onNavigate: (tab: TabKey) => void;
}> = ({ open, user, onClose, onLogout, onRefreshAuth, onNavigate }) => {
  const isMobile = useMediaQuery('(max-width: 840px)');

  const initials = useMemo(() => {
    const name = (user.username || '').trim();
    if (!name) return 'U';
    const parts = name.split(/[\s._-]+/).filter(Boolean);
    const first = parts[0]?.[0] || name[0];
    const second = parts.length > 1 ? parts[1]?.[0] : name[1];
    return (first + (second || '')).toUpperCase();
  }, [user.username]);

  const roleLabel = user.role || 'user';
  const verified = Boolean(user.verified);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className={s.backdrop} onMouseDown={onClose} role="dialog" aria-modal="true">
      <div
        className={[s.sheet, isMobile ? s.sheetMobile : s.sheetDesktop].join(' ')}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className={s.sheetHeader}>
          <div className={s.identityRow}>
            <div className={s.avatar} aria-hidden="true">
              {initials}
            </div>
            <div className={s.minWidth0}>
              <div className={s.nameRow}>
                <div className={s.name}>{user.username}</div>
                <span className={s.rolePill}>{roleLabel}</span>
                <span className={verified ? s.verifiedPill : s.unverifiedPill}>
                  {verified ? 'Verified' : 'Unverified'}
                </span>
              </div>
              <div className={s.meta}>
                <span>
                  ID <code className={s.code}>{user.id}</code>
                </span>
                {user.createdAt ? <span>Created {new Date(user.createdAt).toLocaleDateString()}</span> : null}
              </div>
            </div>
          </div>

          <button type="button" className={s.closeBtn} onClick={onClose} aria-label="Close profile">
            ✕
          </button>
        </div>

        <div className={s.section}>
          <div className={s.sectionTitle}>Quick actions</div>
          <div className={[s.actionGrid, isMobile ? s.actionGridMobile : ''].filter(Boolean).join(' ')}>
            <button className={s.primaryButton} onClick={onRefreshAuth}>Refresh token</button>
            <button className={s.secondaryButton} onClick={() => onNavigate('security')}>Security</button>
            <button className={s.secondaryButton} onClick={() => onNavigate('calls')}>Calls</button>
            <button className={s.secondaryButton} onClick={() => onNavigate('risk')}>Risk</button>
            {roleLabel !== 'admin' && (
              <button
                className={roleLabel === 'moderator' ? s.secondaryButton : s.secondaryButtonDisabled}
                disabled={roleLabel !== 'moderator'}
                onClick={() => onNavigate('moderator')}
                title={roleLabel === 'moderator' ? 'Open moderator tools' : 'No access'}
              >
                Moderator
              </button>
            )}
            <button
              className={roleLabel === 'admin' ? s.secondaryButton : s.secondaryButtonDisabled}
              disabled={roleLabel !== 'admin'}
              onClick={() => onNavigate('admin')}
              title={roleLabel === 'admin' ? 'Open admin tools' : 'No access'}
            >
              Admin
            </button>
            <button className={s.dangerButton} onClick={onLogout}>Logout</button>
          </div>
        </div>

        <div className={s.section}>
          <div className={s.sectionTitle}>Status & tips</div>
          <div className={[s.statusGrid, isMobile ? s.statusGridMobile : ''].filter(Boolean).join(' ')}>
            <div className={s.statusCard}>
              <div className={s.statusLabel}>Verification</div>
              <div className={s.statusValue}>{verified ? 'Verified' : 'Not verified'}</div>
              {!verified && (
                <div className={s.statusHint}>
                  Open <b>Security</b> → request verify code.
                </div>
              )}
            </div>
            <div className={s.statusCard}>
              <div className={s.statusLabel}>Role</div>
              <div className={s.statusValue}>{roleLabel}</div>
              <div className={s.statusHint}>
                Role controls access to Admin tools.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
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
// styles moved to UserPage.module.css
