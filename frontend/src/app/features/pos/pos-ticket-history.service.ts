import { Injectable, OnDestroy, inject, signal } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { I18nService } from '../../core/services/i18n.service';
import { NotificationService } from '../../core/services/notification.service';
import { RestaurantService } from '../../core/services/restaurant.service';
import { LANG_LOCALES } from '../../shared/pipes/currency-format.pipe';
import { TasService, type PaymentHistoryEntry } from '../../core/services/tas.service';
import type { PaymentTicket } from '../../types';

@Injectable()
export class PosTicketHistoryService implements OnDestroy {
  private readonly tasService = inject(TasService);
  private readonly i18n = inject(I18nService);
  private readonly notification = inject(NotificationService);
  private readonly restaurant = inject(RestaurantService);
  private readonly destroy$ = new Subject<void>();

  readonly isOpen = signal(false);
  readonly isLoading = signal(false);
  readonly payments = signal<PaymentHistoryEntry[]>([]);
  readonly search = signal('');
  readonly from = signal('');
  readonly to = signal('');

  open(): void {
    this.isOpen.set(true);
    this.load();
  }

  close(): void {
    this.isOpen.set(false);
  }

  load(): void {
    this.isLoading.set(true);
    const from = this.from();
    const to = this.to();
    this.tasService.getPaymentHistory({
      from: from ? new Date(`${from}T00:00:00`).toISOString() : undefined,
      to: to ? new Date(`${to}T23:59:59.999`).toISOString() : undefined,
      search: this.search().trim() || undefined,
      limit: 200,
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (payments) => {
          this.payments.set(payments);
          this.isLoading.set(false);
        },
        error: () => {
          this.isLoading.set(false);
          this.notification.error(this.i18n.translate('errors.SERVER_ERROR'));
        },
      });
  }

  clearFilters(): void {
    this.search.set('');
    this.from.set('');
    this.to.set('');
    this.load();
  }

  paymentTypeLabel(type: PaymentHistoryEntry['payment_type']): string {
    const translationKey = {
      ALL: 'pos.payment.full_payment',
      SHARED: 'pos.payment.split_equal',
      BY_USER: 'pos.payment.by_consumption',
    }[type];
    return translationKey ? this.i18n.translate(translationKey) : type;
  }

  formatDateTime(value: string): string {
    return new Intl.DateTimeFormat(this.i18n.currentLang(), {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(value));
  }

  print(payment: PaymentHistoryEntry, ticket: PaymentTicket): void {
    const printWindow = window.open('', '_blank', 'width=420,height=640');
    if (!printWindow) {
      this.notification.error(this.i18n.translate('pos.history.popup_blocked'));
      return;
    }

    const title = `${this.i18n.translate('pos.payment.ticket')} ${ticket.ticket_part}/${ticket.ticket_total_parts}`;
    const amount = new Intl.NumberFormat(LANG_LOCALES[this.i18n.currentLang()], {
      style: 'currency',
      currency: this.restaurant.currency(),
    }).format(ticket.ticket_amount);
    const customer = ticket.ticket_customer_name || this.i18n.translate('tas.all');
    const html = (value: string) => this.escapeHtml(value);

    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>${html(title)}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 16px; color: #111; }
            .ticket { max-width: 320px; margin: 0 auto; }
            h1 { font-size: 20px; margin: 0 0 12px; text-align: center; }
            .row { display: flex; justify-content: space-between; gap: 12px; margin: 8px 0; }
            .muted { color: #555; font-size: 12px; }
            .total { border-top: 1px dashed #333; margin-top: 14px; padding-top: 14px; font-size: 18px; font-weight: 700; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          <div class="ticket">
            <h1>${html(this.i18n.translate('pos.history.reprint_title'))}</h1>
            <div class="row"><span>${html(this.i18n.translate('pos.history.table'))}</span><strong>${html(payment.totem.totem_name)}</strong></div>
            <div class="row"><span>${html(this.i18n.translate('pos.history.date'))}</span><span>${html(this.formatDateTime(payment.payment_date))}</span></div>
            <div class="row"><span>${html(this.i18n.translate('pos.history.payment_type'))}</span><span>${html(this.paymentTypeLabel(payment.payment_type))}</span></div>
            <div class="row"><span>${html(this.i18n.translate('pos.history.customer'))}</span><span>${html(customer)}</span></div>
            <div class="row"><span>${html(this.i18n.translate('pos.payment.ticket'))}</span><span>${ticket.ticket_part}/${ticket.ticket_total_parts}</span></div>
            <div class="row total"><span>${html(this.i18n.translate('pos.total'))}</span><span>${html(amount)}</span></div>
            <p class="muted">${html(this.i18n.translate('pos.history.reprint_note'))}</p>
          </div>
          <script>
            window.onload = () => {
              window.print();
              window.onafterprint = () => window.close();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
