import React, { useEffect, useState } from 'react';
import { Call, CallStatus as CallStatusType } from '../types';
import { UserList } from './UserList';
import { CallStatus } from './CallStatus';
import { AudioStream } from './AudioStream';

interface CallsPanelProps {
  currentUserId: string;
  onCall: (userId: string) => Promise<void>;
  activeCallId: string | null;
  callStatus: CallStatusType;
  activeCall: Call | null;
  incomingCall: Call | null;
  remoteUsername: string | null;
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
  onAccept,
  onReject,
  onEnd,
  localStream,
  remoteStream,
}) => {
  const isMobile = useMediaQuery('(max-width: 840px)');
  return (
    <div style={{ ...styles.content, gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))' }}>
      <div style={styles.leftPanel}>
        <UserList
          currentUserId={currentUserId}
          onCall={onCall}
          activeCallId={activeCallId}
        />
      </div>

      <div style={styles.rightPanel}>
        <div style={styles.statusSection}>
          <CallStatus
            status={callStatus}
            activeCall={activeCall}
            incomingCall={incomingCall}
            remoteUsername={remoteUsername}
            onAccept={onAccept}
            onReject={onReject}
            onEnd={onEnd}
          />
        </div>

        {(callStatus === 'active' || callStatus === 'calling') && (
          <div style={styles.card}>
            <div style={styles.audioGrid}>
              <AudioStream stream={localStream} isMuted={true} label="Your Audio" />
              <AudioStream stream={remoteStream} isMuted={false} label="Remote Audio" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  content: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  leftPanel: { minHeight: 360 },
  rightPanel: { display: 'flex', flexDirection: 'column', gap: 12 },
  statusSection: { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 220 },
  card: { background: 'var(--surface)', borderRadius: 12, padding: 14, boxShadow: 'var(--shadow)', border: '1px solid var(--border)' },
  audioGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
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
