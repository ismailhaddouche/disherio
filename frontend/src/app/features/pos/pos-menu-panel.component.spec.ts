import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { I18nService } from '../../core/services/i18n.service';
import { RestaurantService } from '../../core/services/restaurant.service';
import { LocalizationService } from '../../core/services/localization.service';
import { OrderWorkspaceState } from '../../store/order-workspace.state';
import type { Customer, Dish, ItemOrder, LocalizedField } from '../../types';
import { PosMenuPanelComponent } from './pos-menu-panel.component';

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

describe('PosMenuPanelComponent', () => {
  let fixture: ComponentFixture<PosMenuPanelComponent>;
  let component: PosMenuPanelComponent;
  let state: TestOrderWorkspaceState;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PosMenuPanelComponent],
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
    fixture = TestBed.createComponent(PosMenuPanelComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('state', state);
    fixture.componentRef.setInput('categories', [
      { _id: 'category-1', category_name: [{ lang: 'en', value: 'Mains' }] },
      { _id: 'category-2', category_name: [{ lang: 'en', value: 'Drinks' }] },
    ]);
    fixture.detectChanges();
  });

  it('renders the dishes from the workspace state', () => {
    state.dishes.set([createDish()]);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Dish');
  });

  it('filters the dishes when a category is selected', () => {
    state.dishes.set([
      createDish({ _id: 'dish-1', disher_name: [{ lang: 'en', value: 'Steak' }] }),
      createDish({ _id: 'dish-2', category_id: 'category-2', disher_name: [{ lang: 'en', value: 'Soda' }] }),
    ]);
    fixture.detectChanges();

    buttonByText(fixture, 'Drinks')?.click();
    fixture.detectChanges();

    expect(state.selectedCategory()).toBe('category-2');
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Soda');
    expect(text).not.toContain('Steak');
  });

  it('selects a dish from the grid', () => {
    const dish = createDish();
    state.dishes.set([dish]);
    fixture.detectChanges();

    buttonByText(fixture, 'Dish')?.click();

    expect(state.selectedDish()?._id).toBe('dish-1');
  });

  it('emits closed from the header button', () => {
    const closedSpy = jasmine.createSpy('closed');
    component.closed.subscribe(closedSpy);

    (fixture.nativeElement.querySelector('button[aria-label="common.close"]') as HTMLButtonElement).click();

    expect(closedSpy).toHaveBeenCalledTimes(1);
  });
});
