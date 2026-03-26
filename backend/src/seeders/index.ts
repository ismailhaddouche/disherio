import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { Restaurant } from '../models/restaurant.model';
import { Role, Staff } from '../models/staff.model';
import { logger } from '../config/logger';

async function seed() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/disherio';
  await mongoose.connect(uri);
  logger.info('Connected for seeding');

  // Create default restaurant
  let restaurant = await Restaurant.findOne({ restaurant_name: 'DisherIo Demo' });
  if (!restaurant) {
    restaurant = await Restaurant.create({
      restaurant_name: 'DisherIo Demo',
      tax_rate: 10,
      currency: 'EUR',
      language: 'es',
    });
    logger.info('Restaurant created');
  }

  // Create admin role
  let adminRole = await Role.findOne({ restaurant_id: restaurant._id, role_name: 'Admin' });
  if (!adminRole) {
    adminRole = await Role.create({
      restaurant_id: restaurant._id,
      role_name: 'Admin',
      permissions: ['ADMIN'],
    });
    logger.info('Admin role created');
  }

  // Create admin user
  const existing = await Staff.findOne({ email: 'admin@disherio.com' });
  if (!existing) {
    const password = 'admin1234';
    const password_hash = await bcrypt.hash(password, 12);
    const pin_code_hash = await bcrypt.hash('0000', 12);
    
    await Staff.create({
      restaurant_id: restaurant._id,
      role_id: adminRole._id,
      staff_name: 'Admin',
      email: 'admin@disherio.com',
      password_hash,
      pin_code_hash,
    });
    
    // IMPORTANT: Log credentials for first login
    logger.info('========================================');
    logger.info('ADMIN USER CREATED');
    logger.info('Email: admin@disherio.com');
    logger.info('Password: ' + password);
    logger.info('========================================');
  } else {
    logger.info('Admin user already exists');
    logger.info('Email: admin@disherio.com');
    logger.info('If you forgot the password, run: npm run seed:reset');
  }

  await mongoose.disconnect();
  logger.info('Seeding complete');
}

seed().catch((err) => { logger.error(err); process.exit(1); });
