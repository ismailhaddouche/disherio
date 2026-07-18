import type { Dish } from '../../types';

export function getDishCategoryId(dish: Pick<Dish, 'category_id'>): string {
  return typeof dish.category_id === 'string'
    ? dish.category_id
    : dish.category_id._id ?? '';
}
