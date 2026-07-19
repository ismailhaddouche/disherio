import { computed, signal } from '@angular/core';
import type { Customer, Dish, ItemOrder, PaymentTicket } from '../types';
import { getItemOrderTotal } from '../shared/utils/order-item.utils';
import { getDishCategoryId } from '../shared/utils/dish-category.utils';

export type PaymentType = 'ALL' | 'SHARED' | 'BY_USER';

export interface PendingOrderItem {
  dish: Dish;
  quantity: number;
  variantId: string | null;
  extras: string[];
  customerId: string | null;
}

export abstract class OrderWorkspaceState {
  selectedCategory = signal<string | null>(null);
  selectedDish = signal<Dish | null>(null);
  selectedVariantId = signal<string | null>(null);
  selectedExtras = signal<string[]>([]);
  assignToCustomerId = signal<string | null>(null);
  selectedCustomerId = signal<string | null>(null);
  isAddingItem = signal(false);
  itemQuantity = signal(1);
  pendingItems = signal<PendingOrderItem[]>([]);

  showPaymentModal = signal(false);
  paymentType = signal<PaymentType | null>(null);
  splitCount = signal(2);
  isProcessingPayment = signal(false);
  paymentTickets = signal<PaymentTicket[]>([]);
  showPaymentSummary = signal(false);

  pendingCount = computed(() =>
    this.pendingItems().reduce((sum, item) => sum + item.quantity, 0)
  );

  pendingTotal = computed(() =>
    this.pendingItems().reduce(
      (sum, item) => sum + this.getPendingItemUnitTotal(item) * item.quantity,
      0
    )
  );

  filteredItems = computed(() => {
    const customerId = this.selectedCustomerId();
    const activeItems = this.getWorkspaceItems().filter(item => item.item_state !== 'CANCELED');
    return customerId === null
      ? activeItems
      : activeItems.filter(item => item.customer_id === customerId);
  });

  filteredDishes = computed(() => {
    const categoryId = this.selectedCategory();
    return categoryId === null
      ? this.getWorkspaceDishes()
      : this.getWorkspaceDishes().filter(dish => getDishCategoryId(dish) === categoryId);
  });

  protected abstract getWorkspaceItems(): ItemOrder[];
  protected abstract getWorkspaceCustomers(): Customer[];
  protected abstract getWorkspaceDishes(): Dish[];
  protected abstract getWorkspaceTotal(): number;
  protected abstract getFallbackCustomerName(part: number): string;

  protected canQueueDish(): boolean {
    return true;
  }

  protected afterDishQueued(): void {}

  selectDish(dish: Dish): void {
    this.selectedDish.set(dish);
    this.selectedVariantId.set(null);
    this.selectedExtras.set([]);
    this.assignToCustomerId.set(null);
    this.itemQuantity.set(1);
  }

  toggleExtra(extraId: string): void {
    this.selectedExtras.update(current =>
      current.includes(extraId)
        ? current.filter(id => id !== extraId)
        : [...current, extraId]
    );
  }

  calculateDishTotal(dish: Dish): number {
    return this.calculateConfiguredDishTotal(
      dish,
      this.selectedVariantId(),
      this.selectedExtras()
    );
  }

  getPendingItemUnitTotal(item: Pick<PendingOrderItem, 'dish' | 'variantId' | 'extras'>): number {
    return this.calculateConfiguredDishTotal(item.dish, item.variantId, item.extras);
  }

  incrementQuantity(): void {
    this.itemQuantity.update(quantity => Math.min(quantity + 1, 99));
  }

  decrementQuantity(): void {
    this.itemQuantity.update(quantity => Math.max(quantity - 1, 1));
  }

  addItemToOrder(dish: Dish): void {
    if (!this.canQueueDish()) return;

    this.mergePendingItem({
      dish: { ...dish },
      quantity: this.itemQuantity(),
      variantId: this.selectedVariantId(),
      extras: [...this.selectedExtras()],
      customerId: this.assignToCustomerId(),
    });

    this.selectedVariantId.set(null);
    this.selectedExtras.set([]);
    this.itemQuantity.set(1);
    this.afterDishQueued();
  }

  quickAddToCart(dish: Dish): void {
    this.mergePendingItem({
      dish: { ...dish },
      quantity: 1,
      variantId: null,
      extras: [],
      customerId: null,
    });
  }

  incrementPendingQuantity(index: number): void {
    this.pendingItems.update(items =>
      items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, quantity: item.quantity + 1 } : item
      )
    );
  }

  decrementPendingQuantity(index: number): void {
    this.pendingItems.update(items =>
      items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, quantity: Math.max(1, item.quantity - 1) } : item
      )
    );
  }

  removePendingItem(index: number): void {
    this.pendingItems.update(items => items.filter((_, itemIndex) => itemIndex !== index));
  }

  clearPendingItems(): void {
    this.pendingItems.set([]);
  }

  getItemTotal(item: ItemOrder): number {
    return getItemOrderTotal(item);
  }

  getCustomerById(customerId: string): Customer | undefined {
    return this.getWorkspaceCustomers().find(customer => customer._id === customerId);
  }

  getCustomerItemCount(customerId: string): number {
    return this.getWorkspaceItems().filter(
      item => item.customer_id === customerId && item.item_state !== 'CANCELED'
    ).length;
  }

  openPaymentModal(): void {
    this.showPaymentModal.set(true);
    this.paymentType.set(null);
    this.showPaymentSummary.set(false);
    this.paymentTickets.set([]);
    this.splitCount.set(2);
  }

  closePaymentModal(): void {
    this.showPaymentModal.set(false);
    this.paymentType.set(null);
    this.showPaymentSummary.set(false);
    this.paymentTickets.set([]);
  }

  selectPaymentType(type: PaymentType): void {
    this.paymentType.set(type);
  }

  canPayByConsumption(): boolean {
    const activeItems = this.getWorkspaceItems().filter(item => item.item_state !== 'CANCELED');
    return activeItems.length > 0 && activeItems.every(item => Boolean(item.customer_id));
  }

  calculateSplitAmount(): number {
    return Math.round((this.getWorkspaceTotal() / this.splitCount()) * 100) / 100;
  }

  getItemsForCustomer(customerName: string): ItemOrder[] {
    const customer = this.getWorkspaceCustomers().find(
      candidate => candidate.customer_name === customerName
    );
    return customer
      ? this.getWorkspaceItems().filter(
          item => item.customer_id === customer._id && item.item_state !== 'CANCELED'
        )
      : [];
  }

  calculateTickets(now = Date.now()): void {
    const type = this.paymentType();
    if (type === null) return;

    const tickets = type === 'ALL'
      ? this.createFullPaymentTicket(now)
      : type === 'SHARED'
        ? this.createSharedPaymentTickets(now)
        : this.createCustomerPaymentTickets(now);

    this.paymentTickets.set(tickets);
    this.showPaymentSummary.set(true);
  }

  private calculateConfiguredDishTotal(dish: Dish, variantId: string | null, extras: string[]): number {
    const variantPrice = dish.variants.find(variant => variant._id === variantId)?.variant_price ?? 0;
    const extrasPrice = extras.reduce((sum, extraId) => {
      return sum + (dish.extras.find(extra => extra._id === extraId)?.extra_price ?? 0);
    }, 0);
    return dish.disher_price + variantPrice + extrasPrice;
  }

  private mergePendingItem(candidate: PendingOrderItem): void {
    const existingIndex = this.pendingItems().findIndex(item =>
      item.dish._id === candidate.dish._id &&
      item.variantId === candidate.variantId &&
      item.customerId === candidate.customerId &&
      item.extras.length === candidate.extras.length &&
      item.extras.every(extraId => candidate.extras.includes(extraId))
    );

    if (existingIndex === -1) {
      this.pendingItems.update(items => [...items, candidate]);
      return;
    }

    this.pendingItems.update(items =>
      items.map((item, index) =>
        index === existingIndex
          ? { ...item, quantity: item.quantity + candidate.quantity }
          : item
      )
    );
  }

  private createFullPaymentTicket(now: number): PaymentTicket[] {
    return [{
      ticket_id: `ticket-${now}-1`,
      ticket_part: 1,
      ticket_total_parts: 1,
      ticket_amount: this.getWorkspaceTotal(),
      ticket_customer_name: undefined,
      paid: false,
    }];
  }

  private createSharedPaymentTickets(now: number): PaymentTicket[] {
    const count = this.splitCount();
    const total = this.getWorkspaceTotal();
    const baseAmount = Math.floor((total / count) * 100) / 100;
    const remainder = Math.round((total - baseAmount * count) * 100) / 100;

    return Array.from({ length: count }, (_, index) => ({
      ticket_id: `ticket-${now}-${index + 1}`,
      ticket_part: index + 1,
      ticket_total_parts: count,
      ticket_amount: index === 0 ? baseAmount + remainder : baseAmount,
      ticket_customer_name: undefined,
      paid: false,
    }));
  }

  private createCustomerPaymentTickets(now: number): PaymentTicket[] {
    const customerTotals = new Map<string, number>();
    for (const item of this.getWorkspaceItems()) {
      if (item.item_state === 'CANCELED' || !item.customer_id) continue;
      customerTotals.set(
        item.customer_id,
        (customerTotals.get(item.customer_id) ?? 0) + getItemOrderTotal(item)
      );
    }

    return Array.from(customerTotals.entries()).map(([customerId, amount], index) => ({
      ticket_id: `ticket-${now}-${index + 1}`,
      ticket_part: index + 1,
      ticket_total_parts: customerTotals.size,
      ticket_amount: Math.round(amount * 100) / 100,
      ticket_customer_name: this.getCustomerById(customerId)?.customer_name
        ?? this.getFallbackCustomerName(index + 1),
      paid: false,
    }));
  }
}
