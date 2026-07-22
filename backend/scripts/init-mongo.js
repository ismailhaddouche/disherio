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
// mongosh does not provide the legacy cat() helper; use Node fs instead.
const fs = require('fs');
const appUser = process.env.MONGO_APP_USER || 'disherio_app';
const appPass = process.env.MONGO_APP_PASSWORD_FILE
  ? fs.readFileSync(process.env.MONGO_APP_PASSWORD_FILE, 'utf8').trim()
  : process.env.MONGO_APP_PASSWORD;

if (!appPass) {
  throw new Error(
    'MONGO_APP_PASSWORD_FILE or MONGO_APP_PASSWORD must be set; refusing to create the application user without a password'
  );
}

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
    let exists = false;
    for (let idxName in indexes) {
      const idx = indexes[idxName];
      const sameKeys = JSON.stringify(idx.key) === JSON.stringify(indexSpec);
      const sameUnique = options.unique === undefined || idx.unique === options.unique;
      const sameSparse = options.sparse === undefined || idx.sparse === options.sparse;
      const samePartialFilter = options.partialFilterExpression === undefined
        || JSON.stringify(idx.partialFilterExpression) === JSON.stringify(options.partialFilterExpression);
      if (sameKeys && sameUnique && sameSparse && samePartialFilter) {
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
      if (options.unique) throw e;
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
createIndexIfNotExists(
  db.orders,
  { "session_id": 1, "request_id": 1 },
  { unique: true, partialFilterExpression: { "request_id": { $type: "string" } } }
);
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
createIndexIfNotExists(
  db.itemorders,
  { "session_id": 1, "request_id": 1 },
  { unique: true, partialFilterExpression: { "request_id": { $type: "string" } } }
);
createIndexIfNotExists(db.itemorders, { "last_activity_source": 1, "updatedAt": -1 });
createIndexIfNotExists(db.itemorders, { "last_activity_user_id": 1, "updatedAt": -1 });

// Payment lookups
createIndexIfNotExists(
  db.payments,
  { "session_id": 1 },
  { unique: true }
);
createIndexIfNotExists(db.payments, { "restaurant_id": 1, "payment_date": -1 });
createIndexIfNotExists(db.payments, { "payment_date": -1 });

// Staff lookups (adapted to actual model)
createIndexIfNotExists(db.staff, { "restaurant_id": 1 });
createIndexIfNotExists(db.staff, { "restaurant_id": 1, "username": 1 }, { unique: true });

// Role lookups
createIndexIfNotExists(db.roles, { "restaurant_id": 1 });

// Totem lookups (adapted to actual model)
createIndexIfNotExists(db.totems, { "restaurant_id": 1 });
createIndexIfNotExists(db.totems, { "totem_qr": 1 }, { unique: true, sparse: true });

// TotemSession lookups
createIndexIfNotExists(db.totemsessions, { "totem_id": 1, "totem_state": 1 });
createIndexIfNotExists(db.totemsessions, { "restaurant_id": 1, "session_date_start": -1 });
createIndexIfNotExists(db.totemsessions, { "totem_state": 1 });
try {
  db.totemsessions.createIndex(
    { "totem_id": 1 },
    {
      name: "unique_started_session_per_totem",
      unique: true,
      partialFilterExpression: { "totem_state": "STARTED" }
    }
  );
  print('Created unique active-session index on totemsessions');
} catch (err) {
  print(`Failed to create unique active-session index: ${err.message}`);
  throw err;
}

// Customer lookups (adapted to actual model)
createIndexIfNotExists(db.customers, { "customer_email": 1 }, { unique: true, sparse: true });
createIndexIfNotExists(db.customers, { "customer_phone": 1 }, { sparse: true });
createIndexIfNotExists(db.customers, { "restaurant_id": 1, "created_at": -1 });
createIndexIfNotExists(db.customers, { "restaurant_id": 1, "customer_name": 1 });

// Session customer names are normalized so case variants cannot race past the
// application pre-check. Existing data is back-filled before the unique index;
// deployment fails if historical duplicates need manual reconciliation.
db.sessioncustomers.updateMany(
  { "customer_name_key": { $exists: false } },
  [{ $set: { "customer_name_key": { $toLower: { $trim: { input: "$customer_name" } } } } }]
);
createIndexIfNotExists(db.sessioncustomers, { "session_id": 1 });
createIndexIfNotExists(
  db.sessioncustomers,
  { "session_id": 1, "customer_name_key": 1 },
  { unique: true, partialFilterExpression: { "customer_name_key": { $type: "string" } } }
);

// Menu language lookups
createIndexIfNotExists(db.menulanguages, { "restaurant": 1 });
createIndexIfNotExists(db.menulanguages, { "restaurant": 1, "code": 1 });

print(`Successfully created indexes on database '${appDb}'`);
print('MongoDB initialization completed successfully!');
