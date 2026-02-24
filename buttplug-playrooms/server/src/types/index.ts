export type AccessMode = "open" | "challenge";
export type ChallengeType = "code" | "approval";
export type GuestStatus = "pending" | "approved" | "joined" | "disconnected";
export type WidgetType = "toybox" | "webcam" | "videochat" | "voicechat" | "textchat";
export type VoiceMode = "ptt" | "open";
export type UserRole = "admin" | "host";
export type GuestType = "short" | "long";
export type AuthMode = "ha-ingress" | "standalone";
export type ApiKeyScope = "rooms:read" | "rooms:write" | "devices:read" | "devices:write" | "guests:read" | "webhooks:manage";
export type WebhookEvent =
  | "guest:joined" | "guest:left" | "guest:approved" | "guest:rejected"
  | "device:connected" | "device:disconnected" | "device:assigned"
  | "command:sent" | "room:updated" | "room:deleted" | "chat:message";

export interface WidgetConfig {
  type: WidgetType;
  enabled: boolean;
  settings: Record<string, unknown>;
}

export interface RoomPublicInfo {
  id: string;
  name: string;
  accessMode: AccessMode;
  challengeType: ChallengeType | null;
  maxGuests: number;
  currentGuests: number;
  widgets: WidgetType[];
}

export interface DeviceCapabilities {
  vibrate: boolean;
  rotate: boolean;
  linear: boolean;
  battery: boolean;
}

export interface DeviceState {
  id: string;
  name: string;
  connected: boolean;
  batteryLevel: number | null;
  capabilities: DeviceCapabilities;
}

export interface DeviceCommand {
  deviceId: string;
  command: "vibrate" | "rotate" | "linear" | "stop";
  value: number;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  senderName: string;
  message: string;
  createdAt: number;
}

export interface LobbyGuest {
  guestId: string;
  name: string;
  code?: string;
}

// Socket.IO event types
export interface ServerToClientEvents {
  "guest:approved": (data: { guestId: string }) => void;
  "guest:joined": (data: { guestId: string; name: string }) => void;
  "guest:left": (data: { guestId: string }) => void;
  "lobby:pending": (data: LobbyGuest) => void;
  "device:state": (data: DeviceState) => void;
  "chat:message": (data: ChatMessage) => void;
  "webrtc:offer": (data: { sdp: string; from: string; to: string }) => void;
  "webrtc:answer": (data: { sdp: string; from: string; to: string }) => void;
  "webrtc:ice": (data: { candidate: RTCIceCandidateInit; from: string; to: string }) => void;
  "voice:ptt-start": (data: { guestId: string }) => void;
  "voice:ptt-end": (data: { guestId: string }) => void;
  "room:state": (data: { guests: Array<{ id: string; name: string }>; devices: DeviceState[] }) => void;
  "error": (data: { message: string }) => void;
}

export interface ClientToServerEvents {
  "guest:join": (data: { token: string; name: string; code?: string }) => void;
  "lobby:approve": (data: { guestId: string }) => void;
  "lobby:reject": (data: { guestId: string }) => void;
  "device:command": (data: DeviceCommand) => void;
  "chat:message": (data: { message: string }) => void;
  "webrtc:offer": (data: { sdp: string; to: string }) => void;
  "webrtc:answer": (data: { sdp: string; to: string }) => void;
  "webrtc:ice": (data: { candidate: RTCIceCandidateInit; to: string }) => void;
  "voice:ptt-start": () => void;
  "voice:ptt-end": () => void;
}