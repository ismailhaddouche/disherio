import { CustomerRepository } from '../repositories/totem.repository';
import { ISessionCustomer } from '../models/totem.model';
import * as OrderOwnershipService from './order-ownership.service';
import * as TotemService from './totem.service';
import { createError } from '../utils/async-handler';

const customerRepo = new CustomerRepository();

export async function listSessionCustomers(
  sessionId: string,
  restaurantId: string
): Promise<ISessionCustomer[]> {
  await OrderOwnershipService.assertSessionInRestaurant(sessionId, restaurantId);
  return customerRepo.findBySessionId(sessionId);
}

export async function createCustomer(
  sessionId: string,
  customerName: string,
  restaurantId: string
): Promise<ISessionCustomer> {
  await OrderOwnershipService.assertSessionInRestaurant(sessionId, restaurantId);
  return TotemService.createCustomerForActiveSession(sessionId, customerName);
}

export async function deleteCustomer(customerId: string, restaurantId: string): Promise<void> {
  const existingCustomer = await customerRepo.findById(customerId);
  if (!existingCustomer) {
    throw createError.notFound('CUSTOMER_NOT_FOUND');
  }
  await OrderOwnershipService.assertSessionInRestaurant(
    existingCustomer.session_id.toString(),
    restaurantId
  );
  const customer = await customerRepo.deleteCustomer(customerId);
  if (!customer) {
    throw createError.notFound('CUSTOMER_NOT_FOUND');
  }
}
