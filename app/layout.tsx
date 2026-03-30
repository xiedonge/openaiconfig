import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "配置管理后台",
  description: "用于管理 codex 与 openclaw 的私有配置后台。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <div className="app-shell">{children}</div>
      </body>
    </html>
  );
}
