import { Injectable, signal, computed, inject, DestroyRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommunicationService } from '../../services/communication.service';
import { NotifyService } from '../../services/notify.service';
import { ActivatedRoute } from '@angular/router';
import { environment } from '../../../environments/environment';
import { firstValueFrom } from 'rxjs';
import { ROUTE_PARAMS, ORDER_STATUS } from '../../core/constants';

export type PaymentMode = 'total' | 'individual' | 'equitativo';

@Injectable()
export class CheckoutViewModel {
    private comms = inject(CommunicationService);
    private http = inject(HttpClient);
    private notify = inject(NotifyService);
    private route = inject(ActivatedRoute);
    private destroyRef = inject(DestroyRef);

    // State
    public order = signal<any>(null);
    public paymentMode = signal<PaymentMode>('total');
    public loading = signal<boolean>(true);
    public paymentRequested = signal<boolean>(false);

    // Calculated values
    public totalAmount = computed(() => this.order()?.totalAmount || 0);

    public comensales = computed(() => {
        const items = this.order()?.items || [];
        const usersMap = new Map();

        items.forEach((item: any) => {
            if (item.isPaid) return; // exclude already-paid items
            const user = item.orderedBy;
            if (!user?.id) return;
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

    private orderUpdateCallback = (updatedOrder: any) => {
        if (!this.order()) return;
        if (updatedOrder._id === this.order()?._id) {
            this.order.set(updatedOrder);
        }
    };

    constructor() {
        this.loadOrder();
        this.comms.subscribeToOrders(this.orderUpdateCallback);
        this.destroyRef.onDestroy(() => {
            this.comms.unsubscribeFromOrders(this.orderUpdateCallback);
        });
    }

    private async loadOrder() {
        const table = this.route.snapshot.paramMap.get(ROUTE_PARAMS.TABLE_NUMBER);
        const session = this.route.snapshot.paramMap.get(ROUTE_PARAMS.SESSION_CODE);

        try {
            if (session) {
                const order = await firstValueFrom(
                    this.http.get<any>(`${environment.apiUrl}/api/orders/session/${session}`)
                );
                this.order.set(order);
            } else if (table) {
                const orders: any = await this.comms.syncOrders();
                const activeOrder = orders?.find(
                    (o: any) => o.tableNumber === table && o.status === ORDER_STATUS.ACTIVE
                );
                this.order.set(activeOrder);
            }
        } catch (e) {
            console.error('Error loading checkout order', e);
        }
        this.loading.set(false);
    }

    public setPaymentMode(mode: PaymentMode) {
        this.paymentMode.set(mode);
    }

    public processPayment() {
        this.paymentRequested.set(true);
        this.notify.infoKey('CHECKOUT.PAYMENT_REQUESTED');
    }
}
