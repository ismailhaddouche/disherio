import { Injectable, signal, computed, inject, DestroyRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { CommunicationService } from '../../services/communication.service';
import { AuthService } from '../../services/auth.service';
import { environment } from '../../../environments/environment';
import { TranslateService } from '@ngx-translate/core';
import { NotifyService } from '../../services/notify.service';
import { ORDER_STATUS, ITEM_STATUS } from '../../core/constants';
import { IOrder, IOrderItem } from '../../core/interfaces/order.interface';

export interface IKDSProduct {
    _id: string;
    name: string;
    category: string;
    available: boolean;
    image?: string;
}

export interface IKDSTotem {
    id: number;
    name: string;
    status: string;
}

@Injectable()
export class KDSViewModel {
    private http = inject(HttpClient);
    private comms = inject(CommunicationService);
    private auth = inject(AuthService);
    private translate = inject(TranslateService);
    private notify = inject(NotifyService);
    private destroyRef = inject(DestroyRef);

    // State
    public orders = signal<IOrder[]>([]);
    public productList = signal<IKDSProduct[]>([]);
    public totems = signal<IKDSTotem[]>([]);
    public loading = signal<boolean>(true);
    public error = signal<string | null>(null);
    public showStockManager = signal<boolean>(false);
    public currentFilter = signal<'pending' | 'preparing' | 'ready'>(ITEM_STATUS.PENDING as 'pending');
    public localConfig = signal<any>(null);
    public currentTime = signal<number>(Date.now());

    // Computed signal that updates when orders, currentTime OR currentFilter changes
    public filteredOrders = computed(() => {
        const allOrders = this.orders();
        const now = this.currentTime(); // Dependency for auto-refresh
        const filter = this.currentFilter();

        return allOrders
            .filter(order => order.status === ORDER_STATUS.ACTIVE)
            .map(order => {
                const kitchenItems = order.items.filter(item =>
                    item.status !== ITEM_STATUS.SERVED &&
                    item.status !== ITEM_STATUS.CANCELLED &&
                    item.status === filter
                );
                return {
                    ...order,
                    kitchenItems,
                    urgent: this.getTimeDiffMinutes(order.createdAt?.toString() || '', now) >= 15
                };
            })
            .filter(order => order.kitchenItems.length > 0)
            .sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
    });

    constructor() {
        this.setupRealTime();
        this.loadLocalConfig();

        const intervalId = setInterval(() => {
            this.currentTime.set(Date.now());
        }, 60000);

        this.destroyRef.onDestroy(() => {
            clearInterval(intervalId);
            this.comms.unsubscribeFromOrders(this.ordersCallback);
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
                firstValueFrom(this.http.get<IKDSProduct[]>(`${environment.apiUrl}/api/menu`)),
                firstValueFrom(this.http.get<IKDSTotem[]>(`${environment.apiUrl}/api/totems`))
            ]);

            if (orders) this.orders.set(orders as IOrder[]);
            if (products) this.productList.set(products);
            if (totems) this.totems.set(totems);
        } catch (e: any) {
            console.error('KDS Init Error', e);
            this.error.set(this.translate.instant('KDS.CONN_ERROR'));
        } finally {
            this.loading.set(false);
        }
    }

    private ordersCallback = (updatedOrder: IOrder) => {
        this.orders.update(prev => {
            const index = prev.findIndex(o => o._id === updatedOrder._id);
            if (index !== -1) {
                const newOrders = [...prev];
                newOrders[index] = updatedOrder;
                return newOrders;
            }
            return [updatedOrder, ...prev];
        });
    };

    private setupRealTime() {
        this.comms.subscribeToOrders(this.ordersCallback);
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

            if (print && nextStatus === ITEM_STATUS.READY) {
                const order = this.orders().find(o => o._id === orderId);
                const item = order?.items.find((i: IOrderItem) => (i._id || '').toString() === itemId);
                if (order && item) {
                    this.printItemTicket(order, item);
                }
            }

            this.auth.logActivity('ITEM_STATUS_CHANGED', { orderId, itemId, nextStatus });
        } catch (e) {
            console.error('Error updating status', e);
            this.notify.errorKey('KDS.UPDATE_ERROR');
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

    public printItemTicket(order: IOrder, item: IOrderItem) {
        const p = this.localConfig()?.printer;
        const totem = this.totems().find(t => t.id === (order.totemId || parseInt(order.tableNumber)));
        const tableName = totem?.name || `${this.translate.instant('ROLES.Table')} ${order.tableNumber}`;

        let details = '';
        if (item.selectedVariant) details += `\n - ${item.selectedVariant.name}`;
        if (item.selectedAddons?.length) {
            item.selectedAddons.forEach((a: any) => details += `\n + ${a.name}`);
        }

        if (!p) {
            this.notify.warningKey('KDS.NO_PRINTER_CONFIGURED');
            return;
        }

        const printerLabel = p.type === 'thermal'
            ? this.translate.instant('KDS.PRINTER_THERMAL')
            : this.translate.instant('KDS.PRINTER_SYSTEM');

        const detailsBlock = details ? `\n${details}` : '';
        this.notify.successKey('KDS.PRINT_MESSAGE', {
            printerLabel,
            printer: p.ip || p.address || '',
            title: this.translate.instant('KDS.TICKET_TITLE'),
            item: item.name,
            quantity: item.quantity,
            table: tableName,
            details: detailsBlock
        });
    }

    public async cancelItem(orderId: string, itemId: string) {
        if (!confirm(this.translate.instant('KDS.CANCEL_CONFIRM'))) return;

        try {
            const order = this.orders().find(o => o._id === orderId);
            const version = order?.__v ?? 0;
            await firstValueFrom(this.http.patch(`${environment.apiUrl}/api/orders/${orderId}/items/${itemId}`, { status: ITEM_STATUS.CANCELLED, __v: version }, { withCredentials: true }));
            this.auth.logActivity('ITEM_CANCELLED', { orderId, itemId });
        } catch (e) {
            console.error('Error cancelling item', e);
            this.notify.errorKey('KDS.CANCEL_ERROR');
        }
    }

    public async toggleProduct(productId: string) {
        try {
            const updated: IKDSProduct = await firstValueFrom(this.http.post<IKDSProduct>(`${environment.apiUrl}/api/menu/${productId}/toggle`, {}, { withCredentials: true }));

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
