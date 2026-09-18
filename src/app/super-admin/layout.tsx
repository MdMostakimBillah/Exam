"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth";
import { AppShell } from "@/components/layout/app-shell";
import { useTheme } from "@/contexts/theme-context";

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const { user, loading } = useAuth();
  const redirectTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
      redirectTimerRef.current = setTimeout(() => router.push('/login'), 500);
      return;
    }
    if (redirectTimerRef.current) { clearTimeout(redirectTimerRef.current); redirectTimerRef.current = null; }
    if (user.role !== 'SUPER_ADMIN') { router.push('/login'); }
  }, [user, loading]);

  if (loading) return (
    <div className={`min-h-screen ${isDark ? 'bg-[#080808]' : 'bg-zinc-50'} flex items-center justify-center`}>
      <div className={`h-5 w-5 rounded-full border-2 ${isDark ? 'border-zinc-600 border-t-white' : 'border-zinc-300 border-t-zinc-700'} animate-spin`} />
    </div>
  );

  if (!user || user.role !== 'SUPER_ADMIN') return null;

  return <AppShell>{children}</AppShell>;
}
