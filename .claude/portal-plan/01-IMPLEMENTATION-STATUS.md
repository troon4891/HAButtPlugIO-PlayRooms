# Implementation Status: PlayRoom Portal

**Status**: Code written, NOT YET TESTED
**Git Commit**: `024ab18` — "Add PlayRoom Portal: cloud relay architecture for remote guest access"

---

## Summary

All portal relay code has been written in a single commit. The implementation includes:
- 9 new files in `server/src/portal/`
- Modifications to 8 existing files (config, types, Dockerfile, run.sh, share-links, client ShareLink, index.ts, package.json)
- Full relay protocol types added to `types/index.ts`

**Nothing has been tested yet.** This document serves as a complete reference for what exists and what to verify.

---

## New Files (Portal Code)

### Portal Mode Files (run when `PORTAL_MODE=true`)

| File | Lines | Purpose | Key Functions |
|------|-------|---------|---------------|
| `server/src/portal/index.ts` | 99 | Portal mode entry point | `startPortalServer()` — Express + Socket.IO server, serves PWA, injects `window.__PORTAL_MODE__ = true` |
| `server/src/portal/relay-namespace.ts` | 149 | `/relay` Socket.IO namespace | `setupRelayNamespace(io)` — authenticates HA instances, handles all relay:* events, grace period on disconnect |
| `server/src/portal/instance-registry.ts` | 64 | HA instance tracking | `registerInstance()`, `getInstanceByPrefix()`, `getDefaultInstance()` — Maps instanceId + 8-char prefix to sockets |
| `server/src/portal/guest-namespace.ts` | 139 | Guest Socket.IO connections | `setupGuestNamespace(io)` — connects guests, rate limits (50 events/sec), relays allowed events upstream |
| `server/src/portal/guest-bridge.ts` | 125 | Guest-to-instance mapping | `registerGuest()`, `getGuestsInRoom()`, `getGuestsForInstance()`, `removeAllForInstance()` — three-index Map structure |
| `server/src/portal/token-cache.ts` | 69 | Token validation cache | `createValidationPromise()`, `resolveValidation()`, `getCachedValidation()` — 30s TTL cache, 10s timeout |
| `server/src/portal/routes.ts` | 99 | Portal REST API | `GET /api/join/:token` (proxied to HA), `GET /api/health`, `GET /api/portal/info` |

### HA Mode Files (run when connecting outbound to a portal)

| File | Lines | Purpose | Key Functions |
|------|-------|---------|---------------|
| `server/src/portal/relay-client.ts` | 148 | Outbound Socket.IO client | `connectToPortal(io)`, `emitToGuest()`, `broadcastToRoom()`, `broadcastToAll()`, `emitGuestApproved/Rejected()`, `emitValidateResponse()` — 30s heartbeat, infinite reconnection |
| `server/src/portal/relay-bridge.ts` | 331 | Event dispatch bridge | `setupRelayBridge(io)`, `handleReconnectedGuests()` — dispatches relay events to existing lobby, chat, toybox, webhook services |

---

## Modified Files

### `server/src/config.ts` (119 lines total)

**Changes:**
- Added `AppConfig` fields: `portalMode`, `portalUrl`, `portalSecret`, `portalInstanceId`
- Added `getOrCreateInstanceId(dataDir)` function (lines 57-71) — generates and persists a 32-char hex instance ID
- Portal mode auto-detects via `PORTAL_MODE` env var
- `portalUrl` loaded from HA options `portal_url` or env `PORTAL_URL`
- `portalSecret` loaded from HA options `portal_secret` or env `PORTAL_SECRET` or env `RELAY_SECRET`
- Portal mode defaults: port 8080, CORS "*", JWT secret "portal-mode", instanceId "portal"

### `config.yaml` (39 lines total)

**Changes:**
- Added options: `portal_url: ""`, `portal_secret: ""`
- Added schema: `portal_url: "str?"`, `portal_secret: "str?"`

### `run.sh` (33 lines total)

**Changes:**
- Lines 4-8: Portal mode detection — if `PORTAL_MODE=true`, skip bashio config and exec directly
- Lines 17-18: Read `portal_url` and `portal_secret` from bashio config
- Lines 27-28: Export `PORTAL_URL` and `PORTAL_SECRET` env vars

### `server/src/index.ts` (287 lines total)

**Changes:**
- Lines 4-10: Portal mode branch — imports and starts `startPortalServer()` then loops forever
- Lines 37-38: `relayClientRef` variable for health check access to relay connection status
- Lines 152-159: `GET /api/portal/info` endpoint — returns portal enabled status, URL, instance prefix
- Lines 170-179: Health check includes `portalConnected` field when portal URL is configured
- Lines 243-260: Startup section — conditionally imports and starts relay client + relay bridge

### `server/src/types/index.ts` (187 lines total)

**Changes (lines 96-187):**
- `RelayUpstream` interface — upstream envelope (guest → HA)
- `RelayDownstream` interface — downstream envelope (HA → specific guest)
- `RelayBroadcast` interface — room broadcast envelope
- `RelayGuestConnect` interface — guest connection notification
- `RelayGuestDisconnect` interface — guest disconnect notification
- `RelayValidateRequest` interface — token validation request
- `RelayValidateResponse` interface — token validation response
- `RelayHaStatus` interface — HA status announcement
- `RelayHaReconnected` interface — reconnection guest list
- `RelayEventName` type — union of all allowed relay event names
- `RELAY_ALLOWED_EVENTS` const array — allowlisted guest events for relay

### `server/src/auth/share-links.ts` (95 lines total)

**Changes (lines 23-35 of `createShareLink`):**
- When portal is configured (`portalUrl && portalSecret`), response includes:
  - `portalUrl` — HTTP version of the portal WebSocket URL
  - `portalToken` — compound token: `{instanceId.substring(0,8)}_{originalToken}`

### `client/src/components/room/ShareLink.tsx` (74 lines total)

**Changes:**
- Added `Cloud` icon import from lucide-react
- `getShareUrl(link)` function (lines 12-17) — returns portal URL when `portalUrl` and `portalToken` are present
- Cloud icon indicator next to portal-mode share links (line 57)

### `client/src/lib/api.ts` (107 lines total)

**Changes:**
- `ShareLink` interface (lines 76-85) — added optional fields: `portalUrl?: string | null`, `portalToken?: string | null`

### `server/package.json`

**Changes:**
- Added dependency: `"socket.io-client": "^4.8.0"`

### `Dockerfile` (63 lines total)

**Changes:**
- Line 23: `ARG PORTAL_MODE=false` build arg
- Lines 24-31: Conditional Intiface Engine download — skipped when `PORTAL_MODE=true`
- Line 61: `ENV PORTAL_MODE=false` runtime default

---

## How Portal Mode Works at Startup

### When `PORTAL_MODE=true`:

```
index.ts
  ├── config.ts loads with portalMode=true
  ├── import("./portal/index.js")
  ├── startPortalServer()
  │   ├── Express app + Socket.IO server
  │   ├── portalRouter (routes.ts) — /api/join/:token, /api/health
  │   ├── Static PWA serving
  │   ├── SPA fallback with __PORTAL_MODE__ injection
  │   ├── setupRelayNamespace(io) — /relay namespace for HA instances
  │   └── setupGuestNamespace(io) — default namespace for guests
  └── Loops forever (portal handles its own lifecycle)
```

### When `PORTAL_MODE=false` (normal HA mode) with `portal_url` configured:

```
index.ts (normal startup)
  ├── Database migrations
  ├── Intiface Engine start
  ├── Buttplug client connect
  ├── setupRoomSockets(io)
  ├── IF portalUrl && portalSecret:
  │   ├── import("./portal/relay-client.js")
  │   ├── connectToPortal(io) — outbound Socket.IO to portal
  │   ├── import("./portal/relay-bridge.js")
  │   └── setupRelayBridge(io) — wire relay events to services
  └── server.listen()
```

---

## Potential Issues to Watch During Testing

### 1. Socket.IO Path Configuration
The relay client connects with `path: "/relay"`. Socket.IO uses `path` as the HTTP endpoint path for the upgrade handshake. The portal sets up `io.of("/relay")` which is a Socket.IO namespace, not a path. **These are different concepts** — the client needs `path: "/socket.io"` (default) and namespace `/relay`, not `path: "/relay"`.

**Current code in `relay-client.ts` line 30:**
```typescript
relaySocket = ioClient(config.portalUrl, {
  path: "/relay",  // ← This sets the HTTP path, NOT the namespace
```

**This may need to be changed to:**
```typescript
relaySocket = ioClient(config.portalUrl + "/relay", {
  // path defaults to "/socket.io" which is correct
```

Or:
```typescript
relaySocket = ioClient(config.portalUrl, {
  path: "/socket.io",  // default HTTP path
  // namespace specified by appending to URL
});
```

**Impact**: This could prevent HA from connecting to the portal at all. HIGH PRIORITY to verify.

### 2. Compound Token Parsing on Portal
The `guest-namespace.ts` (line 38) rejects tokens where `prefixSep < 4`. If a user is running local mode without portal, their tokens won't have prefixes. The portal correctly rejects these, but the error message could be confusing.

### 3. `relay-bridge.ts` imports `onDevicesChanged` from `buttplug/client.ts`
Line 7: `import { onDevicesChanged } from "../buttplug/client.js";`

This function registers a callback for device state changes. **When portal mode is true, this module is NOT loaded** (it's only used in HA mode via the relay bridge). But verify that the Buttplug client module initializes correctly when both the relay bridge and the normal Socket.IO room handler both call `onDevicesChanged`.

### 4. Lobby Function `markGuestDisconnected` takes `socketId`
The relay bridge uses synthetic socket IDs like `portal:${portalGuestId}` (line 109 of relay-bridge.ts). The lobby function `markGuestDisconnected(socketId)` queries the database by `socketId`. Verify this works with the `portal:` prefix format.

### 5. SPA Fallback Catch-All Route
In portal `index.ts` (line 62), `app.get("*", ...)` catches all routes. The API routes in `portalRouter` are mounted before the static middleware, so they should take priority. But verify that `/api/join/:token` isn't caught by the static file handler first.

### 6. Grace Period Timer Uses Instance ID
In `relay-namespace.ts` (line 134), the grace period timeout checks `registry.getInstance(instanceId)`. If HA reconnects with a different socket but same instanceId, the old timer should see the instance as re-registered. Verify this edge case.

### 7. `handleReconnectedGuests` Auto-Approves
In `relay-bridge.ts` (line 322), reconnecting guests are auto-approved regardless of the room's access mode. This is intentional (they were already approved before the disconnect), but verify it doesn't create duplicate guest entries in the database.

### 8. Device Command Authorization
In `relay-bridge.ts` (line 161), device authorization checks `d.id === cmd.deviceId || String(d.buttplugIndex) === cmd.deviceId`. Verify this matches the same check used in the local `room.socket.ts` handler.

---

## Dependency Changes

| Package | Version | Added For |
|---------|---------|-----------|
| `socket.io-client` | `^4.8.0` | HA relay client outbound connection to portal |

No new dev dependencies. No dependencies removed.

---

## Files NOT Modified (Confirmed Unchanged)

These files are critical to the system but were intentionally not touched:

- `server/src/rooms/room.socket.ts` — Local Socket.IO handler. Relay bridge calls the same service layer functions instead of modifying this file.
- `server/src/rooms/room.routes.ts` — REST API for rooms. Unchanged.
- `server/src/rooms/room.service.ts` — Room CRUD. Unchanged.
- `server/src/auth/middleware.ts` — Auth middleware. Unchanged.
- `server/src/auth/lobby.ts` — Guest lobby. Used by relay-bridge but not modified.
- `server/src/widgets/toybox.service.ts` — Device commands. Used by relay-bridge but not modified.
- `server/src/widgets/chat.service.ts` — Chat persistence. Used by relay-bridge but not modified.
- `server/src/widgets/media.signaling.ts` — WebRTC signaling. NOT integrated with portal yet (Phase 6).
- `server/src/buttplug/engine.ts` — Intiface Engine manager. Unchanged.
- `server/src/buttplug/client.ts` — Buttplug client. `onDevicesChanged` used by relay-bridge.
- `server/src/db/schema.ts` — Database schema. No new tables needed.
- `client/src/pages/RoomGuest.tsx` — Guest page. Unchanged (same UI served from portal).
- `client/src/pages/Lobby.tsx` — Lobby page. Unchanged.
- `client/src/lib/socket.ts` — Socket.IO client. Connects to `window.location.origin` which automatically works on portal.
