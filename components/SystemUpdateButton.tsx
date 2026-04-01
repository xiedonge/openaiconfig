"use client";

import { useEffect, useState } from "react";

import type { SystemUpdateStatus } from "@/types";

const DEFAULT_STATUS: SystemUpdateStatus = {
  state: "idle",
  message: "\u5c1a\u672a\u6267\u884c\u7f51\u7ad9\u66f4\u65b0\u3002",
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

export default function SystemUpdateButton() {
  const [status, setStatus] = useState<SystemUpdateStatus>(DEFAULT_STATUS);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadStatus() {
    try {
      const response = await fetch("/api/system/update", {
        cache: "no-store",
      });
      const payload = await readJson<{ status?: SystemUpdateStatus; error?: string }>(response);

      if (!response.ok) {
        throw new Error(payload.error ?? "\u52a0\u8f7d\u66f4\u65b0\u72b6\u6001\u5931\u8d25\u3002");
      }

      setStatus(payload.status ?? DEFAULT_STATUS);
      setError(null);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "\u52a0\u8f7d\u66f4\u65b0\u72b6\u6001\u5931\u8d25\u3002";

      if (status.state === "running") {
        setError("\u66f4\u65b0\u4e2d\uff0c\u670d\u52a1\u53ef\u80fd\u6b63\u5728\u91cd\u542f\uff0c\u8bf7\u7a0d\u540e\u624b\u52a8\u5237\u65b0\u9875\u9762\u3002");
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
        throw new Error(payload.error ?? "\u542f\u52a8\u66f4\u65b0\u5931\u8d25\u3002");
      }

      setStatus(payload.status ?? DEFAULT_STATUS);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "\u542f\u52a8\u66f4\u65b0\u5931\u8d25\u3002");
    } finally {
      setSubmitting(false);
    }
  }

  const statusText = error ?? status.message;
  const timeText = formatTime(status.updatedAt ?? status.finishedAt ?? status.startedAt);
  const buttonDisabled = submitting || status.state === "running";

  return (
    <div className="system-update-box">
      <button className="button button-secondary" disabled={buttonDisabled} onClick={handleUpdate} type="button">
        {buttonDisabled ? "\u66f4\u65b0\u4e2d..." : "\u66f4\u65b0\u7f51\u7ad9"}
      </button>
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
            ? "\u52a0\u8f7d\u4e2d"
            : status.state === "running"
              ? "\u66f4\u65b0\u4e2d"
              : status.state === "success"
                ? "\u5df2\u5b8c\u6210"
                : status.state === "failed"
                  ? "\u5931\u8d25"
                  : "\u5f85\u66f4\u65b0"}
        </span>
        <span className="subtle system-update-text">{statusText}</span>
        {timeText ? <span className="subtle system-update-text">\u6700\u8fd1\u65f6\u95f4\uff1a{timeText}</span> : null}
      </div>
    </div>
  );
}
