import React, { useEffect, useRef, useState } from 'react';
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
  const [playbackBlocked, setPlaybackBlocked] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      console.log('[AudioStream] No audio element ref');
      return;
    }

    audio.muted = isMuted;

    if (!stream) {
      console.log('[AudioStream]', label, '- no stream');
      audio.srcObject = null;
      return;
    }

    console.log('[AudioStream]', label, '- setting stream with', stream.getTracks().length, 'tracks');
    audio.srcObject = stream;
    const tryPlay = () => {
      console.log('[AudioStream]', label, '- attempting to play');
      audio.play()
        .then(() => {
          console.log('[AudioStream]', label, '- playback started');
          setPlaybackBlocked(false);
        })
        .catch((err) => {
          console.error('[AudioStream]', label, '- play error:', err);
          if (!isMuted) {
            setPlaybackBlocked(true);
          }
        });
    };

    tryPlay();
    audio.addEventListener('loadedmetadata', tryPlay);

    return () => {
      audio.removeEventListener('loadedmetadata', tryPlay);
    };
  }, [stream, isMuted, label]);

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
      {!isMuted && stream && playbackBlocked && (
        <button
          type="button"
          className={s.unlockButton}
          onClick={() => {
            const audio = audioRef.current;
            if (!audio) {
              return;
            }

            audio.play()
              .then(() => {
                setPlaybackBlocked(false);
              })
              .catch((err) => {
                console.error('Manual audio play failed:', err);
              });
          }}
        >
          Enable Audio
        </button>
      )}
      <div className={s.status}>
        {hasLiveAudio ? '🔊 Stream Active' : '⏸️ No Stream'}
      </div>
    </div>
  );
};
