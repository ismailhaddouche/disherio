import { TestBed } from '@angular/core/testing';
import { I18nService } from '../../core/services/i18n.service';
import { NotificationService } from '../../core/services/notification.service';
import { SocketConnectionService } from '../../core/services/socket/socket-connection.service';
import { TasSocketService } from '../../core/services/socket/tas-socket.service';
import { tasStore } from '../../store/tas.store';
import type { ItemOrder } from '../../types';
import { TasSocketCoordinator, type TasSocketContext } from './tas-socket.coordinator';

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

describe('TasSocketCoordinator', () => {
  let coordinator: TasSocketCoordinator;
  let listeners: Map<string, (data: unknown) => void>;
  let disposers: jasmine.Spy[];
  let tasSocket: {
    registerTasListeners: jasmine.Spy;
    unregisterTasListeners: jasmine.Spy;
  };
  let connection: {
    on: (event: string, callback: (data: unknown) => void) => () => void;
  };
  let notification: {
    info: jasmine.Spy;
    success: jasmine.Spy;
    warning: jasmine.Spy;
  };
  let context: TasSocketContext;

  beforeEach(() => {
    listeners = new Map();
    disposers = [];
    tasSocket = {
      registerTasListeners: jasmine.createSpy('registerTasListeners'),
      unregisterTasListeners: jasmine.createSpy('unregisterTasListeners'),
    };
    connection = {
      on: (event, callback) => {
        listeners.set(event, callback);
        const disposer = jasmine.createSpy(`dispose ${event}`);
        disposers.push(disposer);
        return disposer;
      },
    };
    notification = {
      info: jasmine.createSpy('info'),
      success: jasmine.createSpy('success'),
      warning: jasmine.createSpy('warning'),
    };
    context = {
      selectedSessionId: () => 'session-1',
      isCancellingSession: () => false,
      isClosingSession: () => false,
      isReopeningSession: () => false,
      isArchivingSession: () => false,
      isProcessingPayment: () => false,
      markSessionComplete: jasmine.createSpy('markSessionComplete'),
      markSessionStarted: jasmine.createSpy('markSessionStarted'),
      removeSession: jasmine.createSpy('removeSession'),
    };

    TestBed.configureTestingModule({
      providers: [
        TasSocketCoordinator,
        { provide: TasSocketService, useValue: tasSocket },
        { provide: SocketConnectionService, useValue: connection },
        { provide: I18nService, useValue: { translate: (key: string) => key } },
        { provide: NotificationService, useValue: notification },
      ],
    });
    tasStore.acquireReference();
    tasStore.selectSession(null);
    tasStore.setSessionItems([]);
    coordinator = TestBed.inject(TasSocketCoordinator);
    coordinator.register(context);
  });

  afterEach(() => {
    coordinator.dispose();
    tasStore.releaseReference();
  });

  it('adds a kitchen item once for the selected session', () => {
    const item = createItem();

    listeners.get('kds:new_item')?.(item);
    listeners.get('kds:new_item')?.(item);

    expect(tasStore.sessionItems()).toEqual([item]);
    expect(notification.info).toHaveBeenCalledOnceWith('tas.new_kitchen_item');
  });

  it('routes session lifecycle events through the component context', () => {
    listeners.get('tas:session_closed')?.({ sessionId: 'session-1', state: 'COMPLETE' });
    listeners.get('tas:session_reopened')?.({ sessionId: 'session-1' });
    listeners.get('tas:session_archived')?.({ sessionId: 'session-1' });

    expect(context.markSessionComplete).toHaveBeenCalledOnceWith('session-1');
    expect(context.markSessionStarted).toHaveBeenCalledOnceWith('session-1');
    expect(context.removeSession).toHaveBeenCalledOnceWith('session-1');
  });

  it('disposes every consumer listener and unregisters TAS listeners', () => {
    coordinator.dispose();

    expect(disposers.length).toBeGreaterThan(0);
    expect(disposers.every(disposer => disposer.calls.count() === 1)).toBeTrue();
    expect(tasSocket.unregisterTasListeners).toHaveBeenCalled();
  });
});
