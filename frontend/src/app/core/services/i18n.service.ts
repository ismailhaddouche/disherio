import { Injectable, signal, computed, effect, inject } from '@angular/core';
import { Platform } from '@angular/cdk/platform';
import { HttpClient } from '@angular/common/http';
import { authStore, type Language } from '../../store/auth.store';

export type { Language };
import { environment } from '../../../environments/environment';

interface Translations {
  [key: string]: string | Translations;
}

const TRANSLATIONS: Record<Language, Translations> = {
  es: {
    // Common
    'common.loading': 'Cargando...',
    'common.save': 'Guardar',
    'common.cancel': 'Cancelar',
    'common.delete': 'Eliminar',
    'common.edit': 'Editar',
    'common.create': 'Crear',
    'common.search': 'Buscar',
    'common.filter': 'Filtrar',
    'common.close': 'Cerrar',
    'common.back': 'Volver',
    'common.next': 'Siguiente',
    'common.previous': 'Anterior',
    'common.confirm': 'Confirmar',
    'common.yes': 'Sí',
    'common.no': 'No',
    'common.error': 'Error',
    'common.success': 'Éxito',
    'common.warning': 'Advertencia',
    'common.info': 'Información',
    'common.refresh': 'Actualizar',
    'common.logout': 'Cerrar sesión',
    'common.settings': 'Configuración',
    'common.profile': 'Perfil',
    'common.language': 'Idioma',
    'common.theme': 'Tema',
    'common.dark': 'Oscuro',
    'common.light': 'Claro',
    'common.system': 'Sistema',
    'common.default': 'Por defecto',
    'common.from': 'Desde',
    'common.to': 'Hasta',
    
    // Auth
    'auth.login': 'Iniciar sesión',
    'auth.login.username': 'Usuario',
    'auth.login.password': 'Contraseña',
    'auth.login.pin': 'PIN',
    'auth.login.submit': 'Entrar',
    'auth.login.error': 'Error al iniciar sesión',
    'auth.login.success': 'Sesión iniciada correctamente',
    
    // Dashboard
    'dashboard.title': 'Panel de Control',
    'dashboard.stats.today': 'Hoy',
    'dashboard.stats.week': 'Esta semana',
    'dashboard.stats.month': 'Este mes',
    'dashboard.stats.revenue': 'Ingresos',
    'dashboard.stats.orders': 'Pedidos',
    'dashboard.stats.customers': 'Clientes',
    'dashboard.stats.avgTicket': 'Ticket promedio',
    'dashboard.chart.sales': 'Ventas',
    'dashboard.chart.orders': 'Pedidos',
    'dashboard.recentOrders': 'Pedidos recientes',
    'dashboard.popularDishes': 'Platos populares',
    'dashboard.loading': 'Cargando datos del panel...',
    'dashboard.error': 'Error al cargar los datos del panel',
    
    // Admin Menu
    'admin.menu.dashboard': 'Dashboard',
    'admin.menu.orders': 'Pedidos',
    'admin.menu.dishes': 'Carta',
    'admin.menu.categories': 'Categorías',
    'admin.menu.staff': 'Personal',
    'admin.menu.totems': 'Totems',
    'admin.menu.settings': 'Ajustes',
    'admin.menu.reports': 'Informes',
    
    // TAS (Table Assistance)
    'tas.title': 'Servicio de Mesas',
    'tas.tables': 'Mesas',
    'tas.tables.free': 'Libre',
    'tas.tables.occupied': 'Ocupada',
    'tas.tables.reserved': 'Reservada',
    'tas.session.open': 'Abrir sesión',
    'tas.session.close': 'Cerrar sesión',
    'tas.session.customers': 'Clientes',
    'tas.order.add': 'Añadir pedido',
    'tas.order.send': 'Enviar a cocina',
    'tas.order.pay': 'Pagar',
    
    // POS
    'pos.title': 'Terminal Punto de Venta',
    'pos.checkout': 'Cobrar',
    'pos.total': 'Total',
    'pos.subtotal': 'Subtotal',
    'pos.tax': 'Impuestos',
    'pos.discount': 'Descuento',
    'pos.tip': 'Propina',
    
    // KDS
    'kds.title': 'Pantalla de Cocina',
    'kds.pending': 'Pendiente',
    'kds.preparing': 'Preparando',
    'kds.ready': 'Listo',
    'kds.served': 'Servido',
    
    // Errors
    'error.loading': 'Error al cargar los datos',
    'error.saving': 'Error al guardar los cambios',
    'error.deleting': 'Error al eliminar',
    'error.network': 'Error de conexión',
    'error.unauthorized': 'Sesión expirada. Por favor, inicie sesión de nuevo.',
    'error.forbidden': 'No tiene permisos para realizar esta acción',
    'error.notFound': 'No se encontró el recurso solicitado',
    'error.server': 'Error del servidor. Inténtelo de nuevo más tarde.',
    
    // Settings
    'settings.title': 'Configuración',
    'settings.general': 'General',
    'settings.restaurant': 'Restaurante',
    'settings.tax': 'Impuestos',
    'settings.currency': 'Moneda',
    'settings.language': 'Idioma',
    'settings.theme': 'Tema',
    'settings.preferences.saved': 'Preferencias guardadas correctamente',
    'settings.preferences.error': 'Error al guardar preferencias',
  },
  en: {
    // Common
    'common.loading': 'Loading...',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'common.create': 'Create',
    'common.search': 'Search',
    'common.filter': 'Filter',
    'common.close': 'Close',
    'common.back': 'Back',
    'common.next': 'Next',
    'common.previous': 'Previous',
    'common.confirm': 'Confirm',
    'common.yes': 'Yes',
    'common.no': 'No',
    'common.error': 'Error',
    'common.success': 'Success',
    'common.warning': 'Warning',
    'common.info': 'Information',
    'common.refresh': 'Refresh',
    'common.logout': 'Logout',
    'common.settings': 'Settings',
    'common.profile': 'Profile',
    'common.language': 'Language',
    'common.theme': 'Theme',
    'common.dark': 'Dark',
    'common.light': 'Light',
    'common.system': 'System',
    'common.default': 'Default',
    'common.from': 'From',
    'common.to': 'To',
    
    // Auth
    'auth.login': 'Login',
    'auth.login.username': 'Username',
    'auth.login.password': 'Password',
    'auth.login.pin': 'PIN',
    'auth.login.submit': 'Sign In',
    'auth.login.error': 'Login error',
    'auth.login.success': 'Login successful',
    
    // Dashboard
    'dashboard.title': 'Dashboard',
    'dashboard.stats.today': 'Today',
    'dashboard.stats.week': 'This week',
    'dashboard.stats.month': 'This month',
    'dashboard.stats.revenue': 'Revenue',
    'dashboard.stats.orders': 'Orders',
    'dashboard.stats.customers': 'Customers',
    'dashboard.stats.avgTicket': 'Avg Ticket',
    'dashboard.chart.sales': 'Sales',
    'dashboard.chart.orders': 'Orders',
    'dashboard.recentOrders': 'Recent Orders',
    'dashboard.popularDishes': 'Popular Dishes',
    'dashboard.loading': 'Loading dashboard data...',
    'dashboard.error': 'Error loading dashboard data',
    
    // Admin Menu
    'admin.menu.dashboard': 'Dashboard',
    'admin.menu.orders': 'Orders',
    'admin.menu.dishes': 'Menu',
    'admin.menu.categories': 'Categories',
    'admin.menu.staff': 'Staff',
    'admin.menu.totems': 'Totems',
    'admin.menu.settings': 'Settings',
    'admin.menu.reports': 'Reports',
    
    // TAS (Table Assistance)
    'tas.title': 'Table Service',
    'tas.tables': 'Tables',
    'tas.tables.free': 'Free',
    'tas.tables.occupied': 'Occupied',
    'tas.tables.reserved': 'Reserved',
    'tas.session.open': 'Open Session',
    'tas.session.close': 'Close Session',
    'tas.session.customers': 'Customers',
    'tas.order.add': 'Add Order',
    'tas.order.send': 'Send to Kitchen',
    'tas.order.pay': 'Pay',
    
    // POS
    'pos.title': 'Point of Sale Terminal',
    'pos.checkout': 'Checkout',
    'pos.total': 'Total',
    'pos.subtotal': 'Subtotal',
    'pos.tax': 'Tax',
    'pos.discount': 'Discount',
    'pos.tip': 'Tip',
    
    // KDS
    'kds.title': 'Kitchen Display',
    'kds.pending': 'Pending',
    'kds.preparing': 'Preparing',
    'kds.ready': 'Ready',
    'kds.served': 'Served',
    
    // Errors
    'error.loading': 'Error loading data',
    'error.saving': 'Error saving changes',
    'error.deleting': 'Error deleting',
    'error.network': 'Network error',
    'error.unauthorized': 'Session expired. Please log in again.',
    'error.forbidden': 'You do not have permission to perform this action',
    'error.notFound': 'Requested resource not found',
    'error.server': 'Server error. Please try again later.',
    
    // Settings
    'settings.title': 'Settings',
    'settings.general': 'General',
    'settings.restaurant': 'Restaurant',
    'settings.tax': 'Tax',
    'settings.currency': 'Currency',
    'settings.language': 'Language',
    'settings.theme': 'Theme',
    'settings.preferences.saved': 'Preferences saved successfully',
    'settings.preferences.error': 'Error saving preferences',
  }
};

@Injectable({
  providedIn: 'root'
})
export class I18nService {
  private readonly platform = inject(Platform);
  private readonly http = inject(HttpClient);
  
  // Signals
  private readonly _currentLang = signal<Language>('es');
  readonly currentLang = this._currentLang.asReadonly();
  
  readonly isSpanish = computed(() => this._currentLang() === 'es');
  readonly isEnglish = computed(() => this._currentLang() === 'en');
  readonly isFrench = computed(() => this._currentLang() === 'fr');
  
  constructor() {
    // Load language from user preferences or localStorage
    this.loadLanguage();
    
    // Watch for changes in auth store preferences
    effect(() => {
      const prefs = authStore.preferences();
      if (prefs?.language) {
        this._currentLang.set(prefs.language);
      }
    });
    
    // Save language when it changes
    effect(() => {
      const lang = this._currentLang();
      if (this.platform.isBrowser) {
        localStorage.setItem('disherio-language', lang);
        document.documentElement.lang = lang;
      }
    });
  }
  
  private loadLanguage(): void {
    // Priority: 1. Auth store preferences, 2. localStorage, 3. Browser language, 4. Default 'es'
    const userPrefs = authStore.preferences();
    if (userPrefs?.language) {
      this._currentLang.set(userPrefs.language);
      return;
    }
    
    if (this.platform.isBrowser) {
      const saved = localStorage.getItem('disherio-language') as Language;
      if (saved && TRANSLATIONS[saved]) {
        this._currentLang.set(saved);
        return;
      }
      
      // Detect browser language
      const browserLang = navigator.language.split('-')[0] as Language;
      if (TRANSLATIONS[browserLang]) {
        this._currentLang.set(browserLang);
        return;
      }
    }
    
    this._currentLang.set('es');
  }
  
  setLanguage(lang: Language): void {
    if (!TRANSLATIONS[lang]) return;
    
    this._currentLang.set(lang);
    
    // Save to backend
    this.savePreference('language', lang);
    
    // Update local auth store
    authStore.updatePreferences({ language: lang });
  }
  
  private savePreference(key: 'language' | 'theme', value: string): void {
    if (!authStore.isAuthenticated()) return;
    
    this.http.patch(`${environment.apiUrl}/staff/me/preferences`, { [key]: value })
      .subscribe({
        error: (err) => console.error('Failed to save preference:', err)
      });
  }
  
  translate(key: string): string {
    const keys = key.split('.');
    let value: unknown = TRANSLATIONS[this._currentLang()];
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = (value as Translations)[k];
      } else {
        return key; // Return key if translation not found
      }
    }
    
    return typeof value === 'string' ? value : key;
  }
  
  // Get all available languages
  getAvailableLanguages(): { code: Language; name: string; flag: string }[] {
    return [
      { code: 'es', name: 'Español', flag: '🇪🇸' },
      { code: 'en', name: 'English', flag: '🇬🇧' },
      { code: 'fr', name: 'Français', flag: '🇫🇷' }
    ];
  }
}
