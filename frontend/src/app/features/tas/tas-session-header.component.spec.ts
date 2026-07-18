import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { I18nService } from '../../core/services/i18n.service';
import { RestaurantService } from '../../core/services/restaurant.service';
import type { ItemOrder, TotemSession } from '../../types';
import type { TasSessionActionsService } from './tas-session-actions.service';
import { TasSessionHeaderComponent } from './tas-session-header.component';

function createSession(overrides: Partial<TotemSession> = {}): TotemSession {
  return {
    _id: 'session-1',
    totem_id: 'totem-1',
    session_date_start: '2026-07-18T10:00:00.000Z',
    totem_state: 'STARTED',
    totem: {
      _id: 'totem-1',
      restaurant_id: 'restaurant-1',
      totem_name: 'Table 1',
      totem_qr: 'qr-1',
      totem_type: 'STANDARD',
    },
    ...overrides,
  };
}

function createItem(overrides: Partial<ItemOrder> = {}): ItemOrder {
  return {
    _id: 'item-1',
    order_id: 'order-1',
    session_id: 'session-1',
    item_dish_id: 'dish-1',
    item_state: 'ORDERED',
    item_disher_type: 'KITCHEN',
    item_name_snapshot: [{ lang: 'en', value: 'Dish' }],
    item_base_price: 10,
    item_disher_extras: [],
    ...overrides,
  };
}

function createActionsMock() {
  return {
    isClosingSession: signal(false),
    isCancellingSession: signal(false),
    isArchivingSession: signal(false),
    isReopeningSession: signal(false),
    closeSession: jasmine.createSpy('closeSession'),
    cancelSession: jasmine.createSpy('cancelSession'),
    archiveSession: jasmine.createSpy('archiveSession'),
    reopenSession: jasmine.createSpy('reopenSession'),
    closeTemporaryTotem: jasmine.createSpy('closeTemporaryTotem'),
  };
}

describe('TasSessionHeaderComponent', () => {
  let fixture: ComponentFixture<TasSessionHeaderComponent>;
  let component: TasSessionHeaderComponent;
  let actions: ReturnType<typeof createActionsMock>;

  beforeEach(async () => {
    actions = createActionsMock();

    await TestBed.configureTestingModule({
      imports: [TasSessionHeaderComponent],
      providers: [
        { provide: I18nService, useValue: { translate: (key: string) => key, currentLang: () => 'en' } },
        { provide: RestaurantService, useValue: { currency: () => 'EUR' } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TasSessionHeaderComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('session', createSession());
    fixture.componentRef.setInput('sessionItems', []);
    fixture.componentRef.setInput('sessionTotal', 42);
    fixture.componentRef.setInput('pendingCount', 0);
    fixture.componentRef.setInput('isProcessingPayment', false);
    fixture.componentRef.setInput('actions', actions as unknown as TasSessionActionsService);
    fixture.detectChanges();
  });

  it('emits toggleTables and toggleCart from the nav buttons', () => {
    const tablesSpy = jasmine.createSpy('toggleTables');
    const cartSpy = jasmine.createSpy('toggleCart');
    component.toggleTables.subscribe(tablesSpy);
    component.toggleCart.subscribe(cartSpy);

    (fixture.nativeElement.querySelector('button[aria-label="tas.tables"]') as HTMLButtonElement).click();
    (fixture.nativeElement.querySelector('button[aria-label="tas.pending_items"]') as HTMLButtonElement).click();

    expect(tablesSpy).toHaveBeenCalledTimes(1);
    expect(cartSpy).toHaveBeenCalledTimes(1);
  });

  it('shows the pending count badge only when there are pending items', () => {
    expect(fixture.nativeElement.textContent).not.toContain('>0<');

    fixture.componentRef.setInput('pendingCount', 3);
    fixture.detectChanges();

    const badge = fixture.nativeElement.querySelector('.bg-error') as HTMLElement;
    expect(badge.textContent.trim()).toBe('3');
  });

  it('emits showQr with the session when the totem has a QR', () => {
    const qrSpy = jasmine.createSpy('showQr');
    component.showQr.subscribe(qrSpy);

    (fixture.nativeElement.querySelector('button[aria-label="tas.show_qr"]') as HTMLButtonElement).click();

    expect(qrSpy).toHaveBeenCalledOnceWith(component.session());
  });

  it('closes and cancels open sessions through the actions service', () => {
    (fixture.nativeElement.querySelector('button[aria-label="tas.close_session"]') as HTMLButtonElement).click();
    expect(actions.closeSession).toHaveBeenCalledOnceWith('session-1');

    (fixture.nativeElement.querySelector('button[aria-label="tas.cancel_session"]') as HTMLButtonElement).click();
    expect(actions.cancelSession).toHaveBeenCalledOnceWith('session-1');
  });

  it('emits charge and archives or reopens closed sessions', () => {
    fixture.componentRef.setInput('session', createSession({ totem_state: 'COMPLETE' }));
    fixture.componentRef.setInput('sessionItems', [createItem()]);
    fixture.detectChanges();
    const chargeSpy = jasmine.createSpy('charge');
    component.charge.subscribe(chargeSpy);

    (fixture.nativeElement.querySelector('button[title="pos.charge"]') as HTMLButtonElement).click();
    expect(chargeSpy).toHaveBeenCalledTimes(1);

    (fixture.nativeElement.querySelector('button[aria-label="tas.archive_session"]') as HTMLButtonElement).click();
    expect(actions.archiveSession).toHaveBeenCalledOnceWith('session-1');

    (fixture.nativeElement.querySelector('button[aria-label="tas.reopen_session"]') as HTMLButtonElement).click();
    expect(actions.reopenSession).toHaveBeenCalledOnceWith('session-1', 'totem-1');
  });

  it('closes temporary totems through the actions service', () => {
    fixture.componentRef.setInput('session', createSession({
      totem: {
        _id: 'totem-1',
        restaurant_id: 'restaurant-1',
        totem_name: 'Patio',
        totem_qr: 'qr-1',
        totem_type: 'TEMPORARY',
      },
    }));
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('button[aria-label="tas.close_temporary_table"]') as HTMLButtonElement).click();

    expect(actions.closeTemporaryTotem).toHaveBeenCalledOnceWith('totem-1');
  });

  describe('formatOrderLimit', () => {
    it('returns zero when the session has no limit status', () => {
      expect(component.formatOrderLimit(createSession())).toBe('0');
    });

    it('formats the count against the maximum', () => {
      const session = createSession({
        order_limit_status: {
          interval_minutes: 60,
          max_orders_per_session: 3,
          limited_order_count: 1,
          remaining_limited_orders: 2,
          next_limited_order_at: null,
        },
      });

      expect(component.formatOrderLimit(session)).toBe('1/3');
    });

    it('counts live limited orders ignoring canceled and unlimited items', () => {
      fixture.componentRef.setInput('sessionItems', [
        createItem({ order_id: 'order-1' }),
        createItem({ _id: 'item-2', order_id: 'order-1' }),
        createItem({ _id: 'item-3', order_id: 'order-2' }),
        createItem({ _id: 'item-4', order_id: 'order-3', item_state: 'CANCELED' }),
        createItem({ _id: 'item-5', order_id: 'order-4', unlimited_order_item: true }),
      ]);
      const session = createSession({
        order_limit_status: {
          interval_minutes: 60,
          max_orders_per_session: 0,
          limited_order_count: 1,
          remaining_limited_orders: null,
          next_limited_order_at: null,
        },
      });

      expect(component.formatOrderLimit(session)).toBe('2');
    });
  });
});
