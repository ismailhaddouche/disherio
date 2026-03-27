import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { Restaurant } from '../models/restaurant.model';
import { Role, Staff } from '../models/staff.model';
import { logger } from '../config/logger';

async function seed() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/disherio';
  await mongoose.connect(uri);

  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminPin      = process.env.ADMIN_PIN;
  const appLang       = process.env.APP_LANG       || 'es';

  if (!adminPassword) {
    logger.error('ADMIN_PASSWORD env var is required');
    process.exit(1);
  }
  if (!adminPin) {
    logger.error('ADMIN_PIN env var is required');
    process.exit(1);
  }

  // Create default restaurant
  let restaurant = await Restaurant.findOne({ restaurant_name: 'DisherIo' });
  if (!restaurant) {
    restaurant = await Restaurant.create({
      restaurant_name: 'DisherIo',
      tax_rate: 10,
      currency: 'EUR',
      language: appLang,
    });
  }

  // Create admin role
  let adminRole = await Role.findOne({ restaurant_id: restaurant._id, role_name: 'Admin' });
  if (!adminRole) {
    adminRole = await Role.create({
      restaurant_id: restaurant._id,
      role_name: 'Admin',
      permissions: ['ADMIN'],
    });
  }

  // Create or update admin user
  const existing = await Staff.findOne({ username: adminUsername, restaurant_id: restaurant._id });
  const password_hash  = await bcrypt.hash(adminPassword, 12);
  const pin_code_hash  = await bcrypt.hash(adminPin, 12);

  if (!existing) {
    await Staff.create({
      restaurant_id: restaurant._id,
      role_id: adminRole._id,
      staff_name: 'Administrador',
      username: adminUsername,
      password_hash,
      pin_code_hash,
    });
    logger.info(`Admin user created: ${adminUsername}`);
  } else {
    await Staff.updateOne(
      { _id: existing._id },
      { $set: { password_hash, pin_code_hash } }
    );
    logger.info(`Admin user updated: ${adminUsername}`);
  }

  await mongoose.disconnect();
}

seed().catch((err) => { logger.error(err); process.exit(1); });
