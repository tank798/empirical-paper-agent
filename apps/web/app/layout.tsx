import "./globals.css";
import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "经管实证论文 AI Agent",
  description: "一个面向经管实证论文场景的 Workflow + Skills 研究助手"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="bg-slate-50 text-slate-900 antialiased">
        <div className="mx-auto min-h-screen max-w-[1100px] px-4 py-4 sm:px-6 sm:py-5">
          <header className="mb-6 flex items-center">
            <nav className="flex items-center">
              <Link
                className="inline-flex h-10 items-center rounded-[12px] bg-slate-950 px-4 text-sm font-medium text-white transition hover:bg-slate-900"
                href="/projects"
              >
                项目库
              </Link>
            </nav>
          </header>

          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
