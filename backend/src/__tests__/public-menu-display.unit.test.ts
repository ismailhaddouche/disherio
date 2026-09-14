import type { Request, Response } from 'express';
import { getMenuDishes } from '../controllers/totem.controller';
import * as TotemService from '../services/totem.service';
import * as DishService from '../services/dish.service';
import * as RestaurantService from '../services/restaurant.service';

jest.mock('../services/totem.service');
jest.mock('../services/dish.service');
jest.mock('../services/restaurant.service');
jest.mock('../services/order.service');
jest.mock('../services/order-ownership.service');
jest.mock('../services/order-request-policy.service');
jest.mock('../services/public-order.service');
jest.mock('../services/session-lifecycle-effects.service');
jest.mock('../sockets/totem.handler', () => ({ cancelPendingSessionClose: jest.fn() }));

describe('Public menu display contract', () => {
  it('returns currency and languages without exposing other restaurant settings', async () => {
    (TotemService.getTotemByQR as jest.Mock).mockResolvedValue({ restaurant_id: 'restaurant' });
    (DishService.getCategoriesByRestaurant as jest.Mock).mockResolvedValue([]);
    (DishService.getDishesByRestaurant as jest.Mock).mockResolvedValue([]);
    (RestaurantService.getRestaurantById as jest.Mock).mockResolvedValue({
      currency: 'USD', default_language: 'en', enabled_languages: ['en', 'es'],
      restaurant_name: 'Private settings', tax_rate: 10,
    });
    const json = jest.fn();
    const next = jest.fn();
    await getMenuDishes({ params: { qr: 'review' } } as unknown as Request, { json } as unknown as Response, next);
    expect(next).not.toHaveBeenCalled();
    expect(json).toHaveBeenCalledWith({ categories: [], dishes: [], restaurant: {
      currency: 'USD', default_language: 'en', enabled_languages: ['en', 'es'],
    } });
  });
});
