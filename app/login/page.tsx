import { redirect } from "next/navigation";

import LoginForm from "@/components/LoginForm";
import { getSession } from "@/lib/session";

interface LoginPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

function readSingleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await getSession();

  if (session) {
    redirect("/configs");
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const errorMessage = readSingleValue(resolvedSearchParams?.error);

  return (
    <main className="login-shell">
      <section className="card login-card split-card">
        <div>
          <p className="subtle">单管理员私有后台</p>
          <h1 className="page-title">配置管理网站</h1>
          <p className="page-subtitle">
            统一管理 codex 与 openclaw 的 URL、API Key、启用状态、备份和还原流程。
          </p>
        </div>
        <LoginForm errorMessage={errorMessage} />
      </section>
    </main>
  );
}
