"use client";
import * as React from "react";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils/helpers";

const Sidebar = dynamic(() => import("./sidebar").then((m) => m.Sidebar), {
  ssr: false,
  loading: () => (
    <aside className="fixed left-0 top-0 z-40 h-screen w-[240px] bg-[#0D0D0D] animate-pulse" />
  ),
});

const Topbar = dynamic(() => import("./topbar").then((m) => m.Topbar), {
  ssr: false,
  loading: () => (
    <header className="fixed top-0 right-0 z-30 h-16 left-[240px] bg-white/5 animate-pulse" />
  ),
});

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
