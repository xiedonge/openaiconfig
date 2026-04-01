"use client";

import { useEffect, useState } from "react";

import type { SystemUpdateStatus } from "@/types";

const RUNNING_STALE_WARNING_MS = 2 * 60 * 1000;

const TEXT = {
  idle: "\u5c1a\u672a\u6267\u884c\u7f51\u7ad9\u66f4\u65b0\u3002",
  runningStale:
    "\u66f4\u65b0\u72b6\u6001\u8d85\u8fc7 2 \u5206\u949f\u6ca1\u6709\u53d8\u5316\uff0c\u53ef\u80fd\u5361\u5728 git\u3001npm \u6216\u670d\u52a1\u91cd\u542f\u9636\u6bb5\uff0c\u53ef\u5728\u670d\u52a1\u5668\u4e0a\u6267\u884c journalctl -u config-manager-web-update -n 100 --no-pager \u6392\u67e5\u3002",
  loadFailed: "\u52a0\u8f7d\u66f4\u65b0\u72b6\u6001\u5931\u8d25\u3002",
  restartHint: "\u66f4\u65b0\u4e2d\uff0c\u670d\u52a1\u53ef\u80fd\u6b63\u5728\u91cd\u542f\uff0c\u8bf7\u7a0d\u540e\u624b\u52a8\u5237\u65b0\u9875\u9762\u3002",
  startFailed: "\u542f\u52a8\u66f4\u65b0\u5931\u8d25\u3002",
  updateRunning: "\u66f4\u65b0\u4e2d...",
  updateWebsite: "\u66f4\u65b0\u7f51\u7ad9",
  refreshStatus: "\u5237\u65b0\u72b6\u6001",
  loading: "\u52a0\u8f7d\u4e2d",
  running: "\u66f4\u65b0\u4e2d",
  success: "\u5df2\u5b8c\u6210",
  failed: "\u5931\u8d25",
  pending: "\u5f85\u66f4\u65b0",
  recentTime: "\u6700\u8fd1\u65f6\u95f4\uff1a",
} as const;

function decodeEscapedUnicodeText(value: string) {
  return value.replace(/\\u([0-9a-fA-F]{4})/g, (_, code) => String.fromCharCode(Number.parseInt(code, 16)));
}

const DEFAULT_STATUS: SystemUpdateStatus = {
  state: "idle",
  message: TEXT.idle,
  startedAt: null,
  finishedAt: null,
  fromCommit: null,
  toCommit: null,
  updatedAt: null,
};

async function readJson<T>(response: Response): Promise<T> {
  return (await response.json().catch(() => ({}))) as T;
}

function formatTime(value: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function normalizeMessage(value: string) {
  return decodeEscapedUnicodeText(value);
}

export default function SystemUpdateButton() {
  const [status, setStatus] = useState<SystemUpdateStatus>(DEFAULT_STATUS);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function getRunningWarning(nextStatus: SystemUpdateStatus) {
    if (nextStatus.state !== "running" || !nextStatus.updatedAt) {
      return null;
    }

    const updatedAt = Date.parse(nextStatus.updatedAt);

    if (Number.isNaN(updatedAt) || Date.now() - updatedAt < RUNNING_STALE_WARNING_MS) {
      return null;
    }

    return TEXT.runningStale;
  }

  async function loadStatus() {
    try {
      const response = await fetch("/api/system/update", {
        cache: "no-store",
      });
      const payload = await readJson<{ status?: SystemUpdateStatus; error?: string }>(response);

      if (!response.ok) {
        throw new Error(payload.error ?? TEXT.loadFailed);
      }

      const nextStatus = payload.status ?? DEFAULT_STATUS;
      setStatus(nextStatus);
      setError(getRunningWarning(nextStatus));
    } catch (loadError) {
      const message = loadError instanceof Error ? normalizeMessage(loadError.message) : TEXT.loadFailed;

      if (status.state === "running") {
        setError(TEXT.restartHint);
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadStatus();
  }, []);

  useEffect(() => {
    if (status.state !== "running") {
      return;
    }

    const timer = window.setInterval(() => {
      void loadStatus();
    }, 4000);

    return () => window.clearInterval(timer);
  }, [status.state]);

  async function handleUpdate() {
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/system/update", {
        method: "POST",
      });
      const payload = await readJson<{ status?: SystemUpdateStatus; error?: string }>(response);

      if (!response.ok) {
        throw new Error(payload.error ?? TEXT.startFailed);
      }

      const nextStatus = payload.status ?? DEFAULT_STATUS;
      setStatus(nextStatus);
      setError(getRunningWarning(nextStatus));
    } catch (submitError) {
      const message = submitError instanceof Error ? normalizeMessage(submitError.message) : TEXT.startFailed;
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  const statusText = normalizeMessage(error ?? status.message);
  const timeText = formatTime(status.updatedAt ?? status.finishedAt ?? status.startedAt);
  const buttonDisabled = submitting || status.state === "running";

  return (
    <div className="system-update-box">
      <div className="field-actions">
        <button className="button button-secondary" disabled={buttonDisabled} onClick={handleUpdate} type="button">
          {buttonDisabled ? TEXT.updateRunning : TEXT.updateWebsite}
        </button>
        <button className="button button-ghost" disabled={loading} onClick={() => void loadStatus()} type="button">
          {TEXT.refreshStatus}
        </button>
      </div>
      <div className="system-update-meta">
        <span
          className={`status-pill ${
            status.state === "failed"
              ? "status-failed"
              : status.state === "success"
                ? "status-success"
                : "status-neutral"
          }`}
        >
          {loading
            ? TEXT.loading
            : status.state === "running"
              ? TEXT.running
              : status.state === "success"
                ? TEXT.success
                : status.state === "failed"
                  ? TEXT.failed
                  : TEXT.pending}
        </span>
        <span className="subtle system-update-text">{statusText}</span>
        {timeText ? (
          <span className="subtle system-update-text">
            {TEXT.recentTime}
            {timeText}
          </span>
        ) : null}
      </div>
    </div>
  );
}
