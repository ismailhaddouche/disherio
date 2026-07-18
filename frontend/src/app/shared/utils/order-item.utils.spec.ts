import type { ItemOrder } from '../../types';
import {
  getActiveItemCount,
  getActiveItemTotal,
  getItemOrderTotal,
  getSessionListItemCount,
} from './order-item.utils';

function createItem(overrides: Partial<ItemOrder> = {}): ItemOrder {
  return {
    _id: 'item-1',
    order_id: 'order-1',
    session_id: 'session-1',
    item_dish_id: 'dish-1',
    item_name_snapshot: [{ lang: 'en', value: 'Dish' }],
    item_disher_type: 'KITCHEN',
    item_state: 'ORDERED',
    item_base_price: 10,
    item_disher_extras: [],
    ...overrides,
  };
}

describe('order item utilities', () => {
  it('counts only active items', () => {
    const items = [createItem(), createItem({ _id: 'item-2', item_state: 'CANCELED' })];

    expect(getActiveItemCount(items)).toBe(1);
  });

  it('includes variants and extras in active totals', () => {
    const items = [
      createItem({
        item_disher_variant: { variant_id: 'variant-1', name: [{ lang: 'en', value: 'Large' }], price: 2 },
        item_disher_extras: [{ extra_id: 'extra-1', name: [{ lang: 'en', value: 'Cheese' }], price: 1.5 }],
      }),
      createItem({ _id: 'item-2', item_state: 'CANCELED', item_base_price: 99 }),
    ];

    expect(getItemOrderTotal(items[0])).toBe(13.5);
    expect(getActiveItemTotal(items)).toBe(13.5);
  });

  it('uses the server item count for a session that is not selected', () => {
    const selectedItems = [createItem(), createItem({ _id: 'item-2' })];

    expect(getSessionListItemCount(
      { _id: 'other-session', item_count: 7 },
      'selected-session',
      selectedItems
    )).toBe(7);
  });

  it('uses live items for the selected session', () => {
    const selectedItems = [createItem(), createItem({ _id: 'item-2', item_state: 'CANCELED' })];

    expect(getSessionListItemCount(
      { _id: 'selected-session', item_count: 7 },
      'selected-session',
      selectedItems
    )).toBe(1);
  });
});
