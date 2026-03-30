import fs from "node:fs/promises";
import path from "node:path";

import { getAppAdapter } from "@/lib/adapters";
import { getDb } from "@/lib/db";
import { getBackupFileName, nowIsoString, normalizeSqliteTimestamp, sqliteBoolean } from "@/lib/utils";
import type { ApplyStatus, AppType, BackupFileRecord, BackupSetRecord, TriggerType } from "@/types";

interface BackupSetRow {
  id: number;
  app_type: AppType;
  trigger_type: TriggerType;
  related_config_id: number | null;
  created_at: string;
  last_restore_at: string | null;
  last_restore_status: ApplyStatus;
  last_restore_message: string | null;
  post_action_status: ApplyStatus;
  post_action_message: string | null;
  related_config_name: string | null;
}

interface BackupFileRow {
  id: number;
  backup_set_id: number;
  source_path: string;
  backup_path: string;
  file_name: string;
  created_at: string;
}

function mapBackupFileRow(row: BackupFileRow): BackupFileRecord {
  return {
    id: row.id,
    backupSetId: row.backup_set_id,
    sourcePath: row.source_path,
    backupPath: row.backup_path,
    fileName: row.file_name,
    createdAt: row.created_at,
  };
}

function mapBackupSetRow(row: BackupSetRow, files: BackupFileRecord[]): BackupSetRecord {
  return {
    id: row.id,
    appType: row.app_type,
    triggerType: row.trigger_type,
    relatedConfigId: row.related_config_id,
    createdAt: row.created_at,
    lastRestoreAt: normalizeSqliteTimestamp(row.last_restore_at),
    lastRestoreStatus: row.last_restore_status,
    lastRestoreMessage: row.last_restore_message,
    postActionStatus: row.post_action_status,
    postActionMessage: row.post_action_message,
    relatedConfigName: row.related_config_name,
    files,
  };
}

export async function writeFileAtomic(filePath: string, content: string | Buffer) {
  const directory = path.dirname(filePath);
  const tempPath = path.join(directory, `${path.basename(filePath)}.tmp-${Date.now()}`);

  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(tempPath, content);
  await fs.rm(filePath, { force: true });
  await fs.rename(tempPath, filePath);
}

export async function createBackupSet(args: {
  appType: AppType;
  triggerType: TriggerType;
  relatedConfigId: number | null;
  sourcePaths: string[];
}) {
  const db = getDb();
  const createdAt = nowIsoString();
  const result = db
    .prepare(
      `INSERT INTO backup_sets (app_type, trigger_type, related_config_id, created_at, last_restore_status, post_action_status)
       VALUES (?, ?, ?, ?, 'never', 'never')`,
    )
    .run(args.appType, args.triggerType, args.relatedConfigId, createdAt);

  const backupSetId = Number(result.lastInsertRowid);
  const backupRoot = getAppAdapter(args.appType).getBackupRoot();
  const backupDirectory = path.join(backupRoot, String(backupSetId));

  await fs.mkdir(backupDirectory, { recursive: true });

  const insertFile = db.prepare(
    `INSERT INTO backup_files (backup_set_id, source_path, backup_path, file_name, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  );

  for (const sourcePath of args.sourcePaths) {
    const fileName = getBackupFileName(sourcePath);
    const backupPath = path.join(backupDirectory, fileName);
    await fs.copyFile(sourcePath, backupPath);
    insertFile.run(backupSetId, sourcePath, backupPath, fileName, createdAt);
  }

  return getBackupSetByIdOrThrow(backupSetId);
}

export function listBackups(filters: { appType?: AppType; triggerType?: TriggerType } = {}) {
  const db = getDb();
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.appType) {
    conditions.push(`backup_sets.app_type = ?`);
    params.push(filters.appType);
  }

  if (filters.triggerType) {
    conditions.push(`backup_sets.trigger_type = ?`);
    params.push(filters.triggerType);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const rows = db
    .prepare(
      `SELECT backup_sets.*, configs.name AS related_config_name
       FROM backup_sets
       LEFT JOIN configs ON configs.id = backup_sets.related_config_id
       ${whereClause}
       ORDER BY backup_sets.created_at DESC, backup_sets.id DESC`,
    )
    .all(...params) as BackupSetRow[];

  if (rows.length === 0) {
    return [];
  }

  const ids = rows.map((row) => row.id);
  const placeholders = ids.map(() => "?").join(", ");
  const fileRows = db
    .prepare(
      `SELECT *
       FROM backup_files
       WHERE backup_set_id IN (${placeholders})
       ORDER BY created_at DESC, id DESC`,
    )
    .all(...ids) as BackupFileRow[];

  const filesByBackupSet = new Map<number, BackupFileRecord[]>();

  for (const fileRow of fileRows) {
    const mapped = mapBackupFileRow(fileRow);
    const existing = filesByBackupSet.get(mapped.backupSetId) ?? [];
    existing.push(mapped);
    filesByBackupSet.set(mapped.backupSetId, existing);
  }

  return rows.map((row) => mapBackupSetRow(row, filesByBackupSet.get(row.id) ?? []));
}

export function getBackupSetById(id: number) {
  return listBackups().find((backup) => backup.id === id) ?? null;
}

export function getBackupSetByIdOrThrow(id: number) {
  const backupSet = getBackupSetById(id);

  if (!backupSet) {
    throw new Error("Backup set was not found.");
  }

  return backupSet;
}

export async function restoreFilesFromBackupSet(backupSet: BackupSetRecord) {
  if (backupSet.files.length === 0) {
    throw new Error("Backup set has no files to restore.");
  }

  for (const file of backupSet.files) {
    const content = await fs.readFile(file.backupPath);
    await writeFileAtomic(file.sourcePath, content);
  }
}

export function updateBackupPostAction(backupSetId: number, status: ApplyStatus, message: string | null) {
  const db = getDb();
  db.prepare(
    `UPDATE backup_sets
     SET post_action_status = ?, post_action_message = ?
     WHERE id = ?`,
  ).run(status, message, backupSetId);
}

export function updateBackupRestoreResult(backupSetId: number, status: ApplyStatus, message: string | null) {
  const db = getDb();
  db.prepare(
    `UPDATE backup_sets
     SET last_restore_at = ?, last_restore_status = ?, last_restore_message = ?
     WHERE id = ?`,
  ).run(nowIsoString(), status, message, backupSetId);
}
