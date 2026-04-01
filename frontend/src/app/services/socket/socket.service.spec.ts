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

    it('should have tasMarkBillAsPaid method', () => {
      expect(typeof service.tasMarkBillAsPaid).toBe('function');
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

    it('should have totemPlaceOrder method', () => {
      expect(typeof service.totemPlaceOrder).toBe('function');
    });

    it('should have totemAddItem method', () => {
      expect(typeof service.totemAddItem).toBe('function');
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

    it('should have tasBillPaid$ observable', () => {
      expect(service.tasBillPaid$).toBeDefined();
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
