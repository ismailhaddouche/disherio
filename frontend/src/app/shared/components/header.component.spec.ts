import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal, type WritableSignal } from '@angular/core';
import { HeaderComponent } from './header.component';
import { I18nService, type Language } from '../../core/services/i18n.service';
import { ThemeService } from '../../core/services/theme.service';
import { RestaurantService } from '../../core/services/restaurant.service';
import { AuthService } from '../../core/services/auth.service';
import { of, throwError } from 'rxjs';
import { authStore } from '../../store/auth.store';

describe('HeaderComponent', () => {
  const languages = [
    { code: 'es' as const, name: 'Español', shortCode: 'ES' },
    { code: 'en' as const, name: 'English', shortCode: 'EN' },
    { code: 'fr' as const, name: 'Français', shortCode: 'FR' },
  ];

  let currentLanguage: WritableSignal<Language>;
  let enabledLanguages: WritableSignal<Language[]>;
  let authService: jasmine.SpyObj<AuthService>;

  beforeEach(async () => {
    currentLanguage = signal<Language>('es');
    enabledLanguages = signal<Language[]>(['es', 'en', 'fr']);
    authService = jasmine.createSpyObj<AuthService>('AuthService', ['logout']);
    authService.logout.and.returnValue(of({ message: 'ok' }));

    const i18n = {
      currentLang: currentLanguage.asReadonly(),
      getAvailableLanguages: () => languages.filter((language) => enabledLanguages().includes(language.code)),
      setLanguage: (language: Language) => currentLanguage.set(language),
      translate: (key: string) => key,
    };
    const darkTheme = signal(false);
    const theme = {
      isDark: darkTheme.asReadonly(),
      toggleTheme: () => darkTheme.update((value) => !value),
    };
    const restaurant = {
      restaurantName: signal('DisherIO Test').asReadonly(),
      loadRestaurant: jasmine.createSpy('loadRestaurant'),
    };

    await TestBed.configureTestingModule({
      imports: [HeaderComponent],
      providers: [
        provideRouter([]),
        { provide: I18nService, useValue: i18n },
        { provide: ThemeService, useValue: theme },
        { provide: RestaurantService, useValue: restaurant },
        { provide: AuthService, useValue: authService },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    authStore.clearAuth();
  });

  const openLanguageMenu = (element: HTMLElement): void => {
    (element.querySelector('.disher-language-selector > button') as HTMLButtonElement).click();
  };

  const languageOptions = (element: HTMLElement): HTMLButtonElement[] =>
    Array.from(element.querySelectorAll<HTMLButtonElement>('.disher-language-selector .absolute button'));

  it('calls the backend and clears local auth after logout succeeds', () => {
    const fixture = TestBed.createComponent(HeaderComponent);
    spyOn(authStore, 'clearAuth').and.callThrough();
    fixture.componentInstance.logout();

    expect(authService.logout).toHaveBeenCalledTimes(1);
    expect(authStore.clearAuth).toHaveBeenCalled();
  });

  it('clears local auth even when backend logout fails', () => {
    authService.logout.and.returnValue(throwError(() => new Error('offline')));
    const fixture = TestBed.createComponent(HeaderComponent);
    spyOn(authStore, 'clearAuth').and.callThrough();
    fixture.componentInstance.logout();

    expect(authStore.clearAuth).toHaveBeenCalled();
  });

  it('renders the totem-style trigger with globe icon and current language code', () => {
    const fixture = TestBed.createComponent(HeaderComponent);
    fixture.detectChanges();

    const trigger = fixture.nativeElement.querySelector('.disher-language-selector > button') as HTMLElement;
    const icons = trigger.querySelectorAll('.material-symbols-outlined');
    const code = trigger.querySelector('.uppercase');

    expect(icons.length).toBe(1);
    expect(icons[0].textContent?.trim()).toBe('language');
    expect(code?.textContent?.trim()).toBe('es');
  });

  it('renders each available language once in the dropdown with a check on the active one', () => {
    const fixture = TestBed.createComponent(HeaderComponent);
    fixture.detectChanges();

    openLanguageMenu(fixture.nativeElement);
    fixture.detectChanges();

    const options = languageOptions(fixture.nativeElement);
    const names = options.map((option) => option.querySelector('span')?.textContent?.trim());

    expect(options.length).toBe(3);
    expect(names).toEqual(['Español', 'English', 'Français']);
    expect(new Set(names).size).toBe(names.length);

    const checks = options.map(
      (option) => option.querySelector('.material-symbols-outlined')?.textContent?.trim() ?? null
    );
    expect(checks).toEqual(['check', null, null]);
  });

  it('updates the language and closes the dropdown on selection', () => {
    enabledLanguages.set(['es', 'fr']);
    const fixture = TestBed.createComponent(HeaderComponent);
    fixture.detectChanges();

    openLanguageMenu(fixture.nativeElement);
    fixture.detectChanges();

    const options = languageOptions(fixture.nativeElement);
    expect(options.length).toBe(2);

    options[1].click();
    fixture.detectChanges();

    expect(currentLanguage()).toBe('fr');
    const trigger = fixture.nativeElement.querySelector('.disher-language-selector > button') as HTMLElement;
    expect(trigger.querySelector('.uppercase')?.textContent?.trim()).toBe('fr');
    expect(fixture.nativeElement.querySelector('.disher-language-selector .absolute')).toBeNull();
  });
});
