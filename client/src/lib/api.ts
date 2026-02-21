const BASE_URL = "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

// Rooms
export const rooms = {
  list: () => request<Room[]>("/rooms"),
  get: (id: string) => request<Room>(`/rooms/${id}`),
  create: (data: CreateRoomInput) => request<Room>("/rooms", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<CreateRoomInput>) => request<Room>(`/rooms/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: string) => request<void>(`/rooms/${id}`, { method: "DELETE" }),
};

// Share links
export const share = {
  create: (roomId: string, expiresInMs?: number) =>
    request<ShareLink>(`/rooms/${roomId}/share`, { method: "POST", body: JSON.stringify({ expiresInMs }) }),
  list: (roomId: string) => request<ShareLink[]>(`/rooms/${roomId}/share`),
  revoke: (token: string) => request<void>(`/share/${token}`, { method: "DELETE" }),
  validate: (token: string) => request<RoomPublicInfo>(`/join/${token}`),
};

// Devices
export const devices = {
  list: () => request<DeviceState[]>("/devices"),
  startScan: () => request<{ status: string }>("/devices/scan/start", { method: "POST" }),
  stopScan: () => request<{ status: string }>("/devices/scan/stop", { method: "POST" }),
  assign: (id: string, roomId: string, settings?: Record<string, unknown>) =>
    request(`/devices/${id}/assign`, { method: "POST", body: JSON.stringify({ roomId, settings }) }),
};

// Health
export const health = () => request<{ status: string; buttplug: boolean; version: string }>("/health");

// Types
export interface Room {
  id: string;
  name: string;
  accessMode: "open" | "challenge";
  challengeType: "code" | "approval" | null;
  maxGuests: number;
  widgets: WidgetConfig[];
  createdAt: number;
  updatedAt: number;
}

export interface CreateRoomInput {
  name: string;
  accessMode: "open" | "challenge";
  challengeType?: "code" | "approval";
  maxGuests: number;
  widgets: WidgetConfig[];
}

export interface WidgetConfig {
  type: "toybox" | "webcam" | "videochat" | "voicechat" | "textchat";
  enabled: boolean;
  settings: Record<string, unknown>;
}

export interface ShareLink {
  id: string;
  roomId: string;
  token: string;
  active: number;
  expiresAt: number | null;
  createdAt: number;
}

export interface RoomPublicInfo {
  id: string;
  name: string;
  accessMode: "open" | "challenge";
  challengeType: "code" | "approval" | null;
  maxGuests: number;
  widgets: string[];
}

export interface DeviceState {
  id: string;
  name: string;
  connected: boolean;
  batteryLevel: number | null;
  capabilities: {
    vibrate: boolean;
    rotate: boolean;
    linear: boolean;
    battery: boolean;
  };
}
