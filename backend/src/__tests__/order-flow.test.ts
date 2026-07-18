import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import {
  addBatchItems,
  addItemToOrder,
  assignItemToCustomer,
  calculateSessionTotal,
  createOrder,
  createPayment,
  updateItemState,
} from '../services/order.service';
import { Restaurant } from '../models/restaurant.model';
import { Role, Staff } from '../models/staff.model';
import { SessionCustomer, Totem, TotemSession } from '../models/totem.model';
import { Dish, Category, ICategory, IDish } from '../models/dish.model';
import { IItemOrder, IOrder, IPayment, Order } from '../models/order.model';
import { TotemSessionRepository } from '../repositories/totem.repository';

jest.mock('../config/socket', () => ({
  getIO: () => {
    const target = { emit: jest.fn(), to: jest.fn() };
    target.to.mockReturnValue(target);
    return { to: () => target };
  },
}));

const describeWithIntegrationDb = process.env.CI === 'true' || !!process.env.MONGODB_URI_TEST
  ? describe
  : describe.skip;

describeWithIntegrationDb('Order Flow Integration', () => {
  let restaurantId: string;
  let staffId: string;
  let sessionId: string;
  let orderId: string;
  let dishId: string;

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI!);

    const restaurant = await Restaurant.create({ restaurant_name: 'FlowTest', tax_rate: 10 });
    restaurantId = restaurant._id.toString();

    const role = await Role.create({ restaurant_id: restaurantId, role_name: 'POS', permissions: ['POS'] });
    const staff = await Staff.create({
      restaurant_id: restaurantId,
      role_id: role._id,
      staff_name: 'Camarero',
      username: 'pos@test.com',
      password_hash: 'x',
      pin_code_hash: await bcrypt.hash('0001', 12),
    });
    staffId = staff._id.toString();

    const cat = await Category.create({
      restaurant_id: restaurantId,
      category_name: [
        { lang: 'es', value: 'Cocina' },
        { lang: 'en', value: 'Kitchen' },
        { lang: 'fr', value: 'Cuisine' },
        { lang: 'ar', value: '' },
      ],
    } as unknown as Partial<ICategory>);

    const dish = await Dish.create({
      restaurant_id: restaurantId,
      category_id: cat._id,
      disher_name: [
        { lang: 'es', value: 'Paella' },
        { lang: 'en', value: 'Paella' },
        { lang: 'fr', value: 'Paella' },
        { lang: 'ar', value: '' },
      ],
      disher_price: 12,
      disher_type: 'KITCHEN',
      disher_status: 'ACTIVATED',
    } as unknown as Partial<IDish>);
    dishId = dish._id.toString();

    const totem = await Totem.create({ restaurant_id: restaurantId, totem_name: 'Mesa 1', totem_type: 'STANDARD' });
    const session = await TotemSession.create({ totem_id: totem._id });
    sessionId = session._id.toString();
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  it('should create an order in an active session', async () => {
    const order = await createOrder(sessionId, staffId) as { _id: { toString(): string } };
    expect(order._id).toBeDefined();
    orderId = order._id.toString();
  });

  it('should add a KITCHEN item to the order with price snapshot', async () => {
    const item = await addItemToOrder(orderId, sessionId, dishId) as IItemOrder;
    expect(item.item_state).toBe('ORDERED');
    expect(item.item_base_price).toBe(12);
    expect(item.item_name_snapshot[0].value).toBe('Paella');
    expect(item.item_disher_type).toBe('KITCHEN');
  });

  it('rejects a dish owned by another restaurant', async () => {
    const otherRestaurant = await Restaurant.create({ restaurant_name: 'Other tenant', tax_rate: 10 });
    const otherCategory = await Category.create({
      restaurant_id: otherRestaurant._id,
      category_name: [{ lang: 'en', value: 'Other' }],
    } as unknown as Partial<ICategory>);
    const otherDish = await Dish.create({
      restaurant_id: otherRestaurant._id,
      category_id: otherCategory._id,
      disher_name: [{ lang: 'en', value: 'Foreign dish' }],
      disher_price: 25,
      disher_type: 'KITCHEN',
      disher_status: 'ACTIVATED',
    } as unknown as Partial<IDish>);

    await expect(
      addItemToOrder(orderId, sessionId, otherDish._id.toString())
    ).rejects.toThrow('FORBIDDEN');
  });

  it('replays a batch request once and rejects payload changes', async () => {
    const requestId = '123e4567-e89b-42d3-a456-426614174001';
    const first = await addBatchItems(
      sessionId,
      staffId,
      [{ dishId, quantity: 1 }],
      requestId
    );
    const replay = await addBatchItems(
      sessionId,
      staffId,
      [{ dishId, quantity: 1 }],
      requestId
    );

    expect(replay.orderId).toBe(first.orderId);
    expect(replay.items.map(item => item._id.toString()))
      .toEqual(first.items.map(item => item._id.toString()));
    await expect(Order.countDocuments({ session_id: sessionId, request_id: requestId }))
      .resolves.toBe(1);
    await expect(addBatchItems(
      sessionId,
      staffId,
      [{ dishId, quantity: 2 }],
      requestId
    )).rejects.toMatchObject({ message: 'IDEMPOTENCY_CONFLICT', statusCode: 409 });
  });

  it('rejects assigning a customer from another session', async () => {
    const otherTotem = await Totem.create({
      restaurant_id: restaurantId,
      totem_name: 'Mesa 2',
      totem_type: 'STANDARD',
    });
    const otherSession = await TotemSession.create({ totem_id: otherTotem._id });
    const otherCustomer = await SessionCustomer.create({
      session_id: otherSession._id,
      customer_name: 'Other table customer',
    });
    const item = await addItemToOrder(orderId, sessionId, dishId) as IItemOrder;

    await expect(
      assignItemToCustomer(item._id.toString(), otherCustomer._id.toString())
    ).rejects.toThrow('CUSTOMER_NOT_FOUND');
  });

  it('allows only one concurrent transition from the same initial state', async () => {
    const item = await addItemToOrder(orderId, sessionId, dishId) as IItemOrder;
    const results = await Promise.allSettled([
      updateItemState(item._id.toString(), 'ON_PREPARE', staffId, ['POS']),
      updateItemState(item._id.toString(), 'CANCELED', staffId, ['POS']),
    ]);

    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(result => result.status === 'rejected')).toHaveLength(1);
  });

  it('allows served corrections on a COMPLETE session without a payment', async () => {
    const correctionTotem = await Totem.create({
      restaurant_id: restaurantId,
      totem_name: 'Correction table',
      totem_type: 'STANDARD',
    });
    const correctionSession = await TotemSession.create({
      totem_id: correctionTotem._id,
      totem_state: 'COMPLETE',
    });

    const result = await addBatchItems(
      correctionSession._id.toString(),
      staffId,
      [{ dishId, quantity: 1 }],
      '123e4567-e89b-42d3-a456-426614174000',
      true
    );

    expect(result.items).toHaveLength(1);
    expect(result.items[0].item_state).toBe('SERVED');

    const operationalSessions = await new TotemSessionRepository()
      .findActiveByRestaurantId(restaurantId);
    const operationalSession = operationalSessions.find(session =>
      String(session._id) === correctionSession._id.toString()
    );
    expect(operationalSession?.totem_state).toBe('COMPLETE');
  });

  it('should transition item to ON_PREPARE', async () => {
    const items = await addItemToOrder(orderId, sessionId, dishId) as IItemOrder;
    const updated = await updateItemState(items._id.toString(), 'ON_PREPARE', staffId, ['POS']) as IItemOrder | null;
    expect(updated).not.toBeNull();
    expect(updated!.item_state).toBe('ON_PREPARE');
  });

  it('should calculate session total correctly', async () => {
    const result = await calculateSessionTotal(sessionId);
    expect(result.subtotal).toBeGreaterThan(0);
    expect(result.total).toBeGreaterThan(result.subtotal);
    expect(result.tax).toBeGreaterThan(0);
  });

  it('should create a payment and close the session', async () => {
    const payment = await createPayment(sessionId, 'ALL') as unknown as IPayment;
    expect(payment.payment_type).toBe('ALL');
    expect(payment.payment_total).toBeGreaterThan(0);
    expect(payment.tickets).toHaveLength(1);
  });

  it('should block TAS from canceling ON_PREPARE items without POS', async () => {
    const authTotem = await Totem.create({
      restaurant_id: restaurantId,
      totem_name: 'Authorization table',
      totem_type: 'STANDARD',
    });
    const authSession = await TotemSession.create({ totem_id: authTotem._id });
    const authOrder = await createOrder(authSession._id.toString(), staffId) as IOrder;
    const item = await addItemToOrder(
      authOrder._id.toString(),
      authSession._id.toString(),
      dishId
    ) as IItemOrder;
    await updateItemState(item._id.toString(), 'ON_PREPARE', staffId, ['KTS'], 'KDS');
    await expect(
      updateItemState(item._id.toString(), 'CANCELED', staffId, ['TAS'])
    ).rejects.toThrow('REQUIRES_POS_AUTHORIZATION');
  });
});
