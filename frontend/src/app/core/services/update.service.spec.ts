import { TestBed } from '@angular/core/testing';
import { SwUpdate } from '@angular/service-worker';
import { UpdateService } from './update.service';
import { NotificationService } from './notification.service';
import { Subject } from 'rxjs';

describe('UpdateService', () => {
  let service: UpdateService;
  let swUpdateMock: jasmine.SpyObj<SwUpdate>;
  let notificationServiceMock: jasmine.SpyObj<NotificationService>;
  const versionUpdates$ = new Subject<any>();

  beforeEach(() => {
    swUpdateMock = jasmine.createSpyObj('SwUpdate', [
      'checkForUpdate',
      'activateUpdate',
    ], {
      isEnabled: true,
      versionUpdates: versionUpdates$.asObservable(),
    });

    notificationServiceMock = jasmine.createSpyObj('NotificationService', [
      'info',
      'error',
    ]);

    TestBed.configureTestingModule({
      providers: [
        UpdateService,
        { provide: SwUpdate, useValue: swUpdateMock },
        { provide: NotificationService, useValue: notificationServiceMock },
      ],
    });

    service = TestBed.inject(UpdateService);
  });

  afterEach(() => {
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
    it('should activate update and reload page', async () => {
      const reloadSpy = spyOn(window.location, 'reload').and.callFake(() => {});
      swUpdateMock.activateUpdate.and.resolveTo();

      await service.applyUpdate();

      expect(swUpdateMock.activateUpdate).toHaveBeenCalled();
      expect(reloadSpy).toHaveBeenCalled();
    });

    it('should handle activation errors', async () => {
      swUpdateMock.activateUpdate.and.rejectWith(new Error('Activation failed'));

      await service.applyUpdate();

      expect(notificationServiceMock.error).toHaveBeenCalledWith(
        'Error al aplicar la actualización'
      );
    });
  });

  describe('version updates', () => {
    it('should emit update available event', (done) => {
      service.updateAvailable.subscribe((update) => {
        expect(update.type).toBe('VERSION_READY');
        expect(update.currentVersion?.hash).toBe('old');
        expect(update.latestVersion?.hash).toBe('new');
        done();
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
        'Nueva versión disponible. Recarga para actualizar.'
      );
    });
  });

  describe('handleUnrecoverableState', () => {
    it('should show error notification and reload', () => {
      const reloadSpy = spyOn(window.location, 'reload').and.callFake(() => {});

      service.handleUnrecoverableState();

      expect(notificationServiceMock.error).toHaveBeenCalledWith(
        'Error crítico. La aplicación se recargará.'
      );
      expect(reloadSpy).toHaveBeenCalled();
    });
  });
});
