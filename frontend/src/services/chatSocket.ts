import { io, Socket } from 'socket.io-client';

const getSocketUrl = () => {
  if (process.env.REACT_APP_SOCKET_URL) return process.env.REACT_APP_SOCKET_URL;
  const apiBaseRaw = process.env.REACT_APP_API_URL?.trim();
  if (apiBaseRaw && /^https?:\/\//i.test(apiBaseRaw)) {
    const normalized = apiBaseRaw.replace(/\/+$/, '');
    return normalized
      .replace(/\/api\/v1$/i, '')
      .replace(/\/api$/i, '');
  }
  if (typeof window !== 'undefined') return window.location.origin;
  return 'http://localhost:3000';
};

class ChatSocketService {
  private socket: Socket | null = null;

  connect(token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const socketUrl = getSocketUrl();
        this.socket = io(`${socketUrl}/chat`, {
          auth: { token },
          autoConnect: false,
          transports: ['websocket'],
          timeout: 10000,
          reconnection: true,
          reconnectionDelay: 2000,
          reconnectionAttempts: 5,
        });

        this.socket.on('connect', () => resolve());
        this.socket.on('connect_error', (err) => {
          this.socket?.disconnect();
          reject(err);
        });

        this.socket.connect();
      } catch (e) {
        reject(e);
      }
    });
  }

  disconnect() {
    this.socket?.removeAllListeners();
    this.socket?.disconnect();
    this.socket = null;
  }

  isConnected() {
    return Boolean(this.socket?.connected);
  }

  join(chatId: string) {
    this.socket?.emit('chat:join', { chatId });
  }

  leave(chatId: string) {
    this.socket?.emit('chat:leave', { chatId });
  }

  send(chatId: string, content: string) {
    this.socket?.emit('chat:send', { chatId, content });
  }

  typing(chatId: string, isTyping: boolean) {
    this.socket?.emit('chat:typing', { chatId, isTyping });
  }

  read(chatId: string, messageId: string) {
    this.socket?.emit('chat:read', { chatId, messageId });
  }

  onMessage(cb: (payload: { chatId: string; message: any }) => void) {
    this.socket?.on('chat:message', cb);
  }

  offMessage(cb?: (payload: { chatId: string; message: any }) => void) {
    if (!this.socket) return;
    if (cb) this.socket.off('chat:message', cb);
    else this.socket.off('chat:message');
  }

  onTyping(cb: (payload: { chatId: string; userId: string; isTyping: boolean }) => void) {
    this.socket?.on('chat:typing', cb);
  }

  offTyping(cb?: (payload: { chatId: string; userId: string; isTyping: boolean }) => void) {
    if (!this.socket) return;
    if (cb) this.socket.off('chat:typing', cb);
    else this.socket.off('chat:typing');
  }

  onRead(cb: (payload: { chatId: string; userId: string; messageId: string }) => void) {
    this.socket?.on('chat:read', cb);
  }

  offRead(cb?: (payload: { chatId: string; userId: string; messageId: string }) => void) {
    if (!this.socket) return;
    if (cb) this.socket.off('chat:read', cb);
    else this.socket.off('chat:read');
  }
}

const chatSocketService = new ChatSocketService();
export default chatSocketService;

