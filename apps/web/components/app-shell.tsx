"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AppMenu } from "./app-menu";

function isWorkspaceDetailPath(pathname: string) {
  return /^\/projects\/[^/]+$/.test(pathname);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const workspaceDetail = isWorkspaceDetailPath(pathname);
  const shellClassName = workspaceDetail
    ? "mx-auto min-h-screen max-w-[1760px] px-4 pb-0 pt-4 sm:px-6 sm:pt-5"
    : "mx-auto min-h-screen max-w-[1760px] px-4 py-4 sm:px-6 sm:py-5";

  return (
    <div className={shellClassName}>
      {!workspaceDetail ? (
        <header className="mb-6 flex items-center">
          <AppMenu />
        </header>
      ) : null}

      <main>{children}</main>
    </div>
  );
}
