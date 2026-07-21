const paymentGetStats = jest.fn();
const mockGetSalesByDish = jest.fn().mockResolvedValue([]);

jest.mock('../repositories', () => ({
  CategoryRepository: jest.fn().mockImplementation(() => ({ findByRestaurantId: jest.fn().mockResolvedValue([]) })),
  DishRepository: jest.fn().mockImplementation(() => ({ findByRestaurantId: jest.fn().mockResolvedValue([]) })),
  ItemOrderRepository: jest.fn().mockImplementation(() => ({
    getSalesByDish: mockGetSalesByDish,
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

  it('keeps sales of deleted dishes using their snapshot data', async () => {
    const restaurantId = '507f1f77bcf86cd799439016';
    const dateRange = { from: new Date('2026-01-01T00:00:00.000Z') };
    // Sale whose dishId no longer resolves to a live dish (the dish repo
    // mock returns []), so only the item snapshot name is available.
    mockGetSalesByDish.mockResolvedValue([
      {
        dishId: { toString: () => '507f1f77bcf86cd799439099' },
        dishName: 'Paella (snapshot)',
        quantity: 3,
        revenue: 45,
      },
    ]);

    const stats = await getDashboardStats(restaurantId, dateRange);

    // Sales are scoped by the restaurant's sessions, not by live dish ids.
    expect(mockGetSalesByDish).toHaveBeenCalledWith(['paid-session'], dateRange);

    // The deleted dish still appears with its snapshot name.
    expect(stats.salesByDish).toEqual([
      expect.objectContaining({ dishName: 'Paella (snapshot)', quantity: 3, revenue: 45 }),
    ]);

    // Its revenue is not dropped from the category totals.
    expect(stats.salesByCategory).toEqual([
      expect.objectContaining({ categoryId: 'uncategorized', revenue: 45, quantity: 3 }),
    ]);
  });
});
