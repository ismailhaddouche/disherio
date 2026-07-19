import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { OfflineIndicatorComponent, ConnectionStatus } from './offline-indicator.component';
import { I18nService } from '../../../core/services/i18n.service';

describe('OfflineIndicatorComponent', () => {
  let component: OfflineIndicatorComponent;
  let fixture: ComponentFixture<OfflineIndicatorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OfflineIndicatorComponent],
      providers: [
        { provide: I18nService, useValue: { translate: (key: string) => key } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OfflineIndicatorComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    fixture.destroy();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with correct online status', () => {
    fixture.detectChanges();
    const expectedStatus: ConnectionStatus = navigator.onLine ? 'online' : 'offline';
    expect(component.status()).toBe(expectedStatus);
  });

  describe('status detection', () => {
    it('should show offline status when navigator is offline', () => {
      spyOnProperty(navigator, 'onLine').and.returnValue(false);
      fixture.detectChanges();
      expect(component.status()).toBe('offline');
    });

    it('should show online status when navigator is online', () => {
      spyOnProperty(navigator, 'onLine').and.returnValue(true);
      fixture.detectChanges();
      expect(component.status()).toBe('online');
    });
  });

  describe('banner classes', () => {
    it('should return error banner for offline status', () => {
      spyOnProperty(navigator, 'onLine').and.returnValue(false);
      fixture.detectChanges();
      expect(component.bannerClass()).toContain('disher-banner-offline');
    });

    it('should return tertiary banner for reconnecting status', () => {
      component.status.set('reconnecting');
      expect(component.bannerClass()).toContain('disher-banner-reconnecting');
    });

    it('should return empty string for online status', () => {
      spyOnProperty(navigator, 'onLine').and.returnValue(true);
      fixture.detectChanges();
      expect(component.bannerClass()).toBe('');
    });
  });

  describe('checkConnection', () => {
    it('should attempt reconnection when online', fakeAsync(async () => {
      spyOnProperty(navigator, 'onLine').and.returnValue(true);
      spyOn(window, 'fetch').and.resolveTo(new Response(null, { status: 200 }));

      component.checkConnection();
      tick(100);

      expect(component.status()).toBe('online');
    }));

    it('should show offline when navigator reports offline', async () => {
      spyOnProperty(navigator, 'onLine').and.returnValue(false);

      await component.checkConnection();

      expect(component.status()).toBe('offline');
    });
  });

  describe('host bindings', () => {
    it('should apply offline class when offline', () => {
      spyOnProperty(navigator, 'onLine').and.returnValue(false);
      fixture.detectChanges();
      expect(component.isOffline).toBe(true);
    });

    it('should not apply offline class when online', () => {
      spyOnProperty(navigator, 'onLine').and.returnValue(true);
      fixture.detectChanges();
      expect(component.isOffline).toBe(false);
    });
  });

  describe('event listeners', () => {
    it('should update status on online event', fakeAsync(() => {
      spyOnProperty(navigator, 'onLine').and.returnValue(false);
      fixture.detectChanges();

      expect(component.status()).toBe('offline');

      // Simulate online event
      window.dispatchEvent(new Event('online'));
      tick();

      expect(component.status()).toBe('online');
    }));

    it('should update status on offline event', (() => {
      // Reset the spy from previous test
      spyOnProperty(navigator, 'onLine', 'get').and.returnValue(true);
      fixture.detectChanges();

      expect(component.status()).toBe('online');

      // Directly trigger the offline handler
      (component as any).handleOffline();
      fixture.detectChanges();

      expect(component.status()).toBe('offline');
    }));
  });
});
