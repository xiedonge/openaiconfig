"use client";

import { useState } from "react";

import type { BackupScope, BackupSetRecord, TriggerType } from "@/types";

const TEXT = {
  totalPrefix: "\u5171 ",
  totalSuffix: " \u6761\u5907\u4efd\u8bb0\u5f55",
  loadFailed: "\u52a0\u8f7d\u5907\u4efd\u5931\u8d25\u3002",
  restoreConfirmPrefix: "\u786e\u8ba4\u8fd8\u539f\u5907\u4efd #",
  restoreConfirmSuffix: "\u5417\uff1f\u7cfb\u7edf\u4f1a\u5148\u751f\u6210\u4e00\u4efd\u65b0\u7684\u8fd8\u539f\u524d\u5907\u4efd\u3002",
  restoreFailed: "\u8fd8\u539f\u5907\u4efd\u5931\u8d25\u3002",
  restoreSuccessPrefix: "\u5907\u4efd #",
  restoreSuccessSuffix: " \u5df2\u8fd8\u539f\u3002",
  scope: "\u8303\u56f4",
  all: "\u5168\u90e8",
  trigger: "\u89e6\u53d1\u6765\u6e90",
  activate: "\u542f\u7528\u524d\u5907\u4efd",
  restore: "\u8fd8\u539f\u524d\u5907\u4efd",
  processing: "\u5904\u7406\u4e2d...",
  backupId: "\u5907\u4efd\u7f16\u53f7",
  relatedConfig: "\u5173\u8054\u914d\u7f6e",
  createdAt: "\u521b\u5efa\u65f6\u95f4",
  recentRestore: "\u6700\u8fd1\u8fd8\u539f",
  actions: "\u64cd\u4f5c",
  empty: "\u5f53\u524d\u7b5b\u9009\u6761\u4ef6\u4e0b\u6ca1\u6709\u5907\u4efd\u8bb0\u5f55\u3002",
  includeFilesPrefix: "\u5305\u542b ",
  includeFilesSuffix: " \u4e2a\u6587\u4ef6",
  deletedRelated: "\u5173\u8054\u914d\u7f6e\u5df2\u5220\u9664\u6216\u672a\u5173\u8054",
  notRestored: "\u5c1a\u672a\u8fd8\u539f",
  view: "\u67e5\u770b",
  details: "\u5907\u4efd\u8be6\u60c5",
  postAction: "\u540e\u7f6e\u52a8\u4f5c\uff1a",
  triggerPrefix: "\u89e6\u53d1\u6765\u6e90\uff1a",
  scopePrefix: "\u8303\u56f4\uff1a",
  relatedPrefix: "\u5173\u8054\u914d\u7f6e\uff1a",
  createdPrefix: "\u521b\u5efa\u65f6\u95f4\uff1a",
  postActionResultPrefix: "\u540e\u7f6e\u52a8\u4f5c\u7ed3\u679c\uff1a",
  notExecuted: "\u5c1a\u672a\u6267\u884c",
  sourcePath: "\u539f\u59cb\u8def\u5f84\uff1a",
  backupPath: "\u5907\u4efd\u8def\u5f84\uff1a",
  selectHint: "\u5148\u4ece\u5de6\u4fa7\u9009\u62e9\u4e00\u6761\u5907\u4efd\u67e5\u770b\u660e\u7ec6\u3002",
} as const;

interface BackupManagerProps {
  initialBackups: BackupSetRecord[];
}

type ScopeFilter = BackupScope | "all";
type TriggerFilter = TriggerType | "all";

async function readJson<T>(response: Response): Promise<T> {
  return (await response.json().catch(() => ({}))) as T;
}

function getStatusClass(status: BackupSetRecord["lastRestoreStatus"]) {
  if (status === "success") {
    return "status-pill status-success";
  }

  if (status === "failed") {
    return "status-pill status-failed";
  }

  return "status-pill status-neutral";
}

function formatScope(scope: BackupScope) {
  return scope;
}

export default function BackupManager({ initialBackups }: BackupManagerProps) {
  const [backups, setBackups] = useState(initialBackups);
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>("all");
  const [triggerFilter, setTriggerFilter] = useState<TriggerFilter>("all");
  const [selectedBackupId, setSelectedBackupId] = useState<number | null>(initialBackups[0]?.id ?? null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedBackup = backups.find((backup) => backup.id === selectedBackupId) ?? null;
  const backupCountText = `${TEXT.totalPrefix}${backups.length}${TEXT.totalSuffix}`;

  async function loadBackups(nextScopeFilter: ScopeFilter = scopeFilter, nextTriggerFilter: TriggerFilter = triggerFilter) {
    setLoading(true);

    try {
      const query = new URLSearchParams();

      if (nextScopeFilter !== "all") {
        query.set("appType", nextScopeFilter);
      }

      if (nextTriggerFilter !== "all") {
        query.set("triggerType", nextTriggerFilter);
      }

      const response = await fetch(`/api/backups${query.size > 0 ? `?${query.toString()}` : ""}`, {
        cache: "no-store",
      });
      const payload = await readJson<{ backups?: BackupSetRecord[]; error?: string }>(response);

      if (!response.ok) {
        throw new Error(payload.error ?? TEXT.loadFailed);
      }

      const nextBackups = payload.backups ?? [];
      setBackups(nextBackups);
      setSelectedBackupId((current) => (nextBackups.some((backup) => backup.id === current) ? current : nextBackups[0]?.id ?? null));
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : TEXT.loadFailed);
    } finally {
      setLoading(false);
    }
  }

  async function handleRestore(backup: BackupSetRecord) {
    const confirmed = window.confirm(`${TEXT.restoreConfirmPrefix}${backup.id}${TEXT.restoreConfirmSuffix}`);

    if (!confirmed) {
      return;
    }

    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(`/api/backups/${backup.id}/restore`, {
        method: "POST",
      });
      const payload = await readJson<{ error?: string }>(response);

      if (!response.ok) {
        throw new Error(payload.error ?? TEXT.restoreFailed);
      }

      setMessage(`${TEXT.restoreSuccessPrefix}${backup.id}${TEXT.restoreSuccessSuffix}`);
      await loadBackups(scopeFilter, triggerFilter);
      setSelectedBackupId(backup.id);
    } catch (restoreError) {
      setError(restoreError instanceof Error ? restoreError.message : TEXT.restoreFailed);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel-grid">
      <section className="card stack">
        <div className="page-actions">
          <div className="field" style={{ minWidth: 220 }}>
            <label htmlFor="backup-scope-filter">{TEXT.scope}</label>
            <select
              id="backup-scope-filter"
              className="select"
              onChange={(event) => {
                const nextValue = event.target.value as ScopeFilter;
                setScopeFilter(nextValue);
                void loadBackups(nextValue, triggerFilter);
              }}
              value={scopeFilter}
            >
              <option value="all">{TEXT.all}</option>
              <option value="shared">shared</option>
              <option value="codex">codex</option>
              <option value="openclaw">openclaw</option>
            </select>
          </div>
          <div className="field" style={{ minWidth: 220 }}>
            <label htmlFor="backup-trigger-filter">{TEXT.trigger}</label>
            <select
              id="backup-trigger-filter"
              className="select"
              onChange={(event) => {
                const nextValue = event.target.value as TriggerFilter;
                setTriggerFilter(nextValue);
                void loadBackups(scopeFilter, nextValue);
              }}
              value={triggerFilter}
            >
              <option value="all">{TEXT.all}</option>
              <option value="activate">{TEXT.activate}</option>
              <option value="restore">{TEXT.restore}</option>
            </select>
          </div>
          <span className="subtle">{loading ? TEXT.processing : backupCountText}</span>
        </div>

        {message ? <div className="notice notice-success">{message}</div> : null}
        {error ? <div className="notice notice-error">{error}</div> : null}

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{TEXT.backupId}</th>
                <th>{TEXT.scope}</th>
                <th>{TEXT.trigger}</th>
                <th>{TEXT.relatedConfig}</th>
                <th>{TEXT.createdAt}</th>
                <th>{TEXT.recentRestore}</th>
                <th>{TEXT.actions}</th>
              </tr>
            </thead>
            <tbody>
              {backups.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="empty-state">{TEXT.empty}</div>
                  </td>
                </tr>
              ) : (
                backups.map((backup) => (
                  <tr key={backup.id}>
                    <td>
                      <strong>#{backup.id}</strong>
                      <div className="subtle">{`${TEXT.includeFilesPrefix}${backup.files.length}${TEXT.includeFilesSuffix}`}</div>
                    </td>
                    <td>{formatScope(backup.scope)}</td>
                    <td>{backup.triggerType === "activate" ? TEXT.activate : TEXT.restore}</td>
                    <td>{backup.relatedConfigName ?? TEXT.deletedRelated}</td>
                    <td>{backup.createdAt}</td>
                    <td>
                      <span className={getStatusClass(backup.lastRestoreStatus)}>{backup.lastRestoreStatus}</span>
                      <div className="subtle">{backup.lastRestoreMessage ?? TEXT.notRestored}</div>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button className="button button-secondary" onClick={() => setSelectedBackupId(backup.id)} type="button">
                          {TEXT.view}
                        </button>
                        <button className="button button-primary" onClick={() => handleRestore(backup)} type="button">
                          {TEXT.restore}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <aside className="card stack">
        {selectedBackup ? (
          <>
            <div>
              <p className="subtle">{TEXT.details}</p>
              <h2>#{selectedBackup.id}</h2>
              <div className="inline-meta">
                <span className="status-pill status-neutral">{formatScope(selectedBackup.scope)}</span>
                <span className={getStatusClass(selectedBackup.postActionStatus)}>
                  {TEXT.postAction}
                  {selectedBackup.postActionStatus}
                </span>
              </div>
            </div>

            <div className="notice">
              <div>
                {TEXT.triggerPrefix}
                {selectedBackup.triggerType === "activate" ? TEXT.activate : TEXT.restore}
              </div>
              <div>
                {TEXT.scopePrefix}
                {formatScope(selectedBackup.scope)}
              </div>
              <div>
                {TEXT.relatedPrefix}
                {selectedBackup.relatedConfigName ?? TEXT.deletedRelated}
              </div>
              <div>
                {TEXT.createdPrefix}
                {selectedBackup.createdAt}
              </div>
              <div>
                {TEXT.postActionResultPrefix}
                {selectedBackup.postActionMessage ?? TEXT.notExecuted}
              </div>
            </div>

            <div className="backup-files">
              {selectedBackup.files.map((file) => (
                <div className="file-chip" key={file.id}>
                  <strong>{file.fileName}</strong>
                  <div className="subtle">
                    {TEXT.sourcePath}
                    {file.sourcePath}
                  </div>
                  <div className="subtle">
                    {TEXT.backupPath}
                    {file.backupPath}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="empty-state">{TEXT.selectHint}</div>
        )}
      </aside>
    </div>
  );
}
