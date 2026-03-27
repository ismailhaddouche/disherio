import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { UserRepository, RoleRepository } from '../repositories/user.repository';

// Repository instances
const userRepo = new UserRepository();
const roleRepo = new RoleRepository();

const JWT_SECRET: string = process.env.JWT_SECRET || '';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '8h';

// SEC-01: JWT_SECRET must be defined - no fallback
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

export async function loginWithUsername(username: string, password: string) {
  const staff = await userRepo.findByUsername(username.toLowerCase());
  if (!staff) throw new Error('INVALID_CREDENTIALS');

  const match = await bcrypt.compare(password, staff.password_hash);
  if (!match) throw new Error('INVALID_CREDENTIALS');

  const role = await roleRepo.findById(staff.role_id.toString());
  const permissions = role?.permissions || [];

  const payload = {
    staffId: staff._id.toString(),
    restaurantId: staff.restaurant_id.toString(),
    role: role?.role_name || '',
    permissions,
    name: staff.staff_name,
  };

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
  return { token, user: payload };
}

export async function loginWithPin(pin: string, restaurantId: string) {
  // Find staff by restaurant only - PIN is hashed, can't query directly
  const staffMembers = await userRepo.findByRestaurantId(restaurantId);

  // Compare PIN with bcrypt for each staff member
  for (const staff of staffMembers) {
    const pinMatch = await bcrypt.compare(pin, staff.pin_code_hash);
    if (pinMatch) {
      const role = await roleRepo.findById(staff.role_id.toString());
      const permissions = role?.permissions || [];

      const payload = {
        staffId: staff._id.toString(),
        restaurantId: staff.restaurant_id.toString(),
        role: role?.role_name || '',
        permissions,
        name: staff.staff_name,
      };

      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
      return { token, user: payload };
    }
  }

  throw new Error('INVALID_PIN');
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, 12);
}
