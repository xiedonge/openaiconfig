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

function getRestartTimeoutMs() {
  const parsed = Number.parseInt(process.env.OPENCLAW_RESTART_TIMEOUT_MS ?? "30000", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 30000;
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
      reject(new Error(`Command timed out after ${getRestartTimeoutMs()}ms.`));
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
      reject(error);
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

      reject(new Error(stderr.trim() || stdout.trim() || `Command exited with code ${code ?? "unknown"}.`));
    });
  });
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
          parsed.base_url = config.url;
          return TOML.stringify(parsed as TOML.JsonMap);
        },
      },
      {
        sourcePath: paths.authJson,
        transform(currentContent) {
          const parsed = JSON.parse(currentContent) as Record<string, unknown>;
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
          const parsed = JSON.parse(currentContent) as {
            models?: {
              providers?: Record<string, { baseUrl?: string; apiKey?: string }>;
            };
          };

          const provider = parsed.models?.providers?.[providerKey];

          if (!provider) {
            throw new Error(`Provider '${providerKey}' was not found in openclaw.json.`);
          }

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
