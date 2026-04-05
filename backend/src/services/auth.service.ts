import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
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

const userRepo = new UserRepository();
const roleRepo = new RoleRepository();

const JWT_SECRET: string = process.env.JWT_SECRET || '';
const JWT_EXPIRES: string = process.env.JWT_EXPIRES || '8h';

if (!JWT_SECRET) {
  throw new Error(ErrorCode.SERVER_CONFIGURATION_ERROR);
}

interface TokenPayload {
  staffId: string;
  restaurantId: string;
  role: string;
  permissions: string[];
  name: string;
}

interface UserPreferences {
  language: string;
  theme: string;
}

interface AuthResult {
  token: string;
  user: TokenPayload & { preferences: UserPreferences };
}

async function buildAuthResult(
  staff: { 
    _id: { toString(): string }; 
    restaurant_id: { toString(): string }; 
    role_id: { toString(): string }; 
    staff_name: string;
    language?: string;
    theme?: string;
  },
  restaurant: { default_language?: string; default_theme?: string } | null
): Promise<AuthResult> {
  const role = await roleRepo.findById(staff.role_id.toString());
  const permissions = role?.permissions ?? [];

  const payload: TokenPayload = {
    staffId: staff._id.toString(),
    restaurantId: staff.restaurant_id.toString(),
    role: role?.role_name ?? '',
    permissions,
    name: staff.staff_name,
  };

  const preferences: UserPreferences = {
    language: staff.language ?? restaurant?.default_language ?? 'es',
    theme: staff.theme ?? restaurant?.default_theme ?? 'light',
  };

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES } as jwt.SignOptions);
  
  return { token, user: { ...payload, preferences } };
}

export async function loginWithUsername(
  username: string,
  password: string,
  restaurantId?: string
): Promise<AuthResult> {
  // Prefer scoped lookup when restaurant_id is provided (multi-tenant safety)
  const staff = restaurantId
    ? await userRepo.findByUsernameAndRestaurant(username.toLowerCase(), restaurantId)
    : await userRepo.findByUsername(username.toLowerCase());

  if (!staff) {
    throw new Error(ErrorCode.INVALID_CREDENTIALS);
  }

  const isPasswordValid = await bcrypt.compare(password, staff.password_hash);
  if (!isPasswordValid) {
    throw new Error(ErrorCode.INVALID_CREDENTIALS);
  }

  const restaurant = await Restaurant.findById(staff.restaurant_id);
  return buildAuthResult(staff, restaurant);
}

export async function loginWithPin(
  pin: string, 
  restaurantId: string,
  username?: string,
  ipAddress?: string
): Promise<AuthResult> {
  // Build identifier for rate limiting (username + IP if available)
  const identifier = username 
    ? createIdentifier(username.toLowerCase(), ipAddress)
    : createIdentifier(`restaurant:${restaurantId}`, ipAddress);

  // Check if account is locked before attempting validation
  if (isLocked(identifier)) {
    const retryAfter = getRemainingLockTime(identifier);
    const error = new Error(ErrorCode.AUTH_RATE_LIMIT_EXCEEDED);
    (error as Error & { retryAfter: number }).retryAfter = retryAfter;
    throw error;
  }

  const staffMembers = await userRepo.findByRestaurantId(restaurantId);
  const restaurant = await Restaurant.findById(restaurantId);

  for (const staff of staffMembers) {
    const isPinValid = await bcrypt.compare(pin, staff.pin_code_hash);
    if (isPinValid) {
      // Clear failed attempts on successful login
      clearAttempts(identifier);
      return buildAuthResult(staff, restaurant);
    }
  }

  // Record failed attempt
  recordFailedAttempt(identifier);

  throw new Error(ErrorCode.INVALID_PIN);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, 12);
}
