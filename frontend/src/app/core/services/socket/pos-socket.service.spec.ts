import { TestBed } from '@angular/core/testing';
import { PosSocketService } from './pos-socket.service';
import { KdsSocketService } from './kds-socket.service';
import { SocketConnectionService } from './socket-connection.service';

describe('PosSocketService', () => {
  let service: PosSocketService;
  let connection: jasmine.SpyObj<SocketConnectionService>;
  let kds: jasmine.SpyObj<KdsSocketService>;

  beforeEach(() => {
    connection = jasmine.createSpyObj('SocketConnectionService', [
      'registerReconnectHandler', 'isConnected', 'emit',
    ]);
    kds = jasmine.createSpyObj('KdsSocketService', ['joinKdsSession']);
    TestBed.configureTestingModule({
      providers: [
        { provide: SocketConnectionService, useValue: connection },
        { provide: KdsSocketService, useValue: kds },
      ],
    });
    service = TestBed.inject(PosSocketService);
  });

  it('should have joinSession method', () => {
    expect(typeof service.joinSession).toBe('function');
  });

  it('should have leaveSession method', () => {
    expect(typeof service.leaveSession).toBe('function');
  });
});
