import Database from "better-sqlite3";
import { join } from "path";
import { config } from "../config.js";

const dbPath = join(config.dataDir, "playrooms.sqlite");

export function runMigrations(): void {
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS play_rooms (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      access_mode TEXT NOT NULL DEFAULT 'open',
      challenge_type TEXT,
      max_guests INTEGER NOT NULL DEFAULT 4,
      widgets TEXT NOT NULL DEFAULT '[]',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS share_links (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL REFERENCES play_rooms(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      active INTEGER NOT NULL DEFAULT 1,
      expires_at INTEGER,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS room_guests (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL REFERENCES play_rooms(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      socket_id TEXT,
      joined_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS devices (
      id TEXT PRIMARY KEY,
      buttplug_index INTEGER NOT NULL,
      name TEXT NOT NULL,
      room_id TEXT REFERENCES play_rooms(id) ON DELETE SET NULL,
      settings TEXT NOT NULL DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL REFERENCES play_rooms(id) ON DELETE CASCADE,
      sender_name TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_share_links_token ON share_links(token);
    CREATE INDEX IF NOT EXISTS idx_share_links_room ON share_links(room_id);
    CREATE INDEX IF NOT EXISTS idx_room_guests_room ON room_guests(room_id);
    CREATE INDEX IF NOT EXISTS idx_devices_room ON devices(room_id);
    CREATE INDEX IF NOT EXISTS idx_chat_messages_room ON chat_messages(room_id);
  `);

  sqlite.close();
}
