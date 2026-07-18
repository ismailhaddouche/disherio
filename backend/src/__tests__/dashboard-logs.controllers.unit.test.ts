import { NextFunction, Request, Response } from 'express';
import { Types } from 'mongoose';
import * as DashboardController from '../controllers/dashboard.controller';
import * as LogsController from '../controllers/logs.controller';
import * as DashboardService from '../services/dashboard.service';
import * as ActivityLogService from '../services/activity-log.service';

jest.mock('../services/dashboard.service');
jest.mock('../services/activity-log.service');

const user = {
  staffId: new Types.ObjectId().toString(),
  restaurantId: new Types.ObjectId().toString(),
  role: 'ADMIN',
  permissions: ['ADMIN'],
  name: 'Admin',
};

function response(): Response {
  return {
    json: jest.fn(),
    status: jest.fn().mockReturnThis(),
  } as unknown as Response;
}

describe('dashboard and activity log controllers', () => {
  beforeEach(() => jest.clearAllMocks());

  it('delegates dashboard aggregation to the service with validated dates', async () => {
    const stats = {
      salesByDish: [],
      salesByCategory: [],
      paymentStats: {},
      orderStatus: {},
    };
    jest.mocked(DashboardService.getDashboardStats).mockResolvedValue(stats as never);
    const req = {
      user,
      query: { from: '2026-01-01', to: '2026-01-31' },
    } as unknown as Request;
    const res = response();
    const next = jest.fn() as NextFunction;

    await DashboardController.getDashboardStats(req, res, next);

    expect(DashboardService.getDashboardStats).toHaveBeenCalledWith(
      user.restaurantId,
      {
        from: new Date('2026-01-01'),
        to: new Date('2026-01-31'),
      }
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining(stats));
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects an inverted dashboard date range before calling the service', async () => {
    const req = {
      user,
      query: { from: '2026-02-01', to: '2026-01-01' },
    } as unknown as Request;
    const next = jest.fn() as NextFunction;

    await DashboardController.getDashboardStats(req, response(), next);

    expect(DashboardService.getDashboardStats).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
  });

  it('validates log filters and delegates them to the activity service', async () => {
    const userId = new Types.ObjectId().toString();
    jest.mocked(ActivityLogService.getLogs).mockResolvedValue({
      logs: [],
      filters: { users: [], types: ['KDS', 'POS', 'TAS', 'CUSTOMER'] },
      total: 0,
    });
    const req = {
      user,
      query: { userId, type: 'CUSTOMER', from: '2026-03-01' },
    } as unknown as Request;
    const res = response();
    const next = jest.fn() as NextFunction;

    await LogsController.getLogs(req, res, next);

    expect(ActivityLogService.getLogs).toHaveBeenCalledWith(user.restaurantId, {
      from: new Date('2026-03-01'),
      to: undefined,
      userId,
      type: 'CUSTOMER',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects malformed log ids before calling the service', async () => {
    const req = {
      user,
      query: { userId: 'not-an-object-id' },
    } as unknown as Request;
    const next = jest.fn() as NextFunction;

    await LogsController.getLogs(req, response(), next);

    expect(ActivityLogService.getLogs).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
  });
});
