import { useEffect, useRef } from 'react';
import s from './TrafficTimeline.module.css';

interface TrafficTimelineProps {
  isCloakingActive: boolean;
}

interface Particle {
  x: number;
  y: number;
  speed: number;
  color: string;
  size: number;
  id: number;
}

export const TrafficTimeline: React.FC<TrafficTimelineProps> = ({ isCloakingActive }) => {
  const canvasRef1 = useRef<HTMLCanvasElement>(null);
  const canvasRef2 = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas1 = canvasRef1.current;
    const canvas2 = canvasRef2.current;
    if (!canvas1 || !canvas2) return;

    const ctx1 = canvas1.getContext('2d');
    const ctx2 = canvas2.getContext('2d');
    if (!ctx1 || !ctx2) return;

    // Handle high DPI displays
    const dpr = window.devicePixelRatio || 1;
    const resizeCanvas = (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };

    resizeCanvas(canvas1, ctx1);
    resizeCanvas(canvas2, ctx2);

    let animationFrameId: number;
    let lastTime = performance.now();
    const fpsLimit = 60;
    const frameDuration = 1000 / fpsLimit;

    // Track state
    let particles1: Particle[] = [];
    let particles2: Particle[] = [];
    let particleIdCounter = 0;

    const colors = {
      stun: '#3b82f6',
      dtls: '#a855f7',
      rtpAudio: '#22c55e',
      rtpVideo: '#eab308',
      rtcp: '#f97316',
      cloaked: ['#3b82f6', '#a855f7', '#22c55e', '#eab308', '#f97316', '#06b6d4'],
    };

    // Tracks for Before Cloaking
    const tracksBefore = [
      { y: 20, color: colors.stun, size: 2, prob: 0.05, label: 'STUN / ICE' },
      { y: 50, color: colors.dtls, size: 3, prob: 0.02, label: 'DTLS' },
      { y: 80, color: colors.rtpAudio, size: 4, prob: 0.4, label: 'RTP Audio' },
      { y: 110, color: colors.rtpVideo, size: 5, prob: 0.6, label: 'RTP Video' },
      { y: 140, color: colors.rtcp, size: 2, prob: 0.1, label: 'RTCP' },
    ];

    // Tracks for After Cloaking (10 TCP streams)
    const tracksAfter = Array.from({ length: 10 }).map((_, i) => ({
      y: 15 + i * 15,
      color: colors.cloaked[i % colors.cloaked.length],
      size: 2 + Math.random() * 2,
    }));

    const render = (time: number) => {
      animationFrameId = requestAnimationFrame(render);

      // FPS limiting and pause on inactive tab (document.hidden)
      if (document.hidden) return;
      const deltaTime = time - lastTime;
      if (deltaTime < frameDuration) return;
      lastTime = time - (deltaTime % frameDuration);

      const rect1 = canvas1.getBoundingClientRect();

      const width = rect1.width;
      const height = rect1.height;

      // Clear canvases
      ctx1.clearRect(0, 0, width, height);
      ctx2.clearRect(0, 0, width, height);

      // --- BEFORE CLOAKING LOGIC ---
      // Add new particles based on probability (predictable traffic)
      tracksBefore.forEach(track => {
        if (Math.random() < track.prob) {
          particles1.push({
            x: 0,
            y: track.y,
            speed: 2 + Math.random(),
            color: track.color,
            size: track.size,
            id: particleIdCounter++,
          });
        }
      });

      // Update & Draw Before
      for (let i = particles1.length - 1; i >= 0; i--) {
        const p = particles1[i];
        p.x += p.speed;
        
        ctx1.fillStyle = p.color;
        ctx1.beginPath();
        ctx1.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx1.fill();

        if (p.x > width) {
          particles1.splice(i, 1);
        }
      }

      // Draw faint track lines for Before
      tracksBefore.forEach(track => {
        ctx1.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx1.beginPath();
        ctx1.moveTo(0, track.y);
        ctx1.lineTo(width, track.y);
        ctx1.stroke();
      });

      // --- AFTER CLOAKING LOGIC ---
      if (isCloakingActive) {
        // High entropy, randomized adding
        if (Math.random() < 0.8) {
          const numNew = Math.floor(Math.random() * 5) + 1;
          for (let i = 0; i < numNew; i++) {
            const track = tracksAfter[Math.floor(Math.random() * tracksAfter.length)];
            particles2.push({
              x: 0,
              y: track.y,
              speed: 1.5 + Math.random() * 2, // Randomized speed
              color: track.color,
              size: track.size * (0.5 + Math.random()), // Randomized size
              id: particleIdCounter++,
            });
          }
        }
      }

      // Update & Draw After
      for (let i = particles2.length - 1; i >= 0; i--) {
        const p = particles2[i];
        p.x += p.speed;
        
        ctx2.fillStyle = p.color;
        // Obfuscation effect: change y slightly to simulate noise if active
        const yOffset = isCloakingActive ? (Math.random() - 0.5) * 2 : 0;
        
        ctx2.beginPath();
        ctx2.arc(p.x, p.y + yOffset, p.size, 0, Math.PI * 2);
        ctx2.fill();

        if (p.x > width) {
          particles2.splice(i, 1);
        }
      }

      // Draw faint track lines for After
      tracksAfter.forEach(track => {
        ctx2.strokeStyle = 'rgba(255, 255, 255, 0.03)';
        ctx2.beginPath();
        ctx2.moveTo(0, track.y);
        ctx2.lineTo(width, track.y);
        ctx2.stroke();
      });
    };

    animationFrameId = requestAnimationFrame(render);

    const handleResize = () => {
      resizeCanvas(canvas1, ctx1);
      resizeCanvas(canvas2, ctx2);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      particles1 = [];
      particles2 = [];
    };
  }, [isCloakingActive]);

  return (
    <div className={s.container}>
      <div className={s.panel}>
        <div className={s.panelHeader}>
          <div className={s.panelTitle}>
            <span className={s.alertIcon}>⚠️</span>
            ДО МАСКИРОВКИ (Обычный WebRTC трафик)
          </div>
          <div className={s.panelSubtitle}>
            Трафик имеет выраженные паттерны и может быть проанализирован
          </div>
        </div>
        <div className={s.canvasWrapper}>
          <canvas ref={canvasRef1} className={s.canvas} />
          <div className={s.yAxisLabels}>
            <div>STUN / ICE</div>
            <div>DTLS</div>
            <div>RTP Audio</div>
            <div>RTP Video</div>
            <div>RTCP</div>
          </div>
        </div>
      </div>

      <div className={s.panel}>
        <div className={s.panelHeader}>
          <div className={s.panelTitle}>
            <span className={s.secureIcon}>🔒</span>
            ПОСЛЕ МАСКИРОВКИ (TCP Cloaking активен)
          </div>
          <div className={s.panelSubtitle}>
            Трафик замаскирован и выглядит как случайный TCP трафик
          </div>
        </div>
        <div className={s.canvasWrapper}>
          <canvas ref={canvasRef2} className={s.canvas} />
          <div className={s.yAxisLabels}>
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} style={{ fontSize: '0.65rem' }}>TCP Stream {i + 1}</div>
            ))}
          </div>
        </div>
        
        {!isCloakingActive && (
          <div className={s.overlay}>
            Cloaking is inactive. Enable to see obfuscated traffic.
          </div>
        )}
      </div>
    </div>
  );
};
