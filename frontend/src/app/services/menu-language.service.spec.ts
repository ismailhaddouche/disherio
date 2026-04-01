import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { MenuLanguageService } from './menu-language.service';
import { I18nService } from '../core/services/i18n.service';
import { environment } from '../../environments/environment';
import type { MenuLanguage, LocalizedField } from '../types';

describe('MenuLanguageService', () => {
  let service: MenuLanguageService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        MenuLanguageService,
        { provide: I18nService, useValue: { currentLang: () => 'es' } }
      ]
    });
    service = TestBed.inject(MenuLanguageService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('Service Creation', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('should have empty languages initially', () => {
      expect(service.languages()).toEqual([]);
    });

    it('should have null defaultLanguage initially', () => {
      expect(service.defaultLanguage()).toBeNull();
    });
  });

  describe('load', () => {
    it('should load languages from API', async () => {
      const mockLanguages: MenuLanguage[] = [
        {
          _id: 'lang1',
          name: 'Español',
          code: 'es',
          is_default: true,
          linked_app_lang: 'es',
          order: 1
        } as MenuLanguage,
        {
          _id: 'lang2',
          name: 'English',
          code: 'en',
          is_default: false,
          linked_app_lang: 'en',
          order: 2
        } as MenuLanguage
      ];

      service.load();

      const req = httpMock.expectOne(`${environment.apiUrl}/menu-languages`);
      expect(req.request.method).toBe('GET');
      req.flush(mockLanguages);

      await new Promise(resolve => setTimeout(resolve, 0));
      expect(service.languages()).toEqual(mockLanguages);
      expect(service.languages().length).toBe(2);
    });

    it('should handle error when loading languages', async () => {
      service.load();

      const req = httpMock.expectOne(`${environment.apiUrl}/menu-languages`);
      req.flush('Server error', { status: 500, statusText: 'Internal Server Error' });

      await new Promise(resolve => setTimeout(resolve, 0));
      expect(service.languages()).toEqual([]);
    });

    it('should set empty array on error response', async () => {
      service.load();

      const req = httpMock.expectOne(`${environment.apiUrl}/menu-languages`);
      req.error(new ErrorEvent('Network error'));

      await new Promise(resolve => setTimeout(resolve, 0));
      expect(service.languages()).toEqual([]);
    });
  });

  describe('defaultLanguage', () => {
    it('should return the default language after loading', async () => {
      const mockLanguages: MenuLanguage[] = [
        {
          _id: 'lang1',
          name: 'Español',
          code: 'es',
          is_default: true,
          order: 1
        } as MenuLanguage,
        {
          _id: 'lang2',
          name: 'English',
          code: 'en',
          is_default: false,
          order: 2
        } as MenuLanguage
      ];

      service.load();

      const req = httpMock.expectOne(`${environment.apiUrl}/menu-languages`);
      req.flush(mockLanguages);

      await new Promise(resolve => setTimeout(resolve, 0));
      expect(service.defaultLanguage()?.code).toBe('es');
    });

    it('should return null when no default language', async () => {
      const mockLanguages: MenuLanguage[] = [
        {
          _id: 'lang1',
          name: 'Español',
          code: 'es',
          is_default: false,
          order: 1
        } as MenuLanguage
      ];

      service.load();

      const req = httpMock.expectOne(`${environment.apiUrl}/menu-languages`);
      req.flush(mockLanguages);

      await new Promise(resolve => setTimeout(resolve, 0));
      expect(service.defaultLanguage()).toBeNull();
    });

    it('should return null when no languages loaded', () => {
      expect(service.defaultLanguage()).toBeNull();
    });
  });

  describe('localize', () => {
    beforeEach(async () => {
      const mockLanguages: MenuLanguage[] = [
        {
          _id: 'lang1',
          name: 'Español',
          code: 'es',
          is_default: true,
          linked_app_lang: 'es',
          order: 1
        } as MenuLanguage
      ];

      service.load();

      const req = httpMock.expectOne(`${environment.apiUrl}/menu-languages`);
      req.flush(mockLanguages);

      await new Promise(resolve => setTimeout(resolve, 0));
    });

    it('should return empty string for null/undefined value', () => {
      expect(service.localize(null)).toBe('');
      expect(service.localize(undefined)).toBe('');
    });

    it('should return empty string for non-array value', () => {
      expect(service.localize('invalid' as any)).toBe('');
      expect(service.localize({} as any)).toBe('');
    });

    it('should return empty string for empty array', () => {
      expect(service.localize([])).toBe('');
    });

    it('should return value in default language', () => {
      const localizedField: LocalizedField = [
        { lang: 'lang1', value: 'Plato Español' }
      ];

      expect(service.localize(localizedField)).toBe('Plato Español');
    });

    it('should fallback to first available entry', () => {
      const localizedField: LocalizedField = [
        { lang: 'other', value: 'Some Value' }
      ];

      expect(service.localize(localizedField)).toBe('Some Value');
    });

    it('should skip entries with empty values', () => {
      const localizedField: LocalizedField = [
        { lang: 'lang1', value: '' },
        { lang: 'other', value: 'Fallback Value' }
      ];

      expect(service.localize(localizedField)).toBe('Fallback Value');
    });
  });

  describe('create', () => {
    it('should create a new menu language', () => {
      const createData = {
        name: 'Français',
        code: 'fr',
        is_default: false,
        linked_app_lang: 'fr' as string | null
      };
      const mockResponse: MenuLanguage = {
        _id: 'lang3',
        ...createData,
        order: 3
      } as MenuLanguage;

      service.create(createData).subscribe(lang => {
        expect(lang.name).toBe(createData.name);
        expect(lang.code).toBe(createData.code);
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/menu-languages`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(createData);
      req.flush(mockResponse);
    });

    it('should create without linked_app_lang', () => {
      const createData = {
        name: 'Deutsch',
        code: 'de'
      };

      service.create(createData).subscribe();

      const req = httpMock.expectOne(`${environment.apiUrl}/menu-languages`);
      expect(req.request.body).toEqual(createData);
      req.flush({ _id: 'lang4', ...createData } as MenuLanguage);
    });
  });

  describe('update', () => {
    it('should update language fields', () => {
      const langId = 'lang1';
      const updateData = {
        name: 'Español Actualizado',
        code: 'es-ES',
        order: 2
      };

      service.update(langId, updateData).subscribe(lang => {
        expect(lang.name).toBe(updateData.name);
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/menu-languages/${langId}`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual(updateData);
      req.flush({
        _id: langId,
        ...updateData,
        is_default: true
      } as MenuLanguage);
    });
  });

  describe('setDefault', () => {
    it('should set language as default', () => {
      const langId = 'lang2';
      const mockResponse: MenuLanguage = {
        _id: langId,
        name: 'English',
        code: 'en',
        is_default: true,
        order: 2
      } as MenuLanguage;

      service.setDefault(langId).subscribe(lang => {
        expect(lang.is_default).toBe(true);
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/menu-languages/${langId}/set-default`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({});
      req.flush(mockResponse);
    });
  });

  describe('remove', () => {
    it('should delete a language', () => {
      const langId = 'lang2';

      service.remove(langId).subscribe(response => {
        expect(response).toBeTruthy();
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/menu-languages/${langId}`);
      expect(req.request.method).toBe('DELETE');
      req.flush({});
    });

    it('should handle 403 when deleting default language', () => {
      const langId = 'lang1';

      service.remove(langId).subscribe({
        error: (error) => {
          expect(error.status).toBe(403);
        }
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/menu-languages/${langId}`);
      req.flush('Cannot delete default language', { status: 403, statusText: 'Forbidden' });
    });
  });

  describe('refresh', () => {
    it('should reload languages', async () => {
      const mockLanguages: MenuLanguage[] = [
        { _id: 'lang1', name: 'Español', code: 'es', is_default: true, order: 1 } as MenuLanguage
      ];

      service.refresh();

      const req = httpMock.expectOne(`${environment.apiUrl}/menu-languages`);
      req.flush(mockLanguages);

      await new Promise(resolve => setTimeout(resolve, 0));
      expect(service.languages()).toEqual(mockLanguages);
    });
  });

  describe('setLanguages', () => {
    it('should set languages directly from external source', () => {
      const externalLanguages: MenuLanguage[] = [
        { _id: 'ext1', name: 'External Lang', code: 'ext', is_default: true, order: 1 } as MenuLanguage
      ];

      service.setLanguages(externalLanguages);

      expect(service.languages()).toEqual(externalLanguages);
    });
  });
});
