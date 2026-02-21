# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
