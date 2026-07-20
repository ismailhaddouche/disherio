import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { createError } from '../utils/async-handler';
import { ErrorCode } from '@disherio/shared';

/**
 * Validates that a route parameter is a valid MongoDB ObjectId.
 */
export function validateObjectIdParam(paramName: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const value = req.params[paramName];
    if (typeof value !== 'string' || !Types.ObjectId.isValid(value)) {
      next(createError.badRequest(ErrorCode.INVALID_ID_FORMAT));
      return;
    }
    next();
  };
}
