import Link from "next/link";

import ConfigManager from "@/components/ConfigManager";
import LogoutButton from "@/components/LogoutButton";
import SystemUpdateButton from "@/components/SystemUpdateButton";
import { listConfigs } from "@/lib/services/configs";
import { requireSession } from "@/lib/session";

export default async function ConfigsPage() {
  const session = await requireSession();
  const configs = listConfigs();

  return (
    <main className="page-shell stack">
      <header className="page-header">
        <div>
          <p className="subtle">??????{session.username}</p>
          <h1 className="page-title">????</h1>
          <p className="page-subtitle">???????????????????????????????</p>
        </div>
        <div className="page-actions">
          <nav className="nav-links">
            <Link className="nav-link nav-link-active" href="/configs">
              ????
            </Link>
            <Link className="nav-link" href="/backups">
              ?????
            </Link>
          </nav>
          <SystemUpdateButton />
          <LogoutButton />
        </div>
      </header>
      <ConfigManager initialConfigs={configs} />
    </main>
  );
}
