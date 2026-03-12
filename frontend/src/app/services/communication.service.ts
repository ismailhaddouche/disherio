import { Injectable, signal } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { lastValueFrom } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class CommunicationService {
    private socket: Socket;

    // Signals for state management
    public isOnline = signal<boolean>(navigator.onLine);
    public connectionStatus = signal<'connected' | 'disconnected' | 'reconnecting'>('disconnected');
    public userId = signal<string>(this.getOrCreateUserId());
    public userName = signal<string>(localStorage.getItem('disher_user_name') || 'Comensal');

    private getOrCreateUserId(): string {
        let idArr = window.localStorage.getItem('disher_user_id');
        if (!idArr) {
            idArr = 'user_' + Math.random().toString(36).substr(2, 9);
            window.localStorage.setItem('disher_user_id', idArr);
        }
        return idArr;
    }

    public setUserName(name: string) {
        this.userName.set(name);
        localStorage.setItem('disher_user_name', name);
    }

    constructor(private http: HttpClient) {
        // Initialize Socket.io
        // When apiUrl is empty (production), use undefined so Socket.io connects to current origin
        const socketUrl = environment.apiUrl || undefined;
        this.socket = io(socketUrl, {
            autoConnect: true,
            reconnection: true,
            withCredentials: true // Send httpOnly cookie with Socket.io handshake
        });

        this.setupSocketListeners();
        this.setupOnlineListeners();
    }

    private setupSocketListeners() {
        this.socket.on('connect', () => {
            console.log('[SOCKET] Connected. Syncing state...');
            this.connectionStatus.set('connected');
            // Al reconectar, forzar una sincronización para no perder estados intermedios
            this.syncOrders();
        });

        this.socket.on('disconnect', (reason) => {
            console.log('[SOCKET] Disconnected:', reason);
            this.connectionStatus.set('disconnected');
        });

        this.socket.on('reconnect_attempt', () => {
            this.connectionStatus.set('reconnecting');
        });

        this.socket.on('reconnect_failed', () => {
            console.error('[SOCKET] Reconnection failed. Please check network.');
        });
    }

    private setupOnlineListeners() {
        window.addEventListener('online', () => this.isOnline.set(true));
        window.addEventListener('offline', () => this.isOnline.set(false));
    }

    // --- SUBSCRIPTIONS ---

    public subscribeToOrders(callback: (data: any) => void) {
        this.socket.on('order-update', callback);
        this.socket.on('order-updated', callback);
    }

    public subscribeToMenu(callback: (data: any) => void) {
        this.socket.on('menu-update', callback);
    }

    public subscribeToConfig(callback: (data: any) => void) {
        this.socket.on('config-updated', callback);
    }

    public subscribeToSessionEnd(callback: (data: any) => void) {
        this.socket.on('session-ended', callback);
    }

    public subscribeToSystemReset(callback: (data: any) => void) {
        this.socket.on('all-sessions-ended', callback);
    }

    // --- API CALLS ---

    public async syncOrders() {
        if (!this.isOnline()) {
            console.warn('[SYNC] Offline mode: Sync postponed');
            return null;
        }

        try {
            console.log('[SYNC] Starting background order sync...');
            const orders = await lastValueFrom(this.http.get<any[]>(`${environment.apiUrl}/api/orders`));
            console.log('[SYNC] Successfully synchronized', orders?.length || 0, 'orders.');
            return orders;
        } catch (error) {
            console.error('[SYNC] Failed to sync orders:', error);
            return null;
        }
    }

    public async sendOrder(order: any) {
        if (this.isOnline()) {
            return lastValueFrom(this.http.post(`${environment.apiUrl}/api/orders`, order));
        } else {
            console.log('Order saved locally for later sync');
            return null;
        }
    }
}
