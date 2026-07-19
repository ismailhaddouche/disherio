import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { I18nService } from '../../core/services/i18n.service';
import { RestaurantService } from '../../core/services/restaurant.service';
import { LocalizationService } from '../../core/services/localization.service';
import { OrderWorkspaceState } from '../../store/order-workspace.state';
import type { Customer, Dish, ItemOrder, LocalizedField, TotemSession } from '../../types';
import { PosSessionPanelComponent, type PosAssignSelectEvent } from './pos-session-panel.component';

class TestOrderWorkspaceState extends OrderWorkspaceState {
  readonly items = signal<ItemOrder[]>([]);
  readonly customersList = signal<Customer[]>([]);
  readonly dishes = signal<Dish[]>([]);

  protected override getWorkspaceItems(): ItemOrder[] {
    return this.items();
  }

  protected override getWorkspaceCustomers(): Customer[] {
    return this.customersList();
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

function createSession(): TotemSession {
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

function buttonByText(fixture: ComponentFixture<unknown>, text: string): HTMLButtonElement | null {
  const buttons = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
  return buttons.find(button => button.textContent?.includes(text)) ?? null;
}

describe('PosSessionPanelComponent', () => {
  let fixture: ComponentFixture<PosSessionPanelComponent>;
  let component: PosSessionPanelComponent;
  let state: TestOrderWorkspaceState;
  const customers: Customer[] = [
    { _id: 'customer-1', session_id: 'session-1', customer_name: 'Alex' },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PosSessionPanelComponent],
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
    fixture = TestBed.createComponent(PosSessionPanelComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('session', createSession());
    fixture.componentRef.setInput('state', state);
    fixture.componentRef.setInput('customers', customers);
    fixture.componentRef.setInput('showAddCustomer', false);
    fixture.componentRef.setInput('newCustomerName', '');
    fixture.detectChanges();
  });

  it('renders the customer tabs and selects a customer on click', () => {
    buttonByText(fixture, 'Alex')?.click();
    fixture.detectChanges();

    expect(state.selectedCustomerId()).toBe('customer-1');

    buttonByText(fixture, 'tas.all')?.click();
    fixture.detectChanges();

    expect(state.selectedCustomerId()).toBeNull();
  });

  it('opens the add-customer row through the model and emits addCustomer', () => {
    const shown: boolean[] = [];
    component.showAddCustomer.subscribe(value => shown.push(value));
    const addSpy = jasmine.createSpy('addCustomer');
    component.addCustomer.subscribe(addSpy);

    buttonByText(fixture, 'tas.add_customer')?.click();
    fixture.detectChanges();

    expect(shown).toEqual([true]);
    expect(fixture.nativeElement.querySelector('input')).not.toBeNull();

    buttonByText(fixture, 'common.add')?.click();
    expect(addSpy).toHaveBeenCalledTimes(1);
  });

  it('emits assignSelect with the item id when the assignment changes', () => {
    state.items.set([createItem()]);
    fixture.detectChanges();
    const events: PosAssignSelectEvent[] = [];
    component.assignSelect.subscribe(event => events.push(event));

    const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
    select.value = 'customer-1';
    select.dispatchEvent(new Event('change'));

    expect(events).toHaveSize(1);
    expect(events[0].itemId).toBe('item-1');
    expect((events[0].event.target as HTMLSelectElement).value).toBe('customer-1');
  });

  it('emits addOrder from the bottom button', () => {
    const addSpy = jasmine.createSpy('addOrder');
    component.addOrder.subscribe(addSpy);

    buttonByText(fixture, 'tas.add_order')?.click();

    expect(addSpy).toHaveBeenCalledTimes(1);
  });

  it('maps item states to translated labels', () => {
    expect(component.getStateLabel('ORDERED')).toBe('order_state.ordered');
    expect(component.getStateLabel('ON_PREPARE')).toBe('order_state.preparing');
    expect(component.getStateLabel('SERVED')).toBe('order_state.served');
    expect(component.getStateLabel('CANCELED')).toBe('order_state.canceled');
    expect(component.getStateLabel('UNKNOWN')).toBe('UNKNOWN');
  });
});
