import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { RouterModule } from '@angular/router';
import { SwUpdate } from '@angular/service-worker';
import { App } from './app';
import { UpdateService } from './core/services/update.service';
import { authStore } from './store/auth.store';

describe('App', () => {
  let updateService: UpdateService;
  let savedTheme: string | null;
  let wasDark: boolean;

  beforeEach(async () => {
    savedTheme = localStorage.getItem('disherio-theme');
    wasDark = document.documentElement.classList.contains('dark');
    await TestBed.configureTestingModule({
      imports: [App, RouterModule.forRoot([])],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SwUpdate, useValue: { isEnabled: false, versionUpdates: { subscribe: () => ({ unsubscribe: () => {} }) }, checkForUpdate: () => Promise.resolve(false), activateUpdate: () => Promise.resolve() } },
      ],
    }).compileComponents();

    updateService = TestBed.inject(UpdateService);
  });

  afterEach(() => {
    (updateService as any).ngOnDestroy?.();
    if (savedTheme === null) localStorage.removeItem('disherio-theme');
    else localStorage.setItem('disherio-theme', savedTheme);
    document.documentElement.classList.toggle('dark', wasDark);
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render router-outlet', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('router-outlet')).toBeTruthy();
  });

  for (const theme of ['light', 'dark'] as const) {
    it(`should apply the saved ${theme} theme without a shared header`, () => {
      spyOn(authStore, 'preferences').and.returnValue(null);
      localStorage.setItem('disherio-theme', theme);
      document.documentElement.classList.toggle('dark', theme !== 'dark');

      const fixture = TestBed.createComponent(App);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('app-header')).toBeNull();
      expect(document.documentElement.classList.contains('dark')).toBe(theme === 'dark');
    });
  }
});
