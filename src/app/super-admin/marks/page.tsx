"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { BarChart3, BookOpen, ChevronRight, ListChecks, Settings2, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { MarksEntryPanel } from "@/components/marks/MarksEntryPanel";
import { MarksSetupPanel } from "@/components/marks/MarksSetupPanel";
import { Button } from "@/components/ui/button";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLang } from "@/contexts/language-context";
import { useTheme } from "@/contexts/theme-context";

type MarksTab = "setup" | "entry";

export default function MarksPage() {
  const { lang } = useLang();
  const { theme } = useTheme();
  const isBn = lang === "bn";
  const isDark = theme === "dark";
  const bi = (bn: string, en: string) => (isBn ? bn : en);
  const [activeTab, setActiveTab] = useState<MarksTab>("setup");
  const [pendingTab, setPendingTab] = useState<MarksTab | null>(null);
  const [setupDirty, setSetupDirty] = useState(false);
  const [marksPending, setMarksPending] = useState(false);
  const allowNextPopRef = useRef(false);
  const protectedState = setupDirty || marksPending;

  const requestTab = (nextTab: MarksTab) => {
    if (nextTab === activeTab) return;
    const activeTabProtected = activeTab === "setup" ? setupDirty : marksPending;
    if (activeTabProtected) {
      setPendingTab(nextTab);
      return;
    }
    setActiveTab(nextTab);
  };

  useEffect(() => {
    if (!protectedState) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const handleAppNavigation = (event: Event) => {
      const message = isBn
        ? "অসংরক্ষিত Grade Scale বা নম্বর আছে। এখনই পাতা ছাড়তে চান?"
        : "You have unsaved Grade Scale changes or pending marks. Leave this page now?";
      if (!window.confirm(message)) event.preventDefault();
    };
    const handleLinkClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target instanceof Element
        ? event.target.closest("a[href]") as HTMLAnchorElement | null
        : null;
      if (!target || target.target === "_blank" || target.hasAttribute("download")) return;
      const url = new URL(target.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;
      const message = isBn
        ? "অসংরক্ষিত Grade Scale বা নম্বর আছে। এখনই পাতা ছাড়তে চান?"
        : "You have unsaved Grade Scale changes or pending marks. Leave this page now?";
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
  }, [isBn, protectedState]);

  useEffect(() => {
    if (!protectedState) return;
    const handlePopState = () => {
      if (allowNextPopRef.current) {
        allowNextPopRef.current = false;
        return;
      }
      const message = isBn
        ? "অসংরক্ষিত Grade Scale বা নম্বর আছে। এখনই পাতা ছাড়তে চান?"
        : "You have unsaved Grade Scale changes or pending marks. Leave this page now?";
      const leave = window.confirm(message);
      allowNextPopRef.current = true;
      if (!leave) window.history.forward();
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [isBn, protectedState]);

  const steps: { icon: LucideIcon; label: string; tab?: MarksTab; href?: string }[] = [
    { icon: Settings2, label: bi("গ্রেড স্কেল", "Grade Scale"), tab: "setup" },
    { icon: ListChecks, label: bi("মার্ক এন্ট্রি", "Mark Entry"), tab: "entry" },
    { icon: BarChart3, label: bi("ফলাফল", "Results"), href: "/super-admin/results" },
  ];

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0a0a0b]" : "bg-zinc-50"}`}>
      <div className="mx-auto max-w-[1600px] p-6 lg:p-8">
        <div className="mb-7 flex animate-fadeInDown flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-accent text-brand-accent-fg shadow-lg shadow-black/10">
              <ListChecks className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <h1 className={`text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-zinc-900"}`}>
                {bi("মার্কস ব্যবস্থাপনা", "Marks Management")}
              </h1>
              <p className={`mt-1 max-w-2xl text-sm ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>
                {bi("পরীক্ষার গ্রেড স্কেল সেটআপ করুন এবং অনুমোদিত শিক্ষার্থীদের নম্বর দিন। ফলাফল প্রক্রিয়া Results পাতায় হয়।", "Configure the exam Grade Scale and enter approved student marks. Results are processed separately from the Results page.")}
              </p>
            </div>
          </div>

          <nav
            aria-label={bi("কাজের ধারা", "Workflow")}
            className={`hidden shrink-0 items-center gap-1 self-start rounded-xl border p-1 md:flex ${isDark ? "border-white/[0.06] bg-[#141416]" : "border-zinc-200 bg-white shadow-sm"}`}
          >
            {steps.map((step, index) => {
              const active = !!step.tab && step.tab === activeTab;
              const content = (
                <>
                  <step.icon className={`h-3.5 w-3.5 ${active ? "text-brand-accent" : ""}`} />
                  <span>{step.label}</span>
                </>
              );
              const cls = `flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium transition-colors ${
                active
                  ? "bg-brand-accent-soft text-brand-accent"
                  : isDark
                    ? "text-zinc-500 hover:bg-white/[0.05] hover:text-zinc-200"
                    : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
              }`;
              return (
                <Fragment key={step.label}>
                  {index > 0 && <ChevronRight className={`h-3 w-3 ${isDark ? "text-zinc-700" : "text-zinc-300"}`} />}
                  {step.href ? (
                    <Link href={step.href} className={cls}>{content}</Link>
                  ) : (
                    <button type="button" onClick={() => requestTab(step.tab as MarksTab)} className={cls}>{content}</button>
                  )}
                </Fragment>
              );
            })}
          </nav>
        </div>

        <Tabs defaultValue="setup" value={activeTab} onValueChange={(value) => requestTab(value as MarksTab)}>
          <TabsList className="overflow-x-auto">
            <TabsTrigger value="setup" className={activeTab === "setup" ? "font-semibold text-brand-accent" : undefined}>
              <Settings2 className="mr-1.5 h-4 w-4" /> {bi("গ্রেড স্কেল", "Grade Scale")}
            </TabsTrigger>
            <TabsTrigger value="entry" className={activeTab === "entry" ? "font-semibold text-brand-accent" : undefined}>
              <ListChecks className="mr-1.5 h-4 w-4" /> {bi("মার্ক এন্ট্রি", "Mark Entry")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="setup" keepMounted>
            <MarksSetupPanel onDirtyChange={setSetupDirty} />
          </TabsContent>
          <TabsContent value="entry" keepMounted>
            <MarksEntryPanel onPendingChange={setMarksPending} />
          </TabsContent>
        </Tabs>
      </div>

      <Modal
        open={!!pendingTab}
        onClose={() => setPendingTab(null)}
        title={bi("অসংরক্ষিত পরিবর্তন", "Unsaved changes")}
        description={bi("সক্রিয় ট্যাবের অসংরক্ষিত কাজ থাকলেও ট্যাব বদলানো যাবে। লুকানো ট্যাবের ড্রাফট একই জায়গায় থাকবে।", "You can switch tabs while the active tab has unsaved work. The hidden tab draft will remain in place.")}
        maxWidth="max-w-md"
      >
        <div className="flex items-center gap-3 rounded-md border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
          <BookOpen className="h-5 w-5 shrink-0" />
          <span>{marksPending ? bi("অপেক্ষমাণ নম্বর Grade Scale থেকে আলাদা রাখা হয়েছে।", "Pending marks stay separate from Grade Scale.") : bi("Grade Scale-এ পরিবর্তন সংরক্ষণ করা হয়নি।", "Grade Scale has unsaved edits.")}</span>
        </div>
        <ModalFooter>
          <Button type="button" variant="secondary" onClick={() => setPendingTab(null)}>{bi("থাকুন", "Stay")}</Button>
          <Button type="button" variant="destructive" onClick={() => {
            if (pendingTab) setActiveTab(pendingTab);
            setPendingTab(null);
          }}>{bi("ট্যাব বদলান", "Switch and keep")}</Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
