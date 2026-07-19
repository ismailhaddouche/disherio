import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { I18nService } from '../../core/services/i18n.service';
import { RestaurantService } from '../../core/services/restaurant.service';
import { OrderWorkspaceState } from '../../store/order-workspace.state';
import type { Customer, Dish, ItemOrder } from '../../types';
import { PosPaymentModalComponent } from './pos-payment-modal.component';

class TestOrderWorkspaceState extends OrderWorkspaceState {
  readonly items = signal<ItemOrder[]>([]);
  readonly customers = signal<Customer[]>([]);
  readonly dishes = signal<Dish[]>([]);
  total = 10;

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
    return this.total;
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

function buttonByText(fixture: ComponentFixture<unknown>, text: string): HTMLButtonElement | null {
  const buttons = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
  return buttons.find(button => button.textContent?.includes(text)) ?? null;
}

describe('PosPaymentModalComponent', () => {
  let fixture: ComponentFixture<PosPaymentModalComponent>;
  let component: PosPaymentModalComponent;
  let state: TestOrderWorkspaceState;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PosPaymentModalComponent],
      providers: [
        { provide: I18nService, useValue: { translate: (key: string) => key, currentLang: () => 'en' } },
        { provide: RestaurantService, useValue: { currency: () => 'EUR' } },
      ],
    }).compileComponents();

    state = new TestOrderWorkspaceState();
    fixture = TestBed.createComponent(PosPaymentModalComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('state', state);
    fixture.componentRef.setInput('total', 10);
    fixture.detectChanges();
  });

  it('renders the total to pay', () => {
    const total = fixture.nativeElement.querySelector('.text-3xl') as HTMLElement;

    expect(total.textContent).toContain('10');
  });

  it('selects the payment type from the option buttons', () => {
    buttonByText(fixture, 'pos.payment.full_payment')?.click();
    fixture.detectChanges();
    expect(state.paymentType()).toBe('ALL');

    buttonByText(fixture, 'pos.payment.split_equal')?.click();
    fixture.detectChanges();
    expect(state.paymentType()).toBe('SHARED');
  });

  it('shows split controls for SHARED and clamps the count to a minimum of 2', () => {
    buttonByText(fixture, 'pos.payment.split_equal')?.click();
    fixture.detectChanges();

    const decrease = fixture.nativeElement.querySelector('button[aria-label="common.decrease_quantity"]') as HTMLButtonElement;
    const increase = fixture.nativeElement.querySelector('button[aria-label="common.increase_quantity"]') as HTMLButtonElement;

    decrease.click();
    fixture.detectChanges();
    expect(state.splitCount()).toBe(2);

    increase.click();
    increase.click();
    fixture.detectChanges();
    expect(state.splitCount()).toBe(4);
  });

  it('disables the split count increase at 20', () => {
    buttonByText(fixture, 'pos.payment.split_equal')?.click();
    fixture.detectChanges();
    state.splitCount.set(20);
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('button[aria-label="common.increase_quantity"]') as HTMLButtonElement).click();

    expect(state.splitCount()).toBe(20);
  });

  it('keeps calculate disabled until a payment type is chosen', () => {
    const calculate = buttonByText(fixture, 'pos.payment.calculate');
    expect(calculate?.disabled).toBeTrue();

    buttonByText(fixture, 'pos.payment.full_payment')?.click();
    fixture.detectChanges();

    expect(buttonByText(fixture, 'pos.payment.calculate')?.disabled).toBeFalse();
  });

  it('calculates tickets and shows the summary with one ticket per share', () => {
    buttonByText(fixture, 'pos.payment.split_equal')?.click();
    fixture.detectChanges();
    state.splitCount.set(2);

    buttonByText(fixture, 'pos.payment.calculate')?.click();
    fixture.detectChanges();

    expect(state.showPaymentSummary()).toBeTrue();
    expect(state.paymentTickets().map(ticket => ticket.ticket_amount)).toEqual([5, 5]);
    expect(fixture.nativeElement.textContent).toContain('pos.payment.summary');
    expect(buttonByText(fixture, 'pos.payment.calculate')).toBeNull();
  });

  it('hides the by-consumption option when items are not fully assigned', () => {
    state.items.set([createItem()]);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('pos.payment.by_consumption_unavailable');

    state.customers.set([{ _id: 'customer-1', session_id: 'session-1', customer_name: 'Alex' }]);
    state.items.set([createItem({ customer_id: 'customer-1' })]);
    fixture.detectChanges();

    const byConsumption = buttonByText(fixture, 'pos.payment.by_consumption');
    expect(byConsumption).not.toBeNull();

    byConsumption?.click();
    fixture.detectChanges();
    expect(state.paymentType()).toBe('BY_USER');
  });

  it('emits process when confirming the summary', () => {
    const processSpy = jasmine.createSpy('process');
    component.process.subscribe(processSpy);
    state.selectPaymentType('ALL');
    state.calculateTickets(1000);
    fixture.detectChanges();

    buttonByText(fixture, 'pos.payment.confirm')?.click();

    expect(processSpy).toHaveBeenCalledTimes(1);
  });

  it('disables confirm while the payment is processing', () => {
    state.selectPaymentType('ALL');
    state.calculateTickets(1000);
    state.isProcessingPayment.set(true);
    fixture.detectChanges();

    const confirm = buttonByText(fixture, 'pos.payment.processing');

    expect(confirm?.disabled).toBeTrue();
  });

  it('closes the modal from the cancel and close buttons', () => {
    state.openPaymentModal();
    const closeSpy = spyOn(state, 'closePaymentModal').and.callThrough();

    buttonByText(fixture, 'common.cancel')?.click();
    expect(closeSpy).toHaveBeenCalledTimes(1);

    (fixture.nativeElement.querySelector('button[aria-label="common.close"]') as HTMLButtonElement).click();
    expect(closeSpy).toHaveBeenCalledTimes(2);
    expect(state.showPaymentModal()).toBeFalse();
  });

  it('goes back from the summary to the method selection', () => {
    state.selectPaymentType('ALL');
    state.calculateTickets(1000);
    fixture.detectChanges();

    buttonByText(fixture, 'common.back')?.click();
    fixture.detectChanges();

    expect(state.showPaymentSummary()).toBeFalse();
    expect(buttonByText(fixture, 'pos.payment.calculate')).not.toBeNull();
  });
});
