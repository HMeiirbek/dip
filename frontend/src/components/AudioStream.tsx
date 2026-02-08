import React, { useEffect, useRef } from 'react';

interface AudioStreamProps {
  stream: MediaStream | null;
  isMuted?: boolean;
  label?: string;
}

export const AudioStream: React.FC<AudioStreamProps> = ({
  stream,
  isMuted = false,
  label = 'Audio',
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (audioRef.current && stream) {
      audioRef.current.srcObject = stream;
      audioRef.current.play().catch((err) => {
        console.error('Error playing audio:', err);
      });
    }
  }, [stream]);

  return (
    <div style={styles.container}>
      <div style={styles.label}>{label}</div>
      <audio
        ref={audioRef}
        style={styles.audio}
        autoPlay
        playsInline
        muted={isMuted}
      />
      <div style={styles.status}>
        {stream ? '🔊 Stream Active' : '⏸️ No Stream'}
      </div>
    </div>
  );
};

const styles = {
  container: {
    background: 'white',
    borderRadius: '8px',
    padding: '15px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
  } as React.CSSProperties,

  label: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#666',
    marginBottom: '8px',
    textTransform: 'uppercase' as const,
  } as React.CSSProperties,

  audio: {
    width: '100%',
  } as React.CSSProperties,

  status: {
    marginTop: '10px',
    fontSize: '12px',
    color: '#888',
    textAlign: 'center' as const,
  } as React.CSSProperties,
};
