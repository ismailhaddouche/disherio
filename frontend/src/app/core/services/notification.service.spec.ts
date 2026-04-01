import { TestBed } from '@angular/core/testing';
import { NotificationService, Notification, NotificationType } from './notification.service';

describe('NotificationService', () => {
  let service: NotificationService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [NotificationService]
    });
    service = TestBed.inject(NotificationService);
  });

  afterEach(() => {
    // Clean up any remaining notifications
    service.notifications().forEach(n => service.dismiss(n.id));
  });

  describe('Service Creation', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('should initialize with empty notifications', () => {
      expect(service.notifications()).toEqual([]);
      expect(service.notifications().length).toBe(0);
    });
  });

  describe('show()', () => {
    it('should add a notification with default type (info)', () => {
      service.show('Test message');
      
      expect(service.notifications().length).toBe(1);
      expect(service.notifications()[0].message).toBe('Test message');
      expect(service.notifications()[0].type).toBe('info');
    });

    it('should add a notification with specified type', () => {
      const types: NotificationType[] = ['success', 'error', 'warning', 'info'];
      
      types.forEach((type, index) => {
        service.show(`Message ${index}`, type, 0); // 0 duration to prevent auto-dismiss
      });
      
      expect(service.notifications().length).toBe(4);
      types.forEach((type, index) => {
        expect(service.notifications()[index].type).toBe(type);
      });
    });

    it('should assign unique ids to notifications', () => {
      service.show('Message 1', 'info', 0);
      service.show('Message 2', 'info', 0);
      service.show('Message 3', 'info', 0);
      
      const ids = service.notifications().map(n => n.id);
      const uniqueIds = new Set(ids);
      
      expect(uniqueIds.size).toBe(3);
    });

    it('should not auto-dismiss when duration is 0', async () => {
      service.show('Persistent', 'info', 0);
      
      expect(service.notifications().length).toBe(1);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(service.notifications().length).toBe(1);
    });

    it('should not auto-dismiss when duration is negative', async () => {
      service.show('Persistent negative', 'info', -1000);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(service.notifications().length).toBe(1);
    });

    it('should auto-dismiss after specified duration', async () => {
      service.show('Auto dismiss', 'info', 100);
      
      expect(service.notifications().length).toBe(1);
      
      await new Promise(resolve => setTimeout(resolve, 200));
      expect(service.notifications().length).toBe(0);
    });
  });

  describe('Convenience Methods', () => {
    it('should show success notification', () => {
      service.success('Operation successful', 0);
      
      expect(service.notifications().length).toBe(1);
      expect(service.notifications()[0].message).toBe('Operation successful');
      expect(service.notifications()[0].type).toBe('success');
    });

    it('should show error notification', () => {
      service.error('Something went wrong', 0);
      
      expect(service.notifications().length).toBe(1);
      expect(service.notifications()[0].message).toBe('Something went wrong');
      expect(service.notifications()[0].type).toBe('error');
    });

    it('should show warning notification', () => {
      service.warning('Be careful', 0);
      
      expect(service.notifications().length).toBe(1);
      expect(service.notifications()[0].message).toBe('Be careful');
      expect(service.notifications()[0].type).toBe('warning');
    });

    it('should show info notification', () => {
      service.info('Just so you know', 0);
      
      expect(service.notifications().length).toBe(1);
      expect(service.notifications()[0].message).toBe('Just so you know');
      expect(service.notifications()[0].type).toBe('info');
    });
  });

  describe('dismiss()', () => {
    it('should dismiss a specific notification', () => {
      service.show('Message 1', 'info', 0);
      service.show('Message 2', 'info', 0);
      
      const idToDismiss = service.notifications()[0].id;
      service.dismiss(idToDismiss);
      
      expect(service.notifications().length).toBe(1);
      expect(service.notifications()[0].message).toBe('Message 2');
    });

    it('should not affect other notifications when dismissing', () => {
      service.show('Message 1', 'info', 0);
      service.show('Message 2', 'info', 0);
      service.show('Message 3', 'info', 0);
      
      const middleId = service.notifications()[1].id;
      service.dismiss(middleId);
      
      expect(service.notifications().length).toBe(2);
      expect(service.notifications()[0].message).toBe('Message 1');
      expect(service.notifications()[1].message).toBe('Message 3');
    });

    it('should handle dismissing non-existent id gracefully', () => {
      service.show('Message 1', 'info', 0);
      service.dismiss(99999); // Non-existent id
      
      expect(service.notifications().length).toBe(1);
    });

    it('should handle dismiss when no notifications', () => {
      service.dismiss(1);
      expect(service.notifications().length).toBe(0);
    });
  });

  describe('Multiple Notifications', () => {
    it('should maintain order of notifications', () => {
      const messages = ['First', 'Second', 'Third', 'Fourth'];
      
      messages.forEach(msg => service.show(msg, 'info', 0));
      
      service.notifications().forEach((notification, index) => {
        expect(notification.message).toBe(messages[index]);
      });
    });

    it('should handle many notifications', () => {
      for (let i = 0; i < 100; i++) {
        service.show(`Message ${i}`, 'info', 0);
      }
      
      expect(service.notifications().length).toBe(100);
    });

    it('should handle rapid successive notifications', () => {
      service.show('1', 'info', 0);
      service.show('2', 'info', 0);
      service.show('3', 'info', 0);
      
      expect(service.notifications().length).toBe(3);
    });
  });

  describe('Signal Reactivity', () => {
    it('should return readonly signal', () => {
      const notifications = service.notifications;
      expect(notifications).toBeDefined();
    });

    it('should update signal when notification added', () => {
      expect(service.notifications().length).toBe(0);
      
      service.show('New notification', 'info', 0);
      expect(service.notifications().length).toBe(1);
      
      service.show('Another notification', 'info', 0);
      expect(service.notifications().length).toBe(2);
    });

    it('should update signal when notification dismissed', () => {
      service.show('Message 1', 'info', 0);
      service.show('Message 2', 'info', 0);
      
      const id = service.notifications()[0].id;
      service.dismiss(id);
      
      expect(service.notifications().length).toBe(1);
    });
  });
});
