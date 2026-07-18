import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { I18nService } from '../../core/services/i18n.service';
import { RestaurantService } from '../../core/services/restaurant.service';
import { LocalizationService } from '../../services/localization.service';
import { OrderWorkspaceState } from '../../shared/state/order-workspace.state';
import type { Customer, Dish, ItemOrder, LocalizedField } from '../../types';
import { TasCartSidebarComponent } from './tas-cart-sidebar.component';

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

function buttonByText(fixture: ComponentFixture<unknown>, text: string): HTMLButtonElement | null {
  const buttons = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
  return buttons.find(button => button.textContent?.includes(text)) ?? null;
}

describe('TasCartSidebarComponent', () => {
  let fixture: ComponentFixture<TasCartSidebarComponent>;
  let component: TasCartSidebarComponent;
  let state: TestOrderWorkspaceState;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TasCartSidebarComponent],
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
    fixture = TestBed.createComponent(TasCartSidebarComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('state', state);
    fixture.componentRef.setInput('isSendingOrder', false);
    fixture.detectChanges();
  });

  it('shows the empty state when the cart has no items', () => {
    expect(fixture.nativeElement.textContent).toContain('tas.no_pending');
    expect(buttonByText(fixture, 'tas.send_order')).toBeNull();
  });

  it('lists the pending items with their quantity controls', () => {
    state.quickAddToCart(createDish());
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Dish');
    expect(state.pendingCount()).toBe(1);

    (fixture.nativeElement.querySelector('button[aria-label="common.increase_quantity"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(state.pendingItems()[0].quantity).toBe(2);
    expect(state.pendingCount()).toBe(2);
  });

  it('removes a pending item from the cart', () => {
    state.quickAddToCart(createDish());
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('button[aria-label="common.delete_item"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(state.pendingItems()).toHaveSize(0);
  });

  it('clears the cart and emits sendOrder from the footer', () => {
    state.quickAddToCart(createDish());
    fixture.detectChanges();
    const sendSpy = jasmine.createSpy('sendOrder');
    component.sendOrder.subscribe(sendSpy);

    buttonByText(fixture, 'tas.send_order')?.click();
    expect(sendSpy).toHaveBeenCalledTimes(1);

    buttonByText(fixture, 'tas.clear_pending')?.click();
    expect(state.pendingItems()).toHaveSize(0);
  });

  it('disables the send button while the order is being sent', () => {
    state.quickAddToCart(createDish());
    fixture.componentRef.setInput('isSendingOrder', true);
    fixture.detectChanges();

    const send = buttonByText(fixture, 'tas.sending_order');

    expect(send?.disabled).toBeTrue();
  });

  it('emits closed from the scrim and the close button', () => {
    const closedSpy = jasmine.createSpy('closed');
    component.closed.subscribe(closedSpy);

    (fixture.nativeElement.querySelector('.bg-scrim\\/50') as HTMLElement).click();
    (fixture.nativeElement.querySelector('button[aria-label="common.close"]') as HTMLButtonElement).click();

    expect(closedSpy).toHaveBeenCalledTimes(2);
  });
});
