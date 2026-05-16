import { useState, useEffect } from 'react';
import s from './TrafficMetrics.module.css';

interface QoSMetrics {
  rttMs?: number | null;
  jitterMs?: number | null;
  packetLossPct?: number | null;
  bitrateKbps?: number | null;
  mosLike?: number | null;
}

interface TrafficMetricsProps {
  realMetrics?: QoSMetrics | null;
  isCloakingActive: boolean;
}

export const TrafficMetrics: React.FC<TrafficMetricsProps> = ({ realMetrics, isCloakingActive }) => {
  const [simulatedQoS, setSimulatedQoS] = useState({
    rttMs: 45,
    jitterMs: 12,
    packetLossPct: 0.5,
    bitrateKbps: 320,
    mosLike: 4.3,
  });

  const [securityMetrics, setSecurityMetrics] = useState({
    packetRate: 128,
    cloaking: 94.2,
    entropy: 7.8,
    dpi: 2.1,
    bandwidth: 68,
  });

  useEffect(() => {
    const interval = setInterval(() => {
      // Simulate slight fluctuations in QoS
      setSimulatedQoS(prev => ({
        rttMs: Math.max(10, prev.rttMs + (Math.random() * 4 - 2)),
        jitterMs: Math.max(2, prev.jitterMs + (Math.random() * 2 - 1)),
        packetLossPct: Math.max(0, prev.packetLossPct + (Math.random() * 0.2 - 0.1)),
        bitrateKbps: Math.max(100, prev.bitrateKbps + (Math.random() * 20 - 10)),
        mosLike: Math.min(5, Math.max(1, prev.mosLike + (Math.random() * 0.1 - 0.05))),
      }));

      // Simulate security metrics based on cloaking state
      if (isCloakingActive) {
        setSecurityMetrics({
          packetRate: 145 + Math.floor(Math.random() * 20),
          cloaking: 92 + Math.random() * 6,
          entropy: 7.5 + Math.random() * 0.4,
          dpi: 1.5 + Math.random() * 1.5,
          bandwidth: 70 + Math.random() * 5,
        });
      } else {
        setSecurityMetrics({
          packetRate: 85 + Math.floor(Math.random() * 10),
          cloaking: 12 + Math.random() * 5,
          entropy: 2.1 + Math.random() * 0.5,
          dpi: 85 + Math.random() * 10,
          bandwidth: 45 + Math.random() * 5,
        });
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [isCloakingActive]);

  // Use real metrics if available, otherwise fallback
  const displayQoS = {
    rttMs: realMetrics?.rttMs ?? simulatedQoS.rttMs,
    jitterMs: realMetrics?.jitterMs ?? simulatedQoS.jitterMs,
    packetLossPct: realMetrics?.packetLossPct ?? simulatedQoS.packetLossPct,
    bitrateKbps: realMetrics?.bitrateKbps ?? simulatedQoS.bitrateKbps,
    mosLike: realMetrics?.mosLike ?? simulatedQoS.mosLike,
  };

  const isReal = !!realMetrics && Object.keys(realMetrics).some(k => (realMetrics as any)[k] != null);

  return (
    <div className={s.container}>
      <div className={s.rowTitle}>
        Security & Cloaking Analysis
      </div>
      <div className={s.grid}>
        <MetricCard
          title="Packet Rate"
          value={`${securityMetrics.packetRate.toFixed(0)} p/s`}
          subtitle={isCloakingActive ? 'Obfuscated stream' : 'Predictable'}
          status={isCloakingActive ? 'good' : 'warn'}
        />
        <MetricCard
          title="Cloaking Efficiency"
          value={`${securityMetrics.cloaking.toFixed(1)}%`}
          subtitle="Traffic masking"
          status={isCloakingActive ? 'good' : 'danger'}
        />
        <MetricCard
          title="Entropy"
          value={`${securityMetrics.entropy.toFixed(1)} / 8.0`}
          subtitle={securityMetrics.entropy > 6 ? 'High (Randomized)' : 'Low (Patterned)'}
          status={securityMetrics.entropy > 6 ? 'good' : 'danger'}
        />
        <MetricCard
          title="DPI Detection"
          value={`${securityMetrics.dpi.toFixed(1)}%`}
          subtitle="Probability"
          status={securityMetrics.dpi < 10 ? 'good' : 'danger'}
        />
        <MetricCard
          title="Bandwidth"
          value={`${securityMetrics.bandwidth.toFixed(0)}%`}
          subtitle="Channel utilization"
          status="neutral"
        />
      </div>

      <div className={s.rowTitle}>
        QoS Telemetry <span className={s.dataSourceBadge}>{isReal ? 'LIVE REAL DATA' : 'SIMULATED FALLBACK'}</span>
      </div>
      <div className={s.grid}>
        <MetricCard
          title="RTT"
          value={`${displayQoS.rttMs.toFixed(0)} ms`}
          subtitle="Round trip time"
          status={displayQoS.rttMs < 100 ? 'good' : 'warn'}
        />
        <MetricCard
          title="Jitter"
          value={`${displayQoS.jitterMs.toFixed(1)} ms`}
          subtitle="Delay variation"
          status={displayQoS.jitterMs < 30 ? 'good' : 'warn'}
        />
        <MetricCard
          title="Packet Loss"
          value={`${displayQoS.packetLossPct.toFixed(2)}%`}
          subtitle="Data loss"
          status={displayQoS.packetLossPct < 2 ? 'good' : 'danger'}
        />
        <MetricCard
          title="Bitrate"
          value={`${displayQoS.bitrateKbps.toFixed(0)} kbps`}
          subtitle="Throughput"
          status="neutral"
        />
        <MetricCard
          title="MOS"
          value={displayQoS.mosLike.toFixed(1)}
          subtitle="Quality score (1-5)"
          status={displayQoS.mosLike >= 4 ? 'good' : 'warn'}
        />
      </div>
    </div>
  );
};

interface MetricCardProps {
  title: string;
  value: string;
  subtitle: string;
  status: 'good' | 'warn' | 'danger' | 'neutral';
}

const MetricCard: React.FC<MetricCardProps> = ({ title, value, subtitle, status }) => {
  const statusClass = s[`status_${status}`];
  return (
    <div className={s.card}>
      <div className={s.cardTitle}>{title}</div>
      <div className={s.cardValue}>
        <span className={`${s.statusDot} ${statusClass}`} />
        {value}
      </div>
      <div className={s.cardSubtitle}>{subtitle}</div>
    </div>
  );
};
