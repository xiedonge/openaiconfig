import Link from "next/link";

import ConfigManager from "@/components/ConfigManager";
import LogoutButton from "@/components/LogoutButton";
import { listConfigs } from "@/lib/services/configs";
import { requireSession } from "@/lib/session";

export default async function ConfigsPage() {
  const session = await requireSession();
  const configs = listConfigs();

  return (
    <main className="page-shell stack">
      <header className="page-header">
        <div>
          <p className="subtle">当前管理员：{session.username}</p>
          <h1 className="page-title">配置列表</h1>
          <p className="page-subtitle">支持新增、编辑、删除、启用配置，并将启用配置写回真实配置文件。</p>
        </div>
        <div className="page-actions">
          <nav className="nav-links">
            <Link className="nav-link nav-link-active" href="/configs">
              配置管理
            </Link>
            <Link className="nav-link" href="/backups">
              备份与还原
            </Link>
          </nav>
          <LogoutButton />
        </div>
      </header>
      <ConfigManager initialConfigs={configs} />
    </main>
  );
}
