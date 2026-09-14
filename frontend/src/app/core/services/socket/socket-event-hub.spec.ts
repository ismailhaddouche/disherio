import type { Socket } from 'socket.io-client';
import type { ItemOrder } from '../../../types';
import { tasStore } from '../../../store/tas.store';
import { SocketEventHub, type SocketEventState } from './socket-event-hub';

const item: ItemOrder = {
  _id: 'item-other-table',
  order_id: 'order-1',
  session_id: 'other-session',
  item_dish_id: 'dish-1',
  item_state: 'ORDERED',
  item_disher_type: 'KITCHEN',
  item_name_snapshot: [{ lang: 'en', value: 'Soup' }],
  item_base_price: 10,
  item_disher_extras: [],
};

describe('SocketEventHub TAS isolation', () => {
  it('publishes TAS events without mutating the selected-table store globally', () => {
    const listeners = new Map<string, (payload: unknown) => void>();
    const socket = {
      on: (event: string, callback: (payload: unknown) => void) => {
        listeners.set(event, callback);
        return socket;
      },
      off: () => socket,
    } as unknown as Socket;
    const state: SocketEventState = {
      isBuffering: () => false,
      buffer: () => undefined,
      markInsufficientPermissions: () => undefined,
      setTotemSession: () => undefined,
      clearTotemSession: () => undefined,
      markTotemClosed: () => undefined,
      leaveTotemSession: () => undefined,
    };
    const hub = new SocketEventHub();
    const received = jasmine.createSpy('received');
    hub.tasItemAdded$.subscribe(received);
    tasStore.setSessionItems([]);

    hub.setupTasListeners(socket, state);
    listeners.get('tas:item_added')?.({ item, sessionId: item.session_id });

    expect(received).toHaveBeenCalledOnceWith({ item, sessionId: item.session_id });
    expect(tasStore.sessionItems()).toEqual([]);
    hub.complete();
  });
});
