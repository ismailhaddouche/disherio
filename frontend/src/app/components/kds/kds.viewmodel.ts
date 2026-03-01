import { Injectable, signal, computed, inject } from '@angular/core';
import { CommunicationService } from '../../services/communication.service';
import { AuthService } from '../../services/auth.service';
import { environment } from '../../../environments/environment';

export interface KDSOrder {
    _id: string;
    tableNumber: string;
    totemId?: number;
    items: any[];
    status: string;
    createdAt: string;
    timeElapsed?: number;
}

@Injectable()
export class KDSViewModel {
    private comms = inject(CommunicationService);
    private auth = inject(AuthService);

    // State
    public orders = signal<KDSOrder[]>([]);
    public productList = signal<any[]>([]);
    public totems = signal<any[]>([]); // Totem names
    public loading = signal<boolean>(true);
    public error = signal<string | null>(null); // PM FIX: Added error state
    public showStockManager = signal<boolean>(false);
    public currentFilter = signal<'pending' | 'preparing' | 'ready'>('pending');
    public localConfig = signal<any>(null); // Local printer settings

    // Computed: Filtered orders for the kitchen
    public filteredOrders = computed(() => {
        return this.orders()
            .filter(order => order.status === 'active') // Only active sessions
            .map(order => ({
                ...order,
                // Filter items that belong to the "Kitchen" station and are not "served" or "ready"
                kitchenItems: order.items.filter(item =>
                    item.status !== 'ready' &&
                    item.status !== 'served' &&
                    item.status !== 'completed'
                )
            }))
            .filter(order => order.kitchenItems.length > 0)
            .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    });

    constructor() {
        this.initKDS();
        this.setupRealTime();
        this.loadLocalConfig();

        // Timer to update "time elapsed" ogni minuto
        setInterval(() => {
            this.orders.update(orders => [...orders]);
        }, 60000);
    }

    private loadLocalConfig() {
        const saved = localStorage.getItem('disher_local_config');
        if (saved) {
            try {
                this.localConfig.set(JSON.parse(saved));
            } catch (e) { console.error('Error loading local config', e); }
        }
    }

    private async initKDS() {
        this.loading.set(true);
        this.error.set(null);

        try {
            const [orders, products, totems]: any = await Promise.all([
                this.comms.syncOrders(),
                fetch(`${environment.apiUrl}/api/menu`).then(res => res.json()),
                fetch(`${environment.apiUrl}/api/restaurants/totems`).then(res => res.json())
            ]);

            if (orders) this.orders.set(orders);
            if (products) this.productList.set(products);
            if (totems) this.totems.set(totems);
        } catch (e: any) {
            console.error('KDS Init Error', e);
            this.error.set(e.message || 'Error al conectar con la cocina');
        } finally {
            this.loading.set(false);
        }
    }

    private setupRealTime() {
        this.comms.subscribeToOrders((updatedOrder: KDSOrder) => {
            this.orders.update(prev => {
                const index = prev.findIndex(o => o._id === updatedOrder._id);
                if (index !== -1) {
                    const newOrders = [...prev];
                    newOrders[index] = updatedOrder;
                    return newOrders;
                }
                return [updatedOrder, ...prev];
            });
        });
    }

    public getTimeDiff(createdAt: string): string {
        const diff = Math.floor((new Date().getTime() - new Date(createdAt).getTime()) / 60000);
        return `${diff}m`;
    }

    public async updateItemStatus(orderId: string, itemId: string, nextStatus: string, print: boolean = false) {
        try {
            const res = await fetch(`${environment.apiUrl}/api/orders/${orderId}/items/${itemId}`, {
                method: 'PATCH',
                headers: this.auth.getHeaders(),
                body: JSON.stringify({ status: nextStatus })
            });

            if (res.ok && print && nextStatus === 'ready') {
                const order = this.orders().find(o => o._id === orderId);
                const item = order?.items.find((i: any) => (i._id || i.id) === itemId);
                if (order && item) {
                    this.printItemTicket(order, item);
                }
            }

            this.auth.logActivity('ITEM_STATUS_CHANGED', { orderId, itemId, nextStatus });
        } catch (e) {
            console.error('Error updating status', e);
            alert('No se pudo actualizar el plato. Verifica la conexión.');
        }
    }

    public printItemTicket(order: any, item: any) {
        const p = this.localConfig()?.printer;
        const totem = this.totems().find(t => t.id === (order.totemId || parseInt(order.tableNumber)));
        const tableName = totem?.name || `Mesa ${order.tableNumber}`;

        let details = '';
        if (item.selectedVariant) details += `\\n - ${item.selectedVariant.name}`;
        if (item.selectedAddons?.length) {
            item.selectedAddons.forEach((a: any) => details += `\\n + ${a.name}`);
        }

        const msg = `🖨️ (COVICA) EXPENDIENDO VALE DE SERVICIO\\n----------------------\\nPLATO: ${item.name}${details}\\nCANT: ${item.quantity}\\nORIGEN: ${tableName}\\n----------------------`;

        if (p?.type === 'thermal') {
            alert(`🖨️ (Térmica ${p.ip})\\n${msg}`);
        } else {
            alert(`🖨️ (Sistema)\\n${msg}`);
            // window.print() is logic for whole page, for item ticket we'd need a hidden iframe usually
            // but for this MVP, alert simulation is enough as agreed.
        }
    }

    public async cancelItem(orderId: string, itemId: string) {
        if (!confirm('¿Seguro que quieres CANCELAR este plato?')) return;

        try {
            await fetch(`${environment.apiUrl}/api/orders/${orderId}/items/${itemId}`, {
                method: 'PATCH',
                headers: this.auth.getHeaders(),
                body: JSON.stringify({ status: 'cancelled' })
            });

            this.auth.logActivity('ITEM_CANCELLED', { orderId, itemId });
        } catch (e) {
            console.error('Error cancelling item', e);
            alert('No se pudo cancelar el plato.');
        }
    }

    public async toggleProduct(productId: string) {
        try {
            const res = await fetch(`${environment.apiUrl}/api/menu/${productId}/toggle`, {
                method: 'POST',
                headers: this.auth.getHeaders()
            });
            const updated = await res.json();

            this.productList.update(list =>
                list.map(p => p._id === productId ? updated : p)
            );

            this.auth.logActivity('PRODUCT_STOCK_TOGGLED', {
                productId,
                name: updated.name,
                available: updated.available
            });
        } catch (e) {
            console.error('Error toggling product', e);
        }
    }
}
