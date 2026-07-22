import type { NextFunction, Request } from 'express';
import { AddItemRequestSchema } from '../schemas/order.schema';
import { validate } from '../middlewares/validate';

const validPayload = {
  request_id: '123e4567-e89b-42d3-a456-426614174000',
  order_id: '507f1f77bcf86cd799439011',
  session_id: '507f1f77bcf86cd799439012',
  dish_id: '507f1f77bcf86cd799439013',
};

describe('Price Security', () => {
  it('rejects client-supplied price fields in the real add-item schema', () => {
    const result = AddItemRequestSchema.safeParse({
      ...validPayload,
      price: 0.01,
      item_base_price: 0.01,
    });

    expect(result.success).toBe(false);
  });

  it('passes a validation error to Express for unknown price fields', () => {
    const req = { body: { ...validPayload, price: 0.01 } } as Request;
    const next = jest.fn() as NextFunction;

    validate(AddItemRequestSchema)(req, {}, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'VALIDATION_ERROR' }));
    expect(req.body).toHaveProperty('price', 0.01);
  });
});
