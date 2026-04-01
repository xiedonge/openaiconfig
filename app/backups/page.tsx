import Link from "next/link";

import BackupManager from "@/components/BackupManager";
import LogoutButton from "@/components/LogoutButton";
import SystemUpdateButton from "@/components/SystemUpdateButton";
import { listBackups } from "@/lib/services/backups";
import { requireSession } from "@/lib/session";

const TEXT = {
  intro: "\u6240\u6709\u4f1a\u4fee\u6539\u771f\u5b9e\u914d\u7f6e\u6587\u4ef6\u7684\u52a8\u4f5c\uff0c\u90fd\u4f1a\u5148\u81ea\u52a8\u751f\u6210\u5907\u4efd\u3002",
  title: "\u5907\u4efd\u4e0e\u8fd8\u539f",
  subtitle: "\u67e5\u770b\u5171\u4eab\u5907\u4efd\u4e0e\u5386\u53f2\u5355\u5e94\u7528\u5907\u4efd\uff0c\u5e76\u5728\u9700\u8981\u65f6\u6267\u884c\u8fd8\u539f\u3002",
  configNav: "\u914d\u7f6e\u7ba1\u7406",
  backupNav: "\u5907\u4efd\u4e0e\u8fd8\u539f",
} as const;

export default async function BackupsPage() {
  await requireSession();
  const backups = listBackups();

  return (
    <main className="page-shell stack">
      <header className="page-header">
        <div>
          <p className="subtle">{TEXT.intro}</p>
          <h1 className="page-title">{TEXT.title}</h1>
          <p className="page-subtitle">{TEXT.subtitle}</p>
        </div>
        <div className="page-actions">
          <nav className="nav-links">
            <Link className="nav-link" href="/configs">
              {TEXT.configNav}
            </Link>
            <Link className="nav-link nav-link-active" href="/backups">
              {TEXT.backupNav}
            </Link>
          </nav>
          <SystemUpdateButton />
          <LogoutButton />
        </div>
      </header>
      <BackupManager initialBackups={backups} />
    </main>
  );
}
