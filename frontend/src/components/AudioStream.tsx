import React, { useEffect, useRef } from 'react';
import s from './AudioStream.module.css';

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
    <div className={s.container}>
      <div className={s.label}>{label}</div>
      <audio
        ref={audioRef}
        className={s.audio}
        autoPlay
        playsInline
        muted={isMuted}
      />
      <div className={s.status}>
        {stream ? '🔊 Stream Active' : '⏸️ No Stream'}
      </div>
    </div>
  );
};
