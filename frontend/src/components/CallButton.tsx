import React, { useState } from 'react';
import s from './CallButton.module.css';

interface CallButtonProps {
  userId: string;
  username: string;
  onCall: (userId: string) => Promise<void>;
  isInCall: boolean;
}

export const CallButton: React.FC<CallButtonProps> = ({
  userId,
  username,
  onCall,
  isInCall,
}) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async () => {
    if (isInCall) {
      alert('You are already in a call');
      return;
    }

    setIsLoading(true);
    try {
      await onCall(userId);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={isInCall || isLoading}
      className={s.button}
      title={isInCall ? 'End current call first' : `Call ${username}`}
    >
      {isLoading ? '⏳' : '☎️'} {isLoading ? 'Calling...' : 'Call'}
    </button>
  );
};
