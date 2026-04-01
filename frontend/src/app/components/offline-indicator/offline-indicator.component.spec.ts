import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { OfflineIndicatorComponent, ConnectionStatus } from './offline-indicator.component';

describe('OfflineIndicatorComponent', () => {
  let component: OfflineIndicatorComponent;
  let fixture: ComponentFixture<OfflineIndicatorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OfflineIndicatorComponent],
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
    it('should return red background for offline status', () => {
      spyOnProperty(navigator, 'onLine').and.returnValue(false);
      fixture.detectChanges();
      expect(component.bannerClass()).toContain('bg-red-600');
    });

    it('should return yellow background for reconnecting status', () => {
      // Manually set status to reconnecting
      (component as any)._status = 'reconnecting';
      expect(component.bannerClass()).toContain('bg-yellow-500');
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

    it('should update status on offline event', fakeAsync(() => {
      spyOnProperty(navigator, 'onLine').and.returnValue(true);
      fixture.detectChanges();

      expect(component.status()).toBe('online');

      // Simulate offline event
      spyOnProperty(navigator, 'onLine').and.returnValue(false);
      window.dispatchEvent(new Event('offline'));
      tick();

      expect(component.status()).toBe('offline');
    }));
  });
});
