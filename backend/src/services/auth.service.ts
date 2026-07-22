import bcrypt from 'bcryptjs';
import { ErrorCode } from '@disherio/shared';
import { UserRepository, RoleRepository } from '../repositories/user.repository';
import { Restaurant } from '../models/restaurant.model';
import { JwtPayload } from '../middlewares/auth';
import {
  generateAccessToken,
  issueRefreshToken,
} from './refresh-token.service';
import { getEnv } from '../config/env';

const userRepo = new UserRepository();
const roleRepo = new RoleRepository();

export interface UserPreferences {
  language: string;
  theme: string;
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: Omit<JwtPayload, 'authVersion'> & {
    preferences: UserPreferences;
    enabled_languages: string[];
  };
}

interface StaffLike {
  _id: { toString(): string };
  restaurant_id: { toString(): string };
  role_id: { toString(): string; role_name?: string; permissions?: string[] };
  staff_name: string;
  language?: string;
  theme?: string;
  auth_version?: number;
}

async function buildJwtPayload(staff: StaffLike): Promise<JwtPayload> {
  const populatedRole = typeof staff.role_id.role_name === 'string'
    && Array.isArray(staff.role_id.permissions)
    ? staff.role_id
    : null;
  const role = populatedRole ?? await roleRepo.findById(staff.role_id.toString());
  return {
    staffId: staff._id.toString(),
    restaurantId: staff.restaurant_id.toString(),
    role: role?.role_name ?? '',
    permissions: role?.permissions ?? [],
    name: staff.staff_name,
    authVersion: staff.auth_version ?? 0,
  };
}

async function buildAuthResult(
  staff: StaffLike,
  restaurant: { default_language?: string; default_theme?: string; enabled_languages?: string[] } | null
): Promise<AuthResult> {
  const payload = await buildJwtPayload(staff);

  const preferences: UserPreferences = {
    language: staff.language ?? restaurant?.default_language ?? 'es',
    theme: staff.theme ?? restaurant?.default_theme ?? 'light',
  };

  const accessToken = generateAccessToken(payload);
  const refreshToken = await issueRefreshToken(payload);
  const { authVersion: _authVersion, ...publicPayload } = payload;

  return {
    accessToken,
    refreshToken,
    user: {
      ...publicPayload,
      preferences,
      enabled_languages: restaurant?.enabled_languages ?? ['es', 'en', 'fr'],
    },
  };
}

// Pre-computed dummy hash to prevent user enumeration via timing attacks.
// When a username is not found, we still run a bcrypt.compare against this
// dummy so that the response time is roughly the same as a failed login.
const DUMMY_HASH = '$2a$12$kDQqjLl0tAK8h9xgDxiyzexc/juI9ToaCTc7zMTTmRsFjv0xb7lNW';

export async function loginWithUsername(
  username: string,
  password: string,
  restaurantId?: string
): Promise<AuthResult> {
  // Prefer scoped lookup when restaurant_id is provided (multi-tenant safety)
  // When restaurant_id is omitted, reject ambiguous usernames that exist in
  // multiple restaurants to prevent cross-tenant authentication confusion.
  let staff: Awaited<ReturnType<typeof userRepo.findByUsername>> | null = null;

  if (restaurantId) {
    staff = await userRepo.findByUsernameAndRestaurant(username.toLowerCase(), restaurantId);
  } else {
    const matchCount = await userRepo.countByUsername(username.toLowerCase());
    if (matchCount > 1) {
      // Keep login failures indistinguishable to avoid exposing whether a
      // username exists in one or multiple tenants.
      throw new Error(ErrorCode.INVALID_CREDENTIALS);
    }
    staff = await userRepo.findByUsername(username.toLowerCase());
  }

  // Always run bcrypt.compare to prevent timing-based user enumeration.
  // If the user does not exist, compare against a dummy hash.
  const hashToCompare = staff?.password_hash ?? DUMMY_HASH;
  const isPasswordValid = await bcrypt.compare(password, hashToCompare);

  if (!staff || !isPasswordValid) {
    throw new Error(ErrorCode.INVALID_CREDENTIALS);
  }

  const restaurant = await Restaurant.findById(staff.restaurant_id);
  return buildAuthResult(staff, restaurant);
}

/**
 * Re-hydrate a JWT payload from the DB (used during refresh token rotation).
 */
export async function buildPayloadById(staffId: string): Promise<JwtPayload | null> {
  const staff = await userRepo.findByIdWithRole(staffId);
  if (!staff) return null;
  return buildJwtPayload(staff as unknown as StaffLike);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, getEnv().BCRYPT_ROUNDS);
}
