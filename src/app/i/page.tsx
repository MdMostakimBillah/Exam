"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth";
import { createClient } from "@/lib/supabase/client";

export default function InstitutionRootPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) { router.push('/login'); return; }
    if (user.role === 'SUPER_ADMIN') { router.push('/super-admin'); return; }
    if (user.institutionId) {
      const supabase = createClient();
      supabase.from('institutions').select('slug').eq('id', user.institutionId).single()
        .then(({ data, error }: { data: { slug: string } | null; error: any }) => {
          if (data && !error) {
            router.push(`/i/${data.slug}`);
          } else {
            router.push('/login');
          }
        });
      return;
    }
    router.push('/login');
  }, [router, user, loading]);

  return <div className="min-h-screen bg-[#080808] flex items-center justify-center"><div className="h-6 w-32 skeleton rounded" /></div>;
}
