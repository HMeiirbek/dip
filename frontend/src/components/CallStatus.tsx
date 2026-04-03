import React from 'react';
import { CallStatus as CallStatusType, Call } from '../types';
import s from './CallStatus.module.css';

interface CallStatusProps {
  status: CallStatusType;
  activeCall: Call | null;
  incomingCall: Call | null;
  remoteUsername: string | null;
  canAccept?: boolean;
  onAccept?: () => void;
  onReject?: () => void;
  onEnd?: () => void;
}

export const CallStatus: React.FC<CallStatusProps> = ({
  status,
  activeCall,
  incomingCall,
  remoteUsername,
  canAccept = true,
  onAccept,
  onReject,
  onEnd,
}) => {
  if (status === 'idle') {
    return <div className={s.idle}>👥 Ready to make or receive calls</div>;
  }

  if (status === 'incoming' && incomingCall) {
    return (
      <div className={s.container}>
        <div className={s.incomingCard}>
          <div className={s.incomingTitle}>📞 Incoming Call</div>
          <div className={s.incomingFrom}>from {remoteUsername}</div>
          <div className={s.buttonGroup}>
            <button
              onClick={onAccept}
              className={[s.button, s.acceptButton].join(' ')}
              disabled={!canAccept}
            >
              {canAccept ? '✓ Accept' : '… Waiting'}
            </button>
            <button
              onClick={onReject}
              className={[s.button, s.rejectButton].join(' ')}
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
      <div className={s.container}>
        <div className={s.callingCard}>
          <div className={s.callingAnimation}>📞</div>
          <div className={s.callingText}>Calling {remoteUsername}...</div>
          <div className={s.spinner} />
          {onEnd && (
            <div className={s.buttonGroup} style={{ marginTop: 14 }}>
              <button onClick={onEnd} className={[s.button, s.endButton].join(' ')}>
                ✕ End Call
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (status === 'active' && activeCall) {
    return (
      <div className={s.container}>
        <div className={s.activeCard}>
          <div className={s.activeIcon}>🎤</div>
          <div className={s.activeUser}>{remoteUsername}</div>
          <div className={s.activeMeta}>
            Connected•
            {activeCall.createdAt
              ? ` ${new Date(activeCall.createdAt).toLocaleTimeString()}`
              : ''}
          </div>
          <button
            onClick={onEnd}
            className={[s.button, s.endButton].join(' ')}
          >
            ✕ End Call
          </button>
        </div>
      </div>
    );
  }

  if (status === 'ended') {
    return (
      <div className={s.container}>
        <div className={s.endedCard}>
          <div className={s.endedIcon}>✓</div>
          <div className={s.endedText}>Call Ended</div>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className={s.container}>
        <div className={s.errorCard}>
          <div className={s.errorIcon}>⚠️</div>
          <div className={s.errorText}>Call Error</div>
        </div>
      </div>
    );
  }

  return null;
};
