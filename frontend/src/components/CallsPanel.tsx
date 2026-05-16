import React, { useEffect, useState } from 'react';
import { Call, CallStatus as CallStatusType } from '../types';
import { CallStatus } from './CallStatus';
import { AudioStream } from './AudioStream';
import { CallHistoryList } from './CallHistoryList';
import s from './CallsPanel.module.css';

interface CallsPanelProps {
  currentUserId: string;
  callStatus: CallStatusType;
  activeCall: Call | null;
  incomingCall: Call | null;
  remoteUsername: string | null;
  canAcceptIncoming: boolean;
  onAccept: () => Promise<void> | void;
  onReject: () => Promise<void> | void;
  onEnd: () => Promise<void> | void;
  remoteStreams: Map<string, MediaStream>;
  onNavigate: (tab: any) => void;
}

export const CallsPanel: React.FC<CallsPanelProps> = ({
  currentUserId,
  callStatus,
  activeCall,
  incomingCall,
  remoteUsername,
  canAcceptIncoming,
  onAccept,
  onReject,
  onEnd,
  remoteStreams,
  onNavigate,
}) => {
  const isMobile = useMediaQuery('(max-width: 840px)');
  const showHistory = isMobile ? callStatus === 'idle' : true;
  const showStatus = isMobile ? callStatus !== 'idle' : true;

  return (
    <div className={[s.content, isMobile ? s.contentMobile : ''].filter(Boolean).join(' ')}>
      {showHistory && (
        <div className={s.leftPanel}>
          <CallHistoryList
            currentUserId={currentUserId}
            onNewCall={() => onNavigate('contacts')}
          />
        </div>
      )}

      {showStatus && (
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

          {callStatus === 'active' && remoteStreams.size > 0 && (
            <div style={{ position: 'absolute', width: '1px', height: '1px', opacity: 0, pointerEvents: 'none' }}>
              {Array.from(remoteStreams.entries()).map(([peerId, stream]) => (
                <AudioStream
                  key={peerId}
                  stream={stream}
                  isMuted={false}
                />
              ))}
            </div>
          )}
        </div>
      )}
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
