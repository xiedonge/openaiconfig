"use client";

import { useState } from "react";

export default function LogoutButton() {
  const [submitting, setSubmitting] = useState(false);

  async function handleLogout() {
    setSubmitting(true);

    try {
      await fetch("/api/auth/logout", {
        method: "POST",
      });
    } finally {
      window.location.href = "/login";
    }
  }

  return (
    <button className="button button-ghost" disabled={submitting} onClick={handleLogout} type="button">
      {submitting ? "退出中..." : "退出登录"}
    </button>
  );
}
