import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { getDataDirectory, getUpdateServiceName, getUpdateStatusFilePath } from "@/lib/env";
import type { SystemUpdateStatus } from "@/types";

const execFileAsync = promisify(execFile);
const STALE_RUNNING_MS = 30 * 60 * 1000;

const DEFAULT_STATUS: SystemUpdateStatus = {
  state: "idle",
  message: "\u5c1a\u672a\u6267\u884c\u7f51\u7ad9\u66f4\u65b0\u3002",
  startedAt: null,
  finishedAt: null,
  fromCommit: null,
  toCommit: null,
  updatedAt: null,
};

function normalizeStatus(input: Partial<SystemUpdateStatus>): SystemUpdateStatus {
  return {
    state: input.state ?? DEFAULT_STATUS.state,
    message: input.message ?? DEFAULT_STATUS.message,
    startedAt: input.startedAt ?? null,
    finishedAt: input.finishedAt ?? null,
    fromCommit: input.fromCommit ?? null,
    toCommit: input.toCommit ?? null,
    updatedAt: input.updatedAt ?? null,
  };
}

function isRunningStatusStale(status: SystemUpdateStatus) {
  if (status.state !== "running" || !status.updatedAt) {
    return false;
  }

  const updatedAt = Date.parse(status.updatedAt);

  if (Number.isNaN(updatedAt)) {
    return false;
  }

  return Date.now() - updatedAt > STALE_RUNNING_MS;
}

export async function readSystemUpdateStatus() {
  try {
    const content = await fs.readFile(getUpdateStatusFilePath(), "utf8");
    const status = normalizeStatus(JSON.parse(content) as Partial<SystemUpdateStatus>);

    if (!isRunningStatusStale(status)) {
      return status;
    }

    return await writeSystemUpdateStatus({
      ...status,
      state: "failed",
      message: "\u4e0a\u4e00\u6b21\u66f4\u65b0\u72b6\u6001\u5df2\u8d85\u65f6\uff0c\u53ef\u80fd\u5df2\u4e2d\u65ad\uff0c\u8bf7\u91cd\u65b0\u70b9\u51fb\u66f4\u65b0\u3002",
      finishedAt: new Date().toISOString(),
    });
  } catch {
    return DEFAULT_STATUS;
  }
}

export async function writeSystemUpdateStatus(status: Partial<SystemUpdateStatus>) {
  const filePath = getUpdateStatusFilePath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const payload = normalizeStatus({
    ...status,
    updatedAt: new Date().toISOString(),
  });
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return payload;
}

export async function startSystemUpdate() {
  if (process.platform !== "linux") {
    throw new Error("\u7f51\u7ad9\u66f4\u65b0\u6309\u94ae\u4ec5\u652f\u6301 Linux \u670d\u52a1\u5668\u90e8\u7f72\u73af\u5883\u3002");
  }

  const serviceName = getUpdateServiceName();
  const startedAt = new Date().toISOString();

  const runningStatus = await writeSystemUpdateStatus({
    state: "running",
    message: "\u5df2\u53d1\u8d77\u66f4\u65b0\uff0c\u6b63\u5728\u540e\u53f0\u6267\u884c\u3002\u9875\u9762\u53ef\u80fd\u4f1a\u5728\u7a0d\u540e\u77ed\u6682\u91cd\u542f\u3002",
    startedAt,
    finishedAt: null,
  });

  try {
    await execFileAsync("sudo", ["-n", "systemctl", "start", "--no-block", serviceName], {
      cwd: getDataDirectory(),
    });
    return runningStatus;
  } catch (error) {
    const message = error instanceof Error ? error.message : "\u542f\u52a8\u66f4\u65b0\u670d\u52a1\u5931\u8d25\u3002";
    await writeSystemUpdateStatus({
      state: "failed",
      message: `\u65e0\u6cd5\u542f\u52a8\u66f4\u65b0\u670d\u52a1\uff1a${message}`,
      startedAt,
      finishedAt: new Date().toISOString(),
    });
    throw new Error(message);
  }
}
