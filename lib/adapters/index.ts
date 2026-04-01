import { spawn } from "node:child_process";

import * as TOML from "@iarna/toml";

import { getCodexPaths, getOpenClawPaths, getOpenClawProviderKey, getOpenClawRestartCommand } from "@/lib/env";
import type { AppType, ConfigRecord } from "@/types";

export type PostActionStage = "apply" | "restore" | "rollback";

export interface FileMutation {
  sourcePath: string;
  transform(currentContent: string): string | Promise<string>;
}

export interface AppAdapter {
  appType: AppType;
  getBackupRoot(): string;
  getMutations(config: ConfigRecord): FileMutation[];
  runPostAction(stage: PostActionStage): Promise<string | null>;
}

type JsonObject = Record<string, unknown>;
type OpenClawProvider = JsonObject & { baseUrl?: string; apiKey?: string };

function getRestartTimeoutMs() {
  const parsed = Number.parseInt(process.env.OPENCLAW_RESTART_TIMEOUT_MS ?? "30000", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 30000;
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function runShellCommand(command: string) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(command, {
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let settled = false;

    const timeout = setTimeout(() => {
      settled = true;
      child.kill();
      reject(new Error(`Command '${command}' timed out after ${getRestartTimeoutMs()}ms.`));
    }, getRestartTimeoutMs());

    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      reject(new Error(`Failed to run command '${command}': ${error.message}`));
    });

    child.on("close", (code) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);

      if (code === 0) {
        resolve(stdout.trim() || "Command completed successfully.");
        return;
      }

      const details = stderr.trim() || stdout.trim() || `Command exited with code ${code ?? "unknown"}.`;
      reject(new Error(`Command '${command}' failed: ${details}`));
    });
  });
}

function parseJsonObject(content: string, fileName: string) {
  try {
    const parsed = JSON.parse(content) as unknown;

    if (!isJsonObject(parsed)) {
      throw new Error(`${fileName} must contain a JSON object.`);
    }

    return parsed;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown JSON parse error.";
    throw new Error(`Failed to parse ${fileName}: ${message}`);
  }
}

function resolveOpenClawProvider(
  providers: Record<string, unknown> | undefined,
  configuredProviderKey: string,
) {
  if (!isJsonObject(providers)) {
    throw new Error("models.providers was not found in openclaw.json.");
  }

  const candidateKeys = Array.from(new Set([configuredProviderKey, "custom-goood-my", "custom-good-my"]));

  for (const key of candidateKeys) {
    const provider = providers[key];

    if (isJsonObject(provider)) {
      return { providerKey: key, provider };
    }
  }

  const availableKeys = Object.keys(providers);

  if (availableKeys.length === 1) {
    const providerKey = availableKeys[0]!;
    const provider = providers[providerKey];

    if (!isJsonObject(provider)) {
      throw new Error(`Provider '${providerKey}' in openclaw.json is not a JSON object.`);
    }

    return {
      providerKey,
      provider,
    };
  }

  throw new Error(
    `Provider '${configuredProviderKey}' was not found in openclaw.json. Available providers: ${availableKeys.join(", ") || "none"}.`,
  );
}

const codexAdapter: AppAdapter = {
  appType: "codex",
  getBackupRoot() {
    return getCodexPaths().backupsRoot;
  },
  getMutations(config) {
    const paths = getCodexPaths();

    return [
      {
        sourcePath: paths.configToml,
        transform(currentContent) {
          const parsed = TOML.parse(currentContent) as Record<string, unknown>;
          const providerName = typeof parsed.model_provider === "string" ? parsed.model_provider : null;
          const providers = parsed.model_providers as Record<string, Record<string, unknown>> | undefined;

          if (providerName && providers) {
            const providerConfig = providers[providerName] ?? {};
            providerConfig.base_url = config.url;
            providers[providerName] = providerConfig;
          } else {
            parsed.base_url = config.url;
          }

          return TOML.stringify(parsed as TOML.JsonMap);
        },
      },
      {
        sourcePath: paths.authJson,
        transform(currentContent) {
          const parsed = parseJsonObject(currentContent, "auth.json");
          parsed.OPENAI_API_KEY = config.apiKey;
          return `${JSON.stringify(parsed, null, 2)}\n`;
        },
      },
    ];
  },
  async runPostAction() {
    return "Codex configuration updated. No restart required.";
  },
};

const openClawAdapter: AppAdapter = {
  appType: "openclaw",
  getBackupRoot() {
    return getOpenClawPaths().backupsRoot;
  },
  getMutations(config) {
    const paths = getOpenClawPaths();
    const providerKey = getOpenClawProviderKey();

    return [
      {
        sourcePath: paths.configJson,
        transform(currentContent) {
          const parsed = parseJsonObject(currentContent, "openclaw.json") as {
            models?: {
              providers?: Record<string, unknown>;
            };
          };

          const { provider } = resolveOpenClawProvider(parsed.models?.providers, providerKey);

          provider.baseUrl = config.url;
          provider.apiKey = config.apiKey;

          return `${JSON.stringify(parsed, null, 2)}\n`;
        },
      },
    ];
  },
  async runPostAction(stage) {
    const output = await runShellCommand(getOpenClawRestartCommand());
    return `openclaw gateway restart succeeded after ${stage}. ${output}`.trim();
  },
};

export function getAppAdapter(appType: AppType) {
  return appType === "codex" ? codexAdapter : openClawAdapter;
}
