"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Info, ListChecks, Lock } from "lucide-react";
import { MarksEntryPanel } from "@/components/marks/MarksEntryPanel";
import { useAuth } from "@/lib/auth/auth";
import { formatMultipleRollRangesLabel, formatRollRangeLabel } from "@/lib/marks/roll-range";
import { useInstitutionBySlug } from "@/lib/storage/institutions";
import { useLang } from "@/contexts/language-context";
import { useTheme } from "@/contexts/theme-context";

/**
 * Institution Mark Entry — blind marking, gated by super-admin permission.
 *
 * Access is controlled in two layers (mirroring `/i/[slug]/admit-cards`):
 *   1. `institutions.allow_mark_entry` (migration 0043) must be enabled by
 *      the super admin (off by default across all institutions);
 *   2. Optionally constrained to `mark_entry_roll_from`–`mark_entry_roll_to`,
 *      enforced both here and server-side in `get_marks_sheet_page`,
 *      `save_exam_marks`, and `clear_exam_mark`, alongside blind marking
 *      (excluding this institution's own students).
 */
export default function InstitutionMarksPage() {
  const params = useParams();
  const slug = params.institutionSlug as string;
  const { user, loading: authLoading } = useAuth();
  const { theme } = useTheme();
  const { lang } = useLang();
  const isDark = theme === "dark";
  const isBn = lang === "bn";
  const bi = (bn: string, en: string) => (isBn ? bn : en);
  const [mounted, setMounted] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const { data: inst, isLoading: instLoading } = useInstitutionBySlug(slug);
  const isSuper = user?.role === "SUPER_ADMIN";
  const loading = !mounted || authLoading || instLoading;

  // Block navigation while marks are still saving (mirrors the super-admin
  // Marks page guard).
  useEffect(() => {
    if (!mounted || !pending) return;
    const message = isBn
      ? "অসংরক্ষিত নম্বর আছে। এখনই পাতা ছাড়তে চান?"
      : "You have unsaved marks. Leave this page now?";
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const handleAppNavigation = (event: Event) => {
      if (!window.confirm(message)) event.preventDefault();
    };
    const handleLinkClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target instanceof Element
        ? (event.target.closest("a[href]") as HTMLAnchorElement | null)
        : null;
      if (!target || target.target === "_blank" || target.hasAttribute("download")) return;
      const url = new URL(target.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;
      if (!window.confirm(message)) event.preventDefault();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("app:before-navigation", handleAppNavigation);
    document.addEventListener("click", handleLinkClick, true);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("app:before-navigation", handleAppNavigation);
      document.removeEventListener("click", handleLinkClick, true);
    };
  }, [isBn, mounted, pending]);

  if (loading) {
    return (
      <div className={`min-h-screen ${isDark ? "bg-[#0a0a0b]" : "bg-zinc-50"} flex items-center justify-center`}>
        <div className={`h-8 w-8 animate-spin rounded-full border-2 ${isDark ? "border-white/15 border-t-white" : "border-zinc-200 border-t-zinc-900"}`} />
      </div>
    );
  }

  if (!inst) {
    return (
      <div className={`min-h-screen ${isDark ? "bg-[#0a0a0b]" : "bg-zinc-50"} flex items-center justify-center px-6`}>
        <p className={`text-sm ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
          {bi("প্রতিষ্ঠান পাওয়া যায়নি", "Institution not found")}
        </p>
      </div>
    );
  }

  // Permission not granted → matches server-side RPC enforcement cleanly.
  if (!isSuper && !inst.allowMarkEntry) {
    return (
      <div className={`min-h-screen ${isDark ? "bg-[#0a0a0b]" : "bg-zinc-50"}`}>
        <div className="mx-auto max-w-[1600px] p-6 lg:p-8">
          <div className="mb-8 flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-accent text-brand-accent-fg shadow-lg shadow-black/10">
              <ListChecks className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <h1 className={`text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-zinc-900"}`}>
                {bi("নম্বর প্রবেশ", "Mark Entry")}
              </h1>
            </div>
          </div>
          <div
            className={`flex flex-col items-center justify-center rounded-md border px-6 py-20 ${
              isDark
                ? "border-white/[0.06] bg-[#141416]"
                : "border-zinc-200 bg-white shadow-sm"
            }`}
          >
            <div
              className={`mb-4 flex h-14 w-14 items-center justify-center rounded-md ${
                isDark ? "bg-white/[0.08]" : "bg-zinc-100"
              }`}
            >
              <Lock className={`h-7 w-7 ${isDark ? "text-zinc-400" : "text-zinc-500"}`} />
            </div>
            <p className={`text-sm font-medium ${isDark ? "text-white" : "text-zinc-900"}`}>
              {bi(
                "নম্বর প্রবেশের অনুমতি নেই",
                "Mark entry is not permitted yet",
              )}
            </p>
            <p className={`mt-1.5 max-w-md text-center text-xs ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
              {bi(
                "সুপার অ্যাডমিন আপনার প্রতিষ্ঠানের জন্য নম্বর প্রবেশের অনুমতি ও রোল রেঞ্জ চালু করলে এখানে নির্ধারিত শিক্ষার্থীদের নম্বর দিতে পারবেন। অনুগ্রহ করে কর্তৃপক্ষের সাথে যোগাযোগ করুন।",
                "Once the super admin enables mark entry access and assigns a roll range for your institution, you will be able to enter marks here. Please contact the association.",
              )}
            </p>
            <div className={`mt-5 flex items-center gap-2 text-[11px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
              <ListChecks className="h-3.5 w-3.5" />
              {isBn ? inst.name : (inst.nameEn || inst.name)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const hasRange = Boolean(
    (inst.markEntryRollRanges && inst.markEntryRollRanges.length > 0) ||
      inst.markEntryRollFrom ||
      inst.markEntryRollTo,
  );
  const rangeLabel = formatMultipleRollRangesLabel(
    inst.markEntryRollRanges,
    inst.markEntryRollFrom,
    inst.markEntryRollTo,
    isBn,
  );

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0a0a0b]" : "bg-zinc-50"}`}>
      <div className="mx-auto max-w-[1600px] p-6 lg:p-8">
        <div className="mb-7 flex animate-fadeInDown items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-accent text-brand-accent-fg shadow-lg shadow-black/10">
            <ListChecks className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h1 className={`text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-zinc-900"}`}>
              {bi("নম্বর প্রবেশ", "Mark Entry")}
            </h1>
            <p className={`mt-1 max-w-2xl text-sm ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>
              {hasRange
                ? bi(
                    `নিজ প্রতিষ্ঠানের শিক্ষার্থী বাদ — আপনার প্রতিষ্ঠানের জন্য অনুমোদিত রোল রেঞ্জ (${rangeLabel})-এর মধ্যে থাকা শিক্ষার্থীদের নম্বর দিন।`,
                    `Your own students are excluded — enter marks for approved students within your permitted roll range (${rangeLabel}).`,
                  )
                : bi(
                    "নিজ প্রতিষ্ঠানের শিক্ষার্থী বাদ — অন্য প্রতিষ্ঠানের অনুমোদিত শিক্ষার্থীর নম্বর দিন। রোল রেঞ্জ দিয়ে ব্লক অনুযায়ী কাজ করুন।",
                    "Your own students are excluded — enter marks for approved students of other institutions. Use the roll range to work through a block of rolls.",
                  )}
            </p>
          </div>
        </div>

        {isSuper && !inst.allowMarkEntry && (
          <div className="mb-5 flex items-center gap-2.5 rounded-lg border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-xs text-amber-700 dark:text-amber-300">
            <Info className="h-4 w-4 shrink-0" />
            <span>
              {bi(
                "সুপার অ্যাডমিন প্রিভিউ — এই প্রতিষ্ঠানের জন্য নম্বর প্রবেশের অনুমতি বর্তমানে বন্ধ আছে।",
                "Super Admin preview — mark entry permission is currently restricted for this institution.",
              )}
            </span>
          </div>
        )}

        <MarksEntryPanel
          onPendingChange={setPending}
          scopedInstitutionId={inst.id}
          scopedInstitutionName={isBn ? inst.name : (inst.nameEn || inst.name)}
          allowedRollFrom={!isSuper ? inst.markEntryRollFrom : undefined}
          allowedRollTo={!isSuper ? inst.markEntryRollTo : undefined}
          allowedRollRanges={!isSuper ? inst.markEntryRollRanges : undefined}
        />
      </div>
    </div>
  );
}
