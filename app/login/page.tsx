import { redirect } from "next/navigation";

import LoginForm from "@/components/LoginForm";
import { getSession } from "@/lib/session";

const TEXT = {
  intro: "\u5355\u7ba1\u7406\u5458\u79c1\u6709\u540e\u53f0",
  title: "\u914d\u7f6e\u7ba1\u7406\u7f51\u7ad9",
  subtitle:
    "\u7edf\u4e00\u7ba1\u7406 codex \u4e0e openclaw \u7684 URL\u3001API Key\u3001\u542f\u7528\u72b6\u6001\u3001\u5907\u4efd\u548c\u8fd8\u539f\u6d41\u7a0b\u3002",
} as const;

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
          <p className="subtle">{TEXT.intro}</p>
          <h1 className="page-title">{TEXT.title}</h1>
          <p className="page-subtitle">{TEXT.subtitle}</p>
        </div>
        <LoginForm errorMessage={errorMessage} />
      </section>
    </main>
  );
}
