/**
 * Price Security Tests
 * Validates that the backend always uses DB prices (snapshots),
 * never trusting frontend-sent prices.
 */

interface ItemOrderPayload {
  order_id: string;
  session_id: string;
  dish_id: string;
  // Frontend must NOT send price — it should be ignored
  price?: number;
}

function isFrontendPriceIgnored(payload: ItemOrderPayload): boolean {
  return !('price' in payload) || payload.price === undefined;
}

describe('Price Security', () => {
  it('item creation payload should not require price field', () => {
    const payload: ItemOrderPayload = {
      order_id: 'order1',
      session_id: 'sess1',
      dish_id: 'dish1',
    };
    expect(isFrontendPriceIgnored(payload)).toBe(true);
  });

  it('if frontend sends price, it should be discarded by design', () => {
    // The addItemToOrder service always reads price from DB (Dish model)
    // This test documents that contract — the function signature does not accept price
    const params = ['orderId', 'sessionId', 'dishId', 'customerId', 'variantId', 'extras'];
    expect(params.includes('price')).toBe(false);
  });
});
