import { signal, computed, Signal } from '@angular/core';
import type { LocalizedField } from '../types';

export type ItemState = 'ORDERED' | 'ON_PREPARE' | 'SERVED' | 'CANCELED';

export interface KdsItem {
  _id: string;
  item_name_snapshot: LocalizedField;
  item_state: ItemState;
  item_base_price: number;
  createdAt: string;
  order_id: string;
  session_id: string;
  customer_name?: string;
  totem_name?: string;
  item_disher_variant?: { variant_id: string; name: LocalizedField; price: number } | null;
  item_disher_extras?: { extra_id: string; name: LocalizedField; price: number }[];
}

export interface KdsStore {
  items: Signal<KdsItem[]>;
  ordered: Signal<KdsItem[]>;
  onPrepare: Signal<KdsItem[]>;
  served: Signal<KdsItem[]>;
  setItems: (items: KdsItem[]) => void;
  addItem: (item: KdsItem) => void;
  updateItemState: (itemId: string, newState: ItemState) => void;
  removeItem: (itemId: string) => void;
  /** Acquire a reference to the store. Must be paired with releaseReference(). */
  acquireReference: () => void;
  /** Release a reference. When all references are released, store is cleared. */
  releaseReference: () => void;
  /** Check if store has active references */
  hasActiveReferences: () => boolean;
}

const _items = signal<KdsItem[]>([]);
let _referenceCount = 0;

function filterByState(items: KdsItem[], state: ItemState): KdsItem[] {
  return items.filter((item) => item.item_state === state);
}

function updateItemStateInList(
  items: KdsItem[],
  itemId: string,
  newState: ItemState
): KdsItem[] {
  return items.map((item) =>
    item._id === itemId ? { ...item, item_state: newState } : item
  );
}

function removeItemFromList(items: KdsItem[], itemId: string): KdsItem[] {
  return items.filter((item) => item._id !== itemId);
}

export const kdsStore: KdsStore = {
  items: _items.asReadonly(),

  ordered: computed(() => filterByState(_items(), 'ORDERED')),

  onPrepare: computed(() => filterByState(_items(), 'ON_PREPARE')),

  served: computed(() => filterByState(_items(), 'SERVED')),

  setItems(items: KdsItem[]) {
    _items.set(items);
  },

  addItem(item: KdsItem) {
    _items.update((current) => [item, ...current]);
  },

  updateItemState(itemId: string, newState: ItemState) {
    _items.update((current) => updateItemStateInList(current, itemId, newState));
  },

  removeItem(itemId: string) {
    _items.update((current) => removeItemFromList(current, itemId));
  },

  acquireReference() {
    _referenceCount++;
    console.log(`[KDS Store] Reference acquired. Count: ${_referenceCount}`);
  },

  releaseReference() {
    if (_referenceCount > 0) {
      _referenceCount--;
      console.log(`[KDS Store] Reference released. Count: ${_referenceCount}`);

      // Clear store when no more references (memory optimization)
      if (_referenceCount === 0) {
        console.log('[KDS Store] No active references, clearing store');
        _items.set([]);
      }
    }
  },

  hasActiveReferences() {
    return _referenceCount > 0;
  },
};
