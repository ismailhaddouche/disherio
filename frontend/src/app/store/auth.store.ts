import { signal, computed, Signal } from '@angular/core';
import { Router } from '@angular/router';

export interface AuthUser {
  staffId: string;
  restaurantId: string;
  role: string;
  permissions: string[];
  name: string;
}

export interface AuthStore {
  user: Signal<AuthUser | null>;
  isAuthenticated: Signal<boolean>;
  hasPermission: (perm: string) => Signal<boolean>;
  setAuth: (user: AuthUser, expiresAt: number) => void;
  clearAuth: () => void;
}

interface StoredUser extends AuthUser {
  expiresAt: number;
}

function loadStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem('auth_user');
    if (!raw) return null;
    const data = JSON.parse(raw) as StoredUser;
    if (data.expiresAt < Date.now()) {
      localStorage.removeItem('auth_user');
      return null;
    }
    return data;
  } catch {
    localStorage.removeItem('auth_user');
    return null;
  }
}

const _user = signal<AuthUser | null>(loadStoredUser());

export const authStore: AuthStore = {
  user: _user.asReadonly(),
  isAuthenticated: computed(() => _user() !== null),
  hasPermission: (perm: string) => computed(() => _user()?.permissions.includes(perm) ?? false),

  setAuth(user: AuthUser, expiresAt: number) {
    const data: StoredUser = { ...user, expiresAt };
    localStorage.setItem('auth_user', JSON.stringify(data));
    _user.set(user);
  },

  clearAuth() {
    localStorage.removeItem('auth_user');
    _user.set(null);
  },
};

export function validateTokenOrRedirect(router: Router): boolean {
  const user = authStore.user();
  if (!user) {
    router.navigate(['/login']);
    return false;
  }
  return true;
}
