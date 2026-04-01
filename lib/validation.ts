import type { AppType, BackupScope, TriggerType } from "@/types";

export interface LoginInput {
  username: string;
  password: string;
}

export interface ConfigInput {
  name: string;
  url: string;
  apiKey: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function parseAppType(value: unknown): AppType {
  if (value === "codex" || value === "openclaw") {
    return value;
  }

  throw new Error("Invalid app type.");
}

export function parseBackupScope(value: unknown): BackupScope {
  if (value === "shared" || value === "codex" || value === "openclaw") {
    return value;
  }

  throw new Error("Invalid backup scope.");
}

export function parseTriggerType(value: unknown): TriggerType {
  if (value === "activate" || value === "restore") {
    return value;
  }

  throw new Error("Invalid trigger type.");
}

export function validateLoginInput(input: unknown): LoginInput {
  if (!isRecord(input)) {
    throw new Error("Invalid login payload.");
  }

  const username = String(input.username ?? "").trim();
  const password = String(input.password ?? "");

  if (!username || !password) {
    throw new Error("Username and password are required.");
  }

  return { username, password };
}

export function validateConfigInput(input: unknown): ConfigInput {
  if (!isRecord(input)) {
    throw new Error("Invalid config payload.");
  }

  const name = String(input.name ?? "").trim();
  const url = String(input.url ?? "").trim();
  const apiKey = String(input.apiKey ?? "").trim();

  if (!name) {
    throw new Error("Name is required.");
  }

  if (!url) {
    throw new Error("URL is required.");
  }

  try {
    const parsedUrl = new URL(url);

    if (!parsedUrl.protocol.startsWith("http")) {
      throw new Error("Invalid URL protocol.");
    }
  } catch {
    throw new Error("URL format is invalid.");
  }

  if (!apiKey) {
    throw new Error("API key is required.");
  }

  return { name, url, apiKey };
}
