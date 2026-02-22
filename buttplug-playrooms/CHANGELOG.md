# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.10] - 2026-02-22

### Fixed
- Fixed `apt-get update` failure from clock skew on HA systems
  - Added `Acquire::Check-Valid-Until=false` and `Acquire::Check-Date=false`
  - Handles both "expired" and "not valid yet" repository metadata errors

## [1.0.8] - 2026-02-22

### Fixed
- Removed duplicate Intiface Engine startup from `run.sh`
  - Engine was started by both `run.sh` (shell) and `engine.ts` (Node.js), causing
    `AddrInUse` on port 12345 for the second instance
  - Engine lifecycle is now managed exclusively by the Node.js server via `engine.ts`
  - `run.sh` simplified to only export config and start the Node.js server

## [1.0.7] - 2026-02-22

### Fixed
- Updated intiface-engine CLI arguments for v1.4.8
  - `--wsinsecureport` → `--websocket-port` (renamed upstream)
  - Removed `--stayopen` (no longer needed; engine runs continuously by default)
- Fixed in both `run.sh` and `server/src/buttplug/engine.ts`

## [1.0.6] - 2026-02-21

### Fixed
- Switched from Alpine to Debian base image to resolve glibc symbol errors
  (`__mbstowcs_chk`, `__wcsncpy_chk`, `__res_init` not available in Alpine's gcompat)
- Fixed unhandled WebSocket crash when intiface-engine fails to start
  (skip client connection attempt when engine is not running)

### Changed
- Base image: `amd64-base:3.19` (Alpine) → `amd64-base-debian:bookworm` (Debian 12)
- Package manager: `apk` → `apt-get`
- Node.js: 20.x → 18.x (Debian bookworm default; fully compatible)

## [1.0.5] - 2026-02-21

### Fixed
- Added `eudev-libs` package for `libudev.so.1` required by intiface-engine at runtime
- Made intiface-engine startup failure non-fatal in `run.sh` (server already handles this gracefully)

## [1.0.4] - 2026-02-21

### Fixed
- Fixed client TypeScript build errors preventing Docker image creation
  - Removed unused `localStream` destructuring in VideoChat and WebCam widgets
  - Removed unused `devicesApi` import in RoomHost page
  - Added `vite-env.d.ts` for CSS import type declarations (`noUncheckedSideEffectImports`)

## [1.0.3] - 2026-02-21

### Fixed
- Fixed TypeScript build errors from `@types/express` v5 / Express v4 mismatch
  - Downgraded `@types/express` from `^5.0.0` to `^4.17.0` to match Express 4 runtime
- Fixed duplicate `RTCIceCandidateInit` type declaration conflicting with `@types/node` v22
- Updated health check endpoint version from `1.0.0` to `1.0.3`

## [1.0.2] - 2026-02-21

### Fixed
- Fixed Docker build failure caused by changed Intiface Engine release asset naming
  - Updated download URL from Rust-triple tar.gz format to new `x64-Release.zip` format
  - Replaced `tar` extraction with `unzip` for the new zip archive format
  - Pinned Intiface Engine to v1.4.8 for reproducible builds
- Generated missing `package-lock.json` files for server and client (required by `npm ci`)
- Updated deprecated npm flags (`--production=false` → default, `--production` → `--omit=dev`)

### Changed
- Removed `aarch64` architecture support (no upstream Linux ARM builds available)
- Added default value for `BUILD_FROM` ARG to fix `InvalidDefaultArgInFrom` Docker warning
- Added `libc6-compat` for glibc binary compatibility on Alpine

## [1.0.1] - 2026-02-21

### Fixed
- Restructured repository to match HA custom add-on repository requirements
- Added `repository.yaml` at repo root with required `name`, `url`, `maintainer` fields
- Moved all add-on files into `buttplug-playrooms/` subdirectory (matching slug)
- Updated `config.yaml` url to point to the add-on subdirectory

## [1.0.0] - 2026-02-21

### Added
- Home Assistant add-on with ingress support and Intiface Engine integration
- Play Rooms system with customizable widget layouts
- Two access modes: Open (anyone with link) and Challenge (code or host approval)
- Share Links for external PWA access to Play Rooms
- Progressive Web App (PWA) with offline support
- **Toy Box widget**: Buttplug.io device controls with presets and exposed buttons
- **Web Cam widget**: Host-only webcam streaming to guests via WebRTC
- **Video Chat widget**: Multi-participant video wall with host opt-in voice activation
- **Voice Chat widget**: Push-to-talk and open mic modes via WebRTC
- **Text Chat widget**: Real-time text messaging with message persistence
- SQLite database for room configs, share links, and chat history
- WebRTC P2P signaling via Socket.IO for media widgets
- Bundled Intiface Engine binary for amd64 and aarch64 architectures
- Host dashboard for room management and device assignment
- Guest lobby with name entry and challenge verification
- Responsive mobile-first design for guest PWA experience

---

## Version Control Notes
All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> Reference for maintaining consistent version bumps across the project.

### Versioning scheme

- **X.0.0** — Major version (architecture changes, breaking changes)
- **X.X.0** — Minor version (new functionality)
- **X.0.X** — Patch version (bug fixes, security fixes, cleanup)
