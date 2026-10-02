import { HelpContent } from "@/components/help/help-content";

/**
 * Help & Support INSIDE the institution dashboard. Living under
 * /i/<institutionSlug>/ it inherits the layout's auth guard (anonymous →
 * /login; signed-in users must belong to this institution) and the AppShell
 * sidebar — so clicking "Help & Support" never leaves the dashboard.
 *
 * The signed-out variants of the form are unreachable here; the public
 * counterpart for anonymous visitors stays at /help.
 */
export default function InstitutionHelpPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#080808]">
      <div className="max-w-[1600px] mx-auto p-6 lg:p-8">
        <HelpContent />
      </div>
    </div>
  );
}
