import { signal, computed, Signal } from '@angular/core';

export interface CartItem {
  dishId: string;
  name: string;
  price: number;
  variantId?: string;
  variantPrice?: number;
  extras: { extraId: string; name: string; price: number }[];
  quantity: number;
  customerId?: string;
}

export interface RestaurantConfig {
  taxRate: number;
  tipsState: boolean;
  tipsType: 'MANDATORY' | 'VOLUNTARY';
  tipsRate: number;
}

export interface CartStore {
  items: Signal<CartItem[]>;
  config: Signal<RestaurantConfig>;
  customTip: Signal<number>;
  totalGross: Signal<number>;
  taxAmount: Signal<number>;
  subtotal: Signal<number>;
  tipsAmount: Signal<number>;
  total: Signal<number>;
  itemCount: Signal<number>;
  setConfig: (config: Partial<RestaurantConfig>) => void;
  setCustomTip: (tip: number) => void;
  addItem: (item: Omit<CartItem, 'quantity'>) => void;
  removeItem: (dishId: string, variantId?: string) => void;
  clear: () => void;
}

const _items = signal<CartItem[]>([]);
const _config = signal<RestaurantConfig>({
  taxRate: 10,
  tipsState: false,
  tipsType: 'VOLUNTARY',
  tipsRate: 0
});
const _customTip = signal<number>(0);

export const cartStore: CartStore = {
  items: _items.asReadonly(),
  config: _config.asReadonly(),
  customTip: _customTip.asReadonly(),

  totalGross: computed(() =>
    _items().reduce((acc: number, item: CartItem) => {
      const base = item.price + (item.variantPrice ?? 0);
      const extras = item.extras.reduce((s: number, e) => s + e.price, 0);
      return acc + (base + extras) * item.quantity;
    }, 0)
  ),

  taxAmount: computed(() => {
    const total = cartStore.totalGross();
    const rate = _config().taxRate;
    return parseFloat((total - total / (1 + rate / 100)).toFixed(2));
  }),

  subtotal: computed(() => {
    return parseFloat((cartStore.totalGross() - cartStore.taxAmount()).toFixed(2));
  }),

  tipsAmount: computed(() => {
    if (_customTip() > 0) return _customTip();
    const config = _config();
    if (config.tipsState && config.tipsType === 'MANDATORY') {
      return parseFloat((cartStore.totalGross() * (config.tipsRate / 100)).toFixed(2));
    }
    return 0;
  }),

  total: computed(() => {
    return parseFloat((cartStore.totalGross() + cartStore.tipsAmount()).toFixed(2));
  }),

  itemCount: computed(() => _items().reduce((acc: number, i: CartItem) => acc + i.quantity, 0)),

  setConfig(config: Partial<RestaurantConfig>) {
    _config.update(c => ({ ...c, ...config }));
  },

  setCustomTip(tip: number) {
    _customTip.set(tip);
  },

  addItem(item: Omit<CartItem, 'quantity'>) {
    _items.update((current: CartItem[]) => {
      const existing = current.find(
        (i: CartItem) => i.dishId === item.dishId && i.variantId === item.variantId
      );
      if (existing) {
        return current.map((i: CartItem) =>
          i === existing ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...current, { ...item, quantity: 1 }];
    });
  },

  removeItem(dishId: string, variantId?: string) {
    _items.update((current: CartItem[]) =>
      current.filter((i: CartItem) => !(i.dishId === dishId && i.variantId === variantId))
    );
  },

  clear() {
    _items.set([]);
    _customTip.set(0);
  },
};
