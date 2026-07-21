import 'dotenv/config';
import mongoose from 'mongoose';
import { Restaurant } from '../models/restaurant.model';
import { Role, Staff } from '../models/staff.model';
import { Category, Dish } from '../models/dish.model';
import { Totem } from '../models/totem.model';
import { logger } from '../config/logger';
import { hashPassword } from '../services/auth.service';
import { getEnv } from '../config/env';

async function seedExamples() {
  // Demo data creates users with well-known credentials (cocinero/cocinero).
  // Refuse to run in production without explicit confirmation.
  if (process.env.NODE_ENV === 'production' && process.env.SEED_EXAMPLES_CONFIRM !== 'true') {
    logger.error(
      'Example seed creates demo users with well-known credentials. ' +
      'Set SEED_EXAMPLES_CONFIRM=true to run it in production.',
    );
    process.exit(1);
  }

  const uri = getEnv().MONGODB_URI;

  logger.info('DisherIO example seeder starting...');

  try {
    await mongoose.connect(uri);
    logger.info('Connected to MongoDB');

    const restaurantName = process.env.RESTAURANT_NAME || 'DisherIo';
    const appLang = (process.env.DEFAULT_LANGUAGE || 'es') as 'es' | 'en' | 'fr';

    const restaurant = await Restaurant.findOne({ restaurant_name: restaurantName });
    if (!restaurant) {
      logger.error('Restaurant not found. Run the base seed first.');
      process.exit(1);
    }

    const restaurantId = restaurant._id;

    // ── Example categories ──────────────────────────────────────────────────
    const categories = [
      {
        name: { es: 'Entrantes', en: 'Starters', fr: 'Entrées' },
        order: 1,
        description: { es: 'Platos para empezar', en: 'Dishes to start', fr: 'Plats pour commencer' },
      },
      {
        name: { es: 'Bebidas', en: 'Drinks', fr: 'Boissons' },
        order: 2,
        description: { es: 'Refrescos, zumos y más', en: 'Soft drinks, juices and more', fr: 'Boissons, jus et plus' },
      },
    ];

    const categoryIds: Record<string, mongoose.Types.ObjectId> = {};

    for (const cat of categories) {
      const existing = await Category.findOne({ restaurant_id: restaurantId, 'category_name.value': cat.name[appLang] });
      if (existing) {
        categoryIds[cat.name.es] = existing._id;
        logger.info(`Category already exists: ${cat.name[appLang]}`);
      } else {
        const created = await Category.create({
          restaurant_id: restaurantId,
          category_name: [
            { lang: 'es', value: cat.name.es },
            { lang: 'en', value: cat.name.en },
            { lang: 'fr', value: cat.name.fr },
          ],
          category_order: cat.order,
          category_description: [
            { lang: 'es', value: cat.description.es },
            { lang: 'en', value: cat.description.en },
            { lang: 'fr', value: cat.description.fr },
          ],
        });
        categoryIds[cat.name.es] = created._id;
        logger.info(`Category created: ${cat.name[appLang]}`);
      }
    }

    // ── Example dishes ──────────────────────────────────────────────────────
    const dishes = [
      // Starters
      {
        category: 'Entrantes',
        name: { es: 'Croquetas de jamón', en: 'Ham croquettes', fr: 'Croquettes de jambon' },
        description: { es: 'Crujientes croquetas rellenas de jamón ibérico', en: 'Crispy croquettes filled with Iberian ham', fr: 'Croquettes croustillantes au jambon ibérique' },
        price: 6.50,
        type: 'KITCHEN' as const,
        alergens: ['gluten', 'lacteos'],
      },
      {
        category: 'Entrantes',
        name: { es: 'Ensalada César', en: 'Caesar salad', fr: 'Salade César' },
        description: { es: 'Lechuga romana, pollo, croutones y parmesano', en: 'Romaine lettuce, chicken, croutons and parmesan', fr: 'Laitue romaine, poulet, croûtons et parmesan' },
        price: 8.00,
        type: 'KITCHEN' as const,
        alergens: ['gluten', 'lacteos'],
      },
      {
        category: 'Entrantes',
        name: { es: 'Patatas bravas', en: 'Spicy potatoes', fr: 'Pommes bravas' },
        description: { es: 'Patatas fritas con salsa brava', en: 'Fried potatoes with spicy sauce', fr: 'Pommes de terre frites avec sauce piquante' },
        price: 5.50,
        type: 'KITCHEN' as const,
        alergens: [],
      },
      {
        category: 'Entrantes',
        name: { es: 'Tabla de quesos', en: 'Cheese board', fr: 'Plateau de fromages' },
        description: { es: 'Selección de quesos artesanales', en: 'Selection of artisan cheeses', fr: 'Sélection de fromages artisanaux' },
        price: 12.00,
        type: 'KITCHEN' as const,
        alergens: ['lacteos'],
      },
      // Bebidas
      {
        category: 'Bebidas',
        name: { es: 'Agua mineral', en: 'Mineral water', fr: 'Eau minérale' },
        description: { es: 'Botella 500ml', en: '500ml bottle', fr: 'Bouteille 500ml' },
        price: 1.50,
        type: 'SERVICE' as const,
        alergens: [],
      },
      {
        category: 'Bebidas',
        name: { es: 'Coca-Cola', en: 'Coca-Cola', fr: 'Coca-Cola' },
        description: { es: 'Lata 330ml', en: '330ml can', fr: 'Canette 330ml' },
        price: 2.00,
        type: 'SERVICE' as const,
        alergens: [],
      },
      {
        category: 'Bebidas',
        name: { es: 'Zumo de naranja natural', en: 'Fresh orange juice', fr: 'Jus d\'orange frais' },
        description: { es: 'Zumo recién exprimido', en: 'Freshly squeezed juice', fr: 'Jus fraîchement pressé' },
        price: 3.50,
        type: 'SERVICE' as const,
        alergens: [],
      },
      {
        category: 'Bebidas',
        name: { es: 'Café espresso', en: 'Espresso coffee', fr: 'Café espresso' },
        description: { es: 'Café italiano intenso', en: 'Intense Italian coffee', fr: 'Café italien intense' },
        price: 1.80,
        type: 'SERVICE' as const,
        alergens: [],
      },
    ];

    for (const dish of dishes) {
      const existing = await Dish.findOne({ restaurant_id: restaurantId, 'disher_name.value': dish.name[appLang] });
      if (existing) {
        logger.info(`Dish already exists: ${dish.name[appLang]}`);
        continue;
      }
      await Dish.create({
        restaurant_id: restaurantId,
        category_id: categoryIds[dish.category],
        disher_name: [
          { lang: 'es', value: dish.name.es },
          { lang: 'en', value: dish.name.en },
          { lang: 'fr', value: dish.name.fr },
        ],
        disher_description: [
          { lang: 'es', value: dish.description.es },
          { lang: 'en', value: dish.description.en },
          { lang: 'fr', value: dish.description.fr },
        ],
        disher_status: 'ACTIVATED',
        disher_price: dish.price,
        disher_type: dish.type,
        disher_alergens: dish.alergens,
        disher_variant: false,
        variants: [],
        extras: [],
      });
      logger.info(`Dish created: ${dish.name[appLang]} (${dish.price}€)`);
    }

    // ── Example staff users (cook, waiter, cashier) ─────────────────────────
    const exampleUsers = [
      { role_name: 'KTS', username: 'cocinero', staff_name: 'Cocinero Demo', password: 'cocinero' },
      { role_name: 'TAS', username: 'camarero', staff_name: 'Camarero Demo', password: 'camarero' },
      { role_name: 'POS', username: 'cajero', staff_name: 'Cajero Demo', password: 'cajero' },
    ];

    for (const user of exampleUsers) {
      const role = await Role.findOne({ restaurant_id: restaurantId, role_name: user.role_name });
      if (!role) {
        logger.warn(`Role not found: ${user.role_name}, skipping ${user.username}`);
        continue;
      }

      const existing = await Staff.findOne({ username: user.username, restaurant_id: restaurantId });
      if (existing) {
        const password_hash = await hashPassword(user.password);
        await Staff.updateOne({ _id: existing._id }, { $set: { password_hash } });
        logger.info(`Staff user updated: ${user.username} (${user.role_name})`);
      } else {
        const password_hash = await hashPassword(user.password);
        await Staff.create({
          restaurant_id: restaurantId,
          role_id: role._id,
          staff_name: user.staff_name,
          username: user.username,
          password_hash,
        });
        logger.info(`Staff user created: ${user.username} (${user.role_name})`);
      }
    }

    // Example totem for Table 1.
    const totemName = 'Mesa 1';
    const existingTotem = await Totem.findOne({ restaurant_id: restaurantId, totem_name: totemName });
    if (existingTotem) {
      logger.info(`Totem already exists: ${totemName}`);
    } else {
      await Totem.create({
        restaurant_id: restaurantId,
        totem_name: totemName,
        totem_qr: `totem-mesa1-${restaurantId}`,
        totem_type: 'STANDARD',
        totem_start_date: new Date(),
      });
      logger.info(`Totem created: ${totemName} (STANDARD)`);
    }

    logger.info('=== DisherIO example seed completed successfully ===');
    logger.info('Example users: cocinero/cocinero, camarero/camarero, cajero/cajero');
    logger.info('Example totem: Mesa 1');

  } catch (err) {
    logger.error({ err }, 'Example seed failed');
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  }

  await mongoose.disconnect();
  logger.info('Disconnected from MongoDB. Exiting.');
  process.exit(0);
}

seedExamples().catch((err) => {
  logger.error({ err }, 'Fatal error in example seed');
  process.exit(1);
});
