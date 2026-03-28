import React, { useEffect, useMemo, useState } from 'react';
import { User } from '../types';

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
    <div style={styles.backdrop} onMouseDown={onClose} role="dialog" aria-modal="true">
      <div
        style={{
          ...styles.sheet,
          ...(isMobile ? styles.sheetMobile : styles.sheetDesktop),
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div style={styles.sheetHeader}>
          <div style={styles.identityRow}>
            <div style={styles.avatar} aria-hidden="true">
              {initials}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={styles.nameRow}>
                <div style={styles.name}>{user.username}</div>
                <span style={styles.rolePill}>{roleLabel}</span>
                <span style={verified ? styles.verifiedPill : styles.unverifiedPill}>
                  {verified ? 'Verified' : 'Unverified'}
                </span>
              </div>
              <div style={styles.meta}>
                <span>
                  ID <code style={styles.code}>{user.id}</code>
                </span>
                {user.createdAt ? <span>Created {new Date(user.createdAt).toLocaleDateString()}</span> : null}
              </div>
            </div>
          </div>

          <button type="button" style={styles.closeBtn} onClick={onClose} aria-label="Close profile">
            ✕
          </button>
        </div>

        <div style={styles.section}>
          <div style={styles.sectionTitle}>Quick actions</div>
          <div style={styles.actionGrid(isMobile)}>
            <button style={styles.primaryButton} onClick={onRefreshAuth}>Refresh token</button>
            <button style={styles.secondaryButton} onClick={() => onNavigate('security')}>Security</button>
            <button style={styles.secondaryButton} onClick={() => onNavigate('calls')}>Calls</button>
            <button style={styles.secondaryButton} onClick={() => onNavigate('risk')}>Risk</button>
            <button
              style={(roleLabel === 'admin' || roleLabel === 'moderator') ? styles.secondaryButton : styles.secondaryButtonDisabled}
              disabled={roleLabel !== 'admin' && roleLabel !== 'moderator'}
              onClick={() => onNavigate('moderator')}
              title={roleLabel === 'admin' || roleLabel === 'moderator' ? 'Open moderator tools' : 'No access'}
            >
              Moderator
            </button>
            <button
              style={roleLabel === 'admin' ? styles.secondaryButton : styles.secondaryButtonDisabled}
              disabled={roleLabel !== 'admin'}
              onClick={() => onNavigate('admin')}
              title={roleLabel === 'admin' ? 'Open admin tools' : 'No access'}
            >
              Admin
            </button>
            <button style={styles.dangerButton} onClick={onLogout}>Logout</button>
          </div>
        </div>

        <div style={styles.section}>
          <div style={styles.sectionTitle}>Status & tips</div>
          <div style={styles.statusGrid(isMobile)}>
            <div style={styles.statusCard}>
              <div style={styles.statusLabel}>Verification</div>
              <div style={styles.statusValue}>{verified ? 'Verified' : 'Not verified'}</div>
              {!verified && (
                <div style={styles.statusHint}>
                  Open <b>Security</b> → request verify code.
                </div>
              )}
            </div>
            <div style={styles.statusCard}>
              <div style={styles.statusLabel}>Role</div>
              <div style={styles.statusValue}>{roleLabel}</div>
              <div style={styles.statusHint}>
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

const styles: Record<string, any> = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.55)',
    display: 'flex',
    justifyContent: 'flex-end',
    zIndex: 2000,
  } as React.CSSProperties,
  sheet: {
    background: 'var(--panel-bg)',
    borderLeft: '1px solid var(--border)',
    boxShadow: 'var(--shadow-strong)',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    padding: 14,
    color: 'var(--text)',
  } as React.CSSProperties,
  sheetDesktop: { width: 'min(460px, 92vw)' } as React.CSSProperties,
  sheetMobile: {
    width: '100%',
    height: 'min(92vh, 720px)',
    alignSelf: 'flex-end',
    borderLeft: 'none',
    borderTop: '1px solid var(--border)',
    borderRadius: '16px 16px 0 0',
  } as React.CSSProperties,

  sheetHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 } as React.CSSProperties,
  identityRow: { display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 } as React.CSSProperties,
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 14,
    background: 'linear-gradient(135deg, var(--primary) 0%, var(--success) 100%)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 900,
    letterSpacing: 0.5,
    boxShadow: '0 12px 24px rgba(12,108,255,0.25)',
    flex: '0 0 auto',
  } as React.CSSProperties,
  nameRow: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' } as React.CSSProperties,
  name: { fontSize: 18, fontWeight: 900, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } as React.CSSProperties,
  meta: { display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 12, color: 'var(--muted)', marginTop: 6 } as React.CSSProperties,
  code: {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    fontSize: 12,
    background: 'rgba(13,17,23,0.12)',
    padding: '1px 6px',
    borderRadius: 8,
    color: 'var(--text)',
  } as React.CSSProperties,
  closeBtn: {
    border: '1px solid var(--border)',
    background: 'var(--panel-bg2)',
    color: 'var(--text)',
    borderRadius: 12,
    padding: '8px 10px',
    cursor: 'pointer',
    fontWeight: 900,
    lineHeight: 1,
  } as React.CSSProperties,
  rolePill: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 8px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
    background: 'rgba(12,108,255,0.12)',
    border: '1px solid rgba(12,108,255,0.30)',
    color: 'var(--text)',
  } as React.CSSProperties,
  verifiedPill: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 8px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
    background: 'rgba(34,197,94,0.14)',
    border: '1px solid rgba(34,197,94,0.34)',
    color: 'var(--text)',
  } as React.CSSProperties,
  unverifiedPill: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 8px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
    background: 'rgba(245,158,11,0.16)',
    border: '1px solid rgba(245,158,11,0.36)',
    color: 'var(--text)',
  } as React.CSSProperties,

  section: {
    border: '1px solid var(--border)',
    borderRadius: 14,
    padding: 12,
    background: 'var(--panel-bg2)',
  } as React.CSSProperties,
  sectionTitle: { fontSize: 12, color: 'var(--muted)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 } as React.CSSProperties,

  actionGrid: (isMobile: boolean) =>
    ({
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(2, minmax(0, 1fr))',
      gap: 10,
    }) as React.CSSProperties,

  statusGrid: (isMobile: boolean) =>
    ({
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))',
      gap: 10,
    }) as React.CSSProperties,
  statusCard: {
    background: 'var(--panel-bg)',
    border: '1px solid var(--border)',
    borderRadius: 14,
    padding: 12,
  } as React.CSSProperties,
  statusLabel: { fontSize: 12, color: 'var(--muted)', fontWeight: 900 } as React.CSSProperties,
  statusValue: { fontSize: 16, fontWeight: 950, color: 'var(--text)', marginTop: 6 } as React.CSSProperties,
  statusHint: { marginTop: 8, fontSize: 13, color: 'var(--muted)', lineHeight: 1.35 } as React.CSSProperties,

  primaryButton: {
    padding: '10px 12px',
    borderRadius: 10,
    border: 'none',
    background: 'var(--primary)',
    color: '#fff',
    cursor: 'pointer',
    fontWeight: 800,
  } as React.CSSProperties,
  secondaryButton: {
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid var(--border)',
    background: 'var(--panel-bg)',
    color: 'var(--text)',
    cursor: 'pointer',
    fontWeight: 800,
  } as React.CSSProperties,
  secondaryButtonDisabled: {
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid var(--border)',
    background: 'var(--panel-bg)',
    color: 'var(--muted)',
    cursor: 'not-allowed',
    fontWeight: 800,
  } as React.CSSProperties,
  dangerButton: {
    padding: '10px 12px',
    borderRadius: 10,
    border: 'none',
    background: 'var(--danger)',
    color: '#fff',
    cursor: 'pointer',
    fontWeight: 900,
  } as React.CSSProperties,
};
