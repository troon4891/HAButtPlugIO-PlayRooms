# HAButtPlugIO-PlayRooms — Implementation Plan

This is a Home Assistant add-on that hosts a Buttplug.io (Intiface Engine) server and exposes connected devices through a "Play Rooms" system. A PWA provides the guest/host interface. 

Hosts create customizable rooms with widgets (Toy Box, Web Cam, Video Chat, Voice Chat, Text Chat), then share them via generated links to allow others to access and play//watch them. 

---

## Project Vision & Component Definitions

### Project Aim

The aim of this project is to create an add-on for the Home Assistant platform that will host a Buttplug.io instance. This will allow users to connect their toys and expose them as Play Rooms to both the Home Assistant AI and a PWA for external access via Share Links.

The Progressive Web App (PWA) will provide a web-based dashboard for sharing and managing these devices through shareable links.

### What is a Play Room?

A Play Room is a customizable space where users can add "widgets" to enhance its functionality and layout. Each Play Room features both a **Guest view** and a **Host view**, accommodating 1 to 4 guests depending on the room settings.

Hosts determine how the room can be accessed, typically through an **open method** or a **challenge system**:

- **Challenge method**: When a guest joins a share link with a challenge, a code is generated that the guest must enter, or the host can approve their entry through a lobby. 
- **Open method**: Guests with this link can join by simply entering their name and selecting settings in the lobby.

Each Play Room includes established Room Rules and a Toy Box for toy management.

### What is a Share Link?

A Share Link is a generated URL that grants external access to a specific Play Room. The WebUI allows hosts to generate these links. When a guest clicks one, they enter the lobby flow determined by the room's access mode (open or challenge).

### Widgets

#### Toy Box
The Toy Box contains the Buttplug.io devices linked to this Play Room along with any preconfigured settings, options, and exposed buttons.

#### Web Cam
Enables the host to link a webcam and stream video to guests. Guests cannot connect their own cameras to this widget — it is host-only, one-way streaming.

#### Video Chat
Creates a small video wall for participants, with the option for the host to join. When the host opts in, their video connection automatically enables voice for all guests.

#### Voice Chat
A walkie-talkie-style voice chat that can operate in either a push-to-talk mode or a continuous open mic format.

#### Text Chat
Real-time text messaging between host and guests within the Play Room, with message persistence in the database.


---

## Technology Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| **Runtime** | Node.js 20 (LTS) + TypeScript | Best Buttplug.io client library support (`buttplug` npm package) |
| **Backend Framework** | Express.js + Socket.IO | Lightweight HTTP + WebSocket. Socket.IO handles signaling, chat, and room state |
| **Frontend** | React 18 + Vite + TypeScript | User-selected. Fast dev, HMR, good PWA tooling |
| **PWA** | Vite PWA Plugin (`vite-plugin-pwa`) | Service worker generation, manifest, offline support |
| **Database** | SQLite via `better-sqlite3` | Single-file, no external server, HA-friendly persistent storage |
| **WebRTC** | Native browser APIs + Socket.IO signaling | P2P for 1-4 participants; Socket.IO relays SDP/ICE candidates |
| **Buttplug.io** | `buttplug` npm client + bundled Intiface Engine binary | Engine runs as child process; Node client connects via local WebSocket |
| **Styling** | Tailwind CSS | Utility-first, small bundle, rapid prototyping |
| **ORM/Query** | `drizzle-orm` with `better-sqlite3` driver | Type-safe queries, lightweight, no code generation step |

---

## Project Structure

```
HAButtPlugIO-PlayRooms/
├── repository.yaml                # HA repository metadata
├── buttplug-playrooms/            # Add-on subdirectory (slug-named)
│   ├── config.yaml                # HA add-on manifest
│   ├── build.yaml                 # HA build config (architectures)
│   ├── Dockerfile                 # Container build (Node.js + Intiface Engine)
│   ├── run.sh                     # Entrypoint: exports config + starts Node server
│   ├── DOCS.md                    # Add-on documentation
│   ├── CHANGELOG.md               # Version history
│   ├── translations/
│   │   └── en.yaml                # UI labels for config schema
│   ├── server/                    # Backend (Node.js/TypeScript)
│   │   ├── package.json
│   │   ├── package-lock.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts           # Express + Socket.IO bootstrap
│   │       ├── config.ts          # Read HA options, env vars
│   │       ├── db/
│   │       │   ├── schema.ts      # Drizzle schema definitions
│   │       │   ├── migrate.ts     # Migration runner
│   │       │   └── index.ts       # DB connection singleton
│   │       ├── buttplug/
│   │       │   ├── engine.ts      # Spawn/manage Intiface Engine process
│   │       │   └── client.ts      # Buttplug client: connect, scan, device mgmt
│   │       ├── rooms/
│   │       │   ├── room.service.ts    # CRUD for Play Rooms
│   │       │   ├── room.routes.ts     # REST API for room management
│   │       │   └── room.socket.ts     # Socket.IO namespace for room real-time
│   │       ├── widgets/
│   │       │   ├── toybox.service.ts  # Device assignment, presets, control
│   │       │   ├── chat.service.ts    # Text chat message handling
│   │       │   └── media.signaling.ts # WebRTC signaling for webcam/video/voice
│   │       ├── auth/
│   │       │   ├── share-links.ts     # Generate/validate share link tokens
│   │       │   ├── lobby.ts           # Lobby join flow (open + challenge modes)
│   │       │   └── middleware.ts      # Auth middleware (HA ingress + share tokens)
│   │       └── types/
│   │           └── index.ts           # Shared TypeScript types
│   └── client/                    # Frontend (React + Vite)
│       ├── package.json
│       ├── package-lock.json
│       ├── tsconfig.json
│       ├── vite.config.ts
│       ├── index.html
│       ├── tailwind.config.js
│       ├── postcss.config.js
│       ├── public/
│       │   └── icons/             # PWA icons
│       └── src/
│           ├── main.tsx           # React entry point
│           ├── App.tsx            # Root router
│           ├── vite-env.d.ts      # TypeScript env declarations
│           ├── hooks/
│           │   ├── useSocket.ts       # Socket.IO connection hook
│           │   ├── useWebRTC.ts       # WebRTC peer connection hook
│           │   └── useButtplug.ts     # Device state hook
│           ├── pages/
│           │   ├── Dashboard.tsx      # Host: list/create rooms
│           │   ├── RoomHost.tsx       # Host view of a room
│           │   ├── RoomGuest.tsx      # Guest view of a room
│           │   ├── Lobby.tsx          # Join flow (name, settings, challenge)
│           │   └── Settings.tsx       # Add-on settings page
│           ├── components/
│           │   ├── widgets/
│           │   │   ├── ToyBox.tsx     # Device controls, presets, buttons
│           │   │   ├── WebCam.tsx     # Host webcam stream display
│           │   │   ├── VideoChat.tsx  # Video wall grid
│           │   │   ├── VoiceChat.tsx  # PTT / open mic controls
│           │   │   └── TextChat.tsx   # Chat messages + input
│           │   └── room/
│           │       ├── RoomLayout.tsx # Widget grid layout
│           │       ├── RoomConfig.tsx # Room settings editor
│           │       └── ShareLink.tsx  # Share link generator/display
│           ├── lib/
│           │   ├── socket.ts          # Socket.IO client singleton
│           │   ├── webrtc.ts          # WebRTC connection manager
│           │   └── api.ts             # REST API client (fetch wrapper)
│           └── styles/
│               └── globals.css        # Tailwind base + custom styles
```

---

## Data Models (SQLite via Drizzle)

### `play_rooms`
| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT (UUID) | Primary key |
| `name` | TEXT | Room display name |
| `access_mode` | TEXT | `"open"` or `"challenge"` |
| `challenge_type` | TEXT | `"code"` or `"approval"` (nullable, for challenge mode) |
| `max_guests` | INTEGER | 1-4 |
| `widgets` | TEXT (JSON) | Array of enabled widget configs |
| `created_at` | INTEGER | Unix timestamp |
| `updated_at` | INTEGER | Unix timestamp |

### `share_links`
| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT (UUID) | Primary key |
| `room_id` | TEXT | FK -> play_rooms.id |
| `token` | TEXT | Unique URL-safe token |
| `active` | INTEGER | 0/1 boolean |
| `expires_at` | INTEGER | Optional expiry timestamp |
| `created_at` | INTEGER | Unix timestamp |

### `room_guests`
| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT (UUID) | Primary key |
| `room_id` | TEXT | FK -> play_rooms.id |
| `name` | TEXT | Guest display name |
| `status` | TEXT | `"pending"`, `"approved"`, `"joined"`, `"disconnected"` |
| `socket_id` | TEXT | Current Socket.IO connection ID |
| `joined_at` | INTEGER | Unix timestamp |

### `devices`
| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT (UUID) | Primary key |
| `buttplug_index` | INTEGER | Buttplug device index |
| `name` | TEXT | Device display name |
| `room_id` | TEXT | FK -> play_rooms.id (nullable -- unassigned) |
| `settings` | TEXT (JSON) | Presets, exposed features, button configs |

### `chat_messages`
| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT (UUID) | Primary key |
| `room_id` | TEXT | FK -> play_rooms.id |
| `sender_name` | TEXT | Guest or "Host" |
| `message` | TEXT | Message content |
| `created_at` | INTEGER | Unix timestamp |

---

## API Design

### REST Endpoints (Express)

**Rooms**
- `GET /api/rooms` -- List all rooms (host only, via ingress auth)
- `POST /api/rooms` -- Create room
- `GET /api/rooms/:id` -- Get room details
- `PUT /api/rooms/:id` -- Update room config
- `DELETE /api/rooms/:id` -- Delete room

**Share Links**
- `POST /api/rooms/:id/share` -- Generate share link
- `GET /api/rooms/:id/share` -- Get room's share links
- `DELETE /api/share/:token` -- Revoke share link
- `GET /api/join/:token` -- Validate share link, return room public info + access mode

**Devices**
- `GET /api/devices` -- List all Buttplug devices (host only)
- `POST /api/devices/scan/start` -- Start device scanning
- `POST /api/devices/scan/stop` -- Stop device scanning
- `POST /api/devices/:id/assign` -- Assign device to room
- `POST /api/devices/:id/command` -- Send command to device

**Health**
- `GET /api/health` -- Server health check

### Socket.IO Events

| Event | Direction | Payload | Description |
|-------|-----------|---------|-------------|
| `guest:join` | Client -> Server | `{ token, name }` | Guest requests to join |
| `guest:approved` | Server -> Client | `{ guestId }` | Host approved entry (challenge mode) |
| `guest:joined` | Server -> All | `{ guestId, name }` | Guest entered the room |
| `guest:left` | Server -> All | `{ guestId }` | Guest disconnected |
| `lobby:pending` | Server -> Host | `{ guestId, name, code? }` | Guest waiting in lobby |
| `lobby:approve` | Host -> Server | `{ guestId }` | Host approves guest |
| `lobby:reject` | Host -> Server | `{ guestId }` | Host rejects guest |
| `device:command` | Client -> Server | `{ deviceId, command, value }` | Control a device |
| `device:state` | Server -> All | `{ deviceId, state }` | Device state update |
| `chat:message` | Client -> Server | `{ message }` | Send text chat |
| `chat:message` | Server -> All | `{ sender, message, ts }` | Broadcast text chat |
| `webrtc:offer` | Client -> Client | `{ sdp, from, to }` | WebRTC SDP offer |
| `webrtc:answer` | Client -> Client | `{ sdp, from, to }` | WebRTC SDP answer |
| `webrtc:ice` | Client -> Client | `{ candidate, from, to }` | ICE candidate |
| `voice:ptt-start` | Client -> Server | `{ guestId }` | Push-to-talk begin |
| `voice:ptt-end` | Client -> Server | `{ guestId }` | Push-to-talk end |

---

## HA Add-on Configuration

### `config.yaml`
```yaml
name: "ButtPlug.io PlayRooms"
version: "1.0.10"
slug: "buttplug-playrooms"
description: "Host Buttplug.io devices as Play Rooms with PWA access and Share Links"
url: "https://github.com/troon4891/HAButtPlugIO-PlayRooms/tree/main/buttplug-playrooms"
arch:
  - amd64
init: false
ingress: true
ingress_port: 8099
panel_icon: "mdi:gamepad-variant"
panel_title: "PlayRooms"
ports:
  8099/tcp: null
map:
  - addon_config:rw
hassio_api: true
auth_api: true
options:
  intiface_port: 12345
  server_port: 8099
  scan_on_start: false
schema:
  intiface_port: "int(1024,65535)"
  server_port: "int(1024,65535)"
  scan_on_start: bool
```

---

## Implementation Phases

### Phase 1: Project Scaffolding & HA Add-on Shell
**Files**: `config.yaml`, `build.yaml`, `Dockerfile`, `run.sh`, `.gitignore`, `translations/en.yaml`
- Set up HA add-on manifest and Docker build
- Create `server/` with Express hello-world that serves on ingress port
- Create `client/` with Vite + React scaffold
- Verify the add-on loads in HA (or at minimum, Docker builds and runs)

### Phase 2: Database & Buttplug.io Integration
**Files**: `server/src/db/*`, `server/src/buttplug/*`, `server/src/config.ts`
- Set up SQLite + Drizzle schema and migrations
- Implement Intiface Engine process manager (spawn, health check, restart)
- Implement Buttplug client (connect, scan, list devices, send commands)
- Basic device REST API

### Phase 3: Play Rooms CRUD & Share Links
**Files**: `server/src/rooms/*`, `server/src/auth/share-links.ts`
- Room CRUD REST API
- Share link generation (crypto-random tokens) and validation
- Host dashboard page (list rooms, create/edit/delete)
- Room configuration UI (name, access mode, max guests, widget selection)

### Phase 4: Real-time Room & Lobby System
**Files**: `server/src/auth/lobby.ts`, `server/src/rooms/room.socket.ts`, client pages
- Socket.IO room namespaces
- Lobby join flow: open mode (name + enter) and challenge mode (code/approval)
- Host room view with connected guest list
- Guest room view with lobby -> room transition
- Auth middleware (HA ingress token for host, share link token for guests)

### Phase 5: Toy Box Widget
**Files**: `server/src/widgets/toybox.service.ts`, `client/src/components/widgets/ToyBox.tsx`
- Device assignment to rooms
- Device control UI (vibrate, rotate, linear -- based on device capabilities)
- Preset configurations (saved intensity patterns, button mappings)
- Real-time device state sync between host and guests

### Phase 6: Text Chat Widget
**Files**: `server/src/widgets/chat.service.ts`, `client/src/components/widgets/TextChat.tsx`
- Socket.IO chat events
- Message persistence in SQLite (with optional TTL cleanup)
- Chat UI component with message list + input

### Phase 7: WebRTC -- Web Cam & Video/Voice Chat
**Files**: `server/src/widgets/media.signaling.ts`, `client/src/lib/webrtc.ts`, client widget components
- WebRTC signaling via Socket.IO (offer/answer/ICE relay)
- Web Cam widget: host-only camera -> guests receive stream
- Video Chat widget: multi-participant video grid (P2P mesh for <=4 users)
- Voice Chat widget: PTT mode (mute/unmute on keypress) + open mic toggle
- Host opt-in to Video Chat triggers voice for all guests

### Phase 8: PWA & Polish
**Files**: `client/public/manifest.json`, `client/vite.config.ts`, icons
- PWA manifest and service worker via `vite-plugin-pwa`
- Offline fallback page
- Install prompt
- Responsive layout for mobile guests
- Room layout editor (drag/resize widgets)

---

## Verification & Testing

1. **Docker Build**: `docker build -t playrooms-test .` -- verify image builds successfully
2. **Unit Tests**: `vitest` for server services (room CRUD, share link generation, lobby logic)
3. **Integration**: Start container, verify Intiface Engine spawns and Buttplug client connects
4. **Manual E2E**:
   - Open HA ingress -> see dashboard
   - Create a room -> assign devices -> generate share link
   - Open share link in incognito -> complete lobby flow -> join room
   - Test each widget: send device command, send chat message, establish WebRTC streams
5. **PWA**: Lighthouse audit for installability, offline behavior
