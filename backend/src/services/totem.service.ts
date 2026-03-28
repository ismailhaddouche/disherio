import crypto from 'crypto';
import { TotemRepository, TotemSessionRepository } from '../repositories/totem.repository';
import { ITotem, ITotemSession } from '../models/totem.model';
import { CreateTotemData, UpdateTotemData } from '@disherio/shared';

// Repository instances
const totemRepo = new TotemRepository();
const totemSessionRepo = new TotemSessionRepository();

export async function getTotemByQR(qrToken: string): Promise<ITotem | null> {
  return totemRepo.findByQR(qrToken);
}

export async function getTotemById(totemId: string): Promise<ITotem | null> {
  return totemRepo.findById(totemId);
}

export async function startSession(totemId: string): Promise<ITotemSession | null> {
  const existing = await totemSessionRepo.findActiveByTotemId(totemId);
  if (existing) return existing;
  return totemSessionRepo.createSession(totemId);
}

export async function closeSession(sessionId: string): Promise<ITotemSession | null> {
  return totemSessionRepo.updateState(sessionId, 'COMPLETE');
}

export async function createTotem(data: CreateTotemData): Promise<ITotem> {
  const qr = crypto.randomUUID();
  // CreateTotem expects restaurant_id as string and converts internally
  return totemRepo.createTotem({ 
    restaurant_id: data.restaurant_id,
    totem_name: data.totem_name,
    totem_type: data.totem_type,
    totem_qr: qr 
  } as Parameters<typeof totemRepo.createTotem>[0]);
}

export async function updateTotem(totemId: string, data: UpdateTotemData): Promise<ITotem | null> {
  return totemRepo.updateTotem(totemId, data);
}

export async function regenerateQr(totemId: string): Promise<string> {
  const newQr = crypto.randomUUID();
  await totemRepo.updateTotem(totemId, { totem_qr: newQr });
  return newQr;
}

export async function getTotemsByRestaurant(restaurantId: string): Promise<ITotem[]> {
  return totemRepo.findByRestaurantId(restaurantId);
}

export async function deleteTotem(totemId: string): Promise<ITotem | null> {
  // BUG-10: deleting a totem left active sessions orphaned.
  // We should at least mark them as complete or remove them.
  const sessions = await totemSessionRepo.findByTotemId(totemId);
  for (const session of sessions) {
    await totemSessionRepo.updateState(session._id.toString(), 'COMPLETE');
  }
  return totemRepo.deleteTotem(totemId);
}

export async function getActiveSessionsByRestaurant(restaurantId: string): Promise<unknown[]> {
  return totemSessionRepo.findActiveByRestaurantId(restaurantId);
}
