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
          <p className="subtle">???????????????????????</p>
          <h1 className="page-title">?????</h1>
          <p className="page-subtitle">???????????????????????</p>
        </div>
        <div className="page-actions">
          <nav className="nav-links">
            <Link className="nav-link" href="/configs">
              ????
            </Link>
            <Link className="nav-link nav-link-active" href="/backups">
              ?????
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
