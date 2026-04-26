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
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    audio.muted = isMuted;

    if (!stream) {
      audio.srcObject = null;
      return;
    }

    audio.srcObject = stream;

    const tryPlay = () => {
      audio.play().catch((err) => {
        console.error('Error playing audio:', err);
      });
    };

    tryPlay();
    audio.addEventListener('loadedmetadata', tryPlay);

    return () => {
      audio.removeEventListener('loadedmetadata', tryPlay);
    };
  }, [stream, isMuted]);

  const hasLiveAudio = Boolean(stream?.getAudioTracks().some((track) => track.readyState === 'live'));

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
        {hasLiveAudio ? '🔊 Stream Active' : '⏸️ No Stream'}
      </div>
    </div>
  );
};
