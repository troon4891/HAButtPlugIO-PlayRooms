# HAButtPlugIO-PlayRooms — Project Tracker


## Implementation Phases

### Phase 1: Project Scaffolding & HA Add-on Shell — DONE
- [x] HA add-on manifest and Docker build
- [x] Server scaffolding (Express + Socket.IO + TypeScript)
- [x] Client scaffolding (React + Vite + Tailwind + PWA)
- [x] Add-on loads in HA

**Completed in**: v1.0.0

### Phase 2: Database & Buttplug.io Integration — DONE
- [x] SQLite + Drizzle schema and migrations (5 tables)
- [x] Intiface Engine process manager (spawn, health check)
- [x] Buttplug client (connect, scan, list devices, send commands)
- [x] Device REST API

**Completed in**: v1.0.0

### Phase 3: Play Rooms CRUD & Share Links — DONE
- [x] Room CRUD REST API
- [x] Share link generation and validation
- [x] Host dashboard page
- [x] Room configuration UI

**Completed in**: v1.0.0

### Phase 4: Real-time Room & Lobby System — DONE
- [x] Socket.IO room handling
- [x] Lobby join flow (open + challenge modes)
- [x] Host room view with guest list
- [x] Guest room view with lobby transition
- [x] Auth middleware (HA ingress + share tokens)

**Completed in**: v1.0.0

### Phase 5: Toy Box Widget — DONE
- [x] Device assignment to rooms
- [x] Device control UI (vibrate, rotate, linear)
- [x] Real-time device state sync

**Completed in**: v1.0.0

### Phase 6: Text Chat Widget — DONE
- [x] Socket.IO chat events
- [x] Message persistence in SQLite (500 msg limit per room)
- [x] Chat UI component

**Completed in**: v1.0.0

### Phase 7: WebRTC — Web Cam & Video/Voice Chat — DONE
- [x] WebRTC signaling via Socket.IO
- [x] Web Cam widget (host-only streaming)
- [x] Video Chat widget (multi-participant grid)
- [x] Voice Chat widget (PTT + open mic)

**Completed in**: v1.0.0

### Phase 8: PWA & Polish — PARTIAL
- [x] PWA manifest and service worker
- [x] Responsive layout for mobile
- [ ] Room layout editor (drag/resize widgets) — **NOT IMPLEMENTED**
- [ ] Add-on icons (icon.png, logo.png) — **NOT CREATED** (SVG placeholders exist)

**Completed in**: v1.0.0 (partial)

---

## NOT YET VERIFIED

The source code for all phases exists and compiles (TypeScript errors fixed in v1.0.3–v1.0.4), but the following have **not been confirmed to work end-to-end**:

- Interface rendering (Dashboard, Room views, Lobby, Settings)
- Play Room creation and configuration flow
- Share Link generation and guest access flow
- Toy Box device control with real hardware
- WebRTC video/voice/webcam between host and guests
- Text Chat message delivery
- PWA install and offline behavior

---

## Version History

| Version | Date | Type | Summary |
|---------|------|------|---------|
| v1.0.0 | 2026-02-21 | Feature | Initial implementation — all 8 phases |
| v1.0.1 | 2026-02-21 | Fix | Restructured repo to valid HA add-on layout, added `repository.yaml` |
| v1.0.2 | 2026-02-21 | Fix | Updated Intiface Engine download URL (new release format), added package-lock.json files, fixed deprecated npm flags |
| v1.0.3 | 2026-02-21 | Fix | Fixed `@types/express` v5/v4 mismatch, duplicate `RTCIceCandidateInit` type |
| v1.0.4 | 2026-02-21 | Fix | Fixed client TS errors (unused vars in VideoChat, WebCam, RoomHost), added `vite-env.d.ts` |
| v1.0.5 | 2026-02-21 | Fix | Added `eudev-libs` for `libudev.so.1`, made engine startup non-fatal |
| v1.0.6 | 2026-02-21 | Fix | Switched Alpine → Debian base image (glibc symbol errors), fixed WebSocket crash on engine failure |
| v1.0.7 | 2026-02-22 | Fix | Updated intiface-engine CLI args for v1.4.8 (`--wsinsecureport` → `--websocket-port`, removed `--stayopen`) |
| v1.0.8 | 2026-02-22 | Fix | Removed duplicate engine startup from `run.sh` (was started by both shell and Node.js) |
| v1.0.9 | 2026-02-22 | Fix | Fixed `apt-get update` clock skew failures on HA systems |
| v1.0.10 | 2026-02-22 | Fix | Additional apt clock skew fix (`Check-Date=false`) |
| v1.0.11 | 2026-02-22 | Fix | Fixed blank page under HA ingress (server-side base injection, relative asset paths, ingress-aware routing/API/socket) |
| v2.0.0 | 2026-02-24 | Feature | Standalone Docker mode, user auth, guest tiers, API keys, webhooks, security hardening |
| v2.0.1 | 2026-02-25 | Fix | Fixed device broadcast, guest permission checks, host approval flow, PWA icons, wired up orphaned components |
| v3.0.0 | 2026-02-25 | Feature | PlayRoom Portal — cloud relay for guest access without exposing HA (UNTESTED) |
| v3.1.0 | 2026-02-26 | Feature | Device safety — engine lifecycle, approval whitelist, protocol filtering (UNTESTED) |
| v3.2.0 | 2026-02-26 | Feature | Device management overhaul — Add New Device modal, global settings, stale cleanup (UNTESTED) |

---

## Deviations From Original Plan

| Area | Original Plan | What Happened |
|------|---------------|---------------|
| **Project root** | All add-on files at repo root | Moved into `buttplug-playrooms/` subdirectory for HA repository compliance |
| **repository.yaml** | Not planned | Added — required by HA Supervisor to discover add-ons |
| **Base image** | Alpine 3.19 | Switched to Debian Bookworm (v1.0.6) — Alpine lacks glibc symbols needed by Intiface Engine |
| **aarch64 support** | Planned for both amd64 + aarch64 | Dropped aarch64 (v1.0.2) — no upstream Linux ARM builds available |
| **Intiface download** | Rust-triple tar.gz format | Changed to `x64-Release.zip` format (v1.0.2) — upstream renamed release assets |
| **Engine startup** | `run.sh` starts engine + Node server | Engine now managed exclusively by Node.js `engine.ts` (v1.0.8) |
| **Node.js version** | Node.js 20 | Node.js 18 (Debian bookworm default, fully compatible) |
| **config.yaml version** | Started at `0.1.0` | Shipped as `1.0.0` |
| **Room layout editor** | Planned in Phase 8 | Not yet implemented |
| **Add-on icons** | icon.png + logo.png planned | Only SVG placeholders exist, not PNG |
| **Unit tests** | vitest planned | Not yet implemented |
| **CHANGELOG.md** | Not in original plan | Added for version tracking |

---

## Known Issues

- **Lobby codes**: Stored in-memory, lost on server restart (challenge codes in DB since v2.0.0, but lobby state is still in-memory)

### Fixed in v2.0.1
- ~~**room.socket.ts**: Device state broadcast only emits first device (`devices[0]`), should iterate all~~
- ~~**room.socket.ts**: No room-level permission checks on guest device commands~~
- ~~**room.socket.ts**: Guest join listener only registered in challenge mode branch, not open mode~~
- ~~**Icons**: Vite config references `.png` icons but actual files are `.svg`~~
- ~~**RoomConfig / ShareLink components**: Built but not imported into any pages (orphaned)~~

---

## Next Objectives

- [ ] Verify the interface actually renders (Dashboard, Room views, Lobby)
- [x] Fix known Socket.IO room bugs (device broadcast, permissions, open-mode join) — **v2.0.1**
- [x] Wire up orphaned RoomConfig and ShareLink components — **v2.0.1**
- [x] Fix icon format mismatch (SVG → PNG or update vite config) — **v2.0.1**
- [ ] Test full guest flow: Share Link → Lobby → Room → Widgets
- [ ] Implement room layout editor (remaining Phase 8 item)
- [ ] Create proper add-on icons (icon.png 128x128, logo.png 256x256)
- [ ] Add unit tests (vitest)
- [ ] Test Buttplug.io device control with real hardware
