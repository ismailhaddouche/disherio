const dishRepo = {
  createDish: jest.fn(),
  delete: jest.fn(),
  findById: jest.fn(),
  findByIdAndRestaurant: jest.fn(),
  updateDish: jest.fn(),
};
const categoryRepo = {
  findByIdAndRestaurant: jest.fn(),
};

jest.mock('../repositories/dish.repository', () => ({
  DishRepository: jest.fn(() => dishRepo),
  CategoryRepository: jest.fn(() => categoryRepo),
}));
jest.mock('../services/cache.service', () => ({
  cache: { delete: jest.fn(), invalidateMenuCache: jest.fn(), invalidateCategoriesCache: jest.fn() },
  CacheKeys: {
    dish: jest.fn((id: string) => id),
    dishesByRestaurant: jest.fn((id: string) => id),
    category: jest.fn((id: string) => id),
    categoriesByRestaurant: jest.fn((id: string) => id),
  },
  CACHE_TTL: { MENU: 1, CATEGORIES: 1 },
  fetchWithCache: jest.fn(),
}));
const mockDeleteImage = jest.fn();
jest.mock('../services/image.service', () => ({ deleteImage: mockDeleteImage }));
// Unit tests run without Redis: execute the locked section directly.
jest.mock('../utils/locks', () => ({
  withLock: (_key: string, fn: () => Promise<unknown>) => fn(),
}));

import { createDish, deleteDish, updateDish } from '../services/dish.service';

const RESTAURANT_ID = '507f1f77bcf86cd799439011';
const DISH_ID = '507f1f77bcf86cd799439012';
const CATEGORY_ID = '507f1f77bcf86cd799439013';
const dishInput = {
  restaurant_id: RESTAURANT_ID,
  category_id: CATEGORY_ID,
  disher_name: [{ lang: 'en' as const, value: 'Soup' }],
  disher_price: 8,
  disher_type: 'KITCHEN' as const,
  disher_status: 'ACTIVATED' as const,
  disher_alergens: [],
  disher_variant: false,
  variants: [],
  extras: [],
};

describe('dish category tenant enforcement', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects creation when the category is outside the restaurant', async () => {
    categoryRepo.findByIdAndRestaurant.mockResolvedValue(null);

    await expect(createDish(dishInput)).rejects.toThrow('CATEGORY_NOT_FOUND');

    expect(categoryRepo.findByIdAndRestaurant).toHaveBeenCalledWith(CATEGORY_ID, RESTAURANT_ID);
    expect(dishRepo.createDish).not.toHaveBeenCalled();
  });

  it('rejects a category change outside the dish restaurant', async () => {
    dishRepo.findByIdAndRestaurant.mockResolvedValue({
      _id: DISH_ID,
      restaurant_id: { toString: () => RESTAURANT_ID },
    });
    categoryRepo.findByIdAndRestaurant.mockResolvedValue(null);

    await expect(updateDish(DISH_ID, RESTAURANT_ID, { category_id: CATEGORY_ID }))
      .rejects.toThrow('CATEGORY_NOT_FOUND');

    expect(dishRepo.updateDish).not.toHaveBeenCalled();
  });

  it('preserves the image when deleting the database record fails', async () => {
    dishRepo.findById.mockResolvedValue({
      _id: DISH_ID,
      restaurant_id: { toString: () => RESTAURANT_ID },
      disher_url_image: '/uploads/dishes/soup.webp',
    });
    dishRepo.delete.mockRejectedValue(new Error('database unavailable'));

    await expect(deleteDish(DISH_ID)).rejects.toThrow('database unavailable');
    expect(mockDeleteImage).not.toHaveBeenCalled();
  });
});
