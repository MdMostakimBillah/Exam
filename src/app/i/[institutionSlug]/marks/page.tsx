"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ListChecks } from "lucide-react";
import { MarksEntryPanel } from "@/components/marks/MarksEntryPanel";
import { useInstitutionBySlug } from "@/lib/storage/institutions";
import { useLang } from "@/contexts/language-context";
import { useTheme } from "@/contexts/theme-context";

/**
 * Institution Mark Entry.
 *
 * The sheet is pinned to this institution (scopedInstitutionId), so the
 * institution filter is hidden and the RPC ignores any other institution id.
 * Grade Scale setup and Results processing stay on the super-admin Marks page.
 */
export default function InstitutionMarksPage() {
  const params = useParams();
  const slug = params.institutionSlug as string;
  const { theme } = useTheme();
  const { lang } = useLang();
  const isDark = theme === "dark";
  const isBn = lang === "bn";
  const [mounted, setMounted] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const { data: inst } = useInstitutionBySlug(slug);

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

  if (!mounted) return null;
  if (!inst) return null;

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0a0a0b]" : "bg-zinc-50"}`}>
      <div className="mx-auto max-w-[1600px] p-6 lg:p-8">
        <div className="mb-7 flex animate-fadeInDown items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-accent text-brand-accent-fg shadow-lg shadow-black/10">
            <ListChecks className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h1 className={`text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-zinc-900"}`}>
              {isBn ? "নম্বর প্রবেশ" : "Mark Entry"}
            </h1>
            <p className={`mt-1 max-w-2xl text-sm ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>
              {isBn
                ? `${inst.name} এর অনুমোদিত শিক্ষার্থীদের নম্বর দিন। রোল রেঞ্জ দিয়ে ব্লক অনুযায়ী কাজ করুন।`
                : `Enter marks for approved students of ${inst.name}. Use the roll range to work through a block of rolls.`}
            </p>
          </div>
        </div>

        <MarksEntryPanel
          onPendingChange={setPending}
          scopedInstitutionId={inst.id}
          scopedInstitutionName={inst.name}
        />
      </div>
    </div>
  );
}
