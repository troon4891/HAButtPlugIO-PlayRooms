# ButtPlug.io PlayRooms

A Buttplug.io (Intiface Engine) server that exposes connected devices through shareable Play Rooms. Runs as a Home Assistant add-on or standalone Docker container.

![Version](https://img.shields.io/badge/version-3.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Platform](https://img.shields.io/badge/platform-Home%20Assistant%20%7C%20Docker-41BDF5)
![Status](https://img.shields.io/badge/status-Beta-orange)
![AI Assisted](https://img.shields.io/badge/AI-Assisted-blueviolet)

## What is this?

ButtPlug.io PlayRooms bridges Buttplug.io / Intiface Engine with a Play Rooms system. Hosts create customizable rooms with interactive widgets, pair their Buttplug.io devices, and generate Share Links so guests can join through a Progressive Web App — no app install required.

PlayRooms can run as a **Home Assistant add-on** (using HA's built-in authentication) or as a **standalone Docker container** (with its own user accounts and login system). The deployment mode is auto-detected at startup.

## Features

- **Play Rooms** — customizable spaces with a host/guest model supporting 1-4 guests
- **Share Links** — generated URLs for external guest access with open or challenge-based entry
- **Toy Box** — Buttplug.io device controls with intensity sliders, presets, and quick buttons
- **Web Cam** — host-only one-way webcam streaming to guests via WebRTC
- **Video Chat** — multi-participant video wall (up to 4 guests) with optional host video
- **Voice Chat** — push-to-talk or open mic voice communication via WebRTC
- **Text Chat** — real-time text messaging with message persistence
- **PWA** — installable Progressive Web App for the guest experience

## Deployment Options

### Home Assistant Add-on

1. In Home Assistant, go to **Settings > Add-ons > Add-on Store**.
2. Click the three-dot menu (top right) and select **Repositories**.
3. Add this repository URL:
   ```
   https://github.com/troon4891/HAButtPlugIO-PlayRooms
   ```
4. Find **ButtPlug.io PlayRooms** in the add-on list and click **Install**.
5. Start the add-on and open the web UI from the sidebar.

**Build time:** The first install builds the Docker image from source, which includes downloading dependencies and compiling both the server and client. This takes several minutes, depending on your hardware — this is expected and only happens on the first install or when the add-on is rebuilt.

### Standalone Docker

Run outside Home Assistant with built-in user accounts and authentication:

```bash
git clone https://github.com/troon4891/HAButtPlugIO-PlayRooms.git
cd HAButtPlugIO-PlayRooms
docker compose up -d --build
```

Open `http://localhost:8099` and create your admin account on first visit.

See the [Platform Guides](#platform-guides) below for detailed setup instructions including hardware passthrough for Bluetooth/USB devices.

## Platform Guides

Tested platform documentation for running PlayRooms as a standalone Docker container:

| Platform | Guide | Status |
|----------|-------|--------|
| VirtualBox | [Setup Guide](docs/setup-virtualbox.md) | ✅ Tested |
| Proxmox VE | [Setup Guide](docs/setup-proxmox.md) | ✅ Tested |
| Home Assistant | See [Home Assistant Add-on](#home-assistant-add-on) above | ✅ Primary platform |

> These guides cover everything from VM creation to running container, including USB/Bluetooth hardware passthrough — critical for device access.

## Configuration

| Option | Default | Description |
|--------|---------|-------------|
| `intiface_port` | `12345` | WebSocket port for the Intiface Engine server |
| `server_port` | `8099` | HTTP port for the PlayRooms web server |
| `scan_on_start` | `false` | Automatically scan for Buttplug.io devices on startup |
| `use_bluetooth` | `false` | Enable Bluetooth LE device scanning* |
| `use_serial` | `false` | Enable serial port device scanning* |
| `use_hid` | `false` | Enable USB HID device scanning* |

> \* Transport options require an add-on restart to take effect (no rebuild needed). The host machine must have the corresponding hardware (Bluetooth adapter, serial device, USB dongle) connected and accessible. See [DOCS.md](buttplug-playrooms/DOCS.md) for detailed transport requirements.


## Known Limitations

- **amd64 only** — no aarch64 support (no upstream Linux ARM builds for Intiface Engine)
- **Beta status** — not all features have been verified end-to-end
- **Room layout editor** — drag-and-resize widget layout is not yet implemented
- **Add-on icons** — using SVG placeholders; PNG icons not yet created
- **NAT traversal** — WebRTC features may require a TURN server behind strict NAT (not included)
- **Hardware access** — transport options require the host to have the corresponding hardware (Bluetooth adapter, serial dongle, USB HID device) connected and passed through to the VM/container; the server logs a warning at startup if an enabled transport has no detected hardware

## Acknowledgements

- [Buttplug.io](https://buttplug.io/) and [Intiface Engine](https://github.com/intiface/intiface-engine) — the device control layer this project is built on
- [Home Assistant](https://www.home-assistant.io/) — the platform hosting this add-on
- See [NOTICE.md](NOTICE.md) for a full list of third-party dependencies and their licenses

## Contributors

Created and maintained by [troon4891](https://github.com/troon4891).

Contributions are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

This project was built with the assistance of AI tools.

## Links

- [Documentation](buttplug-playrooms/DOCS.md) — detailed usage guide, concepts, and widget descriptions
- [Security Policy](SECURITY.md) — how to report vulnerabilities
- [Changelog](buttplug-playrooms/CHANGELOG.md) — version history and release notes
- [NOTICE](NOTICE.md) — third-party dependency licenses
