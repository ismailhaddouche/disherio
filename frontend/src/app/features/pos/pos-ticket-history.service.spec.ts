import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { I18nService } from '../../core/services/i18n.service';
import { NotificationService } from '../../core/services/notification.service';
import { RestaurantService } from '../../core/services/restaurant.service';
import { TasService, type PaymentHistoryEntry } from '../../services/tas.service';
import type { PaymentTicket } from '../../types';
import { PosTicketHistoryService } from './pos-ticket-history.service';

const payment: PaymentHistoryEntry = {
  _id: 'payment-1',
  session_id: 'session-1',
  payment_type: 'ALL',
  payment_total: 20,
  payment_date: '2026-07-18T12:00:00.000Z',
  tickets: [],
  session: {
    _id: 'session-1',
    totem_state: 'PAID',
    session_date_start: '2026-07-18T11:00:00.000Z',
  },
  totem: { _id: 'totem-1', totem_name: 'Table 1', totem_type: 'STANDARD' },
};

describe('PosTicketHistoryService', () => {
  let service: PosTicketHistoryService;
  let tasService: jasmine.SpyObj<TasService>;
  let notification: jasmine.SpyObj<NotificationService>;

  beforeEach(() => {
    tasService = jasmine.createSpyObj<TasService>('TasService', ['getPaymentHistory']);
    notification = jasmine.createSpyObj<NotificationService>('NotificationService', ['error']);
    TestBed.configureTestingModule({
      providers: [
        PosTicketHistoryService,
        { provide: TasService, useValue: tasService },
        {
          provide: I18nService,
          useValue: {
            translate: (key: string) => key,
            currentLang: () => 'en',
          },
        },
        { provide: NotificationService, useValue: notification },
        { provide: RestaurantService, useValue: { currency: () => 'EUR' } },
      ],
    });
    service = TestBed.inject(PosTicketHistoryService);
  });

  afterEach(() => service.ngOnDestroy());

  it('loads history using normalized filters', () => {
    tasService.getPaymentHistory.and.returnValue(of([payment]));
    service.search.set('  Table 1  ');
    service.from.set('2026-07-01');
    service.to.set('2026-07-18');

    service.load();

    expect(tasService.getPaymentHistory).toHaveBeenCalledOnceWith({
      from: new Date('2026-07-01T00:00:00').toISOString(),
      to: new Date('2026-07-18T23:59:59.999').toISOString(),
      search: 'Table 1',
      limit: 200,
    });
    expect(service.payments()).toEqual([payment]);
    expect(service.isLoading()).toBeFalse();
  });

  it('reports a recoverable error when loading fails', () => {
    tasService.getPaymentHistory.and.returnValue(throwError(() => new Error('failure')));

    service.load();

    expect(service.isLoading()).toBeFalse();
    expect(notification.error).toHaveBeenCalledOnceWith('errors.SERVER_ERROR');
  });

  it('reports when the browser blocks the print window', () => {
    const ticket: PaymentTicket = {
      ticket_part: 1,
      ticket_total_parts: 1,
      ticket_amount: 20,
    };
    spyOn(window, 'open').and.returnValue(null);

    service.print(payment, ticket);

    expect(notification.error).toHaveBeenCalledOnceWith('pos.history.popup_blocked');
  });
});
