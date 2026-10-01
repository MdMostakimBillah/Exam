"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { lookupPublicMarksheet, type MarksheetData } from "@/lib/auth/public-lookup";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MarksheetSheet } from "@/components/marksheet/marksheet-sheet";
import {
  downloadMarksheetPdf,
  openMarksheetPrintWindow,
  printMarksheet,
} from "@/lib/pdf/marksheet-pdf";
import { Search, Download, Printer, Loader2, SearchX, ScrollText, Globe, Moon, Sun } from "lucide-react";
import { useTheme } from "@/contexts/theme-context";
import { useLang } from "@/contexts/language-context";
import { useBranding, BRANDING_DEFAULTS } from "@/lib/storage/branding";

/** Same shape as the server-side validators (mirrored here for live feedback). */
const SAFE_KEY = /^[A-Za-z0-9][A-Za-z0-9 _\-/:.]{2,39}$/;
const SAFE_DATE = /^\d{4}-\d{2}-\d{2}$/;
const SAFE_ROLL = /^\d{1,6}$/;

/**
 * Public marksheet lookup — roll + registration number + date of birth →
 * the A4 academic transcript (only after the super admin generated it,
 * 0040), downloadable as PDF or printable.
 */
export default function MarksheetPage() {
  const { theme, toggleTheme } = useTheme();
  const { t, lang, setLang } = useLang();
  const isDark = theme === "dark";
  const L = useCallback((en: string, bn: string) => (lang === "bn" ? bn : en), [lang]);

  const { data: brandData } = useBranding();
  const b = { ...BRANDING_DEFAULTS, ...(brandData ?? {}) };
  const brandName = (lang === "bn" ? b.brandNameBn : b.brandName) || t("brand");
  const brandLetter = brandName.trim().charAt(0).toUpperCase() || "B";

  const [regNumber, setRegNumber] = useState("");
  const [roll, setRoll] = useState("");
  const [dob, setDob] = useState("");
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<"" | "pdf" | "print">("");
  const [marksheet, setMarksheet] = useState<MarksheetData | null>(null);
  const [notGenerated, setNotGenerated] = useState(false);
  const [lookupError, setLookupError] = useState("");
  const [actionError, setActionError] = useState("");
  const sheetRef = useRef<HTMLDivElement>(null);
  const outcomeRef = useRef<HTMLDivElement>(null);

  // Admit cards / results link here with ?reg=…&roll=… — prefill the form.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reg = params.get("reg");
    const prefillRoll = params.get("roll");
    if (reg) setRegNumber(reg);
    if (prefillRoll) setRoll(prefillRoll);
  }, []);

  // Bring a freshly found transcript into view (after commit, like /result).
  useEffect(() => {
    if (!marksheet) return;
    const id = requestAnimationFrame(() =>
      outcomeRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    );
    return () => cancelAnimationFrame(id);
  }, [marksheet]);

  const regOk = SAFE_KEY.test(regNumber.trim());
  const rollOk = SAFE_ROLL.test(roll.trim());
  const dobOk = SAFE_DATE.test(dob);
  const canSearch = regOk && rollOk && dobOk && !loading;

  const handleSearch = useCallback(async () => {
    if (!canSearch) return;
    setSearched(true);
    setMarksheet(null);
    setNotGenerated(false);
    setLookupError("");
    setActionError("");
    setLoading(true);
    try {
      const res = await lookupPublicMarksheet({
        registrationNumber: regNumber.trim(),
        roll: roll.trim(),
        dob,
      });
      if (res.ok) {
        setMarksheet(res.marksheet ?? null);
        setNotGenerated(Boolean(res.notGenerated));
        if (res.notGenerated) {
          setLookupError("");
        } else if (!res.marksheet) {
          setLookupError(
            L(
              "No marksheet matches these details. Check the roll, registration number and date of birth.",
              "এই তথ্যে মার্কশিট পাওয়া যায়নি। রোল, রেজিস্ট্রেশন নম্বর ও জন্মতারিখ দেখে আবার চেষ্টা করুন।"
            )
          );
        }
      } else {
        setLookupError(
          res.error || L("Lookup failed. Please try again.", "খোঁজা ব্যর্থ। আবার চেষ্টা করুন।")
        );
      }
    } catch {
      setLookupError(L("Lookup failed. Please try again.", "খোঁজা ব্যর্থ। আবার চেষ্টা করুন।"));
    } finally {
      setLoading(false);
    }
  }, [canSearch, regNumber, roll, dob, L]);

  /* Both actions run on the visible <MarksheetSheet> node. */
  const handleDownload = useCallback(async () => {
    if (!sheetRef.current || busy) return;
    setActionError("");
    setBusy("pdf");
    try {
      await downloadMarksheetPdf(
        sheetRef.current,
        `marksheet-${marksheet?.result.registrationNumber || "sheet"}.pdf`
      );
    } catch {
      setActionError(
        L("Could not build the PDF. Please try again.", "PDF তৈরি করা যায়নি। আবার চেষ্টা করুন।")
      );
    } finally {
      setBusy("");
    }
  }, [busy, marksheet, L]);

  const handlePrint = useCallback(async () => {
    if (!sheetRef.current || busy) return;
    setActionError("");
    // Must open synchronously inside the click gesture or popups get blocked.
    const win = openMarksheetPrintWindow();
    if (!win) {
      setActionError(
        L(
          "Pop-up blocked — allow pop-ups for this site to print.",
          "পপআপ ব্লক হয়েছে — প্রিন্ট করতে সাইটটির পপআপ অনুমোদন দিন।"
        )
      );
      return;
    }
    setBusy("print");
    try {
      await printMarksheet(win, sheetRef.current);
    } catch {
      win.close?.();
      setActionError(L("Print failed. Please try again.", "প্রিন্ট ব্যর্থ। আবার চেষ্টা করুন।"));
    } finally {
      setBusy("");
    }
  }, [busy, L]);

  const labelCls = `flex items-center gap-1 text-[13px] font-medium mb-1.5 ${
    isDark ? "text-zinc-300" : "text-gray-700"
  }`;
  const fieldCls = `h-11 rounded-lg focus-visible:ring-[color:var(--brand-accent)] focus-visible:border-transparent hover:border-zinc-400/70 ${
    isDark ? "dark:hover:border-white/25" : ""
  }`;
  const navPill = isDark
    ? "text-zinc-400 hover:text-white hover:bg-white/[0.07]"
    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100";
  const iconPill = isDark
    ? "text-zinc-400 hover:text-white hover:bg-white/[0.07]"
    : "text-gray-500 hover:text-gray-900 hover:bg-gray-100";
  const panelCls = isDark ? "border-white/10 bg-white/[0.03]" : "border-gray-200 bg-white";

  const dateLocale = lang === "bn" ? "bn-BD" : "en-GB";

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#080808]" : "bg-gray-50"}`}>
      <header
        className={`sticky top-0 z-50 border-b backdrop-blur-xl ${
          isDark ? "border-white/[0.06] bg-[#080808]/80" : "border-gray-200 bg-white/80"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-3">
          <Link href="/" className="group flex min-w-0 items-center gap-2.5">
            {b.brandLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={b.brandLogo}
                alt={brandName}
                className={`h-8 w-8 sm:h-9 sm:w-9 shrink-0 rounded-full object-contain bg-white/90 ring-1 ${
                  isDark ? "ring-white/15" : "ring-zinc-200"
                }`}
              />
            ) : (
              <div className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-full bg-brand-accent text-brand-accent-fg text-sm font-bold">
                {brandLetter}
              </div>
            )}
            <span
              className={`truncate text-sm font-semibold transition-opacity group-hover:opacity-75 max-w-[45vw] sm:max-w-[320px] ${
                isDark ? "text-zinc-100" : "text-gray-900"
              }`}
            >
              {brandName}
            </span>
          </Link>

          <nav className="flex shrink-0 items-center gap-0.5 sm:gap-1.5">
            <Link
              href="/result"
              className={`hidden sm:inline-flex items-center rounded-md px-3 py-2 text-xs font-medium transition-colors ${navPill}`}
            >
              {t("nav.results")}
            </Link>
            <Link
              href="/status"
              className={`hidden md:inline-flex items-center rounded-md px-3 py-2 text-xs font-medium transition-colors ${navPill}`}
            >
              {L("Track Application", "অবস্থা দেখুন")}
            </Link>
            <button
              type="button"
              onClick={() => setLang(lang === "en" ? "bn" : "en")}
              aria-label={lang === "bn" ? "Switch to English" : "বাংলায় দেখুন"}
              className={`rounded-md p-2 transition-colors ${iconPill}`}
            >
              <Globe className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={isDark ? "Light mode" : "Dark mode"}
              className={`rounded-md p-2 transition-colors ${iconPill}`}
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <Link
              href="/login"
              className="inline-flex h-9 items-center rounded-md px-3 sm:px-4 text-xs font-medium transition-all hover:opacity-90 bg-brand-accent text-brand-accent-fg"
            >
              {t("nav.signIn")}
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <div className="text-center mb-6">
          <h1
            className={`text-2xl font-bold tracking-tight mb-2 ${
              isDark ? "text-zinc-100" : "text-gray-900"
            }`}
          >
            {L("Academic Marksheet", "একাডেমিক মার্কশিট")}
          </h1>
          <p className={`text-sm ${isDark ? "text-zinc-500" : "text-gray-500"}`}>
            {L(
              "Enter your roll, registration number and date of birth to view and download your marksheet.",
              "মার্কশিট দেখতে ও ডাউনলোড করতে রোল, রেজিস্ট্রেশন নম্বর ও জন্মতারিখ দিন।"
            )}
          </p>
        </div>

        <Card>
          <CardContent className="p-5 sm:p-6">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSearch();
              }}
              className="space-y-3"
            >
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className={labelCls} htmlFor="marksheet-roll">
                    {L("Roll", "রোল")} <span className="text-red-500" aria-hidden="true">*</span>
                  </label>
                  <Input
                    id="marksheet-roll"
                    className={fieldCls}
                    value={roll}
                    onChange={(e) => setRoll(e.target.value)}
                    placeholder="e.g. 110001"
                    maxLength={6}
                    inputMode="numeric"
                    autoComplete="off"
                  />
                </div>
                <div>
                  <label className={labelCls} htmlFor="marksheet-reg">
                    {L("Registration Number", "রেজিস্ট্রেশন নম্বর")}{" "}
                    <span className="text-red-500" aria-hidden="true">*</span>
                  </label>
                  <Input
                    id="marksheet-reg"
                    className={fieldCls}
                    value={regNumber}
                    onChange={(e) => setRegNumber(e.target.value)}
                    placeholder="e.g. 2026000009"
                    maxLength={40}
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>
                <div>
                  <label className={labelCls} htmlFor="marksheet-dob">
                    {L("Date of Birth", "জন্মতারিখ")}{" "}
                    <span className="text-red-500" aria-hidden="true">*</span>
                  </label>
                  <Input
                    id="marksheet-dob"
                    className={`${fieldCls} pr-9`}
                    type="date"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                  />
                </div>
              </div>

              <Button type="submit" className="w-full h-11" disabled={!canSearch}>
                {loading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Search className="h-4 w-4 mr-2" />
                )}
                {loading ? L("Searching…", "খোঁজা হচ্ছে…") : L("Find Marksheet", "মার্কশিট খুঁজুন")}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Not generated yet — identity proved, release still pending (0040) */}
        {searched && notGenerated && !marksheet && !loading && (
          <Card className="mt-6">
            <CardContent className="p-8 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10">
                <ScrollText className="h-6 w-6 text-amber-500" />
              </div>
              <p className={`text-sm ${isDark ? "text-zinc-300" : "text-gray-700"}`}>
                {L(
                  "Your details are correct, but the marksheet has not been generated yet.",
                  "আপনার তথ্য সঠিক, তবে মার্কশিট এখনও তৈরি করা হয়নি।"
                )}
              </p>
              <p className={`mt-2 text-xs ${isDark ? "text-zinc-600" : "text-gray-400"}`}>
                {L(
                  "It will appear here as soon as the examination office releases it. Need help? Contact your institution.",
                  "পরীক্ষা অফিস প্রকাশ করলেই এখানে দেখা যাবে। সাহায্য দরকার? আপনার প্রতিষ্ঠানের সঙ্গে যোগাযোগ করুন।"
                )}
              </p>
            </CardContent>
          </Card>
        )}

        {searched && !marksheet && !notGenerated && !loading && (
          <Card className="mt-6">
            <CardContent className="p-8 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
                <SearchX className="h-6 w-6 text-red-500" />
              </div>
              <p className={`text-sm ${isDark ? "text-zinc-400" : "text-gray-600"}`}>
                {lookupError ||
                  L(
                    "No marksheet found. Please check your details and try again.",
                    "কোনো মার্কশিট পাওয়া যায়নি। তথ্য দেখে আবার চেষ্টা করুন।"
                  )}
              </p>
            </CardContent>
          </Card>
        )}

        {/* ── Transcript ── */}
        {marksheet && (
          <div ref={outcomeRef} className="mt-6 scroll-mt-20 space-y-4">
            <Card className={panelCls}>
              <CardContent className="p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <ScrollText className={`h-4 w-4 ${isDark ? "text-zinc-400" : "text-gray-500"}`} />
                    <span className={`text-sm font-medium ${isDark ? "text-zinc-200" : "text-gray-800"}`}>
                      {marksheet.result.studentName} · {marksheet.result.examName}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleDownload} disabled={!!busy}>
                      {busy === "pdf" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                      {L("Download PDF", "PDF ডাউনলোড")}
                    </Button>
                    <Button variant="outline" size="sm" onClick={handlePrint} disabled={!!busy}>
                      {busy === "print" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Printer className="h-4 w-4" />
                      )}
                      {L("Print", "প্রিন্ট")}
                    </Button>
                  </div>
                </div>
                {actionError && <p className="mt-2 text-xs text-red-500">{actionError}</p>}
              </CardContent>
            </Card>

            {/* The A4 sheet itself — wider than phones, so the box scrolls */}
            <div
              className={`overflow-x-auto rounded-lg border p-3 sm:p-4 ${
                isDark ? "border-white/10 bg-white/[0.02]" : "border-gray-200 bg-white"
              }`}
            >
              <div className="inline-block min-w-full align-top">
                <MarksheetSheet
                  ref={sheetRef}
                  data={{
                    result: marksheet.result,
                    gradeBands: marksheet.gradeBands,
                    passPercent: marksheet.passPercent,
                    fatherName: marksheet.fatherName,
                    motherName: marksheet.motherName,
                    sessionName: marksheet.sessionName,
                    examDate: marksheet.examDate,
                    generatedAt: marksheet.generatedAt,
                  }}
                  lang={lang === "bn" ? "bn" : "en"}
                  brandName={brandName}
                  brandLogo={b.brandLogo}
                  mdSignature={b.mdSignature}
                  generatedOn={new Date(marksheet.generatedAt).toLocaleDateString(dateLocale)}
                />
              </div>
            </div>
          </div>
        )}
      </main>

      <footer
        className={`border-t py-6 text-center text-xs ${
          isDark ? "border-white/[0.06] text-zinc-600" : "border-gray-200 text-gray-400"
        }`}
      >
        {L(
          "Marksheets are issued by the examination office. Keep your registration number safe.",
          "মার্কশিট পরীক্ষা অফিস কর্তৃক প্রদত্ত। রেজিস্ট্রেশন নম্বর সুরক্ষিত রাখুন।"
        )}
      </footer>
    </div>
  );
}
