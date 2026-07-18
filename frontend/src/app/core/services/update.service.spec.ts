import { TestBed } from '@angular/core/testing';
import { SwUpdate } from '@angular/service-worker';
import { UpdateService } from './update.service';
import { NotificationService } from './notification.service';
import { Subject } from 'rxjs';
import { I18nService } from './i18n.service';

describe('UpdateService', () => {
  let service: UpdateService;
  let swUpdateMock: any;
  let notificationServiceMock: jasmine.SpyObj<NotificationService>;
  let i18nServiceMock: jasmine.SpyObj<I18nService>;
  // Keep versionUpdates$ alive across all tests — don't complete it
  const versionUpdates$ = new Subject<any>();

  beforeEach(() => {
    swUpdateMock = {
      isEnabled: true,
      versionUpdates: versionUpdates$.asObservable(),
      checkForUpdate: jasmine.createSpy('checkForUpdate').and.resolveTo(true),
      activateUpdate: jasmine.createSpy('activateUpdate').and.resolveTo(),
    };

    notificationServiceMock = jasmine.createSpyObj('NotificationService', [
      'info',
      'error',
    ]);
    i18nServiceMock = jasmine.createSpyObj('I18nService', ['translate']);
    const translatedMessages: Record<string, string> = {
      'update.available': 'A new version is available. Reload to update.',
      'update.apply_failed': 'The update could not be applied.',
      'update.unrecoverable': 'A critical error occurred. The application will reload.',
    };
    i18nServiceMock.translate.and.callFake(
      (key: string) => translatedMessages[key] ?? key
    );

    // Reset the TestBed for each test to get a fresh UpdateService instance
    TestBed.resetTestingModule();

    TestBed.configureTestingModule({
      providers: [
        UpdateService,
        { provide: SwUpdate, useValue: swUpdateMock },
        { provide: NotificationService, useValue: notificationServiceMock },
        { provide: I18nService, useValue: i18nServiceMock },
      ],
    });

    service = TestBed.inject(UpdateService);
  });

  afterEach(() => {
    service.ngOnDestroy();
  });

  afterAll(() => {
    versionUpdates$.complete();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should return correct isEnabled status', () => {
    expect(service.isEnabled).toBe(true);
  });

  describe('checkForUpdate', () => {
    it('should return false when service worker is not enabled', async () => {
      swUpdateMock.isEnabled = false;
      const result = await service.checkForUpdate();
      expect(result).toBe(false);
    });

    it('should check for updates when enabled', async () => {
      swUpdateMock.checkForUpdate.and.resolveTo(true);
      const result = await service.checkForUpdate();
      expect(result).toBe(true);
      expect(swUpdateMock.checkForUpdate).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      swUpdateMock.checkForUpdate.and.rejectWith(new Error('Network error'));
      const result = await service.checkForUpdate();
      expect(result).toBe(false);
    });
  });

  describe('applyUpdate', () => {
    it('should activate update', async () => {
      swUpdateMock.activateUpdate.and.resolveTo();
      spyOn<any>(service, 'reloadPage').and.stub();

      await service.applyUpdate();

      expect(swUpdateMock.activateUpdate).toHaveBeenCalled();
      expect((service as any).reloadPage).toHaveBeenCalled();
    });

    it('should handle activation errors', async () => {
      swUpdateMock.activateUpdate.and.rejectWith(new Error('Activation failed'));

      await service.applyUpdate();

      expect(notificationServiceMock.error).toHaveBeenCalledWith(
        'The update could not be applied.'
      );
    });
  });

  describe('version updates', () => {
    it('should emit update available event', (done) => {
      service.updateAvailable.subscribe({
        next: (update) => {
          expect(update.type).toBe('VERSION_READY');
          expect(update.currentVersion?.hash).toBe('old');
          expect(update.latestVersion?.hash).toBe('new');
          done();
        },
        error: (err) => done.fail(err),
      });

      versionUpdates$.next({
        type: 'VERSION_READY',
        currentVersion: { hash: 'old' },
        latestVersion: { hash: 'new' },
      });
    });

    it('should show notification when version is ready', () => {
      versionUpdates$.next({
        type: 'VERSION_READY',
        currentVersion: { hash: 'old' },
        latestVersion: { hash: 'new' },
      });

      expect(notificationServiceMock.info).toHaveBeenCalledWith(
        'A new version is available. Reload to update.'
      );
    });
  });

  describe('handleUnrecoverableState', () => {
    it('should show error notification', () => {
      spyOn<any>(service, 'reloadPage').and.stub();

      service.handleUnrecoverableState();

      expect(notificationServiceMock.error).toHaveBeenCalledWith(
        'A critical error occurred. The application will reload.'
      );
      expect((service as any).reloadPage).toHaveBeenCalled();
    });
  });
});
