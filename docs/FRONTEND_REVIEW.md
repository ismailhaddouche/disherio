# Frontend profile review

Review dates: 2026-09-10–14. Scope: the existing Angular frontend; no redesign of
business permissions or payment contracts.

## Screen coverage

| Profile | Screens and states |
| --- | --- |
| Admin | Dashboard; dishes, categories, tables and staff lists plus create/edit forms; logs; settings |
| POS | Table selection, session items/customers, menu and dish configuration, pending ticket, closed-session payment preview |
| TAS | Table drawer, selected session, customer filters, orders, dish grid, pending cart |
| KDS | New/preparing/served tabs, stock controls, client order-state events |
| Customer | Welcome/name dialog, menu, dish configuration, cart, own orders |
| Access | Login, unauthorized, restricted-role navigation |

The route matrix covers 21 paths × 2 themes × 3 viewport sizes (126 checks).
Workflow and reconnect-recovery tests complement route rendering. Screenshots are generated per run;
these are review artifacts, not approved pixel-diff baselines.

## Shared visual rules

- Retain the existing Material 3 palette, typography, semantic surface/status
  tokens and light/dark themes. Use surface separation and restrained elevation.
- POS uses full-width Tables / Orders / Ticket navigation below 1280px; wider
  screens retain the three-panel workspace. No clipped central panel.
- Operational viewports use dynamic viewport height. Headers wrap on narrow
  screens; drawers and dialogs stay within the viewport; custom operational
  controls have at least 44px touch targets.
- Admin tables scroll horizontally within their container. Inputs can shrink
  within flex layouts; narrow-screen operational inputs use 16px type.
  Dashboard date labels stay with their inputs; category badges use a matching
  surface/text token pair for contrast in both themes.
- Customer menu cards use 2/3/4 columns as space increases, with a bounded
  desktop content width. Long table names truncate with a full title tooltip.
- The shared header offers a Material workspace menu only when the user has
  multiple permitted profiles. This does not replace route/API authorization.
- Theme initialization runs at the application root, so direct visits to Login
  and Access Denied also honor the saved light/dark preference.

## Functional corrections

- POS and TAS retain separate in-memory drafts per session. Switching tables
  resets the selected customer, dish configuration and payment preview.
- Late customer/order responses cannot populate a different table. Successful
  submissions consume only the submitted draft quantities, preserving additions
  made while waiting. Duplicate order/payment/temporary-table submissions are
  guarded where changed.
- Opening a table depends on that table's active session, not on whether any
  restaurant table is open. Temporary-table creation remains available.
- TAS closes the table drawer after selecting a session. Table/cart drawers
  support Escape; background session refreshes leave an open drawer in place.
  Served state is driven by the server event rather than an
  optimistic update that could falsely succeed while disconnected.
- Restaurant settings update shared name/currency signals; a late initial
  header load cannot revert a successful save.
- Public menus receive currency through their public display projection and
  use it throughout prices, extras, carts and order views. Menu loading no
  longer races session loading to overwrite the table name.
- KDS stock controls load the complete management dish list, including inactive
  dishes, so sold-out dishes can be re-enabled after reopening the screen.
- KDS, POS, TAS, and the public totem rejoin active rooms and reload canonical
  HTTP snapshots after reconnect. The public totem refreshes its session token
  before its order view. WebSocket-first connections can fall back to polling.

## Verification and limits

Final verification on 2026-09-11:

- Production frontend build: passed.
- Frontend unit tests: **490 passed**, including startup themes, table-draft
  isolation, delayed responses, reconnect token ordering, command-loss handling,
  and background-refresh drawer behavior.
- Edge browser suite: **156 passed** (126 route/theme/viewport checks and
  30 workflow/recovery checks), with no retries in the final run.
- Backend and frontend lint gates, browser-test TypeScript check, documentation
  checks and `git diff --check`: passed.
- The backend build and public-menu currency projection unit test also passed
  during this review (2026-09-10).

Run the commands in [Development](DEVELOPMENT.md#browser-ui-verification).
The browser suite uses isolated fixtures; no real order, payment, staff account,
or restaurant setting is created or modified. Unit tests exercise delayed
responses, draft isolation, shared settings, public currency projection, and
reconnect token ordering. Browser recovery fixtures force repeated transport
loss while canonical server state changes offline; KDS, POS, TAS, and public
totem repair their views on mobile, tablet, and desktop. See
[Socket.IO reliability](SOCKET_RELIABILITY.md).

The following still require a running backend/replica set/Redis and real devices:

- Live multi-device POS/TAS/KDS/customer concurrency and authorization through
  the deployed Caddy, Redis, MongoDB replica set, and restaurant Wi-Fi.
- Real payment persistence, archive/reopen conflicts, and printer integration.
- Propagation of menu/restaurant configuration changes to other already-open
  clients (the settings fix synchronizes the current application's shared state).
- Safari/iOS/Android keyboard behavior and screen-reader validation.

Passing these checks is evidence for the tested routes and scenarios, not a
guarantee that all possible bugs have been eliminated.
