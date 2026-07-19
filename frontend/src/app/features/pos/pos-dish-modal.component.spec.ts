import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { I18nService } from '../../core/services/i18n.service';
import { RestaurantService } from '../../core/services/restaurant.service';
import { LocalizationService } from '../../core/services/localization.service';
import { OrderWorkspaceState } from '../../store/order-workspace.state';
import type { Customer, Dish, ItemOrder, LocalizedField } from '../../types';
import { PosDishModalComponent } from './pos-dish-modal.component';

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

function createDish(): Dish {
  return {
    _id: 'dish-1',
    restaurant_id: 'restaurant-1',
    category_id: 'category-1',
    disher_name: [{ lang: 'en', value: 'Dish' }],
    disher_price: 10,
    disher_type: 'KITCHEN',
    disher_status: 'ACTIVATED',
    disher_alergens: [],
    disher_variant: true,
    variants: [{ _id: 'variant-1', variant_name: [{ lang: 'en', value: 'Large' }], variant_price: 2 }],
    extras: [{ _id: 'extra-1', extra_name: [{ lang: 'en', value: 'Cheese' }], extra_price: 1.5 }],
  };
}

describe('PosDishModalComponent', () => {
  let fixture: ComponentFixture<PosDishModalComponent>;
  let state: TestOrderWorkspaceState;
  const customers: Customer[] = [
    { _id: 'customer-1', session_id: 'session-1', customer_name: 'Alex' },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PosDishModalComponent],
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
    fixture = TestBed.createComponent(PosDishModalComponent);
    fixture.componentRef.setInput('state', state);
    fixture.componentRef.setInput('dish', createDish());
    fixture.componentRef.setInput('customers', customers);
    fixture.detectChanges();
  });

  it('renders the variant and extra options', () => {
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('Large');
    expect(text).toContain('Cheese');
  });

  it('updates the state when choosing a variant and an extra', () => {
    const variantRadio = fixture.nativeElement.querySelector('input[type="radio"]') as HTMLInputElement;
    variantRadio.click();
    fixture.detectChanges();
    expect(state.selectedVariantId()).toBe('variant-1');

    const extraCheckbox = fixture.nativeElement.querySelector('input[type="checkbox"]') as HTMLInputElement;
    extraCheckbox.click();
    fixture.detectChanges();
    expect(state.selectedExtras()).toEqual(['extra-1']);

    extraCheckbox.click();
    fixture.detectChanges();
    expect(state.selectedExtras()).toEqual([]);
  });

  it('changes the quantity with the stepper buttons', () => {
    const increase = fixture.nativeElement.querySelector('button[aria-label="common.increase_quantity"]') as HTMLButtonElement;
    const decrease = fixture.nativeElement.querySelector('button[aria-label="common.decrease_quantity"]') as HTMLButtonElement;

    increase.click();
    fixture.detectChanges();
    expect(state.itemQuantity()).toBe(2);
    expect(decrease.disabled).toBeFalse();

    decrease.click();
    fixture.detectChanges();
    expect(state.itemQuantity()).toBe(1);
    expect(decrease.disabled).toBeTrue();
  });

  it('assigns the item to a customer from the select', () => {
    const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;

    select.value = 'customer-1';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(state.assignToCustomerId()).toBe('customer-1');
  });

  it('queues the configured dish when adding it to the order', () => {
    state.selectedVariantId.set('variant-1');
    state.selectedExtras.set(['extra-1']);
    state.itemQuantity.set(2);
    fixture.detectChanges();

    const addButton = (Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[])
      .find(candidate => candidate.textContent?.includes('tas.add_order')) as HTMLButtonElement;
    addButton.click();

    expect(state.pendingItems()).toHaveSize(1);
    expect(state.pendingItems()[0]).toEqual(jasmine.objectContaining({
      quantity: 2,
      variantId: 'variant-1',
      extras: ['extra-1'],
    }));
  });

  it('clears the selected dish when closing', () => {
    state.selectedDish.set(createDish());
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('button[aria-label="common.close"]') as HTMLButtonElement).click();

    expect(state.selectedDish()).toBeNull();
  });
});
