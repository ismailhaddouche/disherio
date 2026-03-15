import { Injectable, signal, computed, inject, DestroyRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { CommunicationService } from '../../services/communication.service';
import { AuthService } from '../../services/auth.service';
import { environment } from '../../../environments/environment';
import { TranslateService } from '@ngx-translate/core';
import { NotifyService } from '../../services/notify.service';

export interface Order {
    _id: string;
    tableNumber: string;
    totemId?: number;
    items: any[];
    totalAmount: number;
    status: 'active' | 'completed' | 'cancelled';
    createdAt: string;
}

@Injectable()
export class DashboardViewModel {
    private comms = inject(CommunicationService);
    private auth = inject(AuthService);
    private http = inject(HttpClient);
    private translate = inject(TranslateService);
    private notify = inject(NotifyService);
    private destroyRef = inject(DestroyRef);

    // State using Signals
    public orders = signal<Order[]>([]);
    public totems = signal<any[]>([]);
    public logs = signal<any[]>([]);
    public loading = signal<boolean>(false);
    public error = signal<string | null>(null);

    // Editing State
    public editingTotem = signal<any | null>(null);

    // Computed values
    public activeOrdersCount = computed(() =>
        this.orders().filter(o => o.status === 'active').length
    );

    public dailyRevenue = computed(() =>
        this.orders()
            .filter(o => o.status === 'completed')
            .reduce((acc, current) => acc + (current.totalAmount || 0), 0)
    );

    private ordersCallback = (updatedOrder: Order) => {
        this.orders.update(prev => {
            const index = prev.findIndex(o => o._id === updatedOrder._id);
            if (index !== -1) {
                const newOrders = [...prev];
                newOrders[index] = updatedOrder;
                return newOrders;
            } else {
                return [updatedOrder, ...prev];
            }
        });
    };

    constructor() {
        this.setupRealTimeListeners();
        this.destroyRef.onDestroy(() => {
            this.comms.unsubscribeFromOrders(this.ordersCallback);
        });
    }

    public async loadInitialData() {
        if (this.loading()) return;
        this.loading.set(true);
        this.error.set(null);

        try {
            const [orders, logs, totems]: any[] = await Promise.all([
                this.comms.syncOrders(),
                firstValueFrom(this.http.get<any[]>(`${environment.apiUrl}/api/logs`)),
                firstValueFrom(this.http.get<any[]>(`${environment.apiUrl}/api/totems`))
            ]);

            if (orders) this.orders.set(orders);
            if (logs) this.logs.set(logs);
            if (totems) this.totems.set(totems);

        } catch (error: any) {
            console.error('Error loading dashboard data', error);
            this.error.set(this.translate.instant('DASHBOARD.ERROR_CONN'));
        } finally {
            this.loading.set(false);
        }
    }

    private setupRealTimeListeners() {
        this.comms.subscribeToOrders(this.ordersCallback);
    }

    public async addTotem(name: string) {
        if (!name) return;
        try {
            const data = await firstValueFrom(this.http.post<any>(`${environment.apiUrl}/api/totems`, { name }, { withCredentials: true }));

            this.totems.update(curr => [...curr, data]);
            this.auth.logActivity('TOTEM_ADDED', { totemId: data.id, name });
        } catch (e: any) {
            console.error('Error adding totem', e);
            this.notify.errorKey('DASHBOARD.TOTEM_ADD_ERROR');
        }
    }

    public async updateTotem(id: number, newName: string) {
        if (!newName) return;
        try {
            const data = await firstValueFrom(this.http.patch<any>(`${environment.apiUrl}/api/totems/${id}`, { name: newName }, { withCredentials: true }));

            this.totems.update(curr => curr.map(t => t.id === id ? data : t));
            this.auth.logActivity('TOTEM_UPDATED', { totemId: id, name: newName });
            this.editingTotem.set(null);
        } catch (e: any) {
            console.error('Error updating totem', e);
            this.notify.errorKey('DASHBOARD.TOTEM_UPDATE_ERROR');
        }
    }

    public async deleteTotem(id: number) {
        if (!confirm(this.translate.instant('DASHBOARD.DELETE_TOTEM_CONFIRM'))) return;
        try {
            await firstValueFrom(this.http.delete(`${environment.apiUrl}/api/totems/${id}`, { withCredentials: true }));

            this.totems.update(curr => curr.filter(t => t.id !== id));
            this.auth.logActivity('TOTEM_DELETED', { totemId: id });
        } catch (e: any) {
            console.error('Error deleting totem', e);
            this.notify.errorKey('DASHBOARD.TOTEM_DELETE_ERROR');
        }
    }

    public async completeOrder(orderId: string) {
        try {
            this.auth.logActivity('ORDER_COMPLETED', { orderId });
            await firstValueFrom(this.http.post(`${environment.apiUrl}/api/orders/${orderId}/complete`, {}, { withCredentials: true }));
            // The real-time listener will update the list
        } catch (e) {
            console.error('Error completing order', e);
            const message = this.translate.instant('DASHBOARD.COMPLETE_ERROR');
            this.error.set(message);
            this.notify.error(message);
        }
    }
}
