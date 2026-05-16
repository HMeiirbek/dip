import { Device } from 'mediasoup-client';
import socketService from './socket';

type EventCallback = (...args: any[]) => void;

class SfuClientService {
  private device: Device | null = null;
  private sendTransport: any = null;
  private recvTransport: any = null;
  
  // Event emitter for React hooks
  private listeners: Record<string, EventCallback[]> = {};
  public remoteStreams = new Map<string, MediaStream>();

  public on(event: string, callback: EventCallback) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
  }

  public off(event: string, callback: EventCallback) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
  }

  private emit(event: string, ...args: any[]) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(cb => cb(...args));
    }
  }

  public async joinRoom(roomId: string) {
    // 0. Join Socket Room
    await this.request('joinRoom', { roomId });

    // 1. Get Router RTP Capabilities
    const routerRtpCapabilities = await this.request('getRouterRtpCapabilities', { roomId });
    
    // 2. Initialize Device
    this.device = new Device();
    await this.device.load({ routerRtpCapabilities });

    // 3. Create Send Transport
    const sendTransportInfo = await this.request('createWebRtcTransport', { forceTcp: false });
    this.sendTransport = this.device.createSendTransport(sendTransportInfo);

    this.sendTransport.on('connect', ({ dtlsParameters }: any, callback: any, errback: any) => {
      this.request('connectWebRtcTransport', {
        transportId: this.sendTransport.id,
        dtlsParameters
      }).then(callback).catch(errback);
    });

    this.sendTransport.on('produce', async (parameters: any, callback: any, errback: any) => {
      try {
        const { id } = await this.request('produce', {
          transportId: this.sendTransport.id,
          kind: parameters.kind,
          rtpParameters: parameters.rtpParameters,
          appData: parameters.appData
        });
        callback({ id });
      } catch (error) {
        errback(error);
      }
    });

    // 4. Create Receive Transport
    const recvTransportInfo = await this.request('createWebRtcTransport', { forceTcp: false });
    this.recvTransport = this.device.createRecvTransport(recvTransportInfo);

    this.recvTransport.on('connect', ({ dtlsParameters }: any, callback: any, errback: any) => {
      this.request('connectWebRtcTransport', {
        transportId: this.recvTransport.id,
        dtlsParameters
      }).then(callback).catch(errback);
    });

    // 5. Listen for new producers in the room
    socketService.onNewProducer(async ({ producerId, peerId, kind }) => {
      console.log(`[SFU] New producer from ${peerId}: ${producerId} (${kind})`);
      await this.consume(producerId, peerId);
    });
  }

  public async produce(track: MediaStreamTrack) {
    if (!this.sendTransport) throw new Error('Send transport not initialized');
    const producer = await this.sendTransport.produce({ track });
    return producer;
  }

  public async consume(producerId: string, peerId: string) {
    if (!this.recvTransport || !this.device) throw new Error('Recv transport not initialized');
    const { id, kind, rtpParameters } = await this.request('consume', {
      transportId: this.recvTransport.id,
      producerId,
      rtpCapabilities: this.device.rtpCapabilities
    });

    const consumer = await this.recvTransport.consume({
      id,
      producerId,
      kind,
      rtpParameters
    });

    // Store the remote stream
    const stream = new MediaStream([consumer.track]);
    this.remoteStreams.set(peerId, stream);
    this.emit('streamAdded', peerId, stream);

    return consumer;
  }

  public destroy() {
    if (this.sendTransport) this.sendTransport.close();
    if (this.recvTransport) this.recvTransport.close();
    if (this.device) this.device = null;
    this.remoteStreams.clear();
    socketService.offNewProducer();
  }

  private request(type: string, data: any): Promise<any> {
    return socketService.request(type, data);
  }
}

export const sfuClient = new SfuClientService();
