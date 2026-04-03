/**
 * Utilidades compartidas de cálculo para órdenes y pagos.
 * Consolidan la lógica duplicada entre order.service.ts y payment.service.ts
 */

import * as TaxUtils from './tax';
import { ItemOrderRepository } from '../repositories';

const itemOrderRepo = new ItemOrderRepository();

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

export interface SessionTotalResult {
  subtotal: number;
  tax: number;
  tips: number;
  total: number;
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
// CÁLCULO DE PRECIOS DE ÍTEMS
// =============================================================================

/**
 * Calcula el desglose de precios de un ítem incluyendo:
 * - Precio base del plato
 * - Precio de variante (si aplica)
 * - Total de extras (si aplica)
 * - Total general
 */
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
// CÁLCULO DE TOTALES POR CLIENTE
// =============================================================================

/**
 * Calcula los totales por cliente a partir de una lista de ítems.
 * Agrupa los ítems por customer_id y suma sus totales.
 */
export function calculateCustomerTotals(items: Array<{
  customer_id?: { toString(): string } | null;
  item_base_price: number;
  item_disher_variant?: { price?: number } | null;
  item_disher_extras?: Array<{ price: number }>;
}>): CustomerTotals {
  const totals: CustomerTotals = {};

  for (const item of items) {
    const customerId = item.customer_id?.toString() ?? 'unknown';
    const prices = calculateItemPrice(item);

    totals[customerId] = (totals[customerId] ?? 0) + prices.total;
  }

  return totals;
}

// =============================================================================
// CÁLCULO DE PROPINAS
// =============================================================================

/**
 * Calcula el monto de propina basado en configuración del restaurante o propina personalizada.
 */
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
// CONSTRUCCIÓN DE TICKETS
// =============================================================================

/**
 * Construye tickets compartidos dividiendo el total en partes iguales.
 */
export function buildSharedTickets(total: number, parts: number): Ticket[] {
  return TaxUtils.splitAmount(total, parts).map((amount, index) => ({
    ticket_part: index + 1,
    ticket_total_parts: parts,
    ticket_amount: amount,
    paid: false,
  }));
}

/**
 * Construye tickets por usuario basándose en los ítems de la sesión.
 * Cada cliente tiene su propio ticket con el total de sus consumiciones.
 */
export async function buildByUserTickets(sessionId: string): Promise<Ticket[]> {
  const items = await itemOrderRepo.findBySessionId(sessionId);
  const customerTotals = calculateCustomerTotals(items);

  return Object.entries(customerTotals).map(([customerId, amount], index) => ({
    ticket_part: index + 1,
    ticket_total_parts: Object.keys(customerTotals).length,
    ticket_amount: parseFloat(amount.toFixed(2)),
    ticket_customer_name: `Customer ${customerId.slice(-4)}`,
    paid: false,
  }));
}

// =============================================================================
// CÁLCULO DE TOTALES DE SESIÓN
// =============================================================================

export interface SessionTotalDependencies {
  findById: (id: string) => Promise<{ totem_id: { toString(): string } } | null>;
  findTotemById: (id: string) => Promise<{ restaurant_id: { toString(): string } } | null>;
  findRestaurantById: (id: string) => Promise<{ tax_rate?: number } & RestaurantTipsConfig | null>;
  findActiveBySessionId: (sessionId: string) => Promise<Array<{
    item_base_price: number;
    item_disher_variant?: { price?: number } | null;
    item_disher_extras?: Array<{ price: number }>;
  }>>;
}

/**
 * Calcula el total de la sesión incluyendo subtotal, impuestos, propinas y total.
 * Nota: Esta es una versión pura que requiere inyección de dependencias.
 * Para uso directo, usar calculateSessionTotal desde los servicios.
 */
export async function calculateSessionTotalPure(
  sessionId: string,
  customTip: number | undefined,
  deps: SessionTotalDependencies
): Promise<SessionTotalResult> {
  const session = await deps.findById(sessionId);
  if (!session) throw new Error('SESSION_NOT_FOUND');

  const totem = await deps.findTotemById(session.totem_id.toString());
  if (!totem) throw new Error('TOTEM_NOT_FOUND');

  const restaurant = await deps.findRestaurantById(totem.restaurant_id.toString());
  if (!restaurant) throw new Error('RESTAURANT_NOT_FOUND');

  const items = await deps.findActiveBySessionId(sessionId);

  const totalWithTax = items.reduce((acc, item) => {
    const prices = calculateItemPrice(item);
    return acc + prices.total;
  }, 0);

  const tax = TaxUtils.extractTax(totalWithTax, restaurant.tax_rate ?? 0);
  const subtotal = parseFloat((totalWithTax - tax).toFixed(2));
  const tips = calculateTips(totalWithTax, customTip, restaurant);

  return {
    subtotal,
    tax,
    tips,
    total: parseFloat((totalWithTax + tips).toFixed(2)),
  };
}
