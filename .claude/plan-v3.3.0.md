# Plan: v3.3.0 — QA-Driven Bug Fixes + Logging Overhaul

## Context

v3.0.0 through v3.2.0 shipped as code-only (UNTESTED). This release fixes five bugs found during QA review and adds structured server logging as the first new feature. The goal is to stabilize the codebase before further feature work.

---

## BUG FIXES

### Bug 1 — Chat persistence broken (messages vanish on refresh)

**Root cause:** Host never receives chat history on socket connect. Guest history works (sent in `finalizeGuestJoin`, line 46-50 of `room.socket.ts`), but `handleHostConnection` (line 98) sends `room:state` only — no chat messages.

**Files to modify:**
- `server/src/rooms/room.socket.ts` — Add chat history delivery in `handleHostConnection`, after the `room:state` emit (line 117). Reuse `chatService.getRecentMessages(roomId, 50)` exactly as `finalizeGuestJoin` does.

**Change:**
```typescript
// In handleHostConnection, after socket.emit("room:state", {...}):
const messages = chatService.getRecentMessages(roomId, 50);
for (const msg of messages) {
  socket.emit("chat:message", msg);
}
```

**QA checklist:**
- Host opens room → sends messages → refreshes page → messages still visible
- Guest joins open room → sees existing chat history
- Guest joins challenge room → approved → sees chat history
- New room with no messages → no errors on host connect

---

### Bug 2 — Device capabilities all false on `/api/devices/discovered`

**Root cause:** `getDiscoveredDevices()` in `client.ts` (line 110-112) finds live devices via a roundabout lookup through `discoveredDeviceMap`:
```typescript
const liveDevice = client?.devices.find(
  (d) => discoveredDeviceMap.get(d.index)?.identifier === record.identifier
);
```
This fails when `discoveredDeviceMap` hasn't been populated yet (async race in `handleDeviceAdded`) or the map was cleared (engine restart without re-discovery). When `liveDevice` is null, the fallback returns all-false capabilities (line 124-126).

**File to modify:**
- `server/src/buttplug/client.ts` — In `getDiscoveredDevices()`, replace the indirect map lookup with a direct name match. Since `record.identifier === device.name` (set in `handleDeviceAdded` line 137), match directly:

```typescript
const liveDevice = client?.devices.find(
  (d) => d.name === record.identifier
);
```

This eliminates the dependency on `discoveredDeviceMap` state for this function.

**QA checklist:**
- Start engine → scan → device appears with correct capabilities (vibrate/rotate/linear as appropriate)
- Stop scan → `GET /api/devices/discovered` still shows correct capabilities for connected devices
- Restart engine → re-scan → capabilities show correctly again
- Denied device shows `connected: false` and all-false capabilities (expected)

---

### Bug 3 — Scan status reports false while engine still scanning

**Root cause:** `isScanning()` (client.ts:243-245) returns `scanTimer !== null`, tying scan status to the timer rather than actual engine state. The auto-stop timeout callback (line 225-226) sets `scanTimer = null` *before* calling `stopScanning()`. If `client.stopScanning()` then throws, the engine continues scanning but `isScanning()` returns false.

**File to modify:**
- `server/src/buttplug/client.ts` — Track scan state with a dedicated boolean rather than the timer:

```typescript
let scanning = false;
```

Update `startScanning()`:
```typescript
export async function startScanning(): Promise<void> {
  if (!client?.connected) throw new Error("Buttplug client not connected");
  await client.startScanning();
  scanning = true;
  // ... timer setup unchanged ...
}
```

Update `stopScanning()`:
```typescript
export async function stopScanning(): Promise<void> {
  if (scanTimer) { clearTimeout(scanTimer); scanTimer = null; }
  if (!client?.connected) { scanning = false; return; }
  await client.stopScanning();
  scanning = false;
}
```

Update auto-stop timeout callback — remove `scanTimer = null;` from line 226 (let `stopScanning` handle it):
```typescript
scanTimer = setTimeout(async () => {
  try {
    await stopScanning();
    // ...
  } catch (err) {
    scanning = false; // fallback: assume stopped on error
    // ...
  }
}, config.scanTimeout);
```

Update `isScanning()`:
```typescript
export function isScanning(): boolean {
  return scanning;
}
```

Reset in `disconnectClient()`: set `scanning = false`.

**QA checklist:**
- Start scan → `GET /api/devices/scan/status` returns `scanning: true`
- Wait for timeout → status returns `scanning: false`
- Manual stop → status returns `scanning: false`
- Stop engine while scanning → status returns `scanning: false`
- Start scan, stop scan quickly → no stale true state

---

### Bug 4 — No delete confirmation on rooms

**Root cause:** `Dashboard.tsx:53-60` — `handleDelete` calls `rooms.delete(id)` immediately with no confirmation.

**File to modify:**
- `client/src/pages/Dashboard.tsx` — Add `window.confirm()` guard in `handleDelete`:

```typescript
async function handleDelete(id: string) {
  if (!window.confirm("Delete this room? This cannot be undone.")) return;
  try {
    await rooms.delete(id);
    setRoomList((prev) => prev.filter((r) => r.id !== id));
  } catch (err) {
    console.error("Failed to delete room:", err);
  }
}
```

**QA checklist:**
- Click trash icon → confirm dialog appears → click Cancel → room still exists
- Click trash icon → confirm dialog appears → click OK → room deleted
- Delete last room → empty state shown correctly

---

### Bug 5 — No device-to-room assignment UI

**Root cause:** Server endpoint `POST /api/devices/:id/assign` exists (index.ts:169-180), client API function `devices.assign` exists (api.ts:51-52), but zero client UI calls it. ToyBox.tsx:30 directs users to Settings, which has no assignment controls.

**Files to modify:**

1. **`client/src/components/room/RoomConfig.tsx`** — Add a "Devices" section after the Widgets section. Shows approved devices as a checkbox list. Checking assigns the device to this room; unchecking unassigns.

   - On mount, fetch `devices.list()` to get approved+connected devices and `GET /api/rooms/:id` to get currently assigned device IDs (from room.devices or a dedicated endpoint)
   - Use `devices.assign(deviceId, roomId)` on check
   - Need a new unassign endpoint or use assign with `roomId: null`

2. **`server/src/index.ts`** — Add `POST /api/devices/:id/unassign` endpoint calling `toyboxService.unassignDevice`. Or modify the existing assign endpoint to accept `roomId: null`.

3. **`client/src/lib/api.ts`** — Add `devices.unassign(id)` function, and add `devices.listAssigned(roomId)` or use existing data.

4. **`server/src/widgets/toybox.service.ts`** — `unassignDevice` (line 66-71) already exists and takes a `deviceId` (UUID). Need a route to expose it. Also add a `getDevicesForRoom` route if one doesn't exist (it's called server-side but not exposed as REST).

5. **`client/src/components/widgets/ToyBox.tsx`** — Update message from "Assign devices in Settings." to "Assign devices in Room Settings." (line 30).

**Approach details for RoomConfig:**
- Add props: `roomId: string`
- New state: `approvedDevices` (from `devices.list()`), `assignedDeviceIds` (from a new `GET /api/rooms/:id/devices` endpoint)
- Render device checkboxes below widget toggles
- On checkbox toggle: call assign or unassign, refresh list

**New server endpoints:**
- `GET /api/rooms/:id/devices` — returns `toyboxService.getDevicesForRoom(roomId)` (expose existing function)
- `POST /api/devices/:id/unassign` — calls `toyboxService.unassignDevice(id)`

**QA checklist:**
- Open Room Settings → approved devices appear as checkboxes
- Check a device → ToyBox shows the device
- Uncheck a device → ToyBox shows "no devices" message
- No approved devices → "No approved devices. Start Engine and approve devices in Settings." shown
- Guest opens room → sees only assigned devices in ToyBox
- Assign same device to two rooms → works (device shared between rooms)

---

## NEW FEATURE — Logging Overhaul

### Part 1 — Structured logger module

**New file:** `server/src/logger.ts`

Zero-dependency logger. No external packages needed (no NOTICE.md update).

```typescript
type LogLevel = "debug" | "info" | "warn" | "error";
type Subsystem = "Engine" | "Room" | "Chat" | "Device" | "ToyBox"
               | "WebRTC" | "Auth" | "API" | "Portal" | "PlayRooms" | "DB";

const LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
let minLevel: number = LEVELS.info;

function setLevel(level: LogLevel): void { minLevel = LEVELS[level]; }

function log(level: LogLevel, subsystem: Subsystem, message: string, ...args: unknown[]): void {
  if (LEVELS[level] < minLevel) return;
  const timestamp = new Date().toISOString();
  const prefix = `${timestamp} [${level.toUpperCase()}] [${subsystem}]`;
  const fn = level === "error" ? console.error
           : level === "warn" ? console.warn
           : console.log;
  fn(`${prefix} ${message}`, ...args);
}

// Convenience methods per subsystem:
function createLogger(subsystem: Subsystem) {
  return {
    debug: (msg: string, ...a: unknown[]) => log("debug", subsystem, msg, ...a),
    info:  (msg: string, ...a: unknown[]) => log("info",  subsystem, msg, ...a),
    warn:  (msg: string, ...a: unknown[]) => log("warn",  subsystem, msg, ...a),
    error: (msg: string, ...a: unknown[]) => log("error", subsystem, msg, ...a),
  };
}
```

Usage pattern: `const logger = createLogger("Engine");` then `logger.info("Started on port %d", port)`.

### Part 2 — `log_level` in config

**Files to modify:**

1. **`config.yaml`** — Add to `options` block after `device_stale_days`:
   ```yaml
   log_level: "info"
   ```
   Add to `schema` block:
   ```yaml
   log_level: "list(debug|info|warn|error)?"
   ```

2. **`server/src/config.ts`** — Add `logLevel` to `AppConfig` interface:
   ```typescript
   logLevel: LogLevel;
   ```
   In `loadConfig()`:
   ```typescript
   logLevel: ((haOptions.log_level as string) ?? process.env.LOG_LEVEL ?? "info") as LogLevel,
   ```

3. **`server/src/index.ts`** — At startup, call `setLevel(config.logLevel)` before any other logging.

### Part 3 — Engine log filtering

**File to modify:** `server/src/buttplug/engine.ts`

Replace raw `console.log/warn/error` with logger calls:
- `checkTransportHardware` — transport config lines → `debug`, hardware warnings → `warn`
- `buildEngineArgs` — no-transport warning → `warn`
- Engine stdout handler (line 161-163): default to `debug` level. Upgrade lines containing "error" or "ERROR" to `error`.
- Engine stderr handler (line 165-167): → `warn` (stderr isn't always fatal for Intiface)
- Start/stop/restart messages → `info`
- Errors → `error`

### Part 4 — Meaningful app logging across subsystems

Replace all ~73 `console.*` calls with structured logger calls. Add new log statements where coverage gaps exist.

| File | Subsystem | Changes |
|------|-----------|---------|
| `server/src/index.ts` | PlayRooms, API | Replace ~18 console calls. Startup/shutdown = info, route errors = error |
| `server/src/buttplug/engine.ts` | Engine | Replace ~20 console calls (see Part 3) |
| `server/src/buttplug/client.ts` | Device | Replace ~10 console calls. Device discovered/approved = info, commands = debug, errors = error |
| `server/src/rooms/room.socket.ts` | Room | Replace ~4 console calls. Host/guest connect/disconnect = info. **Add:** lobby approve/reject = info |
| `server/src/widgets/toybox.service.ts` | ToyBox | **Add new:** device assign/unassign = info, command sent = debug (log device name, command, value) |
| `server/src/widgets/chat.service.ts` | Chat | **Add new:** message saved = debug (log room, sender, truncated msg) |
| `server/src/auth/middleware.ts` | Auth | **Add new:** auth failure = warn (log reason, IP) |
| `server/src/auth/cleanup.ts` | DB | Replace ~2 console calls |
| `server/src/webhooks/webhook.service.ts` | API | Replace ~2 console calls |
| `server/src/portal/*.ts` | Portal | Replace ~13 console calls |
| `server/src/buttplug/device-approval.ts` | Device | Replace ~1 console call |

**QA checklist (logging):**
- Default `log_level: info` → no debug-level noise in output
- Set `log_level: debug` → engine stdout, device discovery, commands visible
- Set `log_level: error` → only errors visible
- Engine stdout "Device found" messages appear at debug, not info
- Startup sequence logs with timestamps and [PlayRooms] tag
- Room join/leave logs with [Room] tag and room ID
- Device commands log with [ToyBox] tag showing device + command + value

---

## Files Summary

| File | Action | Items |
|------|--------|-------|
| `server/src/logger.ts` | **Create** | Logging Part 1 |
| `server/src/config.ts` | Edit | Logging Part 2 (add `logLevel`) |
| `config.yaml` | Edit | Logging Part 2 (add `log_level` option), bump version to 3.3.0 |
| `server/src/index.ts` | Edit | Bugs 1 (expose device routes), 5 (new endpoints), Logging Part 4 |
| `server/src/rooms/room.socket.ts` | Edit | Bug 1 (host chat history), Logging Part 4 |
| `server/src/buttplug/client.ts` | Edit | Bug 2 (capabilities lookup), Bug 3 (scan state), Logging Part 4 |
| `server/src/buttplug/engine.ts` | Edit | Logging Part 3 + 4 |
| `client/src/pages/Dashboard.tsx` | Edit | Bug 4 (delete confirmation) |
| `client/src/components/room/RoomConfig.tsx` | Edit | Bug 5 (device assignment UI) |
| `client/src/components/widgets/ToyBox.tsx` | Edit | Bug 5 (update message text) |
| `client/src/lib/api.ts` | Edit | Bug 5 (add unassign + listAssigned) |
| `server/src/widgets/toybox.service.ts` | Edit | Logging Part 4 |
| `server/src/widgets/chat.service.ts` | Edit | Logging Part 4 |
| `server/src/auth/middleware.ts` | Edit | Logging Part 4 |
| `server/src/auth/cleanup.ts` | Edit | Logging Part 4 |
| `server/src/webhooks/webhook.service.ts` | Edit | Logging Part 4 |
| `server/src/portal/*.ts` | Edit | Logging Part 4 |
| `server/src/buttplug/device-approval.ts` | Edit | Logging Part 4 |
| `CHANGELOG.md` | Edit | v3.3.0 entry |

## Implementation Order

1. **Logger module** — Create `logger.ts` + config changes (Part 1-2). Foundation for everything else.
2. **Bug 1** — Chat persistence (small, isolated server change)
3. **Bug 2** — Device capabilities (small, isolated change in same file)
4. **Bug 3** — Scan status (same file as Bug 2, do together)
5. **Bug 4** — Delete confirmation (one-line client change)
6. **Bug 5** — Device assignment UI (largest change — new UI, new endpoints)
7. **Logging Part 3-4** — Replace all console calls across server (bulk edit)
8. **CHANGELOG + version bump** — `config.yaml` version → 3.3.0, health endpoint version → 3.3.0

## Verification

1. `cd buttplug-playrooms/server && npx tsc --noEmit` — no type errors
2. `cd buttplug-playrooms/client && npx tsc --noEmit` — no type errors
3. `docker build buttplug-playrooms/` — image builds successfully
4. Manual QA per checklist items above
