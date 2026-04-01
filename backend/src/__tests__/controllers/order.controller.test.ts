import { Request, Response, NextFunction } from 'express';
import {
  createOrder,
  addItem,
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

// Mock order service
jest.mock('../../services/order.service');

describe('OrderController', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;
  let endMock: jest.Mock;

  const mockUser = {
    staffId: 'staff123',
    restaurantId: 'rest123',
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
      // Arrange
      const mockOrder = {
        _id: 'order123',
        session_id: 'session123',
        order_state: 'OPEN'
      };
      
      req.body = { session_id: 'session123' };
      
      (orderService.createOrder as jest.Mock).mockResolvedValue(mockOrder);

      // Act
      await createOrder(req as Request, res as Response, next);

      // Assert
      expect(orderService.createOrder).toHaveBeenCalledWith('session123', 'staff123');
      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith(mockOrder);
    });

    it('should pass error to next when session is not active', async () => {
      // Arrange
      req.body = { session_id: 'invalid_session' };
      
      const error = new Error('SESSION_NOT_ACTIVE');
      (orderService.createOrder as jest.Mock).mockRejectedValue(error);

      // Act
      try { await createOrder(req as Request, res as Response, next); } catch {}

      // Assert
      expect(next).toHaveBeenCalled();
    });
  });

  describe('POST /orders/items', () => {
    it('should add item to order and return 201', async () => {
      // Arrange
      const mockItem = {
        _id: 'item123',
        order_id: 'order123',
        dish_id: 'dish123',
        item_state: 'ORDERED'
      };
      
      req.body = {
        order_id: 'order123',
        session_id: 'session123',
        dish_id: 'dish123',
        customer_id: 'customer123',
        variant_id: 'variant123',
        extras: ['extra1', 'extra2']
      };
      
      (orderService.addItemToOrder as jest.Mock).mockResolvedValue(mockItem);

      // Act
      await addItem(req as Request, res as Response, next);

      // Assert
      expect(orderService.addItemToOrder).toHaveBeenCalledWith(
        'order123',
        'session123',
        'dish123',
        'customer123',
        'variant123',
        ['extra1', 'extra2']
      );
      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith(mockItem);
    });

    it('should handle item without optional fields', async () => {
      // Arrange
      const mockItem = { _id: 'item123', item_state: 'ORDERED' };
      
      req.body = {
        order_id: 'order123',
        session_id: 'session123',
        dish_id: 'dish123'
      };
      
      (orderService.addItemToOrder as jest.Mock).mockResolvedValue(mockItem);

      // Act
      await addItem(req as Request, res as Response, next);

      // Assert
      expect(orderService.addItemToOrder).toHaveBeenCalledWith(
        'order123', 'session123', 'dish123', undefined, undefined, []
      );
    });

    it('should pass error to next when dish not found', async () => {
      // Arrange
      req.body = { order_id: 'order123', session_id: 'session123', dish_id: 'invalid_dish' };
      
      const error = new Error('DISH_NOT_FOUND');
      (orderService.addItemToOrder as jest.Mock).mockRejectedValue(error);

      // Act
      try { await addItem(req as Request, res as Response, next); } catch {}

      // Assert
      expect(next).toHaveBeenCalled();
    });

    it('should pass error to next when dish not available', async () => {
      // Arrange
      req.body = { order_id: 'order123', session_id: 'session123', dish_id: 'inactive_dish' };
      
      const error = new Error('DISH_NOT_AVAILABLE');
      (orderService.addItemToOrder as jest.Mock).mockRejectedValue(error);

      // Act
      try { await addItem(req as Request, res as Response, next); } catch {}

      // Assert
      expect(next).toHaveBeenCalled();
    });
  });

  describe('PATCH /orders/items/:id/state', () => {
    it('should update item state and return updated item', async () => {
      // Arrange
      const mockItem = {
        _id: 'item123',
        item_state: 'ON_PREPARE'
      };
      
      req.params = { id: 'item123' };
      req.body = { state: 'ON_PREPARE' };
      
      (orderService.updateItemState as jest.Mock).mockResolvedValue(mockItem);

      // Act
      await updateItemState(req as Request, res as Response, next);

      // Assert
      expect(orderService.updateItemState).toHaveBeenCalledWith(
        'item123',
        'ON_PREPARE',
        'staff123',
        ['ADMIN', 'POS', 'KDS']
      );
      expect(jsonMock).toHaveBeenCalledWith(mockItem);
    });

    it('should pass error to next on invalid state transition', async () => {
      // Arrange
      req.params = { id: 'item123' };
      req.body = { state: 'INVALID_STATE' };
      
      const error = new Error('INVALID_STATE_TRANSITION');
      (orderService.updateItemState as jest.Mock).mockRejectedValue(error);

      // Act
      try { await updateItemState(req as Request, res as Response, next); } catch {}

      // Assert
      expect(next).toHaveBeenCalled();
    });

    it('should pass POS authorization error to next', async () => {
      // Arrange
      req.params = { id: 'item123' };
      req.body = { state: 'CANCELED' };
      
      const error = new Error('REQUIRES_POS_AUTHORIZATION');
      (orderService.updateItemState as jest.Mock).mockRejectedValue(error);

      // Act
      try { await updateItemState(req as Request, res as Response, next); } catch {}

      // Assert
      expect(next).toHaveBeenCalled();
    });
  });

  describe('GET /orders/kitchen-items', () => {
    it('should return kitchen items for restaurant', async () => {
      // Arrange
      const mockItems = [
        { _id: 'item1', item_name_snapshot: 'Pizza', item_state: 'ORDERED' },
        { _id: 'item2', item_name_snapshot: 'Pasta', item_state: 'ON_PREPARE' }
      ];
      
      (orderService.getKitchenItems as jest.Mock).mockResolvedValue(mockItems);

      // Act
      await getKitchenItems(req as Request, res as Response, next);

      // Assert
      expect(orderService.getKitchenItems).toHaveBeenCalledWith('rest123');
      expect(jsonMock).toHaveBeenCalledWith(mockItems);
    });

    it('should return empty array when no kitchen items', async () => {
      // Arrange
      (orderService.getKitchenItems as jest.Mock).mockResolvedValue([]);

      // Act
      await getKitchenItems(req as Request, res as Response, next);

      // Assert
      expect(jsonMock).toHaveBeenCalledWith([]);
    });
  });

  describe('GET /orders/session/:sessionId/items', () => {
    it('should return items for session', async () => {
      // Arrange
      const mockItems = [
        { _id: 'item1', session_id: 'session123' },
        { _id: 'item2', session_id: 'session123' }
      ];
      
      req.params = { sessionId: 'session123' };
      
      (orderService.getSessionItems as jest.Mock).mockResolvedValue(mockItems);

      // Act
      await getSessionItems(req as Request, res as Response, next);

      // Assert
      expect(orderService.getSessionItems).toHaveBeenCalledWith('session123');
      expect(jsonMock).toHaveBeenCalledWith(mockItems);
    });
  });

  describe('POST /orders/payments', () => {
    it('should create payment and return 201', async () => {
      // Arrange
      const mockPayment = {
        _id: 'payment123',
        session_id: 'session123',
        payment_type: 'ALL',
        payment_total: 100
      };
      
      req.body = {
        session_id: 'session123',
        payment_type: 'ALL',
        parts: 1,
        tips: 10
      };
      
      (orderService.createPayment as jest.Mock).mockResolvedValue(mockPayment);

      // Act
      await createPayment(req as Request, res as Response, next);

      // Assert
      expect(orderService.createPayment).toHaveBeenCalledWith('session123', 'ALL', 1, 10);
      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith(mockPayment);
    });

    it('should pass error to next when no items to pay', async () => {
      // Arrange
      req.body = { session_id: 'empty_session', payment_type: 'ALL' };
      
      const error = new Error('NO_ITEMS_TO_PAY');
      (orderService.createPayment as jest.Mock).mockRejectedValue(error);

      // Act
      try { await createPayment(req as Request, res as Response, next); } catch {}

      // Assert
      expect(next).toHaveBeenCalled();
    });
  });

  describe('PATCH /orders/payments/:id/tickets', () => {
    it('should mark ticket as paid and return updated payment', async () => {
      // Arrange
      const mockPayment = {
        _id: 'payment123',
        tickets: [{ ticket_part: 1, paid: true }]
      };
      
      req.params = { id: 'payment123' };
      req.body = { ticket_part: 1 };
      
      (orderService.markTicketPaid as jest.Mock).mockResolvedValue(mockPayment);

      // Act
      await markTicketPaid(req as Request, res as Response, next);

      // Assert
      expect(orderService.markTicketPaid).toHaveBeenCalledWith('payment123', 1);
      expect(jsonMock).toHaveBeenCalledWith(mockPayment);
    });

    it('should pass error to next when payment not found', async () => {
      // Arrange
      req.params = { id: 'invalid_payment' };
      req.body = { ticket_part: 1 };
      
      const error = new Error('PAYMENT_NOT_FOUND');
      (orderService.markTicketPaid as jest.Mock).mockRejectedValue(error);

      // Act
      try { await markTicketPaid(req as Request, res as Response, next); } catch {}

      // Assert
      expect(next).toHaveBeenCalled();
    });
  });

  describe('DELETE /orders/items/:id', () => {
    it('should delete item and return 204', async () => {
      // Arrange
      req.params = { id: 'item123' };
      
      (orderService.deleteItem as jest.Mock).mockResolvedValue({ deleted: true });

      // Act
      await deleteItem(req as Request, res as Response, next);

      // Assert
      expect(orderService.deleteItem).toHaveBeenCalledWith('item123', ['ADMIN', 'POS', 'KDS']);
      expect(statusMock).toHaveBeenCalledWith(204);
      expect(endMock).toHaveBeenCalled();
    });

    it('should pass error to next when item not in ORDERED state', async () => {
      // Arrange
      req.params = { id: 'item123' };
      
      const error = new Error('CANNOT_DELETE_ITEM_NOT_ORDERED');
      (orderService.deleteItem as jest.Mock).mockRejectedValue(error);

      // Act
      try { await deleteItem(req as Request, res as Response, next); } catch {}

      // Assert
      expect(next).toHaveBeenCalled();
    });

    it('should pass authorization error to next', async () => {
      // Arrange
      req.user = { ...mockUser, permissions: [], name: 'Test' };
      req.params = { id: 'item123' };
      
      const error = new Error('REQUIRES_AUTHORIZATION');
      (orderService.deleteItem as jest.Mock).mockRejectedValue(error);

      // Act
      try { await deleteItem(req as Request, res as Response, next); } catch {}

      // Assert
      expect(next).toHaveBeenCalled();
    });
  });

  describe('PATCH /orders/items/:id/customer', () => {
    it('should assign item to customer and return updated item', async () => {
      // Arrange
      const mockItem = {
        _id: 'item123',
        customer_id: 'customer123'
      };
      
      req.params = { id: 'item123' };
      req.body = { customer_id: 'customer123' };
      
      (orderService.assignItemToCustomer as jest.Mock).mockResolvedValue(mockItem);

      // Act
      await assignItemToCustomer(req as Request, res as Response, next);

      // Assert
      expect(orderService.assignItemToCustomer).toHaveBeenCalledWith('item123', 'customer123');
      expect(jsonMock).toHaveBeenCalledWith(mockItem);
    });

    it('should allow unassigning customer by passing null', async () => {
      // Arrange
      const mockItem = { _id: 'item123', customer_id: null };
      
      req.params = { id: 'item123' };
      req.body = { customer_id: null };
      
      (orderService.assignItemToCustomer as jest.Mock).mockResolvedValue(mockItem);

      // Act
      await assignItemToCustomer(req as Request, res as Response, next);

      // Assert
      expect(orderService.assignItemToCustomer).toHaveBeenCalledWith('item123', null);
    });
  });

  describe('GET /orders/service-items', () => {
    it('should return service items for restaurant', async () => {
      // Arrange
      const mockItems = [
        { _id: 'item1', item_disher_type: 'SERVICE', item_name_snapshot: 'Coke' },
        { _id: 'item2', item_disher_type: 'SERVICE', item_name_snapshot: 'Beer' }
      ];
      
      (orderService.getServiceItems as jest.Mock).mockResolvedValue(mockItems);

      // Act
      await getServiceItems(req as Request, res as Response, next);

      // Assert
      expect(orderService.getServiceItems).toHaveBeenCalledWith('rest123');
      expect(jsonMock).toHaveBeenCalledWith(mockItems);
    });
  });
});
