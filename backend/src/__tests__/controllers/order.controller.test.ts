import { Request, Response, NextFunction } from 'express';
import {
  createOrder,
  addItem,
  addBatchItems,
  updateItemState,
  getKitchenItems,
  getSessionItems,
  createPayment,
  markTicketPaid,
  deleteItem,
  assignItemToCustomer,
  getServiceItems
} from '../../controllers/order.controller';
import * as orderService from '../../services/order.service';
import * as orderOwnershipService from '../../services/order-ownership.service';
import { TotemSession, Totem } from '../../models/totem.model';
import { ItemOrder } from '../../models/order.model';
import { AppError } from '../../utils/async-handler';

jest.mock('../../services/order.service');
jest.mock('../../services/order-ownership.service');
jest.mock('../../models/totem.model', () => ({
  TotemSession: { findById: jest.fn() },
  Totem: { findById: jest.fn() },
}));
jest.mock('../../models/order.model', () => ({
  ItemOrder: { findById: jest.fn() },
}));

const RESTAURANT_ID = '507f1f77bcf86cd799439011';
const SESSION_ID = '507f1f77bcf86cd799439012';
const TOTEM_ID = '507f1f77bcf86cd799439013';
const ITEM_ID = '507f1f77bcf86cd799439014';
const PAYMENT_ID = '507f1f77bcf86cd799439015';

const mockTotemSessionFindById = TotemSession.findById as jest.Mock;
const mockTotemFindById = Totem.findById as jest.Mock;
const mockItemOrderFindById = ItemOrder.findById as jest.Mock;

function buildLeanQuery(value: unknown) {
  return {
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(value),
  };
}

function mockSessionOwnership(): void {
  mockTotemSessionFindById.mockReturnValue(buildLeanQuery({ totem_id: TOTEM_ID }));
  mockTotemFindById.mockReturnValue(buildLeanQuery({ restaurant_id: RESTAURANT_ID }));
}

function mockItemOwnership(): void {
  mockItemOrderFindById.mockReturnValue(buildLeanQuery({ session_id: SESSION_ID }));
  mockSessionOwnership();
}

describe('OrderController', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;
  let endMock: jest.Mock;

  const mockUser = {
    staffId: 'staff123',
    restaurantId: RESTAURANT_ID,
    role: 'ADMIN',
    permissions: ['ADMIN', 'POS', 'KDS'],
    name: 'Test User'
  };

  beforeEach(() => {
    jest.clearAllMocks();

    jsonMock = jest.fn().mockReturnThis();
    statusMock = jest.fn().mockReturnThis();
    endMock = jest.fn().mockReturnThis();
    next = jest.fn();

    res = {
      json: jsonMock,
      status: statusMock,
      end: endMock,
    };

    req = {
      user: mockUser,
      body: {},
      params: {},
      query: {}
    };
  });

  describe('POST /orders', () => {
    it('should create order and return 201 with order data', async () => {
      const mockOrder = {
        _id: 'order123',
        session_id: SESSION_ID,
        order_state: 'OPEN'
      };

      req.body = { session_id: SESSION_ID };
      (orderService.createOrder as jest.Mock).mockResolvedValue(mockOrder);

      await createOrder(req as Request, res as Response, next);

      expect(orderService.createOrder).toHaveBeenCalledWith(SESSION_ID, 'staff123');
      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith(mockOrder);
    });

    it('should pass error to next when session is not active', async () => {
      req.body = { session_id: SESSION_ID };
      const error = new Error('SESSION_NOT_ACTIVE');
      (orderService.createOrder as jest.Mock).mockRejectedValue(error);

      await createOrder(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('POST /orders/items', () => {
    it('should add item to order and return 201', async () => {
      const mockItem = {
        _id: ITEM_ID,
        order_id: 'order123',
        dish_id: 'dish123',
        item_state: 'ORDERED'
      };

      req.body = {
        request_id: '123e4567-e89b-42d3-a456-426614174000',
        order_id: 'order123',
        session_id: SESSION_ID,
        dish_id: 'dish123',
        customer_id: 'customer123',
        variant_id: 'variant123',
        extras: ['extra1', 'extra2']
      };

      (orderService.addItemToOrder as jest.Mock).mockResolvedValue(mockItem);

      await addItem(req as Request, res as Response, next);

      expect(orderService.addItemToOrder).toHaveBeenCalledWith(
        'order123',
        SESSION_ID,
        'dish123',
        'customer123',
        'variant123',
        ['extra1', 'extra2'],
        'POS',
        'staff123',
        '123e4567-e89b-42d3-a456-426614174000'
      );
      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith(mockItem);
    });

    it('should handle item without optional fields', async () => {
      const mockItem = { _id: ITEM_ID, item_state: 'ORDERED' };

      req.body = {
        request_id: '123e4567-e89b-42d3-a456-426614174001',
        order_id: 'order123',
        session_id: SESSION_ID,
        dish_id: 'dish123'
      };

      (orderService.addItemToOrder as jest.Mock).mockResolvedValue(mockItem);

      await addItem(req as Request, res as Response, next);

      expect(orderService.addItemToOrder).toHaveBeenCalledWith(
        'order123', SESSION_ID, 'dish123', undefined, undefined, undefined, 'POS', 'staff123',
        '123e4567-e89b-42d3-a456-426614174001'
      );
    });

    it('should pass error to next when dish not found', async () => {
      req.body = { order_id: 'order123', session_id: SESSION_ID, dish_id: 'invalid_dish' };
      const error = new Error('DISH_NOT_FOUND');
      (orderService.addItemToOrder as jest.Mock).mockRejectedValue(error);

      await addItem(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(error);
    });

    it('should pass error to next when dish not available', async () => {
      req.body = { order_id: 'order123', session_id: SESSION_ID, dish_id: 'inactive_dish' };
      const error = new Error('DISH_NOT_AVAILABLE');
      (orderService.addItemToOrder as jest.Mock).mockRejectedValue(error);

      await addItem(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('POST /orders/items/batch', () => {
    it('forwards the validated idempotency key to the service', async () => {
      const requestId = '123e4567-e89b-42d3-a456-426614174000';
      const items = [{ dishId: 'dish123', quantity: 1 }];
      req.body = {
        request_id: requestId,
        session_id: SESSION_ID,
        items,
        as_served: false,
      };
      (orderService.addBatchItems as jest.Mock).mockResolvedValue({ orderId: 'order123', items: [] });

      await addBatchItems(req as Request, res as Response, next);

      expect(orderService.addBatchItems).toHaveBeenCalledWith(
        SESSION_ID,
        'staff123',
        items,
        requestId,
        false,
        'POS'
      );
      expect(statusMock).toHaveBeenCalledWith(201);
    });
  });

  describe('PATCH /orders/items/:id/state', () => {
    it('should update item state and return updated item', async () => {
      const mockItem = {
        _id: ITEM_ID,
        item_state: 'ON_PREPARE'
      };

      req.params = { id: ITEM_ID };
      req.body = { state: 'ON_PREPARE' };
      mockItemOwnership();
      (orderService.updateItemState as jest.Mock).mockResolvedValue(mockItem);

      await updateItemState(req as Request, res as Response, next);

      expect(orderService.updateItemState).toHaveBeenCalledWith(
        ITEM_ID,
        'ON_PREPARE',
        'staff123',
        ['ADMIN', 'POS', 'KDS'],
        'POS'
      );
      expect(jsonMock).toHaveBeenCalledWith(mockItem);
    });

    it('should pass error to next on invalid state transition', async () => {
      req.params = { id: ITEM_ID };
      req.body = { state: 'INVALID_STATE' };
      const error = new Error('INVALID_STATE_TRANSITION');
      mockItemOwnership();
      (orderService.updateItemState as jest.Mock).mockRejectedValue(error);

      await updateItemState(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(error);
    });

    it('should pass POS authorization error to next', async () => {
      req.params = { id: ITEM_ID };
      req.body = { state: 'CANCELED' };
      const error = new Error('REQUIRES_POS_AUTHORIZATION');
      mockItemOwnership();
      (orderService.updateItemState as jest.Mock).mockRejectedValue(error);

      await updateItemState(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('GET /orders/kitchen-items', () => {
    it('should return kitchen items for restaurant', async () => {
      const mockItems = [
        { _id: 'item1', item_name_snapshot: 'Pizza', item_state: 'ORDERED' },
        { _id: 'item2', item_name_snapshot: 'Pasta', item_state: 'ON_PREPARE' }
      ];

      (orderService.getKitchenItems as jest.Mock).mockResolvedValue(mockItems);

      await getKitchenItems(req as Request, res as Response, next);

      expect(orderService.getKitchenItems).toHaveBeenCalledWith(RESTAURANT_ID);
      expect(jsonMock).toHaveBeenCalledWith(mockItems);
    });

    it('should return empty array when no kitchen items', async () => {
      (orderService.getKitchenItems as jest.Mock).mockResolvedValue([]);

      await getKitchenItems(req as Request, res as Response, next);

      expect(jsonMock).toHaveBeenCalledWith([]);
    });
  });

  describe('GET /orders/session/:sessionId/items', () => {
    it('should return items for session', async () => {
      const mockItems = [
        { _id: 'item1', session_id: SESSION_ID },
        { _id: 'item2', session_id: SESSION_ID }
      ];

      req.params = { sessionId: SESSION_ID };
      mockSessionOwnership();
      (orderService.getSessionItems as jest.Mock).mockResolvedValue(mockItems);

      await getSessionItems(req as Request, res as Response, next);

      expect(orderService.getSessionItems).toHaveBeenCalledWith(SESSION_ID);
      expect(jsonMock).toHaveBeenCalledWith(mockItems);
    });
  });

  describe('POST /orders/payments', () => {
    it('should create payment and return 201', async () => {
      const mockPayment = {
        _id: PAYMENT_ID,
        session_id: SESSION_ID,
        payment_type: 'ALL',
        payment_total: 100
      };

      req.body = {
        session_id: SESSION_ID,
        payment_type: 'ALL',
        parts: 1,
        tips: 10
      };
      mockSessionOwnership();
      (orderService.createPayment as jest.Mock).mockResolvedValue(mockPayment);

      await createPayment(req as Request, res as Response, next);

      expect(orderService.createPayment).toHaveBeenCalledWith(SESSION_ID, 'ALL', 1, 10);
      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith(mockPayment);
    });

    it('should pass error to next when no items to pay', async () => {
      req.body = { session_id: SESSION_ID, payment_type: 'ALL' };
      const error = new Error('NO_ITEMS_TO_PAY');
      mockSessionOwnership();
      (orderService.createPayment as jest.Mock).mockRejectedValue(error);

      await createPayment(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('PATCH /orders/payments/:id/tickets', () => {
    it('should mark ticket as paid and return updated payment', async () => {
      const mockPayment = {
        _id: PAYMENT_ID,
        tickets: [{ ticket_part: 1, paid: true }]
      };

      req.params = { id: PAYMENT_ID };
      req.body = { ticket_part: 1 };
      jest.spyOn(orderOwnershipService, 'assertPaymentInRestaurant').mockResolvedValue(SESSION_ID);
      (orderService.markTicketPaid as jest.Mock).mockResolvedValue(mockPayment);

      await markTicketPaid(req as Request, res as Response, next);

      expect(orderService.markTicketPaid).toHaveBeenCalledWith(PAYMENT_ID, 1);
      expect(jsonMock).toHaveBeenCalledWith(mockPayment);
    });

    it('should pass error to next when payment not found', async () => {
      req.params = { id: PAYMENT_ID };
      req.body = { ticket_part: 1 };
      jest.spyOn(orderOwnershipService, 'assertPaymentInRestaurant')
        .mockRejectedValue(new AppError('PAYMENT_NOT_FOUND', 404));

      await markTicketPaid(req as Request, res as Response, next);

      expect(orderService.markTicketPaid).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
      const errorArg = (next as jest.Mock).mock.calls[0][0];
      expect(errorArg).toBeInstanceOf(AppError);
      expect(errorArg.message).toBe('PAYMENT_NOT_FOUND');
    });
  });

  describe('DELETE /orders/items/:id', () => {
    it('should delete item and return 204', async () => {
      req.params = { id: ITEM_ID };
      mockItemOwnership();
      (orderService.deleteItem as jest.Mock).mockResolvedValue({ deleted: true });

      await deleteItem(req as Request, res as Response, next);

      expect(orderService.deleteItem).toHaveBeenCalledWith(ITEM_ID, ['ADMIN', 'POS', 'KDS']);
      expect(statusMock).toHaveBeenCalledWith(204);
      expect(endMock).toHaveBeenCalled();
    });

    it('should pass error to next when item not in ORDERED state', async () => {
      req.params = { id: ITEM_ID };
      const error = new Error('CANNOT_DELETE_ITEM_NOT_ORDERED');
      mockItemOwnership();
      (orderService.deleteItem as jest.Mock).mockRejectedValue(error);

      await deleteItem(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(error);
    });

    it('should pass authorization error to next', async () => {
      req.user = { ...mockUser, permissions: [], name: 'Test' };
      req.params = { id: ITEM_ID };
      const error = new Error('REQUIRES_AUTHORIZATION');
      mockItemOwnership();
      (orderService.deleteItem as jest.Mock).mockRejectedValue(error);

      await deleteItem(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('PATCH /orders/items/:id/customer', () => {
    it('should assign item to customer and return updated item', async () => {
      const mockItem = {
        _id: ITEM_ID,
        customer_id: 'customer123'
      };

      req.params = { id: ITEM_ID };
      req.body = { customer_id: 'customer123' };
      mockItemOwnership();
      (orderService.assignItemToCustomer as jest.Mock).mockResolvedValue(mockItem);

      await assignItemToCustomer(req as Request, res as Response, next);

      expect(orderService.assignItemToCustomer).toHaveBeenCalledWith(ITEM_ID, 'customer123');
      expect(jsonMock).toHaveBeenCalledWith(mockItem);
    });

    it('should allow unassigning customer by passing null', async () => {
      const mockItem = { _id: ITEM_ID, customer_id: null };

      req.params = { id: ITEM_ID };
      req.body = { customer_id: null };
      mockItemOwnership();
      (orderService.assignItemToCustomer as jest.Mock).mockResolvedValue(mockItem);

      await assignItemToCustomer(req as Request, res as Response, next);

      expect(orderService.assignItemToCustomer).toHaveBeenCalledWith(ITEM_ID, null);
    });
  });

  describe('GET /orders/service-items', () => {
    it('should return service items for restaurant', async () => {
      const mockItems = [
        { _id: 'item1', item_disher_type: 'SERVICE', item_name_snapshot: 'Coke' },
        { _id: 'item2', item_disher_type: 'SERVICE', item_name_snapshot: 'Beer' }
      ];

      (orderService.getServiceItems as jest.Mock).mockResolvedValue(mockItems);

      await getServiceItems(req as Request, res as Response, next);

      expect(orderService.getServiceItems).toHaveBeenCalledWith(RESTAURANT_ID);
      expect(jsonMock).toHaveBeenCalledWith(mockItems);
    });
  });
});
