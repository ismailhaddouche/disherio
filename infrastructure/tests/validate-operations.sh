#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TEST_ENV=$(mktemp)
trap 'rm -f "$TEST_ENV"' EXIT

cat > "$TEST_ENV" <<'ENV'
MONGO_ROOT_USER=admin
MONGO_ROOT_PASS=operational-test-root-password
MONGO_APP_USER=disherio_app
MONGO_APP_PASS=operational-test-app-password
MONGODB_URI=mongodb://disherio_app:operational-test-app-password@mongo:27017/disherio?authSource=disherio&replicaSet=rs0
REDIS_PASSWORD=operational-test-redis-password
JWT_SECRET=operational-test-jwt-secret-at-least-32-characters
JWT_REFRESH_SECRET=operational-test-refresh-secret-at-least-32-characters
FRONTEND_URL=https://disherio.invalid
ADMIN_PASSWORD=operational-test-admin-password
CF_TUNNEL_TOKEN=operational-test-tunnel-token
NGROK_AUTHTOKEN=operational-test-ngrok-token
TUNNEL_URL=https://disherio.invalid
LOCAL_IP=127.0.0.1
HTTP_PORT=8080
HTTPS_PORT=8443
DOMAIN=disherio.invalid
EMAIL=admin@disherio.invalid
ENV

for script in \
  "$ROOT_DIR/scripts/install.sh" \
  "$ROOT_DIR/scripts/configure.sh" \
  "$ROOT_DIR/scripts/backup.sh" \
  "$ROOT_DIR/scripts/restore.sh" \
  "$ROOT_DIR/infrastructure/scripts/configure.sh" \
  "$ROOT_DIR/infrastructure/scripts/verify.sh" \
  "$ROOT_DIR/backend/scripts/init-replica.sh"; do
  bash -n "$script"
done

docker compose --env-file "$TEST_ENV" -f "$ROOT_DIR/docker-compose.yml" config --quiet
docker compose --env-file "$TEST_ENV" \
  -f "$ROOT_DIR/docker-compose.yml" \
  -f "$ROOT_DIR/infrastructure/docker-compose.prod.yml" config --quiet
docker compose --env-file "$TEST_ENV" \
  -f "$ROOT_DIR/docker-compose.yml" \
  -f "$ROOT_DIR/infrastructure/docker-compose.local.yml" config --quiet
docker compose --env-file "$TEST_ENV" \
  -f "$ROOT_DIR/docker-compose.yml" \
  -f "$ROOT_DIR/infrastructure/docker-compose.local-ip.yml" config --quiet
docker compose --env-file "$TEST_ENV" \
  -f "$ROOT_DIR/docker-compose.yml" \
  -f "$ROOT_DIR/infrastructure/docker-compose.domain.yml" config --quiet

docker compose --env-file "$TEST_ENV" \
  -f "$ROOT_DIR/docker-compose.yml" \
  -f "$ROOT_DIR/infrastructure/docker-compose.public-ip.yml" \
  config --format json | node -e '
    let input = "";
    process.stdin.on("data", chunk => input += chunk);
    process.stdin.on("end", () => {
      const config = JSON.parse(input);
      if ((config.services.caddy.ports || []).length !== 0) {
        throw new Error("Tunnel override exposes Caddy ports");
      }
    });
  '

# Check that no Caddy template includes 'unsafe-eval' in an active directive
# (comments containing the word are OK — only the CSP header value matters).
if grep -R "Content-Security-Policy" "$ROOT_DIR/infrastructure/caddy-templates" | grep "unsafe-eval" >/dev/null; then
  echo "Caddy templates must not allow unsafe-eval in CSP" >&2
  exit 1
fi

if grep -R "container_name:" "$ROOT_DIR/docker-compose.yml" "$ROOT_DIR/infrastructure"/docker-compose.*.yml >/dev/null; then
  echo "Compose services must remain scalable" >&2
  exit 1
fi

if grep -E "npm install" "$ROOT_DIR/backend/Dockerfile" "$ROOT_DIR/frontend/Dockerfile" >/dev/null; then
  echo "Dockerfiles must use npm ci with the root lockfile" >&2
  exit 1
fi

echo "Operational configuration checks passed"
