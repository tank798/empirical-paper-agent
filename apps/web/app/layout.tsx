import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppShell } from "../components/app-shell";

export const metadata: Metadata = {
  title: "经管实证论文 AI Agent",
  description: "一个面向经管实证论文场景的 Workflow + Skills 研究助手"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="bg-slate-50 text-slate-900 antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
