import React, { useEffect, useState } from 'react';
import { Call, CallStatus as CallStatusType } from '../types';
import { UserList } from './UserList';
import { CallStatus } from './CallStatus';
import { AudioStream } from './AudioStream';
import s from './CallsPanel.module.css';

interface CallsPanelProps {
  currentUserId: string;
  onCall: (userId: string) => Promise<void>;
  activeCallId: string | null;
  callStatus: CallStatusType;
  activeCall: Call | null;
  incomingCall: Call | null;
  remoteUsername: string | null;
  canAcceptIncoming: boolean;
  onAccept: () => Promise<void> | void;
  onReject: () => Promise<void> | void;
  onEnd: () => Promise<void> | void;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
}

export const CallsPanel: React.FC<CallsPanelProps> = ({
  currentUserId,
  onCall,
  activeCallId,
  callStatus,
  activeCall,
  incomingCall,
  remoteUsername,
  canAcceptIncoming,
  onAccept,
  onReject,
  onEnd,
  localStream,
  remoteStream,
}) => {
  const isMobile = useMediaQuery('(max-width: 840px)');
  return (
    <div className={[s.content, isMobile ? s.contentMobile : ''].filter(Boolean).join(' ')}>
      <div className={s.leftPanel}>
        <UserList
          currentUserId={currentUserId}
          onCall={onCall}
          activeCallId={activeCallId}
        />
      </div>

      <div className={s.rightPanel}>
        <div className={s.statusSection}>
          <CallStatus
            status={callStatus}
            activeCall={activeCall}
            incomingCall={incomingCall}
            remoteUsername={remoteUsername}
            canAccept={canAcceptIncoming}
            onAccept={onAccept}
            onReject={onReject}
            onEnd={onEnd}
          />
        </div>

        {(callStatus === 'active' || callStatus === 'calling') && (
          <div className={s.card}>
            <div className={s.audioGrid}>
              <AudioStream stream={localStream} isMuted={true} label="Your Audio" />
              <AudioStream stream={remoteStream} isMuted={false} label="Remote Audio" />
            </div>
          </div>
        )}
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
