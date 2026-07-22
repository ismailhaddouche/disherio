# Security Model and Audit Guide

This document is the canonical security reference for DisherIo. It separates
enforced controls, deployment assumptions, development-only behavior, and
accepted limitations so that an audit does not treat a client-side convenience
or an explicit deployment trade-off as a server-side authorization control.

Executable code and configuration remain authoritative. When this document and
the implementation differ, treat the difference as a documentation defect and
verify these sources first:

1. `backend/src/config/env.ts`, middleware, routes, services, and repositories.
2. `shared/schemas/` and backend-owned request schemas.
3. `docker-compose.yml`, infrastructure overrides, and Caddy templates.
4. `scripts/install.sh` and `infrastructure/scripts/*.sh`.
5. Tests and `.github/workflows/ci.yml`.

## Production Boundary

The supported Internet-facing modes are `domain` and `public-ip` tunnel mode.
They provide HTTPS at Caddy or the tunnel provider. `local` and `local-ip` use
plain HTTP and are intentionally limited to development or a controlled LAN;
they are not safe public-Internet modes. The universal installer refuses a bare
public-IP HTTP deployment.

The default Compose topology exposes Caddy only. MongoDB and Redis live on the
`internal: true` backend network; the backend is not published on a host port.
Tunnel mode removes Caddy host-port publication and connects only the tunnel
container to a separate outbound-capable network.

## Authentication and Browser State

- The access credential is an HS256 JWT with the algorithm pinned during
  verification. Its default lifetime is 15 minutes.
- The refresh credential is an opaque random value. Only its SHA-256 lookup
  hash and family state are stored in Redis. Rotation is atomic and reuse
  revokes the family.
- Both credentials are stored in `HttpOnly` cookies. Cookie options are
  `SameSite=Lax`, `Path=/`, and `Secure` when the actual request is HTTPS. The
  proxy header is honored only when Express trusts the internal proxy network.
- Logout blocklists the access token for its remaining lifetime, revokes the
  current refresh family, and disconnects the staff member's active sockets.
- Each token carries `authVersion`. Every protected HTTP request and staff
  Socket.IO handshake checks that value against the current staff record in
  MongoDB. Role assignment, credential changes, and staff deletion therefore
  invalidate existing access immediately rather than waiting for JWT expiry.
- Refresh rebuilds role and permission data from MongoDB; it does not copy a
  stale client payload.

The frontend stores a non-secret user projection, display preferences, and
permission names in `sessionStorage`. This state controls navigation and visual
elements only. It is deliberately not trusted by the API: changing it can make
the browser display a screen, but every protected HTTP route and Socket.IO
operation still requires a valid server credential, CASL permission, and tenant
ownership. An API rejection clears the UI state and returns the user to login.

## CSRF and Cross-Origin Requests

DisherIo does not use a synchronizer CSRF token. Cookie-authenticated mutations
are instead protected by the combination of:

- `SameSite=Lax` authentication cookies;
- an exact production CORS origin derived from `FRONTEND_URL`;
- rejection of origin-less credentialed CORS requests in production; and
- JSON-only mutation bodies, except validated multipart image uploads.

A cross-site form cannot submit an accepted JSON mutation, and a cross-site
script cannot send credentialed JSON without a successful CORS preflight.
Changing these controls, accepting form-encoded mutations, using
`SameSite=None`, or allowing arbitrary origins requires a dedicated CSRF token
design and a new security review.

## Authorization and Tenant Isolation

Frontend guards are usability controls. Backend middleware and write filters
are the authorization boundary.

- Protected routes authenticate the staff JWT and apply CASL action/subject
  checks where the operation requires a role permission.
- The restaurant identifier comes from the verified identity, not a client
  mutation body. Create/update schemas omit or reject client-supplied
  `restaurant_id` where appropriate.
- Tenant identifiers and entity identifiers use the shared 24-hex-character
  `ObjectIdSchema` or an equivalent route validator before database access.
- Repository updates strip ownership fields, and security-sensitive writes such
  as dish deletion/status changes include `restaurant_id` in the database
  mutation filter. Controller pre-checks are not the only tenant boundary.
- Assigning `role_id` through the staff administration endpoint is an intended
  administrator capability, not self-service profile editing. It requires the
  backend `update Staff` permission, verifies tenant ownership, and increments
  `authVersion`.
- Login without `restaurant_id` returns the same `INVALID_CREDENTIALS` response
  for missing, incorrect, and cross-restaurant ambiguous usernames.

## Input and Password Policy

Mutation schemas are strict by default: unknown JSON fields are rejected rather
than silently carried into persistence. Arrays, strings, monetary values, and
identifier lists have explicit bounds.

New and reset staff passwords use a length-based policy of 12 to 72 characters.
The project intentionally does not require uppercase/lowercase/digit/symbol
composition. The 72-character ceiling matches bcrypt's effective input bound.
Login accepts 1 to 128 characters for compatibility with existing hashes while
limiting attacker-controlled bcrypt work. Generated administrator passwords are
20 random alphanumeric characters and bcrypt uses a configurable cost of 10 to
15 (12 by default).

Fixed demo accounts (`cocinero`, `camarero`, and `cajero`) exist only when the
example seeder runs outside production. In production, example categories,
dishes, and a totem may be created after explicit confirmation, but the
fixed-credential staff accounts are skipped.

## Rate Limits and Redis Failure Behavior

Production HTTP limiters use a shared Redis store and propagate store errors;
they do not silently fall back to per-process counters. Development uses the
library's in-memory store, and rate limiting can be disabled only when
`NODE_ENV=development` and `DISABLE_RATE_LIMIT=true`.

| Scope | Limit |
|-------|-------|
| Failed login/refresh traffic | 5 per 15 minutes |
| General API | 1000 per 15 minutes |
| Strict mutations | 20 per 15 minutes |
| Uploads | 10 per hour |
| Public QR traffic | 30 per minute |
| QR probing | 10 per 15 minutes |

Socket.IO event limits also use Redis in production and fail closed when the
distributed counter cannot be checked. Redis cache use is optional, but
authentication revocation, refresh-token state, production HTTP rate limiting,
and distributed Socket.IO controls make Redis an availability dependency for
normal authenticated production traffic.

## Operational Endpoints

`/health`, `/health/ready`, `/health/live`, `/health/simple`, and `/metrics`
all pass through the backend `internalOnly` middleware. It accepts a request
from loopback/private address ranges or a matching `x-internal-token` when
`INTERNAL_API_TOKEN` is configured.

Caddy routes `/health*` so trusted LAN clients and infrastructure probes can
use it. Caddy explicitly returns `403` for `/metrics`; a collector must attach
to the internal backend network or use a separately controlled route and the
internal token. Private-network health access is an explicit operational trust
decision, not public anonymous access. Do not treat RFC1918 reachability as an
Internet authentication mechanism; protect the LAN and Docker socket.

## Secrets and Environment Validation

`.env.example` is a catalog, not a usable production configuration. Sensitive
example values are empty. Production validation rejects missing required
secrets, equal JWT secrets, known placeholder wording, invalid durations, and
undersized JWT secrets.

The deployment configurators accept sensitive answers in memory, write them to
mode-`0600` files under `config/secrets/`, and remove their values from `.env`.
Compose exposes file paths such as `JWT_SECRET_FILE` to containers. MongoDB,
Redis, JWT, administrator, Cloudflare Tunnel, and ngrok credentials are not
stored as container environment values. `config/secrets/` is excluded both by
the root `.gitignore` and `config/.gitignore`.

The repository uses Compose file-backed secrets, not Docker Swarm's encrypted
secret store. Host root access and access to the project directory therefore
remain trusted. Operators needing centralized rotation or hardware-backed
storage must integrate an external secret manager.

The installer writes the initial administrator credential only to
`.credentials` with mode `0600`; installation summaries and `status` report its
location without printing the password. Tunnel tokens are read by cloudflared
with `--token-file` and by ngrok from its mode-`0600` version-3 configuration.
Mongo health and initialization scripts authenticate after reading the secret
inside `mongosh`; passwords are not placed in the `mongosh` argument list.

## Container and Network Hardening

MongoDB runs as UID/GID `999`, and the replica initializer runs with the same
unprivileged identity. Both drop all Linux capabilities, enable
`no-new-privileges`, use a read-only root filesystem, and receive only explicit
writable volumes/tmpfs. Backend, frontend, and Caddy also declare unprivileged
runtime users. Redis drops all capabilities, enables `no-new-privileges`, and
uses a read-only root filesystem with only its data volume and `/tmp` writable.
Seed jobs inherit the backend image's non-root user. Optional tunnel containers
are isolated from `backend_net`, receive only their provider secret, and publish
no host port. Image references are pinned by digest.

MongoDB's data volume is necessarily writable. `read_only: true` protects the
container root filesystem; it is not meant to make database storage immutable.

## Upload and URL Handling

Uploads are bounded and checked for allowed extension, declared MIME type,
magic bytes, double extensions, decode validity, image dimensions, and unsafe
names. Sharp writes a processed WebP file under an allow-listed subdirectory.
Final containment uses `path.relative`, including Windows drive/path semantics,
rather than a string-prefix comparison.

The Angular image URL pipe returns only parsed `http:` or `https:` URLs and
keeps Angular's normal context-aware sanitizer in the enforcement path. It does
not call a `bypassSecurityTrust*` API. `HttpUrlSchema` allows HTTP(S) hosts,
including private hosts, because the backend stores the string and never
dereferences or fetches it; this is not a server-side request forgery path. Any
future server-side URL fetcher must add DNS/IP rebinding-aware private-network
blocking before reuse of that schema.

## CSP and Transport Exceptions

Production/domain/tunnel CSP allows encrypted `wss:` connections only.
`local` and `local-ip` allow `ws:` because those explicit HTTP modes cannot use
WSS. `style-src 'unsafe-inline'` remains because Angular emits runtime styles;
`script-src` does not allow `unsafe-inline` or `unsafe-eval`. Frames, plugins,
foreign form targets, and foreign base URIs are denied.

Domain mode uses TLS 1.3 minimum, HSTS, automatic certificate renewal, and
`X-Frame-Options: DENY`. `local-ip` has no HSTS because HSTS is meaningful only
over HTTPS. Publishing `local-ip` through port forwarding is unsupported.
The frontend image contains an inner Caddy process reachable only through the
outer Caddy service. HSTS belongs to that public TLS terminator; its absence in
`frontend/Caddyfile.frontend` is not a missing public response header.

## Public QR Capability

A printed table QR is a bearer capability. Possession starts or joins the
current table session; it is not proof that the holder is physically present.
The per-session UUID stored in the public tab's `sessionStorage` binds later
HTTP and Socket.IO operations to that active session and rotates on reopen. It
reduces stale-session replay but does not turn a photographed static QR into a
presence credential.

LAN-only deployment can make remote reuse unreachable through the network
boundary. Internet-facing deployments that require proximity must add a
separate short-lived table code, staff approval, or trusted on-premises
assertion. This is an accepted product limitation, not a claim that TLS or rate
limiting proves presence.

## Logging, Backups, and Test Exceptions

Pino redacts credential fields, cookies, authorization headers, tokens, secret
variables, and connection strings. Route labels use templates instead of raw QR
values or identifiers. Audit lifecycle events are operational structured logs,
not an immutable compliance ledger.

Backups use authenticated `mongodump`, an archive manifest, per-file SHA-256
checksums, AES-256-CBC with PBKDF2 (600,000 iterations), and an outer HMAC-SHA256
envelope verified before decryption. New files end in `.tar.gz.enc` and use mode
`0600`. Legacy unauthenticated encrypted archives are accepted only for
migration and produce a warning.

ESLint enforces `@typescript-eslint/no-explicit-any` for production backend,
shared, and frontend TypeScript. The rule is disabled only in backend test files
and frontend `*.spec.ts` mocks, where framework doubles may require loose
typing. This test-only override is not a global production exception.

CI's MongoDB instance is an ephemeral test dependency on a disposable GitHub
runner. It has no production credentials and uses `--bind_ip_all` inside its
container, while Docker publishes it only on host loopback
(`127.0.0.1:27017`). Production MongoDB instead uses authentication, the
replica-set keyfile, the internal Compose network, and the hardening described
above.

## Audit Classification Checklist

Before reporting a finding, record all four fields:

1. The exact executable source and line that creates the behavior.
2. The deployment mode and whether `NODE_ENV` is production.
3. Whether the value controls only UI state or is trusted by the backend.
4. The database write filter or middleware that ultimately enforces the rule.

Do not merge distinct trust domains under one label: development credentials
are not production credentials, browser guards are not API authorization,
private health probes are not public metrics, and an accepted QR capability is
not a staff session.
