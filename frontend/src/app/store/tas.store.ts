import { signal, computed, Signal } from '@angular/core';
import {
  Totem,
  TotemSession,
  ItemOrder,
  Customer,
  Dish,
  LocalizedField,
} from '../types';

export interface TasStore {
  // State
  sessions: Signal<TotemSession[]>;
  selectedSession: Signal<TotemSession | null>;
  sessionItems: Signal<ItemOrder[]>;
  serviceItems: Signal<ItemOrder[]>;
  customers: Signal<Customer[]>;
  dishes: Signal<Dish[]>;
  categories: Signal<Array<{ _id: string; category_name: LocalizedField }>>;
  isLoading: Signal<boolean>;
  error: Signal<string | null>;

  // Computed
  activeSessions: Signal<TotemSession[]>;
  availableTotems: Signal<Array<{ _id: string; totem_name: string; totem_type: string }>>;
  kitchenItems: Signal<ItemOrder[]>;
  serviceItemsFiltered: Signal<ItemOrder[]>;
  itemsByCustomer: Signal<Record<string, ItemOrder[]>>;
  sessionTotal: Signal<number>;

  // Actions
  setSessions: (sessions: TotemSession[]) => void;
  selectSession: (session: TotemSession | null) => void;
  setSessionItems: (items: ItemOrder[]) => void;
  loadSessionItems: (items: ItemOrder[]) => void;
  setServiceItems: (items: ItemOrder[]) => void;
  addItem: (item: ItemOrder) => void;
  updateItemState: (itemId: string, newState: ItemOrder['item_state']) => void;
  removeItem: (itemId: string) => void;
  assignItemToCustomer: (itemId: string, customerId: string | null) => void;
  setCustomers: (customers: Customer[]) => void;
  addCustomer: (customer: Customer) => void;
  setDishes: (dishes: Dish[], categories: Array<{ _id: string; category_name: LocalizedField }>) => void;
  setAllTotems: (totems: Array<{ _id: string; totem_name: string; totem_type: string }>) => void;
  updateSessionState: (sessionId: string, newState: TotemSession['totem_state']) => void;
  removeSession: (sessionId: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  /** Acquire a reference to the store. Must be paired with releaseReference(). */
  acquireReference: () => void;
  /** Release a reference. When all references are released, store is cleared. */
  releaseReference: () => void;
  /** Check if store has active references */
  hasActiveReferences: () => boolean;
}

// State signals
const _sessions = signal<TotemSession[]>([]);
const _selectedSession = signal<TotemSession | null>(null);
const _sessionItems = signal<ItemOrder[]>([]);
const _serviceItems = signal<ItemOrder[]>([]);
const _customers = signal<Customer[]>([]);
const _dishes = signal<Dish[]>([]);
const _categories = signal<Array<{ _id: string; category_name: LocalizedField }>>([]);
const _allTotems = signal<Array<{ _id: string; totem_name: string; totem_type: string }>>([]);
const _isLoading = signal<boolean>(false);
const _error = signal<string | null>(null);
let _referenceCount = 0;

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
  
  availableTotems: computed(() => {
    const activeTotemIds = new Set(_sessions().filter(s => s.totem_state === 'STARTED').map(s => s.totem_id?.toString()));
    return _allTotems().filter(t => t.totem_type === 'STANDARD' && !activeTotemIds.has(t._id?.toString()));
  }),
  
  kitchenItems: computed(() => 
    _sessionItems().filter(i => i.item_disher_type === 'KITCHEN' && i.item_state !== 'CANCELED')
  ),
  
  serviceItemsFiltered: computed(() => 
    _serviceItems().filter(i => i.item_state !== 'SERVED' && i.item_state !== 'CANCELED')
  ),
  
  itemsByCustomer: computed(() => {
    const items = _sessionItems().filter(i => i.item_state !== 'CANCELED');
    const grouped: Record<string, ItemOrder[]> = {};
    
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

  loadSessionItems(items: ItemOrder[]) {
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
    categories: Array<{ _id: string; category_name: LocalizedField }>
  ) {
    _dishes.set(dishes);
    _categories.set(categories);
  },

  setAllTotems(totems: Array<{ _id: string; totem_name: string; totem_type: string }>) {
    _allTotems.set(totems);
  },

  updateSessionState(sessionId: string, newState: TotemSession['totem_state']) {
    _sessions.update(current =>
      current.map(s => (s._id === sessionId ? { ...s, totem_state: newState } : s))
    );
    // If the updated session is the selected one and it's now closed/paid, deselect it
    if (_selectedSession()?._id === sessionId && (newState === 'COMPLETE' || newState === 'PAID')) {
      _selectedSession.set(null);
      _sessionItems.set([]);
      _customers.set([]);
    }
  },

  removeSession(sessionId: string) {
    _sessions.update(current => current.filter(s => s._id !== sessionId));
    if (_selectedSession()?._id === sessionId) {
      _selectedSession.set(null);
      _sessionItems.set([]);
      _customers.set([]);
    }
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

  acquireReference() {
    _referenceCount++;
    console.log(`[TAS Store] Reference acquired. Count: ${_referenceCount}`);
  },

  releaseReference() {
    if (_referenceCount > 0) {
      _referenceCount--;
      console.log(`[TAS Store] Reference released. Count: ${_referenceCount}`);

      // Clear store when no more references (memory optimization)
      if (_referenceCount === 0) {
        console.log('[TAS Store] No active references, clearing store');
        _sessions.set([]);
        _selectedSession.set(null);
        _sessionItems.set([]);
        _serviceItems.set([]);
        _customers.set([]);
        _dishes.set([]);
        _categories.set([]);
        _isLoading.set(false);
        _error.set(null);
      }
    }
  },

  hasActiveReferences() {
    return _referenceCount > 0;
  },
};
