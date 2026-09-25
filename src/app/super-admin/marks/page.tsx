"use client";

import { useEffect, useRef, useState } from "react";
import { BookOpen, ListChecks, Settings2 } from "lucide-react";
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
        ? "অসংরক্ষিত মার্ক সেটআপ বা নম্বর আছে। এখনই পাতা ছাড়তে চান?"
        : "You have unsaved mark setup or pending marks. Leave this page now?";
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
        ? "অসংরক্ষিত মার্ক সেটআপ বা নম্বর আছে। এখনই পাতা ছাড়তে চান?"
        : "You have unsaved mark setup or pending marks. Leave this page now?";
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
        ? "অসংরক্ষিত মার্ক সেটআপ বা নম্বর আছে। এখনই পাতা ছাড়তে চান?"
        : "You have unsaved mark setup or pending marks. Leave this page now?";
      const leave = window.confirm(message);
      allowNextPopRef.current = true;
      if (!leave) window.history.forward();
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [isBn, protectedState]);

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0a0a0b]" : "bg-zinc-50"}`}>
      <div className="mx-auto max-w-[1600px] p-6 lg:p-8">
        <div className="mb-7">
          <h1 className={`text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-zinc-900"}`}>
            {bi("মার্কস ব্যবস্থাপনা", "Marks Management")}
          </h1>
          <p className={`mt-1 text-sm ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>
            {bi("পরীক্ষার নিয়ম সেটআপ করুন এবং অনুমোদিত শিক্ষার্থীদের নম্বর দিন। ফলাফল প্রক্রিয়া Results পাতায় হয়।", "Configure exam marks rules and enter approved student marks. Results are processed separately from the Results page.")}
          </p>
        </div>

        <Tabs defaultValue="setup" value={activeTab} onValueChange={(value) => requestTab(value as MarksTab)}>
          <TabsList className="overflow-x-auto">
            <TabsTrigger value="setup">
              <Settings2 className="mr-1.5 h-4 w-4" /> {bi("মার্ক সেটআপ", "Mark Setup")}
            </TabsTrigger>
            <TabsTrigger value="entry">
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
          <span>{marksPending ? bi("অপেক্ষমাণ নম্বর সেটআপের সাথে আলাদা রাখা হয়েছে।", "Pending marks stay separate from the setup tab.") : bi("সেটআপে পরিবর্তন সংরক্ষণ করা হয়নি।", "The setup has unsaved edits.")}</span>
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
