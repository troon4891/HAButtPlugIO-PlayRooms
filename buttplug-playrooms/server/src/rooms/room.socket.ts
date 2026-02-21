import type { Server, Socket } from "socket.io";
import type { ServerToClientEvents, ClientToServerEvents } from "../types/index.js";
import { validateShareLink } from "../auth/share-links.js";
import * as lobby from "../auth/lobby.js";
import * as chatService from "../widgets/chat.service.js";
import * as toyboxService from "../widgets/toybox.service.js";
import * as mediaSignaling from "../widgets/media.signaling.js";
import { onDevicesChanged } from "../buttplug/client.js";

type IOServer = Server<ClientToServerEvents, ServerToClientEvents>;
type IOSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

// Track host sockets per room
const hostSockets = new Map<string, string>(); // roomId -> socketId

export function setupRoomSockets(io: IOServer): void {
  // Broadcast device state changes to all rooms
  onDevicesChanged((devices) => {
    io.emit("device:state", devices[0]); // emit each device individually
  });

  io.on("connection", (socket: IOSocket) => {
    const query = socket.handshake.query;
    const roomId = query.roomId as string;
    const isHost = query.isHost === "true";
    const token = query.token as string;
    const guestName = query.name as string;

    if (!roomId) {
      socket.emit("error", { message: "roomId is required" });
      socket.disconnect();
      return;
    }

    if (isHost) {
      handleHostConnection(io, socket, roomId);
    } else if (token && guestName) {
      handleGuestConnection(io, socket, roomId, token, guestName);
    } else {
      socket.emit("error", { message: "Invalid connection parameters" });
      socket.disconnect();
    }
  });
}

function handleHostConnection(io: IOServer, socket: IOSocket, roomId: string): void {
  hostSockets.set(roomId, socket.id);
  socket.join(`room:${roomId}`);
  socket.join(`room:${roomId}:host`);

  console.log(`[Room ${roomId}] Host connected`);

  // Send current room state
  const guests = lobby.getRoomGuests(roomId);
  const devices = toyboxService.getDevicesForRoom(roomId);
  socket.emit("room:state", {
    guests: guests.map((g) => ({ id: g.id, name: g.name })),
    devices: devices.map((d) => ({
      id: d.id,
      name: d.name,
      connected: d.connected,
      batteryLevel: d.batteryLevel,
      capabilities: d.capabilities,
    })),
  });

  // Host lobby management
  socket.on("lobby:approve", (data) => {
    if (lobby.approveGuest(data.guestId)) {
      io.to(`room:${roomId}`).emit("guest:approved", { guestId: data.guestId });
    }
  });

  socket.on("lobby:reject", (data) => {
    lobby.rejectGuest(data.guestId);
  });

  // Host device commands
  socket.on("device:command", async (cmd) => {
    try {
      await toyboxService.sendDeviceCommand(cmd);
    } catch (err) {
      socket.emit("error", { message: `Device command failed: ${(err as Error).message}` });
    }
  });

  // Host chat
  socket.on("chat:message", (data) => {
    const msg = chatService.saveMessage(roomId, "Host", data.message);
    io.to(`room:${roomId}`).emit("chat:message", msg);
  });

  // Host media signaling
  mediaSignaling.addParticipant(roomId, "host", socket.id, "Host");
  mediaSignaling.setupMediaSignaling(io, socket, roomId, "host");

  socket.on("disconnect", () => {
    console.log(`[Room ${roomId}] Host disconnected`);
    hostSockets.delete(roomId);
    mediaSignaling.removeParticipant(roomId, "host");
  });
}

function handleGuestConnection(io: IOServer, socket: IOSocket, roomId: string, token: string, name: string): void {
  const linkResult = validateShareLink(token);
  if (!linkResult || linkResult.room.id !== roomId) {
    socket.emit("error", { message: "Invalid share link" });
    socket.disconnect();
    return;
  }

  // Create pending guest
  const { guestId, code } = lobby.createPendingGuest(roomId, name, socket.id);

  console.log(`[Room ${roomId}] Guest "${name}" (${guestId}) connecting`);

  // If open mode, auto-approve
  if (linkResult.room.accessMode === "open") {
    lobby.markGuestJoined(guestId, socket.id);
    socket.join(`room:${roomId}`);
    io.to(`room:${roomId}`).emit("guest:joined", { guestId, name });
    socket.emit("guest:approved", { guestId });

    // Send recent chat history
    const messages = chatService.getRecentMessages(roomId, 50);
    for (const msg of messages) {
      socket.emit("chat:message", msg);
    }

    // Setup media signaling
    mediaSignaling.addParticipant(roomId, guestId, socket.id, name);
    mediaSignaling.setupMediaSignaling(io, socket, roomId, guestId);
  } else {
    // Challenge mode — notify host
    const hostSocketId = hostSockets.get(roomId);
    if (hostSocketId) {
      io.to(hostSocketId).emit("lobby:pending", { guestId, name, code });
    }

    // Listen for approval
    socket.on("guest:join", (data) => {
      if (data.code && lobby.verifyChallengeCode(guestId, data.code)) {
        lobby.approveGuest(guestId);
        lobby.markGuestJoined(guestId, socket.id);
        socket.join(`room:${roomId}`);
        io.to(`room:${roomId}`).emit("guest:joined", { guestId, name });
        socket.emit("guest:approved", { guestId });

        mediaSignaling.addParticipant(roomId, guestId, socket.id, name);
        mediaSignaling.setupMediaSignaling(io, socket, roomId, guestId);
      }
    });
  }

  // Guest device commands (if allowed by room config)
  socket.on("device:command", async (cmd) => {
    try {
      await toyboxService.sendDeviceCommand(cmd);
    } catch (err) {
      socket.emit("error", { message: `Device command failed: ${(err as Error).message}` });
    }
  });

  // Guest chat
  socket.on("chat:message", (data) => {
    const msg = chatService.saveMessage(roomId, name, data.message);
    io.to(`room:${roomId}`).emit("chat:message", msg);
  });

  socket.on("disconnect", () => {
    console.log(`[Room ${roomId}] Guest "${name}" (${guestId}) disconnected`);
    lobby.markGuestDisconnected(socket.id);
    mediaSignaling.removeParticipant(roomId, guestId);
    io.to(`room:${roomId}`).emit("guest:left", { guestId });
  });
}
