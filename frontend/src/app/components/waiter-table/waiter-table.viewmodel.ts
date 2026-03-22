import { Injectable, signal, inject, DestroyRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateService } from '@ngx-translate/core';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../services/auth.service';
import { CommunicationService } from '../../services/communication.service';
import { NotifyService } from '../../services/notify.service';
import { ORDER_STATUS, PAYMENT_STATUS, STORAGE_KEYS } from '../../core/constants';

interface WaiterTableSession {
    tableNumber: string;
    totemId?: number;
    sessionId?: string;
    activeOrder: any | null;
}

@Injectable()
export class WaiterTableViewModel {
    private http = inject(HttpClient);
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    private auth = inject(AuthService);
    private comms = inject(CommunicationService);
    private notify = inject(NotifyService);
    private translate = inject(TranslateService);
    private destroyRef = inject(DestroyRef);

    public session = signal<WaiterTableSession | null>(null);
    public restaurantName = signal<string>('');
    public menu = signal<any[]>([]);
    public cart = signal<any[]>([]);
    public loading = signal<boolean>(true);
    public error = signal<string | null>(null);

    public selectedForConfig = signal<any | null>(null);
    public selectedVariant = signal<any | null>(null);
    public selectedAddons = signal<any[]>([]);
    public selectedMenuChoices = signal<{ [key: string]: string }>({});
    public showCustomItemModal = signal<boolean>(false);
    public customItemName = signal<string>('');
    public customItemPrice = signal<number | null>(null);

    private ordersCallback = (order: any) => {
        const current = this.session();
        if (!current) return;

        const matchesSession = current.sessionId && order.sessionId === current.sessionId;
        const matchesTable = !current.sessionId && order.tableNumber === current.tableNumber;

        if (matchesSession || matchesTable) {
            this.session.update(prev => prev ? {
                ...prev,
                sessionId: order.sessionId || prev.sessionId,
                totemId: order.totemId || prev.totemId,
                tableNumber: order.tableNumber || prev.tableNumber,
                activeOrder: order
            } : prev);
        }
    };

    private sessionEndCallback = (data: any) => {
        const current = this.session();
        if (!current) return;

        if (data.sessionId === current.sessionId || data.totemId === current.totemId || data.tableNumber === current.tableNumber) {
            if (current.sessionId) {
                localStorage.removeItem(`disher_cart_${current.sessionId}`);
            }
            this.cart.set([]);
            this.session.update(prev => prev ? { ...prev, activeOrder: null } : prev);
            this.notify.infoKey('WAITER.SESSION_ENDED');
        }
    };

    constructor() {
        this.route.paramMap
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(() => {
                void this.initTable();
            });

        this.comms.subscribeToOrders(this.ordersCallback);
        this.comms.subscribeToSessionEnd(this.sessionEndCallback);

        this.destroyRef.onDestroy(() => {
            this.comms.unsubscribeFromOrders(this.ordersCallback);
            this.comms.unsubscribeFromSessionEnd(this.sessionEndCallback);
        });
    }

    public resolveItemImage(image?: string): string {
        if (!image) return '';
        if (image.startsWith('http://') || image.startsWith('https://') || image.startsWith('data:')) {
            return image;
        }
        if (image.startsWith('/')) {
            return `${environment.apiUrl}${image}`;
        }
        return image;
    }

    private resetState() {
        this.loading.set(true);
        this.error.set(null);
        this.session.set(null);
        this.restaurantName.set('');
        this.menu.set([]);
        this.cart.set([]);
        this.selectedForConfig.set(null);
        this.selectedVariant.set(null);
        this.selectedAddons.set([]);
        this.selectedMenuChoices.set({});
        this.showCustomItemModal.set(false);
        this.customItemName.set('');
        this.customItemPrice.set(null);
    }

    private getStaffIdentity() {
        const currentUser = this.auth.currentUser();
        const name = currentUser?.username || this.translate.instant('ROLES.waiter');
        this.comms.setUserName(name);

        return {
            id: this.comms.userId(),
            name
        };
    }

    private async initTable() {
        this.resetState();

        const tableNumber = this.route.snapshot.paramMap.get('tableNumber');
        if (!tableNumber) {
            this.error.set(this.translate.instant('CUSTOMER.ERROR_INVALID_LINK'));
            this.loading.set(false);
            return;
        }

        try {
            // Load restaurant + menu in parallel; session request may 404 for new tables
            const [restaurantRes, menuRes, sessionRes] = await Promise.all([
                firstValueFrom(this.http.get<any>(`${environment.apiUrl}/api/restaurant`)).catch(() => null),
                firstValueFrom(this.http.get<any[]>(`${environment.apiUrl}/api/menu`)).catch(() => []),
                firstValueFrom(this.http.get<any>(`${environment.apiUrl}/api/totems/${tableNumber}/session`)).catch(() => null)
            ]);

            if (restaurantRes?.name) {
                this.restaurantName.set(restaurantRes.name);
            }

            this.menu.set((menuRes || []).map((item: any) => ({
                ...item,
                image: this.resolveItemImage(item.image)
            })));

            // Always set staff identity for the waiter
            this.getStaffIdentity();

            let sessionId = sessionRes?.sessionId ?? null;
            let totemId = sessionRes?.totemId ?? Number(tableNumber);
            const resolvedTableNumber = sessionRes?.tableNumber || tableNumber;

            // If no active session, create one
            if (!sessionId) {
                try {
                    const created: any = await firstValueFrom(this.http.post(`${environment.apiUrl}/api/totems/${totemId}/session`, {}));
                    sessionId = created?.sessionId ?? null;
                    totemId = created?.totemId ?? totemId;
                } catch (sessionErr) {
                    console.warn('Could not create session for table', totemId, sessionErr);
                }
            }

            this.session.set({
                sessionId,
                totemId,
                tableNumber: resolvedTableNumber,
                activeOrder: null
            });

            if (sessionId) {
                await this.loadTableState();
            }
        } catch (e) {
            console.error('Error loading waiter table', e);
            this.error.set(this.translate.instant('WAITER.LOAD_ERROR'));
        } finally {
            this.loading.set(false);
        }
    }

    private async loadTableState() {
        const current = this.session();
        if (!current?.sessionId) return;

        try {
            const savedCart = localStorage.getItem(`disher_cart_${current.sessionId}`);
            if (savedCart) {
                this.cart.set(JSON.parse(savedCart));
            }

            const orderRes: any = await firstValueFrom(this.http.get(`${environment.apiUrl}/api/orders/session/${current.sessionId}`));
            const activeOrder = orderRes;

            if (activeOrder && activeOrder.status !== ORDER_STATUS.COMPLETED && activeOrder.paymentStatus !== PAYMENT_STATUS.PAID) {
                this.session.update(prev => prev ? {
                    ...prev,
                    activeOrder,
                    tableNumber: activeOrder.tableNumber,
                    totemId: activeOrder.totemId,
                    sessionId: activeOrder.sessionId || prev.sessionId
                } : prev);
            } else {
                this.session.update(prev => prev ? { ...prev, activeOrder: null } : prev);
            }
        } catch (e) {
            console.error('Error loading waiter table state', e);
        }
    }

    public backToWaiterPanel() {
        this.router.navigate(['/admin/waiter']);
    }

    public handleItemClick(item: any) {
        if (!item.available) {
            this.notify.infoKey('CUSTOMER.UNAVAILABLE_ITEM');
            return;
        }

        if (item.variants?.length > 0 || item.addons?.length > 0 || item.isMenu) {
            this.selectedForConfig.set(item);
            this.selectedVariant.set(null);
            this.selectedAddons.set([]);
            this.selectedMenuChoices.set({});
            return;
        }

        this.addToCart(item);
    }

    public selectMenuChoice(sectionName: string, option: string) {
        this.selectedMenuChoices.update(prev => ({
            ...prev,
            [sectionName]: option
        }));
    }

    public toggleAddon(addon: any) {
        this.selectedAddons.update(prev => {
            const exists = prev.find(a => a.name === addon.name);
            if (exists) return prev.filter(a => a.name !== addon.name);
            return [...prev, addon];
        });
    }

    public addToCartFromConfig() {
        const item = this.selectedForConfig();
        if (!item) return;

        if (item.variants?.length > 0 && !this.selectedVariant()) {
            this.notify.warningKey('CUSTOMER.VARIANT_REQUIRED');
            return;
        }

        if (item.isMenu) {
            const missing = item.menuSections.find((section: any) => !this.selectedMenuChoices()[section.name]);
            if (missing) {
                this.notify.warning(this.translate.instant('CUSTOMER.MENU_SECTION_REQUIRED', { section: missing.name }));
                return;
            }
        }

        let finalPrice = 0;
        if (item.variants?.length > 0) {
            finalPrice = this.selectedVariant().price;
        } else {
            finalPrice = item.basePrice;
        }

        finalPrice += this.selectedAddons().reduce((sum, addon) => sum + addon.price, 0);

        const cartItem = {
            ...item,
            image: this.selectedVariant()?.image || item.image,
            name: this.selectedVariant() ? `${item.name} (${this.selectedVariant().name})` : item.name,
            price: finalPrice,
            selectedVariant: this.selectedVariant(),
            selectedAddons: this.selectedAddons(),
            menuChoices: this.selectedMenuChoices(),
            quantity: 1,
            orderedBy: this.getStaffIdentity(),
            addedAt: new Date().toISOString()
        };

        this.persistCartItem(cartItem);
        this.selectedForConfig.set(null);
    }

    public addToCart(item: any) {
        const cartItem = {
            ...item,
            quantity: 1,
            price: item.basePrice,
            orderedBy: this.getStaffIdentity(),
            addedAt: new Date().toISOString()
        };

        this.persistCartItem(cartItem);
    }

    public openCustomItemModal() {
        this.customItemName.set('');
        this.customItemPrice.set(null);
        this.showCustomItemModal.set(true);
    }

    public addCustomItemToCart() {
        const name = this.customItemName().trim();
        const price = Number(this.customItemPrice());

        if (!name || !Number.isFinite(price) || price <= 0) {
            this.notify.warningKey('POS.CUSTOM_VALIDATION_ERROR');
            return;
        }

        const cartItem = {
            name,
            quantity: 1,
            price,
            isCustom: true,
            image: null,
            orderedBy: this.getStaffIdentity(),
            addedAt: new Date().toISOString()
        };

        this.persistCartItem(cartItem);
        this.showCustomItemModal.set(false);
        this.customItemName.set('');
        this.customItemPrice.set(null);
    }

    private persistCartItem(cartItem: any) {
        this.cart.update(current => {
            const next = [...current, cartItem];
            const currentSession = this.session();
            if (currentSession?.sessionId) {
                localStorage.setItem(`disher_cart_${currentSession.sessionId}`, JSON.stringify(next));
            }
            return next;
        });
    }

    public removeFromCart(item: any) {
        this.cart.update(current => {
            const next = current.filter(i => i.addedAt !== item.addedAt);
            const currentSession = this.session();
            if (currentSession?.sessionId) {
                localStorage.setItem(`disher_cart_${currentSession.sessionId}`, JSON.stringify(next));
            }
            return next;
        });
    }

    public async placeOrder() {
        if (this.cart().length === 0) return;

        const current = this.session();
        const orderData = {
            tableNumber: current?.tableNumber,
            totemId: current?.totemId,
            sessionId: current?.sessionId,
            items: this.cart(),
            totalAmount: this.cart().reduce((sum, item) => sum + (item.price * item.quantity), 0),
            __v: current?.activeOrder?.__v ?? 0
        };

        try {
            await this.comms.sendOrder(orderData);
            this.cart.set([]);
            if (current?.sessionId) {
                localStorage.removeItem(`disher_cart_${current.sessionId}`);
            }
            await this.loadTableState();
            this.notify.successKey('CUSTOMER.ORDER_SENT');
        } catch (error) {
            console.error('Failed to place waiter order', error);
            this.notify.errorKey('CUSTOMER.ORDER_ERROR');
        }
    }
}
