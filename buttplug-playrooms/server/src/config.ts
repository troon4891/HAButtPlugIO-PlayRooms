import { readFileSync, existsSync } from "fs";
import { join } from "path";

export interface TransportConfig {
  bluetooth: boolean;
  serial: boolean;
  hid: boolean;
}

interface AppConfig {
  intifacePort: number;
  serverPort: number;
  scanOnStart: boolean;
  dataDir: string;
  transports: TransportConfig;
}

function parseBool(value: unknown, envFallback: string | undefined, defaultVal: boolean): boolean {
  if (value !== undefined && value !== null) {
    if (typeof value === "boolean") return value;
    if (typeof value === "string") return value.toLowerCase() === "true";
  }
  if (envFallback !== undefined) return envFallback.toLowerCase() === "true";
  return defaultVal;
}

function loadConfig(): AppConfig {
  // Try reading HA add-on options first
  const optionsPath = "/data/options.json";
  let haOptions: Record<string, unknown> = {};

  if (existsSync(optionsPath)) {
    try {
      haOptions = JSON.parse(readFileSync(optionsPath, "utf-8"));
    } catch {
      // Fall back to env vars
    }
  }

  return {
    intifacePort: Number(haOptions.intiface_port ?? process.env.INTIFACE_PORT ?? 12345),
    serverPort: Number(haOptions.server_port ?? process.env.SERVER_PORT ?? 8099),
    scanOnStart: parseBool(haOptions.scan_on_start, process.env.SCAN_ON_START, false),
    dataDir: process.env.DATA_DIR ?? join(process.cwd(), "data"),
    transports: {
      bluetooth: parseBool(haOptions.use_bluetooth, process.env.USE_BLUETOOTH, false),
      serial: parseBool(haOptions.use_serial, process.env.USE_SERIAL, false),
      hid: parseBool(haOptions.use_hid, process.env.USE_HID, false),
    },
  };
}

export const config = loadConfig();
