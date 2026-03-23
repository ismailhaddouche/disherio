import { Injectable, signal } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { HttpClient, HttpContext } from '@angular/common/http';
import { Subject, lastValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { SOCKET_EVENTS, STORAGE_KEYS, GUEST_SENTINEL } from '../core/constants';
import { SILENT_REQUEST } from '../interceptors/http-context';

@Injectable({
    providedIn: 'root'
})
export class CommunicationService {
    private socket: Socket;

    // Signals for state management
    public isOnline = signal<boolean>(navigator.onLine);
    public connectionStatus = signal<'connected' | 'disconnected' | 'reconnecting'>('disconnected');
    public conflictDetected$ = new Subject<void>();
    public userId = signal<string>(this.getOrCreateUserId());
    public userName = signal<string>(localStorage.getItem(STORAGE_KEYS.USER_NAME) || GUEST_SENTINEL);

    private getOrCreateUserId(): string {
        let id = window.localStorage.getItem(STORAGE_KEYS.USER_ID);
        if (!id) {
            id = 'user_' + crypto.randomUUID();
            window.localStorage.setItem(STORAGE_KEYS.USER_ID, id);
        }
        return id;
    }

    public setUserName(name: string) {
        this.userName.set(name);
        localStorage.setItem(STORAGE_KEYS.USER_NAME, name);
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
        this.socket.on(SOCKET_EVENTS.ORDER_UPDATE, callback);
        this.socket.on(SOCKET_EVENTS.ORDER_UPDATED, callback);
    }

    public unsubscribeFromOrders(callback: (data: any) => void) {
        this.socket.off(SOCKET_EVENTS.ORDER_UPDATE, callback);
        this.socket.off(SOCKET_EVENTS.ORDER_UPDATED, callback);
    }

    public subscribeToMenu(callback: (data: any) => void) {
        this.socket.on(SOCKET_EVENTS.MENU_UPDATE, callback);
    }

    public unsubscribeFromMenu(callback: (data: any) => void) {
        this.socket.off(SOCKET_EVENTS.MENU_UPDATE, callback);
    }

    public subscribeToConfig(callback: (data: any) => void) {
        this.socket.on(SOCKET_EVENTS.CONFIG_UPDATED, callback);
    }

    public unsubscribeFromConfig(callback: (data: any) => void) {
        this.socket.off(SOCKET_EVENTS.CONFIG_UPDATED, callback);
    }

    public subscribeToSessionEnd(callback: (data: any) => void) {
        this.socket.on(SOCKET_EVENTS.SESSION_ENDED, callback);
    }

    public unsubscribeFromSessionEnd(callback: (data: any) => void) {
        this.socket.off(SOCKET_EVENTS.SESSION_ENDED, callback);
    }

    public subscribeToSystemReset(callback: (data: any) => void) {
        this.socket.on(SOCKET_EVENTS.ALL_SESSIONS_ENDED, callback);
    }

    public unsubscribeFromSystemReset(callback: (data: any) => void) {
        this.socket.off(SOCKET_EVENTS.ALL_SESSIONS_ENDED, callback);
    }

    // --- API CALLS ---

    public async syncOrders() {
        if (!this.isOnline()) {
            console.warn('[SYNC] Offline mode: Sync postponed');
            return null;
        }

        try {
            console.log('[SYNC] Starting background order sync...');
            const ctx = new HttpContext().set(SILENT_REQUEST, true);
            const orders = await lastValueFrom(
                this.http.get<any[]>(`${environment.apiUrl}/api/orders`, { context: ctx })
            );
            console.log('[SYNC] Successfully synchronized', orders?.length || 0, 'orders.');
            return orders;
        } catch (error) {
            console.error('[SYNC] Failed to sync orders:', error);
            return null;
        }
    }

    public async sendOrder(order: any) {
        if (this.isOnline()) {
            try {
                return await lastValueFrom(this.http.post(`${environment.apiUrl}/api/orders`, order));
            } catch (error: any) {
                if (error.status === 409) {
                    this.conflictDetected$.next();
                }
                throw error;
            }
        } else {
            console.log('Order saved locally for later sync');
            return null;
        }
    }

    public reportConflict() {
        this.conflictDetected$.next();
    }
}
