import Database from "better-sqlite3";
import { join } from "path";
import { config } from "../config.js";

const dbPath = join(config.dataDir, "playrooms.sqlite");

export function runMigrations(): void {
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  // --- Original tables (v1.x) ---
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

  // --- v2.0.0 migrations ---

  // New tables
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'host',
      locked_until INTEGER,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS login_attempts (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      ip TEXT NOT NULL,
      success INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS guest_profiles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      password_hash TEXT,
      persistent INTEGER NOT NULL DEFAULT 0,
      last_active_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS room_guest_access (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL REFERENCES play_rooms(id) ON DELETE CASCADE,
      guest_profile_id TEXT NOT NULL REFERENCES guest_profiles(id) ON DELETE CASCADE,
      invited_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      key_hash TEXT NOT NULL,
      key_prefix TEXT NOT NULL,
      scopes TEXT NOT NULL DEFAULT '[]',
      last_used_at INTEGER,
      expires_at INTEGER,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS webhooks (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL REFERENCES play_rooms(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      url TEXT NOT NULL,
      events TEXT NOT NULL DEFAULT '[]',
      secret TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS challenge_codes (
      id TEXT PRIMARY KEY,
      guest_id TEXT NOT NULL,
      room_id TEXT NOT NULL,
      code TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);

  // Add new columns to existing tables (SQLite lacks IF NOT EXISTS for ALTER TABLE)
  const addColumnIfMissing = (table: string, column: string, definition: string) => {
    const columns = sqlite.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
    if (!columns.some((c) => c.name === column)) {
      sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  };

  addColumnIfMissing("play_rooms", "guest_inactivity_days", "INTEGER NOT NULL DEFAULT 30");
  addColumnIfMissing("share_links", "guest_type", "TEXT NOT NULL DEFAULT 'short'");
  addColumnIfMissing("room_guests", "guest_profile_id", "TEXT REFERENCES guest_profiles(id) ON DELETE SET NULL");

  // New indexes for v2.0.0 tables
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS idx_login_attempts_user ON login_attempts(user_id);
    CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON login_attempts(ip);
    CREATE INDEX IF NOT EXISTS idx_guest_profiles_name ON guest_profiles(name);
    CREATE INDEX IF NOT EXISTS idx_room_guest_access_room ON room_guest_access(room_id);
    CREATE INDEX IF NOT EXISTS idx_room_guest_access_guest ON room_guest_access(guest_profile_id);
    CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);
    CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(key_prefix);
    CREATE INDEX IF NOT EXISTS idx_webhooks_room ON webhooks(room_id);
    CREATE INDEX IF NOT EXISTS idx_challenge_codes_guest ON challenge_codes(guest_id);

    CREATE UNIQUE INDEX IF NOT EXISTS idx_room_guest_access_unique
      ON room_guest_access(room_id, guest_profile_id);
  `);

  sqlite.close();
}
