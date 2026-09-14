# Socket.IO reliability and recovery review

Review date: 2026-09-14. Scope: staff and public Socket.IO connections used by
KDS, POS, TAS, and the customer totem, including authorization, room isolation,
multi-node state, reconnect behavior, missed events, and short network losses.

## Result

The real-time layer is protected by authenticated or QR-bound handshakes,
restaurant/session authorization, validated payloads, rate limits, and bounded
connection tracking. Every frontend profile now rejoins its rooms and reloads
the authoritative HTTP snapshot after a successful reconnect. This is required
because the standard Redis Pub/Sub adapter distributes live packets between
nodes but does not replay packets emitted while a client is offline.

The application tolerates short transport loss and repeated reconnects without
requiring a page refresh in the tested workflows. It cannot prevent a physical
network disconnection, and Socket.IO's default delivery remains at most once.
The recovery contract is therefore "reconnect and reconcile", not "every event
is durably delivered".

## Connection and authorization model

| Layer | Protection |
| --- | --- |
| Origin | Socket.IO CORS accepts only the configured `FRONTEND_URL` variants. |
| Staff handshake | HttpOnly access cookie (or explicit token for supported clients), HS256 verification, Redis blocklist, access-session check, and current staff `authVersion`. |
| Public handshake | `publicTotem: true` plus a valid permanent table QR. A bare public flag is rejected before the connection is accepted. |
| Public session | `totem:join_session` requires the current ephemeral session token. Later public events revalidate that bound token against MongoDB. |
| Profile authorization | KDS, POS, and TAS handlers are registered only for sockets with the matching permission. Staff sockets cannot execute public totem actions. |
| Tenant and room isolation | Every session join loads the session and verifies that its restaurant matches the authenticated staff restaurant. Mutations additionally require the socket's tracked session subscription. |
| Payloads | Shared Zod schemas or explicit type/identifier guards reject malformed event payloads without terminating the process. |
| Flood control | Concurrent connections and handshakes are limited by client address. Event families use stable staff/customer identities and Redis-backed counters in production. |

Default Socket.IO limits are:

| Scope | Default |
| --- | ---: |
| Concurrent connections per address | 300 |
| Handshakes per address per minute | 900 |
| Join/leave events per identity per minute | 600 |
| Order/state events per identity per minute | 30 |
| Staff message events per identity per minute | 60 |
| Public customer events per identity per minute | 20 |

The address defaults assume many restaurant devices share one public NAT
address and reserve enough handshake capacity for three full reconnect waves
per minute. Override the first two with
`SOCKET_MAX_CONNECTIONS_PER_ADDRESS` and
`SOCKET_MAX_HANDSHAKES_PER_MINUTE` after measuring the real installation.

## Recovery sequence

1. The client tries WebSocket first and may fall back to HTTP long-polling when
   WebSocket establishment fails. Reconnect delay grows from 1 to 5 seconds.
2. After five failed Socket.IO attempts, the client shows connection failure and
   starts a new connection cycle after 15 seconds while a view still owns the
   shared connection.
3. A successful reconnect re-emits every active KDS/POS/TAS/totem room join.
   Join handlers acknowledge only after authorization and room membership are
   complete; the client waits up to five seconds for all active joins in
   parallel.
4. Only after those acknowledgements (or their bounded timeout) does the
   connection service publish the recovery notification. A sequence guard
   prevents a delayed acknowledgement from an older transport cycle from
   publishing a second, stale recovery.
5. KDS reloads kitchen items (and stock when open); POS and TAS reload active
   sessions, the selected session, customers, totems, and menu data; the public
   totem refreshes its session token first and then reloads the active order
   view.
6. HTTP snapshots replace stale client state. Duplicate item events are guarded
   by item identifiers in the affected workspaces.

State-changing KDS and TAS commands do not update the UI optimistically. A
command rejected locally because the transport dropped reports a network error.
KDS commands also have a five-second confirmation timeout that reloads the
canonical kitchen snapshot.

## Defects corrected by this review

- Reconnects shorter than the old two-second UI polling interval could be missed,
  leaving POS or TAS stale; KDS and the totem had no full reconnect snapshot.
- The client forced WebSocket-only transport, so networks or proxies that could
  support long-polling had no fallback.
- Creating a connection while an existing manager was reconnecting could leave
  two competing managers and duplicate room joins.
- A rotated public session token could race the order reload, causing the order
  request to use the stale token.
- Repeated reconnects could leave overlapping HTTP snapshots in flight. A slow,
  older response could overwrite the newer POS, TAS, KDS, or totem state. Each
  view now applies only its latest request generation; KDS also refetches when a
  live item mutation arrives while its kitchen snapshot is in flight.
- Recovery snapshots could begin immediately after a room-join packet was sent,
  before the server had completed membership registration. All profile join
  handlers now return bounded acknowledgements and recovery waits for them.
- A public totem could queue its initial join while the Socket.IO Manager was
  connecting and then send the same join again from the connect handler. The
  connect/reconnect handler now exclusively owns disconnected-state joins.
- The low-level TAS event hub mutated the current table store before the
  table-aware coordinator checked the event session. Store mutations now have a
  single owner, so a late packet from the previous room cannot contaminate the
  newly selected table.
- A multi-permission staff socket overwrote its connection-tracker metadata on
  every handler registration, leaking per-profile tracker entries on disconnect.
- Domain disconnect handlers removed every socket listener, so the first cleanup
  handler could prevent sibling profile cleanup on a shared socket.
- Public customer disconnects removed local presence but left the Redis presence
  record until its 24-hour TTL. Shared presence is now removed on disconnect and
  join/table responses read the cluster-wide customer set. Those reads also
  reconcile Redis records with adapter-wide room membership and purge ghost
  entries left by an abrupt backend process crash. If adapter enumeration fails,
  the last shared snapshot is retained instead of reporting an empty table.
- The old 10 joins/minute limit could block a KDS that subscribes to more than ten
  active sessions, especially after a reconnect. The bounded limit is now 600.
- Rate-limit failures emitted only the generic `error` event while profile UIs
  listened for `kds:error`, `pos:error`, `tas:error`, or `totem:error`.
- KDS/TAS actions could be silently dropped if connectivity changed after the UI
  status poll but before `emit`.

## Automated verification

The browser fixture opens a real Socket.IO protocol connection, changes the
authoritative mocked API state while that connection is offline, forcibly drops
the transport, and verifies automatic reconnect plus snapshot repair. The
scenario runs for KDS, POS, TAS, and public totem at 360x800, 768x1024, and
1440x900. The KDS case performs two consecutive drops and misses two different
state transitions.

Run:

```bash
npm run test:ui --workspace=frontend -- --grep "brief network loss|repeated brief network losses"
npm run test --workspace=backend
npm run test --workspace=frontend
```

Backend regression coverage includes handshake authentication, token
revocation, malformed payloads, room authorization, rate-limit fallback,
multi-profile tracker cleanup, Redis-backed public presence, session close
coordination, and disconnect cleanup.

Final review verification: monorepo production build passed; backend tests
reported 455 passed and 25 environment-dependent skipped; frontend tests
reported 490 passed; the Edge browser matrix reported 156 passed, including
12 profile/viewport reconnect-recovery scenarios. Backend/frontend lint,
documentation validation, and `git diff --check` passed.

## Operational limits and further hardening

- A process crash, offline device, or partition can still lose a live server
  packet. Canonical snapshot reconciliation repairs current state, but it does
  not reconstruct transient notifications that are not persisted.
- Client-to-server Socket.IO commands are not an exactly-once channel. Critical
  future socket-only mutations should include a stable request ID, a durable
  idempotency record, and an acknowledgement/retry contract, or use an
  idempotent HTTP endpoint as the command channel. Public order creation already
  follows the latter model and carries a request ID.
- The Redis Pub/Sub adapter is not compatible with Socket.IO connection-state
  recovery. If durable packet replay becomes a requirement, evaluate the Redis
  Streams adapter or an application event log before enabling recovery.
- Production readiness depends on Redis. If a deployment scales the backend to
  multiple replicas, do not place a node into service unless its Socket.IO
  adapter is connected; the in-memory adapter is suitable only for a single
  backend process.
- The browser tests model abrupt repeated transport loss. Capacity certification
  for a particular restaurant still requires a staging environment with its
  real Caddy, Redis, MongoDB replica set, device count, Wi-Fi, latency, and load
  balancer. Record reconnect time, rejected handshakes, Redis latency, process
  memory, event lag, and stale-state incidents during that test.
