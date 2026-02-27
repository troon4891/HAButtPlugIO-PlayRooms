# Deferred & Future Items

Consolidated list of known deferred work items, tracked for future planning.

---

## Portal Testing — 8 Known Issues

From `portal-plan/01-IMPLEMENTATION-STATUS.md`. Must be verified before portal
mode is considered stable.

1. **Socket.IO path vs namespace confusion** (HIGH) — relay client uses
   `path: "/relay"` but should use namespace. May prevent HA↔portal connection.
2. **Compound token parsing** — portal rejects tokens without 4+ char prefix;
   confusing error for local-mode tokens.
3. **relay-bridge.ts onDevicesChanged conflict** — verify callback doesn't
   conflict when both relay bridge and normal room handler register it.
4. **Lobby markGuestDisconnected with portal: prefix** — verify DB lookups work
   with synthetic `portal:${guestId}` socket IDs.
5. **SPA catch-all route precedence** — verify `/api/join/:token` isn't caught
   by `app.get("*")` static handler on portal.
6. **Grace period timer with reconnected instance** — verify old timer sees
   re-registered instance correctly.
7. **handleReconnectedGuests auto-approve** — verify no duplicate DB entries
   when guests auto-approve on reconnect.
8. **Device command authorization parity** — verify relay-bridge device check
   matches local room.socket.ts check.

## WebRTC Relay (Phase 6)

WebRTC signaling events (`webrtc:offer`, `webrtc:answer`, `webrtc:ice`) are NOT
in `RELAY_ALLOWED_EVENTS` — silently dropped by portal. Video chat, voice chat,
and webcam do NOT work through portal. Full plan in
`portal-plan/05-FUTURE-WORK.md`.

## TURN Server

Required for reliable WebRTC through portal (NAT traversal). Options: coturn
(self-hosted), Twilio TURN, Metered, Xirsys. See `portal-plan/05-FUTURE-WORK.md`.

## Room Layout Editor

Phase 8 item — drag/resize widget layout. Never implemented.

## Proper PNG Icons

`icon.png` (128x128) and `logo.png` (256x256) for HA add-on. Only SVG
placeholders exist. Vite manifest was fixed in v2.0.1 to use SVG, but HA
Supervisor expects PNG.

## Unit Tests

vitest planned but never implemented. No test infrastructure exists.

## README Badge Update

Update shields.io badges and status indicators once versions are tested.
