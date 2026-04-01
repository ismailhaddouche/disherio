import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { I18nService, Language } from './i18n.service';
import { environment } from '../../../environments/environment';
import { Platform } from '@angular/cdk/platform';

describe('I18nService', () => {
  let service: I18nService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        I18nService,
        { provide: Platform, useValue: { isBrowser: true } }
      ]
    });
    service = TestBed.inject(I18nService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('Service Creation', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('should initialize with default language', () => {
      expect(service.currentLang()).toBeDefined();
    });

    it('should have available languages', () => {
      const langs = service.getAvailableLanguages();
      expect(langs.length).toBeGreaterThan(0);
      expect(langs.map(l => l.code)).toContain('es');
      expect(langs.map(l => l.code)).toContain('en');
    });
  });

  describe('setLanguage', () => {
    it('should set language to spanish', () => {
      service.setLanguage('es');
      expect(service.currentLang()).toBe('es');
    });

    it('should set language to english', () => {
      service.setLanguage('en');
      expect(service.currentLang()).toBe('en');
    });

    it('should set language to french', () => {
      service.setLanguage('fr');
      expect(service.currentLang()).toBe('fr');
    });

    it('should not set invalid language', () => {
      const currentLang = service.currentLang();
      service.setLanguage('invalid' as Language);
      expect(service.currentLang()).toBe(currentLang);
    });
  });

  describe('translate', () => {
    it('should return key if translation not found', () => {
      const key = 'nonexistent.key';
      expect(service.translate(key)).toBe(key);
    });

    it('should return translation for existing key in spanish', () => {
      service.setLanguage('es');
      const translation = service.translate('common.loading');
      expect(translation).toBe('Cargando...');
    });

    it('should return translation for existing key in english', () => {
      service.setLanguage('en');
      const translation = service.translate('common.loading');
      expect(translation).toBe('Loading...');
    });

    it('should handle nested keys', () => {
      service.setLanguage('es');
      const translation = service.translate('auth.login');
      expect(translation).toBe('Iniciar sesión');
    });

    it('should return key for invalid nested path', () => {
      service.setLanguage('es');
      const key = 'common.invalid.nested.key';
      expect(service.translate(key)).toBe(key);
    });
  });

  describe('getAvailableLanguages', () => {
    it('should return array of languages', () => {
      const langs = service.getAvailableLanguages();
      expect(langs.length).toBe(3);
      
      const es = langs.find(l => l.code === 'es');
      expect(es?.name).toBe('Español');
      expect(es?.flag).toBe('🇪🇸');
      
      const en = langs.find(l => l.code === 'en');
      expect(en?.name).toBe('English');
      expect(en?.flag).toBe('🇬🇧');
      
      const fr = langs.find(l => l.code === 'fr');
      expect(fr?.name).toBe('Français');
      expect(fr?.flag).toBe('🇫🇷');
    });
  });

  describe('Computed Signals', () => {
    it('should compute isSpanish correctly', () => {
      service.setLanguage('es');
      expect(service.isSpanish()).toBe(true);
      expect(service.isEnglish()).toBe(false);
      expect(service.isFrench()).toBe(false);
    });

    it('should compute isEnglish correctly', () => {
      service.setLanguage('en');
      expect(service.isSpanish()).toBe(false);
      expect(service.isEnglish()).toBe(true);
      expect(service.isFrench()).toBe(false);
    });

    it('should compute isFrench correctly', () => {
      service.setLanguage('fr');
      expect(service.isSpanish()).toBe(false);
      expect(service.isEnglish()).toBe(false);
      expect(service.isFrench()).toBe(true);
    });
  });

  describe('Translation Keys', () => {
    beforeEach(() => {
      service.setLanguage('es');
    });

    it('should have common translations', () => {
      expect(service.translate('common.save')).toBe('Guardar');
      expect(service.translate('common.cancel')).toBe('Cancelar');
      expect(service.translate('common.delete')).toBe('Eliminar');
      expect(service.translate('common.edit')).toBe('Editar');
      expect(service.translate('common.create')).toBe('Crear');
    });

    it('should have auth translations', () => {
      expect(service.translate('auth.login')).toBe('Iniciar sesión');
      expect(service.translate('auth.login.username')).toBe('Usuario');
      expect(service.translate('auth.login.password')).toBe('Contraseña');
      expect(service.translate('auth.login.pin')).toBe('PIN');
    });

    it('should have dashboard translations', () => {
      expect(service.translate('dashboard.title')).toBe('Panel de Control');
      expect(service.translate('dashboard.subtitle')).toBe('Resumen de tu restaurante');
    });

    it('should have admin translations', () => {
      expect(service.translate('admin.title')).toBe('Administración');
      expect(service.translate('admin.menu.dashboard')).toBe('Dashboard');
      expect(service.translate('admin.menu.staff')).toBe('Personal');
    });

    it('should have dish translations', () => {
      expect(service.translate('dish.new_dish')).toBe('Nuevo Plato');
      expect(service.translate('dish.price')).toBe('Precio');
      expect(service.translate('dish.category')).toBe('Categoría');
    });

    it('should have TAS translations', () => {
      expect(service.translate('tas.title')).toBe('Servicio de Mesas');
      expect(service.translate('tas.tables')).toBe('Mesas');
      expect(service.translate('tas.order.add')).toBe('Añadir pedido');
    });

    it('should have POS translations', () => {
      expect(service.translate('pos.title')).toBe('Punto de Venta');
      expect(service.translate('pos.total')).toBe('Total');
    });

    it('should have KDS translations', () => {
      expect(service.translate('kds.title')).toBe('Pantalla de Cocina');
      expect(service.translate('kds.pending')).toBe('pendientes');
    });

    it('should have error translations', () => {
      expect(service.translate('error.loading')).toBe('Error al cargar los datos');
      expect(service.translate('error.saving')).toBe('Error al guardar los cambios');
      expect(service.translate('error.network')).toBe('Error de conexión');
    });

    it('should have totem translations', () => {
      expect(service.translate('totem.title')).toBe('Tótems');
      expect(service.translate('totem.welcome')).toBe('¡Bienvenido!');
      expect(service.translate('totem.menu')).toBe('Menú');
    });
  });

  describe('English Translations', () => {
    beforeEach(() => {
      service.setLanguage('en');
    });

    it('should have common english translations', () => {
      expect(service.translate('common.save')).toBe('Save');
      expect(service.translate('common.cancel')).toBe('Cancel');
      expect(service.translate('common.delete')).toBe('Delete');
    });

    it('should have auth english translations', () => {
      expect(service.translate('auth.login')).toBe('Login');
      expect(service.translate('auth.login.username')).toBe('Username');
      expect(service.translate('auth.login.password')).toBe('Password');
    });

    it('should have dashboard english translations', () => {
      expect(service.translate('dashboard.title')).toBe('Dashboard');
    });
  });

  describe('French Translations', () => {
    beforeEach(() => {
      service.setLanguage('fr');
    });

    it('should have common french translations', () => {
      expect(service.translate('common.save')).toBe('Enregistrer');
      expect(service.translate('common.cancel')).toBe('Annuler');
      expect(service.translate('common.delete')).toBe('Supprimer');
    });

    it('should have auth french translations', () => {
      expect(service.translate('auth.login')).toBe('Connexion');
      expect(service.translate('auth.login.username')).toBe("Nom d'utilisateur");
      expect(service.translate('auth.login.password')).toBe('Mot de passe');
    });
  });
});
