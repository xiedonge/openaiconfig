import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

import { getDataDirectory } from "@/lib/env";

declare global {
  var __configManagerDb: Database.Database | undefined;
}

function initializeDatabase(db: Database.Database) {
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS configs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      app_type TEXT NOT NULL,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      api_key TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_applied_at TEXT,
      last_apply_status TEXT NOT NULL DEFAULT 'never',
      last_apply_message TEXT
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_configs_single_active
      ON configs(app_type)
      WHERE is_active = 1;

    CREATE INDEX IF NOT EXISTS idx_configs_app_type ON configs(app_type);
    CREATE INDEX IF NOT EXISTS idx_configs_updated_at ON configs(updated_at DESC);

    CREATE TABLE IF NOT EXISTS backup_sets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      app_type TEXT NOT NULL,
      trigger_type TEXT NOT NULL,
      related_config_id INTEGER,
      created_at TEXT NOT NULL,
      last_restore_at TEXT,
      last_restore_status TEXT NOT NULL DEFAULT 'never',
      last_restore_message TEXT,
      post_action_status TEXT NOT NULL DEFAULT 'never',
      post_action_message TEXT,
      FOREIGN KEY (related_config_id) REFERENCES configs(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_backup_sets_app_type ON backup_sets(app_type);
    CREATE INDEX IF NOT EXISTS idx_backup_sets_created_at ON backup_sets(created_at DESC);

    CREATE TABLE IF NOT EXISTS backup_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      backup_set_id INTEGER NOT NULL,
      source_path TEXT NOT NULL,
      backup_path TEXT NOT NULL,
      file_name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (backup_set_id) REFERENCES backup_sets(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_backup_files_backup_set_id ON backup_files(backup_set_id);
  `);
}

export function getDb() {
  if (globalThis.__configManagerDb) {
    return globalThis.__configManagerDb;
  }

  const dataDirectory = getDataDirectory();
  fs.mkdirSync(dataDirectory, { recursive: true });

  const dbPath = path.join(dataDirectory, "config-manager.db");
  const db = new Database(dbPath);

  initializeDatabase(db);
  globalThis.__configManagerDb = db;

  return db;
}
