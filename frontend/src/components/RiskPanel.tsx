import React, { useEffect, useState } from 'react';
import {
  BlacklistEntry,
  Call,
  NumberCheckResult,
  ReportItem,
  RiskAnalysis,
  RiskMonitor,
  RiskStats,
} from '../types';

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
  const riskScore = riskAnalysis?.riskScore ?? 0;
  const riskTone = getRiskTone(riskScore);
  const recentCalls = riskAnalysis?.recent || [];
  const liveCalls = riskMonitor?.liveCalls || [];
  const reports = riskMonitor?.highPriorityReports || [];
  const blacklistPreview = riskMonitor?.blacklistPreview || [];
  const statCards = [
    { label: 'Risk Score', value: `${riskScore}/100`, accent: riskTone.color },
    { label: 'Confidence', value: formatPercent(riskAnalysis?.confidence) },
    { label: 'Total Calls', value: String(riskAnalysis?.totalCalls ?? 0) },
    { label: 'Risky Calls', value: String(riskAnalysis?.riskyCalls ?? 0) },
    { label: 'Reports Sent', value: String(riskAnalysis?.reportedByUser ?? 0) },
    { label: 'Suspicious Load', value: riskStats ? String(riskStats.suspiciousLoad) : 'Private' },
  ];
  const callsBreakdown = riskStats?.calls || null;
  const checkTone = getStatusTone(checkPhoneResult?.status);

  return (
    <div style={styles.page}>
      <div
        style={{
          ...styles.heroCard,
          gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1.25fr) minmax(260px, 0.75fr)',
        }}
      >
        <div style={styles.heroCopy}>
          <div style={styles.eyebrow}>Risk Center</div>
          <h2 style={styles.heroTitle}>Anti-fraud overview for calls and numbers</h2>
          <p style={styles.heroText}>
            Check suspicious numbers, track recent exposure, and watch system signals without digging through raw JSON.
          </p>
          <div style={styles.row}>
            <button style={styles.secondaryButton} onClick={onReloadRisk}>Reload Risk Data</button>
            <span style={{ ...styles.badge, background: riskTone.soft, color: riskTone.color }}>
              {riskTone.label}
            </span>
          </div>
        </div>
        <div style={styles.heroMeterCard}>
          <div style={styles.summaryLabel}>Current exposure</div>
          <div style={{ ...styles.heroScore, color: riskTone.color }}>{riskScore}</div>
          <div style={styles.meterTrack}>
            <div style={{ ...styles.meterFill, width: `${Math.max(4, riskScore)}%`, background: riskTone.color }} />
          </div>
          <div style={styles.heroMeta}>
            <span>confidence {formatPercent(riskAnalysis?.confidence)}</span>
            <span>user reports {riskAnalysis?.reportedByUser ?? 0}</span>
          </div>
        </div>
      </div>

      <div style={{ ...styles.metricGrid, gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(6, minmax(0, 1fr))' }}>
        {statCards.map((item) => (
          <div key={item.label} style={styles.metricCard}>
            <div style={styles.summaryLabel}>{item.label}</div>
            <div style={{ ...styles.metricValue, color: item.accent || 'var(--text)' }}>{item.value}</div>
          </div>
        ))}
      </div>

      <div style={{ ...styles.grid2, gridTemplateColumns: isMobile ? '1fr' : '1.05fr 0.95fr' }}>
        <div style={styles.card}>
          <div style={styles.cardHeaderRow}>
            <h3 style={styles.cardTitle}>Recent risk exposure</h3>
            <span style={styles.subtle}>last {recentCalls.length} calls</span>
          </div>
          <div style={styles.listBox}>
            {recentCalls.map((call) => (
              <div key={call.id} style={styles.listItemBetween}>
                <div style={styles.listItemColumn}>
                  <strong>{getCounterpart(call, riskAnalysis?.userId)}</strong>
                  <small>{new Date(call.createdAt).toLocaleString()}</small>
                </div>
                <div style={styles.listItemColumnRight}>
                  <span style={statusBadge(call.status)}>{call.status}</span>
                  <small>{call.callerId === riskAnalysis?.userId ? 'outgoing' : 'incoming'}</small>
                </div>
              </div>
            ))}
            {!recentCalls.length && <small>No recent calls yet.</small>}
          </div>

          {callsBreakdown && (
            <div style={styles.sectionBlock}>
              <div style={styles.cardHeaderRow}>
                <strong>Call status mix</strong>
                <span style={styles.subtle}>system-wide</span>
              </div>
              <div style={styles.statusGrid}>
                {Object.entries(callsBreakdown).map(([key, value]) => (
                  <div key={key} style={styles.statusCard}>
                    <div style={styles.summaryLabel}>{key}</div>
                    <div style={styles.statusValue}>{value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={styles.card}>
          <div style={styles.cardHeaderRow}>
            <h3 style={styles.cardTitle}>Check and report number</h3>
            <span style={styles.subtle}>instant lookup + complaint flow</span>
          </div>
          <div style={styles.sectionBlock}>
            <label style={styles.fieldLabel}>Check phone number</label>
            <div style={styles.inlineForm}>
              <input
                style={styles.input}
                placeholder="Phone number"
                value={checkPhone}
                onChange={(e) => setCheckPhone(e.target.value)}
              />
              <button style={styles.primaryButton} onClick={onCheckNumber}>Check</button>
            </div>
            {checkPhoneResult && (
              <div style={styles.resultCard}>
                <div style={styles.cardHeaderRow}>
                  <strong>{checkPhoneResult.phoneNumber}</strong>
                  <span style={{ ...styles.badge, background: checkTone.soft, color: checkTone.color }}>
                    {checkPhoneResult.status}
                  </span>
                </div>
                <div style={styles.metricGridCompact}>
                  <Metric label="Risk score" value={`${checkPhoneResult.riskScore}`} />
                  <Metric label="Reports" value={`${checkPhoneResult.reportsCount}`} />
                  <Metric label="Source" value={checkPhoneResult.source} />
                </div>
              </div>
            )}
          </div>

          <div style={styles.sectionBlock}>
            <label style={styles.fieldLabel}>Report suspicious number</label>
            <div style={styles.stack}>
              <input
                style={styles.input}
                placeholder="Report phone"
                value={reportPhone}
                onChange={(e) => setReportPhone(e.target.value)}
              />
              <textarea
                style={styles.textarea}
                placeholder="Why is this number suspicious?"
                value={reportDescription}
                onChange={(e) => setReportDescription(e.target.value)}
              />
              <button style={styles.secondaryButton} onClick={onReportNumber}>Submit report</button>
            </div>
          </div>
        </div>
      </div>

      <div style={{ ...styles.grid2, gridTemplateColumns: isMobile ? '1fr' : '1.05fr 0.95fr' }}>
        <div style={styles.card}>
          <div style={styles.cardHeaderRow}>
            <h3 style={styles.cardTitle}>Live monitor</h3>
            <span style={styles.subtle}>{riskMonitor?.streamAt ? new Date(riskMonitor.streamAt).toLocaleTimeString() : 'no snapshot'}</span>
          </div>
          <div style={styles.metricGridCompact}>
            <Metric label="Live calls" value={`${liveCalls.length}`} />
            <Metric label="Priority reports" value={`${reports.length}`} />
            <Metric label="Blacklist preview" value={`${blacklistPreview.length}`} />
          </div>
          <div style={styles.sectionBlock}>
            <strong>Active calls</strong>
            <div style={styles.listBox}>
              {liveCalls.map((call) => (
                <div key={call.id} style={styles.listItemBetween}>
                  <div style={styles.listItemColumn}>
                    <strong>{getCallPair(call)}</strong>
                    <small>{new Date(call.createdAt).toLocaleString()}</small>
                  </div>
                  <span style={statusBadge(call.status)}>{call.status}</span>
                </div>
              ))}
              {!liveCalls.length && <small>No live calls in the monitor.</small>}
            </div>
          </div>
        </div>

        <div style={styles.card}>
          <div style={styles.cardHeaderRow}>
            <h3 style={styles.cardTitle}>Risk inbox</h3>
            <span style={styles.subtle}>reports + blacklist preview</span>
          </div>
          <div style={styles.sectionBlock}>
            <strong>Priority reports</strong>
            <div style={styles.listBox}>
              {reports.map((report) => (
                <ReportRow key={report.id} report={report} />
              ))}
              {!reports.length && <small>No priority reports right now.</small>}
            </div>
          </div>
          <div style={styles.sectionBlock}>
            <strong>Blacklist preview</strong>
            <div style={styles.listBox}>
              {blacklistPreview.map((entry) => (
                <BlacklistRow key={entry.id} entry={entry} />
              ))}
              {!blacklistPreview.length && <small>Blacklist preview is empty.</small>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Metric: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={styles.metricMiniCard}>
    <div style={styles.summaryLabel}>{label}</div>
    <div style={styles.metricMiniValue}>{value}</div>
  </div>
);

const ReportRow: React.FC<{ report: ReportItem }> = ({ report }) => (
  <div style={styles.listItemBetween}>
    <div style={styles.listItemColumn}>
      <strong>{report.phoneNumber}</strong>
      <small>{new Date(report.createdAt).toLocaleString()}</small>
      {report.description && <small>{report.description}</small>}
    </div>
    <span style={statusBadge(report.status || 'pending')}>{report.status || 'pending'}</span>
  </div>
);

const BlacklistRow: React.FC<{ entry: BlacklistEntry }> = ({ entry }) => (
  <div style={styles.listItemBetween}>
    <div style={styles.listItemColumn}>
      <strong>{entry.phoneNumber}</strong>
      <small>{entry.reason || 'No reason provided'}</small>
    </div>
    <span style={{ ...styles.badge, background: 'rgba(239,68,68,0.12)', color: 'var(--danger)' }}>
      {entry.source}
    </span>
  </div>
);

function getCounterpart(call: Call, userId?: string) {
  if (!userId) return getCallPair(call);
  if (call.callerId === userId) return call.callee?.username || call.calleeId;
  if (call.calleeId === userId) return call.caller?.username || call.callerId;
  return getCallPair(call);
}

function getCallPair(call: Call) {
  return `${call.caller?.username || call.callerId} -> ${call.callee?.username || call.calleeId}`;
}

function formatPercent(value?: number | null) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '-';
  return `${Math.round(value * 100)}%`;
}

function getRiskTone(score: number) {
  if (score >= 70) {
    return {
      label: 'High exposure',
      color: 'var(--danger)',
      soft: 'rgba(237,66,69,0.12)',
    };
  }
  if (score >= 40) {
    return {
      label: 'Elevated',
      color: 'var(--warn)',
      soft: 'rgba(250,168,26,0.12)',
    };
  }
  return {
    label: 'Low',
    color: 'var(--success)',
    soft: 'rgba(35,165,90,0.12)',
  };
}

function getStatusTone(status?: string) {
  if (status === 'blacklisted' || status === 'rejected') {
    return { color: 'var(--danger)', soft: 'rgba(237,66,69,0.12)' };
  }
  if (status === 'reported' || status === 'pending') {
    return { color: 'var(--warn)', soft: 'rgba(250,168,26,0.12)' };
  }
  return { color: 'var(--success)', soft: 'rgba(35,165,90,0.12)' };
}

function statusBadge(status: string): React.CSSProperties {
  const tone = getStatusTone(status);
  return {
    ...styles.badge,
    background: tone.soft,
    color: tone.color,
  };
}

const styles: Record<string, any> = {
  page: { display: 'flex', flexDirection: 'column', gap: 16 },
  heroCard: {
    display: 'grid',
    gap: 16,
    background: 'linear-gradient(135deg, rgba(88,101,242,0.10) 0%, rgba(237,66,69,0.08) 100%)',
    borderRadius: 24,
    border: '1px solid var(--border)',
    padding: 20,
    boxShadow: 'var(--shadow-soft)',
  },
  heroCopy: { display: 'flex', flexDirection: 'column', gap: 10 },
  eyebrow: { textTransform: 'uppercase', letterSpacing: 1.4, fontSize: 11, color: 'var(--muted)' },
  heroTitle: { margin: 0, fontSize: 28, lineHeight: 1.05 },
  heroText: { margin: 0, color: 'var(--muted)', maxWidth: 620, lineHeight: 1.55 },
  heroMeterCard: {
    background: 'var(--panel-bg)',
    borderRadius: 20,
    border: '1px solid var(--border)',
    padding: 18,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    gap: 12,
  },
  heroScore: { fontSize: 56, fontWeight: 900, lineHeight: 1 },
  heroMeta: { display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', color: 'var(--muted)', fontSize: 12 },
  meterTrack: { width: '100%', height: 12, borderRadius: 999, background: 'var(--panel-bg2)', overflow: 'hidden' },
  meterFill: { height: '100%', borderRadius: 999, transition: 'width 240ms ease' },
  metricGrid: { display: 'grid', gap: 12 },
  metricGridCompact: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 },
  grid2: { display: 'grid', gap: 16 },
  card: {
    background: 'var(--panel-bg)',
    borderRadius: 20,
    padding: 16,
    boxShadow: 'var(--shadow-soft)',
    border: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  cardHeaderRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  cardTitle: { margin: 0, fontSize: 18 },
  sectionBlock: { display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 8, borderTop: '1px solid var(--border)' },
  row: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  stack: { display: 'flex', flexDirection: 'column', gap: 8 },
  inlineForm: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  input: {
    padding: '10px 12px',
    border: '1px solid var(--border)',
    borderRadius: 12,
    minWidth: 180,
    background: 'var(--panel-bg2)',
    color: 'var(--text)',
    flex: '1 1 220px',
  },
  textarea: {
    padding: '10px 12px',
    border: '1px solid var(--border)',
    borderRadius: 12,
    minHeight: 104,
    resize: 'vertical',
    background: 'var(--panel-bg2)',
    color: 'var(--text)',
  },
  resultCard: {
    background: 'var(--panel-bg2)',
    border: '1px solid var(--border)',
    borderRadius: 16,
    padding: 14,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  listBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    maxHeight: 320,
    overflowY: 'auto',
    paddingRight: 4,
  },
  listItemBetween: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    background: 'var(--panel-bg2)',
    border: '1px solid rgba(255,255,255,0.02)',
  },
  listItemColumn: { display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 },
  listItemColumnRight: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 },
  statusGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 10 },
  statusCard: { background: 'var(--panel-bg2)', border: '1px solid var(--border)', borderRadius: 14, padding: 12 },
  statusValue: { fontSize: 18, fontWeight: 800 },
  metricCard: {
    background: 'var(--panel-bg)',
    borderRadius: 18,
    padding: 14,
    boxShadow: 'var(--shadow-soft)',
    border: '1px solid var(--border)',
  },
  metricMiniCard: {
    background: 'var(--panel-bg2)',
    borderRadius: 14,
    padding: 12,
    border: '1px solid var(--border)',
  },
  metricMiniValue: { fontSize: 18, fontWeight: 800 },
  summaryLabel: { color: 'var(--muted)', fontSize: 12, marginBottom: 6 },
  fieldLabel: { fontSize: 12, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.1 },
  metricValue: { fontSize: 24, fontWeight: 900 },
  subtle: { fontSize: 12, color: 'var(--muted)' },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4px 10px',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  primaryButton: {
    padding: '10px 14px',
    borderRadius: 12,
    border: 'none',
    background: 'var(--primary)',
    color: '#fff',
    cursor: 'pointer',
    fontWeight: 800,
  },
  secondaryButton: {
    padding: '10px 14px',
    borderRadius: 12,
    border: '1px solid var(--border)',
    background: 'var(--panel-bg2)',
    color: 'var(--text)',
    cursor: 'pointer',
    fontWeight: 800,
  },
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
