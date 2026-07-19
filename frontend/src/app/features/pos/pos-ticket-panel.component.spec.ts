import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { I18nService } from '../../core/services/i18n.service';
import { RestaurantService } from '../../core/services/restaurant.service';
import { LocalizationService } from '../../core/services/localization.service';
import { OrderWorkspaceState } from '../../store/order-workspace.state';
import { authStore, type AuthUser } from '../../store/auth.store';
import type { Customer, Dish, ItemOrder, LocalizedField, TotemSession } from '../../types';
import type { PosSessionActionsService } from './pos-session-actions.service';
import { PosTicketPanelComponent } from './pos-ticket-panel.component';

class TestOrderWorkspaceState extends OrderWorkspaceState {
  readonly items = signal<ItemOrder[]>([]);
  readonly customers = signal<Customer[]>([]);
  readonly dishes = signal<Dish[]>([]);

  protected override getWorkspaceItems(): ItemOrder[] {
    return this.items();
  }

  protected override getWorkspaceCustomers(): Customer[] {
    return this.customers();
  }

  protected override getWorkspaceDishes(): Dish[] {
    return this.dishes();
  }

  protected override getWorkspaceTotal(): number {
    return 0;
  }

  protected override getFallbackCustomerName(part: number): string {
    return `Customer ${part}`;
  }
}

function createDish(overrides: Partial<Dish> = {}): Dish {
  return {
    _id: 'dish-1',
    restaurant_id: 'restaurant-1',
    category_id: 'category-1',
    disher_name: [{ lang: 'en', value: 'Dish' }],
    disher_price: 10,
    disher_type: 'KITCHEN',
    disher_status: 'ACTIVATED',
    disher_alergens: [],
    disher_variant: false,
    variants: [],
    extras: [],
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

function createSession(overrides: Partial<TotemSession> = {}): TotemSession {
  return {
    _id: 'session-1',
    totem_id: 'totem-1',
    session_date_start: '2026-07-18T10:00:00.000Z',
    totem_state: 'STARTED',
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
  };
}

function buttonByText(fixture: ComponentFixture<unknown>, text: string): HTMLButtonElement | null {
  const buttons = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
  return buttons.find(button => button.textContent?.includes(text)) ?? null;
}

describe('PosTicketPanelComponent', () => {
  let fixture: ComponentFixture<PosTicketPanelComponent>;
  let component: PosTicketPanelComponent;
  let state: TestOrderWorkspaceState;
  let actions: ReturnType<typeof createActionsMock>;

  beforeEach(async () => {
    actions = createActionsMock();

    await TestBed.configureTestingModule({
      imports: [PosTicketPanelComponent],
      providers: [
        { provide: I18nService, useValue: { translate: (key: string) => key, currentLang: () => 'en' } },
        { provide: RestaurantService, useValue: { currency: () => 'EUR' } },
        {
          provide: LocalizationService,
          useValue: { localize: (value: LocalizedField | null | undefined) => value?.[0]?.value ?? '' },
        },
      ],
    }).compileComponents();

    state = new TestOrderWorkspaceState();
    fixture = TestBed.createComponent(PosTicketPanelComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('state', state);
    fixture.componentRef.setInput('session', createSession());
    fixture.componentRef.setInput('sessionItems', []);
    fixture.componentRef.setInput('sessionTotal', 25);
    fixture.componentRef.setInput('isSessionClosed', false);
    fixture.componentRef.setInput('isSendingOrder', false);
    fixture.componentRef.setInput('actions', actions as unknown as PosSessionActionsService);
    fixture.detectChanges();
  });

  afterEach(() => authStore.clearAuth());

  it('totals the whole session when no customer is selected', () => {
    expect(component.getSelectedCustomerTotal()).toBe(25);
  });

  it('totals only the active items of the selected customer', () => {
    const items = [
      createItem({ customer_id: 'customer-1', item_base_price: 8 }),
      createItem({ _id: 'item-2', customer_id: 'customer-1', item_state: 'CANCELED', item_base_price: 50 }),
      createItem({ _id: 'item-3', customer_id: 'customer-2', item_base_price: 7 }),
    ];
    fixture.componentRef.setInput('sessionItems', items);
    state.selectedCustomerId.set('customer-1');
    fixture.detectChanges();

    expect(component.getSelectedCustomerTotal()).toBe(8);
  });

  it('emits sendOrder when pending items exist', () => {
    state.quickAddToCart(createDish());
    fixture.detectChanges();
    const sendSpy = jasmine.createSpy('sendOrder');
    component.sendOrder.subscribe(sendSpy);

    buttonByText(fixture, 'tas.send_order')?.click();

    expect(sendSpy).toHaveBeenCalledTimes(1);
  });

  it('closes the session through the actions service', () => {
    buttonByText(fixture, 'tas.close_session')?.click();

    expect(actions.closeSession).toHaveBeenCalledOnceWith('session-1');
  });

  it('offers cancellation only when the session has no items', () => {
    expect(buttonByText(fixture, 'tas.cancel_session')).not.toBeNull();

    fixture.componentRef.setInput('sessionItems', [createItem()]);
    fixture.detectChanges();

    expect(buttonByText(fixture, 'tas.cancel_session')).toBeNull();
  });

  it('emits charge for closed sessions when the user can create payments', () => {
    authStore.setAuth({ permissions: ['POS'] } as AuthUser, 0);
    fixture.componentRef.setInput('isSessionClosed', true);
    fixture.componentRef.setInput('sessionItems', [createItem()]);
    fixture.detectChanges();
    const chargeSpy = jasmine.createSpy('charge');
    component.charge.subscribe(chargeSpy);

    buttonByText(fixture, 'pos.charge')?.click();

    expect(chargeSpy).toHaveBeenCalledTimes(1);
  });

  it('archives and reopens closed sessions through the actions service', () => {
    fixture.componentRef.setInput('isSessionClosed', true);
    fixture.detectChanges();

    buttonByText(fixture, 'tas.archive_session')?.click();
    expect(actions.archiveSession).toHaveBeenCalledOnceWith('session-1');

    buttonByText(fixture, 'tas.reopen_session')?.click();
    expect(actions.reopenSession).toHaveBeenCalledOnceWith('session-1');
  });
});
