import fs from "node:fs/promises";

import type { AppAdapter } from "@/lib/adapters";
import { getAllAppAdapters, getAppAdaptersForScope } from "@/lib/adapters";
import { getDb } from "@/lib/db";
import type { FileMutation } from "@/lib/adapters";
import { createBackupSet, getBackupSetByIdOrThrow, restoreFilesFromBackupSet, updateBackupPostAction, updateBackupRestoreResult, writeFileAtomic } from "@/lib/services/backups";
import { clearActiveConfig, getConfigByIdOrThrow, markConfigApplyResult, switchActiveConfig } from "@/lib/services/configs";
import { toErrorMessage } from "@/lib/utils";
import type { BackupScope } from "@/types";

async function buildUpdatedFiles(mutations: FileMutation[]) {
  const updates: Array<{ sourcePath: string; content: string }> = [];

  for (const mutation of mutations) {
    const currentContent = await fs.readFile(mutation.sourcePath, "utf8");
    const updatedContent = await mutation.transform(currentContent);
    updates.push({ sourcePath: mutation.sourcePath, content: updatedContent });
  }

  return updates;
}

async function runPostActions(adapters: AppAdapter[], stage: "apply" | "restore" | "rollback") {
  const messages: string[] = [];

  for (const adapter of adapters) {
    const message = await adapter.runPostAction(stage);

    if (message) {
      messages.push(message);
    }
  }

  return messages.join(" ");
}

async function attemptRollback(scope: BackupScope, backupSetId: number) {
  const adapters = getAppAdaptersForScope(scope);
  const backupSet = getBackupSetByIdOrThrow(backupSetId);

  try {
    await restoreFilesFromBackupSet(backupSet);
  } catch (error) {
    return `Rollback failed while restoring files: ${toErrorMessage(error)}`;
  }

  try {
    const rollbackMessage = await runPostActions(adapters, "rollback");
    return rollbackMessage ? `Rollback completed. ${rollbackMessage}` : "Rollback completed.";
  } catch (error) {
    return `Rollback restored files, but the post action failed: ${toErrorMessage(error)}`;
  }
}

export async function activateConfig(configId: number) {
  const config = getConfigByIdOrThrow(configId);
  const adapters = getAllAppAdapters();
  const mutations = adapters.flatMap((adapter) => adapter.getMutations(config));
  let backupSetId: number | null = null;

  try {
    const backupSet = await createBackupSet({
      scope: "shared",
      triggerType: "activate",
      relatedConfigId: config.id,
      sourcePaths: mutations.map((mutation) => mutation.sourcePath),
    });
    backupSetId = backupSet.id;

    const updates = await buildUpdatedFiles(mutations);

    for (const update of updates) {
      await writeFileAtomic(update.sourcePath, update.content);
    }

    const postActionMessage = await runPostActions(adapters, "apply");
    const appliedAt = new Date().toISOString();
    const successMessage =
      postActionMessage ||
      "\u5171\u4eab\u914d\u7f6e\u5df2\u542f\u7528\uff0ccodex \u4e0e openclaw \u5df2\u540c\u6b65\u66f4\u65b0\u3002";

    switchActiveConfig(config.id, appliedAt, successMessage);
    updateBackupPostAction(backupSet.id, "success", successMessage);

    return {
      config: getConfigByIdOrThrow(config.id),
      backupSet: getBackupSetByIdOrThrow(backupSet.id),
    };
  } catch (error) {
    let message = toErrorMessage(error);

    if (backupSetId) {
      const rollbackMessage = await attemptRollback("shared", backupSetId);
      message = `${message} ${rollbackMessage}`.trim();
      updateBackupPostAction(backupSetId, "failed", message);
    }

    markConfigApplyResult(config.id, "failed", message, null);
    throw new Error(message);
  }
}

export async function restoreBackupSet(backupSetId: number) {
  const backupSet = getBackupSetByIdOrThrow(backupSetId);
  const adapters = getAppAdaptersForScope(backupSet.scope);
  let safeguardBackupId: number | null = null;

  try {
    const safeguardBackup = await createBackupSet({
      scope: backupSet.scope,
      triggerType: "restore",
      relatedConfigId: backupSet.relatedConfigId,
      sourcePaths: backupSet.files.map((file) => file.sourcePath),
    });
    safeguardBackupId = safeguardBackup.id;

    await restoreFilesFromBackupSet(backupSet);

    const postActionMessage = await runPostActions(adapters, "restore");
    const restoredAt = new Date().toISOString();
    const successMessage =
      postActionMessage || `\u5907\u4efd #${backupSet.id} \u5df2\u8fd8\u539f\u6210\u529f\u3002`;

    updateBackupRestoreResult(backupSet.id, "success", successMessage);
    updateBackupPostAction(backupSet.id, "success", successMessage);

    const db = getDb();
    let restoredConfigActivated = false;

    if (backupSet.relatedConfigId) {
      const existing = db.prepare(`SELECT id FROM configs WHERE id = ?`).get(backupSet.relatedConfigId) as { id: number } | undefined;

      if (existing) {
        switchActiveConfig(
          backupSet.relatedConfigId,
          restoredAt,
          `\u5df2\u4ece\u5907\u4efd #${backupSet.id} \u8fd8\u539f\u3002`,
        );
        restoredConfigActivated = true;
      }
    }

    if (!restoredConfigActivated) {
      clearActiveConfig();
    }

    return {
      backupSet: getBackupSetByIdOrThrow(backupSet.id),
      safeguardBackup: getBackupSetByIdOrThrow(safeguardBackup.id),
    };
  } catch (error) {
    let message = toErrorMessage(error);

    if (safeguardBackupId) {
      const rollbackMessage = await attemptRollback(backupSet.scope, safeguardBackupId);
      message = `${message} ${rollbackMessage}`.trim();
    }

    updateBackupRestoreResult(backupSet.id, "failed", message);
    updateBackupPostAction(backupSet.id, "failed", message);
    throw new Error(message);
  }
}
