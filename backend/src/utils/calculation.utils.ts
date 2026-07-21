
import * as TaxUtils from './tax';

// =============================================================================
// INTERFACES
// =============================================================================

export interface ItemPriceBreakdown {
  basePrice: number;
  variantPrice: number;
  extrasTotal: number;
  total: number;
}

export interface CustomerTotals {
  [customerId: string]: number;
}

interface CustomerItem {
  customer_id?: { toString(): string } | null;
  customer_name?: string;
  item_base_price: number;
  item_disher_variant?: { price?: number } | null;
  item_disher_extras?: Array<{ price: number }>;
}

export interface Ticket {
  ticket_part: number;
  ticket_total_parts: number;
  ticket_amount: number;
  ticket_customer_name?: string;
  paid: boolean;
}

export interface RestaurantTipsConfig {
  tips_state?: boolean;
  tips_type?: string;
  tips_rate?: number;
}

// =============================================================================
// ITEM PRICE CALCULATION
// =============================================================================

export function calculateItemPrice(item: {
  item_base_price: number;
  item_disher_variant?: { price?: number } | null;
  item_disher_extras?: Array<{ price: number }>;
}): ItemPriceBreakdown {
  const variantPrice = item.item_disher_variant?.price ?? 0;
  const extrasTotal = item.item_disher_extras?.reduce((sum, e) => sum + e.price, 0) ?? 0;

  return {
    basePrice: item.item_base_price,
    variantPrice,
    extrasTotal,
    total: item.item_base_price + variantPrice + extrasTotal,
  };
}

// =============================================================================
// CUSTOMER TOTALS CALCULATION
// =============================================================================

export function calculateCustomerTotals(items: CustomerItem[]): CustomerTotals {
  const totals: CustomerTotals = {};

  for (const item of items) {
    const customerId = item.customer_id?.toString() ?? 'unknown';
    const prices = calculateItemPrice(item);

    totals[customerId] = (totals[customerId] ?? 0) + prices.total;
  }

  return totals;
}

// =============================================================================
// TIP CALCULATION
// =============================================================================

export function calculateTips(
  totalWithTax: number,
  customTip: number | undefined,
  restaurant: RestaurantTipsConfig
): number {
  if (customTip !== undefined && customTip >= 0) {
    return parseFloat(customTip.toFixed(2));
  }

  if (restaurant.tips_state && restaurant.tips_type === 'MANDATORY' && restaurant.tips_rate) {
    return parseFloat((totalWithTax * (restaurant.tips_rate / 100)).toFixed(2));
  }

  return 0;
}

// =============================================================================
// TICKET CONSTRUCTION
// =============================================================================

export function buildSharedTickets(total: number, parts: number): Ticket[] {
  return TaxUtils.splitAmount(total, parts).map((amount, index) => ({
    ticket_part: index + 1,
    ticket_total_parts: parts,
    ticket_amount: amount,
    paid: false,
  }));
}

export function buildByUserTickets(items: CustomerItem[], paymentTotal: number): Ticket[] {
  const customerTotals = calculateCustomerTotals(items);
  const customers = Object.entries(customerTotals);
  const itemTotal = customers.reduce((sum, [, amount]) => sum + amount, 0);
  if (customers.length === 0 || itemTotal <= 0) return [];

  const paymentCents = Math.round(paymentTotal * 100);
  const allocations = customers.map(([customerId, amount], index) => {
    const exactCents = paymentCents * amount / itemTotal;
    return {
      customerId,
      index,
      cents: Math.floor(exactCents),
      remainder: exactCents - Math.floor(exactCents),
    };
  });
  let remainingCents = paymentCents - allocations.reduce((sum, allocation) => sum + allocation.cents, 0);
  const remainderOrder = [...allocations].sort((left, right) =>
    right.remainder - left.remainder || left.index - right.index
  );
  for (let index = 0; index < remainingCents; index++) {
    remainderOrder[index % remainderOrder.length].cents += 1;
  }

  const customerNames = new Map<string, string>();
  for (const item of items) {
    const customerId = item.customer_id?.toString() ?? 'unknown';
    if (item.customer_name && !customerNames.has(customerId)) {
      customerNames.set(customerId, item.customer_name);
    }
  }

  return allocations.map(({ customerId, cents }, index) => ({
    ticket_part: index + 1,
    ticket_total_parts: customers.length,
    ticket_amount: cents / 100,
    ticket_customer_name: customerNames.get(customerId) ?? `Customer ${customerId.slice(-4)}`,
    paid: false,
  }));
}

