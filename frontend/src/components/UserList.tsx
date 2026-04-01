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

    return () => {
      socketService.offPresenceChanged(handlePresenceChange);
      if (refreshTimerRef.current !== null) {
        window.clearTimeout(refreshTimerRef.current);
      }
    };
  }, [loadUsers]);

  const otherUsers = useMemo(
    () =>
      users
        .filter((user) => user.id !== currentUserId && user.online)
        .sort((a, b) => a.username.localeCompare(b.username)),
    [users, currentUserId],
  );

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
        <h2 className={s.title}>Users Online ({otherUsers.length})</h2>
        <div className={s.headerMeta}>{refreshing ? 'Updating…' : 'Live via socket presence'}</div>
      </div>

      {otherUsers.length === 0 ? (
        <div className={s.empty}>No other online users right now</div>
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
        <span className={s.userAvatar} aria-hidden="true">👤</span>
        <div className={s.userMeta}>
          <span className={s.username}>{user.username}</span>
          <small className={s.onlineMeta}>online now</small>
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
    a.online === b.online
  );
}

// styles moved to UserList.module.css
