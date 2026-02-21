# ButtPlug.io PlayRooms

A Home Assistant add-on that hosts a Buttplug.io (Intiface Engine) instance and exposes connected devices through shareable Play Rooms.

## Features

- **Play Rooms**: Create customizable rooms with widgets for device control, chat, and video
- **Share Links**: Generate links to invite guests to your Play Rooms via a PWA
- **Toy Box**: Control Buttplug.io devices with intensity sliders, presets, and quick buttons
- **Web Cam**: Stream your webcam to guests (host-only broadcast)
- **Video Chat**: Multi-participant video wall (up to 4 guests)
- **Voice Chat**: Push-to-talk or open mic voice communication
- **Text Chat**: Real-time text messaging with message history

## Configuration

| Option | Default | Description |
|--------|---------|-------------|
| `intiface_port` | `12345` | WebSocket port for the Intiface Engine server |
| `server_port` | `8099` | HTTP port for the PlayRooms web server |
| `scan_on_start` | `false` | Automatically scan for devices on startup |

## Access Modes

### Open Mode
Anyone with a share link can join by entering their name in the lobby.

### Challenge Mode
Guests must either:
- **Code**: Enter a 6-digit code displayed to the host
- **Approval**: Wait for the host to manually approve their entry

## How It Works

1. Install the add-on from your Home Assistant instance
2. Open the PlayRooms panel from the sidebar
3. Create a Play Room and configure its widgets
4. Pair your Buttplug.io devices via the Settings page
5. Assign devices to the room's Toy Box
6. Generate a Share Link and send it to your guest(s)
7. Guests open the link in their browser (PWA installable) and join through the lobby

## Network Requirements

- WebRTC features (Video Chat, Voice Chat, Web Cam) require peer-to-peer connectivity
- If behind strict NAT, a TURN server may be needed (not included by default)
- The add-on uses HA's ingress system for authenticated host access
