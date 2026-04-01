import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TasService, CreateTotemData, AddItemData, CreateOrderData } from './tas.service';
import { environment } from '../../environments/environment';
import type { TotemSession, ItemOrder, Customer, Dish, LocalizedField } from '../types';

describe('TasService', () => {
  let service: TasService;
  let httpMock: HttpTestingController;

  const createMockSession = (overrides: Partial<TotemSession> = {}): TotemSession => ({
    _id: 'session1',
    totem_id: '1',
    session_date_start: new Date().toISOString(),
    totem_state: 'STARTED',
    ...overrides
  });

  const createMockItem = (overrides: Partial<ItemOrder> = {}): ItemOrder => ({
    _id: 'item1',
    item_name_snapshot: [{ lang: 'es', value: 'Plato 1' }],
    item_state: 'ORDERED',
    item_base_price: 10,
    order_id: 'order1',
    session_id: 'session1',
    item_dish_id: 'dish1',
    item_disher_type: 'KITCHEN',
    item_disher_extras: [],
    ...overrides
  });

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [TasService]
    });
    service = TestBed.inject(TasService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('Totems', () => {
    it('should get totems', () => {
      const mockTotems = [
        { _id: '1', totem_name: 'Mesa 1', totem_type: 'STANDARD', totem_qr: 'qr1' },
        { _id: '2', totem_name: 'Mesa 2', totem_type: 'TEMPORARY', totem_qr: 'qr2' }
      ];

      service.getTotems().subscribe(totems => {
        expect(totems).toEqual(mockTotems);
        expect(totems.length).toBe(2);
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/totems`);
      expect(req.request.method).toBe('GET');
      req.flush(mockTotems);
    });

    it('should create a totem', () => {
      const createData: CreateTotemData = {
        totem_name: 'Nueva Mesa',
        totem_type: 'STANDARD'
      };
      const mockResponse = { _id: '3', totem_name: 'Nueva Mesa', totem_qr: 'qr3' };

      service.createTotem(createData).subscribe(response => {
        expect(response._id).toBe('3');
        expect(response.totem_name).toBe('Nueva Mesa');
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/totems`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(createData);
      req.flush(mockResponse);
    });

    it('should delete a totem', () => {
      const totemId = '1';

      service.deleteTotem(totemId).subscribe(response => {
        // HTTP DELETE returns null on success
        expect(response).toBeNull();
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/totems/${totemId}`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });

    it('should handle error when getting totems', () => {
      service.getTotems().subscribe({
        error: (error) => {
          expect(error.status).toBe(500);
        }
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/totems`);
      req.flush('Server error', { status: 500, statusText: 'Internal Server Error' });
    });
  });

  describe('Sessions', () => {
    it('should get active sessions', () => {
      const mockSessions: TotemSession[] = [
        createMockSession({ _id: 'session1', totem_id: '1' }),
        createMockSession({ _id: 'session2', totem_id: '2', totem_state: 'STARTED' })
      ];

      service.getActiveSessions().subscribe(sessions => {
        expect(sessions).toEqual(mockSessions);
        expect(sessions.length).toBe(2);
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/totems/sessions/active`);
      expect(req.request.method).toBe('GET');
      req.flush(mockSessions);
    });

    it('should start a session', () => {
      const totemId = '1';
      const mockSession = createMockSession({ _id: 'session1', totem_id: totemId });

      service.startSession(totemId).subscribe(session => {
        expect(session._id).toBe('session1');
        expect(session.totem_state).toBe('STARTED');
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/totems/${totemId}/session`);
      expect(req.request.method).toBe('POST');
      req.flush(mockSession);
    });
  });

  describe('Orders & Items', () => {
    it('should get session items', () => {
      const sessionId = 'session1';
      const mockItems: ItemOrder[] = [
        createMockItem({ _id: 'item1', session_id: sessionId }),
        createMockItem({ _id: 'item2', session_id: sessionId, item_state: 'ON_PREPARE' })
      ];

      service.getSessionItems(sessionId).subscribe(items => {
        expect(items).toEqual(mockItems);
        expect(items.length).toBe(2);
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/orders/session/${sessionId}`);
      expect(req.request.method).toBe('GET');
      req.flush(mockItems);
    });

    it('should get service items', () => {
      const mockItems: ItemOrder[] = [
        createMockItem({ 
          _id: 'item1', 
          item_disher_type: 'SERVICE',
          item_name_snapshot: [{ lang: 'es', value: 'Bebida 1' }],
          item_base_price: 5
        })
      ];

      service.getServiceItems().subscribe(items => {
        expect(items).toEqual(mockItems);
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/orders/service-items`);
      expect(req.request.method).toBe('GET');
      req.flush(mockItems);
    });

    it('should create an order', () => {
      const createData: CreateOrderData = { session_id: 'session1' };
      const mockResponse = { _id: 'order1', session_id: 'session1' };

      service.createOrder(createData).subscribe(response => {
        expect(response._id).toBe('order1');
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/orders`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(createData);
      req.flush(mockResponse);
    });

    it('should add an item', () => {
      const addData: AddItemData = {
        order_id: 'order1',
        session_id: 'session1',
        dish_id: 'dish1',
        customer_id: 'customer1'
      };
      const mockItem = createMockItem({ order_id: 'order1', session_id: 'session1' });

      service.addItem(addData).subscribe(item => {
        expect(item._id).toBe('item1');
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/orders/items`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(addData);
      req.flush(mockItem);
    });

    it('should delete an item', () => {
      const itemId = 'item1';

      service.deleteItem(itemId).subscribe(response => {
        // HTTP DELETE returns null on success
        expect(response).toBeNull();
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/orders/items/${itemId}`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });

    it('should update item state', () => {
      const itemId = 'item1';
      const newState = 'SERVED' as ItemOrder['item_state'];
      const mockItem = createMockItem({ _id: itemId, item_state: newState });

      service.updateItemState(itemId, newState).subscribe(item => {
        expect(item.item_state).toBe(newState);
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/orders/items/${itemId}/state`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ state: newState });
      req.flush(mockItem);
    });

    it('should assign item to customer', () => {
      const itemId = 'item1';
      const customerId = 'customer1';
      const mockItem = createMockItem({ _id: itemId, customer_id: customerId });

      service.assignItemToCustomer(itemId, customerId).subscribe(item => {
        expect(item.customer_id).toBe(customerId);
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/orders/items/${itemId}/assign`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ customer_id: customerId });
      req.flush(mockItem);
    });

    it('should handle 404 when getting session items', () => {
      const sessionId = 'nonexistent';

      service.getSessionItems(sessionId).subscribe({
        error: (error) => {
          expect(error.status).toBe(404);
        }
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/orders/session/${sessionId}`);
      req.flush('Not found', { status: 404, statusText: 'Not Found' });
    });
  });

  describe('Customers', () => {
    it('should get customers for a session', () => {
      const sessionId = 'session1';
      const mockCustomers: Customer[] = [
        {
          _id: 'customer1',
          customer_name: 'Juan',
          session_id: sessionId
        } as Customer
      ];

      service.getCustomers(sessionId).subscribe(customers => {
        expect(customers).toEqual(mockCustomers);
        expect(customers.length).toBe(1);
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/customers/session/${sessionId}`);
      expect(req.request.method).toBe('GET');
      req.flush(mockCustomers);
    });

    it('should create a customer', () => {
      const sessionId = 'session1';
      const customerName = 'Pedro';
      const mockCustomer: Customer = {
        _id: 'customer2',
        customer_name: customerName,
        session_id: sessionId
      } as Customer;

      service.createCustomer(sessionId, customerName).subscribe(customer => {
        expect(customer.customer_name).toBe(customerName);
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/customers`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ session_id: sessionId, customer_name: customerName });
      req.flush(mockCustomer);
    });
  });

  describe('Dishes & Menu', () => {
    it('should get dishes and categories', () => {
      const mockDishesResp = { data: [{ _id: 'dish1', restaurant_id: 'rest1', category_id: 'cat1', disher_name: [{ lang: 'es', value: 'Plato 1' }], disher_price: 10, disher_type: 'KITCHEN', disher_status: 'ACTIVATED', disher_alergens: [], disher_variant: false, variants: [], extras: [] }] as Dish[] };
      const mockCategories = [{ _id: 'cat1', category_name: [{ lang: 'es', value: 'Categoría 1' }] }];

      service.getDishes().subscribe(result => {
        expect(result.dishes.length).toBe(1);
        expect(result.categories.length).toBe(1);
      });

      const dishesReq = httpMock.expectOne(`${environment.apiUrl}/dishes?limit=100`);
      const catsReq = httpMock.expectOne(`${environment.apiUrl}/dishes/categories`);
      
      expect(dishesReq.request.method).toBe('GET');
      expect(catsReq.request.method).toBe('GET');
      
      dishesReq.flush(mockDishesResp);
      catsReq.flush(mockCategories);
    });

    it('should handle empty dishes response', () => {
      service.getDishes().subscribe(result => {
        expect(result.dishes.length).toBe(0);
        expect(result.categories.length).toBe(0);
      });

      const dishesReq = httpMock.expectOne(`${environment.apiUrl}/dishes?limit=100`);
      const catsReq = httpMock.expectOne(`${environment.apiUrl}/dishes/categories`);
      
      dishesReq.flush({ data: [] });
      catsReq.flush([]);
    });
  });
});
