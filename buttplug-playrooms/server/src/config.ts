import { readFileSync, existsSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { randomBytes } from "crypto";
import type { AuthMode } from "./types/index.js";

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
  authMode: AuthMode;
  jwtSecret: string;
  lockoutThreshold: number;
  lockoutDurationMs: number;
  corsOrigins: string; // comma-separated or "*"
}

function parseBool(value: unknown, envFallback: string | undefined, defaultVal: boolean): boolean {
  if (value !== undefined && value !== null) {
    if (typeof value === "boolean") return value;
    if (typeof value === "string") return value.toLowerCase() === "true";
  }
  if (envFallback !== undefined) return envFallback.toLowerCase() === "true";
  return defaultVal;
}

function getOrCreateJwtSecret(dataDir: string): string {
  // Allow explicit env override
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;

  // Persist a generated secret so it survives restarts
  const secretPath = join(dataDir, ".jwt-secret");
  if (existsSync(secretPath)) {
    return readFileSync(secretPath, "utf-8").trim();
  }

  const secret = randomBytes(48).toString("hex");
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }
  writeFileSync(secretPath, secret, { mode: 0o600 });
  return secret;
}

function loadConfig(): AppConfig {
  // Try reading HA add-on options first
  const optionsPath = "/data/options.json";
  let haOptions: Record<string, unknown> = {};
  const isHaMode = existsSync(optionsPath);

  if (isHaMode) {
    try {
      haOptions = JSON.parse(readFileSync(optionsPath, "utf-8"));
    } catch {
      // Fall back to env vars
    }
  }

  const dataDir = process.env.DATA_DIR ?? join(process.cwd(), "data");

  // Auto-detect auth mode: HA ingress if options.json exists, standalone otherwise
  const authMode: AuthMode = (process.env.AUTH_MODE as AuthMode) ??
    (isHaMode ? "ha-ingress" : "standalone");

  return {
    intifacePort: Number(haOptions.intiface_port ?? process.env.INTIFACE_PORT ?? 12345),
    serverPort: Number(haOptions.server_port ?? process.env.SERVER_PORT ?? 8099),
    scanOnStart: parseBool(haOptions.scan_on_start, process.env.SCAN_ON_START, false),
    dataDir,
    transports: {
      bluetooth: parseBool(haOptions.use_bluetooth, process.env.USE_BLUETOOTH, false),
      serial: parseBool(haOptions.use_serial, process.env.USE_SERIAL, false),
      hid: parseBool(haOptions.use_hid, process.env.USE_HID, false),
    },
    authMode,
    jwtSecret: getOrCreateJwtSecret(dataDir),
    lockoutThreshold: Number(process.env.LOCKOUT_THRESHOLD ?? 5),
    lockoutDurationMs: Number(process.env.LOCKOUT_DURATION_MS ?? 15 * 60 * 1000),
    corsOrigins: process.env.CORS_ORIGINS ?? (authMode === "ha-ingress" ? "*" : ""),
  };
}

export const config = loadConfig();
