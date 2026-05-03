import React, { useState, useEffect } from 'react';
import { Shield, Lock, Globe, Server, ArrowRight, EyeOff, Zap } from 'lucide-react';
import s from './TunnelShowcase.module.css';

export const TunnelShowcase: React.FC = () => {
  const [isSecure, setIsSecure] = useState(false);
  const [metrics, setMetrics] = useState({ entropy: 32, latency: 42, overhead: 0 });

  useEffect(() => {
    const interval = setInterval(() => {
      if (isSecure) {
        setMetrics({
          entropy: 98 + Math.random() * 1.5,
          latency: 65 + Math.random() * 5,
          overhead: 14 + Math.random() * 2
        });
      } else {
        setMetrics({
          entropy: 42 + Math.random() * 10,
          latency: 40 + Math.random() * 2,
          overhead: 0
        });
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isSecure]);

  return (
    <div className={s.container}>
      <div className={s.card}>
        <div className={s.header}>
          <div className={s.titleGroup}>
            <h1>Security Architecture Showcase</h1>
            <p className={s.subtitle}>Visualizing DIP Network Obfuscation & Tunneling</p>
          </div>
          <div className={s.toggleContainer}>
            <button 
              className={`${s.toggleBtn} ${!isSecure ? s.toggleBtnActive : ''}`}
              onClick={() => setIsSecure(false)}
            >
              Insecure (P2P UDP)
            </button>
            <button 
              className={`${s.toggleBtn} ${isSecure ? s.toggleBtnActive : ''}`}
              onClick={() => setIsSecure(true)}
            >
              Secure Tunnel (TURN/TLS)
            </button>
          </div>
        </div>

        <div className={s.visualization}>
          <div className={`${s.node} ${isSecure ? s.nodeActive : ''}`}>
            <Server size={32} className={s.infoIcon} />
            <span className={s.nodeLabel}>Sender</span>
          </div>

          <div className={s.pathContainer}>
            <div className={s.pathLine} />
            <div className={`${s.tunnel} ${isSecure ? s.tunnelActive : ''}`} />
            
            {/* Particles */}
            {[...Array(12)].map((_, i) => (
              <div 
                key={i}
                className={`${s.particle} ${isSecure ? s.particleSecure : s.particleInsecure}`}
                style={{ 
                  animationDelay: `${i * 0.3}s`,
                  top: isSecure ? '50%' : `${10 + Math.random() * 80}%`,
                  marginTop: isSecure ? '-3px' : '0'
                }}
              />
            ))}

            {isSecure && (
              <div style={{ position: 'absolute', bottom: -30, width: '100%', textAlign: 'center' }}>
                <span style={{ color: '#3b82f6', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2em' }}>
                  Encrypted Tunnel: AES-256-GCM over TLS 1.3
                </span>
              </div>
            )}
          </div>

          <div className={`${s.node} ${isSecure ? s.nodeActive : ''}`}>
            <Globe size={32} className={s.infoIcon} />
            <span className={s.nodeLabel}>Recipient</span>
          </div>
        </div>

        <div className={s.metrics}>
          <div className={s.metricItem}>
            <span className={s.metricValue} style={{ color: isSecure ? '#10b981' : '#f87171' }}>
              {metrics.entropy.toFixed(1)}%
            </span>
            <span className={s.metricLabel}>Entropy (Privacy)</span>
          </div>
          <div className={s.metricItem}>
            <span className={s.metricValue}>{Math.round(metrics.latency)}ms</span>
            <span className={s.metricLabel}>End-to-End Latency</span>
          </div>
          <div className={s.metricItem}>
            <span className={s.metricValue} style={{ color: isSecure ? '#3b82f6' : '#9ca3af' }}>
              +{metrics.overhead.toFixed(1)}%
            </span>
            <span className={s.metricLabel}>BW Overhead</span>
          </div>
        </div>

        <div className={s.infoGrid}>
          <div className={s.infoCard}>
            <Shield size={24} className={s.infoIcon} />
            <div className={s.infoTitle}>Metadata Cloaking</div>
            <p className={s.infoText}>
              {isSecure 
                ? 'Internal IP addresses are stripped. External monitors only see traffic to/from a trusted proxy/TURN node.'
                : 'Direct P2P connection exposes local IP addresses and device signatures to network monitors.'}
            </p>
          </div>
          <div className={s.infoCard}>
            <Lock size={24} className={s.infoIcon} />
            <div className={s.infoTitle}>Payload Encryption</div>
            <p className={s.infoText}>
              {isSecure
                ? 'Double-wrapped security: SRTP media inside a TLS-encrypted management tunnel.'
                : 'Single-layer SRTP. Metadata (ports/IPs) remains visible and linkable to established P2P patterns.'}
            </p>
          </div>
          <div className={s.infoCard}>
            <EyeOff size={24} className={s.infoIcon} />
            <div className={s.infoTitle}>DPI Resistance</div>
            <p className={s.infoText}>
              {isSecure
                ? 'Traffic is encapsulated on port 443, appearing as standard web browsing to ISP Deep Packet Inspection.'
                : 'Uses standard WebRTC ports which are easily identified and can be throttled by network policies.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
