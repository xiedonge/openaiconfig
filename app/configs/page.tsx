import Link from "next/link";

import ConfigManager from "@/components/ConfigManager";
import LogoutButton from "@/components/LogoutButton";
import SystemUpdateButton from "@/components/SystemUpdateButton";
import { listConfigs } from "@/lib/services/configs";
import { requireSession } from "@/lib/session";

const TEXT = {
  currentAdmin: "\u5f53\u524d\u7ba1\u7406\u5458\uff1a",
  title: "\u914d\u7f6e\u5217\u8868",
  subtitle: "\u7edf\u4e00\u7ba1\u7406\u5171\u4eab\u914d\u7f6e\uff0c\u5e76\u5728\u542f\u7528\u65f6\u540c\u6b65\u5199\u5165 codex \u548c openclaw\u3002",
  configNav: "\u914d\u7f6e\u7ba1\u7406",
  backupNav: "\u5907\u4efd\u4e0e\u8fd8\u539f",
} as const;

export default async function ConfigsPage() {
  const session = await requireSession();
  const configs = listConfigs();

  return (
    <main className="page-shell stack">
      <header className="page-header">
        <div>
          <p className="subtle">
            {TEXT.currentAdmin}
            {session.username}
          </p>
          <h1 className="page-title">{TEXT.title}</h1>
          <p className="page-subtitle">{TEXT.subtitle}</p>
        </div>
        <div className="page-actions">
          <nav className="nav-links">
            <Link className="nav-link nav-link-active" href="/configs">
              {TEXT.configNav}
            </Link>
            <Link className="nav-link" href="/backups">
              {TEXT.backupNav}
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
