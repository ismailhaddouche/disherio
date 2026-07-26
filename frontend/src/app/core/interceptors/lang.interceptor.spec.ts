import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { authStore } from '../../store/auth.store';
import { langInterceptor, resolveActiveLanguage } from './lang.interceptor';

describe('langInterceptor', () => {
  let http: HttpClient;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([langInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    authStore.clearAuth();
    localStorage.clear();
    httpTesting.verify();
  });

  function expectAcceptLanguage(expected: string): void {
    http.get('/api/totems/menu/some-qr').subscribe();
    const req = httpTesting.expectOne('/api/totems/menu/some-qr');
    expect(req.request.headers.get('Accept-Language')).toBe(expected);
    req.flush({});
  }

  it('sends the language stored in localStorage', () => {
    localStorage.setItem('disherio-language', 'fr');
    expectAcceptLanguage('fr');
  });

  it('prefers the authenticated user preference over localStorage', () => {
    localStorage.setItem('disherio-language', 'fr');
    authStore.updatePreferences({ language: 'en' });
    expectAcceptLanguage('en');
  });

  it('falls back to the browser language when nothing is stored', () => {
    const expected = navigator.language.split('-')[0];
    const known = ['es', 'en', 'fr'].includes(expected) ? expected : 'en';
    expectAcceptLanguage(known);
  });
});

describe('resolveActiveLanguage', () => {
  beforeEach(() => localStorage.clear());

  afterEach(() => {
    authStore.clearAuth();
    localStorage.clear();
  });

  it('returns the auth-store preference when present', () => {
    localStorage.setItem('disherio-language', 'fr');
    authStore.updatePreferences({ language: 'es' });
    expect(resolveActiveLanguage()).toBe('es');
  });

  it('falls back to the stored language', () => {
    localStorage.setItem('disherio-language', 'fr');
    expect(resolveActiveLanguage()).toBe('fr');
  });

  it('ignores unsupported stored languages', () => {
    localStorage.setItem('disherio-language', 'de');
    expect(resolveActiveLanguage()).not.toBe('de');
  });
});
