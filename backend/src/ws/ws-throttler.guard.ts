import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerException, ThrottlerGuard } from '@nestjs/throttler';
import { Socket } from 'socket.io';

@Injectable()
export class WsThrottlerGuard extends ThrottlerGuard {
  protected async handleRequest(requestProps: any): Promise<boolean> {
    const { context, limit, ttl, throttler } = requestProps;
    
    // Safety check for HTTP context fallback
    if (context.getType() !== 'ws') {
      return super.handleRequest(requestProps);
    }

    const client: Socket = context.switchToWs().getClient();
    const message = context.switchToWs().getPattern();

    // Whitelist WebRTC signaling - high frequency packets must not be dropped
    if (typeof message === 'string' && (message.startsWith('webrtc:') || message.startsWith('call:'))) {
      return true;
    }

    const ip = client.conn?.remoteAddress || client.request?.connection?.remoteAddress || 'unknown-ip';
    const key = this.generateKey(context, ip, throttler.name || 'default');
    
    const { totalHits } = await this.storageService.increment(key, ttl, limit, throttler.blockDuration || ttl, throttler.name || 'default');

    if (totalHits > limit) {
      client.emit('error', { message: 'Rate limit exceeded' });
      throw new ThrottlerException('Rate limit exceeded');
    }

    return true;
  }
}
