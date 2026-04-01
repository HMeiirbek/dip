import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { User } from '../types';
import apiService from '../services/api';
import socketService from '../services/socket';
import { CallButton } from './CallButton';

interface UserListProps {
  currentUserId: string;
  onCall: (userId: string) => Promise<void>;
  activeCallId: string | null;
}

export const UserList: React.FC<UserListProps> = ({
  currentUserId,
  onCall,
  activeCallId,
}) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refreshTimerRef = useRef<number | null>(null);
  const pollTimerRef = useRef<number | null>(null);

  const loadUsers = useCallback(async (options?: { silent?: boolean }) => {
    const silent = Boolean(options?.silent);
    try {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const data = await apiService.getUsers();
      setUsers((prev) => reconcileUsers(prev, data));
      setError(null);
    } catch (err) {
      setError('Failed to load users');
      console.error('Error loading users:', err);
    } finally {
      if (silent) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    loadUsers();

    const handlePresenceChange = () => {
      if (refreshTimerRef.current !== null) {
        window.clearTimeout(refreshTimerRef.current);
      }
      refreshTimerRef.current = window.setTimeout(() => {
        loadUsers({ silent: true });
      }, 180);
    };

    socketService.onPresenceChanged(handlePresenceChange);

    pollTimerRef.current = window.setInterval(() => {
      loadUsers({ silent: true });
    }, 10000);

    return () => {
      socketService.offPresenceChanged(handlePresenceChange);
      if (refreshTimerRef.current !== null) {
        window.clearTimeout(refreshTimerRef.current);
      }
      if (pollTimerRef.current !== null) {
        window.clearInterval(pollTimerRef.current);
      }
    };
  }, [loadUsers]);

  const otherUsers = useMemo(
    () =>
      users
        .filter((user) => user.id !== currentUserId && isUserOnline(user))
        .sort((a, b) => a.username.localeCompare(b.username)),
    [users, currentUserId],
  );

  if (loading) {
    return <div style={styles.container}>Loading users...</div>;
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.headerRow}>
          <h2 style={styles.title}>Users Online</h2>
        </div>
        <div style={styles.error}>{error}</div>
        <button onClick={() => loadUsers()} style={styles.retryButton}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.headerRow}>
        <h2 style={styles.title}>Users Online ({otherUsers.length})</h2>
        <div style={styles.headerMeta}>{refreshing ? 'Updating…' : 'Live via socket presence'}</div>
      </div>

      {otherUsers.length === 0 ? (
        <div style={styles.empty}>No other online users right now</div>
      ) : (
        <div style={styles.list}>
          {otherUsers.map((user) => (
            <UserRow
              key={user.id}
              user={user}
              onCall={onCall}
              activeCallId={activeCallId}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const UserRow = React.memo(
  ({
    user,
    onCall,
    activeCallId,
  }: {
    user: User;
    onCall: (userId: string) => Promise<void>;
    activeCallId: string | null;
  }) => (
    <div style={styles.userItem}>
      <div style={styles.userInfo}>
        <span style={styles.userAvatar}>👤</span>
        <div style={styles.userMeta}>
          <span style={styles.username}>{user.username}</span>
          <small style={styles.onlineMeta}>online now</small>
        </div>
      </div>
      <CallButton
        userId={user.id}
        username={user.username}
        onCall={onCall}
        isInCall={activeCallId !== null}
      />
    </div>
  ),
);

function reconcileUsers(prev: User[], next: User[]) {
  const prevById = new Map(prev.map((user) => [user.id, user]));
  let changed = prev.length !== next.length;

  const reconciled = next.map((user) => {
    const previous = prevById.get(user.id);
    if (previous && isSameUser(previous, user)) {
      return previous;
    }
    changed = true;
    return user;
  });

  if (!changed) {
    for (let i = 0; i < reconciled.length; i += 1) {
      if (reconciled[i].id !== prev[i]?.id) {
        changed = true;
        break;
      }
    }
  }

  return changed ? reconciled : prev;
}

function isSameUser(a: User, b: User) {
  return (
    a.id === b.id &&
    a.username === b.username &&
    a.role === b.role &&
    a.createdAt === b.createdAt &&
    a.verified === b.verified &&
    isUserOnline(a) === isUserOnline(b)
  );
}

function isUserOnline(user: User & Record<string, unknown>) {
  const normalized = user as User & {
    isOnline?: boolean | string | number;
    status?: string;
  };
  if (typeof normalized.online === 'boolean') return normalized.online;
  if (typeof normalized.online === 'string') return normalized.online.toLowerCase() === 'true';
  if (typeof normalized.isOnline === 'boolean') return normalized.isOnline;
  if (typeof normalized.isOnline === 'string') return normalized.isOnline.toLowerCase() === 'true';
  if (typeof normalized.isOnline === 'number') return normalized.isOnline > 0;
  if (typeof normalized.status === 'string') return normalized.status.toLowerCase() === 'online';
  return false;
}

const styles = {
  container: {
    background: 'var(--surface)',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: 'var(--shadow)',
    border: '1px solid var(--border)',
  } as React.CSSProperties,

  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '15px',
    flexWrap: 'wrap' as const,
  } as React.CSSProperties,

  title: {
    color: 'var(--text)',
    fontSize: '18px',
    fontWeight: '600',
    margin: 0,
  } as React.CSSProperties,

  headerMeta: {
    color: 'var(--muted)',
    fontSize: '12px',
  } as React.CSSProperties,

  error: {
    color: 'var(--text)',
    padding: '10px',
    background: 'rgba(214, 34, 59, 0.12)',
    border: '1px solid rgba(214, 34, 59, 0.35)',
    borderRadius: '6px',
    marginBottom: '10px',
  } as React.CSSProperties,

  retryButton: {
    padding: '8px 16px',
    background: 'var(--primary)',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 800,
  } as React.CSSProperties,

  empty: {
    textAlign: 'center' as const,
    color: 'var(--muted)',
    padding: '20px',
    fontSize: '14px',
  } as React.CSSProperties,

  list: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '10px',
  } as React.CSSProperties,

  userItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px',
    background: 'var(--surface2)',
    borderRadius: '8px',
    border: '1px solid var(--border)',
  } as React.CSSProperties,

  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  } as React.CSSProperties,

  userMeta: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '2px',
  } as React.CSSProperties,

  onlineMeta: {
    color: 'var(--muted)',
    fontSize: '12px',
  } as React.CSSProperties,

  userAvatar: {
    fontSize: '20px',
  } as React.CSSProperties,

  username: {
    fontWeight: '500',
    color: 'var(--text)',
  } as React.CSSProperties,
};
