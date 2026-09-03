"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { initializeDemoData } from "@/lib/storage/seed";
import { getCurrentUser } from "@/lib/auth/auth";
import { AppShell } from "@/components/layout/app-shell";
import { ToastProvider } from "@/components/ui/toast";

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    initializeDemoData();
    const user = getCurrentUser();
    if (!user) { router.push('/login'); return; }
    if (user.role !== 'SUPER_ADMIN') { router.push('/login'); return; }
    setReady(true);
  }, [router]);

  if (!ready) return (
    <div className="min-h-screen bg-[#080808] flex items-center justify-center">
      <div className="h-5 w-5 rounded-full border-2 border-zinc-600 border-t-white animate-spin" />
    </div>
  );

  return <ToastProvider><AppShell>{children}</AppShell></ToastProvider>;
}
