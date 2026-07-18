import { ErrorCode } from '@disherio/shared';
import { assertValidItemPrices, validateOrderPrice } from '../services/order-price-policy';

describe('order price policy', () => {
  it('accepts finite prices in the supported range', () => {
    expect(validateOrderPrice(0, 'price').valid).toBe(true);
    expect(validateOrderPrice(999_999, 'price').valid).toBe(true);
  });

  it('rejects non-finite, negative and oversized prices', () => {
    expect(validateOrderPrice(Number.NaN, 'price').valid).toBe(false);
    expect(validateOrderPrice(-1, 'price').valid).toBe(false);
    expect(validateOrderPrice(1_000_000, 'price').valid).toBe(false);
  });

  it('reports every invalid snapshot field', () => {
    expect(() => assertValidItemPrices(-1, 1_000_000, [{ price: Number.NaN }]))
      .toThrow(ErrorCode.INVALID_PRICE);
  });
});
