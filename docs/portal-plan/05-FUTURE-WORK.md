# Future Work: PlayRoom Portal Roadmap

Features and enhancements deferred from the initial portal implementation.

---

## Phase 6: WebRTC Signaling Relay

**Status**: Not yet implemented
**Priority**: High — required for video chat, voice chat, and webcam features through portal

### What Needs to Happen

Currently, WebRTC signaling events (`webrtc:offer`, `webrtc:answer`, `webrtc:ice`) are NOT in the `RELAY_ALLOWED_EVENTS` list. They are silently dropped by the portal.

This means:
- Video chat between a portal guest and the host does NOT work
- Voice chat (beyond PTT) does NOT work
- Webcam streaming does NOT work
- Push-to-talk (PTT) events ARE relayed (`voice:ptt-start`, `voice:ptt-end`)

### Implementation Plan

#### 1. Add WebRTC events to the allowlist

In `server/src/types/index.ts`:

```typescript
export const RELAY_ALLOWED_EVENTS: readonly string[] = [
  "device:command",
  "chat:message",
  "guest:join",
  "lobby:approve",
  "lobby:reject",
  "voice:ptt-start",
  "voice:ptt-end",
  // Phase 6 additions:
  "webrtc:offer",
  "webrtc:answer",
  "webrtc:ice",
] as const;
```

#### 2. Handle WebRTC events in relay-bridge.ts

Add cases to `handleUpstreamEvent()`:

```typescript
case "webrtc:offer":
case "webrtc:answer":
case "webrtc:ice":
  relaySignaling(io, sourceGuestId, roomId, event, data);
  break;
```

#### 3. Participant routing for mixed local/remote participants

The current `media.signaling.ts` routes WebRTC signals using Socket.IO socket IDs. Portal guests don't have local socket IDs — they have `portalGuestId`s.

Need to either:
- **Option A**: Extend `media.signaling.ts` to support virtual participant IDs (portal guests) alongside real socket IDs
- **Option B**: Handle all portal WebRTC routing in `relay-bridge.ts` without touching `media.signaling.ts`

Option B is cleaner:
- When a portal guest sends `webrtc:offer { to: "host" }`, relay-bridge delivers it to the host's local socket
- When the host sends `webrtc:answer { to: portalGuestId }`, relay-bridge sends it downstream to the portal
- When two portal guests exchange signals, relay-bridge sends the signal downstream to the target guest

#### 4. TURN Server Integration

WebRTC requires a TURN server for reliable NAT traversal when guests and host are on different networks (which is always the case with the portal architecture).

Current ICE config (in `client/src/lib/webrtc.ts`):
```typescript
iceServers: [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
]
```

STUN alone won't work behind symmetric NAT (common in mobile networks and corporate firewalls). Need to add TURN:

Options:
- **Self-hosted coturn** on the same VPS as the portal (~50MB RAM additional)
- **Twilio TURN** — managed service, $0.40/GB
- **Metered TURN** — free tier available
- **Xirsys** — free tier available

The TURN server URL would be:
- Configurable in the portal environment variables
- Injected into the guest PWA (via the SPA HTML template or a `/api/config` endpoint)
- Used by the guest's WebRTC PeerConnection

#### 5. Testing WebRTC through the Portal

- Host on HA (local browser) and guest on portal (different browser/device)
- Both should exchange SDP offers/answers through the relay
- Video/voice stream should flow P2P (via TURN if needed)
- Test with 2-4 participants (P2P mesh topology)

---

## Rate Limiting Enhancements

### Current State
- Guest events: 50/sec per socket (portal-side)
- Token validation: 20 per 60 seconds per IP (HA-side, existing)
- No per-IP connection limiting on portal

### Planned Improvements
- Per-IP connection rate limiting (max N new connections per minute)
- Per-IP concurrent connection limit (max N sockets per IP)
- Token validation rate limiting on portal (before forwarding to HA)
- Configurable limits via environment variables
- IP blocklist support

---

## Portal Admin Dashboard

A simple web UI for monitoring portal status:

- Connected HA instances (instanceId, prefix, connected duration, guest count)
- Connected guests (name, room, instance, connection duration)
- Event throughput metrics (events/sec relayed)
- Error log viewer
- Manual disconnect controls

This would be a new route protected by the relay secret (or a separate admin secret).

---

## Multi-Instance Management

### Current State
- Multi-instance is supported from day one (instance ID prefix routing)
- No UI for managing instances
- All instances share the same `RELAY_SECRET`

### Planned Improvements
- Per-instance secrets (map of `instanceId:secret` pairs)
- Instance registration via admin API (instead of shared secret)
- Instance naming and metadata
- Instance health monitoring (last heartbeat, connected duration)
- Rate limiting per instance (max guests per instance)

---

## Helmet and Security Headers

### Planned
- Add `helmet` npm package to portal dependencies
- Configure CSP headers for the guest PWA
- Add HSTS headers
- Add X-Frame-Options
- Add referrer policy

---

## Connection Status Indicators (Client UI)

### Current State
- No visual indicator of portal mode in the guest UI

### Planned
- "Connected via Portal" indicator in guest room view
- "Host offline — reconnecting..." overlay when HA disconnects
- "Connection restored" notification when HA reconnects
- Connection quality indicator (latency to portal)

The client can detect portal mode via `window.__PORTAL_MODE__` (injected by portal's SPA handler).

---

## Portal Docker Image Optimization

### Current State
- Same Dockerfile, `PORTAL_MODE=true` build arg skips Intiface Engine
- Full Node.js dependency tree installed (including `better-sqlite3`, `buttplug`, `drizzle-orm`)

### Planned
- Multi-stage Dockerfile that produces a smaller portal image
- Portal-only `package.json` excluding unused dependencies
- Alpine base image option for smaller footprint
- Target image size: < 100MB (vs current ~400MB+ with all dependencies)

---

## Event Buffering During HA Disconnect

### Current State
- When HA disconnects, guest events are dropped
- No buffering/queuing on the portal side

### Planned
- Queue up to N upstream events during HA disconnect (configurable, default 100)
- Replay queued events when HA reconnects
- Queue size limit with oldest-first eviction
- Chat messages prioritized over device commands in the queue

---

## Analytics and Logging

### Planned
- Structured JSON logging (for log aggregation services)
- Request/event metrics (Prometheus-compatible)
- Connection duration tracking
- Guest session analytics (join/leave timestamps)
- Optional webhook for portal events (instance connect/disconnect, guest connect/disconnect)

---

## Community Portal Hosting

### Concept
A centrally hosted portal that community members can use:

- Users register their HA instance on a community portal
- Per-instance secrets managed via a simple registration API
- Usage quotas per instance
- Shared infrastructure cost ($4-10/month for the portal VPS)

This is a future community initiative, not part of the core project.
