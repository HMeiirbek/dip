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
      console.log(`[AudioStream] Setting stream for ${label}, tracks:`, stream.getAudioTracks().length);
      audioRef.current.srcObject = stream;
      if (!isMuted) {
        audioRef.current.volume = 1;
      }
      audioRef.current.play().then(() => {
        console.log(`[AudioStream] ${label} playing successfully`);
      }).catch((err) => {
        console.error(`[AudioStream] Error playing ${label}:`, err);
      });
    }
  }, [stream, isMuted, label]);

  return (
    <div className={s.container}>
      <div className={s.label}>{label}</div>
      <audio
        ref={audioRef}
        className={s.audio}
        autoPlay
        playsInline
        controls
        muted={isMuted}
      />
      <div className={s.status}>
        {stream ? '🔊 Stream Active' : '⏸️ No Stream'}
      </div>
    </div>
  );
};
