export type AppType = "codex" | "openclaw";
export type BackupScope = AppType | "shared";

export type ApplyStatus = "never" | "success" | "failed";

export type TriggerType = "activate" | "restore";

export type SystemUpdateState = "idle" | "running" | "success" | "failed";

export interface ConfigRecord {
  id: number;
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
  scope: BackupScope;
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

export interface SystemUpdateStatus {
  state: SystemUpdateState;
  message: string;
  startedAt: string | null;
  finishedAt: string | null;
  fromCommit: string | null;
  toCommit: string | null;
  updatedAt: string | null;
}
