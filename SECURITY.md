# Security Policy

## About This Project

HAButtPlugIO-PlayRooms bridges Buttplug.io / Intiface Engine with a Play Rooms system accessible via Share Links. It runs as a Home Assistant add-on or standalone Docker container. Because it involves **physical device control** (intimate hardware via Buttplug.io), **external network access** (Share Links expose rooms outside the local network), and **real-time media streams** (WebRTC video/voice/webcam), security issues here can have real-world physical and privacy consequences beyond typical software vulnerabilities.

## Supported Versions

This project is currently in **beta**. Security fixes are applied to the latest beta release only.

| Version       | Supported          |
| ------------- | ------------------ |
| 3.1.x (beta)  | :white_check_mark: |
| 3.0.x (beta)  | :white_check_mark: |
| 2.0.x         | :x:                |
| 1.x.x         | :x:                |

Once the project reaches a stable release, this table will be updated to reflect the long-term support policy.

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Please report security concerns through GitHub's private security advisory process:

1. Go to: [**Report a vulnerability**](https://github.com/troon4891/HAButtPlugIO-PlayRooms/security/advisories/new)
2. Provide a clear description of the issue, steps to reproduce, and the potential impact.
3. Include your assessment of severity if possible.

You will receive an acknowledgment within **7 days**. We aim to provide a substantive response (confirmation, request for more info, or fix timeline) within **14 days** of the initial report.

If the vulnerability is accepted, a fix will be developed privately within the advisory, and a patched release will be published with coordinated disclosure. If declined, we will explain why.

## Scope — What Counts as a Security Issue

The following categories are **in scope** for this project:

### Device Control & Physical Safety
- Unauthorized access to Buttplug.io device commands (bypassing room access controls to send vibrate/rotate/linear commands)
- Ability to control devices outside the intended Play Room session
- Anything that could cause unintended physical device activation
- Bypassing the device approval whitelist (sending commands to unapproved/denied devices)
- Bypassing the protocol allowlist (connecting to devices whose protocol is disabled)
- Unauthorized engine start/stop (e.g., guest triggering engine lifecycle endpoints)

### Share Link & Access Control
- Share Link token prediction, brute-force, or replay attacks
- Bypassing lobby access controls (challenge codes, host approval gates)
- Privilege escalation from guest to host within a room
- Accessing rooms or device controls without a valid Share Link or HA ingress session

### Authentication & Session Integrity
- Bypassing Home Assistant ingress authentication for host-side endpoints
- JWT token theft, replay, or forgery in standalone mode
- API key exposure, brute-force, or scope escalation
- First-user setup race condition (exploiting the initial admin creation endpoint)
- Session hijacking or fixation in Socket.IO connections
- Cross-room data leakage (guest in Room A accessing Room B state)

### Data & Privacy
- Unauthorized access to the SQLite database (chat history, room configs, device data)
- WebRTC stream interception or redirection (video, voice, webcam feeds routed to unintended recipients)
- Information disclosure through API responses, error messages, or WebSocket events

### Infrastructure
- Server-side code execution via crafted API input or WebSocket payloads
- Path traversal or file access outside the add-on's intended scope
- Denial of service against the Intiface Engine or Node.js server that could leave devices in an uncontrolled state

### Out of Scope
- Vulnerabilities in upstream dependencies (Buttplug.io, Intiface Engine, Home Assistant core) — please report these to their respective projects
- Issues requiring physical access to the Home Assistant host machine
- Social engineering attacks against room hosts
- Browser-specific bugs unrelated to this project's code

## Disclosure Policy

We follow coordinated disclosure. Once a fix is available, we will:

1. Publish a patched release
2. Credit the reporter in the advisory (unless anonymity is requested)
3. Add a changelog entry describing the fix without exposing exploit details

## Contact

For security matters, use the [GitHub private advisory process](https://github.com/troon4891/HAButtPlugIO-PlayRooms/security/advisories/new) linked above. This ensures encrypted, trackable communication and keeps the discussion private until a fix is ready.
