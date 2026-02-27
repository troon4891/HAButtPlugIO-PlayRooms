# ButtPlug.io PlayRooms — Project Context

## Project Overview

Home Assistant add-on and standalone Docker application for controlling Buttplug.io-compatible devices through collaborative "Play Rooms." Hosts create rooms, assign devices, and share invite links; guests join via PWA and control assigned devices in real time. An optional cloud relay portal mode (`PORTAL_MODE=true`) lets guests connect without exposing the Home Assistant instance to the public internet.

## Architecture

### Server — `buttplug-playrooms/server/`

- **Runtime:** Node.js + TypeScript (ES2022, strict mode)
- **HTTP:** Express 4 with CORS
- **Real-time:** Socket.IO 4 (WebSocket + polling fallback)
- **Database:** SQLite (better-sqlite3, WAL mode) with Drizzle ORM
  - Schema defined in `src/db/schema.ts`; migrations in `src/db/migrate.ts` (manual per-version blocks)
- **Device control:** Intiface Engine binary spawned as a child process (`child_process.spawn` in `src/buttplug/engine.ts`); Buttplug.js client connects to it via local WebSocket
- **Auth:** Dual mode — HA ingress (X-Ingress-Path header) or standalone JWT (HS256, 24 h expiry)
- **Portal mode:** Same image, lightweight Socket.IO relay — no engine, no SQLite

### Client — `buttplug-playrooms/client/`

- **Framework:** React 18 + TypeScript
- **Build:** Vite 6, PWA via vite-plugin-pwa
- **Styling:** Tailwind CSS 3, Lucide React icons
- **State:** Local state + custom hooks (`useSocket`, `useButtplug`, `useWebRTC`); no external state library
- **Comms:** Socket.IO client for room events; WebRTC for video/voice

### Deployment

Single Dockerfile (base: `ghcr.io/home-assistant/amd64-base-debian:bookworm`). Intiface Engine v1.4.8 downloaded at build time (skipped when `PORTAL_MODE=true`). Express serves the Vite production build as static files.

## Key File Paths

All paths relative to `buttplug-playrooms/`.

| Path | Purpose |
|------|---------|
| `config.yaml` | HA add-on manifest — **version source of truth** |
| `CHANGELOG.md` | Version history (Keep a Changelog format) |
| `Dockerfile` | Single-stage Docker build |
| `run.sh` | Container entry point |
| **Server** | |
| `server/src/index.ts` | Server entry point, route mounting, Socket.IO setup |
| `server/src/config.ts` | Env / HA options loader |
| `server/src/db/schema.ts` | Drizzle table definitions |
| `server/src/db/migrate.ts` | Migration runner (manual blocks per version) |
| `server/src/buttplug/engine.ts` | Intiface Engine child-process lifecycle |
| `server/src/buttplug/client.ts` | Buttplug WebSocket client, device discovery & commands |
| `server/src/buttplug/device-approval.ts` | Device approval workflow (pending/approved/denied) |
| `server/src/buttplug/protocol-filter.ts` | Protocol allowlist filtering |
| `server/src/rooms/room.routes.ts` | Room REST API |
| `server/src/rooms/room.socket.ts` | Socket.IO event handlers (lobby, chat, devices, WebRTC) |
| `server/src/auth/middleware.ts` | `requireHost`, `requireAdmin`, `requireApiKey` guards |
| `server/src/webhooks/webhook.service.ts` | Outbound webhook dispatch (HMAC-SHA256 signed) |
| `server/src/portal/` | Cloud relay server and HA relay client |
| **Client** | |
| `client/src/App.tsx` | Route definitions |
| `client/src/pages/` | Dashboard, RoomHost, RoomGuest, Lobby, Settings |
| `client/src/lib/api.ts` | REST client functions + shared TypeScript types |
| `client/src/lib/socket.ts` | Socket.IO singleton connection manager |
| `client/src/hooks/` | `useSocket`, `useButtplug`, `useWebRTC` |
| `client/src/components/widgets/` | ToyBox, TextChat, VideoChat, VoiceChat, WebCam |
| **Docs** | |
| `../NOTICE.md` | Third-party dependency licenses (repo root) |
| `../CONTRIBUTING.md` | Contribution guide (repo root) |

## Current Version & Status

- **Version 3.2.0** on the **`beta`** branch
- v3.0.0, v3.1.0, and v3.2.0 are all marked **UNTESTED** in `CHANGELOG.md`
- `beta` is the active development branch; `main` receives merges when a release is considered stable

## Working Agreements

1. **Conventional commits** — prefix with `feat:`, `fix:`, `docs:`, `chore:`, etc.
2. **Every implementation** must include:
   - A `CHANGELOG.md` entry under the correct version heading (Keep a Changelog: Added / Changed / Fixed / Removed)
   - A tailored QA checklist describing what to test and the expected behavior
3. **Bump `config.yaml` version** on features or breaking changes (SemVer: `major.minor.patch`)
4. **Update `NOTICE.md`** when adding or updating any dependency (package name, version, license, source URL)
5. **No linter configured** — match existing code style and conventions
6. **PR target** — always `beta`, never `main` directly
7. **Docker build** — `docker build buttplug-playrooms/` must succeed after changes

## Development Quick-Start

```bash
# Server (port 8099)
cd buttplug-playrooms/server && npm install && npm run dev

# Client (Vite dev server, proxies /api and /socket.io to localhost:8099)
cd buttplug-playrooms/client && npm install && npm run dev

# Docker build check
docker build buttplug-playrooms/
```

Standalone mode activates automatically when `/data/options.json` is absent. On first launch, visit `http://localhost:8099` to create the admin account.
