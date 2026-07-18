import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { ErrorCode } from '@disherio/shared';
import { UserRepository, RoleRepository } from '../repositories/user.repository';
import { Restaurant } from '../models/restaurant.model';
import {
  createIdentifier,
  recordFailedAttempt,
  isLocked,
  getRemainingLockTime,
  clearAttempts,
} from './pin-security.service';
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

/**
 * Deterministic lookup key for PIN login: HMAC-SHA256(pin, PIN_LOOKUP_PEPPER).
 * Indexed on the Staff document so authentication costs one query plus a
 * single bcrypt.compare instead of one compare per staff member. The bcrypt
 * hash remains the verifier; the lookup key only narrows the candidate.
 */
export function computePinLookup(pin: string): string {
  return crypto
    .createHmac('sha256', getEnv().PIN_LOOKUP_PEPPER)
    .update(pin)
    .digest('hex');
}

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
      throw new Error(ErrorCode.AMBIGUOUS_USERNAME);
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

export async function loginWithPin(
  pin: string,
  restaurantId: string,
  ipAddress?: string
): Promise<AuthResult> {
  const identifier = createIdentifier(`restaurant:${restaurantId}`, ipAddress);

  // Check if account is locked before attempting validation
  if (await isLocked(identifier)) {
    const retryAfter = await getRemainingLockTime(identifier);
    const error = new Error(ErrorCode.AUTH_RATE_LIMIT_EXCEEDED);
    (error as Error & { retryAfter: number }).retryAfter = retryAfter;
    throw error;
  }

  const restaurant = await Restaurant.findById(restaurantId);
  const pinLookup = computePinLookup(pin);

  // Fast path: indexed lookup, exactly one bcrypt.compare per attempt.
  const candidate = await userRepo.findByPinLookup(restaurantId, pinLookup);
  if (candidate) {
    const isPinValid = await bcrypt.compare(pin, candidate.pin_code_hash);
    if (isPinValid) {
      await clearAttempts(identifier);
      return buildAuthResult(candidate, restaurant);
    }
    // HMAC match with a failing bcrypt compare means a corrupted record or a
    // rotated pepper; count it as a failed attempt below.
  } else {
    // Legacy path for staff documents created before pin_lookup existed
    // (also the path after a pepper rotation). A successful login here
    // re-registers the lookup key so the next attempt uses the fast path.
    const legacyCandidates = await userRepo.findLegacyPinCandidates(restaurantId);
    for (const staff of legacyCandidates) {
      const isPinValid = await bcrypt.compare(pin, staff.pin_code_hash);
      if (isPinValid) {
        await userRepo.setPinLookup(staff._id.toString(), pinLookup);
        await clearAttempts(identifier);
        return buildAuthResult(staff, restaurant);
      }
    }
    // Equalize timing when nothing can match, so an attacker cannot
    // distinguish "no candidate" from "wrong PIN" by response time.
    if (legacyCandidates.length === 0) {
      await bcrypt.compare(pin, DUMMY_HASH);
    }
  }

  // Record failed attempt
  await recordFailedAttempt(identifier);

  throw new Error(ErrorCode.INVALID_PIN);
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

export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, getEnv().BCRYPT_ROUNDS);
}
