import { cartStore, type Extra } from './cart.store';

describe('cartStore item identity', () => {
  const cheese: Extra = { extraId: 'cheese', name: 'Cheese', price: 1 };
  const bacon: Extra = { extraId: 'bacon', name: 'Bacon', price: 2 };

  afterEach(() => cartStore.clear());

  it('keeps different extras and customers as separate lines', () => {
    cartStore.addItem({ dishId: 'dish', name: 'Burger', price: 10, extras: [cheese], customerId: 'a' });
    cartStore.addItem({ dishId: 'dish', name: 'Burger', price: 10, extras: [bacon], customerId: 'a' });
    cartStore.addItem({ dishId: 'dish', name: 'Burger', price: 10, extras: [cheese], customerId: 'b' });

    expect(cartStore.items().length).toBe(3);
    expect(cartStore.totalGross()).toBe(34);
  });

  it('merges equivalent extras regardless of selection order', () => {
    cartStore.addItem({ dishId: 'dish', name: 'Burger', price: 10, extras: [cheese, bacon] });
    cartStore.addItem({ dishId: 'dish', name: 'Burger', price: 10, extras: [bacon, cheese] });

    expect(cartStore.items()).toHaveSize(1);
    expect(cartStore.items()[0].quantity).toBe(2);
    expect(cartStore.totalGross()).toBe(26);
  });

  it('removes only the selected cart line', () => {
    cartStore.addItem({ dishId: 'dish', name: 'Burger', price: 10, extras: [cheese] });
    cartStore.addItem({ dishId: 'dish', name: 'Burger', price: 10, extras: [bacon] });

    cartStore.removeItem('dish', undefined, [cheese]);

    expect(cartStore.items()).toHaveSize(1);
    expect(cartStore.items()[0].extras[0].extraId).toBe('bacon');
  });
});
