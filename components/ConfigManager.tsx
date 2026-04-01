"use client";

import { ClipboardEvent, FormEvent, useState } from "react";

import { maskSecret } from "@/lib/utils";
import type { ApplyStatus, ConfigRecord } from "@/types";

const TEXT = {
  pasteFirst: "\u8bf7\u5148\u7c98\u8d34\u5185\u5bb9\u3002",
  parseFailed:
    "\u672a\u80fd\u5b8c\u6574\u8bc6\u522b\u540d\u79f0\u3001URL\u3001API Key\uff0c\u8bf7\u6309\u4e09\u884c\u683c\u5f0f\u6216\u5e26\u6807\u7b7e\u683c\u5f0f\u7c98\u8d34\u3002",
  loadFailed: "\u52a0\u8f7d\u914d\u7f6e\u5217\u8868\u5931\u8d25\u3002",
  saveFailed: "\u4fdd\u5b58\u914d\u7f6e\u5931\u8d25\u3002",
  updateSuccess: "\u914d\u7f6e\u5df2\u66f4\u65b0\u3002",
  createSuccess: "\u914d\u7f6e\u5df2\u65b0\u589e\u3002",
  deleteFailed: "\u5220\u9664\u914d\u7f6e\u5931\u8d25\u3002",
  deleteSuccess: "\u914d\u7f6e\u5df2\u5220\u9664\u3002",
  activateFailed: "\u542f\u7528\u914d\u7f6e\u5931\u8d25\u3002",
  activateSuccessPrefix: "\u5df2\u542f\u7528 ",
  activateSuccessSuffix: "\uff0c\u5e76\u540c\u6b65\u5199\u5165 codex \u4e0e openclaw\u3002",
  fillSuccess: "\u5df2\u81ea\u52a8\u8bc6\u522b\u5e76\u586b\u5145\u540d\u79f0\u3001URL\u3001API Key\u3002",
  quickPasteFailed: "\u8bc6\u522b\u7c98\u8d34\u5185\u5bb9\u5931\u8d25\u3002",
  sharedTitle: "\u5171\u4eab\u914d\u7f6e\u5217\u8868",
  sharedHint: "\u542f\u7528\u540e\u4f1a\u540c\u65f6\u66f4\u65b0 codex \u4e0e openclaw\uff0c\u53ea\u662f\u5e95\u5c42\u6620\u5c04\u548c\u540e\u7f6e\u52a8\u4f5c\u4e0d\u540c\u3002",
  addConfig: "\u65b0\u589e\u914d\u7f6e",
  processing: "\u5904\u7406\u4e2d...",
  totalPrefix: "\u5171 ",
  totalSuffix: " \u6761\u8bb0\u5f55",
  name: "\u540d\u79f0",
  enabledStatus: "\u542f\u7528\u72b6\u6001",
  recentApply: "\u6700\u8fd1\u5e94\u7528",
  actions: "\u64cd\u4f5c",
  empty: "\u5f53\u524d\u8fd8\u6ca1\u6709\u914d\u7f6e\u8bb0\u5f55\u3002",
  updatedAt: "\u66f4\u65b0\u65f6\u95f4\uff1a",
  hide: "\u9690\u85cf",
  show: "\u663e\u793a",
  enabled: "\u542f\u7528\u4e2d",
  disabled: "\u672a\u542f\u7528",
  notApplied: "\u5c1a\u672a\u5e94\u7528",
  edit: "\u7f16\u8f91",
  delete: "\u5220\u9664",
  alreadyEnabled: "\u5df2\u542f\u7528",
  activate: "\u542f\u7528",
  editingPrefix: "\u6b63\u5728\u7f16\u8f91 #",
  newSharedRecord: "\u65b0\u589e\u4e00\u6761\u5171\u4eab\u914d\u7f6e\u8bb0\u5f55",
  editConfig: "\u7f16\u8f91\u914d\u7f6e",
  quickPaste: "\u5feb\u901f\u7c98\u8d34\u8bc6\u522b",
  quickPastePlaceholder:
    "\u652f\u6301\u76f4\u63a5\u7c98\u8d34\u4e09\u884c\u5185\u5bb9\uff0c\u4f8b\u5982\uff1a\nxiaoxiao\nhttp://192.29.101.19:8317/\nsk-xxxx",
  identifyFill: "\u8bc6\u522b\u586b\u5145",
  quickPasteHelp:
    "\u652f\u6301\u4e09\u884c\u683c\u5f0f\uff0c\u4e5f\u652f\u6301 `\u540d\u79f0: ...`\u3001`URL: ...`\u3001`API Key: ...` \u8fd9\u79cd\u683c\u5f0f\u3002",
  submitSaving: "\u4fdd\u5b58\u4e2d...",
  saveEdit: "\u4fdd\u5b58\u4fee\u6539",
  clear: "\u6e05\u7a7a",
} as const;

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
    const pattern = new RegExp(`^${label}\\s*[:\\uFF1A]\\s*(.+)$`, "i");
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
    throw new Error(TEXT.pasteFirst);
  }

  let name = "";
  let url = "";
  let apiKey = "";

  for (const line of lines) {
    if (!name) {
      const labeledName = tryExtractByLabel(line, ["name", "\u540d\u79f0", "\u6807\u9898"]);

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
    throw new Error(TEXT.parseFailed);
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
        throw new Error(payload.error ?? TEXT.loadFailed);
      }

      setConfigs(payload.configs ?? []);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : TEXT.loadFailed);
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
        throw new Error(payload.error ?? TEXT.saveFailed);
      }

      await loadConfigs();
      resetForm();
      updateNotice(editingId ? TEXT.updateSuccess : TEXT.createSuccess);
    } catch (submitError) {
      updateNotice(null, submitError instanceof Error ? submitError.message : TEXT.saveFailed);
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
        throw new Error(payload.error ?? TEXT.deleteFailed);
      }

      if (editingId === config.id) {
        resetForm();
      }

      await loadConfigs();
      updateNotice(TEXT.deleteSuccess);
    } catch (deleteError) {
      updateNotice(null, deleteError instanceof Error ? deleteError.message : TEXT.deleteFailed);
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
        throw new Error(payload.error ?? TEXT.activateFailed);
      }

      await loadConfigs();
      updateNotice(`${TEXT.activateSuccessPrefix}${config.name}${TEXT.activateSuccessSuffix}`);
    } catch (activateError) {
      updateNotice(null, activateError instanceof Error ? activateError.message : TEXT.activateFailed);
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
    updateNotice(TEXT.fillSuccess);
  }

  function handleQuickPasteAction() {
    try {
      fillFormFromQuickPaste(quickPasteText);
    } catch (parseError) {
      updateNotice(null, parseError instanceof Error ? parseError.message : TEXT.quickPasteFailed);
    }
  }

  function handleQuickPaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const text = event.clipboardData.getData("text");
    event.preventDefault();
    setQuickPasteText(text);

    try {
      fillFormFromQuickPaste(text);
    } catch (parseError) {
      updateNotice(null, parseError instanceof Error ? parseError.message : TEXT.quickPasteFailed);
    }
  }

  return (
    <div className="panel-grid">
      <section className="card stack">
        <div className="page-actions">
          <div className="stack" style={{ gap: 6 }}>
            <strong>{TEXT.sharedTitle}</strong>
            <span className="subtle">{TEXT.sharedHint}</span>
          </div>
          <button className="button button-secondary" onClick={resetForm} type="button">
            {TEXT.addConfig}
          </button>
          <span className="subtle">{loading ? TEXT.processing : `${TEXT.totalPrefix}${configs.length}${TEXT.totalSuffix}`}</span>
        </div>

        {message ? <div className="notice notice-success">{message}</div> : null}
        {error ? <div className="notice notice-error">{error}</div> : null}

        <div className="table-wrap">
          <table className="data-table config-table">
            <thead>
              <tr>
                <th>{TEXT.name}</th>
                <th className="config-col-url">URL</th>
                <th className="config-col-key">API Key</th>
                <th>{TEXT.enabledStatus}</th>
                <th>{TEXT.recentApply}</th>
                <th>{TEXT.actions}</th>
              </tr>
            </thead>
            <tbody>
              {configs.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div className="empty-state">{TEXT.empty}</div>
                  </td>
                </tr>
              ) : (
                configs.map((config) => (
                  <tr key={config.id}>
                    <td className="config-col-name">
                      <strong>{config.name}</strong>
                      <div className="subtle">
                        {TEXT.updatedAt}
                        {config.updatedAt}
                      </div>
                    </td>
                    <td className="config-col-url secret-value">{config.url}</td>
                    <td className="config-col-key">
                      <div className="secret-value">{revealedIds[config.id] ? config.apiKey : maskSecret(config.apiKey)}</div>
                      <button className="button button-ghost" onClick={() => toggleSecret(config.id)} type="button">
                        {revealedIds[config.id] ? TEXT.hide : TEXT.show}
                      </button>
                    </td>
                    <td className="config-col-status">
                      <span className={config.isActive ? "status-pill status-success" : "status-pill status-neutral"}>
                        {config.isActive ? TEXT.enabled : TEXT.disabled}
                      </span>
                    </td>
                    <td className="config-col-apply">
                      <span className={getStatusClass(config.lastApplyStatus)}>{config.lastApplyStatus}</span>
                      <div className="subtle">{config.lastApplyMessage ?? TEXT.notApplied}</div>
                    </td>
                    <td className="config-col-actions">
                      <div className="row-actions">
                        <button className="button button-secondary" onClick={() => handleEdit(config)} type="button">
                          {TEXT.edit}
                        </button>
                        <button className="button button-danger" onClick={() => handleDelete(config)} type="button">
                          {TEXT.delete}
                        </button>
                        <button
                          className="button button-success"
                          disabled={config.isActive}
                          onClick={() => handleActivate(config)}
                          type="button"
                        >
                          {config.isActive ? TEXT.alreadyEnabled : TEXT.activate}
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
          <p className="subtle">{editingId ? `${TEXT.editingPrefix}${editingId}` : TEXT.newSharedRecord}</p>
          <h2>{editingId ? TEXT.editConfig : TEXT.addConfig}</h2>
        </div>
        <form className="form-grid" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="quick-paste">{TEXT.quickPaste}</label>
            <textarea
              id="quick-paste"
              className="textarea"
              onChange={(event) => setQuickPasteText(event.target.value)}
              onPaste={handleQuickPaste}
              placeholder={TEXT.quickPastePlaceholder}
              rows={5}
              value={quickPasteText}
            />
            <div className="field-actions">
              <button className="button button-secondary" onClick={handleQuickPasteAction} type="button">
                {TEXT.identifyFill}
              </button>
              <span className="subtle">{TEXT.quickPasteHelp}</span>
            </div>
          </div>
          <div className="field">
            <label htmlFor="form-name">{TEXT.name}</label>
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
              {loading ? TEXT.submitSaving : editingId ? TEXT.saveEdit : TEXT.addConfig}
            </button>
            <button className="button button-ghost" onClick={resetForm} type="button">
              {TEXT.clear}
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}
