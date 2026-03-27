import { Injectable, signal, computed, effect, inject } from '@angular/core';
import { Platform } from '@angular/cdk/platform';
import { HttpClient } from '@angular/common/http';
import { authStore, type Theme } from '../../store/auth.store';

export type { Theme };
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly platform = inject(Platform);
  private readonly http = inject(HttpClient);
  
  // Signals
  private readonly _currentTheme = signal<Theme>('system');
  readonly currentTheme = this._currentTheme.asReadonly();
  
  readonly isDark = computed(() => {
    const theme = this._currentTheme();
    if (theme === 'system') {
      return this.platform.isBrowser && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return theme === 'dark';
  });
  
  readonly isLight = computed(() => !this.isDark());
  
  constructor() {
    // Load theme from user preferences or localStorage
    this.loadTheme();
    
    // Watch for changes in auth store preferences
    effect(() => {
      const prefs = authStore.preferences();
      if (prefs?.theme) {
        this._currentTheme.set(prefs.theme);
      }
    });
    
    // Apply theme when it changes
    effect(() => {
      const isDark = this.isDark();
      if (this.platform.isBrowser) {
        const root = document.documentElement;
        if (isDark) {
          root.classList.add('dark');
        } else {
          root.classList.remove('dark');
        }
        localStorage.setItem('disherio-theme', this._currentTheme());
      }
    });
    
    // Listen for system theme changes
    if (this.platform.isBrowser) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (this._currentTheme() === 'system') {
          // Trigger re-computation
          this._currentTheme.update(t => t);
        }
      });
    }
  }
  
  private loadTheme(): void {
    // Priority: 1. Auth store preferences, 2. localStorage, 3. Default 'system'
    const userPrefs = authStore.preferences();
    if (userPrefs?.theme) {
      this._currentTheme.set(userPrefs.theme);
      return;
    }
    
    if (this.platform.isBrowser) {
      const saved = localStorage.getItem('disherio-theme') as Theme;
      if (saved && ['light', 'dark', 'system'].includes(saved)) {
        this._currentTheme.set(saved);
        return;
      }
    }
    
    this._currentTheme.set('system');
  }
  
  setTheme(theme: Theme): void {
    this._currentTheme.set(theme);
    
    // Save to backend
    this.savePreference('theme', theme);
    
    // Update local auth store
    authStore.updatePreferences({ theme });
  }
  
  private savePreference(key: 'language' | 'theme', value: string): void {
    if (!authStore.isAuthenticated()) return;
    
    this.http.patch(`${environment.apiUrl}/staff/me/preferences`, { [key]: value })
      .subscribe({
        error: (err) => console.error('Failed to save preference:', err)
      });
  }
  
  toggleTheme(): void {
    // Toggle solo entre light y dark (sin system)
    const current = this._currentTheme();
    let isDark = current === 'dark';
    
    // Si es 'system', detectar el tema actual del sistema
    if (current === 'system' && this.platform.isBrowser) {
      isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    
    const newTheme = isDark ? 'light' : 'dark';
    this.setTheme(newTheme);
  }
  
  getThemeLabel(theme: Theme): string {
    const labels: Record<Theme, string> = {
      light: 'Claro',
      dark: 'Oscuro',
      system: 'Sistema'
    };
    return labels[theme];
  }
  
  getThemeIcon(theme: Theme): string {
    const icons: Record<Theme, string> = {
      light: '☀️',
      dark: '🌙',
      system: '💻'
    };
    return icons[theme];
  }
}
