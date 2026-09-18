"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/lib/auth/auth";
import { createClient } from "@/lib/supabase/client";
import { AppShell } from "@/components/layout/app-shell";
import { useTheme } from "@/contexts/theme-context";
import { useLang } from "@/contexts/language-context";
import { cn } from "@/lib/utils/helpers";
import { AlertCircle } from "lucide-react";

export default function InstitutionLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const params = useParams();
  const slug = params.institutionSlug as string;
  const { user, loading } = useAuth();
  const { theme } = useTheme();
  const { lang: language } = useLang();
  const isDark = theme === "dark";
  const isBn = language === "bn";
  const [authorized, setAuthorized] = useState(false);
  const [instStatus, setInstStatus] = useState<string | null>(null);
  const redirectTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
      redirectTimerRef.current = setTimeout(() => router.push('/login'), 500);
      return;
    }
    if (redirectTimerRef.current) { clearTimeout(redirectTimerRef.current); redirectTimerRef.current = null; }
    if (user.role === 'SUPER_ADMIN') { setAuthorized(true); return; }
    if (!user.institutionId) { router.push('/login'); return; }

    const supabase = createClient();
    supabase.from('institutions').select('id, status').eq('slug', slug).eq('id', user.institutionId).single()
      .then(({ data, error }) => {
        if (data && !error) {
          setInstStatus(data.status);
          setAuthorized(true);
        } else {
          router.push('/login');
        }
      });
  }, [slug, user, loading]);

  if (loading || !authorized) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="h-6 w-32 skeleton rounded" />
    </div>
  );

  if (instStatus && instStatus !== 'ACTIVE') {
    return (
      <AppShell>
        <div className={`min-h-screen ${isDark ? "bg-[#0a0a0b]" : "bg-zinc-50"} flex items-center justify-center p-6`}>
          <div className={cn(
            "max-w-md w-full text-center p-8 rounded-md",
            isDark ? "bg-[#141416] border border-white/[0.06]" : "bg-white border border-zinc-200 shadow-sm"
          )}>
            <div className={cn(
              "h-14 w-14 rounded-full flex items-center justify-center mx-auto mb-4",
              isDark ? "bg-amber-500/10" : "bg-amber-50"
            )}>
              <AlertCircle className="h-7 w-7 text-amber-500" />
            </div>
            <h2 className={`text-lg font-bold mb-2 ${isDark ? "text-white" : "text-zinc-900"}`}>
              {isBn ? "প্রতিষ্ঠান সক্রিয় হয়নি" : "Institution Not Active"}
            </h2>
            <p className={`text-sm mb-4 ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
              {isBn
                ? `আপনার প্রতিষ্ঠানের স্থিতি: ${instStatus === 'PENDING' ? 'মুলতুবি' : instStatus === 'SUSPENDED' ? 'বন্ধ' : 'প্রত্যাখ্যাত'}। অনুগ্রহ করে সুপার অ্যাডমিনের সাথে যোগাযোগ করুন।`
                : `Your institution status: ${instStatus}. Please contact the super admin for activation.`}
            </p>
            <button
              onClick={() => router.push('/login')}
              className={cn(
                "px-6 py-2.5 rounded-md text-sm font-medium transition-all",
                isDark ? "bg-white text-black hover:bg-white/90" : "bg-zinc-900 text-white hover:bg-zinc-800"
              )}
            >
              {isBn ? "লগআউট" : "Logout"}
            </button>
          </div>
        </div>
      </AppShell>
    );
  }

  return <AppShell>{children}</AppShell>;
}
