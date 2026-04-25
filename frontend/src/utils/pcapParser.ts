export interface PacketData {
  id: number;
  timestamp: number; // milliseconds since epoch
  size: number;
  protocol: 'UDP' | 'TCP' | 'TLS' | 'RTP' | 'Other';
  source: string;
  dest: string;
  interval: number; // ms delay from previous packet
}

export interface TrafficStats {
  averageSize: number;
  stdDevSize: number;
  averageInterval: number;
  jitter: number;
  totalPackets: number;
  durationMs: number;
}

export const parseWiresharkJson = (jsonData: any[]): PacketData[] => {
  const packets: PacketData[] = [];
  let prevTimestamp = 0;

  for (let i = 0; i < jsonData.length; i++) {
    const item = jsonData[i];
    const layers = item?._source?.layers;
    if (!layers) continue;

    const frame = layers.frame;
    if (!frame) continue;

    // Parse time and size
    const epochStr = frame['frame.time_epoch'];
    const sizeStr = frame['frame.len'];
    if (!epochStr || !sizeStr) continue;

    const timestamp = parseFloat(epochStr) * 1000;
    const size = parseInt(sizeStr, 10);

    // Parse interval
    let interval = 0;
    if (prevTimestamp > 0) {
      interval = timestamp - prevTimestamp;
    }
    prevTimestamp = timestamp;

    // Determine Protocol
    let protocol: PacketData['protocol'] = 'Other';
    const isUdp = !!layers.udp;
    const isTcp = !!layers.tcp;

    if (layers.rtp || layers.rtcp) {
      protocol = 'RTP';
    } else if (layers.tls || layers.dtls || (isUdp && layers.udp['udp.srcport'] === '443')) {
      protocol = 'TLS';
    } else if (isUdp) {
      protocol = 'UDP';
    } else if (isTcp) {
      protocol = 'TCP';
    }

    // Source and Dest
    let source = 'Unknown';
    let dest = 'Unknown';
    if (layers.ip) {
      source = layers.ip['ip.src'] || source;
      dest = layers.ip['ip.dst'] || dest;
    } else if (layers.ipv6) {
      source = layers.ipv6['ipv6.src'] || source;
      dest = layers.ipv6['ipv6.dst'] || dest;
    }

    packets.push({
      id: i + 1,
      timestamp,
      size,
      protocol,
      source,
      dest,
      interval,
    });
  }

  return packets;
};

// Extremely basic legacy `.pcap` parser for fallback
// Assumes standard Ethernet -> IPv4 -> UDP/TCP
export const parseRawPcap = (buffer: ArrayBuffer): PacketData[] => {
  const view = new DataView(buffer);
  if (buffer.byteLength < 24) return [];

  const magic = view.getUint32(0, true);
  const isLittleEndian = magic === 0xa1b2c3d4 || magic === 0xd4c3b2a1;
  const isNs = magic === 0xa1b23c4d || magic === 0x4d3cb2a1;

  if (
    magic !== 0xa1b2c3d4 && 
    magic !== 0xd4c3b2a1 && 
    magic !== 0xa1b23c4d && 
    magic !== 0x4d3cb2a1
  ) {
    throw new Error('Unsupported PCAP magic number (might be PCAPNG)');
  }

  const packets: PacketData[] = [];
  let offset = 24; // Skip global header
  let prevTimestamp = 0;
  let packetId = 1;

  while (offset + 16 < buffer.byteLength) {
    const tsSec = view.getUint32(offset, isLittleEndian);
    const tsUsec = view.getUint32(offset + 4, isLittleEndian);
    const inclLen = view.getUint32(offset + 8, isLittleEndian);
    const origLen = view.getUint32(offset + 12, isLittleEndian);

    offset += 16;
    if (offset + inclLen > buffer.byteLength) break;

    const timestamp = (tsSec * 1000) + (isNs ? tsUsec / 1000000 : tsUsec / 1000);
    const size = origLen;

    let interval = 0;
    if (prevTimestamp > 0) {
      interval = timestamp - prevTimestamp;
    }
    prevTimestamp = timestamp;

    let protocol: PacketData['protocol'] = 'Other';
    let source = 'Unknown';
    let dest = 'Unknown';

    // Very basic packet dissection (assumes Ethernet -> IPv4)
    if (inclLen >= 34) {
      // Check ethertype (IPv4 = 0x0800)
      const ethertype = view.getUint16(offset + 12, false);
      if (ethertype === 0x0800) {
        const ipOffset = offset + 14;
        const ipProtocol = view.getUint8(ipOffset + 9);
        
        source = [
          view.getUint8(ipOffset + 12),
          view.getUint8(ipOffset + 13),
          view.getUint8(ipOffset + 14),
          view.getUint8(ipOffset + 15)
        ].join('.');

        dest = [
          view.getUint8(ipOffset + 16),
          view.getUint8(ipOffset + 17),
          view.getUint8(ipOffset + 18),
          view.getUint8(ipOffset + 19)
        ].join('.');

        if (ipProtocol === 17) {
          protocol = 'UDP';
          // Basic heuristic for RTP/TLS based on ports (not robust!)
          if (inclLen >= 42) {
            const udpSrc = view.getUint16(ipOffset + 20, false);
            const udpDst = view.getUint16(ipOffset + 22, false);
            if (udpSrc === 443 || udpDst === 443) protocol = 'TLS';
          }
        } else if (ipProtocol === 6) {
          protocol = 'TCP';
        }
      }
    }

    packets.push({
      id: packetId++,
      timestamp,
      size,
      protocol,
      source,
      dest,
      interval
    });

    offset += inclLen;
  }

  return packets;
};

export const calculateTrafficStats = (packets: PacketData[]): TrafficStats => {
  if (packets.length === 0) {
    return {
      averageSize: 0,
      stdDevSize: 0,
      averageInterval: 0,
      jitter: 0,
      totalPackets: 0,
      durationMs: 0
    };
  }

  let totalSize = 0;
  let totalInterval = 0;
  
  packets.forEach(p => {
    totalSize += p.size;
    totalInterval += p.interval;
  });

  const avgSize = totalSize / packets.length;
  const avgInterval = totalInterval / packets.length;

  let sumSqDiffSize = 0;
  let sumSqDiffInterval = 0;

  packets.forEach(p => {
    sumSqDiffSize += Math.pow(p.size - avgSize, 2);
    sumSqDiffInterval += Math.pow(p.interval - avgInterval, 2);
  });

  const stdDevSize = Math.sqrt(sumSqDiffSize / packets.length);
  // Using interval variance as a proxy for Jitter in this simple calculation
  const jitter = Math.sqrt(sumSqDiffInterval / packets.length);

  const durationMs = packets[packets.length - 1].timestamp - packets[0].timestamp;

  return {
    averageSize: Math.round(avgSize),
    stdDevSize: Number(stdDevSize.toFixed(2)),
    averageInterval: Number(avgInterval.toFixed(2)),
    jitter: Number(jitter.toFixed(2)),
    totalPackets: packets.length,
    durationMs: Number(durationMs.toFixed(2))
  };
};
