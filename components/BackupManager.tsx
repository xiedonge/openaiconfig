"use client";

import { useState } from "react";

import type { AppType, BackupSetRecord, TriggerType } from "@/types";

interface BackupManagerProps {
  initialBackups: BackupSetRecord[];
}

type AppFilter = AppType | "all";
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

export default function BackupManager({ initialBackups }: BackupManagerProps) {
  const [backups, setBackups] = useState(initialBackups);
  const [appFilter, setAppFilter] = useState<AppFilter>("all");
  const [triggerFilter, setTriggerFilter] = useState<TriggerFilter>("all");
  const [selectedBackupId, setSelectedBackupId] = useState<number | null>(initialBackups[0]?.id ?? null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedBackup = backups.find((backup) => backup.id === selectedBackupId) ?? null;
  const backupCountText = `共 ${backups.length} 条备份记录`;

  async function loadBackups(nextAppFilter: AppFilter = appFilter, nextTriggerFilter: TriggerFilter = triggerFilter) {
    setLoading(true);

    try {
      const query = new URLSearchParams();
      if (nextAppFilter !== "all") {
        query.set("appType", nextAppFilter);
      }
      if (nextTriggerFilter !== "all") {
        query.set("triggerType", nextTriggerFilter);
      }

      const response = await fetch(`/api/backups${query.size > 0 ? `?${query.toString()}` : ""}`, {
        cache: "no-store",
      });
      const payload = await readJson<{ backups?: BackupSetRecord[]; error?: string }>(response);

      if (!response.ok) {
        throw new Error(payload.error ?? "加载备份失败。");
      }

      const nextBackups = payload.backups ?? [];
      setBackups(nextBackups);
      setSelectedBackupId((current) => (nextBackups.some((backup) => backup.id === current) ? current : nextBackups[0]?.id ?? null));
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "加载备份失败。");
    } finally {
      setLoading(false);
    }
  }

  async function handleRestore(backup: BackupSetRecord) {
    const confirmed = window.confirm(`确认还原备份 #${backup.id} 吗？系统会先生成一份新的还原前备份。`);

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
        throw new Error(payload.error ?? "还原备份失败。");
      }

      setMessage(`备份 #${backup.id} 已还原。`);
      await loadBackups(appFilter, triggerFilter);
      setSelectedBackupId(backup.id);
    } catch (restoreError) {
      setError(restoreError instanceof Error ? restoreError.message : "还原备份失败。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel-grid">
      <section className="card stack">
        <div className="page-actions">
          <div className="field" style={{ minWidth: 220 }}>
            <label htmlFor="backup-app-filter">应用类型</label>
            <select
              id="backup-app-filter"
              className="select"
              onChange={(event) => {
                const nextValue = event.target.value as AppFilter;
                setAppFilter(nextValue);
                void loadBackups(nextValue, triggerFilter);
              }}
              value={appFilter}
            >
              <option value="all">全部</option>
              <option value="codex">codex</option>
              <option value="openclaw">openclaw</option>
            </select>
          </div>
          <div className="field" style={{ minWidth: 220 }}>
            <label htmlFor="backup-trigger-filter">触发来源</label>
            <select
              id="backup-trigger-filter"
              className="select"
              onChange={(event) => {
                const nextValue = event.target.value as TriggerFilter;
                setTriggerFilter(nextValue);
                void loadBackups(appFilter, nextValue);
              }}
              value={triggerFilter}
            >
              <option value="all">全部</option>
              <option value="activate">启用前备份</option>
              <option value="restore">还原前备份</option>
            </select>
          </div>
          <span className="subtle">{loading ? "处理中..." : backupCountText}</span>
        </div>

        {message ? <div className="notice notice-success">{message}</div> : null}
        {error ? <div className="notice notice-error">{error}</div> : null}

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>备份编号</th>
                <th>应用</th>
                <th>触发来源</th>
                <th>关联配置</th>
                <th>创建时间</th>
                <th>最近还原</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {backups.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="empty-state">当前筛选条件下没有备份记录。</div>
                  </td>
                </tr>
              ) : (
                backups.map((backup) => (
                  <tr key={backup.id}>
                    <td>
                      <strong>#{backup.id}</strong>
                      <div className="subtle">包含 {backup.files.length} 个文件</div>
                    </td>
                    <td>{backup.appType}</td>
                    <td>{backup.triggerType === "activate" ? "启用前备份" : "还原前备份"}</td>
                    <td>{backup.relatedConfigName ?? "关联配置已删除或未关联"}</td>
                    <td>{backup.createdAt}</td>
                    <td>
                      <span className={getStatusClass(backup.lastRestoreStatus)}>{backup.lastRestoreStatus}</span>
                      <div className="subtle">{backup.lastRestoreMessage ?? "尚未还原"}</div>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button className="button button-secondary" onClick={() => setSelectedBackupId(backup.id)} type="button">
                          查看
                        </button>
                        <button className="button button-primary" onClick={() => handleRestore(backup)} type="button">
                          还原
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
              <p className="subtle">备份详情</p>
              <h2>备份 #{selectedBackup.id}</h2>
              <div className="inline-meta">
                <span className="status-pill status-neutral">{selectedBackup.appType}</span>
                <span className={getStatusClass(selectedBackup.postActionStatus)}>
                  后置动作：{selectedBackup.postActionStatus}
                </span>
              </div>
            </div>

            <div className="notice">
              <div>触发来源：{selectedBackup.triggerType === "activate" ? "启用前备份" : "还原前备份"}</div>
              <div>关联配置：{selectedBackup.relatedConfigName ?? "已删除或未关联"}</div>
              <div>创建时间：{selectedBackup.createdAt}</div>
              <div>后置动作结果：{selectedBackup.postActionMessage ?? "尚未执行"}</div>
            </div>

            <div className="backup-files">
              {selectedBackup.files.map((file) => (
                <div className="file-chip" key={file.id}>
                  <strong>{file.fileName}</strong>
                  <div className="subtle">原始路径：{file.sourcePath}</div>
                  <div className="subtle">备份路径：{file.backupPath}</div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="empty-state">先从左侧选择一条备份查看明细。</div>
        )}
      </aside>
    </div>
  );
}
