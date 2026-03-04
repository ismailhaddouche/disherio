import { Injectable, signal, inject } from '@angular/core';
import { CommunicationService } from '../../services/communication.service';
import { ActivatedRoute } from '@angular/router';
import { environment } from '../../../environments/environment';
import { ThemeService } from '../../services/theme.service';

export interface TableSession {
    tableNumber: string;
    totemId?: number;
    activeOrder: any | null;
}

@Injectable()
export class CustomerViewModel {
    public comms = inject(CommunicationService);
    private route = inject(ActivatedRoute);
    private theme = inject(ThemeService);

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

    constructor() {
        this.initSession();
        this.setupTableListeners();
    }

    private async initSession() {
        const totem = this.route.snapshot.paramMap.get('tableNumber');

        if (totem) {
            this.session.set({
                tableNumber: totem,
                totemId: parseInt(totem),
                activeOrder: null
            });

            // Fetch restaurant name
            try {
                const restRes = await fetch(`${environment.apiUrl}/api/restaurant`);
                if (restRes.ok) {
                    const restData = await restRes.json();
                    this.restaurantName.set(restData.name || 'Mi Restaurante');
                }
            } catch (e) {
                this.restaurantName.set('Mi Restaurante');
            }

            try {
                const res = await fetch(`${environment.apiUrl}/api/menu`);
                const data = await res.json();
                this.menu.set(data);
            } catch (e) {
                console.error('Error fetching menu', e);
                this.error.set('No se pudo cargar la carta.');
            }

            await this.loadTableState();
        }
        this.loading.set(false);
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
    }

    private async loadTableState() {
        const s = this.session();
        if (!s) return;

        try {
            const savedCart = localStorage.getItem(`disher_cart_${s.tableNumber}`);
            if (savedCart) this.cart.set(JSON.parse(savedCart));

            const res = await fetch(`${environment.apiUrl}/api/orders/table/${s.tableNumber}`);
            const activeOrder = await res.json();

            if (activeOrder) {
                this.session.update(prev => prev ? { ...prev, activeOrder } : prev);
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
            if (s) {
                localStorage.setItem(`disher_cart_${s.tableNumber}`, JSON.stringify(newCart));
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
            if (s) {
                localStorage.setItem(`disher_cart_${s.tableNumber}`, JSON.stringify(newCart));
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
            items: this.cart(),
            totalAmount: this.cart().reduce((acc, item) => acc + (item.price * item.quantity), 0)
        };

        try {
            await this.comms.sendOrder(orderData);
            this.cart.set([]);
            if (s) localStorage.removeItem(`disher_cart_${s.tableNumber}`);
            await this.loadTableState();
        } catch (error) {
            console.error('Failed to place order', error);
            alert('Error al enviar el pedido.');
        }
    }
}
