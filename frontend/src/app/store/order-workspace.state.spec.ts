import type { Customer, Dish, ItemOrder } from '../types';
import { getActiveItemTotal } from '../shared/utils/order-item.utils';
import { OrderWorkspaceState } from './order-workspace.state';

class TestOrderWorkspaceState extends OrderWorkspaceState {
  items: ItemOrder[] = [];
  customers: Customer[] = [];
  dishes: Dish[] = [];

  protected override getWorkspaceItems(): ItemOrder[] {
    return this.items;
  }

  protected override getWorkspaceCustomers(): Customer[] {
    return this.customers;
  }

  protected override getWorkspaceDishes(): Dish[] {
    return this.dishes;
  }

  protected override getWorkspaceTotal(): number {
    return getActiveItemTotal(this.items);
  }

  protected override getFallbackCustomerName(part: number): string {
    return `Customer ${part}`;
  }
}

function createDish(): Dish {
  return {
    _id: 'dish-1',
    restaurant_id: 'restaurant-1',
    category_id: 'category-1',
    disher_name: [{ lang: 'en', value: 'Dish' }],
    disher_price: 10,
    disher_type: 'KITCHEN',
    disher_status: 'ACTIVATED',
    disher_alergens: [],
    disher_variant: true,
    variants: [{ _id: 'variant-1', variant_name: [{ lang: 'en', value: 'Large' }], variant_price: 2 }],
    extras: [{ _id: 'extra-1', extra_name: [{ lang: 'en', value: 'Cheese' }], extra_price: 1.5 }],
  };
}

function createItem(overrides: Partial<ItemOrder> = {}): ItemOrder {
  return {
    _id: 'item-1',
    order_id: 'order-1',
    session_id: 'session-1',
    item_dish_id: 'dish-1',
    item_state: 'ORDERED',
    item_disher_type: 'KITCHEN',
    item_name_snapshot: [{ lang: 'en', value: 'Dish' }],
    item_base_price: 10,
    item_disher_extras: [],
    ...overrides,
  };
}

describe('OrderWorkspaceState', () => {
  it('merges equivalent pending items and calculates their configured total', () => {
    const state = new TestOrderWorkspaceState();
    const dish = createDish();
    state.selectedVariantId.set('variant-1');
    state.selectedExtras.set(['extra-1']);
    state.itemQuantity.set(2);

    state.addItemToOrder(dish);
    state.selectedVariantId.set('variant-1');
    state.selectedExtras.set(['extra-1']);
    state.addItemToOrder(dish);

    expect(state.pendingItems()).toHaveSize(1);
    expect(state.pendingItems()[0].quantity).toBe(3);
    expect(state.pendingTotal()).toBe(40.5);
  });

  it('keeps split ticket cents exact', () => {
    const state = new TestOrderWorkspaceState();
    state.items = [createItem({ item_base_price: 10 })];
    state.selectPaymentType('SHARED');
    state.splitCount.set(3);

    state.calculateTickets(1000);

    expect(state.paymentTickets().map(ticket => ticket.ticket_amount)).toEqual([3.34, 3.33, 3.33]);
    expect(state.paymentTickets().reduce((sum, ticket) => sum + ticket.ticket_amount, 0)).toBe(10);
  });

  it('excludes canceled items from customer tickets', () => {
    const state = new TestOrderWorkspaceState();
    state.customers = [{ _id: 'customer-1', session_id: 'session-1', customer_name: 'Alex' }];
    state.items = [
      createItem({ customer_id: 'customer-1', item_base_price: 8 }),
      createItem({ _id: 'item-2', customer_id: 'customer-1', item_state: 'CANCELED', item_base_price: 50 }),
    ];
    state.selectPaymentType('BY_USER');

    state.calculateTickets(1000);

    expect(state.paymentTickets()).toEqual([jasmine.objectContaining({
      ticket_amount: 8,
      ticket_customer_name: 'Alex',
    })]);
  });
});
