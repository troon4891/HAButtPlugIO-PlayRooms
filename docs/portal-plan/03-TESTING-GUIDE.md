# Testing Guide: PlayRoom Portal

Step-by-step testing checklist for the PlayRoom Portal relay architecture.

**Prerequisites**: Node.js 20+, npm, the project cloned locally.

---

## Phase 0: Build Everything First

Before any testing, make sure the project compiles:

```bash
cd buttplug-playrooms/server
npm install
npm run build

cd ../client
npm install
npm run build

# Copy client build to server public dir (mimics Docker build)
mkdir -p ../server/public
cp -r dist/* ../server/public/
```

**Expected**: Both builds succeed with no TypeScript errors.

If the server build fails, check `01-IMPLEMENTATION-STATUS.md` for known potential issues.

---

## Phase 1: Portal Server Starts

### Test 1.1: Start Portal in Isolation

```bash
cd buttplug-playrooms/server

# Portal mode needs RELAY_SECRET
PORTAL_MODE=true RELAY_SECRET=test-secret-12345 npm start
```

**Expected output:**
```
[Portal] Starting PlayRoom Portal server...
[Portal] Portal server listening on port 8080
[Portal] Waiting for HA instances to connect on /relay namespace...
```

**Verify:**
- Server starts without errors
- No database initialization (no SQLite messages)
- No Intiface Engine startup attempt
- Port 8080 (not 8099)

### Test 1.2: Portal Health Endpoint

```bash
curl http://localhost:8080/api/health
```

**Expected:**
```json
{
  "status": "ok",
  "mode": "portal",
  "version": "2.0.1",
  "connectedInstances": 0,
  "connectedGuests": 0
}
```

### Test 1.3: Portal Serves PWA

Open `http://localhost:8080` in a browser.

**Expected**: React PWA loads (or JSON message saying "Frontend not built yet" if client wasn't built).

### Test 1.4: Portal Rejects Invalid Token

```bash
curl http://localhost:8080/api/join/invalid-token
```

**Expected**: `503` with `{ "error": "Host is offline" }` (no HA instances connected).

---

## Phase 2: HA Connects to Portal

### Test 2.1: Start HA with Portal Config

In a **separate terminal** (portal still running from Phase 1):

```bash
cd buttplug-playrooms/server

PORTAL_URL=ws://localhost:8080 \
PORTAL_SECRET=test-secret-12345 \
DATA_DIR=./test-data \
npm start
```

**Expected output (HA side):**
```
[PlayRooms] Auth mode: standalone
[PlayRooms] Running database migrations...
[PlayRooms] Starting Intiface Engine...
[PlayRooms] Connecting to portal: ws://localhost:8080
[Relay Client] Connecting to portal: ws://localhost:8080
[Relay Client] Connected to portal
[PlayRooms] Portal relay connected
[Relay Bridge] Relay bridge initialized
[PlayRooms] Server listening on port 8099
```

**Expected output (Portal side):**
```
[Portal] HA instance registered: {instanceId} (prefix: {8chars})
```

**If connection fails**: Check the Socket.IO path issue noted in `01-IMPLEMENTATION-STATUS.md` (potential `path: "/relay"` vs namespace issue).

### Test 2.2: HA Health Shows Portal Connected

```bash
curl http://localhost:8099/api/health
```

**Expected**: JSON includes `"portalConnected": true`.

### Test 2.3: Portal Health Shows HA Connected

```bash
curl http://localhost:8080/api/health
```

**Expected**: `"connectedInstances": 1`.

### Test 2.4: Portal Info Endpoint

```bash
curl -H "X-Ingress-Path: /test" http://localhost:8099/api/portal/info
```

**Expected:**
```json
{
  "enabled": true,
  "url": "http://localhost:8080",
  "instancePrefix": "{8 char hex}"
}
```

---

## Phase 3: Share Links with Portal URLs

### Test 3.1: Create a Room (on HA)

```bash
curl -X POST http://localhost:8099/api/rooms \
  -H "Content-Type: application/json" \
  -H "X-Ingress-Path: /test" \
  -d '{"name":"Test Room","accessMode":"open","maxGuests":10,"widgets":[{"type":"textchat","enabled":true,"settings":{}}]}'
```

**Expected**: Room created, note the `id`.

### Test 3.2: Create Share Link (on HA)

```bash
curl -X POST http://localhost:8099/api/rooms/{roomId}/share \
  -H "Content-Type: application/json" \
  -H "X-Ingress-Path: /test" \
  -d '{}'
```

**Expected**: Response includes `portalUrl` and `portalToken`:
```json
{
  "id": "...",
  "roomId": "...",
  "token": "XkZ9mN7pQ2rT5wY8vU3sL",
  "active": 1,
  "portalUrl": "http://localhost:8080",
  "portalToken": "a1b2c3d4_XkZ9mN7pQ2rT5wY8vU3sL",
  ...
}
```

### Test 3.3: Validate Token via Portal

```bash
curl http://localhost:8080/api/join/{portalToken}
```

**Expected**: Room info returned (name, access mode, widgets, etc.).

**Portal logs**: Should show the relay:validate:request being forwarded to HA.
**HA logs**: Should show token validation happening.

---

## Phase 4: Guest Connects via Portal

### Test 4.1: Guest Socket.IO Connection

This requires a browser or a Socket.IO client. Using the browser is easiest:

1. Open `http://localhost:8080/join/{portalToken}` in a **different browser** (not the one running HA dashboard)
2. The Lobby page should load
3. Enter a guest name
4. Click Join

**Expected (Portal logs):**
```
relay:guest:connect event sent to HA
```

**Expected (HA logs):**
```
[Relay Bridge] Portal guest "TestGuest" (portalGuestId) -> HA guest {haGuestId}
```

**Expected (Browser):**
- Guest enters the room view
- Can see room widgets (at least text chat)

### Test 4.2: Guest Chat via Portal

In the guest browser, send a chat message.

**Expected**:
- Message appears in the guest's chat
- On HA side, check that the message was saved to the database
- If a host browser is open on `http://localhost:8099`, the message should appear there too

### Test 4.3: Device Command via Portal (requires Buttplug)

If Intiface Engine is running with a connected device:

1. Assign a device to the room (via HA API)
2. As the portal guest, send a device command

**Expected**: Device responds. HA logs show the command going through `toyboxService.sendDeviceCommand()`.

**Without a real device**: This test can be deferred. The relay path can be verified by checking HA logs for the relay:upstream event with event="device:command".

---

## Phase 5: Lobby/Approval Flow via Portal

### Test 5.1: Challenge Mode Room

1. Create a room with `accessMode: "challenge"`, `challengeType: "approval"`
2. Create a share link for it
3. Open the portal share link as a guest
4. Guest should see "Waiting for host approval"

**Expected (HA logs):**
```
lobby:pending emitted to room:{roomId}:host
```

5. On the HA host dashboard, approve the guest

**Expected**: Guest receives `guest:approved` event and enters the room.

### Test 5.2: Code Challenge Mode

1. Create a room with `accessMode: "challenge"`, `challengeType: "code"`
2. Create share link, open as guest via portal
3. HA generates a 6-digit code (visible to host)
4. Guest enters the code

**Expected**: Guest is approved after correct code entry.

---

## Phase 6: Disconnection / Reconnection

### Test 6.1: HA Disconnects Briefly

1. Portal running, HA connected, guest connected via portal
2. **Kill the HA server** (Ctrl+C)

**Expected (Portal logs):**
```
[Portal] HA instance disconnected: {instanceId} (transport close)
```

**Expected (Guest browser):**
- Should receive error: "Host is temporarily offline. Reconnecting..."
- Guest socket should stay connected to portal

3. **Restart HA within 60 seconds**

**Expected (Portal logs):**
```
[Portal] HA instance registered: {instanceId} (prefix: {8chars})
relay:ha:reconnected emitted with N guests
```

**Expected (HA logs):**
```
[Relay Client] Reconnected with N guests still on portal
```

**Expected (Guest browser):**
- Guest should resume the room session (room state re-sent)

### Test 6.2: HA Disconnects Past Grace Period

1. Portal running, HA connected, guest connected via portal
2. Kill HA server
3. Wait > 60 seconds (or set `PORTAL_GRACE_PERIOD_MS=10000` for faster testing)

**Expected (Portal logs):**
```
[Portal] Grace period expired for instance {instanceId}, disconnecting guests
```

**Expected (Guest browser):**
- Should receive: "Host has gone offline"
- Socket disconnected

### Test 6.3: Portal Restarts

1. HA and guests connected via portal
2. Kill the portal server (Ctrl+C)
3. Restart the portal

**Expected**:
- HA relay client auto-reconnects (exponential backoff)
- Guest browsers auto-reconnect
- After reconnection, guests may need to re-validate (portal has no memory of previous state)

---

## Phase 7: Multi-Instance

### Test 7.1: Two HA Instances on One Portal

1. Start portal with `RELAY_SECRET=shared-secret`
2. Start HA instance A: `PORTAL_URL=ws://localhost:8080 PORTAL_SECRET=shared-secret DATA_DIR=./test-data-a SERVER_PORT=8099`
3. Start HA instance B: `PORTAL_URL=ws://localhost:8080 PORTAL_SECRET=shared-secret DATA_DIR=./test-data-b SERVER_PORT=8098`

**Expected (Portal):**
```
[Portal] HA instance registered: {instanceA} (prefix: {prefixA})
[Portal] HA instance registered: {instanceB} (prefix: {prefixB})
```

```bash
curl http://localhost:8080/api/health
# Expected: "connectedInstances": 2
```

4. Create rooms and share links on both instances
5. Guests using instance A's tokens should reach instance A
6. Guests using instance B's tokens should reach instance B

**Verify**: Instance isolation — guest A cannot receive events from instance B.

---

## Troubleshooting

### Portal starts but HA can't connect

**Symptom**: HA logs show `[Relay Client] Connection error: ...`

**Possible causes:**
1. **Wrong URL**: Check `PORTAL_URL` — must match the portal's address (include port)
2. **Wrong secret**: `PORTAL_SECRET` on HA must match `RELAY_SECRET` on portal
3. **Socket.IO path issue**: The relay client uses `path: "/relay"` which sets the HTTP endpoint path. This should instead use the namespace. See `01-IMPLEMENTATION-STATUS.md` issue #1
4. **Network**: Firewall blocking connections between HA and portal

### Token validation fails

**Symptom**: `GET /api/join/:token` returns 503 or 504

**Possible causes:**
1. No HA instance connected — check `GET /api/health` for `connectedInstances`
2. Token prefix doesn't match any connected instance
3. HA took too long to respond (10s timeout) — check HA logs
4. Original token expired or revoked in HA's database

### Guest connects but sees no room state

**Symptom**: Guest enters room but it's empty

**Possible causes:**
1. `sendRoomStateToPortalGuest()` failed — check HA logs
2. Room has no devices assigned / no chat history
3. Device state broadcast not reaching portal — check relay bridge `onDevicesChanged` handler

### Rate limiting kicks in

**Symptom**: Guest sees "Rate limit exceeded"

**Cause**: Guest is sending > 50 events per second to the portal.

**Fix**: This is working as designed. If you need higher limits during testing, modify `MAX_EVENTS_PER_SECOND` in `guest-namespace.ts`.
