# ButtPlug.io PlayRooms — Documentation

A Home Assistant add-on that hosts a Buttplug.io (Intiface Engine) instance and exposes connected devices through shareable Play Rooms.

## Features

- **Play Rooms**: Create customizable rooms with widgets for device control, chat, and video
- **Share Links**: Generate links to invite guests to your Play Rooms via a PWA
- **Toy Box**: Control Buttplug.io devices with intensity sliders, presets, and quick buttons
- **Web Cam**: Stream your webcam to guests (host-only broadcast)
- **Video Chat**: Multi-participant video wall (up to 4 guests)
- **Voice Chat**: Push-to-talk or open mic voice communication
- **Text Chat**: Real-time text messaging with message history

## What is a Play Room?

A Play Room is a customizable space where users can add "widgets" to enhance its functionality and layout. Each Play Room features both a **Guest view** and a **Host view**, accommodating 1 to 4 guests depending on the room settings.

Hosts determine how the room can be accessed, typically through an **open method** or a **challenge system**:

- **Challenge method**: When a guest joins a Share Link with a challenge, a code is generated that the guest must enter, or the host can approve their entry through a lobby.
- **Open method**: Guests with this link can join by simply entering their name and selecting settings in the lobby.

Each Play Room includes established Room Rules and a Toy Box for toy management.

## What is a Share Link?

A Share Link is a generated URL that grants external access to a specific Play Room. The web UI allows hosts to generate these links. When a guest clicks one, they enter the lobby flow determined by the room's access mode (open or challenge).

## Widgets

### Toy Box

The Toy Box contains the Buttplug.io devices linked to this Play Room along with any preconfigured settings, options, and exposed buttons. Hosts assign devices to the room's Toy Box from the Settings page. Guests interact with the exposed controls (intensity sliders, presets, quick buttons) according to the permissions set by the host.

### Web Cam

Enables the host to link a webcam and stream video to guests via WebRTC. Guests cannot connect their own cameras to this widget — it is host-only, one-way streaming.

### Video Chat

Creates a small video wall for participants, with the option for the host to join. When the host opts in, their video connection automatically enables voice for all guests. Supports up to 4 guests in the video grid.

### Voice Chat

A walkie-talkie-style voice chat that can operate in either a push-to-talk mode or a continuous open mic format. Uses WebRTC for peer-to-peer audio.

### Text Chat

Real-time text messaging between host and guests within the Play Room, with message persistence in the database (up to 500 messages per room).

## Configuration

| Option | Default | Description |
|--------|---------|-------------|
| `intiface_port` | `12345` | WebSocket port for the Intiface Engine server |
| `server_port` | `8099` | HTTP port for the PlayRooms web server |
| `scan_on_start` | `false` | Automatically scan for devices on startup |

## Access Modes

### Open Mode
Anyone with a Share Link can join by entering their name in the lobby.

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
