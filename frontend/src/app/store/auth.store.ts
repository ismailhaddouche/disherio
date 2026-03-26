import { signal, computed, Signal } from '@angular/core';

export interface AuthUser {
  staffId: string;
  restaurantId: string;
  role: string;
  permissions: string[];
  name: string;
}

export interface AuthStore {
  user: Signal<AuthUser | null>;
  token: Signal<string | null>;
  isAuthenticated: Signal<boolean>;
  hasPermission: (perm: string) => Signal<boolean>;
  setAuth: (token: string, user: AuthUser) => void;
  clearAuth: () => void;
}

export function decodeJwt(token: string): AuthUser | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (!payload.staffId || !payload.restaurantId) return null;
    return {
      staffId: payload.staffId,
      restaurantId: payload.restaurantId,
      role: payload.role || '',
      permissions: payload.permissions || [],
      name: payload.name || '',
    };
  } catch {
    return null;
  }
}

const storedToken = localStorage.getItem('token');
const _token = signal<string | null>(storedToken);
const _user = signal<AuthUser | null>(storedToken ? decodeJwt(storedToken) : null);

export const authStore: AuthStore = {
  user: _user.asReadonly(),
  token: _token.asReadonly(),
  isAuthenticated: computed(() => _token() !== null && _user() !== null),
  hasPermission: (perm: string) => computed(() => _user()?.permissions.includes(perm) ?? false),

  setAuth(token: string, user: AuthUser) {
    localStorage.setItem('token', token);
    _token.set(token);
    _user.set(user);
  },

  clearAuth() {
    localStorage.removeItem('token');
    _token.set(null);
    _user.set(null);
  },
};
