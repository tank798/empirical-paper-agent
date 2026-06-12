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

  return (
    <div className="mx-auto min-h-screen max-w-[1760px] px-4 py-4 sm:px-6 sm:py-5">
      {!workspaceDetail ? (
        <header className="mb-6 flex items-center">
          <AppMenu />
        </header>
      ) : null}

      <main>{children}</main>
    </div>
  );
}
