import { ButtplugClient, ButtplugNodeWebsocketClientConnector, ButtplugClientDevice } from "buttplug";
import { config } from "../config.js";
import type { DeviceState, DeviceCapabilities, DeviceCommand } from "../types/index.js";

let client: ButtplugClient | null = null;
let deviceListeners: Array<(devices: DeviceState[]) => void> = [];

export function onDevicesChanged(listener: (devices: DeviceState[]) => void): () => void {
  deviceListeners.push(listener);
  return () => {
    deviceListeners = deviceListeners.filter((l) => l !== listener);
  };
}

function notifyDeviceListeners(): void {
  const states = getDeviceStates();
  for (const listener of deviceListeners) {
    listener(states);
  }
}

function mapCapabilities(device: ButtplugClientDevice): DeviceCapabilities {
  const msgAttrs = device.messageAttributes;
  return {
    vibrate: msgAttrs.ScalarCmd?.some((a) => a.ActuatorType === "Vibrate") ?? false,
    rotate: msgAttrs.RotateCmd !== undefined,
    linear: msgAttrs.LinearCmd !== undefined,
    battery: msgAttrs.SensorReadCmd?.some((a) => a.SensorType === "Battery") ?? false,
  };
}

function deviceToState(device: ButtplugClientDevice): DeviceState {
  return {
    id: String(device.index),
    name: device.name,
    connected: true,
    batteryLevel: null,
    capabilities: mapCapabilities(device),
  };
}

export function getDeviceStates(): DeviceState[] {
  if (!client) return [];
  return client.devices.map(deviceToState);
}

export async function connectClient(): Promise<void> {
  if (client?.connected) return;

  client = new ButtplugClient("PlayRooms");

  client.addListener("deviceadded", () => notifyDeviceListeners());
  client.addListener("deviceremoved", () => notifyDeviceListeners());

  const connector = new ButtplugNodeWebsocketClientConnector(
    `ws://127.0.0.1:${config.intifacePort}`
  );

  try {
    await client.connect(connector);
    console.log("[Buttplug] Connected to Intiface Engine");
  } catch (err) {
    console.error("[Buttplug] Connection failed:", err);
    client = null;
    throw err;
  }
}

export async function disconnectClient(): Promise<void> {
  if (client?.connected) {
    await client.disconnect();
    console.log("[Buttplug] Disconnected");
  }
  client = null;
}

export async function startScanning(): Promise<void> {
  if (!client?.connected) throw new Error("Buttplug client not connected");
  await client.startScanning();
  console.log("[Buttplug] Scanning started");
}

export async function stopScanning(): Promise<void> {
  if (!client?.connected) return;
  await client.stopScanning();
  console.log("[Buttplug] Scanning stopped");
}

export async function sendCommand(cmd: DeviceCommand): Promise<void> {
  if (!client?.connected) throw new Error("Buttplug client not connected");

  const device = client.devices.find((d) => String(d.index) === cmd.deviceId);
  if (!device) throw new Error(`Device ${cmd.deviceId} not found`);

  const value = Math.max(0, Math.min(1, cmd.value));

  switch (cmd.command) {
    case "vibrate":
      await device.vibrate(value);
      break;
    case "rotate":
      await device.rotate(value, true);
      break;
    case "linear":
      await device.linear(value, 500);
      break;
    case "stop":
      await device.stop();
      break;
    default:
      throw new Error(`Unknown command: ${cmd.command}`);
  }
}

export function isConnected(): boolean {
  return client?.connected ?? false;
}
