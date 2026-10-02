"use client";
import * as React from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/helpers";
import { PageEntrance } from "@/components/animation";

/** Which viewport edge the sidebar rail is docked to. */
type SidebarSide = "left" | "right";

/** Shared with the dynamic() skeletons so the placeholder lands on the same
 *  edge/width as the real rail instead of flashing left-240 on the first paint. */
const ShellLayout = React.createContext<{ side: SidebarSide; collapsed: boolean }>({
  side: "left",
  collapsed: false,
});

function RailSkeleton() {
  const { side, collapsed } = React.useContext(ShellLayout);
  return (
    <aside
      className={cn(
        "hidden lg:flex fixed top-0 z-40 h-screen bg-white dark:bg-[#0D0D0D] animate-pulse",
        side === "right" ? "right-0" : "left-0",
        collapsed ? "w-[72px]" : "w-[240px]"
      )}
    />
  );
}

function TopbarSkeleton() {
  const { side, collapsed } = React.useContext(ShellLayout);
  // Written literally (not interpolated) so Tailwind emits these classes.
  const offset =
    side === "right"
      ? collapsed ? "lg:right-[72px]" : "lg:right-[240px]"
      : collapsed ? "lg:left-[72px]" : "lg:left-[240px]";
  return (
    <header
      className={cn(
        "fixed top-0 z-30 h-14 sm:h-16 left-0 right-0 bg-white dark:bg-[#0D0D0D] animate-pulse",
        offset
      )}
    />
  );
}

const Sidebar = dynamic(() => import("./sidebar").then((m) => m.Sidebar), {
  ssr: false,
  loading: () => <RailSkeleton />,
});

const Topbar = dynamic(() => import("./topbar").then((m) => m.Topbar), {
  ssr: false,
  loading: () => <TopbarSkeleton />,
});

const SIDE_KEY = "ui.sidebarSide";
const COLLAPSE_KEY = "ui.sidebarCollapsed";

function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = React.useState(false);
  const [side, setSide] = React.useState<SidebarSide>("left");
  // Keying the entrance by pathname makes it run once per genuine page
  // mount — filters, modals and in-page data refreshes never replay it,
  // while navigating to another page gives a quiet fresh fade-in.
  const pathname = usePathname();
  // Below lg the sidebar is an off-canvas drawer driven by this flag; the
  // hamburger in the Topbar opens it and the scrim closes it.
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);

  // Hydrate the saved preferences after mount (reading localStorage during
  // render would mismatch the server HTML and warn).
  React.useEffect(() => {
    try {
      if (window.localStorage.getItem(SIDE_KEY) === "right") setSide("right");
      if (window.localStorage.getItem(COLLAPSE_KEY) === "1") setCollapsed(true);
    } catch {
      /* private mode / storage blocked — defaults are fine */
    }
  }, []);

  const toggleCollapsed = React.useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try { window.localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0"); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const flipSide = React.useCallback(() => {
    setSide((prev) => {
      const next: SidebarSide = prev === "left" ? "right" : "left";
      try { window.localStorage.setItem(SIDE_KEY, next); } catch { /* ignore */ }
      return next;
    });
  }, []);

  // Close the drawer automatically when the viewport grows back to desktop
  // so it can't be left open (and overlapping) on a resize.
  React.useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const onChange = () => { if (mq.matches) setMobileNavOpen(false); };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return (
    <ShellLayout.Provider value={{ side, collapsed }}>
      <div className="min-h-screen">
        <Sidebar
          collapsed={collapsed}
          onToggle={toggleCollapsed}
          mobileOpen={mobileNavOpen}
          onClose={() => setMobileNavOpen(false)}
          side={side}
          onFlipSide={flipSide}
        />
        <Topbar sidebarCollapsed={collapsed} side={side} onMenu={() => setMobileNavOpen((v) => !v)} />
        {mobileNavOpen && (
          <div
            onClick={() => setMobileNavOpen(false)}
            aria-hidden
            className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm lg:hidden"
          />
        )}
        <main className={cn(
          'transition-all duration-200 pt-14 sm:pt-16',
          'pl-0 pr-0',
          side === 'left'
            ? (collapsed ? 'lg:pl-[72px]' : 'lg:pl-[240px]')
            : (collapsed ? 'lg:pr-[72px]' : 'lg:pr-[240px]')
        )}>
          <PageEntrance key={pathname}>{children}</PageEntrance>
        </main>
      </div>
    </ShellLayout.Provider>
  );
}

export { AppShell };
