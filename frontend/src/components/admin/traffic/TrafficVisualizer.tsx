import { useState, useMemo } from 'react';
import { Network, Shield, AlertTriangle, Download } from 'lucide-react';
import s from './TrafficVisualizer.module.css';
import { TrafficTimeline } from './TrafficTimeline';
import { TrafficMetrics } from './TrafficMetrics';
import { SecurityEventFeed } from './SecurityEventFeed';
import { ModeratorOverview } from '../../../types';

interface TrafficVisualizerProps {
  moderatorOverview?: ModeratorOverview | null;
}

export default function TrafficVisualizer({ moderatorOverview }: TrafficVisualizerProps) {
  const [isCloakingActive, setIsCloakingActive] = useState(true);

  // Extract real metrics if available from moderator overview
  const realMetrics = useMemo(() => {
    if (!moderatorOverview?.qualitySummary?.aggregate) return null;
    
    const agg = moderatorOverview.qualitySummary.aggregate;
    // Check if we actually have any valid metrics (p50 or avg)
    if (agg.rttMs.avg == null && agg.packetLossPct.avg == null) {
      return null;
    }

    return {
      rttMs: agg.rttMs.avg,
      jitterMs: agg.jitterMs.avg,
      packetLossPct: agg.packetLossPct.avg,
      bitrateKbps: agg.bitrateKbps.avg,
      mosLike: agg.mosLike.avg,
    };
  }, [moderatorOverview]);

  const activeCallsCount = moderatorOverview?.callCount || 0;
  const onlineCount = moderatorOverview?.onlineCount || 0;

  return (
    <div className={s.page}>
      <div className={s.header}>
        <div className={s.titleGroup}>
          <Network className={s.titleIcon} size={28} />
          <div>
            <h2 className={s.title}>Traffic Cloaking / Packet Visualization</h2>
            <div className={s.subtitle}>Визуализация сетевого трафика и маскировки пакетов в реальном времени</div>
          </div>
        </div>
        <div className={s.headerActions}>
          <button 
            className={`${s.toggleBtn} ${isCloakingActive ? s.activeBtn : s.inactiveBtn}`}
            onClick={() => setIsCloakingActive(!isCloakingActive)}
          >
            {isCloakingActive ? (
              <><Shield size={16} /> Защита активна</>
            ) : (
              <><AlertTriangle size={16} /> Защита отключена</>
            )}
          </button>
          <button className={s.secondaryBtn}>
            <Download size={16} /> Экспорт данных
          </button>
        </div>
      </div>

      <div className={s.statusBar}>
        <div className={s.statusItem}>
          <span className={s.statusDot} style={{ background: 'var(--success)' }} />
          Соединение активно
        </div>
        <div className={s.statusItem}>
          <span className={s.statusLabel}>Live Calls:</span> {activeCallsCount}
        </div>
        <div className={s.statusItem}>
          <span className={s.statusLabel}>Online Users:</span> {onlineCount}
        </div>
      </div>

      <TrafficTimeline isCloakingActive={isCloakingActive} />
      
      <TrafficMetrics 
        realMetrics={realMetrics} 
        isCloakingActive={isCloakingActive} 
      />
      
      <SecurityEventFeed isCloakingActive={isCloakingActive} />
    </div>
  );
}
