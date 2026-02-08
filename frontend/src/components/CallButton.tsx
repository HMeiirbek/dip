import React, { useState } from 'react';

interface CallButtonProps {
  userId: string;
  username: string;
  onCall: (userId: string) => void;
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
      onCall(userId);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={isInCall || isLoading}
      style={{
        ...styles.button,
        opacity: isInCall || isLoading ? 0.5 : 1,
        cursor: isInCall || isLoading ? 'not-allowed' : 'pointer',
      }}
      title={isInCall ? 'End current call first' : `Call ${username}`}
    >
      {isLoading ? '⏳' : '☎️'} {isLoading ? 'Calling...' : 'Call'}
    </button>
  );
};

const styles = {
  button: {
    padding: '8px 16px',
    fontSize: '14px',
    fontWeight: '600',
    color: 'white',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    border: 'none',
    borderRadius: '6px',
    transition: 'transform 0.2s',
    whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,
};
