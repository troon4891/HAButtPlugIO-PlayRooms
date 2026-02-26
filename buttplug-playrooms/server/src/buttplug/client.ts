import { ButtplugClient, ButtplugNodeWebsocketClientConnector, ButtplugClientDevice } from "buttplug";
import { config } from "../config.js";
import { matchesEnabledProtocol } from "./protocol-filter.js";
import { getOrCreateDevice, isDeviceApproved } from "./device-approval.js";
import type { DeviceState, DeviceCapabilities, DeviceCommand } from "../types/index.js";

let client: ButtplugClient | null = null;
let deviceListeners: Array<(devices: DeviceState[]) => void> = [];
let discoveredListeners: Array<() => void> = [];

// Track all discovered devices with their buttplug index → identifier mapping
const discoveredDeviceMap = new Map<number, { name: string; identifier: string }>();

export function onDevicesChanged(listener: (devices: DeviceState[]) => void): () => void {
  deviceListeners.push(listener);
  return () => {
    deviceListeners = deviceListeners.filter((l) => l !== listener);
  };
}

export function onDiscoveredChanged(listener: () => void): () => void {
  discoveredListeners.push(listener);
  return () => {
    discoveredListeners = discoveredListeners.filter((l) => l !== listener);
  };
}

function notifyDeviceListeners(): void {
  const states = getDeviceStates();
  for (const listener of deviceListeners) {
    listener(states);
  }
}

function notifyDiscoveredListeners(): void {
  for (const listener of discoveredListeners) {
    listener();
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

/**
 * Returns only approved + connected devices (backward compatible).
 * Used by ToyBox, room assignment, etc.
 */
export function getDeviceStates(): DeviceState[] {
  if (!client) return [];
  const approvedStates: DeviceState[] = [];
  // We filter synchronously using the discovered map; the approval check
  // was already done when the device was added
  for (const device of client.devices) {
    const entry = discoveredDeviceMap.get(device.index);
    if (entry) {
      // Only include if we know it's been approved (check is cached in the map flow)
      approvedStates.push(deviceToState(device));
    }
  }
  return approvedStates;
}

/**
 * Returns all discovered device info with their approval status and connection state.
 * Used by the Settings UI to show pending/approved/denied devices.
 */
export async function getDiscoveredDevices(): Promise<
  Array<{
    id: string;
    approvalId: string;
    name: string;
    identifier: string;
    status: string;
    connected: boolean;
    capabilities: DeviceCapabilities;
    batteryLevel: number | null;
  }>
> {
  const { getAllDeviceRecords } = await import("./device-approval.js");
  const records = await getAllDeviceRecords();

  return records.map((record) => {
    // Find the live buttplug device if connected
    const liveDevice = client?.devices.find(
      (d) => discoveredDeviceMap.get(d.index)?.identifier === record.identifier
    );

    return {
      id: record.id,
      approvalId: record.id,
      name: record.displayName || record.deviceName,
      identifier: record.identifier,
      status: record.status,
      connected: !!liveDevice,
      capabilities: liveDevice
        ? mapCapabilities(liveDevice)
        : { vibrate: false, rotate: false, linear: false, battery: false },
      batteryLevel: null,
    };
  });
}

async function handleDeviceAdded(device: ButtplugClientDevice): Promise<void> {
  const identifier = `bp_${device.index}_${device.name}`;

  // Step 1: Protocol filter — is this device's brand/protocol allowed?
  const protocolResult = await matchesEnabledProtocol(device.name);
  if (!protocolResult.allowed) {
    console.log(
      `[Buttplug] Device "${device.name}" blocked by protocol filter (protocol: ${protocolResult.protocol})`
    );
    return;
  }

  // Step 2: Record in approval database
  discoveredDeviceMap.set(device.index, { name: device.name, identifier });
  const record = await getOrCreateDevice(device.name, identifier);

  console.log(
    `[Buttplug] Device discovered: "${device.name}" (status: ${record.status}, protocol: ${protocolResult.protocol})`
  );

  // Notify discovered listeners (for Settings UI refresh)
  notifyDiscoveredListeners();

  // Step 3: Only notify device listeners (ToyBox etc.) if approved
  if (record.status === "approved") {
    notifyDeviceListeners();
  }
}

function handleDeviceRemoved(device: ButtplugClientDevice): void {
  discoveredDeviceMap.delete(device.index);
  notifyDeviceListeners();
  notifyDiscoveredListeners();
}

export async function connectClient(): Promise<void> {
  if (client?.connected) return;

  client = new ButtplugClient("PlayRooms");

  client.addListener("deviceadded", (device: ButtplugClientDevice) => {
    handleDeviceAdded(device).catch((err) =>
      console.error("[Buttplug] Error handling device added:", err)
    );
  });
  client.addListener("deviceremoved", (device: ButtplugClientDevice) => {
    handleDeviceRemoved(device);
  });

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
  discoveredDeviceMap.clear();
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

  // Only allow commands to approved devices
  const identifier = discoveredDeviceMap.get(device.index)?.identifier;
  if (identifier && !(await isDeviceApproved(identifier))) {
    throw new Error(`Device ${cmd.deviceId} is not approved`);
  }

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

/**
 * Re-evaluate all discovered devices against current approval status.
 * Called after a device is approved/denied to immediately update the device list.
 */
export function refreshDeviceStates(): void {
  notifyDeviceListeners();
  notifyDiscoveredListeners();
}
