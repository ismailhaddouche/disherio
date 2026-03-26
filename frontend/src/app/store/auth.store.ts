import { signal, computed, Signal, inject, DestroyRef } from '@angular/core';
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
  token: Signal<string | null>;
  isAuthenticated: Signal<boolean>;
  hasPermission: (perm: string) => Signal<boolean>;
  setAuth: (token: string, user: AuthUser) => void;
  clearAuth: () => void;
}

export interface JwtPayload extends AuthUser {
  exp?: number;
  iat?: number;
}

export function decodeJwt(token: string): JwtPayload | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (!payload.staffId || !payload.restaurantId) return null;
    return payload as JwtPayload;
  } catch {
    return null;
  }
}

export function isTokenExpired(token: string): boolean {
  const payload = decodeJwt(token);
  if (!payload?.exp) return false; // Si no tiene exp, consideramos que no expira
  
  const now = Math.floor(Date.now() / 1000);
  return payload.exp < now;
}

const storedToken = localStorage.getItem('token');

// Validar token al cargar - si está expirado, limpiar
if (storedToken && isTokenExpired(storedToken)) {
  localStorage.removeItem('token');
}

const validToken = storedToken && !isTokenExpired(storedToken) ? storedToken : null;
const _token = signal<string | null>(validToken);
const _user = signal<AuthUser | null>(validToken ? decodeJwt(validToken) : null);

export const authStore: AuthStore = {
  user: _user.asReadonly(),
  token: _token.asReadonly(),
  isAuthenticated: computed(() => {
    const token = _token();
    if (!token) return false;
    // Re-validar expiración en cada check
    if (isTokenExpired(token)) {
      _token.set(null);
      _user.set(null);
      localStorage.removeItem('token');
      return false;
    }
    return _user() !== null;
  }),
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

// Helper para validar y redirigir si el token expiró (usar en guards)
export function validateTokenOrRedirect(router: Router): boolean {
  const token = authStore.token();
  if (!token || isTokenExpired(token)) {
    authStore.clearAuth();
    router.navigate(['/login']);
    return false;
  }
  return true;
}
