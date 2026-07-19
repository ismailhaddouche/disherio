import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { I18nService } from '../../core/services/i18n.service';
import { OrderWorkspaceState } from '../../store/order-workspace.state';
import type { Customer, Dish, ItemOrder } from '../../types';
import { TasCustomersBarComponent } from './tas-customers-bar.component';

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

describe('TasCustomersBarComponent', () => {
  let fixture: ComponentFixture<TasCustomersBarComponent>;
  let component: TasCustomersBarComponent;
  let state: TestOrderWorkspaceState;
  const customers: Customer[] = [
    { _id: 'customer-1', session_id: 'session-1', customer_name: 'Alex' },
    { _id: 'customer-2', session_id: 'session-1', customer_name: 'Sam' },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TasCustomersBarComponent],
      providers: [
        { provide: I18nService, useValue: { translate: (key: string) => key } },
      ],
    }).compileComponents();

    state = new TestOrderWorkspaceState();
    fixture = TestBed.createComponent(TasCustomersBarComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('state', state);
    fixture.componentRef.setInput('customers', customers);
    fixture.componentRef.setInput('showAddCustomer', false);
    fixture.componentRef.setInput('newCustomerName', '');
    fixture.detectChanges();
  });

  it('renders a tab per customer with its item count', () => {
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('Alex');
    expect(text).toContain('Sam');
  });

  it('selects a customer on click and resets with the all tab', () => {
    const tabs = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
    const alexTab = tabs.find(button => button.textContent?.includes('Alex'));
    alexTab?.click();
    fixture.detectChanges();

    expect(state.selectedCustomerId()).toBe('customer-1');

    const allTab = (Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[])
      .find(button => button.textContent?.includes('tas.all'));
    allTab?.click();
    fixture.detectChanges();

    expect(state.selectedCustomerId()).toBeNull();
  });

  it('toggles the add-customer row through the model', () => {
    const shown: boolean[] = [];
    component.showAddCustomer.subscribe(value => shown.push(value));

    (fixture.nativeElement.querySelector('button[aria-label="tas.add_customer_label"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(shown).toEqual([true]);
    expect(fixture.nativeElement.querySelector('input')).not.toBeNull();
  });

  it('emits addCustomer from the confirm button', () => {
    fixture.componentRef.setInput('showAddCustomer', true);
    fixture.detectChanges();
    const addSpy = jasmine.createSpy('addCustomer');
    component.addCustomer.subscribe(addSpy);

    (fixture.nativeElement.querySelector('button[aria-label="common.add"]') as HTMLButtonElement).click();

    expect(addSpy).toHaveBeenCalledTimes(1);
  });

  it('updates the newCustomerName model when typing', () => {
    fixture.componentRef.setInput('showAddCustomer', true);
    fixture.detectChanges();
    const names: string[] = [];
    component.newCustomerName.subscribe(value => names.push(value));

    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    input.value = 'New Guest';
    input.dispatchEvent(new Event('input'));

    expect(names).toEqual(['New Guest']);
  });
});
