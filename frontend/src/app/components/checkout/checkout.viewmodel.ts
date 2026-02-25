import { Injectable, signal, computed, inject } from '@angular/core';
import { CommunicationService } from '../../services/communication.service';
import { ActivatedRoute } from '@angular/router';

export type PaymentMode = 'total' | 'individual' | 'equitativo';

@Injectable()
export class CheckoutViewModel {
    private comms = inject(CommunicationService);
    private route = inject(ActivatedRoute);

    // State
    public order = signal<any>(null);
    public paymentMode = signal<PaymentMode>('total');
    public loading = signal<boolean>(true);

    // Calculated values
    public totalAmount = computed(() => this.order()?.totalAmount || 0);

    public comensales = computed(() => {
        const items = this.order()?.items || [];
        const usersMap = new Map();

        items.forEach((item: any) => {
            const user = item.orderedBy;
            if (!usersMap.has(user.id)) {
                usersMap.set(user.id, { name: user.name, total: 0, items: [] });
            }
            const userData = usersMap.get(user.id);
            userData.total += item.price * item.quantity;
            userData.items.push(item);
        });

        return Array.from(usersMap.values());
    });

    public equitativoAmount = computed(() => {
        const count = this.comensales().length || 1;
        return this.totalAmount() / count;
    });

    constructor() {
        this.loadOrder();
    }

    private async loadOrder() {
        const table = this.route.snapshot.paramMap.get('tableNumber');

        if (table) {
            // In a real app, fetch active order for this table
            const orders: any = await this.comms.syncOrders();
            const activeOrder = orders.find((o: any) => o.tableNumber === table && o.status === 'active');
            this.order.set(activeOrder);
        }
        this.loading.set(false);
    }

    public setPaymentMode(mode: PaymentMode) {
        this.paymentMode.set(mode);
    }

    public async processPayment() {
        console.log('Processing payment in mode:', this.paymentMode());
        // Call backend to close order
    }
}
