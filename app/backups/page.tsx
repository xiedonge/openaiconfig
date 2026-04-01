import Link from "next/link";

import BackupManager from "@/components/BackupManager";
import LogoutButton from "@/components/LogoutButton";
import SystemUpdateButton from "@/components/SystemUpdateButton";
import { listBackups } from "@/lib/services/backups";
import { requireSession } from "@/lib/session";

export default async function BackupsPage() {
  await requireSession();
  const backups = listBackups();

  return (
    <main className="page-shell stack">
      <header className="page-header">
        <div>
          <p className="subtle">所有会修改真实配置文件的动作都会自动生成备份。</p>
          <h1 className="page-title">备份与还原</h1>
          <p className="page-subtitle">查看备份文件、按应用筛选，并在需要时执行还原。</p>
        </div>
        <div className="page-actions">
          <nav className="nav-links">
            <Link className="nav-link" href="/configs">
              配置管理
            </Link>
            <Link className="nav-link nav-link-active" href="/backups">
              备份与还原
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
