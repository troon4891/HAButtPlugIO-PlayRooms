import { readFileSync, existsSync } from "fs";
import { join } from "path";

interface AppConfig {
  intifacePort: number;
  serverPort: number;
  scanOnStart: boolean;
  dataDir: string;
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
    scanOnStart: Boolean(haOptions.scan_on_start ?? process.env.SCAN_ON_START === "true"),
    dataDir: process.env.DATA_DIR ?? join(process.cwd(), "data"),
  };
}

export const config = loadConfig();
