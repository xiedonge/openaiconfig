import fs from "node:fs/promises";

import type { FileMutation } from "@/lib/adapters";
import { getAppAdapter } from "@/lib/adapters";
import { getDb } from "@/lib/db";
import { createBackupSet, getBackupSetByIdOrThrow, restoreFilesFromBackupSet, updateBackupPostAction, updateBackupRestoreResult, writeFileAtomic } from "@/lib/services/backups";
import { getConfigByIdOrThrow, markConfigApplyResult, switchActiveConfig } from "@/lib/services/configs";
import { toErrorMessage } from "@/lib/utils";
import type { AppType } from "@/types";

async function buildUpdatedFiles(mutations: FileMutation[]) {
  const updates: Array<{ sourcePath: string; content: string }> = [];

  for (const mutation of mutations) {
    const currentContent = await fs.readFile(mutation.sourcePath, "utf8");
    const updatedContent = await mutation.transform(currentContent);
    updates.push({ sourcePath: mutation.sourcePath, content: updatedContent });
  }

  return updates;
}

async function attemptRollback(appType: AppType, backupSetId: number) {
  const adapter = getAppAdapter(appType);
  const backupSet = getBackupSetByIdOrThrow(backupSetId);

  try {
    await restoreFilesFromBackupSet(backupSet);
  } catch (error) {
    return `Rollback failed while restoring files: ${toErrorMessage(error)}`;
  }

  try {
    const rollbackMessage = await adapter.runPostAction("rollback");
    return rollbackMessage ? `Rollback completed. ${rollbackMessage}` : "Rollback completed.";
  } catch (error) {
    return `Rollback restored files, but the post action failed: ${toErrorMessage(error)}`;
  }
}

export async function activateConfig(configId: number) {
  const config = getConfigByIdOrThrow(configId);
  const adapter = getAppAdapter(config.appType);
  const mutations = adapter.getMutations(config);
  let backupSetId: number | null = null;

  try {
    const backupSet = await createBackupSet({
      appType: config.appType,
      triggerType: "activate",
      relatedConfigId: config.id,
      sourcePaths: mutations.map((mutation) => mutation.sourcePath),
    });
    backupSetId = backupSet.id;

    const updates = await buildUpdatedFiles(mutations);

    for (const update of updates) {
      await writeFileAtomic(update.sourcePath, update.content);
    }

    const postActionMessage = await adapter.runPostAction("apply");
    const appliedAt = new Date().toISOString();
    const successMessage = postActionMessage ?? "Configuration activated successfully.";

    switchActiveConfig(config.appType, config.id, appliedAt, successMessage);
    updateBackupPostAction(backupSet.id, "success", successMessage);

    return {
      config: getConfigByIdOrThrow(config.id),
      backupSet: getBackupSetByIdOrThrow(backupSet.id),
    };
  } catch (error) {
    let message = toErrorMessage(error);

    if (backupSetId) {
      const rollbackMessage = await attemptRollback(config.appType, backupSetId);
      message = `${message} ${rollbackMessage}`.trim();
      updateBackupPostAction(backupSetId, "failed", message);
    }

    markConfigApplyResult(config.id, "failed", message, null);
    throw new Error(message);
  }
}

export async function restoreBackupSet(backupSetId: number) {
  const backupSet = getBackupSetByIdOrThrow(backupSetId);
  const adapter = getAppAdapter(backupSet.appType);
  let safeguardBackupId: number | null = null;

  try {
    const safeguardBackup = await createBackupSet({
      appType: backupSet.appType,
      triggerType: "restore",
      relatedConfigId: backupSet.relatedConfigId,
      sourcePaths: backupSet.files.map((file) => file.sourcePath),
    });
    safeguardBackupId = safeguardBackup.id;

    await restoreFilesFromBackupSet(backupSet);

    const postActionMessage = await adapter.runPostAction("restore");
    const restoredAt = new Date().toISOString();
    const successMessage = postActionMessage ?? `Backup #${backupSet.id} restored successfully.`;

    updateBackupRestoreResult(backupSet.id, "success", successMessage);
    updateBackupPostAction(backupSet.id, "success", successMessage);

    const db = getDb();
    db.prepare(`UPDATE configs SET is_active = 0 WHERE app_type = ?`).run(backupSet.appType);

    if (backupSet.relatedConfigId) {
      const existing = db.prepare(`SELECT id FROM configs WHERE id = ?`).get(backupSet.relatedConfigId) as { id: number } | undefined;

      if (existing) {
        switchActiveConfig(backupSet.appType, backupSet.relatedConfigId, restoredAt, `Restored from backup #${backupSet.id}.`);
      }
    }

    return {
      backupSet: getBackupSetByIdOrThrow(backupSet.id),
      safeguardBackup: getBackupSetByIdOrThrow(safeguardBackup.id),
    };
  } catch (error) {
    let message = toErrorMessage(error);

    if (safeguardBackupId) {
      const rollbackMessage = await attemptRollback(backupSet.appType, safeguardBackupId);
      message = `${message} ${rollbackMessage}`.trim();
    }

    updateBackupRestoreResult(backupSet.id, "failed", message);
    updateBackupPostAction(backupSet.id, "failed", message);
    throw new Error(message);
  }
}
