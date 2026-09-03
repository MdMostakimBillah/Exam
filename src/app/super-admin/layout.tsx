"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { initializeDemoData } from "@/lib/storage/seed";
import { getCurrentUser } from "@/lib/auth/auth";
import { AppShell } from "@/components/layout/app-shell";
import { ToastProvider } from "@/components/ui/toast";
import { useTheme } from "@/contexts/theme-context";

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [ready, setReady] = useState(false);

  useEffect(() => {
    initializeDemoData();
    const user = getCurrentUser();
    if (!user) { router.push('/login'); return; }
    if (user.role !== 'SUPER_ADMIN') { router.push('/login'); return; }
    setReady(true);
  }, [router]);

  if (!ready) return (
    <div className={`min-h-screen ${isDark ? 'bg-[#080808]' : 'bg-zinc-50'} flex items-center justify-center`}>
      <div className={`h-5 w-5 rounded-full border-2 ${isDark ? 'border-zinc-600 border-t-white' : 'border-zinc-300 border-t-zinc-700'} animate-spin`} />
    </div>
  );

  return <ToastProvider><AppShell>{children}</AppShell></ToastProvider>;
}
