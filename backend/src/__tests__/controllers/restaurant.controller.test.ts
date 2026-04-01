import { Request, Response, NextFunction } from 'express';
import {
  getMyRestaurant,
  updateMyRestaurant,
  getRestaurantSettings,
  updateRestaurantSettings
} from '../../controllers/restaurant.controller';
import * as restaurantService from '../../services/restaurant.service';
import { AppError } from '../../utils/async-handler';

// Mock restaurant service
jest.mock('../../services/restaurant.service');

describe('RestaurantController', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  const mockUser = {
    staffId: 'staff123',
    restaurantId: 'rest123',
    role: 'ADMIN',
    permissions: ['ADMIN'],
    name: 'Test User'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    jsonMock = jest.fn().mockReturnThis();
    statusMock = jest.fn().mockReturnThis();
    next = jest.fn();
    
    res = {
      json: jsonMock,
      status: statusMock,
    };

    req = {
      user: mockUser,
      body: {},
      params: {}
    };
  });

  describe('GET /restaurants/me', () => {
    it('should return restaurant data for current user', async () => {
      // Arrange
      const mockRestaurant = {
        _id: 'rest123',
        restaurant_name: 'My Restaurant',
        tax_rate: 10,
        currency: 'EUR',
        default_language: 'es'
      };
      
      (restaurantService.getRestaurantById as jest.Mock).mockResolvedValue(mockRestaurant);

      // Act
      await getMyRestaurant(req as Request, res as Response, next);

      // Assert
      expect(restaurantService.getRestaurantById).toHaveBeenCalledWith('rest123');
      expect(jsonMock).toHaveBeenCalledWith(mockRestaurant);
    });

    it('should return 404 when restaurant not found', async () => {
      // Arrange
      (restaurantService.getRestaurantById as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(getMyRestaurant(req as Request, res as Response, next)).rejects.toThrow(AppError);
      await expect(getMyRestaurant(req as Request, res as Response, next)).rejects.toThrow('RESTAURANT_NOT_FOUND');
    });

    it('should use correct restaurantId from user', async () => {
      // Arrange
      req.user = { ...mockUser, restaurantId: 'other_rest' };
      
      const mockRestaurant = { _id: 'other_rest', restaurant_name: 'Other Restaurant' };
      (restaurantService.getRestaurantById as jest.Mock).mockResolvedValue(mockRestaurant);

      // Act
      await getMyRestaurant(req as Request, res as Response, next);

      // Assert
      expect(restaurantService.getRestaurantById).toHaveBeenCalledWith('other_rest');
    });
  });

  describe('PATCH /restaurants/me', () => {
    it('should update restaurant and return updated data', async () => {
      // Arrange
      const mockRestaurant = {
        _id: 'rest123',
        restaurant_name: 'Updated Restaurant Name',
        tax_rate: 15
      };
      
      req.body = { restaurant_name: 'Updated Restaurant Name', tax_rate: 15 };
      
      (restaurantService.updateRestaurant as jest.Mock).mockResolvedValue(mockRestaurant);

      // Act
      await updateMyRestaurant(req as Request, res as Response, next);

      // Assert
      expect(restaurantService.updateRestaurant).toHaveBeenCalledWith('rest123', req.body);
      expect(jsonMock).toHaveBeenCalledWith(mockRestaurant);
    });

    it('should handle partial updates', async () => {
      // Arrange
      const mockRestaurant = {
        _id: 'rest123',
        restaurant_name: 'Only Name Updated'
      };
      
      req.body = { restaurant_name: 'Only Name Updated' };
      
      (restaurantService.updateRestaurant as jest.Mock).mockResolvedValue(mockRestaurant);

      // Act
      await updateMyRestaurant(req as Request, res as Response, next);

      // Assert
      expect(restaurantService.updateRestaurant).toHaveBeenCalledWith('rest123', {
        restaurant_name: 'Only Name Updated'
      });
    });

    it('should pass error to next when update fails', async () => {
      // Arrange
      req.body = { restaurant_name: 'Invalid' };
      
      const error = new Error('UPDATE_FAILED');
      (restaurantService.updateRestaurant as jest.Mock).mockRejectedValue(error);

      // Act
      try { await updateMyRestaurant(req as Request, res as Response, next); } catch {}

      // Assert
      expect(next).toHaveBeenCalled();
    });
  });

  describe('GET /restaurants/settings', () => {
    it('should return restaurant settings', async () => {
      // Arrange
      const mockRestaurant = {
        _id: 'rest123',
        restaurant_name: 'My Restaurant',
        tax_rate: 10,
        currency: 'EUR',
        default_language: 'es',
        default_theme: 'light',
        tips_state: true,
        tips_type: 'OPTIONAL'
      };
      
      (restaurantService.getRestaurantById as jest.Mock).mockResolvedValue(mockRestaurant);

      // Act
      await getRestaurantSettings(req as Request, res as Response, next);

      // Assert
      expect(restaurantService.getRestaurantById).toHaveBeenCalledWith('rest123');
      expect(jsonMock).toHaveBeenCalledWith({
        _id: 'rest123',
        restaurant_name: 'My Restaurant',
        tax_rate: 10,
        currency: 'EUR',
        default_language: 'es',
        default_theme: 'light',
        tips_state: true,
        tips_type: 'OPTIONAL'
      });
    });

    it('should return 404 when restaurant not found', async () => {
      // Arrange
      (restaurantService.getRestaurantById as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(getRestaurantSettings(req as Request, res as Response, next)).rejects.toThrow(AppError);
      await expect(getRestaurantSettings(req as Request, res as Response, next)).rejects.toThrow('RESTAURANT_NOT_FOUND');
    });

    it('should handle null/undefined settings fields', async () => {
      // Arrange
      const mockRestaurant = {
        _id: 'rest123',
        restaurant_name: 'My Restaurant',
        tax_rate: null,
        currency: undefined,
        default_language: null,
        default_theme: undefined,
        tips_state: undefined,
        tips_type: null
      };
      
      (restaurantService.getRestaurantById as jest.Mock).mockResolvedValue(mockRestaurant);

      // Act
      await getRestaurantSettings(req as Request, res as Response, next);

      // Assert
      expect(jsonMock).toHaveBeenCalledWith({
        _id: 'rest123',
        restaurant_name: 'My Restaurant',
        tax_rate: null,
        currency: undefined,
        default_language: null,
        default_theme: undefined,
        tips_state: undefined,
        tips_type: null
      });
    });
  });

  describe('PATCH /restaurants/settings', () => {
    it('should update allowed settings fields', async () => {
      // Arrange
      const mockRestaurant = {
        _id: 'rest123',
        restaurant_name: 'Updated Name',
        tax_rate: 20,
        currency: 'USD',
        default_language: 'en',
        default_theme: 'dark',
        tips_state: false,
        tips_type: 'MANDATORY'
      };
      
      req.body = {
        restaurant_name: 'Updated Name',
        tax_rate: 20,
        currency: 'USD',
        default_language: 'en',
        default_theme: 'dark',
        tips_state: false,
        tips_type: 'MANDATORY',
        unauthorized_field: 'should_be_ignored'
      };
      
      (restaurantService.updateRestaurant as jest.Mock).mockResolvedValue(mockRestaurant);

      // Act
      await updateRestaurantSettings(req as Request, res as Response, next);

      // Assert
      expect(restaurantService.updateRestaurant).toHaveBeenCalledWith('rest123', {
        restaurant_name: 'Updated Name',
        tax_rate: 20,
        currency: 'USD',
        default_language: 'en',
        default_theme: 'dark',
        tips_state: false,
        tips_type: 'MANDATORY'
      });
      expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({
        message: 'SETTINGS_UPDATED',
        settings: expect.any(Object)
      }));
    });

    it('should filter only allowed fields', async () => {
      // Arrange
      const mockRestaurant = {
        _id: 'rest123',
        restaurant_name: 'Only Name',
        tax_rate: 10
      };
      
      req.body = {
        restaurant_name: 'Only Name',
        tax_rate: 10,
        _id: 'hacked_id',
        password: 'hacked',
        __v: 999
      };
      
      (restaurantService.updateRestaurant as jest.Mock).mockResolvedValue(mockRestaurant);

      // Act
      await updateRestaurantSettings(req as Request, res as Response, next);

      // Assert
      expect(restaurantService.updateRestaurant).toHaveBeenCalledWith('rest123', {
        restaurant_name: 'Only Name',
        tax_rate: 10
      });
    });

    it('should handle partial settings update', async () => {
      // Arrange
      const mockRestaurant = {
        _id: 'rest123',
        restaurant_name: 'Original Name',
        tax_rate: 25
      };
      
      req.body = { tax_rate: 25 };
      
      (restaurantService.updateRestaurant as jest.Mock).mockResolvedValue(mockRestaurant);

      // Act
      await updateRestaurantSettings(req as Request, res as Response, next);

      // Assert
      expect(restaurantService.updateRestaurant).toHaveBeenCalledWith('rest123', {
        tax_rate: 25
      });
    });

    it('should return 404 when restaurant not found', async () => {
      // Arrange
      req.body = { restaurant_name: 'Updated' };
      
      (restaurantService.updateRestaurant as jest.Mock).mockResolvedValue(null);

      // Act
      await updateRestaurantSettings(req as Request, res as Response, next);

      // Assert
      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({ message: 'RESTAURANT_NOT_FOUND' });
    });

    it('should pass error to next when settings update fails', async () => {
      // Arrange
      req.body = { tax_rate: 'invalid' };
      
      const error = new Error('VALIDATION_ERROR');
      (restaurantService.updateRestaurant as jest.Mock).mockRejectedValue(error);

      // Act
      try { await updateRestaurantSettings(req as Request, res as Response, next); } catch {}

      // Assert
      expect(next).toHaveBeenCalled();
    });

    it('should handle zero values correctly', async () => {
      // Arrange
      const mockRestaurant = {
        _id: 'rest123',
        restaurant_name: 'Test',
        tax_rate: 0,
        tips_state: false
      };
      
      req.body = {
        restaurant_name: 'Test',
        tax_rate: 0,
        tips_state: false
      };
      
      (restaurantService.updateRestaurant as jest.Mock).mockResolvedValue(mockRestaurant);

      // Act
      await updateRestaurantSettings(req as Request, res as Response, next);

      // Assert
      expect(restaurantService.updateRestaurant).toHaveBeenCalledWith('rest123', {
        restaurant_name: 'Test',
        tax_rate: 0,
        tips_state: false
      });
    });
  });
});
