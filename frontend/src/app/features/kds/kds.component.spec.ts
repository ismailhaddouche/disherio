import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { SocketConnectionService } from '../../core/services/socket/socket-connection.service';
import { KdsSocketService } from '../../core/services/socket/kds-socket.service';
import { NotificationService } from '../../core/services/notification.service';
import { I18nService } from '../../core/services/i18n.service';
import { KdsService } from '../../core/services/kds.service';
import { DishService } from '../../core/services/dish.service';
import { ConfirmationService } from '../../core/services/confirmation.service';
import { kdsStore, type KdsItem } from '../../store/kds.store';
import { KdsComponent } from './kds.component';

const item = (id: string): KdsItem => ({
  _id: id,
  order_id: 'order-1',
  session_id: 'session-1',
  item_dish_id: 'dish-1',
  item_state: 'ORDERED',
  item_disher_type: 'KITCHEN',
  item_name_snapshot: [{ lang: 'en', value: id }],
  item_base_price: 10,
  item_disher_extras: [],
});

describe('KdsComponent snapshot isolation', () => {
  let component: KdsComponent;
  let api: jasmine.SpyObj<KdsService>;

  beforeEach(() => {
    api = jasmine.createSpyObj<KdsService>('KdsService', ['getKitchenItems']);
    TestBed.configureTestingModule({
      providers: [
        { provide: KdsService, useValue: api },
        { provide: SocketConnectionService, useValue: {} },
        { provide: KdsSocketService, useValue: { joinKdsSession: jasmine.createSpy('joinKdsSession') } },
        { provide: DishService, useValue: {} },
        { provide: ConfirmationService, useValue: {} },
        { provide: NotificationService, useValue: { error: jasmine.createSpy('error') } },
        { provide: I18nService, useValue: { translate: (key: string) => key } },
      ],
    });
    kdsStore.setItems([]);
    component = TestBed.runInInjectionContext(() => new KdsComponent());
  });

  afterEach(() => kdsStore.setItems([]));

  it('ignores an older kitchen snapshot after a newer refresh completes', () => {
    const older = new Subject<KdsItem[]>();
    const newer = new Subject<KdsItem[]>();
    api.getKitchenItems.and.returnValues(older, newer);

    component.loadItems();
    component.loadItems();
    newer.next([item('newer-item')]);
    older.next([item('older-item')]);

    expect(component.ordered().map(entry => entry._id)).toEqual(['newer-item']);
  });
});
