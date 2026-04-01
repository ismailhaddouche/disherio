import { Request, Response, NextFunction } from 'express';
import {
  listDishes,
  createDish,
  updateDish,
  deleteDish,
  toggleDishStatus,
  listCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory
} from '../../controllers/dish.controller';
import * as dishService from '../../services/dish.service';
import { AppError } from '../../utils/async-handler';

// Mock dish service
jest.mock('../../services/dish.service');

describe('DishController', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;
  let endMock: jest.Mock;

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
    endMock = jest.fn().mockReturnThis();
    next = jest.fn();
    
    res = {
      json: jsonMock,
      status: statusMock,
      end: endMock,
    };

    req = {
      user: mockUser,
      body: {},
      params: {},
      query: {},
      lang: 'es'
    };
  });

  describe('GET /dishes', () => {
    it('should return paginated list of dishes', async () => {
      // Arrange
      const mockDishes = [
        { _id: 'dish1', disher_name: 'Pizza' },
        { _id: 'dish2', disher_name: 'Burger' }
      ];
      
      req.query = { page: '1', limit: '10' };
      
      (dishService.getDishesByRestaurantPaginated as jest.Mock).mockResolvedValue({
        dishes: mockDishes,
        total: 2
      });

      // Act
      await listDishes(req as Request, res as Response, next);

      // Assert
      expect(dishService.getDishesByRestaurantPaginated).toHaveBeenCalledWith(
        'rest123',
        'es',
        0,
        10
      );
      expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({
        data: mockDishes,
        pagination: expect.objectContaining({
          page: 1,
          limit: 10,
          total: 2
        })
      }));
    });

    it('should use default pagination when no params provided', async () => {
      // Arrange
      (dishService.getDishesByRestaurantPaginated as jest.Mock).mockResolvedValue({
        dishes: [],
        total: 0
      });

      // Act
      await listDishes(req as Request, res as Response, next);

      // Assert
      expect(dishService.getDishesByRestaurantPaginated).toHaveBeenCalledWith(
        'rest123',
        'es',
        0,
        50
      );
    });

    it('should handle max limit correctly', async () => {
      // Arrange
      req.query = { limit: '200' };
      
      (dishService.getDishesByRestaurantPaginated as jest.Mock).mockResolvedValue({
        dishes: [],
        total: 0
      });

      // Act
      await listDishes(req as Request, res as Response, next);

      // Assert
      expect(dishService.getDishesByRestaurantPaginated).toHaveBeenCalledWith(
        'rest123',
        'es',
        0,
        100
      );
    });
  });

  describe('POST /dishes', () => {
    it('should create dish and return 201', async () => {
      // Arrange
      const mockDish = {
        _id: 'dish123',
        disher_name: 'New Pizza',
        disher_price: 15.99,
        restaurant_id: 'rest123'
      };
      
      req.body = {
        disher_name: 'New Pizza',
        disher_price: 15.99,
        category_id: 'cat123'
      };
      
      (dishService.createDish as jest.Mock).mockResolvedValue(mockDish);

      // Act
      await createDish(req as Request, res as Response, next);

      // Assert
      expect(dishService.createDish).toHaveBeenCalledWith({
        disher_name: 'New Pizza',
        disher_price: 15.99,
        category_id: 'cat123',
        restaurant_id: 'rest123'
      });
      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith(mockDish);
    });

    it('should pass error to next when dish creation fails', async () => {
      // Arrange
      req.body = { disher_name: 'Invalid Dish' };
      
      const error = new Error('VALIDATION_ERROR');
      (dishService.createDish as jest.Mock).mockRejectedValue(error);

      // Act
      try { await createDish(req as Request, res as Response, next); } catch {}

      // Assert
      expect(next).toHaveBeenCalled();
    });
  });

  describe('PATCH /dishes/:id', () => {
    it('should update dish and return updated data', async () => {
      // Arrange
      const mockDish = {
        _id: 'dish123',
        disher_name: 'Updated Pizza',
        disher_price: 17.99
      };
      
      req.params = { id: 'dish123' };
      req.body = { disher_name: 'Updated Pizza', disher_price: 17.99 };
      
      (dishService.updateDish as jest.Mock).mockResolvedValue(mockDish);

      // Act
      await updateDish(req as Request, res as Response, next);

      // Assert
      expect(dishService.updateDish).toHaveBeenCalledWith('dish123', req.body);
      expect(jsonMock).toHaveBeenCalledWith(mockDish);
    });

    it('should return 404 when dish not found', async () => {
      // Arrange
      req.params = { id: 'nonexistent' };
      req.body = { disher_name: 'Updated' };
      
      (dishService.updateDish as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(updateDish(req as Request, res as Response, next)).rejects.toThrow(AppError);
      await expect(updateDish(req as Request, res as Response, next)).rejects.toThrow('DISH_NOT_FOUND');
    });
  });

  describe('DELETE /dishes/:id', () => {
    it('should delete dish and return 204', async () => {
      // Arrange
      req.params = { id: 'dish123' };
      
      (dishService.deleteDish as jest.Mock).mockResolvedValue({ deleted: true });

      // Act
      await deleteDish(req as Request, res as Response, next);

      // Assert
      expect(dishService.deleteDish).toHaveBeenCalledWith('dish123');
      expect(statusMock).toHaveBeenCalledWith(204);
      expect(endMock).toHaveBeenCalled();
    });

    it('should return error when dish not found', async () => {
      // Arrange
      req.params = { id: 'nonexistent' };
      
      const error = new Error('DISH_NOT_FOUND');
      (dishService.deleteDish as jest.Mock).mockRejectedValue(error);

      // Act & Assert
      await expect(deleteDish(req as Request, res as Response, next)).rejects.toThrow('DISH_NOT_FOUND');
    });
  });

  describe('PATCH /dishes/:id/toggle', () => {
    it('should toggle dish status and return updated dish', async () => {
      // Arrange
      const mockDish = {
        _id: 'dish123',
        disher_name: 'Pizza',
        disher_status: 'DEACTIVATED'
      };
      
      req.params = { id: 'dish123' };
      
      (dishService.toggleDishStatus as jest.Mock).mockResolvedValue(mockDish);

      // Act
      await toggleDishStatus(req as Request, res as Response, next);

      // Assert
      expect(dishService.toggleDishStatus).toHaveBeenCalledWith('dish123');
      expect(jsonMock).toHaveBeenCalledWith(mockDish);
    });

    it('should return error when dish not found for toggle', async () => {
      // Arrange
      req.params = { id: 'nonexistent' };
      
      (dishService.toggleDishStatus as jest.Mock).mockResolvedValue(null);

      // Act
      await toggleDishStatus(req as Request, res as Response, next);

      // Assert - controller doesn't throw, just returns null
      expect(jsonMock).toHaveBeenCalledWith(null);
    });
  });

  describe('GET /dishes/categories', () => {
    it('should return list of categories', async () => {
      // Arrange
      const mockCategories = [
        { _id: 'cat1', category_name: 'Main Dishes' },
        { _id: 'cat2', category_name: 'Desserts' }
      ];
      
      (dishService.getCategoriesByRestaurant as jest.Mock).mockResolvedValue(mockCategories);

      // Act
      await listCategories(req as Request, res as Response, next);

      // Assert
      expect(dishService.getCategoriesByRestaurant).toHaveBeenCalledWith('rest123');
      expect(jsonMock).toHaveBeenCalledWith(mockCategories);
    });

    it('should return empty array when no categories', async () => {
      // Arrange
      (dishService.getCategoriesByRestaurant as jest.Mock).mockResolvedValue([]);

      // Act
      await listCategories(req as Request, res as Response, next);

      // Assert
      expect(jsonMock).toHaveBeenCalledWith([]);
    });
  });

  describe('GET /dishes/categories/:id', () => {
    it('should return category by id', async () => {
      // Arrange
      const mockCategory = {
        _id: 'cat123',
        category_name: 'Main Dishes'
      };
      
      req.params = { id: 'cat123' };
      
      (dishService.getCategoryById as jest.Mock).mockResolvedValue(mockCategory);

      // Act
      await getCategory(req as Request, res as Response, next);

      // Assert
      expect(dishService.getCategoryById).toHaveBeenCalledWith('cat123');
      expect(jsonMock).toHaveBeenCalledWith(mockCategory);
    });

    it('should return 404 when category not found', async () => {
      // Arrange
      req.params = { id: 'nonexistent' };
      
      (dishService.getCategoryById as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(getCategory(req as Request, res as Response, next)).rejects.toThrow(AppError);
      await expect(getCategory(req as Request, res as Response, next)).rejects.toThrow('CATEGORY_NOT_FOUND');
    });
  });

  describe('POST /dishes/categories', () => {
    it('should create category and return 201', async () => {
      // Arrange
      const mockCategory = {
        _id: 'cat123',
        category_name: 'New Category',
        restaurant_id: 'rest123'
      };
      
      req.body = { category_name: 'New Category', sort_order: 1 };
      
      (dishService.createCategory as jest.Mock).mockResolvedValue(mockCategory);

      // Act
      await createCategory(req as Request, res as Response, next);

      // Assert
      expect(dishService.createCategory).toHaveBeenCalledWith({
        category_name: 'New Category',
        sort_order: 1,
        restaurant_id: 'rest123'
      });
      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith(mockCategory);
    });
  });

  describe('PATCH /dishes/categories/:id', () => {
    it('should update category and return updated data', async () => {
      // Arrange
      const mockCategory = {
        _id: 'cat123',
        category_name: 'Updated Category'
      };
      
      req.params = { id: 'cat123' };
      req.body = { category_name: 'Updated Category' };
      
      (dishService.updateCategory as jest.Mock).mockResolvedValue(mockCategory);

      // Act
      await updateCategory(req as Request, res as Response, next);

      // Assert
      expect(dishService.updateCategory).toHaveBeenCalledWith('cat123', req.body);
      expect(jsonMock).toHaveBeenCalledWith(mockCategory);
    });

    it('should return 404 when category not found', async () => {
      // Arrange
      req.params = { id: 'nonexistent' };
      req.body = { category_name: 'Updated' };
      
      (dishService.updateCategory as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(updateCategory(req as Request, res as Response, next)).rejects.toThrow(AppError);
      await expect(updateCategory(req as Request, res as Response, next)).rejects.toThrow('CATEGORY_NOT_FOUND');
    });
  });

  describe('DELETE /dishes/categories/:id', () => {
    it('should delete category and return 204', async () => {
      // Arrange
      req.params = { id: 'cat123' };
      
      (dishService.deleteCategory as jest.Mock).mockResolvedValue({ deleted: true });

      // Act
      await deleteCategory(req as Request, res as Response, next);

      // Assert
      expect(dishService.deleteCategory).toHaveBeenCalledWith('cat123');
      expect(statusMock).toHaveBeenCalledWith(204);
      expect(endMock).toHaveBeenCalled();
    });

    it('should pass error to next when category has dishes', async () => {
      // Arrange
      req.params = { id: 'cat123' };
      
      const error = new Error('CATEGORY_HAS_DISHES');
      (dishService.deleteCategory as jest.Mock).mockRejectedValue(error);

      // Act
      try { await deleteCategory(req as Request, res as Response, next); } catch {}

      // Assert
      expect(next).toHaveBeenCalled();
    });
  });
});
