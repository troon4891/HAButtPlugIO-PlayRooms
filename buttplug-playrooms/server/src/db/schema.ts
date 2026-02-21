import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const playRooms = sqliteTable("play_rooms", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  accessMode: text("access_mode").notNull().default("open"),
  challengeType: text("challenge_type"),
  maxGuests: integer("max_guests").notNull().default(4),
  widgets: text("widgets").notNull().default("[]"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const shareLinks = sqliteTable("share_links", {
  id: text("id").primaryKey(),
  roomId: text("room_id").notNull().references(() => playRooms.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  active: integer("active").notNull().default(1),
  expiresAt: integer("expires_at"),
  createdAt: integer("created_at").notNull(),
});

export const roomGuests = sqliteTable("room_guests", {
  id: text("id").primaryKey(),
  roomId: text("room_id").notNull().references(() => playRooms.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  status: text("status").notNull().default("pending"),
  socketId: text("socket_id"),
  joinedAt: integer("joined_at").notNull(),
});

export const devices = sqliteTable("devices", {
  id: text("id").primaryKey(),
  buttplugIndex: integer("buttplug_index").notNull(),
  name: text("name").notNull(),
  roomId: text("room_id").references(() => playRooms.id, { onDelete: "set null" }),
  settings: text("settings").notNull().default("{}"),
});

export const chatMessages = sqliteTable("chat_messages", {
  id: text("id").primaryKey(),
  roomId: text("room_id").notNull().references(() => playRooms.id, { onDelete: "cascade" }),
  senderName: text("sender_name").notNull(),
  message: text("message").notNull(),
  createdAt: integer("created_at").notNull(),
});
