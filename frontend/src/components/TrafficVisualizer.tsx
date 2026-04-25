import React, { useState, useMemo, ChangeEvent } from 'react';
import { Network, UploadCloud } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, ScatterChart, Scatter, ZAxis, BarChart, Bar, AreaChart, Area
} from 'recharts';
import s from './TrafficVisualizer.module.css';
import { parseWiresharkJson, parseRawPcap, calculateTrafficStats, PacketData } from '../utils/pcapParser';

type ProtocolFilter = Record<string, boolean>;

export const TrafficVisualizer: React.FC = () => {
  const [mode, setMode] = useState<'normal' | 'protected'>('normal');
  const [packets, setPackets] = useState<PacketData[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [filters, setFilters] = useState<ProtocolFilter>({
    TCP: true,
    UDP: true,
    TLS: true,
    RTP: true,
    Other: false
  });

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      if (file.name.endsWith('.json')) {
        const text = await file.text();
        const json = JSON.parse(text);
        const parsedPackets = parseWiresharkJson(json);
        setPackets(parsedPackets);
      } else if (file.name.endsWith('.pcap')) {
        const buffer = await file.arrayBuffer();
        const parsedPackets = parseRawPcap(buffer);
        setPackets(parsedPackets);
      } else {
        alert('Unsupported format. Please upload .json (Wireshark export) or .pcap');
      }
    } catch (err) {
      console.error(err);
      alert('Error parsing file');
    } finally {
      setLoading(false);
    }
  };

  const filteredPackets = useMemo(() => {
    return packets.filter(p => filters[p.protocol] !== false);
  }, [packets, filters]);

  const stats = useMemo(() => calculateTrafficStats(filteredPackets), [filteredPackets]);

  // Data for Size over Time chart
  const timeData = useMemo(() => {
    if (filteredPackets.length === 0) return [];
    const t0 = filteredPackets[0].timestamp;
    return filteredPackets.map(p => ({
      timeSec: Number(((p.timestamp - t0) / 1000).toFixed(3)),
      size: p.size,
      protocol: p.protocol
    }));
  }, [filteredPackets]);

  // Data for Interval chart
  const intervalData = useMemo(() => {
    return filteredPackets.map((p, idx) => ({
      packetNum: idx + 1,
      interval: p.interval
    }));
  }, [filteredPackets]);

  // Data for Histogram chart
  const histogramData = useMemo(() => {
    const bins = [0, 100, 250, 500, 1000, 1500];
    const binCounts = new Array(bins.length).fill(0);
    
    filteredPackets.forEach(p => {
      for(let i = 0; i < bins.length; i++) {
        if (i === bins.length - 1 && p.size >= bins[i]) {
          binCounts[i]++;
          break;
        } else if (p.size >= bins[i] && p.size < bins[i+1]) {
          binCounts[i]++;
          break;
        }
      }
    });

    return bins.map((bin, i) => {
      const label = i === bins.length - 1 ? `${bin}+` : `${bin}-${bins[i+1]}`;
      return { range: label, count: binCounts[i] };
    });
  }, [filteredPackets]);

  // Data for Flow Density (Packets per 100ms window)
  const densityData = useMemo(() => {
    if (filteredPackets.length === 0) return [];
    const t0 = filteredPackets[0].timestamp;
    const tN = filteredPackets[filteredPackets.length - 1].timestamp;
    const windowSize = 250; // 250ms
    const numWindows = Math.ceil((tN - t0) / windowSize) + 1;
    const windows = new Array(numWindows).fill(0);

    filteredPackets.forEach(p => {
      const winIdx = Math.floor((p.timestamp - t0) / windowSize);
      if (winIdx >= 0 && winIdx < numWindows) {
        windows[winIdx]++;
      }
    });

    return windows.map((count, i) => ({
      timeSec: Number(((i * windowSize) / 1000).toFixed(2)),
      packetsPerWindow: count
    }));
  }, [filteredPackets]);

  const toggleFilter = (protocol: string) => {
    setFilters(f => ({ ...f, [protocol]: !f[protocol] }));
  };

  return (
    <div className={s.container}>
      <div className={s.header}>
        <h2 className={s.title}>
          <Network className={s.titleIcon} size={28} />
          Network Traffic Visualizer
        </h2>
      </div>

      <div className={s.controls}>
        <div className={s.modeToggle}>
          <button 
            className={`${s.modeBtn} ${mode === 'normal' ? s.active : ''}`}
            onClick={() => setMode('normal')}
          >
            Normal (WebRTC)
          </button>
          <button 
            className={`${s.modeBtn} ${mode === 'protected' ? s.active : ''}`}
            onClick={() => setMode('protected')}
          >
            Protected Traffic
          </button>
        </div>

        <div className={s.filters}>
          {['TCP', 'UDP', 'TLS', 'RTP'].map(proto => (
            <label key={proto} className={s.filterCheckbox}>
              <input 
                type="checkbox" 
                checked={filters[proto] || false}
                onChange={() => toggleFilter(proto)}
              />
              {proto}
            </label>
          ))}
        </div>
      </div>

      <label className={s.uploadZone}>
        <input 
          type="file" 
          accept=".json,.pcap" 
          onChange={handleFileUpload}
          style={{ display: 'none' }}
        />
        <UploadCloud className={s.uploadIcon} size={48} />
        <div className={s.uploadText}>
          {loading ? 'Processing...' : 'Click to upload or drag and drop'}
        </div>
        <div className={s.uploadSubText}>
          Supports Wireshark JSON Export (.json) or legacy .pcap
        </div>
      </label>

      {filteredPackets.length > 0 && (
        <>
          <div className={s.statsGrid}>
            <div className={s.statCard}>
              <span className={s.statLabel}>Avg Packet Size</span>
              <div>
                <span className={s.statValue}>{stats.averageSize}</span>
                <span className={s.statUnit}>bytes</span>
              </div>
            </div>
            <div className={s.statCard}>
              <span className={s.statLabel}>Size Std Dev</span>
              <div>
                <span className={s.statValue}>{stats.stdDevSize}</span>
                <span className={s.statUnit}>bytes</span>
              </div>
            </div>
            <div className={s.statCard}>
              <span className={s.statLabel}>Average Interval</span>
              <div>
                <span className={s.statValue}>{stats.averageInterval}</span>
                <span className={s.statUnit}>ms</span>
              </div>
            </div>
            <div className={s.statCard}>
              <span className={s.statLabel}>Jitter (proxy)</span>
              <div>
                <span className={s.statValue}>{stats.jitter}</span>
                <span className={s.statUnit}>ms</span>
              </div>
            </div>
          </div>

          <div className={s.chartsContainer}>
            
            <div className={s.chartCard}>
              <div className={s.chartTitle}>Packet Size vs Time</div>
              <ResponsiveContainer width="100%" height={300}>
                <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="timeSec" type="number" name="Time (s)" />
                  <YAxis dataKey="size" type="number" name="Size (bytes)" />
                  <ZAxis range={[20, 20]} />
                  <RechartsTooltip cursor={{strokeDasharray: '3 3'}} />
                  <Scatter name="Packets" data={timeData} fill="#3b82f6" opacity={0.6} />
                </ScatterChart>
              </ResponsiveContainer>
            </div>

            <div className={s.chartCard}>
              <div className={s.chartTitle}>Timing Intervals (Delay Jitter)</div>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={intervalData} margin={{ top: 10, right: 10, bottom: 10, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="packetNum" />
                  <YAxis />
                  <RechartsTooltip />
                  <Line type="monotone" dataKey="interval" stroke="#ef4444" dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className={s.chartCard}>
              <div className={s.chartTitle}>Size Histogram</div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={histogramData} margin={{ top: 10, right: 10, bottom: 10, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="range" />
                  <YAxis />
                  <RechartsTooltip />
                  <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className={s.chartCard}>
              <div className={s.chartTitle}>Flow Density (Packets / 250ms)</div>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={densityData} margin={{ top: 10, right: 10, bottom: 10, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="timeSec" />
                  <YAxis />
                  <RechartsTooltip />
                  <Area type="monotone" dataKey="packetsPerWindow" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

          </div>
        </>
      )}
    </div>
  );
};
