import { authStore } from './auth.store';
import type { AuthUser } from './auth.store';

describe('authStore reload persistence', () => {
  const user = {
    _id: 'staff-1',
    staffId: 'staff-1',
    restaurant_id: 'restaurant-1',
    role_id: 'role-1',
    staff_name: 'Test User',
    name: 'Test User',
    role: 'Admin',
    permissions: ['ADMIN'],
    username: 'test@example.com',
    language: 'en',
    theme: 'light',
  } as AuthUser;

  afterEach(() => authStore.clearAuth());

  it('stores user context without storing either authentication token', () => {
    authStore.setAuth(user, Date.now() + 60_000);

    const stored = sessionStorage.getItem('disherio-auth-state');
    expect(stored).toContain(user.staffId);
    expect(stored).not.toContain('auth_token');
    expect(stored).not.toContain('refresh_token');
  });

  it('removes persisted context when authentication is cleared', () => {
    authStore.setAuth(user, Date.now() + 60_000);
    authStore.clearAuth();

    expect(sessionStorage.getItem('disherio-auth-state')).toBeNull();
  });
});
