import { TestBed } from '@angular/core/testing';
import { TotemSocketService } from './totem-socket.service';
import { SocketConnectionService } from './socket-connection.service';

describe('TotemSocketService', () => {
  let service: TotemSocketService;
  let connection: jasmine.SpyObj<SocketConnectionService>;

  beforeEach(() => {
    connection = jasmine.createSpyObj('SocketConnectionService', [
      'registerTotemEventDelegate', 'registerReconnectHandler', 'registerResetHandler',
      'isConnected', 'hasSocket', 'getIsPublicTotemConnection', 'getConnectedTotemQr',
      'setPublicTotemQr', 'connect', 'disconnect', 'emit',
    ]);
    TestBed.configureTestingModule({
      providers: [{ provide: SocketConnectionService, useValue: connection }],
    });
    service = TestBed.inject(TotemSocketService);
  });

  it('registers itself as the totem event delegate', () => {
    expect(connection.registerTotemEventDelegate).toHaveBeenCalledWith(service);
  });

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

  it('rejoins when the session token rotates after reconnect reconciliation', () => {
    connection.hasSocket.and.returnValue(true);
    connection.isConnected.and.returnValue(true);
    connection.emit.and.returnValue(true);
    connection.getIsPublicTotemConnection.and.returnValue(true);
    connection.getConnectedTotemQr.and.returnValue('table-1');

    service.joinTotemSession('session-1', 'table-1', 'Alex', 'customer-1', 'token-1');
    service.joinTotemSession('session-1', 'table-1', 'Alex', 'customer-1', 'token-1');
    service.joinTotemSession('session-1', 'table-1', 'Alex', 'customer-1', 'token-2');

    expect(connection.emit).toHaveBeenCalledTimes(2);
    expect(connection.emit).toHaveBeenCalledWith('totem:join_session', jasmine.objectContaining({
      sessionId: 'session-1',
      sessionToken: 'token-2',
    }));
  });

  it('does not queue a duplicate join while the connection is still opening', () => {
    connection.hasSocket.and.returnValue(true);
    connection.isConnected.and.returnValue(false);
    connection.getIsPublicTotemConnection.and.returnValue(true);
    connection.getConnectedTotemQr.and.returnValue('table-1');

    service.joinTotemSession('session-1', 'table-1', 'Alex', 'customer-1', 'token-1');

    expect(connection.emit).not.toHaveBeenCalled();
  });

  it('rebuilds a reconnecting socket when its handshake uses the wrong QR', () => {
    connection.hasSocket.and.returnValue(true);
    connection.isConnected.and.returnValue(false);
    connection.getIsPublicTotemConnection.and.returnValue(true);
    connection.getConnectedTotemQr.and.returnValue('old-table');

    service.joinTotemSession('session-1', 'new-table', 'Alex', 'customer-1', 'token-1');

    expect(connection.disconnect).toHaveBeenCalledTimes(1);
    expect(connection.connect).toHaveBeenCalledTimes(1);
  });
});
