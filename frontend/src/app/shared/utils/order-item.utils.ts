import type { ItemOrder, TotemSession } from '../../types';

export function getItemOrderTotal(item: ItemOrder): number {
  const variantPrice = item.item_disher_variant?.price ?? 0;
  const extrasPrice = item.item_disher_extras.reduce((sum, extra) => sum + extra.price, 0);
  return item.item_base_price + variantPrice + extrasPrice;
}

export function getActiveItemCount(items: ItemOrder[]): number {
  return items.filter(item => item.item_state !== 'CANCELED').length;
}

export function getActiveItemTotal(items: ItemOrder[]): number {
  return items
    .filter(item => item.item_state !== 'CANCELED')
    .reduce((sum, item) => sum + getItemOrderTotal(item), 0);
}

export function getSessionListItemCount(
  session: Pick<TotemSession, '_id' | 'item_count'>,
  selectedSessionId: string | undefined,
  selectedSessionItems: ItemOrder[]
): number {
  return selectedSessionId === session._id
    ? getActiveItemCount(selectedSessionItems)
    : session.item_count ?? 0;
}
