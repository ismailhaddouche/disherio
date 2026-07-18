import { ErrorCode } from '@disherio/shared';
import { AppError } from '../utils/async-handler';

const MAX_PRICE = 999_999;

export interface PriceValidationResult {
  valid: boolean;
  field: string;
  value: number;
}

export function validateOrderPrice(price: number, field: string): PriceValidationResult {
  return {
    valid: typeof price === 'number' && Number.isFinite(price) && price >= 0 && price <= MAX_PRICE,
    field,
    value: price,
  };
}

export function assertValidItemPrices(
  basePrice: number,
  variantPrice: number | null | undefined,
  extras: Array<{ price: number }>
): void {
  const validations = [validateOrderPrice(basePrice, 'item_base_price')];
  if (variantPrice !== null && variantPrice !== undefined) {
    validations.push(validateOrderPrice(variantPrice, 'variant_price'));
  }
  extras.forEach((extra, index) => {
    validations.push(validateOrderPrice(extra.price, `extra_price[${index}]`));
  });

  const invalidPrices = validations
    .filter((validation) => !validation.valid)
    .map(({ field, value }) => ({ field, value }));
  if (invalidPrices.length > 0) {
    throw new AppError(ErrorCode.INVALID_PRICE, 400, { invalidPrices });
  }
}
