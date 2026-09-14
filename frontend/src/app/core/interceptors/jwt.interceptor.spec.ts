import { TestBed } from '@angular/core/testing';
import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { authStore, AuthUser } from '../../store/auth.store';
import { jwtInterceptor } from './jwt.interceptor';

describe('jwtInterceptor', () => {
  let http: HttpClient;
  let httpTesting: HttpTestingController;
  let router: jasmine.SpyObj<Router>;

  const user = {
    _id: 'staff-1',
    restaurant_id: 'restaurant-1',
    role_id: 'role-1',
    staff_name: 'Admin',
    username: 'admin',
    staffId: 'staff-1',
    restaurantId: 'restaurant-1',
    role: 'ADMIN',
    permissions: ['ADMIN'],
    name: 'Admin',
  } as AuthUser;

  beforeEach(() => {
    router = jasmine.createSpyObj<Router>('Router', ['navigate'], { url: '/orders' });
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([jwtInterceptor])),
        provideHttpClientTesting(),
        { provide: Router, useValue: router },
      ],
    });

    http = TestBed.inject(HttpClient);
    httpTesting = TestBed.inject(HttpTestingController);
    authStore.setAuth(user, Date.now() + 60_000);
  });

  afterEach(() => {
    authStore.clearAuth();
    httpTesting.verify();
  });

  it('rotates cookies and retries an authenticated request after a 401', () => {
    let response: unknown;
    http.get('/api/orders').subscribe((value) => {
      response = value;
    });

    const initialRequest = httpTesting.expectOne('/api/orders');
    expect(initialRequest.request.withCredentials).toBeTrue();
    initialRequest.flush(
      { errorCode: 'INVALID_TOKEN' },
      { status: 401, statusText: 'Unauthorized' }
    );

    const refreshRequest = httpTesting.expectOne('/api/auth/refresh');
    expect(refreshRequest.request.withCredentials).toBeTrue();
    refreshRequest.flush({ user, expires_in_ms: 900_000 });

    const retriedRequest = httpTesting.expectOne('/api/orders');
    retriedRequest.flush({ ok: true });

    expect(response).toEqual({ ok: true });
    expect(authStore.isAuthenticated()).toBeTrue();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('clears the session when refresh fails', () => {
    http.get('/api/orders').subscribe({ error: () => undefined });

    httpTesting.expectOne('/api/orders').flush(
      { errorCode: 'INVALID_TOKEN' },
      { status: 401, statusText: 'Unauthorized' }
    );
    httpTesting.expectOne('/api/auth/refresh').flush(
      { errorCode: 'INVALID_TOKEN' },
      { status: 401, statusText: 'Unauthorized' }
    );

    expect(authStore.isAuthenticated()).toBeFalse();
    expect(router.navigate).toHaveBeenCalledWith(
      ['/login'],
      { queryParams: { returnUrl: '/orders' } }
    );
  });

  it('does not restore auth when logout clears state during refresh', () => {
    http.get('/api/orders').subscribe({ error: () => undefined });
    httpTesting.expectOne('/api/orders').flush(
      { errorCode: 'INVALID_TOKEN' },
      { status: 401, statusText: 'Unauthorized' }
    );
    const refreshRequest = httpTesting.expectOne('/api/auth/refresh');

    authStore.clearAuth();
    refreshRequest.flush({ user, expires_in_ms: 900_000 });

    expect(authStore.isAuthenticated()).toBeFalse();
    httpTesting.expectNone('/api/orders');
  });

  for (const status of [403, 409, 500]) {
    it(`preserves the refreshed session when the retried request returns ${status}`, () => {
      let receivedError: HttpErrorResponse | undefined;
      http.get('/api/orders').subscribe({ error: error => receivedError = error });
      httpTesting.expectOne('/api/orders').flush({}, { status: 401, statusText: 'Unauthorized' });
      httpTesting.expectOne('/api/auth/refresh').flush({ user, expires_in_ms: 900_000 });

      httpTesting.expectOne('/api/orders').flush({}, { status, statusText: 'Request failed' });

      expect(receivedError?.status).toBe(status);
      expect(authStore.user()).toEqual(user);
      expect(router.navigate).not.toHaveBeenCalled();
    });
  }

  for (const status of [429, 503]) {
    it(`preserves session context when refresh is temporarily unavailable (${status})`, () => {
      http.get('/api/orders').subscribe({ error: () => undefined });
      httpTesting.expectOne('/api/orders').flush({}, { status: 401, statusText: 'Unauthorized' });
      httpTesting.expectOne('/api/auth/refresh').flush({}, { status, statusText: 'Try again later' });

      expect(authStore.user()).toEqual(user);
      expect(router.navigate).not.toHaveBeenCalled();
      httpTesting.expectNone('/api/orders');
    });
  }

  for (const refreshSucceeds of [true, false]) {
    it(`preserves a newer login when an old refresh ${refreshSucceeds ? 'succeeds' : 'fails'}`, () => {
      http.get('/api/orders').subscribe({ error: () => undefined });
      httpTesting.expectOne('/api/orders').flush({}, { status: 401, statusText: 'Unauthorized' });
      const refreshRequest = httpTesting.expectOne('/api/auth/refresh');
      const newUser = { ...user, staffId: 'staff-2', username: 'new-user' };
      authStore.clearAuth();
      authStore.setAuth(newUser, Date.now() + 900_000);

      if (refreshSucceeds) {
        refreshRequest.flush({ user, expires_in_ms: 900_000 });
      } else {
        refreshRequest.flush({}, { status: 401, statusText: 'Unauthorized' });
      }

      expect(authStore.user()).toEqual(newUser);
      expect(router.navigate).not.toHaveBeenCalled();
      httpTesting.expectNone('/api/orders');
    });
  }

  it('attempts refresh when the locally recorded access expiry has passed', () => {
    authStore.setAuth(user, Date.now() - 1);
    expect(authStore.isAuthenticated()).toBeFalse();
    http.get('/api/orders').subscribe({ error: () => undefined });
    httpTesting.expectOne('/api/orders').flush({}, { status: 401, statusText: 'Unauthorized' });

    httpTesting.expectOne('/api/auth/refresh').flush({ user, expires_in_ms: 900_000 });
    httpTesting.expectOne('/api/orders').flush({ ok: true });

    expect(authStore.isAuthenticated()).toBeTrue();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('shares one refresh between concurrent unauthorized requests', () => {
    http.get('/api/orders').subscribe();
    http.get('/api/staff').subscribe();
    httpTesting.expectOne('/api/orders').flush({}, { status: 401, statusText: 'Unauthorized' });
    httpTesting.expectOne('/api/staff').flush({}, { status: 401, statusText: 'Unauthorized' });

    httpTesting.expectOne('/api/auth/refresh').flush({ user, expires_in_ms: 900_000 });
    httpTesting.expectOne('/api/orders').flush([]);
    httpTesting.expectOne('/api/staff').flush([]);

    expect(authStore.isAuthenticated()).toBeTrue();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('ends the session when the retried request still rejects authentication', () => {
    http.get('/api/orders').subscribe({ error: () => undefined });
    httpTesting.expectOne('/api/orders').flush({}, { status: 401, statusText: 'Unauthorized' });
    httpTesting.expectOne('/api/auth/refresh').flush({ user, expires_in_ms: 900_000 });
    httpTesting.expectOne('/api/orders').flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(authStore.user()).toBeNull();
    expect(router.navigate).toHaveBeenCalledTimes(1);
    httpTesting.expectNone('/api/auth/refresh');
  });

  it('does not clear a newer login when the previous request retry fails', () => {
    http.get('/api/orders').subscribe({ error: () => undefined });
    httpTesting.expectOne('/api/orders').flush({}, { status: 401, statusText: 'Unauthorized' });
    httpTesting.expectOne('/api/auth/refresh').flush({ user, expires_in_ms: 900_000 });
    const retriedRequest = httpTesting.expectOne('/api/orders');
    const newUser = { ...user, staffId: 'staff-2' };
    authStore.setAuth(newUser, Date.now() + 900_000);
    retriedRequest.flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(authStore.user()).toEqual(newUser);
    expect(router.navigate).not.toHaveBeenCalled();
  });
});
