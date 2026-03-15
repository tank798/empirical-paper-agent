import "./tailwind-bundle.css";
import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "经管实证论文 AI Agent",
  description: "一个面向经管实证论文场景的 Workflow + Skills 研究助手"
};

function BrandMark() {
  return (
    <div className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-[18px] bg-[linear-gradient(145deg,#0b1220_0%,#172033_58%,#4657ff_100%)] shadow-floating">
      <span className="absolute h-3.5 w-3.5 rounded-full bg-white/92" />
      <span className="absolute left-[8px] top-[8px] h-2.5 w-2.5 rounded-full bg-white/76" />
      <span className="absolute right-[8px] top-[8px] h-2.5 w-2.5 rounded-full bg-[#dff56d]" />
      <span className="absolute bottom-[8px] left-[8px] h-2.5 w-2.5 rounded-full bg-white/62" />
      <span className="absolute bottom-[8px] right-[8px] h-2.5 w-2.5 rounded-full bg-white/78" />
      <span className="absolute h-[1.5px] w-7 rotate-45 rounded-full bg-white/30" />
      <span className="absolute h-[1.5px] w-7 -rotate-45 rounded-full bg-white/22" />
      <span className="absolute h-[1.5px] w-6 rounded-full bg-white/18" />
    </div>
  );
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <div className="mx-auto min-h-screen max-w-[1500px] px-4 py-4 sm:px-6 lg:px-8">
          <header className="glass-panel surface-outline mb-6 flex items-center justify-between rounded-[28px] border border-white/70 px-5 py-4 shadow-card">
            <div className="flex items-center gap-4">
              <BrandMark />
              <div>
                <Link className="text-xl font-semibold tracking-wide text-ink" href="/">
                  经管实证论文 AI Agent
                </Link>
              </div>
            </div>

            <nav className="flex items-center gap-2 text-sm text-slate-700">
              <Link className="rounded-full px-4 py-2 transition hover:bg-white/70 hover:text-slate-950" href="/projects">
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
