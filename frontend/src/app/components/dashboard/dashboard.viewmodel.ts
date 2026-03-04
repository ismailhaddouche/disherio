import { Injectable, signal, computed, inject } from '@angular/core';
import { CommunicationService } from '../../services/communication.service';
import { AuthService } from '../../services/auth.service';
import { environment } from '../../../environments/environment';

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

    constructor() {
        this.loadInitialData();
        this.setupRealTimeListeners();
    }

    private async loadInitialData() {
        this.loading.set(true);
        this.error.set(null);

        try {
            const [orders, logs, totems]: any[] = await Promise.all([
                this.comms.syncOrders(),
                fetch(`${environment.apiUrl}/api/logs`).then(res => res.json()),
                fetch(`${environment.apiUrl}/api/totems`).then(res => res.json())
            ]);

            if (orders) this.orders.set(orders);
            if (logs) this.logs.set(logs);
            if (totems) this.totems.set(totems);

        } catch (error: any) {
            console.error('Error loading dashboard data', error);
            this.error.set(error.message || 'Error al conectar con el servidor');
        } finally {
            this.loading.set(false);
        }
    }

    private setupRealTimeListeners() {
        this.comms.subscribeToOrders((updatedOrder: Order) => {
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
        });
    }

    public async addTotem(name: string) {
        if (!name) return;
        try {
            const res = await fetch(`${environment.apiUrl}/api/totems`, {
                method: 'POST',
                headers: this.auth.getHeaders(),
                body: JSON.stringify({ name })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Error adding totem');

            this.totems.update(curr => [...curr, data]);
            this.auth.logActivity('TOTEM_ADDED', { totemId: data.id, name });
        } catch (e: any) {
            alert(e.message);
        }
    }

    public async updateTotem(id: number, newName: string) {
        if (!newName) return;
        try {
            const res = await fetch(`${environment.apiUrl}/api/totems/${id}`, {
                method: 'PATCH',
                headers: this.auth.getHeaders(),
                body: JSON.stringify({ name: newName })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Error updating totem');

            this.totems.update(curr => curr.map(t => t.id === id ? data : t));
            this.auth.logActivity('TOTEM_UPDATED', { totemId: id, name: newName });
            this.editingTotem.set(null);
        } catch (e: any) {
            alert(e.message);
        }
    }

    public async deleteTotem(id: number) {
        if (!confirm('¿Estás seguro de eliminar este tótem? Se perderá el acceso por QR actual.')) return;
        try {
            const res = await fetch(`${environment.apiUrl}/api/totems/${id}`, {
                method: 'DELETE',
                headers: this.auth.getHeaders()
            });
            if (!res.ok) throw new Error('Error deleting totem');

            this.totems.update(curr => curr.filter(t => t.id !== id));
            this.auth.logActivity('TOTEM_DELETED', { totemId: id });
        } catch (e: any) {
            alert(e.message);
        }
    }

    public async completeOrder(orderId: string) {
        try {
            this.auth.logActivity('ORDER_COMPLETED', { orderId });
            await fetch(`${environment.apiUrl}/api/orders/${orderId}/complete`, {
                method: 'POST',
                headers: this.auth.getHeaders()
            });
            // The real-time listener will update the list
        } catch (e) {
            this.error.set('No se pudo completar el pedido.');
        }
    }
}
