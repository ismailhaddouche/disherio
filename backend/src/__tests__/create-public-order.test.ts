import { createPublicOrderFromQR, resolveRequestedDishOptions } from '../services/public-order.service';
import { IExtra, IVariant } from '../models/dish.model';
import * as totemService from '../services/totem.service';
import { Category } from '../models/dish.model';
import {
  DishRepository,
  ItemOrderRepository,
  OrderRepository,
  RestaurantRepository,
  TotemSessionRepository,
} from '../repositories';
import { createHash } from 'node:crypto';
import { notifyKDSNewItem } from '../sockets/kds.handler';
import { notifyTASNewOrder } from '../sockets/tas.handler';
import { notifyPOSNewOrder } from '../sockets/pos.handler';

jest.mock('../config/socket', () => ({
  getIO: jest.fn(() => ({ to: jest.fn(() => ({ emit: jest.fn() })) })),
}));
jest.mock('../sockets/kds.handler', () => ({ notifyKDSNewItem: jest.fn() }));
jest.mock('../sockets/tas.handler', () => ({ notifyTASNewOrder: jest.fn() }));
jest.mock('../sockets/pos.handler', () => ({
  emitSessionClosed: jest.fn(),
  emitSessionReopened: jest.fn(),
  emitSessionArchived: jest.fn(),
  emitTicketPaid: jest.fn(),
  notifyPOSNewOrder: jest.fn(),
}));
jest.mock('../sockets/totem.handler', () => ({ notifyCustomerItemUpdate: jest.fn() }));
jest.mock('../utils/transactions', () => ({ withTransaction: jest.fn(async (fn: (s: unknown) => Promise<unknown>) => fn(null)) }));
jest.mock('../services/totem.service', () => ({
  getOrCreateSessionByQR: jest.fn(),
  getPublicSessionByQR: jest.fn(),
  getTotemByQR: jest.fn(),
  assertCustomerInSession: jest.fn(),
  assertSessionToken: jest.fn(),
}));

const RESTAURANT_ID = '507f1f77bcf86cd799439011';
const SESSION_ID = '507f1f77bcf86cd799439013';
const DISH_ID = '507f1f77bcf86cd799439014';
const CUSTOMER_ID = '507f1f77bcf86cd799439015';
const REQUEST_ID = '123e4567-e89b-42d3-a456-426614174000';

describe('PublicOrderService.createPublicOrderFromQR', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset any custom implementation left over from a previous test so
    // assertSessionToken defaults back to a no-op mock.
    (totemService.assertSessionToken as jest.Mock).mockImplementation(() => undefined);
    (totemService.getPublicSessionByQR as jest.Mock).mockResolvedValue({
      _id: SESSION_ID,
      totem_state: 'STARTED',
      session_token: 'tok-1',
    });
    (totemService.getTotemByQR as jest.Mock).mockResolvedValue({ restaurant_id: RESTAURANT_ID });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should throw VALIDATION_ERROR when items array is empty', async () => {
    (totemService.getOrCreateSessionByQR as jest.Mock).mockResolvedValue({
      session: { _id: SESSION_ID, totem_state: 'STARTED', session_token: 'tok-1' },
      totem: { restaurant_id: RESTAURANT_ID },
    });

    await expect(createPublicOrderFromQR('qr-code', SESSION_ID, [], REQUEST_ID, undefined, 'tok-1')).rejects.toThrow('VALIDATION_ERROR');
    expect(totemService.getPublicSessionByQR).toHaveBeenCalledWith('qr-code', SESSION_ID, 'tok-1');
  });

  it('should validate the session token before processing the order', async () => {
    (totemService.getOrCreateSessionByQR as jest.Mock).mockResolvedValue({
      session: { _id: SESSION_ID, totem_state: 'STARTED', session_token: 'tok-1' },
      totem: { restaurant_id: RESTAURANT_ID },
    });
    (totemService.getPublicSessionByQR as jest.Mock).mockRejectedValue(new Error('INVALID_TOKEN'));

    await expect(
      createPublicOrderFromQR('qr-code', SESSION_ID, [{ dishId: DISH_ID, quantity: 1 }], REQUEST_ID, undefined, 'wrong-token')
    ).rejects.toThrow('INVALID_TOKEN');
    expect(totemService.getPublicSessionByQR).toHaveBeenCalledWith('qr-code', SESSION_ID, 'wrong-token');
  });

  it('should throw SESSION_NOT_ACTIVE when session is not STARTED', async () => {
    (totemService.getOrCreateSessionByQR as jest.Mock).mockResolvedValue({
      session: { _id: SESSION_ID, totem_state: 'COMPLETE' },
      totem: { restaurant_id: RESTAURANT_ID },
    });
    jest.spyOn(TotemSessionRepository.prototype, 'lockById').mockResolvedValue({
      _id: SESSION_ID,
      totem_state: 'COMPLETE',
      session_token: 'tok-1',
    } as never);
    jest.spyOn(OrderRepository.prototype, 'findByRequestId').mockResolvedValue(null);

    await expect(
      createPublicOrderFromQR('qr-code', SESSION_ID, [{ dishId: DISH_ID, quantity: 1 }], REQUEST_ID, undefined, 'tok-1')
    ).rejects.toThrow('SESSION_NOT_ACTIVE');
  });

  it('should throw SESSION_NOT_ACTIVE when session is null', async () => {
    (totemService.getOrCreateSessionByQR as jest.Mock).mockResolvedValue({
      session: { _id: SESSION_ID, totem_state: 'PAID' },
      totem: { restaurant_id: RESTAURANT_ID },
    });
    jest.spyOn(TotemSessionRepository.prototype, 'lockById').mockResolvedValue({
      _id: SESSION_ID,
      totem_state: 'PAID',
      session_token: 'tok-1',
    } as never);
    jest.spyOn(OrderRepository.prototype, 'findByRequestId').mockResolvedValue(null);

    await expect(
      createPublicOrderFromQR('qr-code', SESSION_ID, [{ dishId: DISH_ID, quantity: 1 }], REQUEST_ID, undefined, 'tok-1')
    ).rejects.toThrow('SESSION_NOT_ACTIVE');
  });

  it('should reject a customer that does not belong to the QR session', async () => {
    (totemService.getOrCreateSessionByQR as jest.Mock).mockResolvedValue({
      session: { _id: SESSION_ID, totem_state: 'STARTED', session_token: 'tok-1' },
      totem: { restaurant_id: RESTAURANT_ID },
    });
    (totemService.assertCustomerInSession as jest.Mock).mockRejectedValue(new Error('CUSTOMER_NOT_FOUND'));
    jest.spyOn(TotemSessionRepository.prototype, 'lockById').mockResolvedValue({
      _id: SESSION_ID,
      totem_state: 'STARTED',
      session_token: 'tok-1',
    } as never);
    jest.spyOn(OrderRepository.prototype, 'findByRequestId').mockResolvedValue(null);

    await expect(
      createPublicOrderFromQR('qr-code', SESSION_ID, [{ dishId: DISH_ID, quantity: 1 }], REQUEST_ID, CUSTOMER_ID, 'tok-1')
    ).rejects.toThrow('CUSTOMER_NOT_FOUND');
    expect(totemService.assertCustomerInSession).toHaveBeenCalledWith(CUSTOMER_ID, SESSION_ID, 'tok-1');
  });

  it('revalidates the public order limit after locking the session', async () => {
    const categoryId = '507f1f77bcf86cd799439016';
    (totemService.getOrCreateSessionByQR as jest.Mock).mockResolvedValue({
      session: { _id: SESSION_ID, totem_state: 'STARTED', session_token: 'tok-1' },
      totem: { restaurant_id: { toString: () => RESTAURANT_ID } },
    });
    jest.spyOn(DishRepository.prototype, 'findById').mockResolvedValue({
      _id: { toString: () => DISH_ID },
      restaurant_id: { toString: () => RESTAURANT_ID },
      category_id: { toString: () => categoryId },
      disher_status: 'ACTIVATED',
      variants: [],
      extras: [],
    } as never);
    jest.spyOn(Category, 'find').mockReturnValue({
      select: () => ({
        lean: () => ({
          exec: async () => [{ _id: { toString: () => categoryId }, unlimited_orders: false }],
        }),
      }),
    } as never);
    jest.spyOn(RestaurantRepository.prototype, 'findByIdLean').mockResolvedValue({
      order_interval_minutes: 0,
      max_orders_per_session: 1,
    } as never);
    const limitStats = jest.spyOn(ItemOrderRepository.prototype, 'getLimitedOrderStats')
      .mockResolvedValue({ count: 1, lastOrderDate: new Date() });
    jest.spyOn(TotemSessionRepository.prototype, 'lockById').mockResolvedValue({
      _id: SESSION_ID,
      totem_state: 'STARTED',
      session_token: 'tok-1',
    } as never);
    jest.spyOn(OrderRepository.prototype, 'findByRequestId').mockResolvedValue(null);
    const createOrder = jest.spyOn(OrderRepository.prototype, 'createOrder');

    await expect(createPublicOrderFromQR(
      'qr-code',
      SESSION_ID,
      [{ dishId: DISH_ID, quantity: 1 }],
      REQUEST_ID,
      undefined,
      'tok-1'
    )).rejects.toThrow('ORDER_LIMIT_REACHED');

    expect(limitStats).toHaveBeenCalledTimes(1);
    expect(limitStats.mock.calls[0][1]).not.toBeUndefined();
    expect(createOrder).not.toHaveBeenCalled();
  });

  it('returns the persisted result without emitting events for a repeated request', async () => {
    const persistedItem = { _id: 'item-1', item_disher_type: 'KITCHEN' };
    const requestHash = createHash('sha256').update(JSON.stringify({
      customer_id: null,
      items: [{ dishId: DISH_ID, extras: [], quantity: 1 }],
    })).digest('hex');
    (totemService.getOrCreateSessionByQR as jest.Mock).mockResolvedValue({
      session: { _id: SESSION_ID, totem_state: 'STARTED', session_token: 'tok-1' },
      totem: { restaurant_id: RESTAURANT_ID },
    });
    jest.spyOn(TotemSessionRepository.prototype, 'lockById').mockResolvedValue({
      _id: SESSION_ID,
      totem_state: 'STARTED',
      session_token: 'tok-1',
    } as never);
    jest.spyOn(OrderRepository.prototype, 'findByRequestId').mockResolvedValue({
      _id: { toString: () => 'order-1' },
      request_hash: requestHash,
    } as never);
    jest.spyOn(ItemOrderRepository.prototype, 'findByOrderId').mockResolvedValue([persistedItem] as never);

    await expect(createPublicOrderFromQR(
      'qr-code',
      SESSION_ID,
      [{ dishId: DISH_ID, quantity: 1 }],
      REQUEST_ID,
      undefined,
      'tok-1'
    )).resolves.toEqual({ orderId: 'order-1', items: [persistedItem] });

    expect(notifyKDSNewItem).not.toHaveBeenCalled();
    expect(notifyTASNewOrder).not.toHaveBeenCalled();
    expect(notifyPOSNewOrder).not.toHaveBeenCalled();
  });

  it('rejects a repeated request id with a different payload', async () => {
    (totemService.getOrCreateSessionByQR as jest.Mock).mockResolvedValue({
      session: { _id: SESSION_ID, totem_state: 'STARTED', session_token: 'tok-1' },
      totem: { restaurant_id: RESTAURANT_ID },
    });
    jest.spyOn(TotemSessionRepository.prototype, 'lockById').mockResolvedValue({
      _id: SESSION_ID,
      totem_state: 'STARTED',
      session_token: 'tok-1',
    } as never);
    jest.spyOn(OrderRepository.prototype, 'findByRequestId').mockResolvedValue({
      _id: { toString: () => 'order-1' },
      request_hash: 'different-hash',
    } as never);

    await expect(createPublicOrderFromQR(
      'qr-code',
      SESSION_ID,
      [{ dishId: DISH_ID, quantity: 1 }],
      REQUEST_ID,
      undefined,
      'tok-1'
    )).rejects.toMatchObject({ message: 'IDEMPOTENCY_CONFLICT', statusCode: 409 });
  });
});

describe('PublicOrderService.resolveRequestedDishOptions', () => {
  const variant = { _id: { toString: () => 'variant-1' } } as unknown as IVariant;
  const extra = { _id: { toString: () => 'extra-1' } } as unknown as IExtra;

  it('rejects an unknown requested variant', () => {
    expect(() => resolveRequestedDishOptions([variant], [], 'variant-missing')).toThrow('VALIDATION_ERROR');
  });

  it('rejects unknown or duplicate requested extras', () => {
    expect(() => resolveRequestedDishOptions([], [extra], undefined, ['extra-missing'])).toThrow('VALIDATION_ERROR');
    expect(() => resolveRequestedDishOptions([], [extra], undefined, ['extra-1', 'extra-1'])).toThrow('VALIDATION_ERROR');
  });

  it('returns only options that belong to the dish', () => {
    expect(resolveRequestedDishOptions([variant], [extra], 'variant-1', ['extra-1']))
      .toEqual({ variant, selectedExtras: [extra] });
  });
});
