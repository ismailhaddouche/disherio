#!/bin/bash
# =============================================================================
# MongoDB Replica Set Initialization
# =============================================================================
# Initializes a single-node replica set so MongoDB transactions work.
# Runs after the container starts, retrying until Mongo is reachable.
# =============================================================================

set -e

REPLICA_SET="rs0"
MONGO_ROOT_USER="${MONGO_INITDB_ROOT_USERNAME:-admin}"
MONGO_ROOT_PASS="${MONGO_INITDB_ROOT_PASSWORD:?MONGO_INITDB_ROOT_PASSWORD is required}"
MAX_ATTEMPTS="${MONGO_INIT_MAX_ATTEMPTS:-60}"

echo "[init-replica] Waiting for MongoDB to be ready..."
attempts=0
until mongosh --quiet --eval "db.adminCommand('ping').ok" \
  -u "$MONGO_ROOT_USER" -p "$MONGO_ROOT_PASS" --authenticationDatabase admin \
  >/dev/null 2>&1; do
  attempts=$((attempts + 1))
  [ "$attempts" -lt "$MAX_ATTEMPTS" ] || { echo "[init-replica] Timed out waiting for MongoDB" >&2; exit 1; }
  echo "[init-replica] MongoDB not ready yet, retrying in 2s..."
  sleep 2
done

echo "[init-replica] MongoDB is ready. Initializing replica set '$REPLICA_SET'..."

# Try to initiate the replica set; ignore error if already initiated
mongosh --quiet \
  -u "$MONGO_ROOT_USER" -p "$MONGO_ROOT_PASS" --authenticationDatabase admin \
  --eval "
    try {
      const status = rs.status();
      print('[init-replica] Replica set already initialized. State: ' + status.myState);
    } catch (e) {
      const cfg = { _id: '$REPLICA_SET', members: [{ _id: 0, host: 'mongo:27017' }] };
      rs.initiate(cfg);
      print('[init-replica] Replica set initiated.');
    }
  "

# Wait for primary
echo "[init-replica] Waiting for primary..."
attempts=0
until mongosh --quiet --eval "db.hello().isWritablePrimary" \
  -u "$MONGO_ROOT_USER" -p "$MONGO_ROOT_PASS" --authenticationDatabase admin \
  >/dev/null 2>&1; do
  attempts=$((attempts + 1))
  [ "$attempts" -lt "$MAX_ATTEMPTS" ] || { echo "[init-replica] Timed out waiting for primary" >&2; exit 1; }
  echo "[init-replica] Not primary yet, retrying in 2s..."
  sleep 2
done

echo "[init-replica] Replica set is ready and primary."
