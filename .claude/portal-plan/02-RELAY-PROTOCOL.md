# Relay Protocol Reference

This document defines the complete Socket.IO relay protocol between the HA add-on and the PlayRoom Portal.

---

## Connection Architecture

```
HA Add-on                                Portal Server
(Socket.IO CLIENT)                       (Socket.IO SERVER)
    |                                         |
    |  ioClient(portalUrl + "/relay", {       |
    |    auth: { instanceId, secret },        |
    |    transports: ["websocket"]            |
    |  })                                     |
    +------------ WSS connection ------------>|  io.of("/relay") namespace
    |                                         |
    |  relay:ha:status { status: "ready" }    |
    |<--------- events flow both ways ------->|
    |                                         |

Guests (Browser)                         Portal Server
(Socket.IO CLIENT)                       (Socket.IO SERVER)
    |                                         |
    |  io(portalOrigin, {                     |
    |    query: { roomId, token, name }       |
    |  })                                     |
    +------------ WSS connection ------------>|  io (default namespace)
    |                                         |
```

**Important**: HA connects to the `/relay` **namespace** (not path). The Socket.IO client URL should be `portalUrl + "/relay"` or the namespace should be specified in connection options. See [01-IMPLEMENTATION-STATUS.md](./01-IMPLEMENTATION-STATUS.md) for a potential issue with this.

---

## Envelope Types

All relay messages between HA and Portal use typed envelopes defined in `server/src/types/index.ts`:

### RelayUpstream (Portal → HA)

Guest events forwarded from Portal to HA. Portal wraps each guest event in this envelope.

```typescript
interface RelayUpstream {
  sourceGuestId: string;    // Portal-assigned nanoid for this guest
  roomId: string;           // Room the guest is in
  event: string;            // Original Socket.IO event name (e.g., "device:command")
  data: unknown;            // Original event payload
}
```

### RelayDownstream (HA → Portal)

HA events targeted at a specific guest on the Portal.

```typescript
interface RelayDownstream {
  targetGuestId: string;    // Portal guest ID to deliver to
  event: string;            // Socket.IO event name to emit to guest
  data: unknown;            // Event payload
}
```

### RelayBroadcast (HA → Portal)

HA events broadcast to all guests in a room.

```typescript
interface RelayBroadcast {
  roomId: string;           // Room to broadcast to
  event: string;            // Socket.IO event name
  data: unknown;            // Event payload
  excludeGuest?: string;    // Optional: skip this guest (e.g., message sender)
}
```

### RelayGuestConnect (Portal → HA)

Sent when a guest's Socket.IO connection is established on the Portal.

```typescript
interface RelayGuestConnect {
  guestId: string;          // Portal-assigned nanoid
  roomId: string;           // From guest's connection query
  token: string;            // Compound token (prefix_originalToken)
  name: string;             // Guest display name
  code?: string;            // Challenge code (if provided)
}
```

### RelayGuestDisconnect (Portal → HA)

Sent when a guest disconnects from the Portal.

```typescript
interface RelayGuestDisconnect {
  guestId: string;          // Portal guest ID
  roomId: string;           // Room they were in
}
```

### RelayValidateRequest (Portal → HA)

Portal asks HA to validate a share link token (for the REST API `GET /api/join/:token`).

```typescript
interface RelayValidateRequest {
  requestId: string;        // Unique ID to correlate request/response
  token: string;            // Compound token to validate
}
```

### RelayValidateResponse (HA → Portal)

HA responds with token validation result.

```typescript
interface RelayValidateResponse {
  requestId: string;        // Matches the request
  valid: boolean;           // Whether the token is valid
  roomInfo?: {              // Room public info (if valid)
    id: string;
    name: string;
    accessMode: "open" | "challenge";
    challengeType: "code" | "approval" | null;
    maxGuests: number;
    widgets: string[];
    guestType?: "short" | "long";
  };
  error?: string;           // Error message (if invalid)
}
```

### RelayHaStatus (HA → Portal)

HA announces its status after connecting.

```typescript
interface RelayHaStatus {
  status: "ready" | "shutting-down";
  rooms?: Array<{ id: string; name: string }>;
}
```

### RelayHaReconnected (Portal → HA)

Portal tells HA which guests are still connected after a reconnection.

```typescript
interface RelayHaReconnected {
  guests: Array<{
    guestId: string;        // Portal guest ID
    roomId: string;
    name: string;
  }>;
}
```

---

## Event Reference

### Portal → HA Events (Upstream)

| Event Name | Payload Type | When Sent |
|------------|-------------|-----------|
| `relay:guest:connect` | `RelayGuestConnect` | Guest Socket.IO connection established on Portal |
| `relay:guest:disconnect` | `RelayGuestDisconnect` | Guest disconnected from Portal |
| `relay:upstream` | `RelayUpstream` | Any allowlisted guest event (see below) |
| `relay:validate:request` | `RelayValidateRequest` | `GET /api/join/:token` REST call on Portal |
| `relay:ping` | (none) | Heartbeat every 30 seconds |

### HA → Portal Events (Downstream)

| Event Name | Payload Type | When Sent |
|------------|-------------|-----------|
| `relay:downstream` | `RelayDownstream` | Targeting a specific guest |
| `relay:downstream:room` | `RelayBroadcast` | Broadcasting to all guests in a room |
| `relay:downstream:all` | `{ event, data }` | Broadcasting to all guests for this instance |
| `relay:guest:approved` | `{ guestId }` | Guest was approved to join |
| `relay:guest:rejected` | `{ guestId, message? }` | Guest was rejected |
| `relay:validate:response` | `RelayValidateResponse` | Response to token validation |
| `relay:ha:status` | `RelayHaStatus` | After connect/reconnect |
| `relay:pong` | `{ timestamp }` | Heartbeat response |

### Portal → HA (on HA reconnect)

| Event Name | Payload Type | When Sent |
|------------|-------------|-----------|
| `relay:ha:reconnected` | `RelayHaReconnected` | Immediately after HA re-authenticates, if guests are still connected |

---

## Allowed Guest Events (Relay Allowlist)

Only these guest Socket.IO events are forwarded through the relay. Any other events are silently dropped.

```typescript
const RELAY_ALLOWED_EVENTS = [
  "device:command",     // Guest sends a device command
  "chat:message",       // Guest sends a chat message
  "guest:join",         // Guest submits challenge code
  "lobby:approve",      // (Future: portal-connected host approves)
  "lobby:reject",       // (Future: portal-connected host rejects)
  "voice:ptt-start",    // Push-to-talk start
  "voice:ptt-end",      // Push-to-talk end
];
```

**Not yet relayed** (Phase 6 - Future):
- `webrtc:offer`
- `webrtc:answer`
- `webrtc:ice`

---

## Authentication Flow

### HA → Portal Authentication

```
1. HA reads config: portalUrl, portalSecret, portalInstanceId
2. HA connects: ioClient(portalUrl + "/relay", { auth: { instanceId, secret } })
3. Portal /relay namespace middleware checks:
   - instanceId is present
   - secret matches config.portalSecret (RELAY_SECRET env var)
4. If valid: socket.data.instanceId = instanceId, connection proceeds
5. If invalid: connection rejected with "Authentication failed"
6. Portal registers instance in instance-registry (instanceId + 8-char prefix)
7. HA emits relay:ha:status { status: "ready" }
```

### Guest → Portal Authentication

```
1. Guest opens share link: https://portal.example.com/join/{compoundToken}
2. Portal serves React PWA (static files)
3. Guest PWA calls: GET /api/join/{compoundToken}
4. Portal extracts prefix from compound token (first 8 chars before "_")
5. Portal finds HA instance by prefix (instance-registry)
6. Portal sends relay:validate:request { requestId, token } to HA
7. HA strips prefix, validates original token against SQLite
8. HA responds relay:validate:response { requestId, valid, roomInfo }
9. Portal returns roomInfo to guest (or 404 error)
10. Guest PWA connects Socket.IO with query: { roomId, token, name }
11. Portal assigns portalGuestId (nanoid)
12. Portal sends relay:guest:connect to HA
13. HA creates pending guest in lobby system
14. HA auto-approves (open mode) or sends lobby:pending to host
```

---

## Compound Token Format

```
a1b2c3d4_XkZ9mN7pQ2rT5wY8vU3sL
|______| |_____________________|
 prefix      original token
 (8 chars)   (nanoid 21 chars)
```

- **Prefix**: First 8 characters of the HA instance's `portalInstanceId` (32-char hex)
- **Separator**: `_` (underscore)
- **Original token**: The standard nanoid(21) share link token, stored in HA's SQLite

The prefix routes the guest to the correct HA instance when the portal serves multiple instances.

### Token Generation (HA side)

```typescript
// In share-links.ts createShareLink()
const portalToken = `${config.portalInstanceId.substring(0, 8)}_${originalToken}`;
```

### Token Parsing (Portal side)

```typescript
// In guest-namespace.ts and routes.ts
const prefixSep = token.indexOf("_");
const prefix = token.substring(0, prefixSep);
const instanceId = registry.getInstanceIdByPrefix(prefix);
```

### Token Parsing (HA side, relay-bridge.ts)

```typescript
// Strips prefix to get original token for database lookup
function extractOriginalToken(compoundToken: string): string {
  const prefixSep = compoundToken.indexOf("_");
  if (prefixSep >= 4) {
    return compoundToken.substring(prefixSep + 1);
  }
  return compoundToken; // fallback: treat as-is
}
```

---

## Reconnection Protocol

### HA Disconnects from Portal

```
1. Portal detects socket disconnect
2. Portal logs: "HA instance disconnected: {instanceId} ({reason})"
3. Portal removes instance from registry
4. Portal emits error to all guests for that instance:
   { message: "Host is temporarily offline. Reconnecting..." }
5. Portal starts grace period timer (default: 60 seconds, env PORTAL_GRACE_PERIOD_MS)
6. Guest sockets stay connected to portal (NOT disconnected yet)

IF HA reconnects within grace period:
  7a. HA re-authenticates, re-registered in instance-registry
  8a. Portal emits relay:ha:reconnected with list of still-connected guests
  9a. HA relay-bridge calls handleReconnectedGuests():
      - Re-creates pending guests in lobby
      - Auto-approves them
      - Sends room state to each guest
  10a. Guests resume normal operation

IF grace period expires:
  7b. Portal checks if instance is still unregistered
  8b. Portal emits error to all guests: { message: "Host has gone offline" }
  9b. Portal disconnects all guest sockets
  10b. Portal removes all guests for that instance from guest-bridge
```

### Portal Crashes/Restarts

```
1. HA relay client detects disconnect (Socket.IO auto-reconnect with exponential backoff)
2. All guest browser Socket.IO clients also auto-reconnect
3. Portal restarts fresh (stateless, no data to recover)
4. HA reconnects, authenticates
5. Guests reconnect, go through join flow again (re-validate tokens)
6. Everything reconstructs from scratch
```

---

## Rate Limiting

### Guest Event Rate Limiting (Portal side)

```
- Max 50 events per second per guest socket
- Enforced by per-socket counter reset every 1 second
- Exceeded: guest receives error { message: "Rate limit exceeded" }
- Event is dropped (not forwarded to HA)
```

### Token Validation (HA side, existing)

```
- 20 validations per 60 seconds per IP
- Existing rate limiter in share-link validation route
- Applied on HA side; portal proxies without additional limiting currently
```

### Message Size Limit (Portal)

```
- Socket.IO maxHttpBufferSize: 1MB (1e6 bytes)
- Set in portal index.ts Socket.IO server configuration
```

---

## Synthetic Socket IDs

When a guest connects via the portal, the relay bridge creates a **synthetic socket ID** for use with the HA lobby system:

```
portal:{portalGuestId}
```

Example: `portal:Vk9mN7pQ2rT5wY8vU3sL`

This is stored in the `socketId` column of the `room_guests` database table. The lobby's `markGuestDisconnected(socketId)` function queries by this synthetic ID to find and disconnect portal guests.
