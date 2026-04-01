import { signal, computed, Signal } from '@angular/core';

export interface CartItem {
  dishId: string;
  name: string;
  price: number;
  variantId?: string;
  variantPrice?: number;
  extras: Extra[];
  quantity: number;
  customerId?: string;
}

export interface Extra {
  extraId: string;
  name: string;
  price: number;
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

const TAX_DECIMAL_PLACES = 2;
const DEFAULT_TAX_RATE = 10;

const _items = signal<CartItem[]>([]);
const _config = signal<RestaurantConfig>({
  taxRate: DEFAULT_TAX_RATE,
  tipsState: false,
  tipsType: 'VOLUNTARY',
  tipsRate: 0
});
const _customTip = signal<number>(0);

// Computed interno para evitar referencia circular
const _totalGross = computed(() =>
  _items().reduce((total, item) => total + calculateItemTotal(item), 0)
);

function calculateItemTotal(item: CartItem): number {
  const basePrice = item.price + (item.variantPrice ?? 0);
  const extrasTotal = item.extras.reduce((sum, e) => sum + e.price, 0);
  return (basePrice + extrasTotal) * item.quantity;
}

function extractTaxFromTotal(total: number, taxRate: number): number {
  return total - total / (1 + taxRate / 100);
}

function formatCurrency(value: number): number {
  return parseFloat(value.toFixed(TAX_DECIMAL_PLACES));
}

function calculateMandatoryTip(total: number, tipsRate: number): number {
  return formatCurrency(total * (tipsRate / 100));
}

function isMandatoryTipEnabled(config: RestaurantConfig): boolean {
  return config.tipsState && config.tipsType === 'MANDATORY' && config.tipsRate > 0;
}

function findItemIndex(items: CartItem[], dishId: string, variantId?: string): number {
  return items.findIndex((i) => i.dishId === dishId && i.variantId === variantId);
}

export const cartStore: CartStore = {
  items: _items.asReadonly(),
  config: _config.asReadonly(),
  customTip: _customTip.asReadonly(),

  totalGross: _totalGross,

  taxAmount: computed(() => {
    const grossTotal = _totalGross();
    const tax = extractTaxFromTotal(grossTotal, _config().taxRate);
    return formatCurrency(tax);
  }),

  subtotal: computed(() => {
    const grossTotal = _totalGross();
    const tax = cartStore.taxAmount();
    return formatCurrency(grossTotal - tax);
  }),

  tipsAmount: computed(() => {
    const customTipValue = _customTip();
    if (customTipValue > 0) {
      return formatCurrency(customTipValue);
    }
    
    const config = _config();
    if (isMandatoryTipEnabled(config)) {
      return calculateMandatoryTip(_totalGross(), config.tipsRate);
    }
    
    return 0;
  }),

  total: computed(() => {
    const grossTotal = _totalGross();
    const tips = cartStore.tipsAmount();
    return formatCurrency(grossTotal + tips);
  }),

  itemCount: computed(() =>
    _items().reduce((total, item) => total + item.quantity, 0)
  ),

  setConfig(config: Partial<RestaurantConfig>) {
    _config.update((current) => ({ ...current, ...config }));
  },

  setCustomTip(tip: number) {
    _customTip.set(tip);
  },

  addItem(item: Omit<CartItem, 'quantity'>) {
    _items.update((current) => {
      const existingIndex = findItemIndex(current, item.dishId, item.variantId);
      
      if (existingIndex >= 0) {
        return incrementItemQuantity(current, existingIndex);
      }
      
      return [...current, { ...item, quantity: 1 }];
    });
  },

  removeItem(dishId: string, variantId?: string) {
    _items.update((current) =>
      current.filter((item) => !(item.dishId === dishId && item.variantId === variantId))
    );
  },

  clear() {
    _items.set([]);
    _customTip.set(0);
  },
};

function incrementItemQuantity(items: CartItem[], index: number): CartItem[] {
  return items.map((item, i) =>
    i === index ? { ...item, quantity: item.quantity + 1 } : item
  );
}
