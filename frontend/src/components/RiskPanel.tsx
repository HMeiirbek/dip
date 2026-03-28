import React, { useEffect, useState } from 'react';
import { NumberCheckResult, RiskAnalysis, RiskMonitor, RiskStats } from '../types';

interface RiskPanelProps {
  riskAnalysis: RiskAnalysis | null;
  riskMonitor: RiskMonitor | null;
  riskStats: RiskStats | null;
  checkPhone: string;
  setCheckPhone: React.Dispatch<React.SetStateAction<string>>;
  checkPhoneResult: NumberCheckResult | null;
  reportPhone: string;
  setReportPhone: React.Dispatch<React.SetStateAction<string>>;
  reportDescription: string;
  setReportDescription: React.Dispatch<React.SetStateAction<string>>;
  onReloadRisk: () => Promise<void> | void;
  onCheckNumber: () => Promise<void> | void;
  onReportNumber: () => Promise<void> | void;
}

export const RiskPanel: React.FC<RiskPanelProps> = ({
  riskAnalysis,
  riskMonitor,
  riskStats,
  checkPhone,
  setCheckPhone,
  checkPhoneResult,
  reportPhone,
  setReportPhone,
  reportDescription,
  setReportDescription,
  onReloadRisk,
  onCheckNumber,
  onReportNumber,
}) => {
  const isMobile = useMediaQuery('(max-width: 840px)');
  return (
    <div style={{ ...styles.grid2, gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))' }}>
      <div style={styles.card}>
        <h3 style={styles.cardTitle}>Risk Overview</h3>
        <div style={styles.row}>
          <button style={styles.secondaryButton} onClick={onReloadRisk}>Reload Risk Data</button>
        </div>
        <pre style={styles.pre}>{JSON.stringify(riskAnalysis, null, 2)}</pre>
        <pre style={styles.pre}>{JSON.stringify(riskStats, null, 2)}</pre>
      </div>

      <div style={styles.card}>
        <h3 style={styles.cardTitle}>Check / Report Number</h3>
        <div style={styles.stack}>
          <input
            style={styles.input}
            placeholder="Phone number"
            value={checkPhone}
            onChange={(e) => setCheckPhone(e.target.value)}
          />
          <button style={styles.primaryButton} onClick={onCheckNumber}>Check Number</button>
          <pre style={styles.pre}>{JSON.stringify(checkPhoneResult, null, 2)}</pre>

          <input
            style={styles.input}
            placeholder="Report phone"
            value={reportPhone}
            onChange={(e) => setReportPhone(e.target.value)}
          />
          <input
            style={styles.input}
            placeholder="Description"
            value={reportDescription}
            onChange={(e) => setReportDescription(e.target.value)}
          />
          <button style={styles.secondaryButton} onClick={onReportNumber}>Report Number</button>
        </div>

        <h4 style={{ marginTop: 16 }}>Live Monitor</h4>
        <pre style={styles.pre}>{JSON.stringify(riskMonitor, null, 2)}</pre>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  grid2: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 },
  card: { background: 'var(--surface)', borderRadius: 12, padding: 14, boxShadow: 'var(--shadow)', border: '1px solid var(--border)' },
  cardTitle: { marginTop: 0, marginBottom: 10 },
  row: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 },
  stack: { display: 'flex', flexDirection: 'column', gap: 8 },
  input: { padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, minWidth: 180, background: 'var(--surface)', color: 'var(--text)' },
  pre: {
    background: 'rgba(13,17,23,0.75)',
    color: 'rgba(233,239,255,0.92)',
    padding: 10,
    borderRadius: 8,
    fontSize: 12,
    overflowX: 'auto',
    maxHeight: 240,
    overflowY: 'auto',
  },
  primaryButton: { padding: '8px 12px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: '#fff', cursor: 'pointer', fontWeight: 800 },
  secondaryButton: { padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer', fontWeight: 800 },
};

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    }
    mql.addListener(onChange);
    return () => mql.removeListener(onChange);
  }, [query]);

  return matches;
}
