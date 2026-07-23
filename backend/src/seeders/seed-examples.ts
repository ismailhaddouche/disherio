import 'dotenv/config';
import fs from 'fs';
import path from 'path';
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

    // ── Copy seed placeholder images into the uploads volume ─────────────────
    const seedImagesDir = path.resolve(__dirname, '..', '..', 'seed-images');
    const uploadsDir = process.env.UPLOADS_DIR || path.resolve(process.cwd(), 'uploads');
    const categoryUploadsDir = path.join(uploadsDir, 'categories');
    const dishUploadsDir = path.join(uploadsDir, 'dishes');

    fs.mkdirSync(categoryUploadsDir, { recursive: true });
    fs.mkdirSync(dishUploadsDir, { recursive: true });

    const copySeedImage = (srcName: string, destName: string, folder: string): string | null => {
      const src = path.join(seedImagesDir, folder, srcName);
      const dest = path.join(uploadsDir, folder, destName);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
        return `/uploads/${folder}/${destName}`;
      }
      logger.warn(`Seed image not found: ${src}`);
      return null;
    };

    // Category images
    const catEntrantesImg = copySeedImage('seed-entrantes.webp', `${restaurantId}-seed-entrantes.webp`, 'categories');
    const catBebidasImg = copySeedImage('seed-bebidas.webp', `${restaurantId}-seed-bebidas.webp`, 'categories');

    // Dish images
    const dishImages: Record<string, string | null> = {
      'Croquetas de jamón': copySeedImage('seed-croquetas-jamon.webp', `${restaurantId}-seed-croquetas-jamon.webp`, 'dishes'),
      'Ensalada César': copySeedImage('seed-ensalada-cesar.webp', `${restaurantId}-seed-ensalada-cesar.webp`, 'dishes'),
      'Patatas bravas': copySeedImage('seed-patatas-bravas.webp', `${restaurantId}-seed-patatas-bravas.webp`, 'dishes'),
      'Tabla de quesos': copySeedImage('seed-tabla-quesos.webp', `${restaurantId}-seed-tabla-quesos.webp`, 'dishes'),
      'Agua mineral': copySeedImage('seed-agua-mineral.webp', `${restaurantId}-seed-agua-mineral.webp`, 'dishes'),
      'Coca-Cola': copySeedImage('seed-coca-cola.webp', `${restaurantId}-seed-coca-cola.webp`, 'dishes'),
      'Zumo de naranja natural': copySeedImage('seed-zumo-naranja.webp', `${restaurantId}-seed-zumo-naranja.webp`, 'dishes'),
      'Café espresso': copySeedImage('seed-cafe-espresso.webp', `${restaurantId}-seed-cafe-espresso.webp`, 'dishes'),
    };

    // ── Example categories ──────────────────────────────────────────────────
    const categories = [
      {
        name: { es: 'Entrantes', en: 'Starters', fr: 'Entrées' },
        order: 1,
        description: { es: 'Platos para empezar', en: 'Dishes to start', fr: 'Plats pour commencer' },
        image: catEntrantesImg,
      },
      {
        name: { es: 'Bebidas', en: 'Drinks', fr: 'Boissons' },
        order: 2,
        description: { es: 'Refrescos, zumos y más', en: 'Soft drinks, juices and more', fr: 'Boissons, jus et plus' },
        image: catBebidasImg,
      },
    ];

    const categoryIds: Record<string, mongoose.Types.ObjectId> = {};

    for (const cat of categories) {
      const existing = await Category.findOne({ restaurant_id: restaurantId, 'category_name.value': cat.name[appLang] });
      if (existing) {
        categoryIds[cat.name.es] = existing._id;
        // Set the image URL on an existing category if it was missing.
        if (!existing.category_image_url && (cat as any).image) {
          await Category.updateOne(
            { _id: existing._id },
            { $set: { category_image_url: (cat as any).image } },
          );
        }
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
          category_image_url: (cat as any).image || undefined,
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
        image: dishImages['Croquetas de jamón'],
      },
      {
        category: 'Entrantes',
        name: { es: 'Ensalada César', en: 'Caesar salad', fr: 'Salade César' },
        description: { es: 'Lechuga romana, pollo, croutones y parmesano', en: 'Romaine lettuce, chicken, croutons and parmesan', fr: 'Laitue romaine, poulet, croûtons et parmesan' },
        price: 8.00,
        type: 'KITCHEN' as const,
        alergens: ['gluten', 'lacteos'],
        image: dishImages['Ensalada César'],
      },
      {
        category: 'Entrantes',
        name: { es: 'Patatas bravas', en: 'Spicy potatoes', fr: 'Pommes bravas' },
        description: { es: 'Patatas fritas con salsa brava', en: 'Fried potatoes with spicy sauce', fr: 'Pommes de terre frites avec sauce piquante' },
        price: 5.50,
        type: 'KITCHEN' as const,
        alergens: [],
        image: dishImages['Patatas bravas'],
      },
      {
        category: 'Entrantes',
        name: { es: 'Tabla de quesos', en: 'Cheese board', fr: 'Plateau de fromages' },
        description: { es: 'Selección de quesos artesanales', en: 'Selection of artisan cheeses', fr: 'Sélection de fromages artisanaux' },
        price: 12.00,
        type: 'KITCHEN' as const,
        alergens: ['lacteos'],
        image: dishImages['Tabla de quesos'],
      },
      // Bebidas
      {
        category: 'Bebidas',
        name: { es: 'Agua mineral', en: 'Mineral water', fr: 'Eau minérale' },
        description: { es: 'Botella 500ml', en: '500ml bottle', fr: 'Bouteille 500ml' },
        price: 1.50,
        type: 'SERVICE' as const,
        alergens: [],
        image: dishImages['Agua mineral'],
      },
      {
        category: 'Bebidas',
        name: { es: 'Coca-Cola', en: 'Coca-Cola', fr: 'Coca-Cola' },
        description: { es: 'Lata 330ml', en: '330ml can', fr: 'Canette 330ml' },
        price: 2.00,
        type: 'SERVICE' as const,
        alergens: [],
        image: dishImages['Coca-Cola'],
      },
      {
        category: 'Bebidas',
        name: { es: 'Zumo de naranja natural', en: 'Fresh orange juice', fr: 'Jus d\'orange frais' },
        description: { es: 'Zumo recién exprimido', en: 'Freshly squeezed juice', fr: 'Jus fraîchement pressé' },
        price: 3.50,
        type: 'SERVICE' as const,
        alergens: [],
        image: dishImages['Zumo de naranja natural'],
      },
      {
        category: 'Bebidas',
        name: { es: 'Café espresso', en: 'Espresso coffee', fr: 'Café espresso' },
        description: { es: 'Café italiano intenso', en: 'Intense Italian coffee', fr: 'Café italien intense' },
        price: 1.80,
        type: 'SERVICE' as const,
        alergens: [],
        image: dishImages['Café espresso'],
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
        disher_url_image: (dish as any).image || undefined,
      });
      logger.info(`Dish created: ${dish.name[appLang]} (${dish.price}€)`);
    }

    // ── Example staff users (cook, waiter, cashier) ─────────────────────────
    //
    // SECURITY NOTE — well-known credentials in demo users
    // ----------------------------------------------------
    // The passwords below are intentionally trivial (cocinero/cocinero, etc.).
    // This is an accepted design trade-off: the purpose of the example seed is
    // to let an operator populate the database and immediately test every role
    // (KDS, TAS, POS) without having to create accounts manually first.
    //
    // This is NOT secure for a real production deployment. It is safe only
    // because the seeder refuses to run unless the operator explicitly opts in
    // via SEED_EXAMPLES_CONFIRM=true (enforced by the entry guard at the top
    // of this function). The installer sets that flag only when the user
    // answers "yes" to "¿Instalar datos de ejemplo?".
    //
    // If the deployment is intended for real use, the operator should:
    //   1. NOT enable example data, or
    //   2. Delete or re-password these demo accounts after testing.
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
    logger.info('Demo users: cocinero/cocinero (KTS), camarero/camarero (TAS), cajero/cajero (POS)');
    logger.warn('These credentials are insecure — change or delete them before real use');
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
