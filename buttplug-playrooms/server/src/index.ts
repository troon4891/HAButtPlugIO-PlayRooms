import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { existsSync, readFileSync } from "fs";

import { config } from "./config.js";
import { runMigrations } from "./db/migrate.js";
import { startEngine, stopEngine } from "./buttplug/engine.js";
import { connectClient, startScanning, isConnected, getDeviceStates } from "./buttplug/client.js";
import { roomRouter } from "./rooms/room.routes.js";
import { setupRoomSockets } from "./rooms/room.socket.js";
import { requireHost, requireShareToken } from "./auth/middleware.js";
import { createShareLink, validateShareLink, revokeShareLink, getLinksForRoom } from "./auth/share-links.js";
import { assignDeviceToRoom } from "./widgets/toybox.service.js";

import type { ServerToClientEvents, ClientToServerEvents } from "./types/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
const server = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

// Middleware
app.use(cors());
app.use(express.json());

// Serve static PWA files (index: false so index.html goes through ingress injection)
const publicDir = join(__dirname, "..", "public");
if (existsSync(publicDir)) {
  app.use(express.static(publicDir, { index: false }));
}

// --- Host API routes (require HA ingress auth) ---
app.use("/api/rooms", requireHost, roomRouter);

app.get("/api/devices", requireHost, (_req, res) => {
  res.json(getDeviceStates());
});

app.post("/api/devices/scan/start", requireHost, async (_req, res) => {
  try {
    await startScanning();
    res.json({ status: "scanning" });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post("/api/devices/scan/stop", requireHost, async (_req, res) => {
  try {
    const { stopScanning } = await import("./buttplug/client.js");
    await stopScanning();
    res.json({ status: "stopped" });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post("/api/devices/:id/assign", requireHost, (req, res) => {
  try {
    const result = assignDeviceToRoom(
      parseInt(req.params.id),
      req.body.roomId,
      req.body.settings
    );
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

// Share link management
app.post("/api/rooms/:id/share", requireHost, (req, res) => {
  const expiresInMs = req.body.expiresInMs;
  const link = createShareLink(req.params.id, expiresInMs);
  res.status(201).json(link);
});

app.get("/api/rooms/:id/share", requireHost, (req, res) => {
  const links = getLinksForRoom(req.params.id);
  res.json(links);
});

app.delete("/api/share/:token", requireHost, (req, res) => {
  revokeShareLink(req.params.token);
  res.status(204).send();
});

// --- Guest routes (require share token) ---
app.get("/api/join/:token", (req, res) => {
  const result = validateShareLink(req.params.token);
  if (!result) {
    res.status(404).json({ error: "Invalid or expired share link" });
    return;
  }

  const room = result.room;
  res.json({
    id: room.id,
    name: room.name,
    accessMode: room.accessMode,
    challengeType: room.challengeType,
    maxGuests: room.maxGuests,
    widgets: JSON.parse(room.widgets).map((w: { type: string }) => w.type),
  });
});

// Health check
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    buttplug: isConnected(),
    version: "1.0.12",
  });
});

// SPA fallback — serve index.html with HA ingress path injection
let indexHtml: string | null = null;

app.get("*", (req, res) => {
  const indexPath = join(publicDir, "index.html");
  if (!indexHtml) {
    if (!existsSync(indexPath)) {
      res.status(200).json({ message: "PlayRooms server running. Frontend not built yet." });
      return;
    }
    indexHtml = readFileSync(indexPath, "utf-8");
  }
  const ingressPath = (req.headers["x-ingress-path"] as string) || "";
  const baseHref = ingressPath ? ingressPath + "/" : "/";
  const html = indexHtml!
    .replace('<base href="/"', `<base href="${baseHref}"`)
    .replace('window.__INGRESS_PATH__ = ""', `window.__INGRESS_PATH__ = "${ingressPath}"`);
  res.type("html").send(html);
});

// Setup Socket.IO room handling
setupRoomSockets(io);

// --- Startup ---
async function start(): Promise<void> {
  console.log("[PlayRooms] Running database migrations...");
  runMigrations();

  let engineRunning = false;
  console.log("[PlayRooms] Starting Intiface Engine...");
  try {
    await startEngine();
    console.log("[PlayRooms] Intiface Engine started");
    engineRunning = true;
  } catch (err) {
    console.warn("[PlayRooms] Intiface Engine failed to start:", (err as Error).message);
    console.warn("[PlayRooms] Continuing without device support...");
  }

  if (engineRunning) {
    console.log("[PlayRooms] Connecting Buttplug client...");
    try {
      await connectClient();
      console.log("[PlayRooms] Buttplug client connected");

      if (config.scanOnStart) {
        await startScanning();
        console.log("[PlayRooms] Auto-scan started");
      }
    } catch (err) {
      console.warn("[PlayRooms] Buttplug client connection failed:", (err as Error).message);
      console.warn("[PlayRooms] Device features will be unavailable until connected");
    }
  }

  server.listen(config.serverPort, () => {
    console.log(`[PlayRooms] Server listening on port ${config.serverPort}`);
  });
}

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("[PlayRooms] Shutting down...");
  stopEngine();
  server.close();
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("[PlayRooms] Interrupted, shutting down...");
  stopEngine();
  server.close();
  process.exit(0);
});

start().catch((err) => {
  console.error("[PlayRooms] Fatal startup error:", err);
  process.exit(1);
});
