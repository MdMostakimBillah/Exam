"use client";
import * as React from "react";
import { cn } from "@/lib/utils/helpers";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = React.useState(false);

  return (
    <div className="min-h-screen">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      <Topbar sidebarCollapsed={collapsed} />
      <main className={cn(
        'transition-all duration-200 pt-16',
        'pl-[240px]'
      )}>
        <div>{children}</div>
      </main>
    </div>
  );
}

export { AppShell };
