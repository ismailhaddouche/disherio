import { z } from 'zod';
import { ErrorCode } from '@disherio/shared';
import { validate } from '../middlewares/validate';
import { requirePermission } from '../middlewares/rbac';

describe('middleware error contract', () => {
  it('forwards validation failures as an operational error with field details', () => {
    const next = jest.fn();

    validate(z.object({ name: z.string().min(1) }))(
      { body: {} } as never,
      {} as never,
      next
    );

    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      message: ErrorCode.VALIDATION_ERROR,
      statusCode: 400,
      details: { fields: expect.objectContaining({ name: expect.any(Array) }) },
    }));
  });

  it('forwards missing identity through the global unauthorized envelope', () => {
    const next = jest.fn();

    requirePermission('read', 'Order')({} as never, {} as never, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      message: ErrorCode.UNAUTHORIZED,
      statusCode: 401,
    }));
  });
});
