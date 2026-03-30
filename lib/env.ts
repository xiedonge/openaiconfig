import path from "node:path";

const DEFAULT_SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

function resolveConfiguredDirectory(overrideValue: string | undefined) {
  return overrideValue ? path.resolve(overrideValue) : null;
}

export function getDataDirectory() {
  return path.resolve(process.env.DATA_DIR ?? path.join(process.cwd(), "data"));
}

export function getCodexPaths() {
  const configuredRoot = resolveConfiguredDirectory(process.env.CODEX_CONFIG_DIR);
  const root = configuredRoot ?? process.cwd();

  return {
    root,
    configToml: configuredRoot ? path.join(root, "config.toml") : path.join(root, "sample.config.toml"),
    authJson: configuredRoot ? path.join(root, "auth.json") : path.join(root, "sample.auth.json"),
    backupsRoot: configuredRoot ? path.join(root, "backups") : path.join(process.cwd(), ".runtime-backups", "codex"),
  };
}

export function getOpenClawPaths() {
  const configuredRoot = resolveConfiguredDirectory(process.env.OPENCLAW_CONFIG_DIR);
  const root = configuredRoot ?? process.cwd();

  return {
    root,
    configJson: configuredRoot ? path.join(root, "openclaw.json") : path.join(root, "sample.openclaw.json"),
    backupsRoot: configuredRoot ? path.join(root, "backups") : path.join(process.cwd(), ".runtime-backups", "openclaw"),
  };
}

export function getOpenClawProviderKey() {
  return process.env.OPENCLAW_PROVIDER_KEY ?? "custom-goood-my";
}

export function getAdminUsername() {
  return process.env.ADMIN_USERNAME ?? "admin";
}

export function getSessionSecret() {
  const secret = process.env.SESSION_SECRET;

  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV !== "production") {
    return "config-manager-dev-session-secret";
  }

  throw new Error("SESSION_SECRET is required in production.");
}

export function getSessionTtlSeconds() {
  const rawValue = process.env.SESSION_TTL_SECONDS;
  const parsed = rawValue ? Number.parseInt(rawValue, 10) : DEFAULT_SESSION_TTL_SECONDS;

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_SESSION_TTL_SECONDS;
  }

  return parsed;
}

export function getOpenClawRestartCommand() {
  return process.env.OPENCLAW_RESTART_COMMAND ?? "openclaw gateway restart";
}
