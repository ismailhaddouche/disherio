import { Injectable, inject } from '@angular/core';
import { SocketConnectionService } from './socket-connection.service';

@Injectable({ providedIn: 'root' })
export class KdsSocketService {
  private readonly connection = inject(SocketConnectionService);
  private currentKdsSessionIds = new Set<string>();

  constructor() {
    this.connection.registerReconnectHandler((socket) => {
      for (const sessionId of this.currentKdsSessionIds) {
        socket.emit('kds:join', sessionId);
      }
    });
  }

  joinKdsSession(sessionId: string): void {
    if (this.currentKdsSessionIds.has(sessionId)) return;
    this.currentKdsSessionIds.add(sessionId);
    if (!this.connection.isConnected()) {
      return;
    }
    this.connection.emit('kds:join', sessionId);
  }

  leaveKdsSession(sessionId: string): void {
    if (this.connection.isConnected()) this.connection.emit('kds:leave', sessionId);
    this.currentKdsSessionIds.delete(sessionId);
  }

  kdsItemPrepare(itemId: string): void {
    this.connection.emit('kds:item_prepare', { itemId });
  }

  kdsItemServe(itemId: string): void {
    this.connection.emit('kds:item_serve', { itemId });
  }
}
