import { ComponentFixture, TestBed } from '@angular/core/testing';
import { I18nService } from '../../core/services/i18n.service';
import { NotificationService } from '../../core/services/notification.service';
import type { TotemSession } from '../../types';
import { TasQrModalComponent } from './tas-qr-modal.component';

function createSession(overrides: Partial<TotemSession> = {}): TotemSession {
  return {
    _id: 'session-1',
    totem_id: 'totem-1',
    session_date_start: '2026-07-18T10:00:00.000Z',
    totem_state: 'STARTED',
    totem: {
      _id: 'totem-1',
      restaurant_id: 'restaurant-1',
      totem_name: 'Table 1',
      totem_qr: 'qr-code-1',
      totem_type: 'STANDARD',
    },
    ...overrides,
  };
}

describe('TasQrModalComponent', () => {
  let fixture: ComponentFixture<TasQrModalComponent>;
  let component: TasQrModalComponent;
  let notification: { info: jasmine.Spy };

  beforeEach(async () => {
    notification = { info: jasmine.createSpy('info') };

    await TestBed.configureTestingModule({
      imports: [TasQrModalComponent],
      providers: [
        { provide: I18nService, useValue: { translate: (key: string) => key } },
        { provide: NotificationService, useValue: notification },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TasQrModalComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('session', createSession());
    fixture.detectChanges();
  });

  it('builds the public menu URL for the totem QR', () => {
    expect(component.getQrUrl('qr-code-1')).toBe(`${window.location.origin}/menu/qr-code-1`);
  });

  it('renders the QR code and the URL when the totem has one', () => {
    expect(fixture.nativeElement.querySelector('app-qr-code')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('/menu/qr-code-1');
  });

  it('shows the no-QR message when the totem has none', () => {
    fixture.componentRef.setInput('session', createSession({
      totem: {
        _id: 'totem-1',
        restaurant_id: 'restaurant-1',
        totem_name: 'Table 1',
        totem_qr: '',
        totem_type: 'STANDARD',
      },
    }));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-qr-code')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('totem.no_qr');
  });

  it('copies the URL to the clipboard and notifies', () => {
    const clipboardSpy = spyOn(navigator.clipboard, 'writeText').and.resolveTo(undefined);

    component.copyToClipboard(`${window.location.origin}/menu/qr-code-1`);

    expect(clipboardSpy).toHaveBeenCalledOnceWith(`${window.location.origin}/menu/qr-code-1`);
    expect(notification.info).toHaveBeenCalledOnceWith('common.copied');
  });

  it('emits closed from the overlay and the close button', () => {
    const closedSpy = jasmine.createSpy('closed');
    component.closed.subscribe(closedSpy);

    (fixture.nativeElement.querySelector('button[aria-label="common.close"]') as HTMLButtonElement).click();
    expect(closedSpy).toHaveBeenCalledTimes(1);
  });
});
