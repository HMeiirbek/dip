import React from 'react';
import { CallStatus as CallStatusType, Call } from '../types';

interface CallStatusProps {
  status: CallStatusType;
  activeCall: Call | null;
  incomingCall: Call | null;
  remoteUsername: string | null;
  onAccept?: () => void;
  onReject?: () => void;
  onEnd?: () => void;
}

export const CallStatus: React.FC<CallStatusProps> = ({
  status,
  activeCall,
  incomingCall,
  remoteUsername,
  onAccept,
  onReject,
  onEnd,
}) => {
  if (status === 'idle') {
    return <div style={styles.idle}>👥 Ready to make or receive calls</div>;
  }

  if (status === 'incoming' && incomingCall) {
    return (
      <div style={styles.container}>
        <div style={styles.incomingCard}>
          <div style={styles.incomingTitle}>📞 Incoming Call</div>
          <div style={styles.incomingFrom}>from {remoteUsername}</div>
          <div style={styles.buttonGroup}>
            <button
              onClick={onAccept}
              style={{ ...styles.button, ...styles.acceptButton }}
            >
              ✓ Accept
            </button>
            <button
              onClick={onReject}
              style={{ ...styles.button, ...styles.rejectButton }}
            >
              ✕ Reject
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'calling') {
    return (
      <div style={styles.container}>
        <div style={styles.callingCard}>
          <div style={styles.callingAnimation}>📞</div>
          <div style={styles.callingText}>Calling {remoteUsername}...</div>
          <div style={styles.spinner} />
        </div>
      </div>
    );
  }

  if (status === 'active' && activeCall) {
    return (
      <div style={styles.container}>
        <div style={styles.activeCard}>
          <div style={styles.activeIcon}>🎤</div>
          <div style={styles.activeUser}>{remoteUsername}</div>
          <div style={styles.activeMeta}>
            Connected•
            {activeCall.createdAt
              ? ` ${new Date(activeCall.createdAt).toLocaleTimeString()}`
              : ''}
          </div>
          <button
            onClick={onEnd}
            style={{ ...styles.button, ...styles.endButton }}
          >
            ✕ End Call
          </button>
        </div>
      </div>
    );
  }

  if (status === 'ended') {
    return (
      <div style={styles.container}>
        <div style={styles.endedCard}>
          <div style={styles.endedIcon}>✓</div>
          <div style={styles.endedText}>Call Ended</div>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div style={styles.container}>
        <div style={styles.errorCard}>
          <div style={styles.errorIcon}>⚠️</div>
          <div style={styles.errorText}>Call Error</div>
        </div>
      </div>
    );
  }

  return null;
};

const styles = {
  idle: {
    textAlign: 'center' as const,
    padding: '30px',
    color: '#666',
    background: 'white',
    borderRadius: '12px',
    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
    fontStyle: 'italic',
  } as React.CSSProperties,

  container: {
    display: 'flex',
    justifyContent: 'center',
  } as React.CSSProperties,

  incomingCard: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    padding: '30px',
    borderRadius: '12px',
    textAlign: 'center' as const,
    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.2)',
    minWidth: '280px',
    animation: 'pulse 1.5s infinite',
  } as React.CSSProperties,

  incomingTitle: {
    fontSize: '20px',
    fontWeight: '600',
    marginBottom: '10px',
  } as React.CSSProperties,

  incomingFrom: {
    fontSize: '16px',
    marginBottom: '20px',
    opacity: 0.9,
  } as React.CSSProperties,

  callingCard: {
    background: 'white',
    padding: '40px 30px',
    borderRadius: '12px',
    textAlign: 'center' as const,
    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.2)',
    minWidth: '280px',
  } as React.CSSProperties,

  callingAnimation: {
    fontSize: '40px',
    marginBottom: '15px',
  } as React.CSSProperties,

  callingText: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#333',
    marginBottom: '20px',
  } as React.CSSProperties,

  spinner: {
    width: '30px',
    height: '30px',
    border: '3px solid #f3f3f3',
    borderTop: '3px solid #667eea',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    margin: '0 auto',
  } as React.CSSProperties,

  activeCard: {
    background: 'white',
    padding: '40px 30px',
    borderRadius: '12px',
    textAlign: 'center' as const,
    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.2)',
    minWidth: '280px',
    borderTop: '4px solid #27ae60',
  } as React.CSSProperties,

  activeIcon: {
    fontSize: '40px',
    marginBottom: '15px',
  } as React.CSSProperties,

  activeUser: {
    fontSize: '20px',
    fontWeight: '600',
    color: '#333',
    marginBottom: '5px',
  } as React.CSSProperties,

  activeMeta: {
    fontSize: '12px',
    color: '#888',
    marginBottom: '20px',
  } as React.CSSProperties,

  endedCard: {
    background: 'white',
    padding: '40px 30px',
    borderRadius: '12px',
    textAlign: 'center' as const,
    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.2)',
    minWidth: '280px',
  } as React.CSSProperties,

  endedIcon: {
    fontSize: '40px',
    marginBottom: '15px',
    color: '#27ae60',
  } as React.CSSProperties,

  endedText: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#333',
  } as React.CSSProperties,

  errorCard: {
    background: 'white',
    padding: '40px 30px',
    borderRadius: '12px',
    textAlign: 'center' as const,
    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.2)',
    minWidth: '280px',
    borderTop: '4px solid #e74c3c',
  } as React.CSSProperties,

  errorIcon: {
    fontSize: '40px',
    marginBottom: '15px',
  } as React.CSSProperties,

  errorText: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#e74c3c',
  } as React.CSSProperties,

  button: {
    padding: '10px 20px',
    fontSize: '14px',
    fontWeight: '600',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'transform 0.2s, opacity 0.2s',
  } as React.CSSProperties,

  acceptButton: {
    background: '#27ae60',
    color: 'white',
    marginRight: '10px',
  } as React.CSSProperties,

  rejectButton: {
    background: '#e74c3c',
    color: 'white',
  } as React.CSSProperties,

  endButton: {
    background: '#e74c3c',
    color: 'white',
    width: '100%',
  } as React.CSSProperties,

  buttonGroup: {
    display: 'flex',
    justifyContent: 'center',
    gap: '10px',
  } as React.CSSProperties,
};
