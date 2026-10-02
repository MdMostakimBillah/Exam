"use client";
import { PublicNav } from "@/components/layout/public-nav";
import { PageEntrance } from "@/components/animation";
import { HelpContent } from "@/components/help/help-content";

/**
 * Public Help & Support route — chrome only. The body lives in
 * src/components/help/help-content.tsx and is shared with the authenticated
 * dashboard route /i/<slug>/help.
 */
export default function HelpPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#080808]">
      <PublicNav />

      <main className="pt-10 sm:pt-14 pb-20 px-6">
        <PageEntrance>
          <HelpContent />
        </PageEntrance>
      </main>

      <footer className="border-t border-gray-200 dark:border-white/[0.06] py-8 px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-accent text-brand-accent-fg font-bold text-xs">S</div>
            <span className="text-sm font-semibold text-gray-700 dark:text-zinc-300">ScholarX</span>
          </div>
          <p className="text-xs text-gray-400 dark:text-zinc-700">© 2026 ScholarX. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
