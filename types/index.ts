export type AppType = "codex" | "openclaw";

export type ApplyStatus = "never" | "success" | "failed";

export type TriggerType = "activate" | "restore";

export interface ConfigRecord {
  id: number;
  appType: AppType;
  name: string;
  url: string;
  apiKey: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastAppliedAt: string | null;
  lastApplyStatus: ApplyStatus;
  lastApplyMessage: string | null;
}

export interface BackupFileRecord {
  id: number;
  backupSetId: number;
  sourcePath: string;
  backupPath: string;
  fileName: string;
  createdAt: string;
}

export interface BackupSetRecord {
  id: number;
  appType: AppType;
  triggerType: TriggerType;
  relatedConfigId: number | null;
  createdAt: string;
  lastRestoreAt: string | null;
  lastRestoreStatus: ApplyStatus;
  lastRestoreMessage: string | null;
  postActionStatus: ApplyStatus;
  postActionMessage: string | null;
  relatedConfigName: string | null;
  files: BackupFileRecord[];
}

export interface SessionUser {
  username: string;
  expiresAt: number;
}
