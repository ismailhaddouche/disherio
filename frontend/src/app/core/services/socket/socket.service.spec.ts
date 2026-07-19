import { TestBed } from '@angular/core/testing';
import { SocketService } from './socket.service';

describe('SocketService', () => {
  let service: SocketService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [SocketService]
    });
    service = TestBed.inject(SocketService);
  });

  afterEach(() => {
    service.ngOnDestroy();
  });

  describe('Service Creation', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('should not be connected initially', () => {
      expect(service.isConnected()).toBe(false);
    });
  });

  describe('Connection Management', () => {
    it('should acquire connection', () => {
      service.acquireConnection();
      // Connection is attempted but won't succeed without server
      expect(service).toBeTruthy();
    });

    it('should release connection', () => {
      service.acquireConnection();
      service.releaseConnection();
      // Should not throw
      expect(service).toBeTruthy();
    });

    it('should handle multiple acquire/releases', () => {
      service.acquireConnection();
      service.acquireConnection();
      service.releaseConnection();
      service.releaseConnection();
      // Should not throw
      expect(service).toBeTruthy();
    });

    it('clears consumer listeners after the final release when the socket is absent', () => {
      const staleListener = jasmine.createSpy('staleListener');
      service.on('custom:event', staleListener);
      Reflect.set(service, 'connectionRefCount', 1);
      Reflect.set(service, 'socket', null);

      service.releaseConnection();

      const activeListeners = Reflect.get(service, 'activeListeners') as Map<string, Set<unknown>>;
      expect(activeListeners.size).toBe(0);
    });
  });

  describe('Session Management', () => {
    it('should have joinSession method', () => {
      expect(typeof service.joinSession).toBe('function');
    });

    it('should have leaveSession method', () => {
      expect(typeof service.leaveSession).toBe('function');
    });
  });

  describe('TAS Methods', () => {
    it('should have joinTasSession method', () => {
      expect(typeof service.joinTasSession).toBe('function');
    });

    it('should have leaveTasSession method', () => {
      expect(typeof service.leaveTasSession).toBe('function');
    });

    it('should have tasAddItem method', () => {
      expect(typeof service.tasAddItem).toBe('function');
    });

    it('should have tasServeServiceItem method', () => {
      expect(typeof service.tasServeServiceItem).toBe('function');
    });

    it('should have tasCancelItem method', () => {
      expect(typeof service.tasCancelItem).toBe('function');
    });

    it('should have tasRequestBill method', () => {
      expect(typeof service.tasRequestBill).toBe('function');
    });

    it('should have tasAcknowledgeCustomerCall method', () => {
      expect(typeof service.tasAcknowledgeCustomerCall).toBe('function');
    });

    it('should have tasNotifyCustomers method', () => {
      expect(typeof service.tasNotifyCustomers).toBe('function');
    });
  });

  describe('Totem Methods', () => {
    it('should have joinTotemSession method', () => {
      expect(typeof service.joinTotemSession).toBe('function');
    });

    it('should have leaveTotemSession method', () => {
      expect(typeof service.leaveTotemSession).toBe('function');
    });

    it('should have getTotemSessionId method', () => {
      expect(typeof service.getTotemSessionId).toBe('function');
    });

    it('should have getTotemCustomerName method', () => {
      expect(typeof service.getTotemCustomerName).toBe('function');
    });

    it('should have isTotemSessionClosedState method', () => {
      expect(typeof service.isTotemSessionClosedState).toBe('function');
    });

    it('should have totemSubscribeToItems method', () => {
      expect(typeof service.totemSubscribeToItems).toBe('function');
    });

    it('should have totemCallWaiter method', () => {
      expect(typeof service.totemCallWaiter).toBe('function');
    });

    it('should have totemRequestBill method', () => {
      expect(typeof service.totemRequestBill).toBe('function');
    });

    it('should have totemGetTableInfo method', () => {
      expect(typeof service.totemGetTableInfo).toBe('function');
    });

    it('should have totemGetMyOrders method', () => {
      expect(typeof service.totemGetMyOrders).toBe('function');
    });

    it('should return null for getTotemSessionId when not joined', () => {
      expect(service.getTotemSessionId()).toBeNull();
    });

    it('should return null for getTotemCustomerName when not joined', () => {
      expect(service.getTotemCustomerName()).toBeNull();
    });

    it('should return false for isTotemSessionClosedState initially', () => {
      expect(service.isTotemSessionClosedState()).toBe(false);
    });
  });

  describe('KDS Methods', () => {
    it('should have joinKdsSession method', () => {
      expect(typeof service.joinKdsSession).toBe('function');
    });

    it('should have leaveKdsSession method', () => {
      expect(typeof service.leaveKdsSession).toBe('function');
    });

    it('should have kdsItemPrepare method', () => {
      expect(typeof service.kdsItemPrepare).toBe('function');
    });

    it('should have kdsItemServe method', () => {
      expect(typeof service.kdsItemServe).toBe('function');
    });
  });

  describe('Generic Methods', () => {
    it('should have emit method', () => {
      expect(typeof service.emit).toBe('function');
    });

    it('should have on method', () => {
      expect(typeof service.on).toBe('function');
    });

    it('should have off method', () => {
      expect(typeof service.off).toBe('function');
    });

    it('should return false when emitting while disconnected', () => {
      const result = service.emit('test:event', {});
      expect(result).toBe(false);
    });

    it('attaches a consumer listener when a new socket is created', () => {
      const consumerListener = jasmine.createSpy('consumerListener');
      service.on('custom:event', consumerListener);

      const listeners = new Map<string, (value: unknown) => void>();
      const fakeSocket = {
        io: { opts: { reconnection: true } },
        close: () => fakeSocket,
        on: (event: string, callback: (value: unknown) => void) => {
          listeners.set(event, callback);
          return fakeSocket;
        },
        off: (event: string) => {
          listeners.delete(event);
          return fakeSocket;
        },
      };
      Reflect.set(service, 'socket', fakeSocket);
      const attachConsumerListeners = Reflect.get(service, 'attachConsumerListeners') as () => void;

      attachConsumerListeners.call(service);
      listeners.get('custom:event')?.({ id: 'event' });

      expect(consumerListener).toHaveBeenCalledWith({ id: 'event' });
    });
  });

  describe('TAS Listeners', () => {
    it('should have registerTasListeners method', () => {
      expect(typeof service.registerTasListeners).toBe('function');
    });

    it('should have unregisterTasListeners method', () => {
      expect(typeof service.unregisterTasListeners).toBe('function');
    });

    it('should not throw when calling registerTasListeners', () => {
      expect(() => service.registerTasListeners()).not.toThrow();
    });

    it('should not throw when calling unregisterTasListeners', () => {
      expect(() => service.unregisterTasListeners()).not.toThrow();
    });

    it('should restore exactly one TAS listener set on a shared connection', () => {
      const listeners = new Map<string, Set<(value: unknown) => void>>();
      const fakeSocket = {
        io: { opts: { reconnection: true } },
        close: () => fakeSocket,
        on: (event: string, callback: (value: unknown) => void) => {
          const eventListeners = listeners.get(event) ?? new Set();
          eventListeners.add(callback);
          listeners.set(event, eventListeners);
          return fakeSocket;
        },
        off: (event: string, callback?: (value: unknown) => void) => {
          if (callback) {
            const eventListeners = listeners.get(event);
            eventListeners?.delete(callback);
            if (eventListeners?.size === 0) listeners.delete(event);
          } else {
            listeners.delete(event);
          }
          return fakeSocket;
        },
      };
      Reflect.set(service, 'socket', fakeSocket);

      service.registerTasListeners();
      service.registerTasListeners();

      expect(listeners.get('tas:item_added')?.size).toBe(1);
      expect(listeners.get('tas:bill_requested')?.size).toBe(1);
      expect(listeners.get('tas:error')?.size).toBe(1);

      service.unregisterTasListeners();

      expect(listeners.has('tas:item_added')).toBeFalse();
      expect(listeners.has('tas:bill_requested')).toBeFalse();
      expect(listeners.has('tas:error')).toBeFalse();
    });

    it('removes only TAS internal listeners and preserves consumer listeners', () => {
      const listeners = new Map<string, Set<(value: unknown) => void>>();
      const fakeSocket = {
        io: { opts: { reconnection: true } },
        close: () => fakeSocket,
        on: (event: string, callback: (value: unknown) => void) => {
          const eventListeners = listeners.get(event) ?? new Set();
          eventListeners.add(callback);
          listeners.set(event, eventListeners);
          return fakeSocket;
        },
        off: (event: string, callback?: (value: unknown) => void) => {
          if (callback) {
            const eventListeners = listeners.get(event);
            eventListeners?.delete(callback);
            if (eventListeners?.size === 0) listeners.delete(event);
          } else {
            listeners.delete(event);
          }
          return fakeSocket;
        },
      };
      Reflect.set(service, 'socket', fakeSocket);

      service.registerTasListeners();
      const consumerListener = jasmine.createSpy('consumerListener');
      const disposeConsumer = service.on('tas:item_added', consumerListener);

      service.unregisterTasListeners();

      expect(listeners.get('tas:item_added')?.size).toBe(1);
      listeners.get('tas:item_added')?.forEach(listener => listener({ item: {} }));
      expect(consumerListener).toHaveBeenCalled();

      disposeConsumer();
      expect(listeners.has('tas:item_added')).toBeFalse();
    });

    it('registers shared item-state and waiter-notification events only once', () => {
      const listeners = new Map<string, Set<(value: unknown) => void>>();
      const fakeSocket = {
        io: { opts: { reconnection: true } },
        close: () => fakeSocket,
        on: (event: string, callback: (value: unknown) => void) => {
          const eventListeners = listeners.get(event) ?? new Set();
          eventListeners.add(callback);
          listeners.set(event, eventListeners);
          return fakeSocket;
        },
        off: () => fakeSocket,
      };
      Reflect.set(service, 'socket', fakeSocket);

      (Reflect.get(service, 'setupKdsListeners') as () => void).call(service);
      (Reflect.get(service, 'setupTasListeners') as () => void).call(service);
      (Reflect.get(service, 'setupTotemListeners') as () => void).call(service);

      expect(listeners.get('item:state_changed')?.size).toBe(1);
      expect(listeners.get('notification:from_waiter')?.size).toBe(1);
    });
  });

  describe('Observables', () => {
    it('should have totemItemUpdate$ observable', () => {
      expect(service.totemItemUpdate$).toBeDefined();
    });

    it('should have totemItemsAdded$ observable', () => {
      expect(service.totemItemsAdded$).toBeDefined();
    });

    it('should have totemWaiterNotification$ observable', () => {
      expect(service.totemWaiterNotification$).toBeDefined();
    });

    it('should have totemOrderConfirmed$ observable', () => {
      expect(service.totemOrderConfirmed$).toBeDefined();
    });

    it('should have totemHelpRequestConfirmed$ observable', () => {
      expect(service.totemHelpRequestConfirmed$).toBeDefined();
    });

    it('should have totemBillRequestConfirmed$ observable', () => {
      expect(service.totemBillRequestConfirmed$).toBeDefined();
    });

    it('should have totemCustomerJoined$ observable', () => {
      expect(service.totemCustomerJoined$).toBeDefined();
    });

    it('should have totemCustomerLeft$ observable', () => {
      expect(service.totemCustomerLeft$).toBeDefined();
    });

    it('should have totemTableOrderUpdate$ observable', () => {
      expect(service.totemTableOrderUpdate$).toBeDefined();
    });

    it('should have totemTableInfo$ observable', () => {
      expect(service.totemTableInfo$).toBeDefined();
    });

    it('should have totemSessionClosed$ observable', () => {
      expect(service.totemSessionClosed$).toBeDefined();
    });

    it('should have totemForceDisconnect$ observable', () => {
      expect(service.totemForceDisconnect$).toBeDefined();
    });

    it('should have totemError$ observable', () => {
      expect(service.totemError$).toBeDefined();
    });

    it('should have tasItemAdded$ observable', () => {
      expect(service.tasItemAdded$).toBeDefined();
    });

    it('should have tasItemServed$ observable', () => {
      expect(service.tasItemServed$).toBeDefined();
    });

    it('should have tasItemCanceled$ observable', () => {
      expect(service.tasItemCanceled$).toBeDefined();
    });

    it('should have tasBillRequested$ observable', () => {
      expect(service.tasBillRequested$).toBeDefined();
    });

    it('should have tasHelpRequested$ observable', () => {
      expect(service.tasHelpRequested$).toBeDefined();
    });

    it('should have tasNewCustomerOrder$ observable', () => {
      expect(service.tasNewCustomerOrder$).toBeDefined();
    });

    it('should have tasCustomerBillRequest$ observable', () => {
      expect(service.tasCustomerBillRequest$).toBeDefined();
    });

    it('should have tasNotification$ observable', () => {
      expect(service.tasNotification$).toBeDefined();
    });

    it('should have tasError$ observable', () => {
      expect(service.tasError$).toBeDefined();
    });
  });

  describe('Reset Connection', () => {
    it('should have resetConnection method', () => {
      expect(typeof service.resetConnection).toBe('function');
    });

    it('should not throw when resetting connection', () => {
      service.acquireConnection();
      expect(() => service.resetConnection()).not.toThrow();
    });
  });
});
