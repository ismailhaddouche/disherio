import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { I18nService } from '../../core/services/i18n.service';
import { RestaurantService } from '../../core/services/restaurant.service';
import { LocalizationService } from '../../services/localization.service';
import { OrderWorkspaceState } from '../../shared/state/order-workspace.state';
import type { Customer, Dish, ItemOrder, LocalizedField } from '../../types';
import { TasSessionItemsComponent, type TasAssignItemEvent } from './tas-session-items.component';

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

describe('TasSessionItemsComponent', () => {
  let fixture: ComponentFixture<TasSessionItemsComponent>;
  let component: TasSessionItemsComponent;
  let state: TestOrderWorkspaceState;
  const customers: Customer[] = [
    { _id: 'customer-1', session_id: 'session-1', customer_name: 'Alex' },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TasSessionItemsComponent],
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
    fixture = TestBed.createComponent(TasSessionItemsComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('state', state);
    fixture.componentRef.setInput('sessionItems', []);
    fixture.componentRef.setInput('customers', customers);
    fixture.detectChanges();
  });

  function setItems(items: ItemOrder[]): void {
    state.items.set(items);
    fixture.componentRef.setInput('sessionItems', items);
    fixture.detectChanges();
  }

  it('shows the empty state when there are no items', () => {
    expect(fixture.nativeElement.textContent).toContain('tas.no_items');
  });

  it('splits the items into kitchen and bar sections', () => {
    setItems([
      createItem({ _id: 'item-1', item_name_snapshot: [{ lang: 'en', value: 'Steak' }] }),
      createItem({ _id: 'item-2', item_disher_type: 'SERVICE', item_name_snapshot: [{ lang: 'en', value: 'Beer' }] }),
    ]);

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('tas.kitchen_items');
    expect(text).toContain('tas.bar_service');
    expect(text).toContain('Steak');
    expect(text).toContain('Beer');
  });

  it('emits deleteItem for ordered kitchen items', () => {
    setItems([createItem()]);
    const deleteSpy = jasmine.createSpy('deleteItem');
    component.deleteItem.subscribe(deleteSpy);

    (fixture.nativeElement.querySelector('button[aria-label="common.delete_item"]') as HTMLButtonElement).click();

    expect(deleteSpy).toHaveBeenCalledOnceWith('item-1');
  });

  it('emits serveItem for ordered service items', () => {
    setItems([createItem({ item_disher_type: 'SERVICE' })]);
    const serveSpy = jasmine.createSpy('serveItem');
    component.serveItem.subscribe(serveSpy);

    (fixture.nativeElement.querySelector('button[aria-label="tas.mark_served"]') as HTMLButtonElement).click();

    expect(serveSpy).toHaveBeenCalledOnceWith('item-1');
  });

  it('hides the item actions once the item is no longer ordered', () => {
    setItems([createItem({ item_state: 'ON_PREPARE' })]);

    expect(fixture.nativeElement.querySelector('button[aria-label="common.delete_item"]')).toBeNull();
  });

  it('emits assignItem with the chosen customer', () => {
    setItems([createItem()]);
    const events: TasAssignItemEvent[] = [];
    component.assignItem.subscribe(event => events.push(event));

    const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
    select.value = 'customer-1';
    select.dispatchEvent(new Event('change'));

    expect(events).toEqual([{ itemId: 'item-1', customerId: 'customer-1' }]);
  });

  it('maps item states to translated labels', () => {
    expect(component.getStateLabel('ORDERED')).toBe('tas.state.ordered');
    expect(component.getStateLabel('ON_PREPARE')).toBe('tas.state.on_prepare');
    expect(component.getStateLabel('SERVED')).toBe('tas.state.served');
    expect(component.getStateLabel('CANCELED')).toBe('tas.state.canceled');
  });
});
