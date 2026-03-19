import React, { useEffect, useState } from 'react';
import { User } from '../types';
import apiService from '../services/api';
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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadUsers();
    // Refresh users every 5 seconds
    const interval = setInterval(loadUsers, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await apiService.getUsers();
      setUsers(data);
      setError(null);
    } catch (err: any) {
      setError('Failed to load users');
      console.error('Error loading users:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div style={styles.container}>Loading users...</div>;
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.error}>{error}</div>
        <button onClick={loadUsers} style={styles.retryButton}>
          Retry
        </button>
      </div>
    );
  }

  const otherUsers = users.filter((user) => user.id !== currentUserId);

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Users Online ({otherUsers.length})</h2>

      {otherUsers.length === 0 ? (
        <div style={styles.empty}>No other users available</div>
      ) : (
        <div style={styles.list}>
          {otherUsers.map((user) => (
            <div key={user.id} style={styles.userItem}>
              <div style={styles.userInfo}>
                <span style={styles.userAvatar}>👤</span>
                <span style={styles.username}>{user.username}</span>
              </div>
              <CallButton
                userId={user.id}
                username={user.username}
                onCall={onCall}
                isInCall={activeCallId !== null}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    background: 'var(--surface)',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: 'var(--shadow)',
    border: '1px solid var(--border)',
  } as React.CSSProperties,

  title: {
    color: 'var(--text)',
    marginBottom: '15px',
    fontSize: '18px',
    fontWeight: '600',
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

  userAvatar: {
    fontSize: '20px',
  } as React.CSSProperties,

  username: {
    fontWeight: '500',
    color: 'var(--text)',
  } as React.CSSProperties,
};
