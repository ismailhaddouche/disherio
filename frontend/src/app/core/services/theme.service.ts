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
  private readonly _currentTheme = signal<Theme>('light');
  readonly currentTheme = this._currentTheme.asReadonly();
  
  readonly isDark = computed(() => this._currentTheme() === 'dark');
  
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
      if (saved && ['light', 'dark'].includes(saved)) {
        this._currentTheme.set(saved);
        return;
      }
    }
    
    // Default to light theme
    this._currentTheme.set('light');
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
    // Toggle between light and dark
    const current = this._currentTheme();
    const newTheme = current === 'dark' ? 'light' : 'dark';
    this.setTheme(newTheme);
  }
  
  getThemeLabel(theme: Theme): string {
    const labels: Record<Theme, string> = {
      light: 'Claro',
      dark: 'Oscuro'
    };
    return labels[theme];
  }
  
  getThemeIcon(theme: Theme): string {
    const icons: Record<Theme, string> = {
      light: '☀️',
      dark: '🌙'
    };
    return icons[theme];
  }
}
