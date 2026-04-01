/**
 * MongoDB Initialization Script
 * 
 * This script creates the application user with appropriate roles
 * and initializes the database for DisherIO.
 * 
 * Run automatically by MongoDB on first container startup when mounted
 * at /docker-entrypoint-initdb.d/
 */

// Switch to admin database to create users
db = db.getSiblingDB('admin');

// Get environment variables
const rootUser = process.env.MONGO_INITDB_ROOT_USERNAME;
const rootPass = process.env.MONGO_INITDB_ROOT_PASSWORD;
const appDb = process.env.MONGO_INITDB_DATABASE || 'disherio';

// Create application database user with readWrite role only
// This user has limited privileges compared to root
const appUser = process.env.MONGO_APP_USER || 'disherio_app';
const appPass = process.env.MONGO_APP_PASSWORD || 'change-this-app-password';

// Switch to application database
db = db.getSiblingDB(appDb);

// Create application user with readWrite role on the application database
try {
  db.createUser({
    user: appUser,
    pwd: appPass,
    roles: [
      { role: 'readWrite', db: appDb },
      // Grant additional monitoring privileges for health checks
      { role: 'clusterMonitor', db: 'admin' }
    ]
  });
  
  print(`Successfully created application user '${appUser}' with readWrite role on database '${appDb}'`);
} catch (err) {
  // User might already exist, log but don't fail
  print(`Note: Could not create user '${appUser}': ${err.message}`);
}

// Create indexes for common queries to improve performance
// These are created on the application database

// Helper function to check if index exists before creating
function createIndexIfNotExists(collection, indexSpec, options = {}) {
  try {
    const indexes = collection.getIndexes();
    const indexName = Object.keys(indexSpec).join('_') + '_1';
    
    // Check if index already exists
    let exists = false;
    for (let idxName in indexes) {
      const idx = indexes[idxName];
      if (JSON.stringify(idx.key) === JSON.stringify(indexSpec)) {
        exists = true;
        break;
      }
    }
    
    if (!exists) {
      collection.createIndex(indexSpec, options);
      print(`Created index on ${collection.getName()}: ${JSON.stringify(indexSpec)}`);
    } else {
      print(`Index already exists on ${collection.getName()}: ${JSON.stringify(indexSpec)}`);
    }
  } catch (err) {
    print(`Error creating index on ${collection.getName()}: ${err.message}`);
    // Try to create anyway (might be a different error)
    try {
      collection.createIndex(indexSpec, options);
    } catch (e) {
      print(`Failed to create index: ${e.message}`);
    }
  }
}

// Restaurant lookups
createIndexIfNotExists(db.restaurants, { "email": 1 }, { unique: true, sparse: true });
createIndexIfNotExists(db.restaurants, { "slug": 1 }, { unique: true, sparse: true });
createIndexIfNotExists(db.restaurants, { "status": 1 });
createIndexIfNotExists(db.restaurants, { "createdAt": -1 });

// Categories lookups (adapted to actual model)
createIndexIfNotExists(db.categories, { "restaurant_id": 1 });

// Dish lookups (adapted to actual model)
createIndexIfNotExists(db.dishes, { "restaurant_id": 1 });
createIndexIfNotExists(db.dishes, { "restaurant_id": 1, "category_id": 1 });
createIndexIfNotExists(db.dishes, { "category_id": 1, "disher_status": 1 });
createIndexIfNotExists(db.dishes, { "disher_type": 1, "disher_status": 1 });
createIndexIfNotExists(db.dishes, { "disher_name.value": "text" });

// Order lookups (adapted to actual model)
createIndexIfNotExists(db.orders, { "session_id": 1, "order_date": -1 });
createIndexIfNotExists(db.orders, { "customer_id": 1, "order_date": -1 });
createIndexIfNotExists(db.orders, { "staff_id": 1, "order_date": -1 });
createIndexIfNotExists(db.orders, { "order_date": -1 });
createIndexIfNotExists(db.orders, { "createdAt": -1 });

// ItemOrder lookups (for KDS)
createIndexIfNotExists(db.itemorders, { "session_id": 1, "item_disher_type": 1, "item_state": 1 });
createIndexIfNotExists(db.itemorders, { "session_id": 1 });
createIndexIfNotExists(db.itemorders, { "item_state": 1 });
createIndexIfNotExists(db.itemorders, { "item_disher_type": 1 });
createIndexIfNotExists(db.itemorders, { "order_id": 1 });

// Payment lookups
createIndexIfNotExists(db.payments, { "session_id": 1 });

// Staff lookups (adapted to actual model)
createIndexIfNotExists(db.staff, { "restaurant_id": 1 });
createIndexIfNotExists(db.staff, { "restaurant_id": 1, "username": 1 }, { unique: true });

// Role lookups
createIndexIfNotExists(db.roles, { "restaurant_id": 1 });

// Totem lookups (adapted to actual model)
createIndexIfNotExists(db.totems, { "restaurant_id": 1 });
createIndexIfNotExists(db.totems, { "totem_qr": 1 }, { unique: true, sparse: true });

// TotemSession lookups
createIndexIfNotExists(db.totemsessions, { "totem_id": 1 });
createIndexIfNotExists(db.totemsessions, { "totem_state": 1 });

// Customer lookups (adapted to actual model)
createIndexIfNotExists(db.customers, { "customer_email": 1 }, { unique: true, sparse: true });
createIndexIfNotExists(db.customers, { "customer_phone": 1 }, { sparse: true });
createIndexIfNotExists(db.customers, { "restaurant_id": 1, "created_at": -1 });
createIndexIfNotExists(db.customers, { "restaurant_id": 1, "customer_name": 1 });

// Menu language lookups
createIndexIfNotExists(db.menulanguages, { "restaurant": 1 });
createIndexIfNotExists(db.menulanguages, { "restaurant": 1, "code": 1 });

print(`Successfully created indexes on database '${appDb}'`);
print('MongoDB initialization completed successfully!');
