import { Types } from 'mongoose';
import { ErrorCode } from '@disherio/shared';
import { UserRepository, RoleRepository } from '../repositories/user.repository';
import { hashPassword } from './auth.service';
import { createError } from '../utils/async-handler';
import { getPaginationParams, createPaginatedResponse, PaginatedResponse } from '../utils/pagination';
import { IRole } from '../models/staff.model';
import { Request } from 'express';
import { revokeAllUserRefreshTokens } from './refresh-token.service';
import { disconnectStaffSockets } from './socket-session.service';
import { withLock } from '../utils/locks';

const userRepo = new UserRepository();
const roleRepo = new RoleRepository();

/**
 * Throws NOT_FOUND if the role does not belong to the restaurant, and
 * FORBIDDEN if the caller cannot grant the role's permissions.
 */
async function assertRoleInRestaurant(
  roleId: string,
  restaurantId: string,
  callerPermissions?: string[]
): Promise<IRole> {
  const role = await roleRepo.findByIdAndRestaurant(roleId, restaurantId);
  if (!role) {
    throw createError.notFound(ErrorCode.ROLE_NOT_FOUND);
  }
  if (callerPermissions) {
    assertCanGrantPermissions(callerPermissions, role.permissions);
  }
  return role;
}

/**
 * Verify the caller can grant the requested permission set. A caller with
 * ADMIN can grant anything; otherwise every requested permission must be in
 * the caller's own permissions. Throws FORBIDDEN otherwise.
 */
function assertCanGrantPermissions(
  callerPermissions: string[],
  requestedPermissions: string[]
): void {
  if (callerPermissions.includes('ADMIN')) return;
  const ungranted = requestedPermissions.filter((p) => !callerPermissions.includes(p));
  if (ungranted.length > 0) {
    throw createError.forbidden('FORBIDDEN');
  }
}

/**
 * Throws CONFLICT if username already exists in the restaurant (excluding a staff id when updating).
 */
async function assertUsernameUnique(username: string, restaurantId: string, excludeStaffId?: string): Promise<void> {
  const normalized = username.toLowerCase().trim();
  const filter: { username: string; restaurant_id: Types.ObjectId; _id?: { $ne: Types.ObjectId } } = {
    username: normalized,
    restaurant_id: new Types.ObjectId(restaurantId),
  };
  if (excludeStaffId) {
    filter._id = { $ne: new Types.ObjectId(excludeStaffId) };
  }
  const exists = await userRepo.exists(filter);
  if (exists) {
    throw createError.conflict('USER_ALREADY_EXISTS');
  }
}

function rethrowDuplicateCredential(error: unknown): never {
  if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
    throw createError.conflict(ErrorCode.DUPLICATE_RESOURCE);
  }
  throw error;
}

/**
 * List staff for a restaurant with pagination. Returns public profile (no hashes).
 */
export async function listStaff(restaurantId: string, req: Request): Promise<PaginatedResponse<unknown>> {
  const { page, limit, skip } = getPaginationParams(req);
  const filter = { restaurant_id: new Types.ObjectId(restaurantId) };
  const [staff, total] = await Promise.all([
    userRepo.findByRestaurantPaginated(restaurantId, skip, limit),
    userRepo.count(filter),
  ]);
  return createPaginatedResponse(staff, total, page, limit);
}

/**
 * Get a single staff member by id, scoped to the restaurant. Throws NOT_FOUND if missing.
 */
export async function getStaff(id: string, restaurantId: string): Promise<unknown> {
  const staff = await userRepo.findByIdAndRestaurantLean(id, restaurantId);
  if (!staff) {
    throw createError.notFound('STAFF_NOT_FOUND');
  }
  return staff;
}

export interface CreateStaffInput {
  staff_name: string;
  username: string;
  password: string;
  role_id: string;
}

/**
 * Create a staff member: validates role scope, username uniqueness, hashes credentials.
 */
export async function createStaff(
  restaurantId: string,
  input: CreateStaffInput,
  callerPermissions: string[]
): Promise<unknown> {
  const normalizedUsername = input.username.toLowerCase().trim();

  await assertRoleInRestaurant(input.role_id, restaurantId, callerPermissions);
  await assertUsernameUnique(normalizedUsername, restaurantId);

  const password_hash = await hashPassword(input.password);

  let staff;
  try {
    staff = await userRepo.createUser({
      restaurant_id: restaurantId,
      role_id: input.role_id,
      staff_name: input.staff_name,
      username: normalizedUsername,
      password_hash,
    });
  } catch (error) {
    rethrowDuplicateCredential(error);
  }

  return userRepo.findProfileById(staff._id.toString());
}

export interface UpdateStaffInput {
  staff_name?: string;
  username?: string;
  role_id?: string;
  password?: string;
}

/**
 * Update a staff member scoped to a restaurant. Handles username uniqueness (excluding self),
 * role scope validation, and conditional credential hashing.
 */
export async function updateStaff(
  id: string,
  restaurantId: string,
  input: UpdateStaffInput,
  callerPermissions: string[]
): Promise<unknown> {
  const staff = await userRepo.findByIdAndRestaurant(id, restaurantId);
  if (!staff) {
    throw createError.notFound('STAFF_NOT_FOUND');
  }

  if (input.username && input.username.toLowerCase().trim() !== staff.username) {
    const normalizedUsername = input.username.toLowerCase().trim();
    await assertUsernameUnique(normalizedUsername, restaurantId, id);
    staff.username = normalizedUsername;
  }

  if (input.staff_name) staff.staff_name = input.staff_name;

  if (input.role_id) {
    await assertRoleInRestaurant(input.role_id, restaurantId, callerPermissions);
    staff.role_id = new Types.ObjectId(input.role_id);
  }

  if (input.password) {
    staff.password_hash = await hashPassword(input.password);
  }

  const authorizationChanged = input.role_id !== undefined
    || input.username !== undefined
    || input.password !== undefined;
  if (authorizationChanged) {
    staff.auth_version = (staff.auth_version ?? 0) + 1;
  }

  try {
    await staff.save();
  } catch (error) {
    rethrowDuplicateCredential(error);
  }
  if (authorizationChanged) {
    await Promise.all([
      revokeAllUserRefreshTokens(id),
      disconnectStaffSockets(id),
    ]);
  }

  return userRepo.findProfileById(staff._id.toString());
}

/**
 * Delete a staff member scoped to a restaurant. Throws NOT_FOUND if missing,
 * FORBIDDEN on self-deletion, and LAST_ADMIN when the target is the last
 * user holding ADMIN permission in the restaurant.
 *
 * The last-admin check and the delete run under a per-restaurant distributed
 * lock: a Mongo transaction alone would not help here, because two concurrent
 * transactions can both count "another admin exists" before either commits
 * (snapshot isolation). Serializing the check+delete critical section makes
 * the second deletion observe the first and refuse with LAST_ADMIN.
 */
export async function deleteStaff(id: string, restaurantId: string, callerStaffId: string): Promise<void> {
  // A staff member cannot delete their own account.
  if (id === callerStaffId) {
    throw createError.forbidden(ErrorCode.FORBIDDEN);
  }

  const staff = await userRepo.findByIdAndRestaurant(id, restaurantId);
  if (!staff) {
    throw createError.notFound('STAFF_NOT_FOUND');
  }

  await withLock(`staff-delete:${restaurantId}`, async () => {
    // Protect the last ADMIN: deleting them would leave the restaurant
    // without any administrator.
    const role = await roleRepo.findById(staff.role_id.toString());
    if (role?.permissions.includes('ADMIN')) {
      const restaurantRoles = await roleRepo.findByRestaurantId(restaurantId);
      const adminRoleIds = restaurantRoles
        .filter((candidate) => candidate.permissions.includes('ADMIN'))
        .map((candidate) => candidate._id as Types.ObjectId);
      const otherAdmins = await userRepo.countByRoleIds(restaurantId, adminRoleIds, id);
      if (otherAdmins === 0) {
        throw createError.conflict(ErrorCode.LAST_ADMIN);
      }
    }

    await userRepo.findByIdAndRestaurantAndDelete(id, restaurantId);
  });

  await Promise.all([
    revokeAllUserRefreshTokens(id),
    disconnectStaffSockets(id),
  ]);
}

/**
 * List roles available to a restaurant (its own + system defaults).
 */
export async function listRoles(restaurantId: string): Promise<IRole[]> {
  return roleRepo.findAvailableForRestaurant(restaurantId);
}

export interface CreateRoleInput {
  role_name: string;
  permissions?: string[];
}

/**
 * Valid permission groups recognized by the system.
 */
const VALID_PERMISSIONS: ReadonlyArray<string> = ['ADMIN', 'POS', 'TAS', 'KTS'];

/**
 * Create a role for a restaurant.
 * The caller cannot grant permissions they do not themselves hold, and
 * only recognized permission strings are accepted.
 */
export async function createRole(
  restaurantId: string,
  input: CreateRoleInput,
  callerPermissions: string[]
): Promise<IRole> {
  const requested = input.permissions ?? [];
  const invalid = requested.filter((p) => !VALID_PERMISSIONS.includes(p));
  if (invalid.length > 0) {
    throw createError.badRequest(ErrorCode.VALIDATION_ERROR);
  }
  assertCanGrantPermissions(callerPermissions, requested);
  return roleRepo.createRole({
    restaurant_id: restaurantId,
    role_name: input.role_name,
    permissions: requested,
  });
}

export type UpdatePreferencesInput = {
  language?: 'es' | 'en' | 'fr';
  theme?: 'light' | 'dark';
};

/**
 * Update the authenticated user's own preferences (language/theme).
 */
export async function updateMyPreferences(staffId: string, input: UpdatePreferencesInput): Promise<{ language: string | null; theme: string | null }> {
  const staff = await userRepo.findById(staffId);
  if (!staff) {
    throw createError.notFound('USER_NOT_FOUND');
  }

  if (input.language) {
    staff.language = input.language;
  }
  if (input.theme) {
    staff.theme = input.theme;
  }

  await staff.save();

  return {
    language: staff.language ?? null,
    theme: staff.theme ?? null,
  };
}

/**
 * Get the authenticated user's own profile (no hashes).
 */
export async function getMyProfile(staffId: string): Promise<unknown> {
  const staff = await userRepo.findProfileById(staffId);
  if (!staff) {
    throw createError.notFound('USER_NOT_FOUND');
  }
  return staff;
}
