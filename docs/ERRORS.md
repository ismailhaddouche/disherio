# Troubleshooting and Diagnostic Procedures

This document details the resolution procedures for common operational issues and system errors within the DisherIo platform.

---

## Error Codes

DisherIo uses a centralized `ErrorCode` enum defined in `shared/errors/error-codes.ts`, shared between backend and frontend. The complete reference is in [ERROR_CODES.md](ERROR_CODES.md).

### Categories

| Category | Codes | HTTP Status |
|----------|-------|-------------|
| Authentication | `UNAUTHORIZED`, `INVALID_CREDENTIALS`, `INVALID_TOKEN`, `SESSION_EXPIRED`, `AUTHENTICATION_REQUIRED` | 401 |
| Authorization | `FORBIDDEN`, `REQUIRES_POS_AUTHORIZATION`, `REQUIRES_AUTHORIZATION` | 403 |
| Rate Limiting | `RATE_LIMIT_EXCEEDED`, `AUTH_RATE_LIMIT_EXCEEDED`, `QR_RATE_LIMIT_EXCEEDED`, `QR_BRUTE_FORCE_DETECTED` | 429 |
| Not Found | `DISH_NOT_FOUND`, `ORDER_NOT_FOUND`, `ITEM_NOT_FOUND`, `TOTEM_NOT_FOUND`, `STAFF_NOT_FOUND`, etc. | 404 |
| Business Logic | `DISH_NOT_AVAILABLE`, `SESSION_NOT_ACTIVE`, `ORDER_ALREADY_PAID`, `INVALID_STATE_TRANSITION`, etc. | 400 |
| Validation | `VALIDATION_ERROR`, `INVALID_ID_FORMAT`, `INVALID_FILE_TYPE`, `FILE_TOO_LARGE` | 400 |
| Conflicts | `USER_ALREADY_EXISTS`, `DUPLICATE_RESOURCE`, `CATEGORY_HAS_DISHES` | 409 |
| Server | `SERVER_ERROR`, `DATABASE_ERROR`, `SERVER_CONFIGURATION_ERROR` | 500 |

### Error response format

```json
{
  "errorCode": "DISH_NOT_FOUND",
  "error": "Dish not found",
  "status": 404
}
```

---

## Common Issues and Resolutions

### 1. Backend fails to start: `JWT_SECRET` validation

**Symptom**: Backend container exits immediately. Log shows:
```
[ERROR] JWT_SECRET cannot be the default value 'changeme_in_production'
```
or:
```
[ERROR] JWT_SECRET must be at least 32 characters long
```

**Cause**: The backend could not load a valid access or refresh secret. In the
Compose deployment these values come from `config/secrets/jwt_secret` and
`config/secrets/jwt_refresh_secret`, not from `.env`.

**Resolution**: Regenerate/repair the secret files with the configurator and
validate the resolved deployment without printing their contents:
```bash
./infrastructure/scripts/configure.sh
./infrastructure/scripts/verify.sh
docker compose config --quiet
```

### 2. Backend fails to start: MongoDB connection

**Symptom**: Log shows `MongoDB connection failed after maximum retry attempts`.

**Causes & resolutions**:
- **Replica set not initialized**: Run `sudo ./scripts/install.sh` (the installer runs `mongo-init-replica` explicitly)
- **App user not created** (volume pre-exists): rerun the installer. Its
  verification path reads the root credential inside `mongosh` and reruns
  `init-mongo.js` without placing a password in argv.
- **Wrong application URI secret**: regenerate
  `config/secrets/mongodb_uri`; it must select `disherio` and include
  `authSource=disherio&replicaSet=rs0`. Do not print it during diagnosis.

### 3. Backend fails to start: i18n locale files

**Symptom**: Log shows `i18n initialization failed` (warning, non-blocking — backend continues without translations).

**Cause**: Locales not found at `/app/dist/locales/`.

**Resolution**: The Dockerfile copies locales via `cp -r backend/src/locales backend/dist/`. If building manually, ensure this step is included. The backend is designed to start even without locales (non-blocking catch).

### 4. Media asset loading failures (images not displayed)

**Symptom**: Dish/category images return 404.

**Cause**: Caddyfile missing `handle /uploads/*` block, or volume not mounted correctly.

**Resolution**: Verify Caddyfile contains:
```
handle /uploads/* {
    root * /srv/uploads
    file_server
}
```
And `docker-compose.yml` has `- disherio_uploads:/srv/uploads:ro` on the caddy service.

### 5. Socket.IO communication disruption

**Symptom**: Real-time updates not working (KDS, POS, TAS).

**Causes & resolutions**:
- **Caddy misconfiguration**: Verify `/socket.io/*` handler with `flush_interval -1` and `transport http { versions 1.1 }`
- **CORS rejected**: Check `FRONTEND_URL` in `.env` matches the browser origin (including port). The backend logs `CORS rejected origin` warnings
- **Redis unavailable**: optional cache operations may degrade, but production
  HTTP/socket rate limits, refresh tokens, and access-token revocation do not
  fall back to per-process security state. Authenticated traffic and readiness
  fail closed. Restore Redis before returning the backend to service
  (`docker compose logs redis`).
- **Auth failure**: Verify cookies are being sent (`withCredentials: true` on frontend). Check `TRUST_PROXY=true` in backend env

### 6. Let's Encrypt certificate not issued

**Symptom**: Caddy logs show `obtaining certificate` but never `certificate obtained`.

**Causes & resolutions**:
- DNS not pointing to server: `dig +short your-domain.com` should return your public IP
- Ports 80/443 blocked by firewall: `sudo ufw allow 80/tcp && sudo ufw allow 443/tcp`
- Repeated failed authorizations: stop retrying, fix the reported DNS/network
  cause, and consult the current ACME provider rate-limit documentation before
  trying again.

### 7. Cloudflare Tunnel not connecting

**Symptom**: `cloudflared` container keeps restarting or shows no `Connection registered` message.

**Resolutions**:
- Verify that `config/secrets/cloudflare_tunnel_token` exists and is non-empty
  without printing it: `test -s config/secrets/cloudflare_tunnel_token`
- Run `./infrastructure/scripts/verify.sh`; it validates the active tunnel
  secret file rather than looking in `.env`.
- Check container logs: `docker compose logs -f cloudflared`
- Ensure Caddy is healthy: `docker compose ps caddy`
- Verify the tunnel network is NOT `internal: true` (must allow outbound Internet access)

### 8. Grafana, Prometheus, or Alertmanager service not found

**Symptom**: `docker compose` reports that a monitoring service does not exist,
or an old operations procedure expects monitoring dashboards or alerts.

**Cause**: DisherIo no longer bundles Grafana, a Prometheus server,
Alertmanager, or exporter containers. `/metrics` is only an internal backend
exposition endpoint and is not a monitoring platform by itself.

**Resolution**: Use Pino logs, Docker health checks, and `/health/*` for the
bundled operational diagnostics. If metrics retention, dashboards, or alert
delivery are required, deploy and secure that platform independently and keep
the backend metrics route on a trusted internal network.

### 9. Rate limit exceeded in normal usage

**Symptom**: API returns `429` with `API_RATE_LIMIT_EXCEEDED` during normal POS operations.

**Resolution**: The API rate limit is 1000 requests / 15 min. Production
counters are shared in Redis. If this is insufficient for high-volume
restaurants, adjust `RATE_LIMITS.API.max` in
`backend/src/middlewares/rateLimit.config.ts`, test all instances against the
same Redis, and document the operational change.

### 10. Permission denied writing to `/app/uploads`

**Symptom**: Backend logs `EACCES: permission denied` when saving images.

**Cause**: The `disherio_uploads` volume has root ownership from a previous installation.

**Resolution**:
Back up first, then repair only the upload-volume ownership and restart the
backend; do not uninstall the database to solve a file-permission issue:

```bash
sudo ./scripts/install.sh backup
docker compose run --rm --user 0 backend chown -R 1001:1001 /app/uploads
docker compose restart backend caddy
```

---

## Diagnostic Logs

```bash
# All services (live)
sudo ./scripts/install.sh logs

# Specific service
sudo ./scripts/install.sh logs backend
sudo ./scripts/install.sh logs frontend
sudo ./scripts/install.sh logs mongo
sudo ./scripts/install.sh logs caddy

# Installation log
cat /var/log/disherio.log

# Last 100 lines
docker compose logs --tail=100 backend
```

### Log inspection tips

- **Pino logs** are JSON-formatted. Use `pino-pretty` for readable output in development.
- **Secrets are redacted**: passwords, tokens, JWT secrets, and MongoDB URIs are automatically removed from logs.
- **Slow request warnings**: requests taking >1s are logged with `Slow request detected`.

---

## Health Endpoints

| Endpoint | Returns | Use case |
|----------|---------|----------|
| `GET /health` | Full status (DB, Redis, disk, memory) | Comprehensive check |
| `GET /health/ready` | Readiness check | Load balancer readiness |
| `GET /health/live` | Liveness check | Load balancer liveness |
| `GET /health/simple` | `{ status: "ok" }` | Lightweight process compatibility check |

Docker healthchecks use `/health/ready` because MongoDB and Redis are required
for normal application traffic. `/health/simple` remains available for clients
that only need to verify that the HTTP process responds. All health variants
still pass through `internalOnly`: callers must originate from a private or
loopback address, or present the configured `x-internal-token`. Caddy blocks
`/metrics` before it reaches the backend.
