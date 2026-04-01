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
import s from './RiskPanel.module.css';

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
    <div className={s.page}>
      <div
        className={[
          s.heroCard,
          isMobile ? s.heroCardMobile : s.heroCardDesktop,
        ].join(' ')}
      >
        <div className={s.heroCopy}>
          <div className={s.eyebrow}>Risk Center</div>
          <h2 className={s.heroTitle}>Anti-fraud overview for calls and numbers</h2>
          <p className={s.heroText}>
            Check suspicious numbers, track recent exposure, and watch system signals without digging through raw JSON.
          </p>
          <div className={s.row}>
            <button className={s.secondaryButton} onClick={onReloadRisk}>Reload Risk Data</button>
            <span className={s.badge} style={{ background: riskTone.soft, color: riskTone.color }}>
              {riskTone.label}
            </span>
          </div>
        </div>
        <div className={s.heroMeterCard}>
          <div className={s.summaryLabel}>Current exposure</div>
          <div className={s.heroScore} style={{ color: riskTone.color }}>{riskScore}</div>
          <div className={s.meterTrack}>
            <div className={s.meterFill} style={{ width: `${Math.max(4, riskScore)}%`, background: riskTone.color }} />
          </div>
          <div className={s.heroMeta}>
            <span>confidence {formatPercent(riskAnalysis?.confidence)}</span>
            <span>user reports {riskAnalysis?.reportedByUser ?? 0}</span>
          </div>
        </div>
      </div>

      <div
        className={[
          s.metricGrid,
          isMobile ? s.metricGridMobile : s.metricGridDesktop,
        ].join(' ')}
      >
        {statCards.map((item) => (
          <div key={item.label} className={s.metricCard}>
            <div className={s.summaryLabel}>{item.label}</div>
            <div className={s.metricValue} style={{ color: item.accent || 'var(--text)' }}>{item.value}</div>
          </div>
        ))}
      </div>

      <div className={[s.grid2, isMobile ? s.grid2Mobile : s.grid2Desktop].join(' ')}>
        <div className={s.card}>
          <div className={s.cardHeaderRow}>
            <h3 className={s.cardTitle}>Recent risk exposure</h3>
            <span className={s.subtle}>last {recentCalls.length} calls</span>
          </div>
          <div className={s.listBox}>
            {recentCalls.map((call) => (
              <div key={call.id} className={s.listItemBetween}>
                <div className={s.listItemColumn}>
                  <strong>{getCounterpart(call, riskAnalysis?.userId)}</strong>
                  <small>{new Date(call.createdAt).toLocaleString()}</small>
                </div>
                <div className={s.listItemColumnRight}>
                  <span className={s.badge} style={statusBadge(call.status)}>{call.status}</span>
                  <small>{call.callerId === riskAnalysis?.userId ? 'outgoing' : 'incoming'}</small>
                </div>
              </div>
            ))}
            {!recentCalls.length && <small>No recent calls yet.</small>}
          </div>

          {callsBreakdown && (
            <div className={s.sectionBlock}>
              <div className={s.cardHeaderRow}>
                <strong>Call status mix</strong>
                <span className={s.subtle}>system-wide</span>
              </div>
              <div className={s.statusGrid}>
                {Object.entries(callsBreakdown).map(([key, value]) => (
                  <div key={key} className={s.statusCard}>
                    <div className={s.summaryLabel}>{key}</div>
                    <div className={s.statusValue}>{value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className={s.card}>
          <div className={s.cardHeaderRow}>
            <h3 className={s.cardTitle}>Check and report number</h3>
            <span className={s.subtle}>instant lookup + complaint flow</span>
          </div>
          <div className={s.sectionBlock}>
            <label className={s.fieldLabel}>Check phone number</label>
            <div className={s.inlineForm}>
              <input
                className={s.input}
                placeholder="Phone number"
                value={checkPhone}
                onChange={(e) => setCheckPhone(e.target.value)}
              />
              <button className={s.primaryButton} onClick={onCheckNumber}>Check</button>
            </div>
            {checkPhoneResult && (
              <div className={s.resultCard}>
                <div className={s.cardHeaderRow}>
                  <strong>{checkPhoneResult.phoneNumber}</strong>
                  <span className={s.badge} style={{ background: checkTone.soft, color: checkTone.color }}>
                    {checkPhoneResult.status}
                  </span>
                </div>
                <div className={s.metricGridCompact}>
                  <Metric label="Risk score" value={`${checkPhoneResult.riskScore}`} />
                  <Metric label="Reports" value={`${checkPhoneResult.reportsCount}`} />
                  <Metric label="Source" value={checkPhoneResult.source} />
                </div>
              </div>
            )}
          </div>

          <div className={s.sectionBlock}>
            <label className={s.fieldLabel}>Report suspicious number</label>
            <div className={s.stack}>
              <input
                className={s.input}
                placeholder="Report phone"
                value={reportPhone}
                onChange={(e) => setReportPhone(e.target.value)}
              />
              <textarea
                className={s.textarea}
                placeholder="Why is this number suspicious?"
                value={reportDescription}
                onChange={(e) => setReportDescription(e.target.value)}
              />
              <button className={s.secondaryButton} onClick={onReportNumber}>Submit report</button>
            </div>
          </div>
        </div>
      </div>

      <div className={[s.grid2, isMobile ? s.grid2Mobile : s.grid2Desktop].join(' ')}>
        <div className={s.card}>
          <div className={s.cardHeaderRow}>
            <h3 className={s.cardTitle}>Live monitor</h3>
            <span className={s.subtle}>{riskMonitor?.streamAt ? new Date(riskMonitor.streamAt).toLocaleTimeString() : 'no snapshot'}</span>
          </div>
          <div className={s.metricGridCompact}>
            <Metric label="Live calls" value={`${liveCalls.length}`} />
            <Metric label="Priority reports" value={`${reports.length}`} />
            <Metric label="Blacklist preview" value={`${blacklistPreview.length}`} />
          </div>
          <div className={s.sectionBlock}>
            <strong>Active calls</strong>
            <div className={s.listBox}>
              {liveCalls.map((call) => (
                <div key={call.id} className={s.listItemBetween}>
                  <div className={s.listItemColumn}>
                    <strong>{getCallPair(call)}</strong>
                    <small>{new Date(call.createdAt).toLocaleString()}</small>
                  </div>
                  <span className={s.badge} style={statusBadge(call.status)}>{call.status}</span>
                </div>
              ))}
              {!liveCalls.length && <small>No live calls in the monitor.</small>}
            </div>
          </div>
        </div>

        <div className={s.card}>
          <div className={s.cardHeaderRow}>
            <h3 className={s.cardTitle}>Risk inbox</h3>
            <span className={s.subtle}>reports + blacklist preview</span>
          </div>
          <div className={s.sectionBlock}>
            <strong>Priority reports</strong>
            <div className={s.listBox}>
              {reports.map((report) => (
                <ReportRow key={report.id} report={report} />
              ))}
              {!reports.length && <small>No priority reports right now.</small>}
            </div>
          </div>
          <div className={s.sectionBlock}>
            <strong>Blacklist preview</strong>
            <div className={s.listBox}>
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
  <div className={s.metricMiniCard}>
    <div className={s.summaryLabel}>{label}</div>
    <div className={s.metricMiniValue}>{value}</div>
  </div>
);

const ReportRow: React.FC<{ report: ReportItem }> = ({ report }) => (
  <div className={s.listItemBetween}>
    <div className={s.listItemColumn}>
      <strong>{report.phoneNumber}</strong>
      <small>{new Date(report.createdAt).toLocaleString()}</small>
      {report.description && <small>{report.description}</small>}
    </div>
    <span className={s.badge} style={statusBadge(report.status || 'pending')}>{report.status || 'pending'}</span>
  </div>
);

const BlacklistRow: React.FC<{ entry: BlacklistEntry }> = ({ entry }) => (
  <div className={s.listItemBetween}>
    <div className={s.listItemColumn}>
      <strong>{entry.phoneNumber}</strong>
      <small>{entry.reason || 'No reason provided'}</small>
    </div>
    <span className={s.badge} style={{ background: 'rgba(237,66,69,0.12)', color: 'var(--danger)' }}>
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
    background: tone.soft,
    color: tone.color,
  };
}

// styles moved to RiskPanel.module.css

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
