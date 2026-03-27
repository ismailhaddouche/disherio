import { Injectable, OnDestroy, inject } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../environments/environment';
import { kdsStore } from '../../store/kds.store';
import { authStore } from '../../store/auth.store';

@Injectable({ providedIn: 'root' })
export class SocketService implements OnDestroy {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;
  private reconnectTimer: any = null;

  connect(): void {
    if (this.socket?.connected) return;
    
    try {
      this.socket = io(environment.wsUrl, { 
        withCredentials: true,
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
      });

      // Connection events
      this.socket.on('connect', () => {
        console.log('Socket connected');
        this.reconnectAttempts = 0;
      });

      this.socket.on('connect_error', (err) => {
        console.error('Socket connection error:', err.message);
        this.reconnectAttempts++;
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          console.error('Max reconnection attempts reached');
          this.socket?.disconnect();
        }
      });

      this.socket.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason);
        if (reason === 'io server disconnect') {
          // Server initiated disconnect, try to reconnect
          this.socket?.connect();
        }
      });

      this.socket.on('error', (err) => {
        console.error('Socket error:', err);
      });

      // Application events
      this.socket.on('item:state_changed', ({ itemId, newState }: { itemId: string; newState: any }) => {
        kdsStore.updateItemState(itemId, newState);
      });
      
      this.socket.on('kds:new_item', (item: any) => {
        kdsStore.addItem(item);
      });

      this.socket.on('item:deleted', ({ itemId }: { itemId: string }) => {
        kdsStore.removeItem(itemId);
      });

    } catch (err) {
      console.error('Failed to initialize socket:', err);
    }
  }

  joinSession(sessionId: string): void {
    if (!this.socket?.connected) {
      console.warn('Cannot join session: socket not connected');
      return;
    }
    this.socket.emit('pos:join', sessionId);
    this.socket.emit('kds:join', sessionId);
  }

  leaveSession(sessionId: string): void {
    if (!this.socket?.connected) return;
    this.socket.emit('pos:leave', sessionId);
  }

  emit(event: string, data: any): boolean {
    if (!this.socket?.connected) {
      console.warn(`Cannot emit ${event}: socket not connected`);
      return false;
    }
    this.socket.emit(event, data);
    return true;
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
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.socket?.disconnect();
    this.socket = null;
    this.reconnectAttempts = 0;
  }

  ngOnDestroy(): void {
    this.disconnect();
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}
