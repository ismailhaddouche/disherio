import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of, Subject } from 'rxjs';
import { PosComponent } from './pos/pos.component';
import { TasComponent } from './tas/tas.component';
import { TasService } from '../core/services/tas.service';
import { SocketConnectionService } from '../core/services/socket/socket-connection.service';
import { PosSocketService } from '../core/services/socket/pos-socket.service';
import { TasSocketService } from '../core/services/socket/tas-socket.service';
import { I18nService } from '../core/services/i18n.service';
import { NotificationService } from '../core/services/notification.service';
import { ConfirmationService } from '../core/services/confirmation.service';
import { PosSessionActionsService } from './pos/pos-session-actions.service';
import { PosTicketHistoryService } from './pos/pos-ticket-history.service';
import { TasSessionActionsService } from './tas/tas-session-actions.service';
import { TasSocketCoordinator } from './tas/tas-socket.coordinator';
import { tasStore } from '../store/tas.store';
import type { Dish, TotemSession, ItemOrder, Customer } from '../types';

const session = (id: string): TotemSession => ({ _id: id, totem_id: `table-${id}`, totem_state: 'STARTED', session_date_start: '2026-09-10T12:00:00Z' });
const dish: Dish = { _id: 'dish', restaurant_id: 'restaurant', category_id: 'category', disher_name: [{ lang: 'en', value: 'Soup' }], disher_price: 10, disher_type: 'KITCHEN', disher_status: 'ACTIVATED', disher_alergens: [], disher_variant: false, variants: [], extras: [] };
const item: ItemOrder = { _id: 'item', order_id: 'order', session_id: 'a', item_dish_id: 'dish', item_state: 'ORDERED', item_disher_type: 'KITCHEN', item_name_snapshot: dish.disher_name, item_base_price: 10, item_disher_extras: [] };

for (const Component of [PosComponent, TasComponent]) {
  describe(`${Component.name} session response isolation`, () => {
    let component: PosComponent | TasComponent;
    let orders: Subject<{ orderId: string; items: ItemOrder[] }>;
    let customer: Subject<Customer>;
    let api: jasmine.SpyObj<TasService>;

    beforeEach(() => {
      tasStore.selectSession(null);
      orders = new Subject();
      customer = new Subject();
      api = jasmine.createSpyObj<TasService>('TasService', ['getSessionItems', 'getCustomers', 'addBatchItems', 'createCustomer', 'getActiveSessions', 'getTotems', 'getDishes']);
      api.getSessionItems.and.returnValue(of([]));
      api.getCustomers.and.returnValue(of([]));
      api.addBatchItems.and.returnValue(orders);
      api.createCustomer.and.returnValue(customer);
      api.getActiveSessions.and.returnValue(of([session('a')]));
      api.getTotems.and.returnValue(of([]));
      api.getDishes.and.returnValue(of({ dishes: [], categories: [] }));
      TestBed.configureTestingModule({ providers: [
        { provide: TasService, useValue: api },
        { provide: SocketConnectionService, useValue: {} },
        { provide: PosSocketService, useValue: { joinSession: () => undefined } },
        { provide: TasSocketService, useValue: { joinTasSession: () => undefined } },
        { provide: I18nService, useValue: { translate: (key: string) => key } },
        { provide: NotificationService, useValue: { success: () => undefined, error: () => undefined } },
        { provide: ConfirmationService, useValue: {} },
        { provide: PosSessionActionsService, useValue: { init: () => undefined, setTotems: () => undefined } },
        { provide: TasSessionActionsService, useValue: { init: () => undefined, refreshTotemSessions: () => undefined, setTotems: () => undefined } },
        { provide: PosTicketHistoryService, useValue: { isOpen: signal(false) } },
        { provide: TasSocketCoordinator, useValue: {} },
      ] });
      component = TestBed.runInInjectionContext(() => new Component());
      component.selectSession(session('a'));
    });

    afterEach(() => {
      orders.complete();
      customer.complete();
      tasStore.selectSession(null);
    });

    it('does not append the previous table order response to the current table', () => {
      component.quickAddToCart(dish);
      component.sendOrder();
      component.selectSession(session('b'));
      component.quickAddToCart(dish);
      orders.next({ orderId: 'order', items: [item] });
      expect(component.sessionItems()).toEqual([]);
      expect(component.pendingCount()).toBe(1);
      expect(component.isSendingOrder()).toBeFalse();
      component.selectSession(session('a'));
      expect(component.pendingCount()).toBe(0);
    });

    it('rejects duplicate submission while an order is in flight', () => {
      component.quickAddToCart(dish);
      component.sendOrder();
      component.sendOrder();
      expect(api.addBatchItems).toHaveBeenCalledTimes(1);
    });

    it('preserves the original draft after a failed request and table switch', () => {
      component.quickAddToCart(dish);
      component.sendOrder();
      component.selectSession(session('b'));
      orders.error(new Error('offline'));
      expect(component.pendingCount()).toBe(0);
      component.selectSession(session('a'));
      expect(component.pendingCount()).toBe(1);
    });

    it('does not append a late customer response to the next table', () => {
      component.newCustomerName.set('Alex');
      component.addCustomer();
      component.selectSession(session('b'));
      customer.next({ _id: 'customer', session_id: 'a', customer_name: 'Alex' });
      expect(component.customers()).toEqual([]);
    });

    it('ignores an older active-session response after a newer refresh', () => {
      const older = new Subject<TotemSession[]>();
      const newer = new Subject<TotemSession[]>();
      api.getActiveSessions.and.returnValues(older, newer);

      const internals = component as unknown as { loadData(): void };
      internals.loadData();
      internals.loadData();
      newer.next([session('newer')]);
      older.next([session('older')]);

      expect(component.sessions().map(entry => entry._id)).toEqual(['newer']);
      older.complete();
      newer.complete();
    });

    it('ignores older detail responses for the same selected table', () => {
      const olderItems = new Subject<ItemOrder[]>();
      const newerItems = new Subject<ItemOrder[]>();
      api.getSessionItems.and.returnValues(olderItems, newerItems);

      component.selectSession(session('a'));
      component.selectSession(session('a'));
      newerItems.next([{ ...item, _id: 'newer-item' }]);
      olderItems.next([{ ...item, _id: 'older-item' }]);

      expect(component.sessionItems().map(entry => entry._id)).toEqual(['newer-item']);
      olderItems.complete();
      newerItems.complete();
    });

    if (Component === TasComponent) {
      it('preserves the open table drawer and draft during a background refresh', () => {
        const tas = component as TasComponent;
        tas.quickAddToCart(dish);
        tas.tablesSidebarOpen.set(true);

        tas['loadData']();

        expect(tas.tablesSidebarOpen()).toBeTrue();
        expect(tas.pendingCount()).toBe(1);
        tas.selectSession(session('a'));
        expect(tas.tablesSidebarOpen()).toBeFalse();
      });
    }
  });
}
