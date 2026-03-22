import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { AuthService, UserSession } from './auth.service';
import { environment } from '../../environments/environment';
import { STORAGE_KEYS } from '../core/constants';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;
  let routerSpy: { navigate: any };

  beforeEach(() => {
    routerSpy = { navigate: vi.fn().mockResolvedValue(true) };
    
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        AuthService,
        { provide: Router, useValue: routerSpy }
      ]
    });
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
    localStorage.clear();
  });

  afterEach(() => {
    // Manually handle any remaining requests to avoid test leakage
    const openRequests = httpMock.match(() => true);
    openRequests.forEach(req => req.flush({}));
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should return false if no user is logged in', () => {
    service.currentUser.set(null);
    expect(service.isAuthenticated()).toBe(false);
  });

  it('should login successfully and redirect', async () => {
    const mockSession: UserSession = { username: 'admin', role: 'admin' };
    
    const loginPromise = service.login('admin', 'password');

    // 1. Auth login request
    const req = httpMock.expectOne(`${environment.apiUrl}/api/auth/login`);
    expect(req.request.method).toBe('POST');
    req.flush(mockSession);

    // 2. Health check (waitForAuthenticatedBackend)
    const healthReq = httpMock.expectOne(`${environment.apiUrl}/api/orders`);
    healthReq.flush([]);

    // 3. Log activity
    const logReq = httpMock.expectOne(`${environment.apiUrl}/api/logs`);
    logReq.flush({});

    const result = await loginPromise;
    expect(result).toBe(true);
    expect(service.currentUser()).toEqual(mockSession);
    expect(localStorage.getItem(STORAGE_KEYS.SESSION)).toContain('admin');
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/admin/dashboard']);
  });

  it('should return false on login error', async () => {
    service.currentUser.set(null);
    const loginPromise = service.login('wrong', 'wrong');

    const req = httpMock.expectOne(`${environment.apiUrl}/api/auth/login`);
    req.error(new ProgressEvent('error'));

    const result = await loginPromise;
    expect(result).toBe(false);
    expect(service.currentUser()).toBeNull();
  });

  it('should logout and clear session', async () => {
    const mockSession: UserSession = { username: 'admin', role: 'admin' };
    service.currentUser.set(mockSession);
    localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(mockSession));

    const logoutPromise = service.logout();

    // 1. Logout request
    const req = httpMock.expectOne(`${environment.apiUrl}/api/auth/logout`);
    req.flush({});

    // 2. Log activity
    const logReq = httpMock.expectOne(`${environment.apiUrl}/api/logs`);
    logReq.flush({});

    await logoutPromise;
    expect(service.currentUser()).toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.SESSION)).toBeNull();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('should check roles correctly', () => {
    service.currentUser.set({ username: 'waiter', role: 'waiter' });
    expect(service.hasRole('waiter')).toBe(true);
    expect(service.hasRole('admin')).toBe(false);

    service.currentUser.set({ username: 'admin', role: 'admin' });
    expect(service.hasRole('waiter')).toBe(true);
    expect(service.hasRole('admin')).toBe(true);
  });
});
