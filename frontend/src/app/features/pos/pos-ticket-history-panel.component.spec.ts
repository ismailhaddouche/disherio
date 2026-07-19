import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { I18nService } from '../../core/services/i18n.service';
import { RestaurantService } from '../../core/services/restaurant.service';
import type { PaymentHistoryEntry } from '../../core/services/tas.service';
import { PosTicketHistoryService } from './pos-ticket-history.service';
import { PosTicketHistoryPanelComponent } from './pos-ticket-history-panel.component';

const payment: PaymentHistoryEntry = {
  _id: 'payment-1',
  session_id: 'session-1',
  payment_type: 'ALL',
  payment_total: 20,
  payment_date: '2026-07-18T12:00:00.000Z',
  tickets: [
    { ticket_part: 1, ticket_total_parts: 1, ticket_amount: 20 },
  ],
  session: {
    _id: 'session-1',
    totem_state: 'PAID',
    session_date_start: '2026-07-18T11:00:00.000Z',
  },
  totem: { _id: 'totem-1', totem_name: 'Table 1', totem_type: 'STANDARD' },
};

function buttonByText(fixture: ComponentFixture<unknown>, text: string): HTMLButtonElement | null {
  const buttons = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
  return buttons.find(button => button.textContent?.includes(text)) ?? null;
}

describe('PosTicketHistoryPanelComponent', () => {
  let fixture: ComponentFixture<PosTicketHistoryPanelComponent>;
  let history: {
    isLoading: ReturnType<typeof signal<boolean>>;
    payments: ReturnType<typeof signal<PaymentHistoryEntry[]>>;
    search: ReturnType<typeof signal<string>>;
    from: ReturnType<typeof signal<string>>;
    to: ReturnType<typeof signal<string>>;
    load: jasmine.Spy;
    clearFilters: jasmine.Spy;
    formatDateTime: jasmine.Spy;
    paymentTypeLabel: jasmine.Spy;
    print: jasmine.Spy;
  };

  beforeEach(async () => {
    history = {
      isLoading: signal(false),
      payments: signal<PaymentHistoryEntry[]>([]),
      search: signal(''),
      from: signal(''),
      to: signal(''),
      load: jasmine.createSpy('load'),
      clearFilters: jasmine.createSpy('clearFilters'),
      formatDateTime: jasmine.createSpy('formatDateTime').and.returnValue('18/07/2026'),
      paymentTypeLabel: jasmine.createSpy('paymentTypeLabel').and.returnValue('Full'),
      print: jasmine.createSpy('print'),
    };

    await TestBed.configureTestingModule({
      imports: [PosTicketHistoryPanelComponent],
      providers: [
        { provide: PosTicketHistoryService, useValue: history },
        { provide: I18nService, useValue: { translate: (key: string) => key, currentLang: () => 'en' } },
        { provide: RestaurantService, useValue: { currency: () => 'EUR' } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PosTicketHistoryPanelComponent);
    fixture.detectChanges();
  });

  it('shows the empty state when there are no payments', () => {
    expect(fixture.nativeElement.textContent).toContain('pos.history.empty');
  });

  it('renders the payments with their tickets', () => {
    history.payments.set([payment]);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Table 1');
    expect(text).toContain('18/07/2026');
    expect(text).toContain('pos.payment.ticket');
    expect(text).toContain('20');
  });

  it('reloads through the search button and clears filters', () => {
    buttonByText(fixture, 'common.search')?.click();
    expect(history.load).toHaveBeenCalledTimes(1);

    buttonByText(fixture, 'common.clear')?.click();
    expect(history.clearFilters).toHaveBeenCalledTimes(1);
  });

  it('prints a ticket from the list', () => {
    history.payments.set([payment]);
    fixture.detectChanges();

    buttonByText(fixture, 'pos.history.print')?.click();

    expect(history.print).toHaveBeenCalledOnceWith(payment, payment.tickets[0]);
  });
});
