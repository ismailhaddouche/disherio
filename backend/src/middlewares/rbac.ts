import { Request, NextFunction } from 'express';
import { defineAbilityFor, type Actions, type Subjects } from '../abilities/abilities';
import { ErrorCode } from '@disherio/shared';
import { createError } from '../utils/async-handler';

export function requirePermission(action: Actions, subject: Subjects) {
  return (req: Request, _res: unknown, next: NextFunction): void => {
    if (!req.user) {
      next(createError.unauthorized(ErrorCode.UNAUTHORIZED));
      return;
    }
    const ability = defineAbilityFor(req.user);
    if (ability.cannot(action, subject)) {
      next(createError.forbidden(ErrorCode.FORBIDDEN));
      return;
    }
    next();
  };
}
