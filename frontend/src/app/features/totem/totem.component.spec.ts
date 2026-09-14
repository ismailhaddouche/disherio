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
import type { ItemOrder } from '../../types';

interface TotemComponentInternals {
  refreshSessionInfo: () => void;
}

describe('TotemComponent cart session isolation', () => {
  let totemSessionClosed$: Subject<void>;
  let totemForceDisconnect$: Subject<void>;
  let connectionRestored$: Subject<void>;
  let startSessionByQR: jasmine.Spy;
  let getCustomerOrders: jasmine.Spy;
  let getSessionOrders: jasmine.Spy;

  const order = (id: string): ItemOrder => ({
    _id: id,
    order_id: 'order-1',
    session_id: 'session-reconnect-1',
    item_dish_id: 'dish-1',
    item_state: 'ORDERED',
    item_disher_type: 'KITCHEN',
    item_name_snapshot: [{ lang: 'en', value: id }],
    item_base_price: 10,
    item_disher_extras: [],
  });

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
    connectionRestored$ = new Subject<void>();
    startSessionByQR = jasmine.createSpy('startSessionByQR');
    getCustomerOrders = jasmine.createSpy('getCustomerOrders').and.returnValue(of([]));
    getSessionOrders = jasmine.createSpy('getSessionOrders').and.returnValue(of([]));

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
            connectionRestored$,
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
            getCustomerOrders,
            getSessionOrders,
          },
        },
        { provide: ConfirmationService, useValue: { confirm: () => of(true) } },
      ],
    });

    cartStore.clear();
  });

  afterEach(() => {
    cartStore.clear();
    sessionStorage.removeItem('totem_customer_session-reconnect-1');
  });

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

  it('refreshes the session token before reconciling orders after reconnect', () => {
    const sessionId = 'session-reconnect-1';
    const refreshedSession$ = new Subject<PublicTotemSession>();
    const original = createSession(sessionId);
    const refreshed = { ...original, session_token: 'rotated-token' };
    sessionStorage.setItem(`totem_customer_${sessionId}`, JSON.stringify({
      customer_id: 'customer-1',
      customer_name: 'Alex',
    }));
    startSessionByQR.and.returnValues(of(original), refreshedSession$);
    const component = createComponent();
    component.ngOnInit();
    component.currentView.set('my-orders');

    connectionRestored$.next();
    expect(getCustomerOrders).not.toHaveBeenCalled();

    refreshedSession$.next(refreshed);
    expect(getCustomerOrders).toHaveBeenCalledOnceWith(
      'qr-token-1',
      sessionId,
      'customer-1',
      'rotated-token'
    );
  });

  it('ignores an older session refresh that completes after a newer one', () => {
    const original = createSession('session-race-1');
    const older = new Subject<PublicTotemSession>();
    const newer = new Subject<PublicTotemSession>();
    startSessionByQR.and.returnValues(of(original), older, newer);
    const component = createComponent();
    component.ngOnInit();

    const internals = component as unknown as TotemComponentInternals;
    internals.refreshSessionInfo();
    internals.refreshSessionInfo();
    newer.next({ ...original, session_token: 'newer-token' });
    older.next({ ...original, session_token: 'older-token' });

    expect(component.sessionInfo()?.session_token).toBe('newer-token');
  });

  it('ignores an older order snapshot that completes after a newer one', () => {
    const older = new Subject<ItemOrder[]>();
    const newer = new Subject<ItemOrder[]>();
    startSessionByQR.and.returnValue(of(createSession('session-reconnect-1')));
    getSessionOrders.and.returnValues(older, newer);
    const component = createComponent();
    component.ngOnInit();

    component.setView('all-orders');
    component.setView('all-orders');
    newer.next([order('newer-item')]);
    older.next([order('older-item')]);

    expect(component.allOrders().map(entry => entry._id)).toEqual(['newer-item']);
  });
});
