import { Injectable, inject, signal } from '@angular/core';
import { I18nService } from '../../core/services/i18n.service';
import { NotificationService } from '../../core/services/notification.service';
import { LocalizationService } from '../../services/localization.service';
import { cartStore, type CartItem } from '../../store/cart.store';
import type { Dish } from '../../types';

@Injectable()
export class TotemCartService {
  private readonly localization = inject(LocalizationService);
  private readonly notification = inject(NotificationService);
  private readonly i18n = inject(I18nService);

  readonly selectedDish = signal<Dish | null>(null);
  readonly selectedVariantId = signal<string | null>(null);
  readonly selectedVariantPrice = signal(0);
  readonly selectedExtras = signal<Array<{ extraId: string; price: number }>>([]);
  readonly detailQuantity = signal(1);
  readonly items = cartStore.items;
  readonly total = cartStore.total;
  readonly count = cartStore.itemCount;

  addDish(dish: Dish, unlimitedOrder: boolean): void {
    if (dish.variants.length > 0 || dish.extras.length > 0) {
      this.openDetails(dish);
      return;
    }
    cartStore.addItem({
      dishId: dish._id!,
      name: this.localization.localize(dish.disher_name),
      price: dish.disher_price,
      extras: [],
      unlimitedOrder,
    });
    this.notification.info(this.i18n.translate('totem.item_added_to_cart'));
  }

  openDetails(dish: Dish): void {
    this.selectedDish.set(dish);
    this.selectedVariantId.set(null);
    this.selectedVariantPrice.set(0);
    this.selectedExtras.set([]);
    this.detailQuantity.set(1);
  }

  closeDetails(): void {
    this.selectedDish.set(null);
  }

  selectVariant(variantId: string, price: number): void {
    this.selectedVariantId.set(variantId);
    this.selectedVariantPrice.set(price);
  }

  toggleExtra(extraId: string, price: number): void {
    this.selectedExtras.update((current) => current.some((extra) => extra.extraId === extraId)
      ? current.filter((extra) => extra.extraId !== extraId)
      : [...current, { extraId, price }]);
  }

  isExtraSelected(extraId: string): boolean {
    return this.selectedExtras().some((extra) => extra.extraId === extraId);
  }

  detailTotal(dish: Dish): number {
    const extrasTotal = this.selectedExtras().reduce((sum, extra) => sum + extra.price, 0);
    return (dish.disher_price + this.selectedVariantPrice() + extrasTotal) * this.detailQuantity();
  }

  addConfiguredDish(dish: Dish, unlimitedOrder: boolean): void {
    const extras = this.selectedExtras().map((selected) => {
      const extra = dish.extras.find((candidate) => candidate._id === selected.extraId);
      return {
        extraId: selected.extraId,
        name: extra ? this.localization.localize(extra.extra_name) : '',
        price: selected.price,
      };
    });
    for (let index = 0; index < this.detailQuantity(); index++) {
      cartStore.addItem({
        dishId: dish._id!,
        name: this.localization.localize(dish.disher_name),
        price: dish.disher_price,
        variantId: this.selectedVariantId() || undefined,
        variantPrice: this.selectedVariantPrice() || undefined,
        extras,
        unlimitedOrder,
      });
    }
    this.notification.info(this.i18n.translate('totem.item_added_to_cart'));
    this.closeDetails();
  }

  increment(item: CartItem): void {
    cartStore.addItem({
      dishId: item.dishId,
      name: item.name,
      price: item.price,
      variantId: item.variantId,
      variantPrice: item.variantPrice,
      extras: item.extras,
      customerId: item.customerId,
      unlimitedOrder: item.unlimitedOrder,
    });
  }

  decrement(item: CartItem): void {
    cartStore.decrementItem(item.dishId, item.variantId, item.extras, item.customerId);
  }

  remove(item: CartItem): void {
    cartStore.removeItem(item.dishId, item.variantId, item.extras, item.customerId);
  }
}
