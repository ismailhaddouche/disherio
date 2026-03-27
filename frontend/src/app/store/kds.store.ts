import { signal, computed, Signal } from '@angular/core';

export interface KdsItem {
  _id: string;
  item_name_snapshot: { es: string; en: string; fr: string; ar: string };
  item_state: 'ORDERED' | 'ON_PREPARE' | 'SERVED' | 'CANCELED';
  item_base_price: number;
  createdAt: string;
  order_id: string;
  session_id: string;
}

export interface KdsStore {
  items: Signal<KdsItem[]>;
  ordered: Signal<KdsItem[]>;
  onPrepare: Signal<KdsItem[]>;
  served: Signal<KdsItem[]>;
  setItems: (items: KdsItem[]) => void;
  addItem: (item: KdsItem) => void;
  updateItemState: (itemId: string, newState: KdsItem['item_state']) => void;
  removeItem: (itemId: string) => void;
}

const _items = signal<KdsItem[]>([]);

export const kdsStore: KdsStore = {
  items: _items.asReadonly(),
  ordered: computed(() => _items().filter((i: KdsItem) => i.item_state === 'ORDERED')),
  onPrepare: computed(() => _items().filter((i: KdsItem) => i.item_state === 'ON_PREPARE')),
  served: computed(() => _items().filter((i: KdsItem) => i.item_state === 'SERVED')),

  setItems(items: KdsItem[]) {
    _items.set(items);
  },

  addItem(item: KdsItem) {
    _items.update((current: KdsItem[]) => [item, ...current]);
  },

  updateItemState(itemId: string, newState: KdsItem['item_state']) {
    _items.update((current: KdsItem[]) =>
      current.map((i: KdsItem) => (i._id === itemId ? { ...i, item_state: newState } : i))
    );
  },

  removeItem(itemId: string) {
    _items.update((current: KdsItem[]) => current.filter((i: KdsItem) => i._id !== itemId));
  },
};
