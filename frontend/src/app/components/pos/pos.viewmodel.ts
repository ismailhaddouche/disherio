import { Injectable, signal, computed, inject } from '@angular/core';
import { CommunicationService } from '../../services/communication.service';
import { AuthService } from '../../services/auth.service';
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
    private comms = inject(CommunicationService);
    private auth = inject(AuthService);
    private translate = inject(TranslateService);

    // State
    public orders = signal<any[]>([]);
    public tables = signal<any[]>([]);
    public tickets = signal<any[]>([]);
    public selectedTable = signal<POSTable | null>(null);
    public loading = signal<boolean>(true);
    public viewMode = signal<'tables' | 'history'>('tables');
    public billingConfig = signal<any>(null);
    public menuItems = signal<any[]>([]);
    public editMode = signal<boolean>(false);
    public showAddItemModal = signal<boolean>(false);
    public showCustomLineModal = signal<boolean>(false);
    public showSplitDetailedModal = signal<boolean>(false);
    public localConfig = signal<any>(null);
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
        this.loadLocalConfig();
    }

    private loadLocalConfig() {
        const saved = localStorage.getItem('disher_local_config');
        if (saved) {
            try {
                this.localConfig.set(JSON.parse(saved));
            } catch (e) { console.error('Error loading local config', e); }
        }
    }

    private async initPOS() {
        this.loading.set(true);
        try {
            const [orders, totems, tickets, restaurant, menu] = await Promise.all([
                this.comms.syncOrders(),
                fetch(`${environment.apiUrl}/api/totems`).then(res => res.json()),
                fetch(`${environment.apiUrl}/api/history`).then(res => res.json()),
                fetch(`${environment.apiUrl}/api/restaurant`).then(res => res.json()),
                fetch(`${environment.apiUrl}/api/menu`).then(res => res.json())
            ]) as [any[], any[], any[], any, any[]];

            if (orders) this.orders.set(orders);
            if (totems) this.tables.set(totems);
            if (tickets) this.tickets.set(tickets);
            if (restaurant?.billing) this.billingConfig.set(restaurant.billing);
            if (restaurant?.printers) this.globalPrinters.set(restaurant.printers);
            if (menu) this.menuItems.set(menu);

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
                    if (index !== -1) {
                        return prev.filter(o => o._id !== updatedOrder._id);
                    }
                    return prev;
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
            const tickets = await fetch(`${environment.apiUrl}/api/history`).then(res => res.json()) as any[];
            this.tickets.set(tickets);
        } catch (e) { console.error('Error loading history', e); }
    }

    public selectTable(table: POSTable) {
        this.selectedTable.set(table);
        if (table?.order) {
            const config = this.billingConfig();
            this.activeTipPercentage.set(config?.tipPercentage || 0);
        }
    }

    public getComensales(order: any) {
        if (!order) return [];
        const usersMap = new Map();
        order.items.forEach((item: any, originalIndex: number) => {
            if (item.isPaid) return; // Only show unpaid items in breakdown
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
        if (!config || config.vatPercentage === null) {
            return null;
        }

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
            alert(this.translate.instant('POS.PAY_ERROR_NO_SELECTION'));
            return;
        }

        const config = this.billingConfig();
        if (!config || config.vatPercentage === null || config.vatPercentage === undefined) {
            alert(this.translate.instant('POS.PAY_ERROR_VAT_CONFIG'));
            return;
        }

        let confirmMsg = this.translate.instant('POS.CONFIRM_TOTAL');
        if (splitType === 'equal') confirmMsg = this.translate.instant('POS.CONFIRM_SPLIT', { parts });
        if (splitType === 'by-user') confirmMsg = this.translate.instant('POS.CONFIRM_USER');

        if (!confirm(confirmMsg)) return;

        try {
            const res = await fetch(`${environment.apiUrl}/api/orders/${targetOrderId}/checkout`, {
                method: 'POST',
                headers: this.auth.getHeaders(),
                body: JSON.stringify({
                    splitType,
                    parts,
                    userId,
                    method: 'cash',
                    billingConfig: config
                })
            });

            if (!res.ok) {
                const err = await res.json();
                if (err.code === 'ORPHANS_EXIST') {
                    alert(this.translate.instant('POS.ORPHANS_WARNING'));
                } else {
                    alert(this.translate.instant('POS.PAY_ERROR') + ': ' + (err.error || ''));
                }
                return;
            }

            const result = await res.json();
            this.auth.logActivity('ORDER_PAID', { orderId: targetOrderId, type: splitType, userId });

            if (result.orderStatus === 'completed' || splitType === 'single') {
                this.selectedTable.set(null);
                this.viewMode.set('history');
            }

            this.loadHistory();
            const updatedOrders = await this.comms.syncOrders();
            if (updatedOrders) this.orders.set(updatedOrders as any[]);

            if (this.localConfig()?.printer?.autoPrint && result.tickets?.[0]) {
                result.tickets.forEach((t: any) => this.printTicket(t));
            }

        } catch (e) {
            alert(this.translate.instant('POS.PAY_ERROR'));
        }
    }

    public async payByUser(userId: string) {
        if (userId === 'orphan') {
            alert(this.translate.instant('POS.PAY_ERROR_ORPHAN'));
            return;
        }
        await this.processPayment(undefined, 'by-user', 1, userId);
    }

    public async deleteTicket(ticketId: string) {
        if (!confirm(this.translate.instant('POS.DELETE_TICKET_CONFIRM'))) return;

        try {
            const res = await fetch(`${environment.apiUrl}/api/tickets/${ticketId}`, {
                method: 'DELETE',
                headers: this.auth.getHeaders()
            });

            if (!res.ok) throw new Error('Error deleting ticket');

            this.auth.logActivity('TICKET_DELETED', { ticketId });
            this.loadHistory();

        } catch (e) {
            console.error('Error deleting ticket', e);
            alert(this.translate.instant('POS.DELETE_TICKET_ERROR'));
        }
    }

    public printTicket(ticket: any) {
        const currentUser = this.auth.currentUser();
        let p = null;

        // 1. First try to use the user's assigned printer
        if (currentUser?.printerId) {
            p = this.globalPrinters().find(pr => pr.id === currentUser.printerId);
        }

        // 2. Fallback to local device config
        if (!p) {
            p = this.localConfig()?.printer;
        }

        if (!p) {
            alert(this.translate.instant('POS.NO_PRINTER_CONFIGURED'));
        }

        if (p?.type === 'thermal' || p?.type === 'network') {
            const ip = p.address || p.ip;
            console.log(`Printing to thermal/network ${ip}:${p.port || p.connection}...`);
            alert(`🖨️ (${this.translate.instant('POS.PRINT_THERMAL')} ${ip}) ${this.translate.instant('POS.PRINT_MSG')} ${ticket.customId}\\nTotal: ${ticket.amount}€\\n\\n${currentUser?.printTemplate?.header || ''}`);
        } else {
            console.log('Printing to system printer...');
            alert(`🖨️ (${this.translate.instant('POS.PRINT_SYSTEM')}) ${this.translate.instant('POS.PRINT_MSG')} ${ticket.customId}\\nTotal: ${ticket.amount}€`);
            window.print();
        }
    }

    public toggleEditMode() {
        this.editMode.update(v => !v);
    }

    public async updateItemPrice(orderId: string, itemIndex: number, newPrice: number) {
        try {
            const order = this.orders().find(o => o._id === orderId);
            if (!order) return;

            const updatedItems = [...order.items];
            updatedItems[itemIndex].price = newPrice;

            const newTotal = updatedItems.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);

            await fetch(`${environment.apiUrl}/api/orders/${orderId}`, {
                method: 'PATCH',
                headers: this.auth.getHeaders(),
                body: JSON.stringify({ items: updatedItems, totalAmount: newTotal })
            });

        } catch (e) { console.error('Error updating price', e); }
    }

    public async updateItemName(orderId: string, itemIndex: number, newName: string) {
        try {
            const order = this.orders().find(o => o._id === orderId);
            if (!order) return;

            const updatedItems = [...order.items];
            updatedItems[itemIndex].name = newName;

            await fetch(`${environment.apiUrl}/api/orders/${orderId}`, {
                method: 'PATCH',
                headers: this.auth.getHeaders(),
                body: JSON.stringify({ items: updatedItems })
            });

        } catch (e) { console.error('Error updating name', e); }
    }

    public async reassignItem(orderId: string, itemIndex: number, guestName: string) {
        try {
            const order = this.orders().find(o => o._id === orderId);
            if (!order) return;

            const updatedItems = [...order.items];
            // If name is new, we can generate a simple id from it or keep it as guest
            const guestId = guestName.toLowerCase().replace(/\s+/g, '-');
            updatedItems[itemIndex].orderedBy = { id: guestId, name: guestName };

            await fetch(`${environment.apiUrl}/api/orders/${orderId}`, {
                method: 'PATCH',
                headers: this.auth.getHeaders(),
                body: JSON.stringify({ items: updatedItems })
            });

        } catch (e) { console.error('Error reassigning item', e); }
    }

    public async removeItemFromOrder(orderId: string, itemIndex: number) {
        try {
            const order = this.orders().find(o => o._id === orderId);
            if (!order) return;

            const updatedItems = order.items.filter((_: any, idx: number) => idx !== itemIndex);
            const newTotal = updatedItems.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);

            const res = await fetch(`${environment.apiUrl}/api/orders/${orderId}`, {
                method: 'PATCH',
                headers: this.auth.getHeaders(),
                body: JSON.stringify({ items: updatedItems, totalAmount: newTotal })
            });

            if (!res.ok) throw new Error('Error updating order');

            this.auth.logActivity('ORDER_ITEM_REMOVED', { orderId, itemIndex });

        } catch (e) {
            console.error('Error removing item', e);
            alert(this.translate.instant('POS.REMOVE_ITEM_ERROR'));
        }
    }

    public async associateOrphanItem(orderId: string, itemId: string, userId: string, userName: string) {
        try {
            const res = await fetch(`${environment.apiUrl}/api/orders/${orderId}/items/${itemId}/associate`, {
                method: 'PATCH',
                headers: this.auth.getHeaders(),
                body: JSON.stringify({ userId, userName })
            });

            if (!res.ok) throw new Error('Error associating item');

            const updatedOrder = await res.json();
            this.orders.update(prev => prev.map(o => o._id === orderId ? updatedOrder : o));

        } catch (e) {
            console.error('Error associating item', e);
            alert(this.translate.instant('POS.ASSOCIATE_ERROR'));
        }
    }

    public async addMenuItemToOrder(orderId: string, menuItem: any) {
        try {
            const order = this.orders().find(o => o._id === orderId);
            if (!order) return;

            const newItem = {
                name: menuItem.name,
                price: menuItem.price,
                quantity: 1,
                status: 'pending',
                orderedBy: { id: 'pos', name: this.translate.instant('POS.CASHIER_LABEL') },
                emoji: menuItem.emoji || '🍽️'
            };

            const updatedItems = [...order.items, newItem];
            const newTotal = updatedItems.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);

            const res = await fetch(`${environment.apiUrl}/api/orders/${orderId}`, {
                method: 'PATCH',
                headers: this.auth.getHeaders(),
                body: JSON.stringify({ items: updatedItems, totalAmount: newTotal })
            });

            if (!res.ok) throw new Error('Error updating order');

            this.auth.logActivity('ORDER_ITEM_ADDED', { orderId, itemName: menuItem.name });
            this.showAddItemModal.set(false);

        } catch (e) {
            console.error('Error adding item', e);
            alert(this.translate.instant('POS.ADD_ITEM_ERROR'));
        }
    }

    public async addCustomLineToOrder(orderId: string, customName: string, customPrice: number) {
        if (!customName || customPrice <= 0) {
            alert(this.translate.instant('POS.CUSTOM_VALIDATION_ERROR'));
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

            const res = await fetch(`${environment.apiUrl}/api/orders/${orderId}`, {
                method: 'PATCH',
                headers: this.auth.getHeaders(),
                body: JSON.stringify({ items: updatedItems, totalAmount: newTotal })
            });

            if (!res.ok) throw new Error('Error updating order');

            this.auth.logActivity('CUSTOM_LINE_ADDED', { orderId, customName, customPrice });
            this.showCustomLineModal.set(false);

        } catch (e) {
            console.error('Error adding custom line', e);
            alert(this.translate.instant('POS.ADD_CUSTOM_LINE_ERROR'));
        }
    }

    public async openTable(table: POSTable) {
        try {
            const res = await fetch(`${environment.apiUrl}/api/orders`, {
                method: 'POST',
                headers: this.auth.getHeaders(),
                body: JSON.stringify({
                    tableNumber: table.number,
                    totemId: table.id,
                    items: []
                })
            });

            if (!res.ok) throw new Error('Error opening table');

            this.auth.logActivity('TABLE_OPENED_MANUALLY', { tableNumber: table.number });

        } catch (e) {
            console.error('Error opening table', e);
            alert(this.translate.instant('POS.OPEN_TABLE_ERROR'));
        }
    }

    public openSplitModal() {
        this.showSplitDetailedModal.set(true);
    }

    public async deleteVirtualTable(tableId: number) {
        if (!confirm(this.translate.instant('POS.DELETE_VIRTUAL_CONFIRM'))) return;

        try {
            const res = await fetch(`${environment.apiUrl}/api/totems/${tableId}`, {
                method: 'DELETE',
                headers: this.auth.getHeaders(),
                credentials: 'include'
            });

            if (!res.ok) throw new Error('Error deleting virtual table');

            // Refresh totems
            const totems = await fetch(`${environment.apiUrl}/api/totems`).then(r => r.json());
            this.tables.set(totems);
            if (this.selectedTable()?.id === tableId) {
                this.selectedTable.set(null);
            }
        } catch (e) {
            console.error('Error deleting virtual table', e);
            alert(this.translate.instant('POS.DELETE_VIRTUAL_ERROR'));
        }
    }

    public async closeShift() {
        if (!confirm(this.translate.instant('POS.CONFIRM_CLOSE_SHIFT'))) return;

        try {
            const res = await fetch(`${environment.apiUrl}/api/close-shift`, {
                method: 'POST',
                headers: this.auth.getHeaders()
            });

            if (!res.ok) throw new Error('Error closing shift');

            const result = await res.json();
            alert(result.message);

            // Reload EVERYTHING
            this.initPOS();
            this.selectedTable.set(null);
        } catch (e) {
            console.error('Error closing shift', e);
            alert(this.translate.instant('POS.CLOSE_SHIFT_ERROR'));
        }
    }
}
