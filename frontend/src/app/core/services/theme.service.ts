import { Injectable, signal, computed, effect, inject } from '@angular/core';
import { Platform } from '@angular/cdk/platform';

export type Theme = 'light' | 'dark' | 'system';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly platform = inject(Platform);
  
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
    // Load saved theme preference
    this.loadSavedTheme();
    
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
  
  private loadSavedTheme(): void {
    if (this.platform.isBrowser) {
      const saved = localStorage.getItem('disherio-theme') as Theme;
      if (saved && ['light', 'dark', 'system'].includes(saved)) {
        this._currentTheme.set(saved);
      }
    }
  }
  
  setTheme(theme: Theme): void {
    this._currentTheme.set(theme);
  }
  
  toggleTheme(): void {
    const current = this._currentTheme();
    if (current === 'light') {
      this._currentTheme.set('dark');
    } else if (current === 'dark') {
      this._currentTheme.set('system');
    } else {
      this._currentTheme.set('light');
    }
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
