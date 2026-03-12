import { Injectable, signal, inject, computed, DestroyRef } from '@angular/core';
import { CommunicationService } from '../../services/communication.service';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { ThemeService } from '../../services/theme.service';
import { AuthService } from '../../services/auth.service';
import { firstValueFrom } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

export interface TableSession {
    tableNumber: string;
    totemId?: number;
    sessionId?: string;
    activeOrder: any | null;
}

@Injectable()
export class CustomerViewModel {
    public comms = inject(CommunicationService);
    private http = inject(HttpClient);
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    private theme = inject(ThemeService);
    public auth = inject(AuthService);
    private destroyRef = inject(DestroyRef);

    // State
    public session = signal<TableSession | null>(null);
    public restaurantName = signal<string>('');
    public menu = signal<any[]>([]);
    public cart = signal<any[]>([]);
    public loading = signal<boolean>(true);
    public error = signal<string | null>(null);

    // Configuration Modal State
    public selectedForConfig = signal<any | null>(null);
    public selectedVariant = signal<any | null>(null);
    public selectedAddons = signal<any[]>([]);
    public selectedMenuChoices = signal<{ [key: string]: string }>({});

    public isStaff = computed(() => {
        return this.auth.hasRole('waiter') || this.auth.hasRole('admin') || this.auth.hasRole('pos');
    });

    public existingNames = computed(() => {
        const order = this.session()?.activeOrder;
        if (!order || !order.items) return [];
        const names = order.items.map((i: any) => i.orderedBy?.name).filter((n: string) => n && n !== 'Comensal');
        return [...new Set(names)] as string[];
    });

    constructor() {
        this.initSession();
        this.setupTableListeners();
    }

    private async initSession() {
        const totemParam = this.route.snapshot.paramMap.get('tableNumber');
        const sessionParam = this.route.snapshot.paramMap.get('sessionCode');

        if (totemParam) {
            try {
                const res: any = await firstValueFrom(this.http.get(`${environment.apiUrl}/api/totems/${totemParam}/session`));
                const data = res.data;

                if (data.sessionId) {
                    localStorage.setItem('disher_current_session', JSON.stringify({
                        sessionId: data.sessionId, totemId: data.totemId, tableNumber: data.tableNumber, activeOrder: null
                    }));
                    this.router.navigate(['/s', data.sessionId], { replaceUrl: true });
                    return;
                } else {
                    this.session.set({
                        sessionId: undefined, totemId: data.totemId, tableNumber: data.tableNumber, activeOrder: null
                    });
                    const restRes: any = await firstValueFrom(this.http.get(`${environment.apiUrl}/api/restaurant`));
                    if (restRes?.data?.name) this.restaurantName.set(restRes.data.name);
                    this.loading.set(false);
                    return;
                }
            } catch (e) {
                console.error('Session init error', e);
                this.error.set('No se pudo establecer conexión con la mesa.');
                this.loading.set(false);
                return;
            }
        }

        if (sessionParam) {
            const savedSession = localStorage.getItem('disher_current_session');
            let initialData: TableSession = { tableNumber: '...', sessionId: sessionParam, activeOrder: null };

            if (savedSession) {
                const parsed = JSON.parse(savedSession);
                if (parsed.sessionId === sessionParam) initialData = parsed;
            }
            this.session.set(initialData);

            try {
                const menuRes: any = await firstValueFrom(this.http.get<any[]>(`${environment.apiUrl}/api/menu`));
                this.menu.set(menuRes.data || []);
                await this.loadTableState();
                localStorage.setItem('disher_current_session', JSON.stringify(this.session()));
            } catch (e) {
                console.error('Error loading session data', e);
                this.error.set('Error al cargar la información de la sesión.');
            }
        } else {
            this.error.set('Enlace no válido. Por favor, escanea el código QR de nuevo.');
        }
        this.loading.set(false);
    }

    public async registerNameAndStartSession(name: string) {
        const userName = (!name || name.trim() === '') ? 'Comensal ' + Math.floor(Math.random() * 100) : name.trim();
        this.comms.setUserName(userName);

        const currentSession = this.session();
        if (currentSession && !currentSession.sessionId && currentSession.totemId) {
            this.loading.set(true);
            try {
                const res: any = await firstValueFrom(this.http.post(`${environment.apiUrl}/api/totems/${currentSession.totemId}/session`, {}, {
                    headers: this.auth.getHeaders()
                }));
                const data = res.data;
                this.router.navigate(['/s', data.sessionId], { replaceUrl: true });
            } catch (error) {
                console.error('Error starting new session', error);
                this.error.set('Error al intentar abrir la mesa.');
                this.loading.set(false);
            }
        }
    }

    private setupTableListeners() {
        this.comms.subscribeToOrders((order: any) => {
            if (order.tableNumber === this.session()?.tableNumber) {
                this.session.update(s => s ? { ...s, activeOrder: order } : s);
            }
        });

        this.comms.subscribeToMenu((updatedItem: any) => {
            this.menu.update(prev =>
                prev.map(item => item._id === updatedItem._id ? updatedItem : item)
            );
        });

        this.comms.subscribeToConfig((config: any) => {
            if (config.name) this.restaurantName.set(config.name);
        });

        this.comms.subscribeToSessionEnd((data: any) => {
            const current = this.session();
            if (current && (data.sessionId === current.sessionId || data.totemId === current.totemId || data.tableNumber === current.tableNumber)) {
                console.log('[SECURITY] Table session ended. Clearing local data.');

                // Clear cart
                this.cart.set([]);
                if (current.sessionId) localStorage.removeItem(`disher_cart_${current.sessionId}`);
                localStorage.removeItem('disher_current_session');

                // Clear user name
                this.auth.logout(); // This clears the session cookie too
                this.comms.userName.set('Comensal');
                localStorage.removeItem('disher_user_name');

                // Clear local active order
                this.session.update(s => s ? { ...s, activeOrder: null, sessionId: undefined } : s);
            }
        });

        this.comms.subscribeToSystemReset(() => {
            console.log('[SECURITY] Global system reset (Cierre de Caja). Clearing all sessions.');
            this.auth.logout();
            this.comms.userName.set('Comensal');
            localStorage.removeItem('disher_user_name');
            localStorage.removeItem('disher_current_session');
            this.session.set(null);
            this.router.navigate(['/'], { replaceUrl: true });
        });
    }

    private async loadTableState() {
        const s = this.session();
        if (!s?.sessionId) return;

        try {
            const restRes: any = await firstValueFrom(this.http.get(`${environment.apiUrl}/api/restaurant`));
            if (restRes?.data?.name) this.restaurantName.set(restRes.data.name);

            const savedCart = localStorage.getItem(`disher_cart_${s.sessionId}`);
            if (savedCart) this.cart.set(JSON.parse(savedCart));

            const orderRes: any = await firstValueFrom(this.http.get(`${environment.apiUrl}/api/orders/session/${s.sessionId}`));
            const activeOrder = orderRes.data;

            if (activeOrder) {
                if (activeOrder.status === 'completed' || activeOrder.paymentStatus === 'paid') {
                    this.session.update(prev => prev ? { ...prev, activeOrder: null } : prev);
                    return;
                }

                this.session.update(prev => prev ? {
                    ...prev, activeOrder, tableNumber: activeOrder.tableNumber, totemId: activeOrder.totemId
                } : prev);
            } else {
                this.session.update(prev => prev ? { ...prev, activeOrder: null } : prev);
            }
        } catch (e) {
            console.error('Error loading table state', e);
        }
    }

    public handleItemClick(item: any) {
        if (!item.available) return;

        // If product has variants, addons or is a menu, show config modal
        if (item.variants?.length > 0 || item.addons?.length > 0 || item.isMenu) {
            this.selectedForConfig.set(item);
            this.selectedVariant.set(null);
            this.selectedAddons.set([]);
            this.selectedMenuChoices.set({}); // Reset menu choices
        } else {
            // Direct add to cart
            this.addToCart(item);
        }
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

        // Validation for variants
        if (item.variants?.length > 0 && !this.selectedVariant()) {
            alert('Por favor, selecciona una opción.');
            return;
        }

        // Validation for menus
        if (item.isMenu) {
            const missing = item.menuSections.find((s: any) => !this.selectedMenuChoices()[s.name]);
            if (missing) {
                alert(`Por favor, elige tu ${missing.name}`);
                return;
            }
        }

        // PM FIX: Logic for prices (Variables vs Addons)
        let finalPrice = 0;
        if (item.variants?.length > 0) {
            // Price is the variant absolute price
            finalPrice = this.selectedVariant().price;
        } else {
            // Price is base price + addons (Standard items and Menus)
            finalPrice = item.basePrice;
        }

        // Add chosen addons to total
        const addonsPrice = this.selectedAddons().reduce((acc, a) => acc + a.price, 0);
        finalPrice += addonsPrice;

        const cartItem = {
            ...item,
            image: this.selectedVariant()?.image || item.image,
            name: this.selectedVariant()
                ? `${item.name} (${this.selectedVariant().name})`
                : item.name,
            price: finalPrice,
            selectedVariant: this.selectedVariant(),
            selectedAddons: this.selectedAddons(),
            menuChoices: this.selectedMenuChoices(),
            quantity: 1,
            orderedBy: {
                id: this.comms.userId(),
                name: this.comms.userName()
            },
            addedAt: new Date().toISOString()
        };

        this.cart.update(current => {
            const newCart = [...current, cartItem];
            const s = this.session();
            if (s && s.sessionId) {
                localStorage.setItem(`disher_cart_${s.sessionId}`, JSON.stringify(newCart));
            }
            return newCart;
        });

        this.selectedForConfig.set(null);
    }

    public addToCart(item: any) {
        const cartItem = {
            ...item,
            quantity: 1,
            price: item.basePrice,
            orderedBy: {
                id: this.comms.userId(),
                name: this.comms.userName()
            },
            addedAt: new Date().toISOString()
        };
        this.cart.update(current => {
            const newCart = [...current, cartItem];
            const s = this.session();
            if (s && s.sessionId) {
                localStorage.setItem(`disher_cart_${s.sessionId}`, JSON.stringify(newCart));
            }
            return newCart;
        });
    }

    public removeFromCart(item: any) {
        this.cart.update(current => {
            const newCart = current.filter(i => i.addedAt !== item.addedAt);
            const s = this.session();
            if (s && s.sessionId) {
                localStorage.setItem(`disher_cart_${s.sessionId}`, JSON.stringify(newCart));
            }
            return newCart;
        });
    }

    public async placeOrder() {
        if (this.cart().length === 0) return;

        const s = this.session();
        const orderData = {
            tableNumber: s?.tableNumber,
            totemId: s?.totemId,
            sessionId: s?.sessionId,
            items: this.cart(),
            totalAmount: this.cart().reduce((acc, item) => acc + (item.price * item.quantity), 0)
        };

        try {
            await this.comms.sendOrder(orderData);
            this.cart.set([]);
            if (s && s.sessionId) localStorage.removeItem(`disher_cart_${s.sessionId}`);
            await this.loadTableState();
        } catch (error) {
            console.error('Failed to place order', error);
            alert('Error al enviar el pedido.');
        }
    }
}
