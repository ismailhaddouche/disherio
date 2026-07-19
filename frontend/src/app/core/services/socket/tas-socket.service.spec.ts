import { TestBed } from '@angular/core/testing';
import { TasSocketService } from './tas-socket.service';
import { SocketConnectionService } from './socket-connection.service';

describe('TasSocketService', () => {
  let service: TasSocketService;
  let connection: jasmine.SpyObj<SocketConnectionService>;

  beforeEach(() => {
    connection = jasmine.createSpyObj('SocketConnectionService', [
      'registerReconnectHandler', 'registerResetHandler',
      'isConnected', 'emit', 'reregisterTasListeners', 'unregisterTasListeners',
    ]);
    TestBed.configureTestingModule({
      providers: [{ provide: SocketConnectionService, useValue: connection }],
    });
    service = TestBed.inject(TasSocketService);
  });

  it('joinTasSession leaves the previous session before joining', () => {
    connection.isConnected.and.returnValue(true);
    service.joinTasSession('s1');
    service.joinTasSession('s2');
    expect(connection.emit).toHaveBeenCalledWith('tas:leave', 's1');
    expect(connection.emit).toHaveBeenCalledWith('tas:join', 's2');
  });

  it('does not emit when disconnected but still tracks the session', () => {
    connection.isConnected.and.returnValue(false);
    service.joinTasSession('s1');
    expect(connection.emit).not.toHaveBeenCalled();
    connection.isConnected.and.returnValue(true);
    service.joinTasSession('s2'); // leaves s1 from tracked state
    expect(connection.emit).toHaveBeenCalledWith('tas:leave', 's1');
  });

  it('should have registerTasListeners method', () => {
    expect(typeof service.registerTasListeners).toBe('function');
  });

  it('should have unregisterTasListeners method', () => {
    expect(typeof service.unregisterTasListeners).toBe('function');
  });

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

  it('registerTasListeners delegates to the connection service', () => {
    service.registerTasListeners();
    expect(connection.reregisterTasListeners).toHaveBeenCalled();
  });

  it('unregisterTasListeners delegates to the connection service', () => {
    service.unregisterTasListeners();
    expect(connection.unregisterTasListeners).toHaveBeenCalled();
  });
});
