"use client";
import * as React from "react";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils/helpers";

const Sidebar = dynamic(() => import("./sidebar").then((m) => m.Sidebar), {
  ssr: false,
  loading: () => (
    <aside className="hidden lg:flex fixed left-0 top-0 z-40 h-screen w-[240px] bg-[#0D0D0D] animate-pulse" />
  ),
});

const Topbar = dynamic(() => import("./topbar").then((m) => m.Topbar), {
  ssr: false,
  loading: () => (
    <header className="fixed top-0 right-0 z-30 h-14 sm:h-16 left-0 lg:left-[240px] bg-[#0D0D0D] animate-pulse" />
  ),
});

function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = React.useState(false);
  // Below lg the sidebar is an off-canvas drawer driven by this flag; the
  // hamburger in the Topbar opens it and the scrim closes it.
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);

  // Close the drawer automatically when the viewport grows back to desktop
  // so it can't be left open (and overlapping) on a resize.
  React.useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const onChange = () => { if (mq.matches) setMobileNavOpen(false); };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return (
    <div className="min-h-screen">
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
        mobileOpen={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
      />
      <Topbar sidebarCollapsed={collapsed} onMenu={() => setMobileNavOpen((v) => !v)} />
      {mobileNavOpen && (
        <div
          onClick={() => setMobileNavOpen(false)}
          aria-hidden
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm lg:hidden"
        />
      )}
      <main className={cn(
        'transition-all duration-200 pt-14 sm:pt-16',
        collapsed ? 'lg:pl-[72px]' : 'lg:pl-[240px]',
        'pl-0'
      )}>
        <div>{children}</div>
      </main>
    </div>
  );
}

export { AppShell };
