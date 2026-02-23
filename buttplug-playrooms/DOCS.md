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
| `use_bluetooth` | `false` | Enable Bluetooth LE device scanning* |
| `use_serial` | `false` | Enable serial port device scanning* |
| `use_hid` | `false` | Enable USB HID device scanning* |

> \* Transport options require an add-on restart to take effect. No rebuild is needed — transport selection is a runtime configuration.

## Transport Configuration

Transports control how the Intiface Engine discovers and communicates with physical devices. Each transport requires both the software toggle (the add-on option) and the corresponding hardware on the host machine.

### Bluetooth LE (`use_bluetooth`)

Enables Bluetooth Low Energy scanning for wireless toys. This is the most common transport for Buttplug.io-compatible devices (Lovense, We-Vibe, Kiiroo, and others).

**Requirements:**
- A Bluetooth adapter on the Home Assistant host (built-in or USB dongle)
- The adapter must be visible to the host OS (check with `hciconfig` on the host)

> **\*** If enabled without a Bluetooth adapter, the add-on logs a warning at startup. Scanning will start but will not discover any devices. The add-on uses D-Bus to communicate with BlueZ on the host — the `host_dbus` permission is declared automatically in the add-on configuration.

### Serial Port (`use_serial`)

Enables serial port scanning for USB-to-serial adapters and Lovense serial dongles.

**Requirements:**
- A serial device connected to the host (appears as `/dev/ttyUSB*` or `/dev/ttyACM*`)

> **\*** Enabling this transport also enables Lovense serial dongle support automatically. Serial devices are hot-pluggable but the add-on must be restarted to detect newly connected serial adapters. The `uart` permission is declared automatically in the add-on configuration.

### USB HID (`use_hid`)

Enables USB Human Interface Device scanning for Lovense HID dongles and other HID-compatible devices.

**Requirements:**
- A USB HID device connected to the host (appears as `/dev/hidraw*`)

> **\*** Enabling this transport also enables Lovense HID dongle support automatically. Some HID devices may require additional host-level permissions. If device scanning fails, check the add-on logs for permission errors. The `usb` permission is declared automatically in the add-on configuration.

### Verifying Transport Status

After enabling a transport and restarting the add-on, check the add-on logs. The engine logs its transport configuration at startup:

```
[Engine] Transport configuration:
[Engine]   Bluetooth LE: ENABLED
[Engine]   Serial Port:  disabled
[Engine]   USB HID:      disabled
[Engine]   Bluetooth hardware: Found adapter(s): hci0
[Engine] Starting Intiface Engine on port 12345
[Engine] Arguments: --websocket-port 12345 --use-bluetooth-le
```

If an enabled transport has no corresponding hardware, a warning appears:

```
[Engine] WARNING: Bluetooth LE is enabled but no Bluetooth adapter was detected
(/sys/class/bluetooth/ is empty). Ensure the host has a Bluetooth adapter
and the add-on has host_dbus access.
```

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
3. **Enable at least one transport** (Bluetooth, Serial, or USB HID) in the add-on configuration
4. Create a Play Room and configure its widgets
5. Pair your Buttplug.io devices via the Settings page
6. Assign devices to the room's Toy Box
7. Generate a Share Link and send it to your guest(s)
8. Guests open the link in their browser (PWA installable) and join through the lobby

## Network Requirements

- WebRTC features (Video Chat, Voice Chat, Web Cam) require peer-to-peer connectivity
- If behind strict NAT, a TURN server may be needed (not included by default)
- The add-on uses HA's ingress system for authenticated host access

## Browser Requirements

Guest access via Share Links requires a modern browser. The following minimum versions are needed:

| Feature | Required For | Chrome | Firefox | Safari | Edge |
|---------|-------------|--------|---------|--------|------|
| WebSocket | All features | 16+ | 11+ | 7+ | 12+ |
| WebRTC | Video/Voice Chat, Web Cam | 28+ | 22+ | 11+ | 79+ |
| Service Worker | PWA install | 40+ | 44+ | 11.1+ | 17+ |
| MediaDevices API | Camera/mic access | 53+ | 36+ | 11+ | 79+ |

> **HTTPS required for WebRTC:** Share links accessed over plain HTTP will fail camera and microphone permissions in Chrome, Firefox, and Safari. Home Assistant ingress provides an authenticated HTTPS context. If accessing Share Links directly (not through ingress), ensure HTTPS is configured or use `localhost`.

## Community Tested Devices

The following devices have been tested by the community with this add-on. Results may vary depending on host hardware and environment.

| Device | Transport | Status | Notes |
|--------|-----------|--------|-------|
| *(Community testing in progress)* | | | *Report results in [GitHub Discussions](https://github.com/troon4891/HAButtPlugIO-PlayRooms/discussions)* |

> These tables are maintained by the development team based on community reports. To add your device, open a thread in [GitHub Discussions](https://github.com/troon4891/HAButtPlugIO-PlayRooms/discussions).

## Community Tested HA Platforms

| Installation Type | Hardware | Status | Notes |
|-------------------|----------|--------|-------|
| HA OS | amd64 / x86_64 | Verified | Development platform |
| *(Other platforms)* | | | *Report results in [GitHub Discussions](https://github.com/troon4891/HAButtPlugIO-PlayRooms/discussions)* |

> These tables are maintained by the development team based on community reports. To add your platform, open a thread in [GitHub Discussions](https://github.com/troon4891/HAButtPlugIO-PlayRooms/discussions).
