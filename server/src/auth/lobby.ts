import { v4 as uuidv4 } from "uuid";
import { eq } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import type { GuestStatus } from "../types/index.js";

// In-memory lobby for pending guests (ephemeral — lost on restart)
const lobbyCodes = new Map<string, string>(); // guestId -> challenge code

export function generateChallengeCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function createPendingGuest(roomId: string, name: string, socketId: string): { guestId: string; code?: string } {
  const room = db.select().from(schema.playRooms).where(eq(schema.playRooms.id, roomId)).get();
  if (!room) throw new Error("Room not found");

  const guestId = uuidv4();
  const now = Date.now();

  db.insert(schema.roomGuests).values({
    id: guestId,
    roomId,
    name,
    status: room.accessMode === "open" ? "approved" : "pending",
    socketId,
    joinedAt: now,
  }).run();

  let code: string | undefined;
  if (room.accessMode === "challenge" && room.challengeType === "code") {
    code = generateChallengeCode();
    lobbyCodes.set(guestId, code);
  }

  return { guestId, code };
}

export function approveGuest(guestId: string): boolean {
  const guest = db.select().from(schema.roomGuests).where(eq(schema.roomGuests.id, guestId)).get();
  if (!guest || guest.status !== "pending") return false;

  db.update(schema.roomGuests)
    .set({ status: "approved" as GuestStatus })
    .where(eq(schema.roomGuests.id, guestId))
    .run();

  lobbyCodes.delete(guestId);
  return true;
}

export function rejectGuest(guestId: string): boolean {
  const guest = db.select().from(schema.roomGuests).where(eq(schema.roomGuests.id, guestId)).get();
  if (!guest) return false;

  db.delete(schema.roomGuests).where(eq(schema.roomGuests.id, guestId)).run();
  lobbyCodes.delete(guestId);
  return true;
}

export function markGuestJoined(guestId: string, socketId: string): void {
  db.update(schema.roomGuests)
    .set({ status: "joined" as GuestStatus, socketId })
    .where(eq(schema.roomGuests.id, guestId))
    .run();
}

export function markGuestDisconnected(socketId: string): string | null {
  const guest = db.select().from(schema.roomGuests).where(eq(schema.roomGuests.socketId, socketId)).get();
  if (!guest) return null;

  db.update(schema.roomGuests)
    .set({ status: "disconnected" as GuestStatus, socketId: null })
    .where(eq(schema.roomGuests.id, guest.id))
    .run();

  return guest.id;
}

export function verifyChallengeCode(guestId: string, code: string): boolean {
  const expected = lobbyCodes.get(guestId);
  return expected === code;
}

export function getRoomGuests(roomId: string) {
  return db.select().from(schema.roomGuests)
    .where(eq(schema.roomGuests.roomId, roomId))
    .all()
    .filter((g) => g.status === "joined" || g.status === "approved");
}
