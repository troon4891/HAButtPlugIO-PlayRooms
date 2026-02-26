# v3.1.0 — Device Safety: Engine Lifecycle Control, Approval Whitelist, Protocol Filtering

## Problem Statement

Currently, the Intiface Engine starts automatically on boot and — if `scan_on_start` is true — immediately begins scanning and connecting to **every compatible device** in Bluetooth/USB range. This causes:

1. **Privacy risk**: The engine auto-connects to neighbors' devices (e.g., a Lovense device in an adjacent apartment)
2. **No lifecycle control**: No way to start/stop the engine from the UI — requires restarting the entire add-on
3. **No approval gate**: Every discovered device is immediately available to assign to rooms
4. **Misleading UI**: "Scan for Devices" button implies device discovery, but the real issue is engine lifecycle management
5. **No protocol filtering**: The engine tries every supported protocol — even brands the host will never use

## Solution: Three Pillars

### Pillar 1 — Engine Lifecycle Control (Two-Step: Engine + Scan)
### Pillar 2 — Device Approval Whitelist (DB-Backed)
### Pillar 3 — Protocol Allowlist (Admin UI + Application-Layer Filtering)

---

## Pillar 1: Engine Lifecycle Control

### Concept

Replace the current auto-start behavior with explicit Start/Stop controls. The Settings page gets two independent controls:

1. **Engine toggle**: "Start Engine" / "Stop Engine" — controls the Intiface Engine process
2. **Scan button**: "Scan for Devices" / "Stop Scanning" — only enabled when engine is running

### Server Changes

#### `server/src/buttplug/engine.ts`

- `startEngine()` — already exists, no change needed
- `stopEngine()` — already exists, no change needed
- `isEngineRunning()` — already exists, no change needed

#### New API endpoints in `server/src/index.ts`

```
POST /api/engine/start    → starts engine + connects buttplug client
POST /api/engine/stop     → disconnects client + stops engine
GET  /api/engine/status   → { running: bool, clientConnected: bool, scanning: bool }
```

The existing scan endpoints stay as-is:
```
POST /api/devices/scan/start   (unchanged)
POST /api/devices/scan/stop    (unchanged)
```

#### Startup behavior change in `server/src/index.ts`

Current `start()` function (lines 208-265):
- Currently: always starts engine → connects client → optionally scans
- New: **skip engine start entirely** on boot. The engine only starts when the host clicks "Start Engine" in Settings.
- Exception: if `scan_on_start: true`, preserve the current auto-start behavior for backward compatibility.

#### `server/src/config.ts`

No new config options needed. `scan_on_start` already exists and implies "start engine + scan on boot."

### Client Changes

#### `client/src/lib/api.ts`

Add new engine API methods:
```typescript
export const engine = {
  start: () => request<{ status: string }>("/engine/start", { method: "POST" }),
  stop: () => request<{ status: string }>("/engine/stop", { method: "POST" }),
  status: () => request<{ running: boolean; clientConnected: boolean; scanning: boolean }>("/engine/status"),
};
```

#### `client/src/pages/Settings.tsx`

Redesign the top section:

**Before:**
```
┌─ Buttplug.io Connection ─────────────────────┐
│  🟢 Connected to Intiface Engine    [Refresh] │
└───────────────────────────────────────────────┘
┌─ Devices ─────────────────────────────────────┐
│  [Scan for Devices]                            │
│  No devices found. Start a scan...             │
└───────────────────────────────────────────────┘
```

**After:**
```
┌─ Intiface Engine ─────────────────────────────┐
│  Engine: 🔴 Stopped          [Start Engine]    │
│  Client: ⚫ Not connected                      │
└───────────────────────────────────────────────┘
┌─ Device Scanner ──────────────────────────────┐
│  [Scan for Devices]  (disabled — engine off)   │
│  Start the engine above to scan for devices.   │
└───────────────────────────────────────────────┘
```

When engine is running:
```
┌─ Intiface Engine ─────────────────────────────┐
│  Engine: 🟢 Running          [Stop Engine]     │
│  Client: 🟢 Connected                          │
└───────────────────────────────────────────────┘
┌─ Device Scanner ──────────────────────────────┐
│  [Scan for Devices]                            │
│  No devices found. Start a scan...             │
└───────────────────────────────────────────────┘
```

#### Health endpoint update

`GET /api/health` response adds engine status:
```json
{
  "status": "ok",
  "engine": true,
  "buttplug": true,
  "scanning": false,
  "version": "3.1.0",
  "transports": { ... },
  "authMode": "ha-ingress"
}
```

---

## Pillar 2: Device Approval Whitelist

### Concept

When devices are discovered via scanning, they DON'T automatically become available for room assignment. Instead:

1. Discovered devices appear in a **"Discovered Devices"** section with an Approve / Deny button
2. Only **approved** devices appear in the room assignment UI and ToyBox widget
3. Approval decisions are persisted in the database (by device name + protocol identifier)
4. Previously-approved devices are auto-approved on future scans (whitelist)
5. Denied devices are hidden from future scans (blacklist) unless manually un-denied

### Database Changes

#### New table: `approved_devices`

```sql
CREATE TABLE IF NOT EXISTS approved_devices (
  id TEXT PRIMARY KEY,
  device_name TEXT NOT NULL,        -- e.g. "Hismith Mini"
  identifier TEXT NOT NULL,         -- buttplug device name pattern or index key
  status TEXT NOT NULL DEFAULT 'pending',  -- 'approved' | 'denied' | 'pending'
  display_name TEXT,                -- optional custom name set by host
  first_seen_at INTEGER NOT NULL,
  approved_at INTEGER,
  updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_approved_devices_ident ON approved_devices(identifier);
```

#### `server/src/db/schema.ts`

Add Drizzle schema for `approved_devices`.

#### `server/src/db/migrate.ts`

Add v3.1.0 migration block.

### Server Changes

#### New file: `server/src/buttplug/device-approval.ts`

Core approval logic:
- `getApprovalStatus(deviceName: string, identifier: string)` → 'approved' | 'denied' | 'pending'
- `approveDevice(id: string)` → sets status = 'approved'
- `denyDevice(id: string)` → sets status = 'denied'
- `resetDevice(id: string)` → sets status = 'pending'
- `getApprovedDevices()` → all approved
- `getDeniedDevices()` → all denied
- `getPendingDevices()` → all pending
- `isDeviceApproved(deviceName: string, identifier: string)` → boolean

#### Modify `server/src/buttplug/client.ts`

When `deviceadded` fires:
1. Look up the device in `approved_devices` by name/identifier
2. If not found → insert as 'pending', emit `device:pending` event
3. If 'approved' → include in `getDeviceStates()` as normal
4. If 'denied' → exclude from `getDeviceStates()`

New function: `getDiscoveredDevices()` → returns ALL discovered devices with their approval status (approved/denied/pending).

The existing `getDeviceStates()` continues to return only approved + connected devices (backward compatible for ToyBox, room assignment, etc.).

#### New API endpoints in `server/src/index.ts`

```
GET    /api/devices/discovered       → all discovered devices with approval status
POST   /api/devices/:id/approve      → approve a device
POST   /api/devices/:id/deny         → deny a device
POST   /api/devices/:id/reset        → reset to pending
GET    /api/devices/approved          → approved devices only
```

The existing `GET /api/devices` continues to return only approved+connected devices.

### Client Changes

#### `client/src/lib/api.ts`

Add approval methods:
```typescript
export const devices = {
  // existing
  list: () => request<DeviceState[]>("/devices"),
  startScan: () => request<{ status: string }>("/devices/scan/start", { method: "POST" }),
  stopScan: () => request<{ status: string }>("/devices/scan/stop", { method: "POST" }),
  assign: (id, roomId, settings?) => request(...),
  // new
  discovered: () => request<DiscoveredDevice[]>("/devices/discovered"),
  approve: (id: string) => request<void>(`/devices/${id}/approve`, { method: "POST" }),
  deny: (id: string) => request<void>(`/devices/${id}/deny`, { method: "POST" }),
  reset: (id: string) => request<void>(`/devices/${id}/reset`, { method: "POST" }),
};
```

New types:
```typescript
export interface DiscoveredDevice {
  id: string;
  name: string;
  identifier: string;
  status: 'approved' | 'denied' | 'pending';
  displayName: string | null;
  connected: boolean;
  capabilities: DeviceCapabilities;
  batteryLevel: number | null;
  firstSeenAt: number;
}
```

#### `client/src/pages/Settings.tsx`

Add a **"Discovered Devices"** section below the scanner:

```
┌─ Discovered Devices ──────────────────────────┐
│                                                │
│  ✅ Hismith Mini           [Connected]         │
│     Vibrate · Rotate                           │
│                                                │
│  ⏳ Lovense Lush 3         [Pending]           │
│     Vibrate · Battery                          │
│     [Approve] [Deny]                           │
│                                                │
│  ❌ Unknown BLE Device      [Denied]           │
│     [Reset]                                    │
│                                                │
│  Show denied devices ▼                         │
└───────────────────────────────────────────────┘
```

- Pending devices get Approve/Deny buttons
- Approved devices show a green checkmark
- Denied devices are hidden by default behind a "Show denied" toggle
- Device list refreshes while scanning is active

---

## Pillar 3: Protocol Allowlist (Admin UI)

### Concept

A Settings section where the host selects which device **brands/protocols** the engine should recognize. This prevents the engine from even attempting to identify devices using protocols the host doesn't care about.

### Implementation Strategy

**Application-layer filtering** — When a device is discovered, we check if its protocol/brand matches the host's allowed protocols before adding it to the discovered list.

Rationale: The Intiface Engine's `--user-device-config-file` format for protocol allow/deny is poorly documented. Rather than generating fragile config files, we filter at our application layer where we have full control.

Future enhancement: Once the buttplug user-device-config file format for protocol allow/deny is better documented, we can optionally generate a config file and pass it via `--user-device-config-file` to prevent the engine from even scanning for disallowed protocols (more efficient, prevents BLE connections entirely).

### Database Changes

#### New table: `allowed_protocols`

```sql
CREATE TABLE IF NOT EXISTS allowed_protocols (
  id TEXT PRIMARY KEY,
  protocol_name TEXT NOT NULL UNIQUE,  -- e.g. "lovense", "hismith"
  display_name TEXT NOT NULL,          -- e.g. "Lovense", "Hismith"
  enabled INTEGER NOT NULL DEFAULT 1,  -- 1 = allowed, 0 = blocked
  updated_at INTEGER NOT NULL
);
```

Seed with known protocols on first migration:

| protocol_name | display_name | enabled |
|--------------|-------------|---------|
| lovense | Lovense | 1 |
| hismith | Hismith | 1 |
| wevibe | We-Vibe | 0 |
| kiiroo-v2 | Kiiroo | 0 |
| kiiroo-v21 | Kiiroo (v2.1) | 0 |
| magic-motion | Magic Motion | 0 |
| svakom | Svakom | 0 |
| libo | Libo | 0 |
| mysteryvibe | MysteryVibe | 0 |
| satisfyer | Satisfyer | 0 |
| prettylove | Pretty Love | 0 |
| motorbunny | Motorbunny | 0 |
| vorze-sa | Vorze | 0 |
| xinput | XInput (Gamepads) | 0 |
| lelo-f1s | LELO | 0 |
| aneros | Aneros | 0 |
| zalo | Zalo | 0 |
| lovehoney-desire | Lovehoney | 0 |

Default: only Lovense and Hismith enabled (the known/tested devices). Host enables others as needed.

### Server Changes

#### New file: `server/src/buttplug/protocol-filter.ts`

- `getEnabledProtocols()` → list of enabled protocol names
- `setProtocolEnabled(protocolName: string, enabled: boolean)` → toggle
- `matchesEnabledProtocol(deviceName: string)` → boolean (fuzzy match device name against known protocol patterns)

Protocol-to-device-name mapping (for application-layer filtering):
```typescript
const PROTOCOL_DEVICE_PATTERNS: Record<string, RegExp[]> = {
  "lovense": [/^LVS-/i, /lovense/i],
  "hismith": [/hismith/i, /^HS-/i],
  "wevibe": [/we-vibe/i, /wevibe/i, /^WV-/i],
  "kiiroo-v2": [/kiiroo/i, /^KIIROO/i],
  "magic-motion": [/magic.?motion/i],
  "svakom": [/svakom/i],
  "satisfyer": [/satisfyer/i],
  "lelo-f1s": [/lelo/i, /^F1S/i],
  // ... etc
};
```

#### Integrate into device discovery

In `client.ts` `deviceadded` handler:
1. Check `matchesEnabledProtocol(device.name)`
2. If no match → silently ignore (don't even add to discovered list)
3. If match → proceed with approval flow (Pillar 2)

Devices that don't match ANY known protocol pattern get added with a warning flag so the host can see them and manually approve.

#### New API endpoints

```
GET  /api/protocols          → list all protocols with enabled status
PUT  /api/protocols/:name    → { enabled: boolean }
```

### Client Changes

#### `client/src/lib/api.ts`

```typescript
export const protocols = {
  list: () => request<Protocol[]>("/protocols"),
  setEnabled: (name: string, enabled: boolean) =>
    request<void>(`/protocols/${name}`, { method: "PUT", body: JSON.stringify({ enabled }) }),
};

export interface Protocol {
  protocolName: string;
  displayName: string;
  enabled: boolean;
}
```

#### `client/src/pages/Settings.tsx`

Add an **"Allowed Protocols"** section (collapsible, below Discovered Devices):

```
┌─ Allowed Protocols ───────────────────────────┐
│  Only devices matching enabled protocols will  │
│  appear during scanning.                       │
│                                                │
│  [✅] Lovense                                  │
│  [✅] Hismith                                  │
│  [  ] We-Vibe                                  │
│  [  ] Kiiroo                                   │
│  [  ] Magic Motion                             │
│  [  ] Svakom                                   │
│  [  ] Satisfyer                                │
│  ... (show all / collapse)                     │
└───────────────────────────────────────────────┘
```

Toggle switches. Changes take effect on next scan (no engine restart needed since this is application-layer filtering).

---

## File Change Summary

### New Files
| File | Purpose |
|------|---------|
| `server/src/buttplug/device-approval.ts` | Device approval CRUD + logic |
| `server/src/buttplug/protocol-filter.ts` | Protocol allowlist CRUD + name matching |

### Modified Files
| File | Changes |
|------|---------|
| `server/src/index.ts` | Add engine start/stop/status endpoints, device approval endpoints, protocol endpoints. Remove auto engine start from `start()` (unless scan_on_start). Bump version to 3.1.0 |
| `server/src/buttplug/client.ts` | Add approval check in `deviceadded` handler. Add `getDiscoveredDevices()`. Track all discovered devices (not just approved). |
| `server/src/buttplug/engine.ts` | No changes needed (start/stop already exist) |
| `server/src/db/schema.ts` | Add `approved_devices` and `allowed_protocols` tables |
| `server/src/db/migrate.ts` | Add v3.1.0 migration block + seed protocols |
| `server/src/config.ts` | No changes |
| `client/src/pages/Settings.tsx` | Full redesign: engine controls, discovered devices with approval UI, protocol allowlist toggles |
| `client/src/lib/api.ts` | Add engine, discovered devices, approval, and protocol API methods + types |
| `config.yaml` | Bump version to 3.1.0 |
| `translations/en.yaml` | No changes needed (new UI is in-app, not add-on config) |

### Unchanged Files
| File | Reason |
|------|--------|
| `server/src/widgets/toybox.service.ts` | Uses `getDeviceStates()` which already filters to approved-only |
| `server/src/rooms/room.socket.ts` | Uses `getDeviceStates()` which already filters to approved-only |
| `client/src/components/widgets/ToyBox.tsx` | Receives pre-filtered device list from room state |
| `client/src/hooks/useButtplug.ts` | Socket events unchanged |

---

## Implementation Order

1. **DB schema + migrations** — `approved_devices` and `allowed_protocols` tables, seed protocols
2. **Protocol filter module** — `protocol-filter.ts` with CRUD and name matching
3. **Device approval module** — `device-approval.ts` with CRUD
4. **Modify buttplug client** — Integrate approval + protocol filtering into device discovery
5. **Engine lifecycle API** — Start/stop/status endpoints in index.ts
6. **Device approval API** — Discovered/approve/deny/reset endpoints
7. **Protocol API** — List/toggle endpoints
8. **Startup behavior** — Remove auto engine start (preserve scan_on_start backward compat)
9. **Client API layer** — Add all new methods and types
10. **Settings UI redesign** — Engine controls, discovered devices, protocol toggles
11. **Health endpoint** — Add engine status, bump version
12. **config.yaml** — Bump to 3.1.0
