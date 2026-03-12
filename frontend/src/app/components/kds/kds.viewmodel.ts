import { Injectable, signal, computed, inject, DestroyRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { CommunicationService } from '../../services/communication.service';
import { AuthService } from '../../services/auth.service';
import { environment } from '../../../environments/environment';
import { TranslateService } from '@ngx-translate/core';

export interface KDSOrder {
    _id: string;
    tableNumber: string;
    totemId?: number;
    items: any[];
    status: string;
    createdAt: string;
    timeElapsed?: number;
    __v?: number;
}

@Injectable()
export class KDSViewModel {
    private http = inject(HttpClient);
    private comms = inject(CommunicationService);
    private auth = inject(AuthService);
    private translate = inject(TranslateService);
    private destroyRef = inject(DestroyRef);

    // State
    public orders = signal<KDSOrder[]>([]);
    public productList = signal<any[]>([]);
    public totems = signal<any[]>([]);
    public loading = signal<boolean>(true);
    public error = signal<string | null>(null);
    public showStockManager = signal<boolean>(false);
    public currentFilter = signal<'pending' | 'preparing' | 'ready'>('pending');
    public localConfig = signal<any>(null);
    public currentTime = signal<number>(Date.now());

    // Optimized computed signal that updates when orders OR currentTime changes
    public filteredOrders = computed(() => {
        const allOrders = this.orders();
        const now = this.currentTime(); // Dependency for auto-refresh

        return allOrders
            .filter(order => order.status === 'active')
            .map(order => {
                const kitchenItems = order.items.filter(item =>
                    item.status !== 'served' &&
                    item.status !== 'completed' &&
                    item.status !== 'cancelled'
                );
                return {
                    ...order,
                    kitchenItems,
                    urgent: this.getTimeDiffMinutes(order.createdAt, now) >= 15
                };
            })
            .filter(order => order.kitchenItems.length > 0)
            .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    });

    constructor() {
        this.setupRealTime();
        this.loadLocalConfig();

        const intervalId = setInterval(() => {
            this.currentTime.set(Date.now());
        }, 60000);

        this.destroyRef.onDestroy(() => {
            clearInterval(intervalId);
        });
    }

    private loadLocalConfig() {
        const saved = localStorage.getItem('disher_local_config');
        if (saved) {
            try {
                this.localConfig.set(JSON.parse(saved));
            } catch (e) { console.error('Error loading local config', e); }
        }
    }

    public async initKDS() {
        this.loading.set(true);
        this.error.set(null);

        try {
            const [orders, products, totems] = await Promise.all([
                this.comms.syncOrders(),
                firstValueFrom(this.http.get<any[]>(`${environment.apiUrl}/api/menu`)),
                firstValueFrom(this.http.get<any[]>(`${environment.apiUrl}/api/totems`))
            ]);

            if (orders) this.orders.set(orders as any[]);
            if (products) this.productList.set(products);
            if (totems) this.totems.set(totems);
        } catch (e: any) {
            console.error('KDS Init Error', e);
            this.error.set(this.translate.instant('KDS.CONN_ERROR'));
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

    public getTimeDiff(createdAt: string, now: number = this.currentTime()): string {
        if (!createdAt) return '0m';
        const diff = Math.floor((now - new Date(createdAt).getTime()) / 60000);
        return `${diff}m`;
    }

    public getTimeDiffMinutes(createdAt: string, now: number = this.currentTime()): number {
        if (!createdAt) return 0;
        return Math.floor((now - new Date(createdAt).getTime()) / 60000);
    }

    public async updateItemStatus(orderId: string, itemId: string, nextStatus: string, print: boolean = false) {
        try {
            const order = this.orders().find(o => o._id === orderId);
            const version = order?.__v ?? 0;

            await firstValueFrom(this.http.patch(`${environment.apiUrl}/api/orders/${orderId}/items/${itemId}`, { 
                status: nextStatus,
                __v: version
            }, { withCredentials: true }));

            if (print && nextStatus === 'ready') {
                const order = this.orders().find(o => o._id === orderId);
                const item = order?.items.find((i: any) => (i._id || i.id) === itemId);
                if (order && item) {
                    this.printItemTicket(order, item);
                }
            }

            this.auth.logActivity('ITEM_STATUS_CHANGED', { orderId, itemId, nextStatus });
        } catch (e) {
            console.error('Error updating status', e);
            alert(this.translate.instant('KDS.UPDATE_ERROR'));
        }
    }

    public async bulkUpdateItemsStatus(orderId: string, status: string) {
        try {
            const order = this.orders().find(o => o._id === orderId);
            const version = order?.__v ?? 0;

            await firstValueFrom(this.http.patch(`${environment.apiUrl}/api/orders/${orderId}/items/bulk-status`, { 
                status,
                __v: version
            }, { withCredentials: true }));
            this.auth.logActivity('ORDER_ITEMS_BULK_UPDATE', { orderId, status });
        } catch (e) { console.error('Error bulk updating', e); }
    }

    public printItemTicket(order: any, item: any) {
        const p = this.localConfig()?.printer;
        const totem = this.totems().find(t => t.id === (order.totemId || parseInt(order.tableNumber)));
        const tableName = totem?.name || `${this.translate.instant('ROLES.Table')} ${order.tableNumber}`;

        let details = '';
        if (item.selectedVariant) details += `\n - ${item.selectedVariant.name}`;
        if (item.selectedAddons?.length) {
            item.selectedAddons.forEach((a: any) => details += `\n + ${a.name}`);
        }

        const msg = `🖨️ (${this.translate.instant('KDS.TICKET_TITLE')})\n----------------------\n${this.translate.instant('KDS.ITEM_LABEL')}: ${item.name}${details}\n${this.translate.instant('KDS.QTY_LABEL')}: ${item.quantity}\n${this.translate.instant('KDS.ORIGIN_LABEL')}: ${tableName}\n----------------------`;

        if (!p) {
            alert(this.translate.instant('KDS.NO_PRINTER_CONFIGURED'));
        }

        if (p?.type === 'thermal') {
            alert(`🖨️ (${this.translate.instant('KDS.PRINTER_THERMAL')} ${p.ip})\n${msg}`);
        } else {
            alert(`🖨️ (${this.translate.instant('KDS.PRINTER_SYSTEM')})\n${msg}`);
        }
    }

    public async cancelItem(orderId: string, itemId: string) {
        if (!confirm(this.translate.instant('KDS.CANCEL_CONFIRM'))) return;

        try {
            await firstValueFrom(this.http.patch(`${environment.apiUrl}/api/orders/${orderId}/items/${itemId}`, { status: 'cancelled' }, { withCredentials: true }));
            this.auth.logActivity('ITEM_CANCELLED', { orderId, itemId });
        } catch (e) {
            console.error('Error cancelling item', e);
            alert(this.translate.instant('KDS.CANCEL_ERROR'));
        }
    }

    public async toggleProduct(productId: string) {
        try {
            const updated: any = await firstValueFrom(this.http.post(`${environment.apiUrl}/api/menu/${productId}/toggle`, {}, { withCredentials: true }));

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
