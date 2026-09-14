import type { Customer, ItemOrder, TotemSession } from '../types';
import { tasStore } from './tas.store';

describe('tasStore session lifecycle', () => {
  const session: TotemSession = {
    _id: 'session-1',
    totem_id: 'totem-1',
    session_date_start: '2026-07-16T10:00:00.000Z',
    totem_state: 'STARTED',
  };
  const items: ItemOrder[] = [{
    _id: 'item-1', order_id: 'order-1', session_id: 'session-1', item_dish_id: 'dish-1',
    item_state: 'SERVED', item_disher_type: 'KITCHEN', item_name_snapshot: [],
    item_base_price: 12, item_disher_extras: [],
  }];
  const customers: Customer[] = [{ _id: 'customer-1', session_id: 'session-1', customer_name: 'Ana' }];

  beforeEach(() => {
    tasStore.setSessions([session]);
    tasStore.selectSession(session);
    tasStore.setSessionItems(items);
    tasStore.setCustomers(customers);
  });

  afterEach(() => {
    tasStore.setSessions([]);
    tasStore.selectSession(null);
  });

  it('keeps a completed session selected so it can be paid', () => {
    tasStore.updateSessionState('session-1', 'COMPLETE');

    expect(tasStore.sessions()[0].totem_state).toBe('COMPLETE');
    expect(tasStore.selectedSession()?.totem_state).toBe('COMPLETE');
  });

  it('preserves bill details when refreshing the selected session metadata', () => {
    tasStore.selectSession({ ...session, totem_state: 'COMPLETE' });

    expect(tasStore.selectedSession()?.totem_state).toBe('COMPLETE');
    expect(tasStore.sessionItems()).toEqual(items);
    expect(tasStore.customers()).toEqual(customers);
    expect(tasStore.sessionTotal()).toBe(12);
  });

  it('clears the previous table details when selecting another session', () => {
    tasStore.selectSession({ ...session, _id: 'session-2' });

    expect(tasStore.sessionItems()).toEqual([]);
    expect(tasStore.customers()).toEqual([]);
  });

  it('clears bill details when deselecting the session', () => {
    tasStore.selectSession(null);

    expect(tasStore.sessionItems()).toEqual([]);
    expect(tasStore.customers()).toEqual([]);
    expect(tasStore.sessionTotal()).toBe(0);
  });

  it('clears a selected session after it is archived', () => {
    tasStore.updateSessionState('session-1', 'PAID');

    expect(tasStore.sessions()[0].totem_state).toBe('PAID');
    expect(tasStore.selectedSession()).toBeNull();
  });

  it('clears a selected session after it is cancelled', () => {
    tasStore.updateSessionState('session-1', 'CANCELLED');

    expect(tasStore.sessions()[0].totem_state).toBe('CANCELLED');
    expect(tasStore.selectedSession()).toBeNull();
  });
});
