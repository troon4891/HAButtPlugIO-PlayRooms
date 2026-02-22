# ButtPlug.io PlayRooms

A Home Assistant add-on that hosts a Buttplug.io (Intiface Engine) server and exposes connected devices through shareable Play Rooms.

![Version](https://img.shields.io/badge/version-1.0.13-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Platform](https://img.shields.io/badge/platform-Home%20Assistant-41BDF5)
![Status](https://img.shields.io/badge/status-Beta-orange)

## What is this?

ButtPlug.io PlayRooms is a Home Assistant add-on that bridges Buttplug.io / Intiface Engine with a Play Rooms system. Hosts create customizable rooms with interactive widgets, pair their Buttplug.io devices, and generate Share Links so guests can join through a Progressive Web App — no app install required.

## Features

- **Play Rooms** — customizable spaces with a host/guest model supporting 1-4 guests
- **Share Links** — generated URLs for external guest access with open or challenge-based entry
- **Toy Box** — Buttplug.io device controls with intensity sliders, presets, and quick buttons
- **Web Cam** — host-only one-way webcam streaming to guests via WebRTC
- **Video Chat** — multi-participant video wall (up to 4 guests) with optional host video
- **Voice Chat** — push-to-talk or open mic voice communication via WebRTC
- **Text Chat** — real-time text messaging with message persistence
- **PWA** — installable Progressive Web App for the guest experience

## Installation

1. In Home Assistant, go to **Settings > Add-ons > Add-on Store**.
2. Click the three-dot menu (top right) and select **Repositories**.
3. Add this repository URL:
   ```
   https://github.com/troon4891/HAButtPlugIO-PlayRooms
   ```
4. Find **ButtPlug.io PlayRooms** in the add-on list and click **Install**.
5. Start the add-on and open the web UI from the sidebar.

## Configuration

| Option | Default | Description |
|--------|---------|-------------|
| `intiface_port` | `12345` | WebSocket port for the Intiface Engine server |
| `server_port` | `8099` | HTTP port for the PlayRooms web server |
| `scan_on_start` | `false` | Automatically scan for Buttplug.io devices on startup |

## Known Limitations

- **amd64 only** — no aarch64 support (no upstream Linux ARM builds for Intiface Engine)
- **Beta status** — not all features have been verified end-to-end
- **Room layout editor** — drag-and-resize widget layout is not yet implemented
- **Add-on icons** — using SVG placeholders; PNG icons not yet created
- **NAT traversal** — WebRTC features may require a TURN server behind strict NAT (not included)

## Acknowledgements

- [Buttplug.io](https://buttplug.io/) and [Intiface Engine](https://github.com/intiface/intiface-engine) — the device control layer this project is built on
- [Home Assistant](https://www.home-assistant.io/) — the platform hosting this add-on
- See [NOTICE.md](NOTICE.md) for a full list of third-party dependencies and their licenses

## Contributors

Created and maintained by [troon4891](https://github.com/troon4891).

Contributions are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Links

- [Documentation](buttplug-playrooms/DOCS.md) — detailed usage guide, concepts, and widget descriptions
- [Security Policy](SECURITY.md) — how to report vulnerabilities
- [Changelog](buttplug-playrooms/CHANGELOG.md) — version history and release notes
- [NOTICE](NOTICE.md) — third-party dependency licenses
