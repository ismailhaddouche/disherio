import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { NotificationService } from './notification.service';
import { I18nService } from './i18n.service';
import { ErrorHandlerService } from './error-handler.service';

describe('ErrorHandlerService', () => {
  let service: ErrorHandlerService;
  let notificationService: jasmine.SpyObj<NotificationService>;

  beforeEach(() => {
    notificationService = jasmine.createSpyObj<NotificationService>('NotificationService', ['error']);
    TestBed.configureTestingModule({
      providers: [
        ErrorHandlerService,
        { provide: NotificationService, useValue: notificationService },
        { provide: I18nService, useValue: { translate: (key: string) => key } },
      ],
    });
    service = TestBed.inject(ErrorHandlerService);
  });

  it('does not expose an HTML infrastructure response to the user', () => {
    service.handleHttpError(new HttpErrorResponse({
      status: 502,
      statusText: 'Bad Gateway',
      error: '<html><body>upstream unavailable</body></html>',
    }));

    const displayedMessage = notificationService.error.calls.mostRecent().args[0];
    expect(displayedMessage).toBe('errors.server');
    expect(displayedMessage).not.toContain('<html>');
  });

  it('surfaces the server-provided localized message when present', () => {
    service.handleHttpError(new HttpErrorResponse({
      status: 400,
      error: { error: 'El pedido ya está pagado', errorCode: 'ORDER_ALREADY_PAID' },
    }));

    const displayedMessage = notificationService.error.calls.mostRecent().args[0];
    expect(displayedMessage).toBe('El pedido ya está pagado');
  });

  it('falls back to the network error key on transport failures', () => {
    service.handleHttpError(new HttpErrorResponse({
      status: 0,
      error: new ProgressEvent('error'),
    }));

    const displayedMessage = notificationService.error.calls.mostRecent().args[0];
    expect(displayedMessage).toBe('errors.network');
  });
});
