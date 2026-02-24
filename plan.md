# Standalone Docker + Dual-Mode Implementation Plan

## Goal
Add standalone Docker deployment alongside the existing HA add-on. Same codebase, two deployment targets. Add proper user authentication and API key support.

## Phase 1: Database Schema — Users & API Keys

Add two new tables to `server/src/db/schema.ts`:

### `users` table
| Column | Type | Notes |
|--------|------|-------|
| id | text PK | nanoid |
| username | text UNIQUE | login identifier |
| passwordHash | text | bcrypt hash |
| displayName | text | shown in UI |
| role | text | "admin" or "user" (default "admin" for first user) |
| createdAt | integer | epoch ms |

### `api_keys` table
| Column | Type | Notes |
|--------|------|-------|
| id | text PK | nanoid |
| userId | text FK→users | owner |
| keyHash | text | SHA-256 hash of the key (never store plaintext) |
| keyPrefix | text | first 8 chars of key for identification in UI (e.g., "pr_a1b2c3d4...") |
| name | text | user-provided label ("My HA instance", "AI agent") |
| scopes | text | JSON array of permissions, e.g., ["rooms:read", "rooms:write", "devices:control"] |
| expiresAt | integer | nullable — null means long-lived |
| lastUsedAt | integer | nullable — updated on use |
| createdAt | integer | epoch ms |

Add a Drizzle migration for these tables.

## Phase 2: Auth Middleware Overhaul

Update `server/src/auth/middleware.ts` to support three authentication modes:

1. **HA ingress** (existing) — `X-Ingress-Path` header present → trusted, pass through
2. **Session cookie** (new) — for the web UI login flow. Use a signed JWT or session token in an httpOnly cookie.
3. **API key** (new) — `Authorization: Bearer pr_xxxxx` or `X-API-Key: pr_xxxxx` header. Hash the provided key, look it up in `api_keys` table, verify scopes.

The `requireHost` middleware becomes:
- If HA ingress header → allow (backward compatible)
- If valid session cookie → allow
- If valid API key with appropriate scope → allow
- If local IP (127.0.0.1, ::1) → allow (for initial setup)
- Otherwise → 401

Add new middleware helpers:
- `requireAuth` — validates any of the three auth methods, attaches user to request
- `requireScope(scope: string)` — checks API key has the required scope
- Keep `requireShareToken` unchanged (guest access is independent)

## Phase 3: Auth API Routes

New routes under `/api/auth/`:

- `POST /api/auth/setup` — Create first admin user (only works if no users exist). Returns session cookie.
- `POST /api/auth/login` — Username + password → session cookie
- `POST /api/auth/logout` — Clear session cookie
- `GET /api/auth/me` — Current user info (from session or API key)

New routes under `/api/keys/`:

- `GET /api/keys` — List current user's API keys (shows prefix, name, scopes, last used; never the full key)
- `POST /api/keys` — Create new API key. Returns the full key ONCE in the response. Body: `{ name, scopes, expiresAt? }`
- `DELETE /api/keys/:id` — Revoke an API key

## Phase 4: Frontend Auth Flow

### Login page (`client/src/pages/Login.tsx`)
- Simple username/password form
- On first visit (no users in DB), show a "Create Admin Account" setup form instead
- After login, redirect to Dashboard

### Setup page (`client/src/pages/Setup.tsx`)
- Only shown when no users exist
- Create admin username + password
- Redirect to Dashboard after creation

### Settings page update (`client/src/pages/Settings.tsx`)
- Add "API Keys" section
- List existing keys (prefix, name, scopes, last used, created)
- "Create New Key" button → modal with name, scope checkboxes, optional expiry
- Show full key ONCE after creation with copy button + warning
- Revoke button on each key

### App.tsx router update
- Add auth context provider
- Wrap host routes in an auth guard
- Guest routes (via share link) remain unauthenticated
- HA ingress mode auto-authenticates (no login page shown)

## Phase 5: Standalone Docker Image

### New file: `Dockerfile.standalone`
```dockerfile
FROM node:20-bookworm-slim
# Install Bluetooth/USB/serial dependencies for Intiface
RUN apt-get update && apt-get install -y bluez libusb-1.0-0 libudev1 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY buttplug-playrooms/server/package*.json ./server/
COPY buttplug-playrooms/client/package*.json ./client/
RUN cd server && npm ci && cd ../client && npm ci
COPY buttplug-playrooms/server ./server
COPY buttplug-playrooms/client ./client
RUN cd client && npm run build && cd ../server && npm run build
EXPOSE 8099
VOLUME /data
ENV NODE_ENV=production
CMD ["node", "server/dist/index.js"]
```

### New file: `docker-compose.yml`
```yaml
version: "3.8"
services:
  playrooms:
    build:
      context: .
      dockerfile: Dockerfile.standalone
    ports:
      - "8099:8099"
    volumes:
      - playrooms-data:/data
    environment:
      - SERVER_PORT=8099
      - INTIFACE_PORT=12345
      - USE_BLUETOOTH=true
    privileged: true  # needed for Bluetooth/USB access
    restart: unless-stopped
volumes:
  playrooms-data:
```

### Update `server/src/config.ts`
- Keep HA options.json fallback
- Add standalone env var support (already partially there)
- Add `AUTH_MODE` env var: `"ha"` (default in HA), `"standalone"` (default in Docker), `"none"` (disable auth)

### Update `server/src/index.ts`
- Detect deployment mode from `AUTH_MODE` or presence of HA ingress
- In standalone mode: serve login page, enforce session auth
- In HA mode: existing behavior (ingress auth)

## Phase 6: Entrypoint & Config

### New file: `docker-entrypoint.sh`
```bash
#!/bin/bash
# Download/verify Intiface Engine binary if not present
# Set up /data directory permissions
# Run database migrations
exec node server/dist/index.js
```

### Environment variables for standalone mode:
| Variable | Default | Description |
|----------|---------|-------------|
| SERVER_PORT | 8099 | HTTP server port |
| INTIFACE_PORT | 12345 | Intiface Engine websocket port |
| USE_BLUETOOTH | true | Enable Bluetooth device scanning |
| USE_SERIAL | false | Enable serial port scanning |
| USE_HID | false | Enable USB HID scanning |
| SCAN_ON_START | false | Auto-scan for devices on startup |
| DATA_DIR | /data | Persistent data directory |
| AUTH_MODE | standalone | "ha", "standalone", or "none" |
| SESSION_SECRET | (auto-generated) | Secret for signing session cookies |

## Implementation Order

1. Schema + migration (users, api_keys tables)
2. Auth middleware overhaul (session + API key support)
3. Auth API routes (setup, login, logout, me, keys CRUD)
4. Frontend login/setup pages + auth context
5. Settings page API key management UI
6. Standalone Dockerfile + docker-compose.yml
7. docker-entrypoint.sh + config updates
8. Test both modes (HA ingress + standalone)
