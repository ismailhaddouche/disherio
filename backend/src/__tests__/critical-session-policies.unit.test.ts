let sessionUpdateStateIf: jest.Mock;
let sessionLockIfStateIn: jest.Mock;
let sessionFindById: jest.Mock;
let totemFindById: jest.Mock;
let paymentMarkAllTicketsPaid: jest.Mock;
let paymentFindBySessionId: jest.Mock;
let paymentCreate: jest.Mock;
let paymentFindById: jest.Mock;
let paymentMarkTicketPaid: jest.Mock;
let itemFindById: jest.Mock;
let itemUpdateState: jest.Mock;
let itemFindActiveBySessionId: jest.Mock;
let restaurantFindById: jest.Mock;
let orderCreate: jest.Mock;
let orderFindById: jest.Mock;
let itemCreate: jest.Mock;
let dishFindById: jest.Mock;

const dbSession = { id: 'session' };

jest.mock('../utils/transactions', () => ({
  withTransaction: jest.fn(async (operation: (session: unknown) => Promise<unknown>) => operation(dbSession)),
}));

jest.mock('../repositories/totem.repository', () => ({
  TotemRepository: jest.fn().mockImplementation(() => ({
    findById: (totemFindById = jest.fn()),
    findByRestaurantIdSelectId: jest.fn(),
  })),
  TotemSessionRepository: jest.fn().mockImplementation(() => {
    sessionUpdateStateIf = jest.fn();
    sessionLockIfStateIn = jest.fn();
    sessionFindById = jest.fn();
    return {
      updateStateIf: sessionUpdateStateIf,
      lockIfStateIn: sessionLockIfStateIn,
      findById: sessionFindById,
    };
  }),
  CustomerRepository: jest.fn().mockImplementation(() => ({ findById: jest.fn() })),
}));

jest.mock('../repositories/order.repository', () => ({
  OrderRepository: jest.fn().mockImplementation(() => {
    orderCreate = jest.fn();
    orderFindById = jest.fn();
    return { createOrder: orderCreate, findById: orderFindById };
  }),
  ItemOrderRepository: jest.fn().mockImplementation(() => {
    itemFindById = jest.fn();
    itemUpdateState = jest.fn();
    itemFindActiveBySessionId = jest.fn();
    itemCreate = jest.fn();
    return {
      findById: itemFindById,
      updateState: itemUpdateState,
      findActiveBySessionId: itemFindActiveBySessionId,
      createItem: itemCreate,
    };
  }),
  PaymentRepository: jest.fn().mockImplementation(() => {
    paymentMarkAllTicketsPaid = jest.fn();
    paymentFindBySessionId = jest.fn();
    paymentCreate = jest.fn();
    paymentFindById = jest.fn();
    paymentMarkTicketPaid = jest.fn();
    return {
      markAllTicketsPaidForSession: paymentMarkAllTicketsPaid,
      findBySessionId: paymentFindBySessionId,
      createPayment: paymentCreate,
      findById: paymentFindById,
      markTicketPaid: paymentMarkTicketPaid,
    };
  }),
}));

jest.mock('../repositories/dish.repository', () => ({
  DishRepository: jest.fn().mockImplementation(() => {
    dishFindById = jest.fn();
    return { findById: dishFindById };
  }),
  CategoryRepository: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../repositories/restaurant.repository', () => ({
  RestaurantRepository: jest.fn().mockImplementation(() => {
    restaurantFindById = jest.fn();
    return { findById: restaurantFindById };
  }),
}));
jest.mock('../config/socket', () => {
  const roomChain = {
    to: jest.fn(),
    emit: jest.fn(),
  };
  roomChain.to.mockReturnValue(roomChain);
  return { getIO: jest.fn(() => roomChain) };
});
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
jest.mock('../services/session-lifecycle-effects.service', () => ({
  notifySessionClosed: jest.fn(),
  cleanupTemporaryTotem: jest.fn(),
}));

import {
  addItemToOrder,
  archiveSession,
  calculateSessionTotal,
  createOrder,
  createPayment,
  markTicketPaid,
  updateItemState,
} from '../services/order.service';
import { cleanupTemporaryTotem, notifySessionClosed } from '../services/session-lifecycle-effects.service';
import { emitSessionArchived, emitTicketPaid } from '../sockets/pos.handler';
import { TotemSession } from '../models/totem.model';
import { ErrorCode, TotemCallWaiterPayloadSchema, TotemRequestBillPayloadSchema } from '@disherio/shared';

const SESSION_ID = '507f1f77bcf86cd799439013';
const ITEM_ID = '507f1f77bcf86cd799439014';
const TOTEM_ID = '507f1f77bcf86cd799439015';
const RESTAURANT_ID = '507f1f77bcf86cd799439016';

function sessionFixture(
  totemState: 'STARTED' | 'COMPLETE' | 'PAID' = 'STARTED',
  totemName = 'Table 1',
  totemType: 'STANDARD' | 'TEMPORARY' = 'STANDARD'
) {
  return {
    _id: SESSION_ID,
    totem_id: { toString: () => TOTEM_ID },
    restaurant_id: { toString: () => RESTAURANT_ID },
    totem_snapshot: {
      totem_id: { toString: () => TOTEM_ID },
      totem_name: totemName,
      totem_type: totemType,
    },
    totem_state: totemState,
  };
}

describe('critical session policies', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    paymentFindBySessionId.mockResolvedValue([{ _id: 'payment' }]);
    sessionFindById.mockResolvedValue(sessionFixture('PAID'));
    totemFindById.mockResolvedValue({
      restaurant_id: { toString: () => '507f1f77bcf86cd799439016' },
    });
  });

  it('creates BY_USER tickets from active items in the payment transaction and closes after commit', async () => {
    const totemId = '507f1f77bcf86cd799439015';
    const restaurantId = '507f1f77bcf86cd799439016';
    sessionLockIfStateIn.mockResolvedValue({
      _id: SESSION_ID,
      totem_id: { toString: () => totemId },
      totem_state: 'STARTED',
    });
    sessionUpdateStateIf.mockResolvedValue(sessionFixture('COMPLETE'));
    paymentFindBySessionId.mockResolvedValue([]);
    sessionFindById.mockResolvedValue(sessionFixture('STARTED'));
    totemFindById.mockResolvedValue({
      _id: { toString: () => totemId },
      restaurant_id: { toString: () => restaurantId },
      totem_name: 'Table 1',
      totem_type: 'STANDARD',
    });
    restaurantFindById.mockResolvedValue({ tax_rate: 10, tips_state: false });
    itemFindActiveBySessionId.mockResolvedValue([
      {
        customer_id: { toString: () => 'customer-a' },
        customer_name: 'Alice',
        item_base_price: 10,
        item_disher_extras: [],
      },
      {
        customer_id: { toString: () => 'customer-b' },
        customer_name: 'Bob',
        item_base_price: 20,
        item_disher_extras: [],
      },
    ]);
    paymentCreate.mockImplementation(async (payment) => payment);

    const payment = await createPayment(SESSION_ID, 'BY_USER', 1, 1.01);

    expect(sessionLockIfStateIn).toHaveBeenCalledWith(SESSION_ID, ['STARTED', 'COMPLETE'], dbSession);
    expect(itemFindActiveBySessionId).toHaveBeenCalledWith(SESSION_ID, dbSession);
    expect(paymentCreate).toHaveBeenCalledWith(expect.objectContaining({
      payment_total: 31.01,
      tickets: [
        expect.objectContaining({ ticket_amount: 10.34, ticket_customer_name: 'Alice' }),
        expect.objectContaining({ ticket_amount: 20.67, ticket_customer_name: 'Bob' }),
      ],
    }), dbSession);
    expect(totemFindById).not.toHaveBeenCalled();
    expect(payment.tickets.reduce((sum: number, ticket: { ticket_amount: number }) =>
      sum + Math.round(ticket.ticket_amount * 100), 0)).toBe(3101);
    expect(notifySessionClosed).toHaveBeenCalledWith(SESSION_ID, {
      restaurantId,
      state: 'COMPLETE',
      closedBy: 'pos',
    });
  });

  it('serializes order creation against session closure in the same transaction', async () => {
    sessionLockIfStateIn.mockResolvedValue({ _id: SESSION_ID, totem_state: 'STARTED' });
    orderCreate.mockResolvedValue({ _id: 'order' });

    await expect(createOrder(SESSION_ID, '507f1f77bcf86cd799439099')).resolves.toEqual({ _id: 'order' });

    expect(sessionLockIfStateIn).toHaveBeenCalledWith(SESSION_ID, ['STARTED'], dbSession);
    expect(orderCreate).toHaveBeenCalledWith(
      SESSION_ID,
      '507f1f77bcf86cd799439099',
      undefined,
      dbSession
    );
  });

  it('reports invalid persisted prices as a 400 operational error', async () => {
    const restaurantId = '507f1f77bcf86cd799439016';
    sessionLockIfStateIn.mockResolvedValue({ _id: SESSION_ID, totem_state: 'STARTED' });
    orderFindById.mockResolvedValue({
      session_id: { toString: () => SESSION_ID },
      order_number: 1,
    });
    dishFindById.mockResolvedValue({
      restaurant_id: { toString: () => restaurantId },
      disher_status: 'ACTIVATED',
      disher_price: -1,
      disher_type: 'KITCHEN',
      disher_name: [{ lang: 'en', value: 'Invalid dish' }],
      variants: [],
      extras: [],
    });
    sessionFindById.mockResolvedValue(sessionFixture('STARTED'));
    totemFindById.mockResolvedValue({
      restaurant_id: { toString: () => restaurantId },
    });

    await expect(addItemToOrder('order-id', SESSION_ID, 'dish-id')).rejects.toMatchObject({
      message: ErrorCode.INVALID_PRICE,
      statusCode: 400,
      isOperational: true,
      details: {
        invalidPrices: [{ field: 'item_base_price', value: -1 }],
      },
    });
    expect(itemCreate).not.toHaveBeenCalled();
  });

  it('adds a complimentary service item with a zero price', async () => {
    const restaurantId = '507f1f77bcf86cd799439016';
    sessionLockIfStateIn.mockResolvedValue({ _id: SESSION_ID, totem_state: 'STARTED' });
    orderFindById.mockResolvedValue({
      session_id: { toString: () => SESSION_ID },
      order_number: 1,
    });
    dishFindById.mockResolvedValue({
      restaurant_id: { toString: () => restaurantId },
      disher_status: 'ACTIVATED',
      disher_price: 0,
      disher_type: 'SERVICE',
      disher_name: [{ lang: 'en', value: 'Bread service' }],
      variants: [],
      extras: [],
    });
    sessionFindById.mockResolvedValue(sessionFixture('STARTED'));
    totemFindById.mockResolvedValue({
      restaurant_id: { toString: () => restaurantId },
    });
    itemCreate.mockImplementation(async (item) => ({ _id: 'free-item', ...item }));

    await expect(addItemToOrder('order-id', SESSION_ID, 'dish-id')).resolves.toMatchObject({
      _id: 'free-item',
      item_base_price: 0,
      item_disher_type: 'SERVICE',
    });
    expect(itemCreate).toHaveBeenCalledWith(expect.objectContaining({
      item_base_price: 0,
      item_disher_variant: null,
      item_disher_extras: [],
    }), dbSession);
  });

  it('rejects an excessive custom tip before reading payment state', async () => {
    await expect(calculateSessionTotal(SESSION_ID, 1_000_000)).rejects.toMatchObject({
      message: ErrorCode.INVALID_PRICE,
      statusCode: 400,
      details: {
        invalidPrices: [{ field: 'tips', value: 1_000_000 }],
      },
    });
    expect(sessionFindById).not.toHaveBeenCalled();
  });

  it('uses the transaction restaurant id when notifying KDS after commit', async () => {
    const restaurantId = '507f1f77bcf86cd799439016';
    sessionLockIfStateIn.mockResolvedValue({ _id: SESSION_ID, totem_state: 'STARTED' });
    orderFindById.mockResolvedValue({
      session_id: { toString: () => SESSION_ID },
      order_number: 1,
    });
    dishFindById.mockResolvedValue({
      restaurant_id: { toString: () => restaurantId },
      disher_status: 'ACTIVATED',
      disher_price: 5,
      disher_type: 'KITCHEN',
      disher_name: [{ lang: 'en', value: 'Soup' }],
      variants: [],
      extras: [],
    });
    sessionFindById.mockResolvedValueOnce(sessionFixture('STARTED'));
    totemFindById.mockResolvedValue({
      restaurant_id: { toString: () => restaurantId },
    });
    itemCreate.mockImplementation(async (item) => ({ _id: 'kitchen-item', ...item }));

    await expect(addItemToOrder('order-id', SESSION_ID, 'dish-id')).resolves.toMatchObject({
      _id: 'kitchen-item',
      item_disher_type: 'KITCHEN',
    });
    expect(sessionFindById).toHaveBeenCalledTimes(1);
  });

  it('settles every ticket in the same transaction that archives the session', async () => {
    sessionUpdateStateIf
      .mockResolvedValueOnce(sessionFixture('COMPLETE'))
      .mockResolvedValueOnce(sessionFixture('PAID'));
    paymentMarkAllTicketsPaid.mockResolvedValue({
      payment_total: 42,
      payment_type: 'ALL',
      tickets: [{ ticket_part: 1, paid: true }],
    });

    await expect(archiveSession(SESSION_ID)).resolves.toMatchObject({ totem_state: 'PAID' });
    expect(sessionUpdateStateIf).toHaveBeenNthCalledWith(1, SESSION_ID, ['COMPLETE'], 'COMPLETE', dbSession);
    expect(sessionUpdateStateIf).toHaveBeenNthCalledWith(2, SESSION_ID, ['COMPLETE'], 'PAID', dbSession);
    expect(paymentMarkAllTicketsPaid).toHaveBeenCalledWith(SESSION_ID, dbSession);
    expect(cleanupTemporaryTotem).toHaveBeenCalledWith(expect.objectContaining({ totem_state: 'PAID' }));
  });

  it('archives and cleans up a temporary totem when the last ticket is paid', async () => {
    const restaurantId = '507f1f77bcf86cd799439016';
    const paidSession = sessionFixture('PAID');
    paymentFindById.mockResolvedValue({ _id: 'payment' });
    paymentMarkTicketPaid.mockResolvedValue({
      session_id: { toString: () => SESSION_ID },
      payment_total: 42,
      payment_type: 'ALL',
      tickets: [{ ticket_part: 1, ticket_amount: 42, paid: true }],
    });
    sessionUpdateStateIf.mockResolvedValue(paidSession);
    sessionFindById.mockResolvedValue(paidSession);
    totemFindById.mockResolvedValue({ restaurant_id: { toString: () => restaurantId } });

    await expect(markTicketPaid('507f1f77bcf86cd799439099', 1)).resolves.toMatchObject({
      payment_total: 42,
    });

    expect(emitSessionArchived).toHaveBeenCalledWith(
      SESSION_ID,
      { paymentTotal: 42, paymentType: 'ALL' },
      restaurantId
    );
    expect(emitTicketPaid).not.toHaveBeenCalled();
    expect(cleanupTemporaryTotem).toHaveBeenCalledWith(paidSession);
  });

  it('creates a historical payment before archiving a session without one', async () => {
    const totemId = '507f1f77bcf86cd799439015';
    const restaurantId = '507f1f77bcf86cd799439016';
    sessionUpdateStateIf
      .mockResolvedValueOnce(sessionFixture('COMPLETE', 'Terrace 1', 'TEMPORARY'))
      .mockResolvedValueOnce(sessionFixture('PAID', 'Terrace 1', 'TEMPORARY'));
    paymentFindBySessionId.mockResolvedValue([]);
    sessionFindById.mockResolvedValue(sessionFixture('PAID', 'Terrace 1', 'TEMPORARY'));
    totemFindById.mockResolvedValue({
      _id: { toString: () => totemId },
      restaurant_id: { toString: () => restaurantId },
      totem_name: 'Terrace 1',
      totem_type: 'TEMPORARY',
    });
    restaurantFindById.mockResolvedValue({ tax_rate: 10, tips_state: false });
    itemFindActiveBySessionId.mockResolvedValue([{
      item_base_price: 22,
      item_disher_extras: [],
    }]);
    paymentCreate.mockResolvedValue({ _id: 'payment' });
    paymentMarkAllTicketsPaid.mockResolvedValue({
      payment_total: 22,
      payment_type: 'ALL',
      tickets: [{ ticket_part: 1, paid: true }],
    });

    await expect(archiveSession(SESSION_ID)).resolves.toMatchObject({ totem_state: 'PAID' });
    expect(paymentCreate).toHaveBeenCalledWith(expect.objectContaining({
      session_id: SESSION_ID,
      restaurant_id: restaurantId,
      payment_type: 'ALL',
      payment_total: 22,
      totem_snapshot: {
        totem_id: totemId,
        totem_name: 'Terrace 1',
        totem_type: 'TEMPORARY',
      },
    }), dbSession);
  });

  it('rejects item transitions when the owning session is already terminal', async () => {
    itemFindById.mockResolvedValue({
      _id: ITEM_ID,
      session_id: { toString: () => SESSION_ID },
      item_state: 'ORDERED',
      item_disher_type: 'KITCHEN',
      item_name_snapshot: [],
    });
    sessionLockIfStateIn.mockResolvedValue(null);

    await expect(updateItemState(ITEM_ID, 'ON_PREPARE', 'staff', ['KTS']))
      .rejects.toThrow('SESSION_NOT_ACTIVE');
    expect(itemUpdateState).not.toHaveBeenCalled();
  });

  it('rejects item transitions after a payment snapshot exists', async () => {
    itemFindById.mockResolvedValue({
      _id: ITEM_ID,
      session_id: { toString: () => SESSION_ID },
      item_state: 'ORDERED',
      item_disher_type: 'KITCHEN',
      item_name_snapshot: [],
    });
    sessionLockIfStateIn.mockResolvedValue({ _id: SESSION_ID, totem_state: 'COMPLETE' });
    paymentFindBySessionId.mockResolvedValue([{ _id: 'payment' }]);

    await expect(updateItemState(ITEM_ID, 'CANCELED', 'staff', ['KTS']))
      .rejects.toThrow('ORDER_ALREADY_PAID');
    expect(paymentFindBySessionId).toHaveBeenCalledWith(SESSION_ID, dbSession);
    expect(itemUpdateState).not.toHaveBeenCalled();
  });

  it('declares a partial unique index for active sessions', () => {
    expect(TotemSession.schema.indexes()).toContainEqual([
      { totem_id: 1 },
      expect.objectContaining({
        name: 'unique_started_session_per_totem',
        unique: true,
        partialFilterExpression: { totem_state: 'STARTED' },
      }),
    ]);
  });

  it('rejects customer identity overrides after a socket has joined', () => {
    expect(TotemCallWaiterPayloadSchema.safeParse({
      sessionId: SESSION_ID,
      customerId: '507f1f77bcf86cd799439099',
    }).success).toBe(false);
    expect(TotemRequestBillPayloadSchema.safeParse({
      sessionId: SESSION_ID,
      customerName: 'Impersonated customer',
    }).success).toBe(false);
  });
});
