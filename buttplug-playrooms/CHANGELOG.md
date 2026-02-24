# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-02-24

Forked from [HAButtPlugIO-PlayRooms](<!-- REPO_URL_PLACEHOLDER -->).
This release introduces standalone Docker deployment, user accounts,
two-tier guest profiles, API keys, room-scoped webhooks, and security hardening.

### Added
- **Standalone Docker mode**: Run outside Home Assistant with built-in user accounts
  - Auto-detects mode: HA ingress when `/data/options.json` present, standalone otherwise
  - JWT-based auth (HS256, zero external dependencies)
  - Initial admin setup via `POST /api/auth/setup`
- **User accounts** (`users` table): username/password with admin and host roles
- **Login security**: Login attempt tracking, hard lockout after 5 failures (15-min duration)
- **Two-tier guest system**:
  - Short-lived guests: ephemeral, session-based (existing behavior)
  - Long-lived guests: persistent profiles with optional passwords, activity tracking
  - Global guest profiles that can be invited to multiple rooms
  - Per-room configurable inactivity timeout for auto-expiring idle guest profiles
- **API keys**: Scoped, hashed keys for programmatic access (`rooms:read`, `rooms:write`,
  `devices:read`, `devices:write`, `guests:read`, `webhooks:manage`)
- **Room-scoped webhooks**: Outbound HTTP notifications with HMAC-SHA256 signing
  - Events: `guest:joined`, `guest:left`, `guest:approved`, `guest:rejected`,
    `device:connected`, `device:disconnected`, `device:assigned`, `command:sent`,
    `room:updated`, `room:deleted`, `chat:message`
  - Test ping endpoint for webhook verification
- **Rate limiting**: In-memory sliding window on login (5/min), public API (60/min),
  share link validation (20/min)
- **Periodic cleanup**: Expired share links, challenge codes, and inactive guest profiles
  removed automatically every hour

### Changed
- Challenge codes now use `crypto.randomInt()` instead of `Math.random()`
- Challenge codes persisted to database (survive server restart)
- Host WebSocket connections verified server-side (no longer trusts client `isHost` flag)
- CORS configurable via `CORS_ORIGINS` env var (defaults restricted in standalone mode)
- Password hashing uses Node.js `crypto.scrypt` (no external dependencies)
- Share links gain `guest_type` field (`short` | `long`) to control guest persistence

### Security
- Fixed: Host impersonation via client-provided `isHost` WebSocket query param
- Fixed: Predictable challenge codes from `Math.random()`
- Fixed: Challenge codes lost on server restart (moved to DB with 5-min expiry)
- Fixed: Unrestricted CORS `origin: "*"` in standalone mode
- Added: Rate limiting on authentication and public endpoints
- Added: Input validation on names (50 char), messages (2000 char), URLs (http/https)

---

> This project was forked from the original HAButtPlugIO-PlayRooms HA add-on.
> Versions prior to 2.0.0 refer to the upstream project.

---

## Version Control Notes

### Versioning scheme

- **X.0.0** — Major version (architecture changes, breaking changes)
- **X.X.0** — Minor version (new functionality)
- **X.0.X** — Patch version (bug fixes, security fixes, cleanup)
