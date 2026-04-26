import React, { useEffect, useRef, useState } from 'react';
import s from './AudioStream.module.css';

interface AudioStreamProps {
  stream: MediaStream | null;
  isMuted?: boolean;
  label?: string;
  playbackContext?: AudioContext | null;
  playbackUnlockKey?: number;
}

export const AudioStream: React.FC<AudioStreamProps> = ({
  stream,
  isMuted = false,
  label = 'Audio',
  playbackContext = null,
  playbackUnlockKey = 0,
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [, setStreamVersion] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    audio.muted = isMuted;
    audio.volume = 1;

    if (!stream) {
      audio.srcObject = null;
      return;
    }

    audio.srcObject = stream;

    let unlockAttached = false;
    let unlocked = false;
    const cleanupFns: Array<() => void> = [];
    let sourceNode: MediaStreamAudioSourceNode | null = null;
    let gainNode: GainNode | null = null;
    const detachUnlockListeners = () => {
      if (!unlockAttached) {
        return;
      }
      unlockAttached = false;
      document.removeEventListener('pointerdown', retryPlayback, true);
      document.removeEventListener('keydown', retryPlayback, true);
      document.removeEventListener('touchstart', retryPlayback, true);
    };
    const connectWebAudioFallback = async () => {
      if (isMuted || !playbackContext || sourceNode || !stream.getAudioTracks().length) {
        return;
      }

      try {
        if (playbackContext.state === 'suspended') {
          await playbackContext.resume();
        }
        sourceNode = playbackContext.createMediaStreamSource(stream);
        gainNode = playbackContext.createGain();
        gainNode.gain.value = 1;
        sourceNode.connect(gainNode);
        gainNode.connect(playbackContext.destination);
      } catch (err) {
        console.error('Error connecting WebAudio fallback:', err);
      }
    };
    const tryPlay = () => {
      audio.play()
        .then(() => {
          unlocked = true;
          detachUnlockListeners();
        })
        .catch((err) => {
          console.error('Error playing audio:', err);
          void connectWebAudioFallback();
          if (!unlockAttached) {
            unlockAttached = true;
            document.addEventListener('pointerdown', retryPlayback, true);
            document.addEventListener('keydown', retryPlayback, true);
            document.addEventListener('touchstart', retryPlayback, true);
          }
        });
    };
    const retryPlayback = () => {
      if (unlocked) {
        detachUnlockListeners();
        return;
      }
      tryPlay();
    };
    const refresh = () => {
      setStreamVersion((value) => value + 1);
      tryPlay();
    };
    const bindTrack = (track: MediaStreamTrack) => {
      track.addEventListener('unmute', refresh);
      track.addEventListener('mute', refresh);
      track.addEventListener('ended', refresh);
      cleanupFns.push(() => {
        track.removeEventListener('unmute', refresh);
        track.removeEventListener('mute', refresh);
        track.removeEventListener('ended', refresh);
      });
    };
    const handleAddTrack = (event: MediaStreamTrackEvent) => {
      bindTrack(event.track);
      refresh();
    };
    const handleRemoveTrack = () => {
      refresh();
    };

    tryPlay();
    audio.addEventListener('loadedmetadata', tryPlay);
    stream.getAudioTracks().forEach(bindTrack);
    stream.addEventListener('addtrack', handleAddTrack);
    stream.addEventListener('removetrack', handleRemoveTrack);

    return () => {
      detachUnlockListeners();
      audio.removeEventListener('loadedmetadata', tryPlay);
      stream.removeEventListener('addtrack', handleAddTrack);
      stream.removeEventListener('removetrack', handleRemoveTrack);
      cleanupFns.forEach((cleanup) => cleanup());
      gainNode?.disconnect();
      sourceNode?.disconnect();
    };
  }, [stream, isMuted, playbackContext, playbackUnlockKey]);

  const hasLiveAudio = Boolean(
    stream?.getAudioTracks().some((track) => track.readyState === 'live' && !track.muted),
  );

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
