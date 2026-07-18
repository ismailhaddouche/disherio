import 'dotenv/config';
import mongoose from 'mongoose';
import { Restaurant } from '../models/restaurant.model';
import { Role, Staff } from '../models/staff.model';
import { logger } from '../config/logger';
import { hashPassword, hashPin, computePinLookup } from '../services/auth.service';
import { getEnv } from '../config/env';

async function seed() {
  const uri = getEnv().MONGODB_URI;

  logger.info('DisherIO seeder starting...');

  try {
    await mongoose.connect(uri);
    logger.info('Connected to MongoDB');

    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminPassword = process.env.ADMIN_PASSWORD;
    const adminPin      = process.env.ADMIN_PIN;
    const appLang       = (process.env.DEFAULT_LANGUAGE || process.env.APP_LANG || 'es') as 'es' | 'en' | 'fr';
    const restaurantName = process.env.RESTAURANT_NAME || 'DisherIo';
    const currency      = process.env.DEFAULT_CURRENCY || 'EUR';
    const taxRate       = parseInt(process.env.DEFAULT_TAX_RATE || '10', 10);
    const theme         = (process.env.DEFAULT_THEME || 'light') as 'light' | 'dark';

    if (!adminPassword) {
      logger.error('ADMIN_PASSWORD env var is required');
      process.exit(1);
    }
    if (!adminPin) {
      logger.error('ADMIN_PIN env var is required');
      process.exit(1);
    }

    // Create or update default restaurant (matched by name to stay idempotent)
    let restaurant = await Restaurant.findOne({ restaurant_name: restaurantName });
    if (!restaurant) {
      restaurant = await Restaurant.create({
        restaurant_name: restaurantName,
        tax_rate: taxRate,
        currency,
        default_language: appLang,
        default_theme: theme,
      });
      logger.info(`Restaurant created: ${restaurantName}`);
    } else {
      const updated = await Restaurant.findByIdAndUpdate(
        restaurant._id,
        { $set: { tax_rate: taxRate, currency, default_language: appLang, default_theme: theme } },
        { returnDocument: 'after' }
      );
      if (!updated) {
        logger.error('Failed to update restaurant');
        process.exit(1);
      }
      restaurant = updated;
      logger.info(`Restaurant updated: ${restaurantName}`);
    }

    // Create default roles
    const defaultRoles = [
      { role_name: 'Admin', permissions: ['ADMIN'] },
      { role_name: 'KTS', permissions: ['KTS'] },
      { role_name: 'POS', permissions: ['POS'] },
      { role_name: 'TAS', permissions: ['TAS'] },
    ];

    for (const roleData of defaultRoles) {
      const result = await Role.findOneAndUpdate(
        { restaurant_id: restaurant._id, role_name: roleData.role_name },
        { $set: { permissions: roleData.permissions } },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
      );
      logger.info(`Role upserted: ${roleData.role_name} → permissions: [${result.permissions.join(', ')}]`);
    }

    // Create the admin user only when it does not exist yet. Reseeding must
    // never silently reset the credentials of an existing admin account.
    const existing = await Staff.findOne({ username: adminUsername, restaurant_id: restaurant._id });

    if (!existing) {
      const adminRole = await Role.findOne({ restaurant_id: restaurant._id, role_name: 'Admin' });
      if (!adminRole) {
        logger.error('Admin role not found');
        process.exit(1);
      }

      const password_hash  = await hashPassword(adminPassword);
      const pin_code_hash  = await hashPin(adminPin);
      const pin_lookup     = computePinLookup(adminPin);

      await Staff.create({
        restaurant_id: restaurant._id,
        role_id: adminRole._id,
        staff_name: 'Administrador',
        username: adminUsername,
        password_hash,
        pin_code_hash,
        pin_lookup,
      });
      logger.info(`Admin user created: ${adminUsername}`);
    } else {
      logger.info(`Admin user already exists, credentials left unchanged: ${adminUsername}`);
    }

    logger.info('=== DisherIO seed completed successfully ===');

  } catch (err) {
    logger.error({ err }, 'Seed failed');
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  }

  // Graceful disconnect with explicit exit
  await mongoose.disconnect();
  logger.info('Disconnected from MongoDB. Exiting.');
  process.exit(0);
}

seed().catch((err) => {
  logger.error({ err }, 'Fatal error in seed');
  process.exit(1);
});
