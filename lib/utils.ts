export function nowIsoString() {
  return new Date().toISOString();
}

export function maskSecret(value: string) {
  if (value.length <= 8) {
    return "*".repeat(value.length);
  }

  return `${value.slice(0, 4)}${"*".repeat(Math.max(4, value.length - 8))}${value.slice(-4)}`;
}

export function sqliteBoolean(value: unknown) {
  return value === 1 || value === true;
}

export function normalizeSqliteTimestamp(value: unknown) {
  return typeof value === "string" ? value : null;
}

export function getBackupFileName(filePath: string) {
  const parts = filePath.split(/[\\/]/);
  return parts[parts.length - 1] ?? filePath;
}

export function toErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown error";
}

export function parseNumericId(value: string) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("Invalid identifier.");
  }

  return parsed;
}
