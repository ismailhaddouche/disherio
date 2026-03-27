import crypto from 'crypto';
import { TotemRepository, TotemSessionRepository } from '../repositories/totem.repository';

// Repository instances
const totemRepo = new TotemRepository();
const totemSessionRepo = new TotemSessionRepository();

export async function getTotemByQR(qrToken: string) {
  return totemRepo.findByQR(qrToken);
}

export async function getTotemById(totemId: string) {
  return totemRepo.findById(totemId);
}

export async function startSession(totemId: string) {
  const existing = await totemSessionRepo.findActiveByTotemId(totemId);
  if (existing) return existing;
  return totemSessionRepo.createSession(totemId);
}

export async function closeSession(sessionId: string) {
  return totemSessionRepo.updateState(sessionId, 'COMPLETE');
}

export async function createTotem(data: any) {
  const qr = crypto.randomUUID();
  return totemRepo.createTotem({ ...data, totem_qr: qr });
}

export async function updateTotem(totemId: string, data: any) {
  return totemRepo.updateTotem(totemId, data);
}

export async function regenerateQr(totemId: string) {
  const newQr = crypto.randomUUID();
  await totemRepo.updateTotem(totemId, { totem_qr: newQr });
  return newQr;
}

export async function getTotemsByRestaurant(restaurantId: string) {
  return totemRepo.findByRestaurantId(restaurantId);
}

export async function deleteTotem(totemId: string) {
  // BUG-10: deleting a totem left active sessions orphaned.
  // We should at least mark them as complete or remove them.
  const sessions = await totemSessionRepo.findByTotemId(totemId);
  for (const session of sessions) {
    await totemSessionRepo.updateState(session._id.toString(), 'COMPLETE');
  }
  return totemRepo.deleteTotem(totemId);
}

export async function getActiveSessionsByRestaurant(restaurantId: string) {
  return totemSessionRepo.findActiveByRestaurantId(restaurantId);
}
