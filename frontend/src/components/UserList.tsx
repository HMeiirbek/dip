import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { User } from '../types';
import apiService from '../services/api';
import socketService from '../services/socket';
import { CallButton } from './CallButton';
import s from './UserList.module.css';

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

  const { otherUsers, onlineCount } = useMemo(() => {
    const others = users
      .filter((user) => user.id !== currentUserId)
      .sort((a, b) => a.username.localeCompare(b.username));
    const online = others.filter((user) => isUserOnline(user)).length;
    return { otherUsers: others, onlineCount: online };
  }, [users, currentUserId]);

  if (loading) {
    return <div className={s.container}>Loading users...</div>;
  }

  if (error) {
    return (
      <div className={s.container}>
        <div className={s.headerRow}>
          <h2 className={s.title}>Users Online</h2>
        </div>
        <div className={s.error}>{error}</div>
        <button onClick={() => loadUsers()} className={s.retryButton}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className={s.container}>
      <div className={s.headerRow}>
        <h2 className={s.title}>
          Users ({onlineCount} online / {otherUsers.length})
        </h2>
        <div className={s.headerMeta}>{refreshing ? 'Updating…' : 'Live via socket presence'}</div>
      </div>

      {otherUsers.length === 0 ? (
        <div className={s.empty}>No other users yet</div>
      ) : (
        <div className={s.list}>
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
    <div className={s.userItem}>
      <div className={s.userInfo}>
        <div className={s.userAvatar} aria-hidden="true">
          {(user.username?.[0] || 'U').toUpperCase()}
        </div>
        <div className={s.userMeta}>
          <span className={s.username}>{user.username}</span>
          <small className={s.onlineMeta} style={{ color: isUserOnline(user) ? 'var(--primary)' : 'var(--muted)' }}>
            {isUserOnline(user) ? 'в сети' : 'был(а) недавно'}
          </small>
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

function isUserOnline(user: User) {
  const normalized = user as unknown as {
    online?: unknown;
    isOnline?: unknown;
    status?: unknown;
  };
  if (typeof normalized.online === 'boolean') return normalized.online;
  if (typeof normalized.online === 'string') return normalized.online.toLowerCase() === 'true';
  if (typeof normalized.online === 'number') return normalized.online > 0;
  if (typeof normalized.isOnline === 'boolean') return normalized.isOnline;
  if (typeof normalized.isOnline === 'string') return normalized.isOnline.toLowerCase() === 'true';
  if (typeof normalized.isOnline === 'number') return normalized.isOnline > 0;
  if (typeof normalized.status === 'string') return normalized.status.toLowerCase() === 'online';
  return false;
}

// styles moved to UserList.module.css
