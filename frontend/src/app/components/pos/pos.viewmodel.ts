import { Injectable, signal, computed, inject } from '@angular/core';
import { CommunicationService } from '../../services/communication.service';
import { AuthService } from '../../services/auth.service';
import { environment } from '../../../environments/environment';

export interface POSTable {
    number: string;
    name?: string; // Add name support
    status: 'empty' | 'occupied' | 'billing';
    order?: any;
    id: number;
}

@Injectable()
export class POSViewModel {
    private comms = inject(CommunicationService);
    private auth = inject(AuthService);

    // State
    public orders = signal<any[]>([]);
    public tables = signal<any[]>([]); // Dynamic Totems
    public tickets = signal<any[]>([]); // History
    public selectedTable = signal<POSTable | null>(null);
    public loading = signal<boolean>(true);
    public viewMode = signal<'tables' | 'history'>('tables');
    public billingConfig = signal<any>(null); // VAT and Tip configuration
    public menuItems = signal<any[]>([]); // Available menu items
    public editMode = signal<boolean>(false); // Order editing mode
    public showAddItemModal = signal<boolean>(false);
    public showCustomLineModal = signal<boolean>(false);
    public localConfig = signal<any>(null); // Printer settings (local)

    // Computed: Map orders to configured tables
    public tableStates = computed(() => {
        const activeOrders = this.orders().filter(o => o.status === 'active');

        // Only show active and configured totems
        const activeTotems = this.tables().filter(t => t.active !== false); // Default is true if undefined

        return activeTotems.map(totem => {
            // Find order by totemId (preferred) or legacy tableNumber
            const order = activeOrders.find(o =>
                (o.totemId && o.totemId === totem.id) ||
                (o.tableNumber && o.tableNumber == totem.id)
            );

            return {
                number: totem.id.toString(),
                name: totem.name,
                id: totem.id,
                status: order ? 'occupied' : 'empty',
                order: order
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
                    this.loadHistory(); // Refresh history
                    if (index !== -1) {
                        // Remove from active orders
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
    }

    public getComensales(order: any) {
        if (!order) return [];
        const usersMap = new Map();
        order.items.forEach((item: any, originalIndex: number) => {
            const user = item.orderedBy;
            if (!usersMap.has(user.id)) {
                usersMap.set(user.id, { id: user.id || 'unknown', name: user.name || 'Invitado', total: 0, items: [] });
            }
            const userData = usersMap.get(user.id);
            userData.total += item.price * item.quantity;
            // Attach original index to the item for the view to use
            userData.items.push({ ...item, _originalIndex: originalIndex });
        });
        return Array.from(usersMap.values());
    }

    // Calculate billing breakdown (prices come with VAT included)
    public calculateBilling(totalWithVAT: number) {
        const config = this.billingConfig();
        if (!config || config.vatPercentage === null) {
            return null; // Cannot calculate without VAT
        }

        const vatMultiplier = 1 + (config.vatPercentage / 100);
        const basePrice = totalWithVAT / vatMultiplier;
        const vatAmount = totalWithVAT - basePrice;
        const subtotal = totalWithVAT;

        let tipAmount = 0;
        let grandTotal = subtotal;

        if (config.tipEnabled) {
            tipAmount = subtotal * (config.tipPercentage / 100);
            grandTotal = subtotal + tipAmount;
        }

        return {
            basePrice: Number(basePrice.toFixed(2)),
            vatAmount: Number(vatAmount.toFixed(2)),
            vatPercentage: config.vatPercentage,
            subtotal: Number(subtotal.toFixed(2)),
            tipAmount: Number(tipAmount.toFixed(2)),
            tipPercentage: config.tipPercentage,
            tipDescription: config.tipDescription,
            tipEnabled: config.tipEnabled,
            grandTotal: Number(grandTotal.toFixed(2))
        };
    }

    public async processPayment(orderId?: string, splitType: 'single' | 'equal' = 'single', parts: number = 1) {
        // If orderId is not provided, try to use the selected table's order
        const targetOrderId = orderId || this.selectedTable()?.order?._id;

        if (!targetOrderId) {
            alert('No hay orden seleccionada para cobrar.');
            return;
        }

        // Validate VAT configuration first
        const config = this.billingConfig();
        if (!config || config.vatPercentage === null || config.vatPercentage === undefined) {
            alert('⚠️ No se puede generar ticket sin configurar el IVA.\\n\\nPor favor, ve a Configuración y establece un porcentaje de IVA.');
            return;
        }

        if (!confirm(`¿Confirmar cobro ${splitType === 'equal' ? 'dividido entre ' + parts : 'total'}?`)) return;

        try {
            const res = await fetch(`${environment.apiUrl}/api/orders/${targetOrderId}/checkout`, {
                method: 'POST',
                headers: this.auth.getHeaders(),
                body: JSON.stringify({ splitType, parts, method: 'cash', billingConfig: config }) // Pass billing config
            });

            if (!res.ok) throw new Error('Error processing payment');

            const result = await res.json();
            this.auth.logActivity('ORDER_PAID', { orderId: targetOrderId, type: splitType, tickets: result.tickets.length });

            this.selectedTable.set(null);
            this.viewMode.set('history'); // Switch to history to see new tickets
            this.loadHistory(); // Reload history ensures we see the latest

            // Auto-print if configured
            if (this.localConfig()?.printer?.autoPrint && result.tickets?.[0]) {
                const ticket = result.tickets[result.tickets.length - 1]; // Print last ticket (common for single payment)
                this.printTicket(ticket);
            }

        } catch (e) {
            alert('Error al procesar el cobro');
        }
    }

    public async deleteTicket(ticketId: string) {
        if (!confirm('¿Estás seguro de que quieres eliminar este ticket? Esta acción no se puede deshacer.')) return;

        try {
            const res = await fetch(`${environment.apiUrl}/api/tickets/${ticketId}`, {
                method: 'DELETE',
                headers: this.auth.getHeaders()
            });

            if (!res.ok) throw new Error('Error deleting ticket');

            this.auth.logActivity('TICKET_DELETED', { ticketId });
            this.loadHistory(); // Refresh list

        } catch (e) {
            console.error('Error deleting ticket', e);
            alert('No se pudo eliminar el ticket.');
        }
    }

    public printTicket(ticket: any) {
        const p = this.localConfig()?.printer;
        if (p?.type === 'thermal') {
            console.log(`Printing to thermal ${p.ip}:${p.port}...`);
            alert(`🖨️ (Térmica ${p.ip}) Imprimiendo Ticket ${ticket.customId}\\nTotal: ${ticket.amount}€`);
        } else {
            console.log('Printing to system printer...');
            alert(`🖨️ (Sistema) Imprimiendo Ticket ${ticket.customId}\\nTotal: ${ticket.amount}€`);
            window.print(); // Browser native print
        }
    }

    // Order Editing Methods
    public toggleEditMode() {
        this.editMode.update(v => !v);
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
            alert('No se pudo eliminar el producto');
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
                orderedBy: { id: 'pos', name: 'Caja' },
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
            alert('No se pudo añadir el producto');
        }
    }

    public async addCustomLineToOrder(orderId: string, customName: string, customPrice: number) {
        if (!customName || customPrice <= 0) {
            alert('Por favor, introduce un nombre y un precio válido');
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
                orderedBy: { id: 'pos', name: 'Caja' },
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
            alert('No se pudo añadir la línea personalizada');
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

            // The real-time listener will pick up the new order and update the table state

        } catch (e) {
            console.error('Error opening table', e);
            alert('No se pudo abrir la mesa');
        }
    }

    public openSplitModal() {
        alert('Funcionalidad de dividir cuenta próximamente.');
    }
}
