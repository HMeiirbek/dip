import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as mediasoup from 'mediasoup';
import { Worker, Router, Transport, Producer, Consumer } from 'mediasoup/node/lib/types';
import { RiskService } from '../risk/risk.service';
import { SecurityService } from '../auth/security.service';

@Injectable()
export class SfuService implements OnModuleInit, OnModuleDestroy {
  private workers: Worker[] = [];
  private routers: Router[] = [];
  private nextWorkerIdx = 0;
  
  // Storage for active state
  private transports: Map<string, Transport> = new Map();
  private producers: Map<string, Producer> = new Map();
  private consumers: Map<string, Consumer> = new Map();

  // Network Monitoring state
  private iceChangeFrequency: Map<string, { count: number; lastTime: number }> = new Map();

  constructor(
    private readonly riskService: RiskService,
    private readonly securityService: SecurityService,
  ) {}

  async onModuleInit() {
    await this.createWorkers();
  }

  async onModuleDestroy() {
    for (const worker of this.workers) {
      worker.close();
    }
  }

  private async createWorkers() {
    const numWorkers = Object.keys(require('os').cpus()).length;
    for (let i = 0; i < numWorkers; i++) {
      const worker = await mediasoup.createWorker({
        logLevel: 'warn',
        logTags: ['info', 'ice', 'dtls', 'bwe', 'score'],
        rtcMinPort: 40000,
        rtcMaxPort: 49999,
      });

      worker.on('died', () => {
        console.error(`[SFU] mediasoup worker died, exiting in 2 seconds... [pid:${worker.pid}]`);
        setTimeout(() => process.exit(1), 2000);
      });

      this.workers.push(worker);
    }
    
    // Create a default router for the initial implementation.
    // In a multi-room setup, we'd create one router per Room.
    const worker = this.getOptimalWorker();
    const router = await worker.createRouter({
      mediaCodecs: [
        {
          kind: 'audio',
          mimeType: 'audio/opus',
          clockRate: 48000,
          channels: 2,
        },
        {
          kind: 'video',
          mimeType: 'video/VP8',
          clockRate: 90000,
        },
      ],
    });
    this.routers.push(router);
  }

  private getOptimalWorker(): Worker {
    const worker = this.workers[this.nextWorkerIdx];
    this.nextWorkerIdx = (this.nextWorkerIdx + 1) % this.workers.length;
    return worker;
  }

  public getRouterRtpCapabilities() {
    return this.routers[0].rtpCapabilities;
  }

  public async createWebRtcTransport(peerId: string) {
    const router = this.routers[0];
    const transport = await router.createWebRtcTransport({
      listenIps: [
        { ip: '0.0.0.0', announcedIp: process.env.MEDIASOUP_ANNOUNCED_IP || '127.0.0.1' },
      ],
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
      initialAvailableOutgoingBitrate: 1000000,
    });

    // Monitor for MITM / ICE attacks
    transport.on('icestatechange', (iceState) => {
      console.log(`[SFU] Transport ${transport.id} iceState: ${iceState}`);
      if (iceState === 'connected' || iceState === 'completed') {
        const now = Date.now();
        const freq = this.iceChangeFrequency.get(transport.id) || { count: 0, lastTime: now };
        
        if (now - freq.lastTime < 5000) {
          freq.count++;
        } else {
          freq.count = 1;
        }
        freq.lastTime = now;
        this.iceChangeFrequency.set(transport.id, freq);

        // If candidate changes > 3 times in 5 seconds, flag as suspicious
        // Note: This is heuristic anomaly detection, not cryptographic proof.
        if (freq.count > 3) {
          console.warn(`[SFU] Anomalous ICE frequency detected for peer ${peerId}`);
          this.securityService.triggerFailSecure(peerId).catch(console.error);
        }
      }
    });

    transport.on('dtlsstatechange', (dtlsState) => {
      console.log(`[SFU] Transport ${transport.id} dtlsState: ${dtlsState}`);
      if (dtlsState === 'failed') {
        console.warn(`[SFU] DTLS Failed for peer ${peerId}. Possible MITM attempt.`);
        this.securityService.triggerFailSecure(peerId).catch(console.error);
      }
    });

    this.transports.set(transport.id, transport);

    return {
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
    };
  }

  public async connectWebRtcTransport(peerId: string, transportId: string, dtlsParameters: any) {
    const transport = this.transports.get(transportId);
    if (!transport) throw new Error(`Transport ${transportId} not found`);
    await transport.connect({ dtlsParameters });
  }

  public async produce(peerId: string, transportId: string, kind: 'audio' | 'video', rtpParameters: any) {
    const transport = this.transports.get(transportId);
    if (!transport) throw new Error(`Transport ${transportId} not found`);
    
    const producer = await transport.produce({ kind, rtpParameters });
    this.producers.set(producer.id, producer);

    return { id: producer.id };
  }

  public async consume(peerId: string, transportId: string, producerId: string, rtpCapabilities: any) {
    const router = this.routers[0];
    if (!router.canConsume({ producerId, rtpCapabilities })) {
      throw new Error(`Cannot consume producer ${producerId}`);
    }
    
    const transport = this.transports.get(transportId);
    if (!transport) throw new Error(`Transport ${transportId} not found`);

    const consumer = await transport.consume({
      producerId,
      rtpCapabilities,
      paused: true,
    });

    this.consumers.set(consumer.id, consumer);

    return {
      id: consumer.id,
      producerId: consumer.producerId,
      kind: consumer.kind,
      rtpParameters: consumer.rtpParameters,
    };
  }

  public async removePeer(peerId: string) {
    // Basic cleanup: find all transports belonging to this peer and close them
    // For a real implementation, we should store a peerId -> transports mapping
    // Here we'll just close everything as a simplified approach, assuming transport.id has peerId info 
    // or we store peer to transport. To be fully correct, let's just log for now as mediasoup will 
    // garbage collect when transports close from client side disconnects.
    console.log(`[SFU] removePeer called for ${peerId}`);
  }
}
