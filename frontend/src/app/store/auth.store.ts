import { signal, computed, Signal } from '@angular/core';
import { Router } from '@angular/router';
import type { Staff } from '@disherio/shared';

export type Language = 'es' | 'en' | 'fr';
export type Theme = 'light' | 'dark';

export interface UserPreferences {
  language: Language;
  theme: Theme;
}

const PREFS_KEY = 'auth_prefs';
const AUTH_STATE_KEY = 'disherio-auth-state';

function loadAuthenticatedUser(): AuthUser | null {
  try {
    const raw = sessionStorage.getItem(AUTH_STATE_KEY);
    if (!raw) return null;
    const user = JSON.parse(raw) as Partial<AuthUser>;
    if (typeof user.staffId !== 'string' || !Array.isArray(user.permissions)) {
      sessionStorage.removeItem(AUTH_STATE_KEY);
      return null;
    }
    return user as AuthUser;
  } catch {
    sessionStorage.removeItem(AUTH_STATE_KEY);
    return null;
  }
}

function loadPreferences(): UserPreferences | null {
  try {
    const raw = sessionStorage.getItem(PREFS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as UserPreferences;
  } catch {
    sessionStorage.removeItem(PREFS_KEY);
    return null;
  }
}

function savePreferences(prefs: UserPreferences): void {
  sessionStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

/**
 * Extends the shared Staff contract with the normalized fields used by the UI.
 */
export interface AuthUser extends Staff {
  staffId: string; // Mapped from Staff._id.
  role: string; // Resolved from role_id.
  permissions: string[]; // Resolved role permissions.
  name: string; // Mapped from staff_name.
  preferences?: UserPreferences;
  enabled_languages?: Language[]; // Interface languages enabled for the restaurant.
}

export interface AuthStore {
  user: Signal<AuthUser | null>;
  isAuthenticated: Signal<boolean>;
  hasPermission: (perm: string) => Signal<boolean>;
  preferences: Signal<UserPreferences | null>;
  enabledLanguages: Signal<Language[]>;
  setAuth: (user: AuthUser, expiresAt: number) => void;
  setAuthIfCurrent: (user: AuthUser, expiresAt: number, revision: number) => boolean;
  revision: () => number;
  clearAuth: () => void;
  updatePreferences: (prefs: Partial<UserPreferences>) => void;
}

const initialUser = loadAuthenticatedUser();
const _user = signal<AuthUser | null>(initialUser);
const _preferences = signal<UserPreferences | null>(loadPreferences());
const _enabledLanguages = signal<Language[]>(
  initialUser?.enabled_languages?.length ? initialUser.enabled_languages : ['es', 'en', 'fr']
);
let _revision = 0;

function applyAuth(user: AuthUser): void {
  _user.set(user);
  sessionStorage.setItem(AUTH_STATE_KEY, JSON.stringify(user));
  if (user.preferences) {
    _preferences.set(user.preferences);
    savePreferences(user.preferences);
  }
  if (user.enabled_languages && user.enabled_languages.length > 0) {
    _enabledLanguages.set(user.enabled_languages);
  }
}

export const authStore: AuthStore = {
  user: _user.asReadonly(),
  isAuthenticated: computed(() => _user() !== null),
  hasPermission: (perm: string) => computed(() => _user()?.permissions.includes(perm) ?? false),
  preferences: _preferences.asReadonly(),
  enabledLanguages: _enabledLanguages.asReadonly(),

  setAuth(user: AuthUser, _expiresAt: number) {
    _revision++;
    // Persist only non-secret UI/session context. Access and refresh tokens
    // remain exclusively in HttpOnly cookies.
    applyAuth(user);
  },

  setAuthIfCurrent(user: AuthUser, _expiresAt: number, revision: number) {
    if (_revision !== revision || !_user()) return false;
    _revision++;
    applyAuth(user);
    return true;
  },

  revision() {
    return _revision;
  },

  clearAuth() {
    _revision++;
    _user.set(null);
    _preferences.set(null);
    _enabledLanguages.set(['es', 'en', 'fr']);
    sessionStorage.removeItem(PREFS_KEY);
    sessionStorage.removeItem(AUTH_STATE_KEY);
  },

  updatePreferences(prefs: Partial<UserPreferences>) {
    const current = _preferences();
    const merged: UserPreferences = {
      language: prefs.language ?? current?.language ?? 'es',
      theme: prefs.theme ?? current?.theme ?? 'light',
    };
    _preferences.set(merged);
    savePreferences(merged);
  }
};

export function validateTokenOrRedirect(router: Router): boolean {
  const user = authStore.user();
  if (!user) {
    router.navigate(['/login']);
    return false;
  }
  return true;
}
