import { Request, Response } from 'express';
import { ErrorCode } from '@disherio/shared';
import { ActivityLogType } from '../repositories/activity-log.repository';
import * as ActivityLogService from '../services/activity-log.service';
import { asyncHandler, createError } from '../utils/async-handler';
import { ActivityLogQuerySchema } from '../schemas/dashboard.schema';

export const getLogs = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const parsed = ActivityLogQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw createError.badRequest(ErrorCode.VALIDATION_ERROR);
  }
  const { from, to, userId, type: requestedType } = parsed.data;
  const type = requestedType === 'ALL' ? undefined : requestedType;

  const result = await ActivityLogService.getLogs(req.user!.restaurantId, {
    from,
    to,
    userId,
    type: type as ActivityLogType | undefined,
  });
  res.json(result);
});

export const getLogUsers = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const users = await ActivityLogService.getLogUsers(req.user!.restaurantId);
  res.json({ users });
});
