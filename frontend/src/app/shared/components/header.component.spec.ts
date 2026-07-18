import { OverlayContainer } from '@angular/cdk/overlay';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
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
  let overlayContainer: OverlayContainer;
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
      imports: [HeaderComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        { provide: I18nService, useValue: i18n },
        { provide: ThemeService, useValue: theme },
        { provide: RestaurantService, useValue: restaurant },
        { provide: AuthService, useValue: authService },
      ],
    }).compileComponents();

    overlayContainer = TestBed.inject(OverlayContainer);
  });

  afterEach(() => {
    authStore.clearAuth();
    overlayContainer.getContainerElement().innerHTML = '';
  });

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

  it('renders the current language code only once in the trigger', () => {
    const fixture = TestBed.createComponent(HeaderComponent);
    fixture.detectChanges();

    const trigger = fixture.nativeElement.querySelector('.disher-language-trigger') as HTMLElement;
    const codes = trigger.querySelectorAll('.disher-language-code');

    expect(codes.length).toBe(1);
    expect(codes[0].textContent?.trim()).toBe('ES');
    expect(trigger.querySelector('.disher-lang-label')).toBeNull();
  });

  it('renders each available language once as an aligned menu row', fakeAsync(() => {
    const fixture = TestBed.createComponent(HeaderComponent);
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('.disher-language-trigger') as HTMLButtonElement).click();
    fixture.detectChanges();
    tick();

    const options = Array.from(
      overlayContainer.getContainerElement().querySelectorAll<HTMLButtonElement>('.disher-language-option')
    );
    const names = options.map((option) => option.querySelector('.disher-language-name')?.textContent?.trim());

    expect(options.length).toBe(3);
    expect(names).toEqual(['Español', 'English', 'Français']);
    expect(new Set(names).size).toBe(names.length);
    const optionRects = options.map((option) => option.getBoundingClientRect());
    expect(optionRects[1].top).toBeGreaterThan(optionRects[0].top);
    expect(optionRects[2].top).toBeGreaterThan(optionRects[1].top);
    const nameOffsets = options.map((option) =>
      Math.round(option.querySelector('.disher-language-name')?.getBoundingClientRect().left ?? -1)
    );
    expect(new Set(nameOffsets).size).toBe(1);
    options.forEach((option) => {
      expect(option.querySelectorAll('.disher-language-name').length).toBe(1);
      expect(option.querySelectorAll('.disher-check, .disher-check-placeholder').length).toBe(1);
    });
  }));

  it('updates the trigger and keeps the available language list reactive', fakeAsync(() => {
    enabledLanguages.set(['es', 'fr']);
    const fixture = TestBed.createComponent(HeaderComponent);
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('.disher-language-trigger') as HTMLButtonElement).click();
    fixture.detectChanges();
    tick();

    const options = overlayContainer
      .getContainerElement()
      .querySelectorAll<HTMLButtonElement>('.disher-language-option');
    expect(options.length).toBe(2);

    options[1].click();
    fixture.detectChanges();
    tick();

    expect(currentLanguage()).toBe('fr');
    expect(fixture.nativeElement.querySelector('.disher-language-code').textContent.trim()).toBe('FR');
  }));
});
