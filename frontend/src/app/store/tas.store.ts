import { signal, computed, Signal } from '@angular/core';

export interface Totem {
  _id: string;
  totem_name: string;
  totem_type: 'STANDARD' | 'TEMPORARY';
  totem_qr: string;
}

export interface TotemSession {
  _id: string;
  totem_id: string;
  session_date_start: string;
  totem_state: 'STARTED' | 'COMPLETE' | 'PAID';
  createdAt: string;
  totem?: Totem;
}

export interface LocalizedString {
  es: string;
  en: string;
  fr: string;
  ar: string;
}

export interface ItemOrder {
  _id: string;
  order_id: string;
  session_id: string;
  item_dish_id: string;
  customer_id?: string;
  item_state: 'ORDERED' | 'ON_PREPARE' | 'SERVED' | 'CANCELED';
  item_disher_type: 'KITCHEN' | 'SERVICE';
  item_name_snapshot: LocalizedString;
  item_base_price: number;
  item_disher_variant?: {
    variant_id: string;
    name: LocalizedString;
    price: number;
  } | null;
  item_disher_extras: Array<{
    extra_id: string;
    name: LocalizedString;
    price: number;
  }>;
  createdAt: string;
  customer_name?: string;
}

export interface Customer {
  _id: string;
  customer_name: string;
  session_id: string;
}

export interface Dish {
  _id: string;
  disher_name: LocalizedString;
  disher_price: number;
  disher_type: 'KITCHEN' | 'SERVICE';
  disher_url_image?: string;
  variants: Array<{
    _id: string;
    variant_name: LocalizedString;
    variant_price: number;
  }>;
  extras: Array<{
    _id: string;
    extra_name: LocalizedString;
    extra_price: number;
  }>;
}

export interface TasStore {
  // State
  sessions: Signal<TotemSession[]>;
  selectedSession: Signal<TotemSession | null>;
  sessionItems: Signal<ItemOrder[]>;
  serviceItems: Signal<ItemOrder[]>;
  customers: Signal<Customer[]>;
  dishes: Signal<Dish[]>;
  categories: Signal<Array<{ _id: string; category_name: LocalizedString }>>;
  isLoading: Signal<boolean>;
  error: Signal<string | null>;

  // Computed
  activeSessions: Signal<TotemSession[]>;
  kitchenItems: Signal<ItemOrder[]>;
  serviceItemsFiltered: Signal<ItemOrder[]>;
  itemsByCustomer: Signal<Record<string, ItemOrder[]>>;
  sessionTotal: Signal<number>;

  // Actions
  setSessions: (sessions: TotemSession[]) => void;
  selectSession: (session: TotemSession | null) => void;
  setSessionItems: (items: ItemOrder[]) => void;
  setServiceItems: (items: ItemOrder[]) => void;
  addItem: (item: ItemOrder) => void;
  updateItemState: (itemId: string, newState: ItemOrder['item_state']) => void;
  removeItem: (itemId: string) => void;
  assignItemToCustomer: (itemId: string, customerId: string | null) => void;
  setCustomers: (customers: Customer[]) => void;
  addCustomer: (customer: Customer) => void;
  setDishes: (dishes: Dish[], categories: Array<{ _id: string; category_name: LocalizedString }>) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
}

// State signals
const _sessions = signal<TotemSession[]>([]);
const _selectedSession = signal<TotemSession | null>(null);
const _sessionItems = signal<ItemOrder[]>([]);
const _serviceItems = signal<ItemOrder[]>([]);
const _customers = signal<Customer[]>([]);
const _dishes = signal<Dish[]>([]);
const _categories = signal<Array<{ _id: string; category_name: LocalizedString }>>([]);
const _isLoading = signal<boolean>(false);
const _error = signal<string | null>(null);

export const tasStore: TasStore = {
  // State
  sessions: _sessions.asReadonly(),
  selectedSession: _selectedSession.asReadonly(),
  sessionItems: _sessionItems.asReadonly(),
  serviceItems: _serviceItems.asReadonly(),
  customers: _customers.asReadonly(),
  dishes: _dishes.asReadonly(),
  categories: _categories.asReadonly(),
  isLoading: _isLoading.asReadonly(),
  error: _error.asReadonly(),

  // Computed
  activeSessions: computed(() => _sessions().filter(s => s.totem_state === 'STARTED')),
  
  kitchenItems: computed(() => 
    _sessionItems().filter(i => i.item_disher_type === 'KITCHEN' && i.item_state !== 'CANCELED')
  ),
  
  serviceItemsFiltered: computed(() => 
    _serviceItems().filter(i => i.item_state !== 'SERVED' && i.item_state !== 'CANCELED')
  ),
  
  itemsByCustomer: computed(() => {
    const items = _sessionItems().filter(i => i.item_state !== 'CANCELED');
    const grouped: Record<string, ItemOrder[]> = {};
    
    // Group by customer
    items.forEach(item => {
      const key = item.customer_id || 'unassigned';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(item);
    });
    
    return grouped;
  }),
  
  sessionTotal: computed(() => {
    return _sessionItems()
      .filter(i => i.item_state !== 'CANCELED')
      .reduce((total, item) => {
        const variantPrice = item.item_disher_variant?.price || 0;
        const extrasPrice = item.item_disher_extras.reduce((sum, e) => sum + e.price, 0);
        return total + item.item_base_price + variantPrice + extrasPrice;
      }, 0);
  }),

  // Actions
  setSessions(sessions: TotemSession[]) {
    _sessions.set(sessions);
  },

  selectSession(session: TotemSession | null) {
    _selectedSession.set(session);
    if (session) {
      _sessionItems.set([]);
      _customers.set([]);
    }
  },

  setSessionItems(items: ItemOrder[]) {
    _sessionItems.set(items);
  },

  setServiceItems(items: ItemOrder[]) {
    _serviceItems.set(items);
  },

  addItem(item: ItemOrder) {
    _sessionItems.update(current => [...current, item]);
  },

  updateItemState(itemId: string, newState: ItemOrder['item_state']) {
    _sessionItems.update(current =>
      current.map(i => (i._id === itemId ? { ...i, item_state: newState } : i))
    );
    
    // Also update in service items if present
    _serviceItems.update(current =>
      current.map(i => (i._id === itemId ? { ...i, item_state: newState } : i))
    );
  },

  removeItem(itemId: string) {
    _sessionItems.update(current => current.filter(i => i._id !== itemId));
    _serviceItems.update(current => current.filter(i => i._id !== itemId));
  },

  assignItemToCustomer(itemId: string, customerId: string | null) {
    _sessionItems.update(current =>
      current.map(i => (i._id === itemId ? { ...i, customer_id: customerId || undefined } : i))
    );
  },

  setCustomers(customers: Customer[]) {
    _customers.set(customers);
  },

  addCustomer(customer: Customer) {
    _customers.update(current => [...current, customer]);
  },

  setDishes(
    dishes: Dish[], 
    categories: Array<{ _id: string; category_name: LocalizedString }>
  ) {
    _dishes.set(dishes);
    _categories.set(categories);
  },

  setLoading(loading: boolean) {
    _isLoading.set(loading);
  },

  setError(error: string | null) {
    _error.set(error);
  },

  clearError() {
    _error.set(null);
  },
};
