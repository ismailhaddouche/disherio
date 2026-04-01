import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ThemeService, Theme } from './theme.service';
import { environment } from '../../../environments/environment';
import { Platform } from '@angular/cdk/platform';

describe('ThemeService', () => {
  let service: ThemeService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        ThemeService,
        { provide: Platform, useValue: { isBrowser: true } }
      ]
    });
    service = TestBed.inject(ThemeService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('Service Creation', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('should initialize with a theme', () => {
      expect(service.currentTheme()).toBeDefined();
    });

    it('should have isDark computed signal', () => {
      expect(service.isDark()).toBeDefined();
    });

    it('should have isLight computed signal', () => {
      expect(service.isLight()).toBeDefined();
    });
  });

  describe('setTheme', () => {
    it('should set theme to dark', () => {
      service.setTheme('dark');
      expect(service.currentTheme()).toBe('dark');
    });

    it('should set theme to light', () => {
      service.setTheme('dark');
      service.setTheme('light');
      expect(service.currentTheme()).toBe('light');
    });

    it('should update isDark computed signal', () => {
      service.setTheme('dark');
      expect(service.isDark()).toBe(true);
      expect(service.isLight()).toBe(false);
    });

    it('should update isLight computed signal', () => {
      service.setTheme('light');
      expect(service.isDark()).toBe(false);
      expect(service.isLight()).toBe(true);
    });
  });

  describe('toggleTheme', () => {
    it('should toggle from light to dark', () => {
      service.setTheme('light');
      service.toggleTheme();
      expect(service.currentTheme()).toBe('dark');
    });

    it('should toggle from dark to light', () => {
      service.setTheme('dark');
      service.toggleTheme();
      expect(service.currentTheme()).toBe('light');
    });

    it('should toggle twice and return to original', () => {
      service.setTheme('light');
      service.toggleTheme();
      service.toggleTheme();
      expect(service.currentTheme()).toBe('light');
    });
  });

  describe('getThemeLabel', () => {
    it('should return label for light theme', () => {
      expect(service.getThemeLabel('light')).toBe('Claro');
    });

    it('should return label for dark theme', () => {
      expect(service.getThemeLabel('dark')).toBe('Oscuro');
    });
  });

  describe('getThemeIcon', () => {
    it('should return icon for light theme', () => {
      expect(service.getThemeIcon('light')).toBe('☀️');
    });

    it('should return icon for dark theme', () => {
      expect(service.getThemeIcon('dark')).toBe('🌙');
    });
  });

  describe('Signal Reactivity', () => {
    it('should update currentTheme signal', () => {
      expect(service.currentTheme()).toBeDefined();
      
      service.setTheme('dark');
      expect(service.currentTheme()).toBe('dark');
      
      service.setTheme('light');
      expect(service.currentTheme()).toBe('light');
    });

    it('should compute isDark based on currentTheme', () => {
      service.setTheme('dark');
      expect(service.isDark()).toBe(true);
      
      service.setTheme('light');
      expect(service.isDark()).toBe(false);
    });

    it('should compute isLight based on currentTheme', () => {
      service.setTheme('dark');
      expect(service.isLight()).toBe(false);
      
      service.setTheme('light');
      expect(service.isLight()).toBe(true);
    });
  });
});
