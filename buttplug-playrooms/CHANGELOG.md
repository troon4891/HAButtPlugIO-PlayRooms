# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.2.0] - 2026-02-26 (UNTESTED)

Device management overhaul: "Add New Device" modal, global per-device settings
(intensity caps, allowed commands), auto-blocking of disabled protocols, stable
device identifiers, engine restart, and scan timeout fixes.

**Status**: Code written, not yet tested.

### Added
- **Add New Device modal**: Full-screen overlay for device discovery with scan
  progress bar, countdown timer, and inline device settings
  - Scan timeout is server-enforced (configurable via `scan_timeout`, default 30s)
  - Devices grouped by status: New, Added, Blocked
  - Inline settings panel for approved devices (gear icon)
- **Global device settings**: Per-device limits that rooms cannot override
  - `maxIntensity` (0-100%) — caps the intensity slider in ToyBox
  - `allowedCommands` — restrict which commands a device accepts
  - `displayName` — user-friendly name override
  - Enforced server-side in `sendCommand()` before dispatching to engine
  - Visible read-only in room ToyBox (slider capped, blocked commands hidden)
- **Engine restart**: `POST /api/engine/restart` — stops scanning, disconnects
  client, restarts engine, reconnects. ~3s gap.
  - Protocol change banner: "Protocol settings changed. Restart engine for
    changes to take effect." with [Restart Now] button
- **Auto-block by protocol**: Devices matching disabled protocols are
  automatically denied and recorded in the blocked list. `device.stop()` called
  as a safety measure.
- **Forget device**: `DELETE /api/devices/:id` — completely removes a device
  record from the database. Available for both approved and blocked devices.
- **Stale device cleanup**: Auto-removes blocked devices not seen in N days
  (configurable via `device_stale_days`, default 90, 0 = disabled). Runs on
  startup. Only removes denied devices, never approved ones.
- **Scan status endpoint**: `GET /api/devices/scan/status` returns scanning
  state and configured timeout
- `GET /api/devices/:id/settings` and `PUT /api/devices/:id/settings` for
  global device settings CRUD

### Changed
- **Stable device identifier**: Changed from `bp_${index}_${name}` (broken
  across sessions because index changes) to `device.name` (stable). Existing
  device records will appear as new — re-approve them once.
- **Server-side scan timeout**: Engine scan is now auto-stopped server-side
  after configured timeout. Previously only the UI stopped polling but the
  engine kept scanning indefinitely.
- **Settings page redesign**: Replaced inline device scanner with "Add New
  Device" button + managed devices list with inline settings and blocked
  devices section
- **ToyBox global limits**: Intensity slider max is capped by device's global
  `maxIntensity` setting. Disabled commands hide their buttons. "max X%" label
  shown when capped.
- `getDeviceStates()` is now async (returns device global settings from DB)
- `getDevicesForRoom()` is now async and includes `globalSettings` in response
- `config.yaml`: Added `scan_timeout` and `device_stale_days` options
- Health endpoint version updated to `3.2.0`

### Fixed
- **Scan timeout bug**: `handleStartScan()` in Settings.tsx had a 30s timer
  that only cleared the UI polling interval but never called `stopScanning()`,
  causing the engine to scan indefinitely
- **Identifier instability**: Device approval was broken across engine restarts
  because `bp_${index}_${name}` used runtime index that changes each session

---

## [3.1.0] - 2026-02-26 (UNTESTED)

Device safety: three-pillar system to prevent the engine from auto-connecting to
every Bluetooth device in range. Adds engine lifecycle control, device approval
whitelist, and protocol-level filtering.

**Status**: Code written, not yet tested.

### Added
- **Engine lifecycle control**: Start/Stop Engine button in Settings — engine no
  longer auto-starts on boot (unless `scan_on_start: true` for backward compat)
  - `POST /api/engine/start` — starts engine + connects Buttplug client
  - `POST /api/engine/stop` — disconnects client + stops engine
  - `GET /api/engine/status` — returns `{ running, clientConnected }`
- **Device approval whitelist**: Discovered devices must be approved by the host
  before they appear in ToyBox or room assignment
  - New `approved_devices` DB table tracks every discovered device as
    pending/approved/denied
  - Previously-approved devices auto-approve on future scans
  - Settings UI shows pending devices with Approve/Deny buttons, approved with
    Revoke, denied behind a collapsible "Show denied" toggle
  - `GET /api/devices/discovered` — all discovered devices with approval status
  - `POST /api/devices/:id/approve|deny|reset` — change approval status
- **Protocol allowlist**: Host selects which device brands/protocols to recognize
  - New `allowed_protocols` DB table seeded with 18 known protocols
  - Only Lovense and Hismith enabled by default; host enables others as needed
  - Application-layer regex filtering on device names (no fragile engine config)
  - Collapsible protocol toggle grid in Settings UI
  - `GET /api/protocols` — list all protocols with enabled state
  - `PUT /api/protocols/:name` — toggle a protocol on/off

### Changed
- `config.yaml`: Version bumped to 3.1.0
- `index.ts`: Engine auto-start removed (start only via API or `scan_on_start`);
  8 new API endpoints added; health endpoint now includes `engine` field and
  reports version `3.1.0`
- `client.ts`: `deviceadded` handler now runs protocol filter → approval check;
  added `getDiscoveredDevices()` and `refreshDeviceStates()`
- `schema.ts`: Added `approvedDevices` and `allowedProtocols` Drizzle tables
- `migrate.ts`: v3.1.0 migration block + protocol seed data
- `api.ts`: Added `engine`, `protocols`, and device approval API methods + types
- `Settings.tsx`: Full redesign — engine controls, device scanner, discovered
  devices with approval UI, collapsible protocol toggles
- Health endpoint version corrected from `2.0.1` to `3.1.0`

---

## [3.0.0] - 2026-02-25 (UNTESTED)

Major architectural change: PlayRoom Portal — a cloud-hosted relay server that allows
guests to connect without exposing Home Assistant to the public internet.

**Status**: Code written, not yet tested. See `docs/portal-plan/` for full documentation.

### Added
- **PlayRoom Portal mode**: Same Docker image runs as a lightweight relay server
  when `PORTAL_MODE=true` is set. No Intiface Engine, no SQLite, no device control —
  just a stateless Socket.IO message relay.
- **HA outbound relay client**: HA add-on connects outbound to the portal via Socket.IO
  client (`socket.io-client`). No port forwarding required on the user's home network.
- **Multi-instance support**: Portal can serve multiple HA installations simultaneously
  via instance ID prefix routing in compound share tokens.
- **Relay protocol**: Full bidirectional relay protocol with typed envelopes
  (`RelayUpstream`, `RelayDownstream`, `RelayBroadcast`), guest lifecycle events,
  token validation forwarding, and application-level heartbeat.
- **Portal relay namespace** (`/relay`): Authenticated Socket.IO namespace for HA
  instance connections with shared secret authentication.
- **Guest relay namespace**: Default Socket.IO namespace on portal for guest connections
  with per-socket rate limiting (50 events/sec) and event allowlisting.
- **Token validation proxy**: Portal's `GET /api/join/:token` forwards validation to HA
  via relay channel with 30-second cache and 10-second timeout.
- **Compound share tokens**: When portal is configured, share links include an 8-char
  instance prefix (e.g., `a1b2c3d4_XkZ9mN7pQ2rT5wY8vU3sL`) for multi-instance routing.
- **Portal URL in share links**: Client UI shows cloud icon and generates portal-domain
  URLs when portal is configured.
- **Graceful disconnection handling**: 60-second grace period when HA disconnects from
  portal (configurable via `PORTAL_GRACE_PERIOD_MS`). Guest sockets stay connected
  during brief HA outages.
- **Relay bridge**: Dispatches portal relay events to existing HA service layer (lobby,
  chat, toybox, webhooks) without modifying those services.
- **Reconnection protocol**: Portal notifies HA of still-connected guests on reconnect;
  HA auto-re-registers and re-approves them.
- **Portal health endpoint**: `GET /api/health` returns connected instance count and
  guest count; HA health endpoint includes `portalConnected` status.
- **Portal info endpoint**: `GET /api/portal/info` on HA returns portal URL and instance
  prefix for client share link construction.
- **Dockerfile portal support**: `PORTAL_MODE=true` build arg skips Intiface Engine
  download; runtime `PORTAL_MODE` env var switches behavior.

### Changed
- `config.yaml`: Added `portal_url` and `portal_secret` options
- `config.ts`: Added `portalMode`, `portalUrl`, `portalSecret`, `portalInstanceId` fields
  with auto-generated persistent instance ID
- `run.sh`: Portal mode detection, portal env var exports
- `index.ts`: Portal mode branch at startup; conditional relay client + bridge initialization
- `share-links.ts`: Returns `portalUrl` and `portalToken` when portal is configured
- `ShareLink.tsx`: Uses portal URL for share links with cloud icon indicator
- `api.ts`: `ShareLink` type includes optional `portalUrl` and `portalToken` fields
- `types/index.ts`: Added 10 relay protocol types and event allowlist
- `package.json`: Added `socket.io-client@^4.8.0` dependency

### Not Yet Implemented
- WebRTC signaling relay (video chat, voice chat, webcam through portal) — Phase 6
- TURN server integration for NAT traversal
- Portal admin dashboard
- `helmet` security headers on portal
- Connection status indicators in guest UI
- Event buffering during HA disconnect

---

## [2.0.1] - 2026-02-25

### Fixed
- **Device broadcast**: Device state changes now emit all devices instead of only the first
- **Guest device permissions**: Guest device commands now verify the device is assigned to
  the guest's room before allowing control (prevents cross-room device access)
- **Host approval flow**: Guests in challenge/approval mode now properly join the room when
  approved by the host (previously the guest socket never joined the room or received
  chat history/media signaling after host approval)
- **Rejected guests**: Guests rejected by the host now receive an error message and are
  disconnected instead of silently hanging
- **PWA icons**: Fixed icon format mismatch — manifest now references the actual `.svg` files
  instead of non-existent `.png` files
- **Orphaned components**: Wired up `RoomConfig` and `ShareLink` components into the
  `RoomHost` page (were built but never imported)

### Changed
- Extracted duplicate guest-join logic into shared `finalizeGuestJoin` helper
- `RoomHost` page now uses dedicated `RoomConfig` component for room settings
  (accessible via "Room Settings" button in header)
- `RoomHost` page now uses dedicated `ShareLink` component for share link management
  with create, copy, and revoke support

---

## [2.0.0] - 2026-02-24

Forked from [HAButtPlugIO-PlayRooms](<!-- REPO_URL_PLACEHOLDER -->).
This release introduces standalone Docker deployment, user accounts,
two-tier guest profiles, API keys, room-scoped webhooks, and security hardening.

### Added
- **Standalone Docker mode**: Run outside Home Assistant with built-in user accounts
  - Auto-detects mode: HA ingress when `/data/options.json` present, standalone otherwise
  - JWT-based auth (HS256, zero external dependencies)
  - Initial admin setup via `POST /api/auth/setup`
- **User accounts** (`users` table): username/password with admin and host roles
- **Login security**: Login attempt tracking, hard lockout after 5 failures (15-min duration)
- **Two-tier guest system**:
  - Short-lived guests: ephemeral, session-based (existing behavior)
  - Long-lived guests: persistent profiles with optional passwords, activity tracking
  - Global guest profiles that can be invited to multiple rooms
  - Per-room configurable inactivity timeout for auto-expiring idle guest profiles
- **API keys**: Scoped, hashed keys for programmatic access (`rooms:read`, `rooms:write`,
  `devices:read`, `devices:write`, `guests:read`, `webhooks:manage`)
- **Room-scoped webhooks**: Outbound HTTP notifications with HMAC-SHA256 signing
  - Events: `guest:joined`, `guest:left`, `guest:approved`, `guest:rejected`,
    `device:connected`, `device:disconnected`, `device:assigned`, `command:sent`,
    `room:updated`, `room:deleted`, `chat:message`
  - Test ping endpoint for webhook verification
- **Rate limiting**: In-memory sliding window on login (5/min), public API (60/min),
  share link validation (20/min)
- **Periodic cleanup**: Expired share links, challenge codes, and inactive guest profiles
  removed automatically every hour

### Changed
- Challenge codes now use `crypto.randomInt()` instead of `Math.random()`
- Challenge codes persisted to database (survive server restart)
- Host WebSocket connections verified server-side (no longer trusts client `isHost` flag)
- CORS configurable via `CORS_ORIGINS` env var (defaults restricted in standalone mode)
- Password hashing uses Node.js `crypto.scrypt` (no external dependencies)
- Share links gain `guest_type` field (`short` | `long`) to control guest persistence

### Security
- Fixed: Host impersonation via client-provided `isHost` WebSocket query param
- Fixed: Predictable challenge codes from `Math.random()`
- Fixed: Challenge codes lost on server restart (moved to DB with 5-min expiry)
- Fixed: Unrestricted CORS `origin: "*"` in standalone mode
- Added: Rate limiting on authentication and public endpoints
- Added: Input validation on names (50 char), messages (2000 char), URLs (http/https)

---

> This project was forked from the original HAButtPlugIO-PlayRooms HA add-on.
> Versions prior to 2.0.0 refer to the upstream project.

---

## Version Control Notes

### Versioning scheme

- **X.0.0** — Major version (architecture changes, breaking changes)
- **X.X.0** — Minor version (new functionality)
- **X.0.X** — Patch version (bug fixes, security fixes, cleanup)
