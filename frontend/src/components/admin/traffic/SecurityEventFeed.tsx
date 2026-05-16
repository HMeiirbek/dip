import React, { useState, useEffect } from 'react';
import s from './SecurityEventFeed.module.css';

interface SecurityEvent {
  id: string;
  time: string;
  message: string;
  type: 'info' | 'warn' | 'success';
}

export const SecurityEventFeed: React.FC<{ isCloakingActive: boolean }> = ({ isCloakingActive }) => {
  const [events, setEvents] = useState<SecurityEvent[]>([]);

  useEffect(() => {
    // Initial events
    const initialEvents: SecurityEvent[] = [
      { id: '1', time: new Date().toLocaleTimeString(), message: 'Traffic analysis module initialized', type: 'info' },
    ];
    setEvents(initialEvents);

    const interval = setInterval(() => {
      const newEvent: SecurityEvent = {
        id: Math.random().toString(36).substr(2, 9),
        time: new Date().toLocaleTimeString(),
        message: '',
        type: 'info',
      };

      if (isCloakingActive) {
        const cloakingEvents = [
          { m: 'Traffic cloaking active - stream obfuscated', t: 'success' },
          { m: 'Entropy level normalized', t: 'info' },
          { m: 'DPI signature masking successful', t: 'success' },
          { m: 'TCP stream randomization active', t: 'info' },
        ];
        const evt = cloakingEvents[Math.floor(Math.random() * cloakingEvents.length)];
        newEvent.message = evt.m;
        newEvent.type = evt.t as any;
      } else {
        const uncloakedEvents = [
          { m: 'Cleartext STUN/ICE binding detected', t: 'warn' },
          { m: 'Predictable RTP payload size observed', t: 'warn' },
          { m: 'WebRTC fingerprint exposed to network', t: 'warn' },
          { m: 'DTLS handshake initiated', t: 'info' },
        ];
        const evt = uncloakedEvents[Math.floor(Math.random() * uncloakedEvents.length)];
        newEvent.message = evt.m;
        newEvent.type = evt.t as any;
      }

      setEvents(prev => [newEvent, ...prev].slice(0, 8)); // Keep last 8 events
    }, 4500);

    return () => clearInterval(interval);
  }, [isCloakingActive]);

  return (
    <div className={s.container}>
      <div className={s.header}>
        <div className={s.title}>События безопасности</div>
      </div>
      <div className={s.feed}>
        {events.map((evt, idx) => (
          <div key={evt.id} className={s.eventRow} style={{ opacity: 1 - idx * 0.1 }}>
            <span className={s.time}>{evt.time}</span>
            <span className={`${s.icon} ${s[evt.type]}`}>
              {evt.type === 'success' && '✅'}
              {evt.type === 'warn' && '⚠️'}
              {evt.type === 'info' && 'ℹ️'}
            </span>
            <span className={s.message}>{evt.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
