import { v4 as uuidv4 } from "uuid";
import { nanoid } from "nanoid";
import { eq, and } from "drizzle-orm";
import { db, schema } from "../db/index.js";

export function createShareLink(roomId: string, expiresInMs?: number) {
  const now = Date.now();
  const link = {
    id: uuidv4(),
    roomId,
    token: nanoid(21),
    active: 1,
    expiresAt: expiresInMs ? now + expiresInMs : null,
    createdAt: now,
  };

  db.insert(schema.shareLinks).values(link).run();
  return link;
}

export function validateShareLink(token: string) {
  const link = db
    .select()
    .from(schema.shareLinks)
    .where(and(eq(schema.shareLinks.token, token), eq(schema.shareLinks.active, 1)))
    .get();

  if (!link) return null;

  // Check expiry
  if (link.expiresAt && link.expiresAt < Date.now()) {
    revokeShareLink(token);
    return null;
  }

  // Get the room info
  const room = db
    .select()
    .from(schema.playRooms)
    .where(eq(schema.playRooms.id, link.roomId))
    .get();

  if (!room) return null;

  return { link, room };
}

export function revokeShareLink(token: string) {
  db.update(schema.shareLinks)
    .set({ active: 0 })
    .where(eq(schema.shareLinks.token, token))
    .run();
}

export function getLinksForRoom(roomId: string) {
  return db
    .select()
    .from(schema.shareLinks)
    .where(and(eq(schema.shareLinks.roomId, roomId), eq(schema.shareLinks.active, 1)))
    .all();
}
