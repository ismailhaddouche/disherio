import { TestBed } from '@angular/core/testing';
import { I18nService } from '../../core/services/i18n.service';
import { NotificationService } from '../../core/services/notification.service';
import { LocalizationService } from '../../core/services/localization.service';
import { cartStore } from '../../store/cart.store';
import type { Dish, LocalizedField } from '../../types';
import { TotemCartService } from './totem-cart.service';

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

describe('TotemCartService', () => {
  let service: TotemCartService;
  let notification: jasmine.SpyObj<NotificationService>;

  beforeEach(() => {
    notification = jasmine.createSpyObj<NotificationService>('NotificationService', ['info']);
    TestBed.configureTestingModule({
      providers: [
        TotemCartService,
        {
          provide: LocalizationService,
          useValue: { localize: (value: LocalizedField) => value[0]?.value ?? '' },
        },
        { provide: NotificationService, useValue: notification },
        { provide: I18nService, useValue: { translate: (key: string) => key } },
      ],
    });
    cartStore.clear();
    service = TestBed.inject(TotemCartService);
  });

  afterEach(() => cartStore.clear());

  it('adds a simple dish directly to the cart', () => {
    service.addDish(createDish(), true);

    expect(service.items()).toEqual([jasmine.objectContaining({
      dishId: 'dish-1',
      name: 'Dish',
      quantity: 1,
      unlimitedOrder: true,
    })]);
    expect(notification.info).toHaveBeenCalledOnceWith('totem.item_added_to_cart');
  });

  it('opens details when a dish has configurable options', () => {
    const dish = createDish({
      variants: [{ _id: 'variant-1', variant_name: [{ lang: 'en', value: 'Large' }], variant_price: 2 }],
    });

    service.addDish(dish, false);

    expect(service.selectedDish()).toBe(dish);
    expect(service.items()).toEqual([]);
  });

  it('adds the selected variant and extras with the requested quantity', () => {
    const dish = createDish({
      variants: [{ _id: 'variant-1', variant_name: [{ lang: 'en', value: 'Large' }], variant_price: 2 }],
      extras: [{ _id: 'extra-1', extra_name: [{ lang: 'en', value: 'Cheese' }], extra_price: 1.5 }],
    });
    service.openDetails(dish);
    service.selectVariant('variant-1', 2);
    service.toggleExtra('extra-1', 1.5);
    service.detailQuantity.set(2);

    service.addConfiguredDish(dish, false);

    expect(service.count()).toBe(2);
    expect(service.total()).toBe(27);
    expect(service.items()[0]).toEqual(jasmine.objectContaining({
      variantId: 'variant-1',
      variantPrice: 2,
      quantity: 2,
    }));
    expect(service.items()[0].extras).toEqual([{
      extraId: 'extra-1',
      name: 'Cheese',
      price: 1.5,
    }]);
    expect(service.selectedDish()).toBeNull();
  });
});
