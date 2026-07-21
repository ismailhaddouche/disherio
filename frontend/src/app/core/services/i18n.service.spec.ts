import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { I18nService, Language } from './i18n.service';
import { Platform } from '@angular/cdk/platform';
import esCatalog from '../../../../public/assets/i18n/es.json';
import enCatalog from '../../../../public/assets/i18n/en.json';
import frCatalog from '../../../../public/assets/i18n/fr.json';

const CATALOGS: Record<Language, object> = {
  es: esCatalog,
  en: enCatalog,
  fr: frCatalog,
};

describe('I18nService', () => {
  let service: I18nService;
  let httpMock: HttpTestingController;

  function flushCatalog(lang: Language): void {
    const requests = httpMock.match((req) => req.url === `/assets/i18n/${lang}.json`);
    for (const req of requests) {
      req.flush(CATALOGS[lang]);
    }
  }

  function flushAllCatalogs(): void {
    for (const lang of Object.keys(CATALOGS) as Language[]) {
      flushCatalog(lang);
    }
  }

  // Flushing resolves the HTTP observable, but the catalog signal updates in
  // a microtask; awaiting the pending load makes assertions deterministic.
  async function useLanguage(lang: Language): Promise<void> {
    service.setLanguage(lang);
    flushCatalog(lang);
    await service.ensureInitialCatalog();
  }

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        I18nService,
        { provide: Platform, useValue: { isBrowser: true } }
      ]
    });
    service = TestBed.inject(I18nService);
    httpMock = TestBed.inject(HttpTestingController);
    // The constructor requests the initial language catalog immediately
    flushAllCatalogs();
  });

  afterEach(() => {
    // Absorb any catalog request triggered by late-running effects
    flushAllCatalogs();
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

  describe('catalog loading', () => {
    it('should request each catalog only once across repeated language switches', () => {
      service.setLanguage('fr');
      service.setLanguage('fr');
      const requests = httpMock.match((req) => req.url === '/assets/i18n/fr.json');
      expect(requests.length).toBe(1);
      requests.forEach((req) => req.flush(CATALOGS.fr));
    });

    it('should return the key while the catalog is still loading', async () => {
      service.setLanguage('es');
      expect(service.translate('common.loading')).toBe('common.loading');
      flushCatalog('es');
      await service.ensureInitialCatalog();
      expect(service.translate('common.loading')).toBe('Cargando...');
    });

    it('should resolve ensureInitialCatalog once the catalog arrives', async () => {
      service.setLanguage('fr');
      const ready = service.ensureInitialCatalog();
      flushCatalog('fr');
      await expectAsync(ready).toBeResolved();
      expect(service.translate('common.loading')).toBe('Chargement...');
    });

    it('should fall back to the key when the catalog request fails', () => {
      service.setLanguage('fr');
      const requests = httpMock.match((req) => req.url === '/assets/i18n/fr.json');
      requests.forEach((req) => req.flush('error', { status: 500, statusText: 'Server Error' }));
      expect(service.translate('common.loading')).toBe('common.loading');
    });
  });

  describe('setLanguage', () => {
    it('should set language to spanish', async () => {
      await useLanguage('es');
      expect(service.currentLang()).toBe('es');
    });

    it('should set language to english', async () => {
      await useLanguage('en');
      expect(service.currentLang()).toBe('en');
    });

    it('should set language to french', async () => {
      await useLanguage('fr');
      expect(service.currentLang()).toBe('fr');
    });

    it('should not set invalid language', () => {
      const currentLang = service.currentLang();
      service.setLanguage('invalid' as Language);
      expect(service.currentLang()).toBe(currentLang);
      httpMock.expectNone((req) => req.url.includes('invalid'));
    });
  });

  describe('translate', () => {
    it('should return key if translation not found', () => {
      const key = 'nonexistent.key';
      expect(service.translate(key)).toBe(key);
    });

    it('should return translation for existing key in spanish', async () => {
      await useLanguage('es');
      const translation = service.translate('common.loading');
      expect(translation).toBe('Cargando...');
    });

    it('should return translation for existing key in english', async () => {
      await useLanguage('en');
      const translation = service.translate('common.loading');
      expect(translation).toBe('Loading...');
    });

    it('should handle nested keys', async () => {
      await useLanguage('es');
      const translation = service.translate('auth.login');
      expect(translation).toBe('Iniciar sesión');
    });

    it('should return key for invalid nested path', async () => {
      await useLanguage('es');
      const key = 'common.invalid.nested.key';
      expect(service.translate(key)).toBe(key);
    });

    it('should translate password visibility controls in every language', async () => {
      const expected = {
        es: ['Mostrar contraseña', 'Ocultar contraseña'],
        en: ['Show password', 'Hide password'],
        fr: ['Afficher le mot de passe', 'Masquer le mot de passe'],
      } as const;

      for (const language of ['es', 'en', 'fr'] as const) {
        await useLanguage(language);
        expect(service.translate('common.show_password')).toBe(expected[language][0]);
        expect(service.translate('common.hide_password')).toBe(expected[language][1]);
      }
    });
  });

  describe('getAvailableLanguages', () => {
    it('should return array of languages', () => {
      const langs = service.getAvailableLanguages();
      expect(langs.length).toBe(3);

      const es = langs.find(l => l.code === 'es');
      expect(es?.name).toBe('Español');
      expect(es?.shortCode).toBe('ES');

      const en = langs.find(l => l.code === 'en');
      expect(en?.name).toBe('English');
      expect(en?.shortCode).toBe('EN');

      const fr = langs.find(l => l.code === 'fr');
      expect(fr?.name).toBe('Français');
      expect(fr?.shortCode).toBe('FR');
    });
  });

  describe('Computed Signals', () => {
    it('should compute isSpanish correctly', async () => {
      await useLanguage('es');
      expect(service.isSpanish()).toBe(true);
      expect(service.isEnglish()).toBe(false);
      expect(service.isFrench()).toBe(false);
    });

    it('should compute isEnglish correctly', async () => {
      await useLanguage('en');
      expect(service.isSpanish()).toBe(false);
      expect(service.isEnglish()).toBe(true);
      expect(service.isFrench()).toBe(false);
    });

    it('should compute isFrench correctly', async () => {
      await useLanguage('fr');
      expect(service.isSpanish()).toBe(false);
      expect(service.isEnglish()).toBe(false);
      expect(service.isFrench()).toBe(true);
    });
  });

  describe('Translation Keys', () => {
    beforeEach(async () => {
      await useLanguage('es');
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
      expect(service.translate('kds.pending')).toBe('Pendientes');
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
    beforeEach(async () => {
      await useLanguage('en');
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
    beforeEach(async () => {
      await useLanguage('fr');
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
