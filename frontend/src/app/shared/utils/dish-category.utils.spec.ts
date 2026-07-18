import { getDishCategoryId } from './dish-category.utils';

describe('getDishCategoryId', () => {
  it('returns a scalar category id', () => {
    expect(getDishCategoryId({ category_id: 'category-1' })).toBe('category-1');
  });

  it('returns the id from a populated category', () => {
    expect(getDishCategoryId({
      category_id: {
        _id: 'category-2',
        restaurant_id: 'restaurant-1',
        category_name: [{ lang: 'en', value: 'Mains' }],
        category_order: 1,
      },
    })).toBe('category-2');
  });
});
