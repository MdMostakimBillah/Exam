"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/auth";
import { getInstitutionById } from "@/lib/storage/institutions";

export default function InstitutionRootPage() {
  const router = useRouter();
  useEffect(() => {
    const user = getCurrentUser();
    if (!user) { router.push('/login'); return; }
    if (user.role === 'SUPER_ADMIN') { router.push('/super-admin'); return; }
    if (user.institutionId) {
      const inst = getInstitutionById(user.institutionId);
      if (inst) { router.push(`/i/${inst.slug}`); return; }
    }
    router.push('/login');
  }, [router]);
  return <div className="min-h-screen bg-[#080808] flex items-center justify-center"><div className="h-6 w-32 skeleton rounded" /></div>;
}
