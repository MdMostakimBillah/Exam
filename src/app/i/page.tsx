"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth";
import { createClient } from "@/lib/supabase/client";
import { useTheme } from "@/contexts/theme-context";
import { useLang } from "@/contexts/language-context";
import { cn } from "@/lib/utils/helpers";
import { AlertCircle, RotateCw } from "lucide-react";

const LOOKUP_TIMEOUT_MS = 8000;

type LookupState = "loading" | "error" | "no-institution";

export default function InstitutionRootPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { theme } = useTheme();
  const { lang: language } = useLang();
  const isDark = theme === "dark";
  const isBn = language === "bn";

  const [state, setState] = useState<LookupState>("loading");
  const [attempt, setAttempt] = useState(0);
  const redirectedRef = useRef(false);

  const resolveInstitutionSlug = useCallback(async (): Promise<string | null> => {
    const supabase = createClient();

    // Primary: look up by the profile's linked institution.
    if (user?.institutionId) {
      const { data, error } = await supabase
        .from("institutions")
        .select("slug")
        .eq("id", user.institutionId)
        .single();
      if (data && !error && data.slug) return data.slug as string;
    }

    // Fallback: find the institution whose admin is this user.
    const { data, error } = await supabase
      .from("institutions")
      .select("slug")
      .eq("admin_user_id", user!.id)
      .maybeSingle();
    if (data && !error && data.slug) return data.slug as string;

    return null;
  }, [user]);

  useEffect(() => {
    if (loading) return;
    if (!user) { router.push("/login"); return; }
    if (user.role === "SUPER_ADMIN") { router.push("/super-admin"); return; }

    let cancelled = false;
    setState("loading");

    // Bound the lookup so a slow/failed request never shows an infinite skeleton.
    const timer = setTimeout(() => {
      if (!cancelled) setState("error");
    }, LOOKUP_TIMEOUT_MS);

    resolveInstitutionSlug()
      .then((slug) => {
        if (cancelled) return;
        clearTimeout(timer);
        if (slug) {
          redirectedRef.current = true;
          // Navigate regardless of status — the layout renders the proper
          // "Not Active" screen for PENDING/SUSPENDED institutions.
          router.push(`/i/${slug}`);
        } else {
          setState("no-institution");
        }
      })
      .catch(() => {
        if (!cancelled) {
          clearTimeout(timer);
          setState("error");
        }
      });

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [router, user, loading, resolveInstitutionSlug, attempt]);

  const retry = () => setAttempt((n) => n + 1);

  if (state === "loading" || redirectedRef.current) {
    return (
      <div className="min-h-screen bg-[#080808] flex items-center justify-center">
        <div className="h-6 w-32 skeleton rounded" />
      </div>
    );
  }

  const title =
    state === "no-institution"
      ? isBn
        ? "কোনো প্রতিষ্ঠান পাওয়া যায়নি"
        : "No Institution Found"
      : isBn
      ? "প্রতিষ্ঠান লোড করা যায়নি"
      : "Couldn't Load Institution";

  const description =
    state === "no-institution"
      ? isBn
        ? "আপনার অ্যাকাউন্ট কোনো প্রতিষ্ঠানের সাথে যুক্ত নয়। অনুগ্রহ করে সুপার অ্যাডমিনের সাথে যোগাযোগ করুন।"
        : "Your account is not linked to any institution. Please contact the super admin."
      : isBn
      ? "সার্ভার থেকে প্রতিষ্ঠানের তথ্য আনা যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।"
      : "We couldn't fetch your institution details. Please try again.";

  return (
    <div className="min-h-screen bg-[#080808] flex items-center justify-center p-6">
      <div
        className={cn(
          "max-w-md w-full text-center p-8 rounded-md",
          isDark ? "bg-[#141416] border border-white/[0.06]" : "bg-white border border-zinc-200 shadow-sm"
        )}
      >
        <div
          className={cn(
            "h-14 w-14 rounded-full flex items-center justify-center mx-auto mb-4",
            isDark ? "bg-amber-500/10" : "bg-amber-50"
          )}
        >
          <AlertCircle className="h-7 w-7 text-amber-500" />
        </div>
        <h2 className={cn("text-lg font-bold mb-2", isDark ? "text-white" : "text-zinc-900")}>
          {title}
        </h2>
        <p className={cn("text-sm mb-6", isDark ? "text-zinc-400" : "text-zinc-600")}>
          {description}
        </p>
        <div className="flex items-center justify-center gap-3">
          {state === "error" && (
            <button
              onClick={retry}
              className={cn(
                "inline-flex items-center gap-2 px-5 py-2.5 rounded-md text-sm font-medium transition-all",
                "bg-brand-accent text-brand-accent-fg hover:opacity-90"
              )}
            >
              <RotateCw className="h-4 w-4" />
              {isBn ? "আবার চেষ্টা করুন" : "Retry"}
            </button>
          )}
          <button
            onClick={() => router.push("/login")}
            className={cn(
              "px-5 py-2.5 rounded-md text-sm font-medium transition-all border",
              isDark ? "border-white/[0.08] text-zinc-300 hover:bg-white/[0.04]" : "border-zinc-200 text-zinc-700 hover:bg-zinc-50"
            )}
          >
            {isBn ? "লগআউট" : "Logout"}
          </button>
        </div>
      </div>
    </div>
  );
}
