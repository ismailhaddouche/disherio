import { TestBed } from '@angular/core/testing';
import { KdsSocketService } from './kds-socket.service';
import { SocketConnectionService } from './socket-connection.service';

describe('KdsSocketService', () => {
  let service: KdsSocketService;
  let connection: jasmine.SpyObj<SocketConnectionService>;

  beforeEach(() => {
    connection = jasmine.createSpyObj('SocketConnectionService', [
      'registerReconnectHandler', 'isConnected', 'emit',
    ]);
    TestBed.configureTestingModule({
      providers: [{ provide: SocketConnectionService, useValue: connection }],
    });
    service = TestBed.inject(KdsSocketService);
  });

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

  it('joinKdsSession emits kds:join once per session when connected', () => {
    connection.isConnected.and.returnValue(true);
    service.joinKdsSession('s1');
    service.joinKdsSession('s1');
    expect(connection.emit).toHaveBeenCalledTimes(1);
    expect(connection.emit).toHaveBeenCalledWith('kds:join', 's1');
  });

  it('joinKdsSession tracks the session without emitting when disconnected', () => {
    connection.isConnected.and.returnValue(false);
    service.joinKdsSession('s1');
    expect(connection.emit).not.toHaveBeenCalled();
    connection.isConnected.and.returnValue(true);
    service.leaveKdsSession('s1');
    expect(connection.emit).toHaveBeenCalledWith('kds:leave', 's1');
  });
});
