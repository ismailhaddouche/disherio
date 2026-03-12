import { Injectable, signal, computed, inject, DestroyRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommunicationService } from '../../services/communication.service';
import { AuthService } from '../../services/auth.service';
import { NotifyService } from '../../services/notify.service';
import { environment } from '../../../environments/environment';
import { TranslateService } from '@ngx-translate/core';

export interface POSTable {
    number: string;
    name?: string;
    status: 'empty' | 'occupied' | 'billing';
    order?: any;
    id: number;
    isVirtual?: boolean;
}

@Injectable()
export class POSViewModel {
    private http = inject(HttpClient);
    private comms = inject(CommunicationService);
    private auth = inject(AuthService);
    private translate = inject(TranslateService);
    private notify = inject(NotifyService);
    private destroyRef = inject(DestroyRef);

    // State
    public orders = signal<any[]>([]);
    public tables = signal<any[]>([]);
    public tickets = signal<any[]>([]);
    public selectedTable = signal<POSTable | null>(null);
    public loading = signal<boolean>(false);
    public viewMode = signal<'tables' | 'history'>('tables');
    public billingConfig = signal<any>(null);
    public menuItems = signal<any[]>([]);
    public editMode = signal<boolean>(false);
    public showAddItemModal = signal<boolean>(false);
    public showCustomLineModal = signal<boolean>(false);
    public showSplitDetailedModal = signal<boolean>(false);
    public localPrinterId = signal<string | null>(localStorage.getItem('disher_local_printer'));
    public globalPrinters = signal<any[]>([]);
    public activeTipPercentage = signal<number>(0);

    public tableStates = computed(() => {
        const activeOrders = this.orders().filter(o => o.status === 'active');
        const activeTotems = this.tables().filter(t => t.active !== false);

        return activeTotems.map(totem => {
            const order = activeOrders.find(o =>
                (o.totemId && o.totemId === totem.id) ||
                (o.tableNumber && o.tableNumber == totem.id)
            );

            return {
                number: totem.id.toString(),
                name: totem.name,
                id: totem.id,
                status: order ? 'occupied' : 'empty',
                order: order,
                isVirtual: totem.isVirtual
            } as POSTable;
        });
    });

    constructor() {
        this.initPOS();
        this.setupRealTime();
    }

    public async initPOS() {
        if (this.loading()) return;
        this.loading.set(true);
        try {
            const [orders, totems, tickets, restaurant, menu] = await Promise.all([
                this.comms.syncOrders(),
                firstValueFrom(this.http.get<any[]>(`${environment.apiUrl}/api/totems`)),
                firstValueFrom(this.http.get<any[]>(`${environment.apiUrl}/api/history`)),
                firstValueFrom(this.http.get<any>(`${environment.apiUrl}/api/restaurant`)),
                firstValueFrom(this.http.get<any[]>(`${environment.apiUrl}/api/menu`))
            ]);

            this.orders.set((orders as any[]) || []);
            this.tables.set(totems || []);
            this.tickets.set(tickets || []);
            this.billingConfig.set(restaurant?.billing || null);
            this.globalPrinters.set(restaurant?.printers || []);
            this.menuItems.set(menu || []);

        } catch (e) {
            console.error('POS Init Error', e);
        } finally {
            this.loading.set(false);
        }
    }

    private setupRealTime() {
        this.comms.subscribeToOrders((updatedOrder: any) => {
            this.orders.update(prev => {
                const index = prev.findIndex(o => o._id === updatedOrder._id);

                if (updatedOrder.status === 'completed') {
                    this.loadHistory();
                    return prev.filter(o => o._id !== updatedOrder._id);
                }

                if (index !== -1) {
                    const newOrders = [...prev];
                    newOrders[index] = updatedOrder;
                    return newOrders;
                }
                return [updatedOrder, ...prev];
            });
        });
    }

    public async loadHistory() {
        try {
            const tickets = await firstValueFrom(this.http.get<any[]>(`${environment.apiUrl}/api/history`));
            this.tickets.set(tickets);
        } catch (e) { console.error('Error loading history', e); }
    }

    public selectTable(table: POSTable) {
        this.selectedTable.set(table);
        if (table?.order) {
            this.activeTipPercentage.set(this.billingConfig()?.tipPercentage || 0);
        }
    }

    public getComensales(order: any) {
        if (!order) return [];
        const usersMap = new Map();
        order.items.forEach((item: any, originalIndex: number) => {
            if (item.isPaid) return;
            const user = item.orderedBy;
            const userId = user.id || 'orphan';
            if (!usersMap.has(userId)) {
                usersMap.set(userId, {
                    id: userId,
                    name: user.name || this.translate.instant('POS.ORPHAN'),
                    total: 0,
                    items: []
                });
            }
            const userData = usersMap.get(userId);
            userData.total += item.price * item.quantity;
            userData.items.push({ ...item, _originalIndex: originalIndex });
        });
        return Array.from(usersMap.values());
    }

    public calculateBilling(totalWithVAT: number, customTip?: number) {
        const config = this.billingConfig();
        if (!config || config.vatPercentage === null) return null;

        const tipPercent = customTip !== undefined ? customTip : this.activeTipPercentage();
        const vatMultiplier = 1 + (config.vatPercentage / 100);
        const basePrice = totalWithVAT / vatMultiplier;
        const vatAmount = totalWithVAT - basePrice;
        const subtotal = totalWithVAT;

        let tipAmount = 0;
        let grandTotal = subtotal;

        if (config.tipEnabled) {
            tipAmount = subtotal * (tipPercent / 100);
            grandTotal = subtotal + tipAmount;
        }

        return {
            basePrice: Number(basePrice.toFixed(2)),
            vatAmount: Number(vatAmount.toFixed(2)),
            vatPercentage: config.vatPercentage,
            subtotal: Number(subtotal.toFixed(2)),
            tipAmount: Number(tipAmount.toFixed(2)),
            tipPercentage: tipPercent,
            tipDescription: config.tipDescription,
            tipEnabled: config.tipEnabled,
            grandTotal: Number(grandTotal.toFixed(2))
        };
    }

    public async processPayment(orderId?: string, splitType: 'single' | 'equal' | 'by-user' = 'single', parts: number = 1, userId?: string) {
        const targetOrderId = orderId || this.selectedTable()?.order?._id;
        if (!targetOrderId) {
            this.notify.warning(this.translate.instant('POS.PAY_ERROR_NO_SELECTION'));
            return;
        }

        const config = this.billingConfig();
        if (!config || config.vatPercentage === null || config.vatPercentage === undefined) {
            this.notify.warning(this.translate.instant('POS.PAY_ERROR_VAT_CONFIG'));
            return;
        }

        let confirmMsg = this.translate.instant('POS.CONFIRM_TOTAL');
        if (splitType === 'equal') confirmMsg = this.translate.instant('POS.CONFIRM_SPLIT', { parts });
        if (splitType === 'by-user') confirmMsg = this.translate.instant('POS.CONFIRM_USER');

        if (!confirm(confirmMsg)) return;

        try {
            const resData: any = await firstValueFrom(this.http.post(`${environment.apiUrl}/api/orders/${targetOrderId}/checkout`, {
                splitType, parts, userId, method: 'cash', billingConfig: config,
                __v: this.selectedTable()?.order?.__v || 0
            }, { withCredentials: true }));

            this.auth.logActivity('ORDER_PAID', { orderId: targetOrderId, type: splitType, userId });

            if (resData.orderStatus === 'completed' || splitType === 'single') {
                this.selectedTable.set(null);
                this.viewMode.set('history');
            }

            this.loadHistory();
            const updatedOrders = await this.comms.syncOrders();
            if (updatedOrders) this.orders.set(updatedOrders as any[]);

            if (localStorage.getItem('disher_local_autoprint') === 'true' && resData.tickets?.[0]) {
                resData.tickets.forEach((t: any) => this.printTicket(t));
            }

        } catch (e: any) {
            const msg = e.error?.code === 'ORPHANS_EXIST'
                ? this.translate.instant('POS.ORPHANS_WARNING')
                : (this.translate.instant('POS.PAY_ERROR') + ': ' + (e.error?.error || e.message || ''));
            this.notify.error(msg);
        }
    }

    public async payByUser(userId: string) {
        if (userId === 'orphan') {
            this.notify.warning(this.translate.instant('POS.PAY_ERROR_ORPHAN'));
            return;
        }
        await this.processPayment(undefined, 'by-user', 1, userId);
    }

    public async deleteTicket(ticketId: string) {
        if (!confirm(this.translate.instant('POS.DELETE_TICKET_CONFIRM'))) return;
        try {
            await firstValueFrom(this.http.delete(`${environment.apiUrl}/api/tickets/${ticketId}`, { withCredentials: true }));
            this.auth.logActivity('TICKET_DELETED', { ticketId });
            this.loadHistory();
        } catch (e) {
            console.error('Error deleting ticket', e);
            this.notify.error(this.translate.instant('POS.DELETE_TICKET_ERROR'));
        }
    }

    public printTicket(ticket: any) {
        const currentUser = this.auth.currentUser();
        let p = null;

        if (currentUser?.printerId) {
            p = this.globalPrinters().find(pr => pr.id === currentUser.printerId);
        }
        if (!p) {
            const localId = localStorage.getItem('disher_local_printer');
            if (localId) p = this.globalPrinters().find(pr => pr.id === localId);
        }

        if (!p) {
            this.notify.warning(this.translate.instant('POS.NO_PRINTER_CONFIGURED'));
            return;
        }

        if (p.type === 'thermal' || p.type === 'network') {
            const ip = p.address || p.ip;
            const fiscalInfo = ticket.baseAmount ? ` (Base: ${ticket.baseAmount}€ + IVA: ${ticket.vatAmount}€)` : '';
            this.notify.success(`🖨️ ${this.translate.instant('POS.PRINT_THERMAL')} ${ip} — ${ticket.customId} (${ticket.amount}€)${fiscalInfo}`);
        } else {
            const fiscalInfo = ticket.baseAmount ? ` (Base: ${ticket.baseAmount}€ + IVA: ${ticket.vatAmount}€)` : '';
            this.notify.success(`🖨️ ${this.translate.instant('POS.PRINT_SYSTEM')} — ${ticket.customId} (${ticket.amount}€)${fiscalInfo}`);
            window.print();
        }
    }

    public toggleEditMode() {
        this.editMode.update(v => !v);
    }

    private async patchOrder(orderId: string, payload: any) {
        // Find existing order to get the correct version (__v) for OCC
        const order = this.orders().find(o => o._id === orderId);
        const version = order?.__v ?? 0;
        
        return firstValueFrom(this.http.patch(`${environment.apiUrl}/api/orders/${orderId}`, { 
            ...payload, 
            __v: version 
        }, { withCredentials: true }));
    }

    public async updateItemPrice(orderId: string, itemIndex: number, newPrice: number) {
        try {
            const order = this.orders().find(o => o._id === orderId);
            if (!order) return;

            const updatedItems = [...order.items];
            updatedItems[itemIndex].price = newPrice;
            const newTotal = updatedItems.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);

            await this.patchOrder(orderId, { items: updatedItems, totalAmount: newTotal });
        } catch (e) { console.error('Error updating price', e); }
    }

    public async updateItemName(orderId: string, itemIndex: number, newName: string) {
        try {
            const order = this.orders().find(o => o._id === orderId);
            if (!order) return;

            const updatedItems = [...order.items];
            updatedItems[itemIndex].name = newName;
            await this.patchOrder(orderId, { items: updatedItems });
        } catch (e) { console.error('Error updating name', e); }
    }

    public async reassignItem(orderId: string, itemIndex: number, guestName: string) {
        try {
            const order = this.orders().find(o => o._id === orderId);
            if (!order) return;

            const updatedItems = [...order.items];
            const guestId = guestName.toLowerCase().replace(/\s+/g, '-');
            updatedItems[itemIndex].orderedBy = { id: guestId, name: guestName };
            await this.patchOrder(orderId, { items: updatedItems });
        } catch (e) { console.error('Error reassigning item', e); }
    }

    public async removeItemFromOrder(orderId: string, itemIndex: number) {
        try {
            const order = this.orders().find(o => o._id === orderId);
            if (!order) return;

            const updatedItems = order.items.filter((_: any, idx: number) => idx !== itemIndex);
            const newTotal = updatedItems.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);

            await this.patchOrder(orderId, { items: updatedItems, totalAmount: newTotal });
            this.auth.logActivity('ORDER_ITEM_REMOVED', { orderId, itemIndex });
        } catch (e) {
            console.error('Error removing item', e);
            this.notify.error(this.translate.instant('POS.REMOVE_ITEM_ERROR'));
        }
    }

    public async associateOrphanItem(orderId: string, itemId: string, userId: string, userName: string) {
        try {
            const updatedOrder: any = await firstValueFrom(this.http.patch(`${environment.apiUrl}/api/orders/${orderId}/items/${itemId}/associate`, { userId, userName }, { withCredentials: true }));
            this.orders.update(prev => prev.map(o => o._id === orderId ? updatedOrder : o));
        } catch (e) {
            console.error('Error associating item', e);
            this.notify.error(this.translate.instant('POS.ASSOCIATE_ERROR'));
        }
    }

    public async addMenuItemToOrder(orderId: string, menuItem: any) {
        try {
            const order = this.orders().find(o => o._id === orderId);
            if (!order) return;

            const newItem = {
                name: menuItem.name,
                price: menuItem.price,
                image: menuItem.image,
                quantity: 1,
                status: 'pending',
                orderedBy: { id: 'pos', name: this.translate.instant('POS.CASHIER_LABEL') },
                emoji: menuItem.emoji || '🍽️'
            };

            const updatedItems = [...order.items, newItem];
            const newTotal = updatedItems.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);

            await this.patchOrder(orderId, { items: updatedItems, totalAmount: newTotal });
            this.auth.logActivity('ORDER_ITEM_ADDED', { orderId, itemName: menuItem.name });
            this.showAddItemModal.set(false);
        } catch (e) {
            console.error('Error adding item', e);
            this.notify.error(this.translate.instant('POS.ADD_ITEM_ERROR'));
        }
    }

    public async addCustomLineToOrder(orderId: string, customName: string, customPrice: number) {
        if (!customName || customPrice <= 0) {
            this.notify.warning(this.translate.instant('POS.CUSTOM_VALIDATION_ERROR'));
            return;
        }

        try {
            const order = this.orders().find(o => o._id === orderId);
            if (!order) return;

            const newItem = {
                name: customName,
                price: customPrice,
                quantity: 1,
                status: 'pending',
                orderedBy: { id: 'pos', name: this.translate.instant('POS.CASHIER_LABEL') },
                emoji: '📝',
                isCustom: true
            };

            const updatedItems = [...order.items, newItem];
            const newTotal = updatedItems.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);

            await this.patchOrder(orderId, { items: updatedItems, totalAmount: newTotal });
            this.auth.logActivity('CUSTOM_LINE_ADDED', { orderId, customName, customPrice });
            this.showCustomLineModal.set(false);
        } catch (e) {
            console.error('Error adding custom line', e);
            this.notify.error(this.translate.instant('POS.ADD_CUSTOM_LINE_ERROR'));
        }
    }

    public async openTable(table: POSTable) {
        try {
            await firstValueFrom(this.http.post(`${environment.apiUrl}/api/orders`, {
                tableNumber: table.number,
                totemId: table.id,
                items: []
            }, { withCredentials: true }));
            this.auth.logActivity('TABLE_OPENED_MANUALLY', { tableNumber: table.number });
        } catch (e) {
            console.error('Error opening table', e);
            this.notify.error(this.translate.instant('POS.OPEN_TABLE_ERROR'));
        }
    }

    public openSplitModal() {
        this.showSplitDetailedModal.set(true);
    }

    public async deleteVirtualTable(tableId: number) {
        if (!confirm(this.translate.instant('POS.DELETE_VIRTUAL_CONFIRM'))) return;
        try {
            await firstValueFrom(this.http.delete(`${environment.apiUrl}/api/totems/${tableId}`, { withCredentials: true }));
            const totems: any[] = await firstValueFrom(this.http.get<any[]>(`${environment.apiUrl}/api/totems`));
            this.tables.set(totems);
            if (this.selectedTable()?.id === tableId) this.selectedTable.set(null);
        } catch (e) {
            console.error('Error deleting virtual table', e);
            this.notify.error(this.translate.instant('POS.DELETE_VIRTUAL_ERROR'));
        }
    }

    public async closeShift() {
        if (!confirm(this.translate.instant('POS.CONFIRM_CLOSE_SHIFT'))) return;
        try {
            const result: any = await firstValueFrom(this.http.post(`${environment.apiUrl}/api/close-shift`, {}, { withCredentials: true }));
            this.notify.success(result.message);
            this.initPOS();
            this.selectedTable.set(null);
        } catch (e) {
            console.error('Error closing shift', e);
            this.notify.error(this.translate.instant('POS.CLOSE_SHIFT_ERROR'));
        }
    }
}
