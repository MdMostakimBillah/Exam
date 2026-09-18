"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/lib/auth/auth";
import { createClient } from "@/lib/supabase/client";
import { AppShell } from "@/components/layout/app-shell";

export default function InstitutionLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const params = useParams();
  const slug = params.institutionSlug as string;
  const { user, loading } = useAuth();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) { router.push('/login'); return; }
    if (user.role === 'SUPER_ADMIN') { setAuthorized(true); return; }
    if (!user.institutionId) { router.push('/login'); return; }

    const supabase = createClient();
    supabase.from('institutions').select('id').eq('slug', slug).eq('id', user.institutionId).single()
      .then(({ data, error }) => {
        if (data && !error) {
          setAuthorized(true);
        } else {
          router.push('/login');
        }
      });
  }, [slug, router, user, loading]);

  if (loading || !authorized) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="h-6 w-32 skeleton rounded" />
    </div>
  );

  return <AppShell>{children}</AppShell>;
}
