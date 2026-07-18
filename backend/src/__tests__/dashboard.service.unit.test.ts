const paymentGetStats = jest.fn();

jest.mock('../repositories', () => ({
  CategoryRepository: jest.fn().mockImplementation(() => ({ findByRestaurantId: jest.fn().mockResolvedValue([]) })),
  DishRepository: jest.fn().mockImplementation(() => ({ findByRestaurantId: jest.fn().mockResolvedValue([]) })),
  ItemOrderRepository: jest.fn().mockImplementation(() => ({
    getSalesByDish: jest.fn().mockResolvedValue([]),
    getOrderStatusCounts: jest.fn().mockResolvedValue([]),
  })),
  PaymentRepository: jest.fn().mockImplementation(() => ({ getPaymentStats: paymentGetStats })),
}));

jest.mock('../repositories/totem.repository', () => ({
  TotemRepository: jest.fn().mockImplementation(() => ({
    findByRestaurantIdSelectId: jest.fn().mockResolvedValue([{ _id: { toString: () => 'totem-1' } }]),
  })),
  TotemSessionRepository: jest.fn().mockImplementation(() => ({
    findByTotemIds: jest.fn().mockResolvedValue([
      { _id: { toString: () => 'paid-session' }, totem_state: 'PAID' },
    ]),
  })),
}));

import { getDashboardStats } from '../services/dashboard.service';

describe('DashboardService.getDashboardStats', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    paymentGetStats.mockResolvedValue({
      totalRevenue: 42,
      totalTransactions: 1,
      averageTicket: 42,
      paidTickets: 1,
      pendingTickets: 0,
    });
  });

  it('queries payment statistics by restaurant and payment date range', async () => {
    const restaurantId = '507f1f77bcf86cd799439016';
    const dateRange = {
      from: new Date('2026-01-01T00:00:00.000Z'),
      to: new Date('2026-01-31T23:59:59.999Z'),
    };

    const stats = await getDashboardStats(restaurantId, dateRange);

    expect(paymentGetStats).toHaveBeenCalledWith(restaurantId, dateRange);
    expect(stats.paymentStats.totalRevenue).toBe(42);
  });
});
