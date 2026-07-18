import {
  CustomerRepository,
  DishRepository,
  ItemOrderRepository,
  OrderRepository,
  PaymentRepository,
  RestaurantRepository,
  TotemRepository,
  TotemSessionRepository,
} from '../repositories';

export const orderRepositories = {
  customers: new CustomerRepository(),
  dishes: new DishRepository(),
  items: new ItemOrderRepository(),
  orders: new OrderRepository(),
  payments: new PaymentRepository(),
  restaurants: new RestaurantRepository(),
  totems: new TotemRepository(),
  sessions: new TotemSessionRepository(),
};
