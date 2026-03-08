import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'events';

export interface IncomingCallEvent {
  callId: string;
  callerId: string;
  calleeId: string;
  callerName?: string;
}

export interface CallEndedEvent {
  callId: string;
  callerId: string;
  calleeId: string;
  reason?: string;
  endedBy?: string;
}

@Injectable()
export class CallEventsService {
  private ee = new EventEmitter();

  emitIncoming(event: IncomingCallEvent) {
    this.ee.emit('incoming', event);
  }

  onIncoming(cb: (e: IncomingCallEvent) => void) {
    this.ee.on('incoming', cb);
  }

  emitRejected(event: { callId: string; callerId: string; calleeId: string }) {
    this.ee.emit('rejected', event);
  }

  onRejected(cb: (e: { callId: string; callerId: string; calleeId: string }) => void) {
    this.ee.on('rejected', cb);
  }

  emitEnded(event: CallEndedEvent) {
    this.ee.emit('ended', event);
  }

  onEnded(cb: (e: CallEndedEvent) => void) {
    this.ee.on('ended', cb);
  }
}
