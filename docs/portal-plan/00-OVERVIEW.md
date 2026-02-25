# PlayRoom Portal: Cloud Relay Architecture Overview

**Version**: v3.0 Concept
**Status**: Code written, NOT YET TESTED
**Last Updated**: 2026-02-25

---

## Problem

Currently, guests must connect directly to the HA add-on server, which means the user must either:

1. **Port-forward** their Home Assistant instance to the public internet, or
2. Use a **VPN** or **Cloudflare Tunnel** to expose it

Both approaches expose the Home Assistant installation to public access, which introduces significant security risk. The PlayRooms server runs on the same instance as HA, alongside all smart home devices, automations, and personal data.

## Solution: PlayRoom Portal

A **lightweight cloud-hosted relay server** that separates the guest-facing interface from the Home Assistant installation entirely.

```
                    INTERNET
                       |
      +----------------+----------------+
      |                                 |
 [Guest Browser A]               [Guest Browser B]
      |                                 |
      +--------+   HTTPS/WSS   +-------+
               |                |
         +-----+----------------+-----+
         |     PLAYROOM PORTAL        |
         |  (Cloud VPS / Docker)      |
         |                            |
         |  - Express + Socket.IO     |
         |  - Serves guest PWA        |
         |  - Relays messages         |
         |  - NO database             |
         |  - NO device control       |
         |  - NO Intiface Engine      |
         |  - Stateless               |
         +--------+------------------+
                  |
                  | Socket.IO (WSS)
                  | OUTBOUND from HA
                  | (no port forwarding needed)
                  |
         +--------+------------------+
         |     HA ADD-ON SERVER       |
         |  (User's home network)     |
         |                            |
         |  - Full Express + SIO app  |
         |  - Buttplug.io devices     |
         |  - SQLite database         |
         |  - Source of truth         |
         |  - Relay client module     |
         +----------------------------+
                  |
           [Buttplug Devices]
```

### Key Principle: HA Connects Outbound

The HA add-on initiates the connection **outbound** to the portal via Socket.IO client. This means:

- **No port forwarding** required on the user's router
- **No public exposure** of the Home Assistant instance
- The user's home network remains private
- The portal is the only thing exposed to the internet

### Key Principle: Thin, Stateless Relay

The portal does NOT contain business logic. It:

- Forwards messages between guests and HA
- Serves the guest React PWA (static files)
- Proxies token validation requests to HA
- Manages guest socket lifecycle

It does NOT:

- Store room data (no database)
- Control devices (no Buttplug/Intiface)
- Validate tokens itself (always asks HA)
- Make authorization decisions (HA decides)

---

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Multi-instance** | Supported from day one | Portal can serve multiple HA installations via instance ID prefix routing in compound tokens |
| **Initial scope** | Core first | Device control, text chat, lobby/approval flow. WebRTC media relay deferred |
| **Deployment** | Same Docker image, mode flag | `PORTAL_MODE=true` env var switches behavior. One image to build and maintain |
| **Transport** | Socket.IO (persistent WebSocket) | Already used throughout the project; bidirectional; built-in reconnection |
| **Relay thickness** | Thin relay | No database, no business logic on portal. HA is single source of truth |
| **Guest UI** | Same React PWA | Served by both HA and portal. Guest routes already separate from host routes |
| **Portal persistence** | None (fully stateless) | All state is in-memory, reconstructed from HA on reconnect |

---

## VPS Requirements

The portal is extremely lightweight. A minimal VPS is more than sufficient:

| Resource | Minimum | Why |
|----------|---------|-----|
| **CPU** | 1 core | Relay is I/O-bound (message forwarding), not CPU-bound |
| **RAM** | 1 GB | Node.js idle: ~30-50MB. Each Socket.IO connection: ~50KB. OS overhead: ~200-300MB. Leaves ~700MB for ~1000+ concurrent guests |
| **Storage** | 5 GB (20 GB typical VPS) | Node.js app + dependencies < 200MB. No database files. Logs are the main consumer |
| **Bandwidth** | 100 GB/month minimum | Socket.IO messages are small (device commands, chat, state updates). WebRTC video/voice goes P2P directly between browsers, does NOT transit the portal |

### Cost Estimate

Typical cheap VPS plans that work:

- **DigitalOcean Basic Droplet**: $4-6/month (1 CPU, 1GB RAM, 25GB SSD)
- **Hetzner Cloud CX22**: ~$4/month (2 CPU, 4GB RAM, 40GB SSD)
- **Vultr Cloud Compute**: $5/month (1 CPU, 1GB RAM, 25GB SSD)
- **OVH Starter VPS**: ~$4/month (1 CPU, 2GB RAM, 20GB SSD)
- **Railway / Fly.io**: Free tier may work for light use; ~$5/month for consistent use

### Why So Lightweight?

1. **No database** — SQLite stays on HA, portal has zero persistence
2. **No Intiface Engine** — Device control binary stays on HA (this is the heaviest component)
3. **No media relay** — WebRTC video/voice streams go peer-to-peer between browsers via STUN/TURN
4. **Stateless** — Portal just forwards Socket.IO messages; minimal memory per connection
5. **Static file serving** — React PWA is pre-built, served from disk, browser-cached

---

## Data Flow Summary

### Guest Joins a Room

```
1. Host creates share link on HA
   POST /api/rooms/:id/share → returns compound token with instance prefix

2. Guest opens portal URL
   https://portal.example.com/join/a1b2c3d4_XkZ9mN7pQ2rT5wY8vU3sL

3. Portal serves React PWA (static files)

4. Guest PWA validates token
   GET /api/join/a1b2c3d4_XkZ9mN7pQ2rT5wY8vU3sL
   Portal extracts prefix "a1b2c3d4" → finds HA instance → relay:validate:request → HA validates → relay:validate:response → Portal returns room info

5. Guest connects via Socket.IO to Portal
   Portal assigns portalGuestId → relay:guest:connect → HA

6. Guest interactions relay through Portal
   device:command → relay:upstream → HA → toyboxService → device
   chat:message → relay:upstream → HA → chatService → relay:downstream:room → Portal → all guests
   device:state change → HA → relay:downstream:room → Portal → all guests
```

### HA Disconnection

```
1. Portal detects HA socket disconnect
2. Guests see "Host is temporarily offline. Reconnecting..."
3. Grace period (60s default, configurable via PORTAL_GRACE_PERIOD_MS)
4. If HA reconnects within grace period:
   - Portal sends relay:ha:reconnected with list of connected guests
   - HA re-registers guests, sends room state
   - Guests resume normally
5. If grace period expires:
   - Portal disconnects all guest sockets for that instance
   - Guests see "Host has gone offline"
```

---

## File Organization

All portal code lives in `buttplug-playrooms/server/src/portal/`:

```
server/src/portal/
  index.ts                 # Portal mode entry point (Express + Socket.IO)
  relay-namespace.ts       # /relay namespace: authenticate HA, handle relay events
  instance-registry.ts     # Track connected HA instances (Map<instanceId, Socket>)
  guest-namespace.ts       # Default namespace: guest connections, event forwarding
  guest-bridge.ts          # Map guest sockets ↔ HA instances ↔ rooms
  token-cache.ts           # Brief validation cache (30s TTL)
  routes.ts                # GET /api/join/:token, GET /api/health, GET /api/portal/info

  relay-client.ts          # (HA mode only) Outbound Socket.IO client to portal
  relay-bridge.ts          # (HA mode only) Bridges relay events ↔ existing services
```

The portal mode is activated by setting `PORTAL_MODE=true` environment variable. The same Docker image runs either mode — the entrypoint (`index.ts`) branches at startup.

---

## Related Documentation

- [01-IMPLEMENTATION-STATUS.md](./01-IMPLEMENTATION-STATUS.md) — What's coded vs. what needs testing
- [02-RELAY-PROTOCOL.md](./02-RELAY-PROTOCOL.md) — Detailed relay protocol reference
- [03-TESTING-GUIDE.md](./03-TESTING-GUIDE.md) — Step-by-step testing checklist
- [04-DEPLOYMENT-GUIDE.md](./04-DEPLOYMENT-GUIDE.md) — VPS deployment instructions
- [05-FUTURE-WORK.md](./05-FUTURE-WORK.md) — WebRTC relay and roadmap
