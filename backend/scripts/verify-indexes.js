#!/usr/bin/env node
/**
 * MongoDB Index Verification Script
 * 
 * This script verifies all indexes in the DisherIO database
 * and provides recommendations for missing indexes.
 * 
 * Usage: node verify-indexes.js
 */

const mongoose = require('mongoose');

// MongoDB connection string from environment or default
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/disherio';

// Expected indexes for each collection
const expectedIndexes = {
  restaurants: [
    { key: { email: 1 }, options: { unique: true, sparse: true }, description: 'Unique email lookup' },
    { key: { slug: 1 }, options: { unique: true, sparse: true }, description: 'Unique slug lookup' },
    { key: { status: 1 }, options: {}, description: 'Status filtering' },
    { key: { createdAt: -1 }, options: {}, description: 'Recent restaurants' },
  ],
  categories: [
    { key: { restaurant_id: 1 }, options: {}, description: 'Restaurant categories' },
  ],
  dishes: [
    { key: { restaurant_id: 1 }, options: {}, description: 'Restaurant dishes' },
    { key: { restaurant_id: 1, category_id: 1 }, options: {}, description: 'Restaurant dishes by category' },
    { key: { category_id: 1, disher_status: 1 }, options: {}, description: 'Category dishes with status' },
    { key: { disher_type: 1, disher_status: 1 }, options: {}, description: 'Kitchen/Service filtering' },
    { key: { 'disher_name.value': 'text' }, options: {}, description: 'Text search on dish name' },
  ],
  orders: [
    { key: { session_id: 1, order_date: -1 }, options: {}, description: 'Session order history' },
    { key: { customer_id: 1, order_date: -1 }, options: {}, description: 'Customer order history' },
    { key: { staff_id: 1, order_date: -1 }, options: {}, description: 'Staff order queries' },
    { key: { order_date: -1 }, options: {}, description: 'Date range queries' },
    { key: { createdAt: -1 }, options: {}, description: 'Recent orders' },
  ],
  itemorders: [
    { key: { session_id: 1, item_disher_type: 1, item_state: 1 }, options: {}, description: 'KDS kitchen queries' },
    { key: { session_id: 1 }, options: {}, description: 'Session items' },
    { key: { item_state: 1 }, options: {}, description: 'State filtering' },
    { key: { item_disher_type: 1 }, options: {}, description: 'Type filtering' },
    { key: { order_id: 1 }, options: {}, description: 'Order items lookup' },
  ],
  payments: [
    { key: { session_id: 1 }, options: {}, description: 'Session payments' },
  ],
  staff: [
    { key: { restaurant_id: 1 }, options: {}, description: 'Restaurant staff' },
    { key: { restaurant_id: 1, username: 1 }, options: { unique: true }, description: 'Unique username per restaurant' },
  ],
  roles: [
    { key: { restaurant_id: 1 }, options: {}, description: 'Restaurant roles' },
  ],
  totems: [
    { key: { restaurant_id: 1 }, options: {}, description: 'Restaurant totems' },
    { key: { totem_qr: 1 }, options: { unique: true, sparse: true }, description: 'Unique QR lookup' },
  ],
  totemsessions: [
    { key: { totem_id: 1 }, options: {}, description: 'Totem sessions' },
    { key: { totem_state: 1 }, options: {}, description: 'State filtering' },
  ],
  customers: [
    { key: { customer_email: 1 }, options: { unique: true, sparse: true }, description: 'Unique email lookup' },
    { key: { customer_phone: 1 }, options: { sparse: true }, description: 'Phone lookup' },
    { key: { restaurant_id: 1, created_at: -1 }, options: {}, description: 'Restaurant customer list' },
    { key: { restaurant_id: 1, customer_name: 1 }, options: {}, description: 'Customer name search' },
  ],
  menulanguages: [
    { key: { restaurant: 1 }, options: {}, description: 'Restaurant languages' },
    { key: { restaurant: 1, code: 1 }, options: {}, description: 'Restaurant language by code' },
  ],
};

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function indexKeyToString(key) {
  return Object.entries(key)
    .map(([k, v]) => `${k}:${v}`)
    .join(', ');
}

function indexesMatch(idx1, idx2) {
  const keys1 = Object.keys(idx1).sort();
  const keys2 = Object.keys(idx2).sort();
  
  if (keys1.length !== keys2.length) return false;
  
  for (let i = 0; i < keys1.length; i++) {
    if (keys1[i] !== keys2[i]) return false;
    if (idx1[keys1[i]] !== idx2[keys2[i]]) return false;
  }
  
  return true;
}

async function verifyIndexes() {
  try {
    log('🔌 Connecting to MongoDB...', 'cyan');
    await mongoose.connect(MONGODB_URI);
    log('✅ Connected successfully\n', 'green');

    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);

    log('='.repeat(70), 'cyan');
    log('  MONGODB INDEX VERIFICATION REPORT', 'cyan');
    log('='.repeat(70), 'cyan');
    log(`Database: ${db.databaseName}\n`, 'blue');

    let totalExpected = 0;
    let totalFound = 0;
    let totalMissing = 0;

    for (const [collectionName, expected] of Object.entries(expectedIndexes)) {
      log(`\n📁 Collection: ${collectionName}`, 'blue');
      log('-'.repeat(50), 'blue');

      if (!collectionNames.includes(collectionName)) {
        log(`  ⚠️  Collection does not exist yet`, 'yellow');
        continue;
      }

      const collection = db.collection(collectionName);
      const existingIndexes = await collection.indexes();
      
      // Filter out the default _id index
      const userIndexes = existingIndexes.filter(idx => idx.name !== '_id_');

      log(`  Existing indexes: ${userIndexes.length}`, 'blue');
      
      for (const expectedIdx of expected) {
        totalExpected++;
        const keyStr = indexKeyToString(expectedIdx.key);
        
        const found = userIndexes.some(idx => indexesMatch(idx.key, expectedIdx.key));
        
        if (found) {
          totalFound++;
          log(`  ✅ ${keyStr}`, 'green');
          log(`     ${expectedIdx.description}`, 'reset');
        } else {
          totalMissing++;
          log(`  ❌ ${keyStr}`, 'red');
          log(`     ${expectedIdx.description}`, 'reset');
          log(`     ⚠️  MISSING - Run init-mongo.js to create`, 'yellow');
        }
      }

      // Show unexpected indexes
      for (const idx of userIndexes) {
        const isExpected = expected.some(exp => indexesMatch(exp.key, idx.key));
        if (!isExpected) {
          const keyStr = indexKeyToString(idx.key);
          log(`  ⚠️  ${keyStr} (unexpected/extra)`, 'yellow');
        }
      }
    }

    // Summary
    log(`\n${'='.repeat(70)}`, 'cyan');
    log('  SUMMARY', 'cyan');
    log('='.repeat(70), 'cyan');
    log(`  Total expected indexes: ${totalExpected}`, 'blue');
    log(`  Indexes found: ${totalFound}`, 'green');
    log(`  Indexes missing: ${totalMissing}`, totalMissing > 0 ? 'red' : 'green');
    
    if (totalMissing === 0) {
      log(`\n  🎉 All indexes are properly configured!`, 'green');
    } else {
      log(`\n  ⚠️  ${totalMissing} index(es) need to be created.`, 'yellow');
      log(`     Run: node scripts/init-mongo.js`, 'cyan');
    }

    // Performance recommendations
    log(`\n${'='.repeat(70)}`, 'cyan');
    log('  PERFORMANCE RECOMMENDATIONS', 'cyan');
    log('='.repeat(70), 'cyan');
    log(`
  1. Monitor slow queries using MongoDB profiler:
     db.setProfilingLevel(1, { slowms: 100 })

  2. Check index usage statistics:
     db.collectionName.aggregate([{ $indexStats: {} }])

  3. Ensure indexes fit in RAM for optimal performance

  4. Consider compound indexes for queries with multiple filters

  5. Review and remove unused indexes periodically
    `, 'blue');

    await mongoose.disconnect();
    log('\n✅ Verification complete!', 'green');
    
    process.exit(totalMissing > 0 ? 1 : 0);
  } catch (error) {
    log(`\n❌ Error: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  verifyIndexes();
}

module.exports = { verifyIndexes, expectedIndexes };
