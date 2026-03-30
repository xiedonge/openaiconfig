import type Database from "better-sqlite3";

import { getDb } from "@/lib/db";
import { normalizeSqliteTimestamp, nowIsoString, sqliteBoolean } from "@/lib/utils";
import type { ConfigInput } from "@/lib/validation";
import type { ApplyStatus, AppType, ConfigRecord } from "@/types";

interface ConfigRow {
  id: number;
  app_type: AppType;
  name: string;
  url: string;
  api_key: string;
  is_active: number;
  created_at: string;
  updated_at: string;
  last_applied_at: string | null;
  last_apply_status: ApplyStatus;
  last_apply_message: string | null;
}

function mapConfigRow(row: ConfigRow): ConfigRecord {
  return {
    id: row.id,
    appType: row.app_type,
    name: row.name,
    url: row.url,
    apiKey: row.api_key,
    isActive: sqliteBoolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastAppliedAt: normalizeSqliteTimestamp(row.last_applied_at),
    lastApplyStatus: row.last_apply_status,
    lastApplyMessage: row.last_apply_message,
  };
}

function configRowOrNull(statement: Database.Statement, ...params: unknown[]) {
  const row = statement.get(...params) as ConfigRow | undefined;
  return row ? mapConfigRow(row) : null;
}

export function listConfigs(appType?: AppType) {
  const db = getDb();
  const sql = appType
    ? `SELECT * FROM configs WHERE app_type = ? ORDER BY is_active DESC, updated_at DESC, id DESC`
    : `SELECT * FROM configs ORDER BY app_type ASC, is_active DESC, updated_at DESC, id DESC`;
  const rows = db.prepare(sql).all(...(appType ? [appType] : [])) as ConfigRow[];
  return rows.map(mapConfigRow);
}

export function getConfigById(id: number) {
  const db = getDb();
  return configRowOrNull(db.prepare(`SELECT * FROM configs WHERE id = ?`), id);
}

export function getConfigByIdOrThrow(id: number) {
  const config = getConfigById(id);

  if (!config) {
    throw new Error("Config record was not found.");
  }

  return config;
}

export function createConfig(input: ConfigInput) {
  const db = getDb();
  const timestamp = nowIsoString();
  const result = db
    .prepare(
      `INSERT INTO configs (app_type, name, url, api_key, is_active, created_at, updated_at, last_apply_status)
       VALUES (?, ?, ?, ?, 0, ?, ?, 'never')`,
    )
    .run(input.appType, input.name, input.url, input.apiKey, timestamp, timestamp);

  return getConfigByIdOrThrow(Number(result.lastInsertRowid));
}

export function updateConfig(id: number, input: ConfigInput) {
  const existing = getConfigByIdOrThrow(id);
  const db = getDb();
  const timestamp = nowIsoString();

  if (existing.isActive) {
    db.prepare(
      `UPDATE configs
       SET app_type = ?, name = ?, url = ?, api_key = ?, is_active = 0,
           last_apply_status = 'failed',
           last_apply_message = '当前记录已被修改，请重新启用以写回最新配置。',
           updated_at = ?
       WHERE id = ?`,
    ).run(input.appType, input.name, input.url, input.apiKey, timestamp, existing.id);
  } else {
    db.prepare(
      `UPDATE configs
       SET app_type = ?, name = ?, url = ?, api_key = ?, updated_at = ?
       WHERE id = ?`,
    ).run(input.appType, input.name, input.url, input.apiKey, timestamp, existing.id);
  }

  return getConfigByIdOrThrow(id);
}

export function deleteConfig(id: number) {
  const config = getConfigByIdOrThrow(id);
  const db = getDb();
  db.prepare(`DELETE FROM configs WHERE id = ?`).run(config.id);
}

export function markConfigApplyResult(id: number, status: ApplyStatus, message: string | null, appliedAt: string | null) {
  const db = getDb();
  const timestamp = nowIsoString();

  db.prepare(
    `UPDATE configs
     SET last_applied_at = ?, last_apply_status = ?, last_apply_message = ?, updated_at = ?
     WHERE id = ?`,
  ).run(appliedAt, status, message, timestamp, id);
}

export function switchActiveConfig(appType: AppType, configId: number | null, appliedAt: string, message: string) {
  const db = getDb();
  const tx = db.transaction(() => {
    db.prepare(`UPDATE configs SET is_active = 0 WHERE app_type = ?`).run(appType);

    if (configId) {
      db.prepare(
        `UPDATE configs
         SET is_active = 1, last_applied_at = ?, last_apply_status = 'success', last_apply_message = ?, updated_at = ?
         WHERE id = ?`,
      ).run(appliedAt, message, appliedAt, configId);
    }
  });

  tx();
}
