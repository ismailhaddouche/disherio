import { Types } from 'mongoose';
import { QueryProfiler } from '../utils/query-profiler';
// Importing the model registers the ItemOrder schema on the default mongoose
// connection, so DishRepository can resolve db.model('ItemOrder') without a
// live database. Aggregations are intercepted at QueryProfiler below.
import '../models/order.model';
import { DishRepository } from '../repositories/dish.repository';
import { ItemOrderRepository } from '../repositories/order/item-order.repository';

const SESSION_ID = '507f1f77bcf86cd799439022';

type Pipeline = Array<Record<string, any>>;

// The dashboard defines billed revenue/units as: non-cancelled items whose
// session reached PAID. getSalesByDish already enforced it; getDishStats and
// getPopularDishes must apply the same filter so every dashboard figure is
// reconciliable. All three are scoped by the restaurant's session ids, which
// the service layer resolves first (the leading $match then uses the
// session_id index instead of scanning every tenant's itemorders).
describe('dashboard revenue definition consistency', () => {
  let profileSpy: jest.SpyInstance;

  beforeEach(() => {
    profileSpy = jest.spyOn(QueryProfiler, 'profileAggregation').mockResolvedValue([]);
  });

  afterEach(() => {
    profileSpy.mockRestore();
  });

  function capturedPipeline(): Pipeline {
    expect(profileSpy).toHaveBeenCalledTimes(1);
    return profileSpy.mock.calls[0][1] as Pipeline;
  }

  // The PAID gate must sit after the totemsessions lookup/unwind, otherwise
  // the session field would not exist yet.
  function paidSessionGate(pipeline: Pipeline): Record<string, any> | undefined {
    const unwindIndex = pipeline.findIndex(stage => stage.$unwind === '$session');
    expect(unwindIndex).toBeGreaterThan(-1);
    return pipeline
      .slice(unwindIndex)
      .find(stage => stage.$match?.['session.totem_state'] !== undefined)?.$match;
  }

  it('getDishStats only counts items from paid sessions', async () => {
    await new DishRepository().getDishStats([SESSION_ID]);

    const pipeline = capturedPipeline();
    expect(pipeline[0].$match.item_state).toEqual({ $ne: 'CANCELED' });
    // Tenant scoping happens in the leading match via the session id set.
    expect(pipeline[0].$match.session_id).toEqual({ $in: [new Types.ObjectId(SESSION_ID)] });

    const gate = paidSessionGate(pipeline);
    expect(gate?.['session.totem_state']).toBe('PAID');
  });

  it('getDishStats short-circuits without sessions instead of scanning all tenants', async () => {
    const stats = await new DishRepository().getDishStats([]);

    expect(stats).toEqual([]);
    expect(profileSpy).not.toHaveBeenCalled();
  });

  it('getPopularDishes only counts items from paid sessions', async () => {
    await new DishRepository().getPopularDishes([SESSION_ID], { limit: 5 });

    const pipeline = capturedPipeline();
    expect(pipeline[0].$match.item_state).toEqual({ $ne: 'CANCELED' });
    expect(pipeline[0].$match.session_id).toEqual({ $in: [new Types.ObjectId(SESSION_ID)] });

    const gate = paidSessionGate(pipeline);
    expect(gate?.['session.totem_state']).toBe('PAID');
  });

  it('getPopularDishes short-circuits without sessions instead of scanning all tenants', async () => {
    const dishes = await new DishRepository().getPopularDishes([], { limit: 5 });

    expect(dishes).toEqual([]);
    expect(profileSpy).not.toHaveBeenCalled();
  });

  it('getSalesByDish uses the same PAID gate, so both figures reconcile', async () => {
    await new ItemOrderRepository().getSalesByDish([SESSION_ID]);

    const gate = paidSessionGate(capturedPipeline());
    expect(gate).toEqual({ 'session.totem_state': 'PAID' });
  });

  it('getDishStats returns only the paid-session rows produced by the pipeline', async () => {
    const dishId = new Types.ObjectId();
    // The aggregation already dropped unpaid-session items; rows reaching the
    // mapper are billed totals for PAID sessions only.
    profileSpy.mockResolvedValue([
      {
        _id: dishId,
        nameSnapshot: [{ lang: 'en', value: 'Paella' }],
        totalOrdered: 3,
        totalRevenue: 37.5,
      },
    ]);

    const stats = await new DishRepository().getDishStats([SESSION_ID]);

    expect(stats).toEqual([
      {
        dishId,
        dishName: 'Paella',
        totalOrdered: 3,
        totalRevenue: 37.5,
        categoryId: undefined,
      },
    ]);
  });

  it('getPopularDishes returns only the paid-session rows produced by the pipeline', async () => {
    const dishId = new Types.ObjectId();
    profileSpy.mockResolvedValue([
      {
        _id: dishId,
        nameSnapshot: [{ lang: 'en', value: 'Croquetas' }],
        totalOrdered: 5,
        totalRevenue: 22.5,
      },
    ]);

    const dishes = await new DishRepository().getPopularDishes([SESSION_ID], { limit: 5 });

    expect(dishes).toEqual([
      {
        dishId,
        dishName: 'Croquetas',
        totalOrdered: 5,
        totalRevenue: 22.5,
        categoryId: undefined,
        trend: 'stable',
      },
    ]);
  });
});
