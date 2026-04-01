import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { RestaurantService } from './restaurant.service';
import { environment } from '../../../environments/environment';
import type { Restaurant } from '../../types';

describe('RestaurantService', () => {
  let service: RestaurantService;
  let httpMock: HttpTestingController;

  const createMockRestaurant = (overrides: Partial<Restaurant> = {}): Restaurant => ({
    _id: 'rest1',
    restaurant_name: 'Test Restaurant',
    restaurant_url: 'test-restaurant',
    logo_image_url: 'https://example.com/logo.png',
    social_links: {},
    tax_rate: 10,
    tips_state: false,
    default_language: 'es',
    default_theme: 'light',
    currency: 'EUR',
    ...overrides
  });

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [RestaurantService]
    });
    service = TestBed.inject(RestaurantService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('Service Creation', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('should have null restaurant initially', () => {
      expect(service.getRestaurant()()).toBeNull();
    });

    it('should return default restaurant name when not loaded', () => {
      expect(service.restaurantName()).toBe('DisherIO');
    });

    it('should return undefined logoUrl when not loaded', () => {
      expect(service.logoUrl()).toBeUndefined();
    });
  });

  describe('loadRestaurant', () => {
    it('should load restaurant from API', async () => {
      const mockRestaurant = createMockRestaurant();

      service.loadRestaurant();

      const req = httpMock.expectOne(`${environment.apiUrl}/restaurant/me`);
      expect(req.request.method).toBe('GET');
      req.flush(mockRestaurant);

      await new Promise(resolve => setTimeout(resolve, 0));
      expect(service.getRestaurant()()).toEqual(mockRestaurant);
    });

    it('should update restaurantName computed signal after loading', async () => {
      const mockRestaurant = createMockRestaurant({ restaurant_name: 'My Restaurant' });

      service.loadRestaurant();

      const req = httpMock.expectOne(`${environment.apiUrl}/restaurant/me`);
      req.flush(mockRestaurant);

      await new Promise(resolve => setTimeout(resolve, 0));
      expect(service.restaurantName()).toBe('My Restaurant');
    });

    it('should update logoUrl computed signal after loading', async () => {
      const mockRestaurant = createMockRestaurant({ logo_image_url: 'https://example.com/logo.png' });

      service.loadRestaurant();

      const req = httpMock.expectOne(`${environment.apiUrl}/restaurant/me`);
      req.flush(mockRestaurant);

      await new Promise(resolve => setTimeout(resolve, 0));
      expect(service.logoUrl()).toBe('https://example.com/logo.png');
    });

    it('should return empty string when restaurant name is empty', async () => {
      const mockRestaurant = createMockRestaurant({ restaurant_name: '' });

      service.loadRestaurant();

      const req = httpMock.expectOne(`${environment.apiUrl}/restaurant/me`);
      req.flush(mockRestaurant);

      await new Promise(resolve => setTimeout(resolve, 0));
      // Note: The service uses ?? operator which only falls back for null/undefined, not empty string
      expect(service.restaurantName()).toBe('');
    });

    it('should handle error when loading restaurant', async () => {
      service.loadRestaurant();

      const req = httpMock.expectOne(`${environment.apiUrl}/restaurant/me`);
      req.flush('Server error', { status: 500, statusText: 'Internal Server Error' });

      await new Promise(resolve => setTimeout(resolve, 0));
      expect(service.getRestaurant()()).toBeNull();
    });

    it('should handle 401 unauthorized error', async () => {
      service.loadRestaurant();

      const req = httpMock.expectOne(`${environment.apiUrl}/restaurant/me`);
      req.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

      await new Promise(resolve => setTimeout(resolve, 0));
      expect(service.getRestaurant()()).toBeNull();
    });

    it('should handle network error', async () => {
      service.loadRestaurant();

      const req = httpMock.expectOne(`${environment.apiUrl}/restaurant/me`);
      req.error(new ErrorEvent('Network error'));

      await new Promise(resolve => setTimeout(resolve, 0));
      expect(service.getRestaurant()()).toBeNull();
    });
  });

  describe('getRestaurant', () => {
    it('should return readonly signal', () => {
      const restaurant = service.getRestaurant();
      expect(restaurant).toBeDefined();
    });

    it('should return restaurant data after loading', async () => {
      const mockRestaurant = createMockRestaurant();

      service.loadRestaurant();

      const req = httpMock.expectOne(`${environment.apiUrl}/restaurant/me`);
      req.flush(mockRestaurant);

      await new Promise(resolve => setTimeout(resolve, 0));
      const restaurant = service.getRestaurant()();
      expect(restaurant?._id).toBe('rest1');
      expect(restaurant?.restaurant_name).toBe('Test Restaurant');
    });
  });

  describe('Computed Signals', () => {
    it('should compute restaurantName correctly', async () => {
      const mockRestaurant = createMockRestaurant({ restaurant_name: 'Awesome Restaurant' });

      service.loadRestaurant();

      const req = httpMock.expectOne(`${environment.apiUrl}/restaurant/me`);
      req.flush(mockRestaurant);

      await new Promise(resolve => setTimeout(resolve, 0));
      expect(service.restaurantName()).toBe('Awesome Restaurant');
    });

    it('should return DisherIO when restaurant is null', () => {
      expect(service.restaurantName()).toBe('DisherIO');
    });

    it('should compute logoUrl correctly', async () => {
      const mockRestaurant = createMockRestaurant({ logo_image_url: 'https://cdn.example.com/logo.webp' });

      service.loadRestaurant();

      const req = httpMock.expectOne(`${environment.apiUrl}/restaurant/me`);
      req.flush(mockRestaurant);

      await new Promise(resolve => setTimeout(resolve, 0));
      expect(service.logoUrl()).toBe('https://cdn.example.com/logo.webp');
    });

    it('should return undefined logoUrl when restaurant has no logo', async () => {
      const mockRestaurant = createMockRestaurant({ logo_image_url: undefined });

      service.loadRestaurant();

      const req = httpMock.expectOne(`${environment.apiUrl}/restaurant/me`);
      req.flush(mockRestaurant);

      await new Promise(resolve => setTimeout(resolve, 0));
      expect(service.logoUrl()).toBeUndefined();
    });
  });

  describe('Multiple Loads', () => {
    it('should update restaurant on subsequent loads', async () => {
      const restaurant1 = createMockRestaurant({ 
        _id: 'rest1', 
        restaurant_name: 'First Restaurant' 
      });

      const restaurant2 = createMockRestaurant({ 
        _id: 'rest2', 
        restaurant_name: 'Second Restaurant' 
      });

      // First load
      service.loadRestaurant();
      
      let req = httpMock.expectOne(`${environment.apiUrl}/restaurant/me`);
      req.flush(restaurant1);

      await new Promise(resolve => setTimeout(resolve, 0));
      expect(service.restaurantName()).toBe('First Restaurant');

      // Second load
      service.loadRestaurant();
      
      req = httpMock.expectOne(`${environment.apiUrl}/restaurant/me`);
      req.flush(restaurant2);

      await new Promise(resolve => setTimeout(resolve, 0));
      expect(service.restaurantName()).toBe('Second Restaurant');
    });
  });
});
