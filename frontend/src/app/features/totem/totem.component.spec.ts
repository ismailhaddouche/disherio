import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, of } from 'rxjs';
import { cartStore } from '../../store/cart.store';
import { ThemeService } from '../../core/services/theme.service';
import { I18nService } from '../../core/services/i18n.service';
import { SocketConnectionService } from '../../core/services/socket/socket-connection.service';
import { TotemSocketService } from '../../core/services/socket/totem-socket.service';
import { NotificationService } from '../../core/services/notification.service';
import { LocalizationService } from '../../core/services/localization.service';
import { TotemService, type PublicTotemSession } from '../../core/services/totem.service';
import { ConfirmationService } from '../../core/services/confirmation.service';
import { TotemCartService } from './totem-cart.service';
import { TotemComponent } from './totem.component';

interface TotemComponentInternals {
  refreshSessionInfo: () => void;
}

describe('TotemComponent cart session isolation', () => {
  let totemSessionClosed$: Subject<void>;
  let totemForceDisconnect$: Subject<void>;
  let startSessionByQR: jasmine.Spy;

  function createSession(sessionId: string): PublicTotemSession {
    return {
      session_id: sessionId,
      totem_id: 'totem-1',
      totem_name: 'Table 1',
      restaurant_id: 'restaurant-1',
      totem_state: 'STARTED',
      session_token: `token-${sessionId}`,
    };
  }

  function createComponent(): TotemComponent {
    return TestBed.runInInjectionContext(() => new TotemComponent());
  }

  beforeEach(() => {
    totemSessionClosed$ = new Subject<void>();
    totemForceDisconnect$ = new Subject<void>();
    startSessionByQR = jasmine.createSpy('startSessionByQR');

    TestBed.configureTestingModule({
      providers: [
        TotemCartService,
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => 'qr-token-1' } } },
        },
        { provide: Router, useValue: { navigate: jasmine.createSpy('navigate') } },
        {
          provide: SocketConnectionService,
          useValue: {
            acquireConnection: jasmine.createSpy('acquireConnection'),
            releaseConnection: jasmine.createSpy('releaseConnection'),
            totemSessionClosed$,
            totemForceDisconnect$,
          },
        },
        {
          provide: TotemSocketService,
          useValue: {
            joinTotemSession: jasmine.createSpy('joinTotemSession'),
            leaveTotemSession: jasmine.createSpy('leaveTotemSession'),
          },
        },
        { provide: ThemeService, useValue: {} },
        { provide: I18nService, useValue: { translate: (key: string) => key } },
        {
          provide: NotificationService,
          useValue: {
            info: jasmine.createSpy('info'),
            success: jasmine.createSpy('success'),
            error: jasmine.createSpy('error'),
          },
        },
        {
          provide: LocalizationService,
          useValue: { localize: (value: Array<{ value: string }>) => value[0]?.value ?? '' },
        },
        {
          provide: TotemService,
          useValue: {
            getMenuByQR: () => of({ categories: [], dishes: [] }),
            startSessionByQR,
          },
        },
        { provide: ConfirmationService, useValue: { confirm: () => of(true) } },
      ],
    });

    cartStore.clear();
  });

  afterEach(() => cartStore.clear());

  it('empties the cart when the waiter closes the session', () => {
    startSessionByQR.and.returnValue(of(createSession('session-close-1')));
    const component = createComponent();
    component.ngOnInit();

    cartStore.addItem({ dishId: 'dish-1', name: 'Burger', price: 10, extras: [] });
    expect(cartStore.items()).toHaveSize(1);

    totemSessionClosed$.next();

    expect(cartStore.items()).toEqual([]);
    expect(component.sessionClosedScreen()).toBeTrue();
  });

  it('empties the cart on a forced disconnect', () => {
    startSessionByQR.and.returnValue(of(createSession('session-close-2')));
    const component = createComponent();
    component.ngOnInit();

    cartStore.addItem({ dishId: 'dish-1', name: 'Burger', price: 10, extras: [] });

    totemForceDisconnect$.next();

    expect(cartStore.items()).toEqual([]);
  });

  it('does not inherit leftover items when a different session loads', () => {
    // Simulate items left behind by a previous customer/POS usage.
    cartStore.addItem({ dishId: 'dish-1', name: 'Burger', price: 10, extras: [] });
    startSessionByQR.and.returnValue(of(createSession('session-new-1')));

    createComponent().ngOnInit();

    expect(cartStore.items()).toEqual([]);
  });

  it('keeps the cart when the same session is refreshed', () => {
    startSessionByQR.and.returnValue(of(createSession('session-same-1')));
    const component = createComponent();
    component.ngOnInit();

    cartStore.addItem({ dishId: 'dish-1', name: 'Burger', price: 10, extras: [] });

    (component as unknown as TotemComponentInternals).refreshSessionInfo();

    expect(cartStore.items()).toHaveSize(1);
  });
});
