"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { initializeDemoData } from "@/lib/storage/seed";
import { getCurrentUser } from "@/lib/auth/auth";
import { getInstitutionBySlug } from "@/lib/storage/institutions";
import { AppShell } from "@/components/layout/app-shell";

export default function InstitutionLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const params = useParams();
  const slug = params.institutionSlug as string;
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    initializeDemoData();
    const user = getCurrentUser();
    if (!user) { router.push('/login'); return; }
    if (user.role === 'SUPER_ADMIN') { router.push('/super-admin'); return; }
    const inst = getInstitutionBySlug(slug);
    if (!inst) { router.push('/login'); return; }
    if (user.institutionId !== inst.id) { router.push('/login'); return; }
    setAuthorized(true);
  }, [slug, router]);

  if (!authorized) return <div className="min-h-screen bg-zinc-950 flex items-center justify-center"><div className="h-6 w-32 skeleton rounded" /></div>;

  return <AppShell>{children}</AppShell>;
}
