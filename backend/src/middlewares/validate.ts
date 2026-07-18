import { Request, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { ErrorCode } from '@disherio/shared';
import { AppError } from '../utils/async-handler';

export function validate(schema: ZodSchema) {
  return (req: Request, _res: unknown, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(new AppError(ErrorCode.VALIDATION_ERROR, 400, {
        fields: result.error.flatten().fieldErrors,
      }));
      return;
    }
    req.body = result.data;
    next();
  };
}
