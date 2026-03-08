import React from 'react';
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
  return (
    <div style={styles.grid2}>
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
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  card: { background: '#fff', borderRadius: 12, padding: 14, boxShadow: '0 2px 10px rgba(0,0,0,0.06)' },
  cardTitle: { marginTop: 0, marginBottom: 10 },
  row: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 },
  stack: { display: 'flex', flexDirection: 'column', gap: 8 },
  input: { padding: '8px 10px', border: '1px solid #c5d1e8', borderRadius: 8, minWidth: 180 },
  pre: {
    background: '#0d1117',
    color: '#c9d1d9',
    padding: 10,
    borderRadius: 8,
    fontSize: 12,
    overflowX: 'auto',
    maxHeight: 240,
    overflowY: 'auto',
  },
  primaryButton: { padding: '8px 12px', borderRadius: 8, border: 'none', background: '#0c6cff', color: '#fff', cursor: 'pointer', fontWeight: 700 },
  secondaryButton: { padding: '8px 12px', borderRadius: 8, border: '1px solid #b5c3de', background: '#fff', color: '#1a3369', cursor: 'pointer', fontWeight: 700 },
};
