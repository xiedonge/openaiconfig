"use client";

import { ClipboardEvent, FormEvent, useState } from "react";

import { maskSecret } from "@/lib/utils";
import type { ApplyStatus, ConfigRecord } from "@/types";

interface ConfigManagerProps {
  initialConfigs: ConfigRecord[];
}

interface ConfigFormState {
  name: string;
  url: string;
  apiKey: string;
}

interface ParsedQuickPaste {
  name: string;
  url: string;
  apiKey: string;
}

function createEmptyForm(): ConfigFormState {
  return {
    name: "",
    url: "",
    apiKey: "",
  };
}

function getStatusClass(status: ApplyStatus) {
  if (status === "success") {
    return "status-pill status-success";
  }

  if (status === "failed") {
    return "status-pill status-failed";
  }

  return "status-pill status-neutral";
}

async function readJson<T>(response: Response): Promise<T> {
  return (await response.json().catch(() => ({}))) as T;
}

function tryExtractByLabel(line: string, labels: string[]) {
  for (const label of labels) {
    const pattern = new RegExp(`^${label}\\s*[:：]\\s*(.+)$`, "i");
    const matched = line.match(pattern);

    if (matched?.[1]) {
      return matched[1].trim();
    }
  }

  return null;
}

function parseQuickPaste(rawText: string): ParsedQuickPaste {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    throw new Error("请先粘贴内容。");
  }

  let name = "";
  let url = "";
  let apiKey = "";

  for (const line of lines) {
    if (!name) {
      const labeledName = tryExtractByLabel(line, ["name", "名称", "标题"]);

      if (labeledName) {
        name = labeledName;
        continue;
      }
    }

    if (!url) {
      const labeledUrl = tryExtractByLabel(line, ["url", "base_url", "base-url", "endpoint"]);

      if (labeledUrl) {
        url = labeledUrl;
        continue;
      }
    }

    if (!apiKey) {
      const labeledApiKey = tryExtractByLabel(line, ["api[_ -]?key", "apikey", "key", "openai_api_key"]);

      if (labeledApiKey) {
        apiKey = labeledApiKey;
        continue;
      }
    }
  }

  for (const line of lines) {
    if (!url && /^https?:\/\/\S+$/i.test(line)) {
      url = line;
      continue;
    }

    if (!apiKey && !line.includes(" ") && !/^https?:\/\//i.test(line) && (line.startsWith("sk-") || line.length >= 16)) {
      apiKey = line;
      continue;
    }

    if (!name && line !== url && line !== apiKey) {
      name = line;
    }
  }

  if (!name || !url || !apiKey) {
    throw new Error("未能完整识别名称、URL、API Key，请按三行格式或带标签格式粘贴。");
  }

  return { name, url, apiKey };
}

export default function ConfigManager({ initialConfigs }: ConfigManagerProps) {
  const [configs, setConfigs] = useState(initialConfigs);
  const [form, setForm] = useState<ConfigFormState>(createEmptyForm());
  const [quickPasteText, setQuickPasteText] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [revealedIds, setRevealedIds] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadConfigs() {
    setLoading(true);

    try {
      const response = await fetch("/api/configs", {
        cache: "no-store",
      });
      const payload = await readJson<{ configs?: ConfigRecord[]; error?: string }>(response);

      if (!response.ok) {
        throw new Error(payload.error ?? "加载配置列表失败。");
      }

      setConfigs(payload.configs ?? []);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "加载配置列表失败。");
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setEditingId(null);
    setForm(createEmptyForm());
    setQuickPasteText("");
  }

  function updateNotice(nextMessage: string | null, nextError: string | null = null) {
    setMessage(nextMessage);
    setError(nextError);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    updateNotice(null, null);

    try {
      const response = await fetch(editingId ? `/api/configs/${editingId}` : "/api/configs", {
        method: editingId ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const payload = await readJson<{ error?: string }>(response);

      if (!response.ok) {
        throw new Error(payload.error ?? "保存配置失败。");
      }

      await loadConfigs();
      resetForm();
      updateNotice(editingId ? "配置已更新。" : "配置已新增。", null);
    } catch (submitError) {
      updateNotice(null, submitError instanceof Error ? submitError.message : "保存配置失败。");
    } finally {
      setLoading(false);
    }
  }

  function handleEdit(config: ConfigRecord) {
    setEditingId(config.id);
    setForm({
      name: config.name,
      url: config.url,
      apiKey: config.apiKey,
    });
    setQuickPasteText("");
    updateNotice(null, null);
  }

  async function handleDelete(config: ConfigRecord) {
    setLoading(true);
    updateNotice(null, null);

    try {
      const response = await fetch(`/api/configs/${config.id}`, {
        method: "DELETE",
      });
      const payload = await readJson<{ error?: string }>(response);

      if (!response.ok) {
        throw new Error(payload.error ?? "删除配置失败。");
      }

      if (editingId === config.id) {
        resetForm();
      }

      await loadConfigs();
      updateNotice("配置已删除。", null);
    } catch (deleteError) {
      updateNotice(null, deleteError instanceof Error ? deleteError.message : "删除配置失败。");
    } finally {
      setLoading(false);
    }
  }

  async function handleActivate(config: ConfigRecord) {
    setLoading(true);
    updateNotice(null, null);

    try {
      const response = await fetch(`/api/configs/${config.id}/activate`, {
        method: "POST",
      });
      const payload = await readJson<{ error?: string }>(response);

      if (!response.ok) {
        throw new Error(payload.error ?? "启用配置失败。");
      }

      await loadConfigs();
      updateNotice(`已启用 ${config.name}，并同步写入 codex 与 openclaw。`, null);
    } catch (activateError) {
      updateNotice(null, activateError instanceof Error ? activateError.message : "启用配置失败。");
    } finally {
      setLoading(false);
    }
  }

  function toggleSecret(configId: number) {
    setRevealedIds((current) => ({
      ...current,
      [configId]: !current[configId],
    }));
  }

  function fillFormFromQuickPaste(rawText: string) {
    const parsed = parseQuickPaste(rawText);
    setForm({
      name: parsed.name,
      url: parsed.url,
      apiKey: parsed.apiKey,
    });
    updateNotice("已自动识别并填充名称、URL、API Key。", null);
  }

  function handleQuickPasteAction() {
    try {
      fillFormFromQuickPaste(quickPasteText);
    } catch (parseError) {
      updateNotice(null, parseError instanceof Error ? parseError.message : "识别粘贴内容失败。");
    }
  }

  function handleQuickPaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const text = event.clipboardData.getData("text");
    event.preventDefault();
    setQuickPasteText(text);

    try {
      fillFormFromQuickPaste(text);
    } catch (parseError) {
      updateNotice(null, parseError instanceof Error ? parseError.message : "识别粘贴内容失败。");
    }
  }

  return (
    <div className="panel-grid">
      <section className="card stack">
        <div className="page-actions">
          <div className="stack" style={{ gap: 6 }}>
            <strong>共享配置列表</strong>
            <span className="subtle">启用后会同时更新 codex 与 openclaw，只是底层文件映射和后置动作不同。</span>
          </div>
          <button className="button button-secondary" onClick={resetForm} type="button">
            新增配置
          </button>
          <span className="subtle">{loading ? "处理中..." : `共 ${configs.length} 条记录`}</span>
        </div>

        {message ? <div className="notice notice-success">{message}</div> : null}
        {error ? <div className="notice notice-error">{error}</div> : null}

        <div className="table-wrap">
          <table className="data-table config-table">
            <thead>
              <tr>
                <th>名称</th>
                <th className="config-col-url">URL</th>
                <th className="config-col-key">API Key</th>
                <th>启用状态</th>
                <th>最近应用</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {configs.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div className="empty-state">当前还没有配置记录。</div>
                  </td>
                </tr>
              ) : (
                configs.map((config) => (
                  <tr key={config.id}>
                    <td className="config-col-name">
                      <strong>{config.name}</strong>
                      <div className="subtle">更新时间：{config.updatedAt}</div>
                    </td>
                    <td className="config-col-url secret-value">{config.url}</td>
                    <td className="config-col-key">
                      <div className="secret-value">{revealedIds[config.id] ? config.apiKey : maskSecret(config.apiKey)}</div>
                      <button className="button button-ghost" onClick={() => toggleSecret(config.id)} type="button">
                        {revealedIds[config.id] ? "隐藏" : "显示"}
                      </button>
                    </td>
                    <td className="config-col-status">
                      <span className={config.isActive ? "status-pill status-success" : "status-pill status-neutral"}>
                        {config.isActive ? "启用中" : "未启用"}
                      </span>
                    </td>
                    <td className="config-col-apply">
                      <span className={getStatusClass(config.lastApplyStatus)}>{config.lastApplyStatus}</span>
                      <div className="subtle">{config.lastApplyMessage ?? "尚未应用"}</div>
                    </td>
                    <td className="config-col-actions">
                      <div className="row-actions">
                        <button className="button button-secondary" onClick={() => handleEdit(config)} type="button">
                          编辑
                        </button>
                        <button className="button button-danger" onClick={() => handleDelete(config)} type="button">
                          删除
                        </button>
                        <button
                          className="button button-success"
                          disabled={config.isActive}
                          onClick={() => handleActivate(config)}
                          type="button"
                        >
                          {config.isActive ? "已启用" : "启用"}
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
        <div>
          <p className="subtle">{editingId ? `正在编辑 #${editingId}` : "新增一条共享配置记录"}</p>
          <h2>{editingId ? "编辑配置" : "新增配置"}</h2>
        </div>
        <form className="form-grid" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="quick-paste">快速粘贴识别</label>
            <textarea
              id="quick-paste"
              className="textarea"
              onChange={(event) => setQuickPasteText(event.target.value)}
              onPaste={handleQuickPaste}
              placeholder={"支持直接粘贴三行内容，例如：\nxiaoxiao\nhttp://192.29.101.19:8317/\nsk-xxxx"}
              rows={5}
              value={quickPasteText}
            />
            <div className="field-actions">
              <button className="button button-secondary" onClick={handleQuickPasteAction} type="button">
                识别填充
              </button>
              <span className="subtle">支持三行格式，也支持 `名称: ...`、`URL: ...`、`API Key: ...` 这种格式。</span>
            </div>
          </div>
          <div className="field">
            <label htmlFor="form-name">名称</label>
            <input
              id="form-name"
              className="input"
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              value={form.name}
            />
          </div>
          <div className="field">
            <label htmlFor="form-url">URL</label>
            <input
              id="form-url"
              className="input"
              onChange={(event) => setForm((current) => ({ ...current, url: event.target.value }))}
              value={form.url}
            />
          </div>
          <div className="field">
            <label htmlFor="form-apiKey">API Key</label>
            <input
              id="form-apiKey"
              className="input"
              onChange={(event) => setForm((current) => ({ ...current, apiKey: event.target.value }))}
              value={form.apiKey}
            />
          </div>
          <div className="field-actions">
            <button className="button button-primary" disabled={loading} type="submit">
              {loading ? "保存中..." : editingId ? "保存修改" : "新增配置"}
            </button>
            <button className="button button-ghost" onClick={resetForm} type="button">
              清空
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}
