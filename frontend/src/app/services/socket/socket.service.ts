import { Injectable, OnDestroy } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../environments/environment';
import { kdsStore } from '../../store/kds.store';

@Injectable({ providedIn: 'root' })
export class SocketService implements OnDestroy {
  private socket: Socket | null = null;

  connect(): void {
    if (this.socket?.connected) return;
    this.socket = io(environment.wsUrl, { withCredentials: true });
    this.socket.on('item:state_changed', ({ itemId, newState }: { itemId: string; newState: any }) => {
      kdsStore.updateItemState(itemId, newState);
    });
    this.socket.on('kds:new_item', (item: any) => {
      kdsStore.addItem(item);
    });
  }

  joinSession(sessionId: string): void {
    this.socket?.emit('pos:join', sessionId);
    this.socket?.emit('kds:join', sessionId);
  }

  leaveSession(sessionId: string): void {
    this.socket?.emit('pos:leave', sessionId);
  }

  emit(event: string, data: any): void {
    this.socket?.emit(event, data);
  }

  on(event: string, callback: (data: any) => void): void {
    this.socket?.on(event, callback);
  }

  off(event: string, callback?: (data: any) => void): void {
    if (callback) {
      this.socket?.off(event, callback);
    } else {
      this.socket?.off(event);
    }
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}
