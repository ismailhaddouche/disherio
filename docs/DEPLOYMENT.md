# Deployment and Infrastructure Guide

This document is the canonical reference for DisherIo deployment modes,
infrastructure components, configuration generation, service operation, and
deployment troubleshooting. Executable Compose files, shell scripts, and Caddy
templates remain the source of truth when behavior differs from this guide.

## Deployment Entry Points

DisherIo provides two supported deployment workflows:

| Workflow | Command | Intended use |
|----------|---------|--------------|
| Universal installer | `sudo ./scripts/install.sh` | Recommended production installation and lifecycle management |
| Multi-environment configurator | `./infrastructure/scripts/configure.sh` | Development, local networks, tunnels, and custom domain modes |

The universal installer provisions dependencies, validates resources, creates
secrets, generates configuration, starts the stack, waits for health checks,
and seeds the initial application data. See `INSTALL.md` for the complete
installation procedure.

The multi-environment configurator generates these repository-root files:

- `.env`, containing the selected deployment mode and runtime settings.
- `Caddyfile`, rendered from the matching template.
- `docker-compose.override.yml`, selected from the matching infrastructure
  override.
- `config/secrets/`, containing mode-`0600` files mounted through Compose
  secrets. Containers receive only `*_FILE` paths; passwords and signing
  secrets are not copied into container environment metadata.

Generated files may contain secrets and must not be committed.

## Infrastructure Layout

```text
infrastructure/
├── caddy-templates/
│   ├── Caddyfile.local
│   ├── Caddyfile.local-ip
│   ├── Caddyfile.public-ip
│   └── Caddyfile.domain
├── docker-compose.local.yml
├── docker-compose.local-ip.yml
├── docker-compose.public-ip.yml
├── docker-compose.domain.yml
└── scripts/
    ├── configure.sh
    └── verify.sh
```

Infrastructure configuration stays next to the executable assets. Technical
documentation is maintained centrally under `docs/`.

## Runtime Topology

```text
Client
  |
  v
Caddy :80/:443
  |-- /uploads/* ----------> persistent uploads
  |-- /health/* -----------> backend:3000
  |-- /api/* --------------> backend:3000
  |-- /socket.io/* --------> backend:3000
  `-- /* -------------------> frontend:4200
                                  |
               +------------------+------------------+
               |                                     |
            MongoDB                               Redis
       persistence and rs0              cache, pub/sub, token state
```

Caddy is the public entry point. Backend, frontend, MongoDB, and Redis
communicate over the private `disherio_net` Docker network. MongoDB and Redis
must not be exposed directly to untrusted networks.

### Core services

| Service | Internal port | Responsibility |
|---------|---------------|----------------|
| Caddy | `80`, `443` | Reverse proxy, TLS termination, uploads, security headers |
| Backend | `3000` | Express API, Socket.IO, health endpoints, internal metrics exposition |
| Frontend | `4200` | Angular application |
| MongoDB | `27017` | Persistent application data and transactions |
| Redis | `6379` | Cache, Socket.IO adapter, refresh tokens, token revocation |

The deployment does not expose or install Grafana, a Prometheus server,
Alertmanager, or exporter containers. Operators can use structured logs and
health endpoints directly; `/metrics` remains available only on the backend's
internal network for optional, separately secured external tooling.

## Deployment Modes

The configurator supports four modes without changing application source code.

| Mode | Public entry point | TLS | Typical use |
|------|--------------------|-----|-------------|
| `local` | `localhost` on `CADDY_PORT` | No | Development on one machine |
| `local-ip` | Host LAN address on `HTTP_PORT` | No | Trusted local restaurant network |
| `public-ip` | Cloudflare Tunnel or ngrok URL | Tunnel-managed | Temporary or tunneled internet access |
| `domain` | Configured domain on ports `80` and `443` | Automatic ACME | Production with a controlled domain |

### QR presence security by deployment mode

| Deployment boundary | Remote photographed-QR reuse |
|---------------------|-------------------------------|
| `local` | Not remotely reachable when bound only to loopback |
| `local-ip` | Blocked outside the restaurant only when the firewall limits ingress to the trusted LAN and no public tunnel or port forwarding exists |
| `public-ip` | Possible: the public endpoint cannot infer physical presence from a static QR |
| `domain` or public cloud VM | Possible: TLS authenticates and encrypts the server connection but does not prove that the customer is at the table |

The LAN protection is a network-boundary property, not an application-level
proof of presence. A device on the restaurant network, a compromised Wi-Fi
credential, or accidental public forwarding removes that protection. Static QR
codes remain bearer credentials in every mode.

Before exposing DisherIo to the Internet, explicitly accept this risk or add an
independent presence gate: a short-lived table/session code, staff approval in
POS/TAS, or a trusted on-premises network assertion. The current application
does not provide such a gate. Rate limits and `session_token` rotation must not
be documented or treated as physical-presence controls.

### Local mode

Local mode maps Caddy to the configured local port and enables development
behavior for the backend and frontend.

```bash
./infrastructure/scripts/configure.sh
# Select: local

docker compose up -d --build
```

Use this mode only for development. It enables debug logging and source mounts
that are not appropriate for production.

### Local network mode

Local network mode exposes HTTP on the host LAN interface so POS, KDS, TAS, and
totem devices on the same trusted subnet can connect.

```bash
./infrastructure/scripts/configure.sh
# Select: local-ip
# Confirm the detected LAN address and HTTP port.

docker compose up -d --build
```

Allow the selected HTTP port through the host firewall only for the trusted
subnet. This mode does not provide transport encryption. Use domain mode or a
private network with an appropriate TLS design when traffic crosses an
untrusted network.

### Public IP tunnel mode

Public IP mode keeps Caddy unexposed on the host and connects it to a tunnel
provider through `tunnel_net`. The configurator supports Cloudflare Tunnel and
ngrok.

Cloudflare Tunnel:

```bash
./infrastructure/scripts/configure.sh
# Select: public-ip
# Select: Cloudflare Tunnel
# Provide the tunnel token.

docker compose --profile cloudflare up -d --build
docker compose logs -f cloudflared
```

ngrok:

```bash
./infrastructure/scripts/configure.sh
# Select: public-ip
# Select: ngrok
# Provide the ngrok authentication token.

docker compose --profile ngrok up -d --build
docker compose logs -f ngrok
```

Only enable one tunnel profile at a time. Tunnel credentials are secrets. Do
not include them in logs, documentation, commits, or support requests.
This mode makes static QR bootstrap endpoints Internet-reachable and therefore
does not prevent remote reuse of a photographed QR.

### Domain mode

Domain mode is the preferred multi-device production configuration. The domain
must resolve to the server, and inbound TCP ports `80` and `443` must reach
Caddy. UDP port `443` is used for HTTP/3 when available.

```bash
./infrastructure/scripts/configure.sh
# Select: domain
# Provide the domain and ACME contact email.

docker compose up -d --build
docker compose logs -f caddy
```

Caddy obtains and renews the certificate automatically. Do not place another
service on the same public ports unless it is intentionally acting as the
upstream reverse proxy and the trust configuration is updated accordingly.
Domain mode does not provide proof that a public totem client is physically in
the restaurant.

## Configuration Resolution

Runtime values are resolved in this order, from highest to lowest priority:

1. Environment variables supplied to the process.
2. Values in the repository-root `.env` file.
3. Compose defaults.
4. Application defaults.

The selected mode is recorded in `DEPLOYMENT_MODE`. Common mode-specific values
include:

| Variable | Purpose |
|----------|---------|
| `CADDY_PORT` | Local development entry port |
| `LOCAL_IP` | LAN address used by local network mode |
| `HTTP_PORT` | HTTP listener for local network or domain mode |
| `HTTPS_PORT` | HTTPS listener for domain mode |
| `CADDY_INTERNAL_PORT` | Caddy port reached by tunnel containers |
| `TUNNEL_TYPE` | `cloudflare` or `ngrok` |
| `CF_TUNNEL_TOKEN` | Cloudflare Tunnel credential |
| `NGROK_AUTHTOKEN` | ngrok credential |
| `DOMAIN` | Public hostname used by Caddy and the backend |
| `FRONTEND_URL` | Allowed browser origin for CORS and Socket.IO |
| `TRUST_PROXY` | Enables trusted reverse-proxy address handling |

The complete environment contract is documented in `CONFIGURE.md` and
`.env.example`.

## Template and Override Model

The configurator selects the Caddy template and Compose override whose suffix
matches `DEPLOYMENT_MODE`. It then substitutes the required values and writes
the generated files to the repository root.

```text
Selected mode
    |
    +--> infrastructure/caddy-templates/Caddyfile.<mode>
    |        `--> Caddyfile
    |
    `--> infrastructure/docker-compose.<mode>.yml
             `--> docker-compose.override.yml
```

Docker Compose merges `docker-compose.yml` with
`docker-compose.override.yml`. Review the resolved configuration before a
production start:

```bash
docker compose config --quiet
docker compose config
```

For the hardened production topology, validate the explicit production file:

```bash
docker compose --env-file .env -f docker-compose.prod.yml config --quiet
```

## Security Architecture

### Network boundary

- Expose only the entry ports required by the selected mode.
- Keep MongoDB, Redis, backend, and frontend on private Docker networks.
- Restrict local network mode to a trusted subnet.
- Use tunnel profiles without publishing Caddy host ports.
- Restrict SSH separately and never expose administrative databases publicly.

### Reverse proxy

Caddy provides TLS termination, HTTP-to-HTTPS redirection in production/domain mode,
request routing, compression, WebSocket proxying, and response security
headers. Tunnel mode explicitly preserves the public HTTPS scheme so the
backend marks authentication cookies `Secure`. The active Caddyfile must
preserve `/api`, `/socket.io`, `/health`, and `/uploads` routing.

### Application and data

- Backend input is validated before business logic executes.
- CASL permissions and tenant ownership protect application resources.
- MongoDB authentication and the `rs0` replica set are required.
- Redis requires authentication in production.
- Access and refresh tokens must never be exposed in configuration output.
- Persistent volumes and backup files require restricted host permissions.

## Service Lifecycle

Prefer the universal lifecycle interface:

```bash
sudo ./scripts/install.sh status
sudo ./scripts/install.sh logs backend
sudo ./scripts/install.sh backup
sudo ./scripts/install.sh restart
```

Direct Compose commands remain useful for diagnosis:

```bash
docker compose up -d --wait
docker compose ps
docker compose logs -f
docker compose restart backend
docker compose down
```

Do not use `docker compose down -v` unless permanent deletion of database,
cache, uploads, and proxy state is explicitly intended. Follow `UNINSTALL.md`
for controlled decommissioning.

## Verification

Validate generated configuration before starting services:

```bash
./infrastructure/scripts/verify.sh
docker compose config --quiet
```

After startup, verify container and application health:

```bash
docker compose ps
curl --fail "${FRONTEND_URL}/health/ready"
curl --fail "${FRONTEND_URL}/health/live"
```

`FRONTEND_URL` must be the configured browser-facing origin, including HTTPS
for domain and tunnel deployments. Checking through Caddy verifies the real
external route rather than only the backend container.
The backend exposes these health endpoints:

| Endpoint | Purpose |
|----------|---------|
| `/health` | Detailed dependency status |
| `/health/ready` | Readiness for application traffic |
| `/health/live` | Process liveness |
| `/health/simple` | Minimal compatibility check |
| `/metrics` | Prometheus-format exposition on the backend network; not routed publicly by Caddy |

## Backup and Restore

Create authenticated backups through the supported installer command:

```bash
sudo ./scripts/install.sh backup
```

The archive contains MongoDB, uploads, and the configuration required to recover
the same installation. It includes a manifest and SHA-256 checksums and is
created with mode `0600`; it still contains personal data and secrets, so store
it encrypted and restrict access. Restore only a verified archive:

```bash
sudo ./scripts/install.sh restore /var/backups/disherio/disherio_backup_TIMESTAMP.tar.gz
```

Restore is destructive and requires explicit confirmation. Test restoration
against an isolated environment before relying on a backup. Detailed commands
and contents are documented in `CONFIGURE.md`.

## Scaling

The backend is designed to support multiple instances. Redis distributes
Socket.IO events and shared ephemeral state, while MongoDB remains the durable
source of truth.

```bash
docker compose up -d --scale backend=3
```

Horizontal scaling is valid only when the active proxy configuration balances
all backend instances and every instance uses the same MongoDB, Redis, secrets,
uploads strategy, and trusted proxy settings. Production capacity planning must
also account for connection limits, persistent storage, and backup behavior.

## Troubleshooting

### Generated files are missing

Run the configurator from the repository root and confirm that the current user
can write `.env`, `Caddyfile`, and `docker-compose.override.yml`.

```bash
./infrastructure/scripts/configure.sh
./infrastructure/scripts/verify.sh
```

### Variables remain unsubstituted

Regenerate the configuration and inspect the resolved Compose model. Do not
start the stack when literal `${VARIABLE}` placeholders remain in required
fields.

```bash
docker compose config
```

### Devices cannot connect on the local network

- Confirm that `LOCAL_IP` matches the host LAN address.
- Confirm that Caddy listens on the configured `HTTP_PORT`.
- Allow that port from the trusted subnet in the host firewall.
- Test host reachability from another device before debugging the application.

### Tunnel does not connect

- Confirm that the selected profile matches `TUNNEL_TYPE`.
- Confirm that the credential is present without printing it.
- Inspect `cloudflared` or `ngrok` logs.
- Confirm that the tunnel container can reach Caddy over `tunnel_net` and has
  outbound internet access.

### Certificate issuance fails

- Confirm that the domain resolves to the correct public address.
- Confirm that inbound ports `80` and `443` reach Caddy.
- Confirm that no other service owns those ports.
- Inspect Caddy logs for the exact ACME error.

### WebSocket connections fail

- Confirm that `/socket.io/*` is routed to `backend:3000`.
- Confirm that the public origin matches `FRONTEND_URL`.
- Confirm that proxy headers are trusted only in proxy-backed modes.
- Check browser network diagnostics and backend logs without exposing cookies or
  tokens.

Additional operational failures and diagnostic procedures are documented in
`ERRORS.md`.

## Release Pipeline

`.github/workflows/ci.yml` checks TypeScript and runs backend and frontend tests
for `main`, `develop`, and their pull requests. Backend integration tests start
MongoDB as replica set `rs0`. Non-pull-request runs publish amd64 and arm64
backend and frontend images to GHCR.

The workflow does not deploy to staging or production. Publishing starts only
after backend and frontend checks succeed, builds both multi-platform images,
and verifies both image publications before package cleanup. Actions and base
images are pinned to reviewed immutable revisions. A successful workflow proves
build, test, and image publication results; it does not prove deployment. Any
future deployment automation must use protected environments, immutable image
references, post-deploy readiness checks, and a documented rollback path.

## Active-session index rollout

The `unique_started_session_per_totem` partial unique index enforces one active
session per totem. Before upgrading an existing database, check for duplicate
`STARTED` sessions and resolve them deliberately; index creation fails closed
when duplicates exist. Run `backend/scripts/init-mongo.js` during the rollout,
then run `backend/scripts/verify-indexes.js` and confirm that the unique partial
index is reported as present before accepting traffic.

## Payment archive index rollout

Archived history relies on one unique `Payment` per session and on the
`restaurant_id, payment_date` history index. Fresh databases create both from
`backend/scripts/init-mongo.js`. Existing databases may still contain the
former non-unique `session_id_1` index. Before changing it, stop payment writes
and group payments by `session_id` to detect duplicates. Reconcile any group
whose count exceeds one; then drop only the non-unique `session_id_1` index and
rerun the initialization script. Finally run
`backend/scripts/verify-indexes.js` and confirm that `session_id` is reported as
unique before accepting payment traffic. Index creation fails closed while
duplicates or the incompatible old index remain.

New payments include restaurant and table snapshots. Older payments remain
readable through their live totem relationship. A legacy payment whose
temporary totem was already deleted cannot have its missing table identity
reconstructed automatically; preserve backups when recovering that history.

## Order idempotency and customer-name index rollout

Order retries use the unique partial index on `orders(session_id, request_id)`.
Session customer uniqueness uses the normalized
`sessioncustomers(session_id, customer_name_key)` index. The Mongo initializer
backfills missing customer-name keys before creating the latter index and fails
if historical case-insensitive duplicates require reconciliation. Before an
existing deployment is upgraded, stop writes, back up the installation, run
`backend/scripts/init-mongo.js`, and then run
`backend/scripts/verify-indexes.js`. Do not resume traffic until both unique
indexes are reported as present.

## Extending Deployment Modes

Adding a mode requires a coherent update to all mode-dependent assets:

1. Add mode selection and validation to
   `infrastructure/scripts/configure.sh`.
2. Add `infrastructure/caddy-templates/Caddyfile.<mode>`.
3. Add `infrastructure/docker-compose.<mode>.yml`.
4. Extend `infrastructure/scripts/verify.sh`.
5. Update `quickstart.sh` if startup behavior differs.
6. Document the mode here and add verification coverage.

New modes must preserve the private data-network boundary, secret handling,
health checks, WebSocket routing, and rollback path.

## Related Documentation

- `INSTALL.md`: prerequisites and installation procedures.
- `CONFIGURE.md`: environment variables, maintenance, resource checks, and backups.
- `ARCHITECTURE.md`: application topology and design patterns.
- `ERRORS.md`: diagnostics and incident resolution.
- `UNINSTALL.md`: safe decommissioning and data removal.
