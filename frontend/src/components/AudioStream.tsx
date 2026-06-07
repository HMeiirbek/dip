import React, { useEffect, useRef, useState } from 'react';

interface AudioStreamProps {
  stream: MediaStream | null;
  isMuted?: boolean;
}

export const AudioStream: React.FC<AudioStreamProps> = ({
  stream,
  isMuted = false,
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [autoplayFailed, setAutoplayFailed] = useState(false);

  useEffect(() => {
    if (audioRef.current && stream) {
      console.log(`[AudioStream] Setting stream, tracks:`, stream.getAudioTracks().length);
      audioRef.current.srcObject = stream;
      if (!isMuted) {
        audioRef.current.volume = 1;
      }
      audioRef.current.play().then(() => {
        console.log(`[AudioStream] playing successfully`);
        setAutoplayFailed(false);
      }).catch((err) => {
        console.error(`[AudioStream] Error playing:`, err);
        if (err.name === 'NotAllowedError' || err.name === 'AbortError') {
          setAutoplayFailed(true);
        }
      });
    }
  }, [stream, isMuted]);

  return (
    <>
      <audio
        ref={audioRef}
        autoPlay
        playsInline
        muted={isMuted}
        style={{ position: 'fixed', left: '-9999px', width: '1px', height: '1px' }}
      />
      {autoplayFailed && (
        <button
          onClick={() => {
            audioRef.current?.play().then(() => setAutoplayFailed(false)).catch(console.error);
          }}
          style={{
            position: 'fixed',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
            padding: '12px 24px',
            background: '#10b981',
            color: 'white',
            border: 'none',
            borderRadius: '24px',
            fontWeight: 'bold',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            cursor: 'pointer',
            pointerEvents: 'auto'
          }}
        >
          🔊 Tap to Enable Audio
        </button>
      )}
    </>
  );
};
