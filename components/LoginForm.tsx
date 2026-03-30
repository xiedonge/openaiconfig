"use client";

import { FormEvent, useState } from "react";

export default function LoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "登录失败。");
      }

      window.location.href = "/configs";
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "登录失败。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="form-grid" onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="username">用户名</label>
        <input id="username" className="input" value={username} onChange={(event) => setUsername(event.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="password">密码</label>
        <input
          id="password"
          className="input"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>
      {error ? <div className="notice notice-error">{error}</div> : null}
      <button className="button button-primary" disabled={submitting} type="submit">
        {submitting ? "登录中..." : "登录"}
      </button>
    </form>
  );
}
