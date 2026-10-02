"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { searchPublicResults } from "@/lib/auth/public-lookup";
import { Result } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ResultSheet } from "@/components/result/result-sheet";
import { MarksheetSheet } from "@/components/marksheet/marksheet-sheet";
import type { TranscriptExtras } from "@/lib/auth/public-lookup";
import {
  downloadResultPdf,
  openResultPrintWindow,
  printResultSheet,
} from "@/lib/pdf/result-pdf";
import {
  downloadMarksheetPdf,
  openMarksheetPrintWindow,
  printMarksheet,
} from "@/lib/pdf/marksheet-pdf";
import {
  Search,
  Download,
  Printer,
  Loader2,
  SearchX,
  CheckCircle,
  Globe,
  Moon,
  Sun,
} from "lucide-react";
import { useTheme } from "@/contexts/theme-context";
import { useLang } from "@/contexts/language-context";
import { useBranding, BRANDING_DEFAULTS } from "@/lib/storage/branding";

/** Same shape as the server-side SAFE_KEY (mirrored here for live validation). */
const SAFE_KEY = /^[A-Za-z0-9][A-Za-z0-9 _\-/:.]{2,39}$/;
const SAFE_DATE = /^\d{4}-\d{2}-\d{2}$/;
const SAFE_ROLL = /^\d{1,6}$/;

export default function ResultPage() {
  const { theme, toggleTheme } = useTheme();
  const { t, lang, setLang } = useLang();
  const isDark = theme === "dark";
  const L = useCallback((en: string, bn: string) => (lang === "bn" ? bn : en), [lang]);

  // Super-admin branding — top bar + the exported sheet show the real logo/name.
  const { data: brandData } = useBranding();
  const b = { ...BRANDING_DEFAULTS, ...(brandData ?? {}) };
  const brandName = (lang === "bn" ? b.brandNameBn : b.brandName) || t("brand");
  const brandLetter = brandName.trim().charAt(0).toUpperCase() || "B";

  const [searchType, setSearchType] = useState<"dob" | "roll">("dob");
  const [regNumber, setRegNumber] = useState("");
  const [dob, setDob] = useState("");
  const [roll, setRoll] = useState("");
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<"" | "pdf" | "print">("");
  const [foundResult, setFoundResult] = useState<Result | null>(null);
  /** Transcript data — non-null only after the office generated the marksheet (0040). */
  const [sheet, setSheet] = useState<TranscriptExtras | null>(null);
  const [lookupError, setLookupError] = useState("");
  const [actionError, setActionError] = useState("");
  const sheetRef = useRef<HTMLDivElement>(null);
  const outcomeRef = useRef<HTMLDivElement>(null);

  // Admit-card QR codes open /result?reg=REGNO — prefill the registration field.
  useEffect(() => {
    const reg = new URLSearchParams(window.location.search).get("reg");
    if (reg) setRegNumber(reg);
  }, []);

  // Bring a fresh result into view (after commit, like on /status).
  useEffect(() => {
    if (!foundResult) return;
    const id = requestAnimationFrame(() =>
      outcomeRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    );
    return () => cancelAnimationFrame(id);
  }, [foundResult]);

  const regOk = SAFE_KEY.test(regNumber.trim());
  const secondOk =
    searchType === "dob" ? SAFE_DATE.test(dob) : SAFE_ROLL.test(roll.trim());
  const canSearch = regOk && secondOk && !loading;

  const handleSearch = useCallback(async () => {
    if (!regOk) return;
    setSearched(true);
    setFoundResult(null);
    setSheet(null);
    setLookupError("");
    setActionError("");
    setLoading(true);
    try {
      const res = await searchPublicResults({
        registrationNumber: regNumber.trim(),
        mode: searchType,
        dob,
        roll: roll.trim(),
      });
      if (res.ok) {
        setFoundResult(res.result ?? null);
        setSheet(res.sheet ?? null);
        if (!res.result) {
          setLookupError(
            L(
              "No published result matches these details. Check every field and try again.",
              "এই তথ্যে প্রকাশিত ফলাফল পাওয়া যায়নি। প্রতিটি ঘর দেখে আবার চেষ্টা করুন।"
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
  }, [regNumber, searchType, dob, roll, regOk, L]);

  /* Both actions run on the hidden sheet node staged below — the full
   * transcript once the office generated the marksheet (0040), the plain
   * result sheet until then. The right export module is picked here so the
   * print window loads the matching font stack either way. */
  const useTranscript = Boolean(sheet) && Boolean(foundResult);

  const handleDownload = useCallback(async () => {
    if (!sheetRef.current || busy) return;
    setActionError("");
    setBusy("pdf");
    try {
      const filename = `result-${foundResult?.registrationNumber || "sheet"}.pdf`;
      if (useTranscript) {
        await downloadMarksheetPdf(sheetRef.current, filename);
      } else {
        await downloadResultPdf(sheetRef.current, filename);
      }
    } catch {
      setActionError(
        L("Could not build the PDF. Please try again.", "PDF তৈরি করা যায়নি। আবার চেষ্টা করুন।")
      );
    } finally {
      setBusy("");
    }
  }, [busy, foundResult, useTranscript, L]);

  const handlePrint = useCallback(async () => {
    if (!sheetRef.current || busy) return;
    setActionError("");
    // Must open synchronously inside the click gesture or popups get blocked.
    const win = useTranscript ? openMarksheetPrintWindow() : openResultPrintWindow();
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
      if (useTranscript) {
        await printMarksheet(win, sheetRef.current);
      } else {
        await printResultSheet(win, sheetRef.current);
      }
    } catch {
      win.close?.();
      setActionError(L("Print failed. Please try again.", "প্রিন্ট ব্যর্থ। আবার চেষ্টা করুন।"));
    } finally {
      setBusy("");
    }
  }, [busy, useTranscript, L]);

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
  const statCell = isDark
    ? "border-white/10 bg-white/[0.04]"
    : "border-gray-200 bg-gray-50";

  const modes = [
    {
      key: "dob" as const,
      label: L("Registration + Date of Birth", "রেজিস্ট্রেশন + জন্মতারিখ"),
    },
    { key: "roll" as const, label: L("Registration + Roll", "রেজিস্ট্রেশন + রোল") },
  ];

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
              href="/marksheet"
              className={`hidden sm:inline-flex items-center rounded-md px-3 py-2 text-xs font-medium transition-colors ${navPill}`}
            >
              {t("nav.marksheet")}
            </Link>
            <Link
              href="/status"
              className={`hidden sm:inline-flex items-center rounded-md px-3 py-2 text-xs font-medium transition-colors ${navPill}`}
            >
              {L("Track Application", "অবস্থা দেখুন")}
            </Link>
            <Link
              href="/verify-certificate"
              className={`hidden md:inline-flex items-center rounded-md px-3 py-2 text-xs font-medium transition-colors ${navPill}`}
            >
              {t("nav.verifyCertificate")}
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

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
        <div className="text-center mb-6">
          <h1
            className={`text-2xl font-bold tracking-tight mb-2 ${
              isDark ? "text-zinc-100" : "text-gray-900"
            }`}
          >
            {L("Scholarship Examination Result", "বৃত্তি পরীক্ষার ফলাফল")}
          </h1>
          <p className={`text-sm ${isDark ? "text-zinc-500" : "text-gray-500"}`}>
            {L(
              "Search for published results using your registration details.",
              "রেজিস্ট্রেশন তথ্য দিয়ে প্রকাশিত ফলাফল খুঁজুন।"
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
              {/* Search mode — segmented control */}
              <div
                role="tablist"
                aria-label={L("Search mode", "খোঁজার ধরন")}
                className={`flex rounded-lg border p-1 ${
                  isDark ? "border-white/10 bg-white/[0.04]" : "border-gray-200 bg-gray-100"
                }`}
              >
                {modes.map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    role="tab"
                    aria-selected={searchType === m.key}
                    onClick={() => setSearchType(m.key)}
                    className={`flex-1 rounded-md px-2 sm:px-3 py-2 text-xs font-medium transition-colors ${
                      searchType === m.key
                        ? isDark
                          ? "bg-white/[0.10] text-white shadow-sm"
                          : "bg-white text-gray-900 shadow-sm"
                        : isDark
                          ? "text-zinc-500 hover:text-zinc-300"
                          : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelCls} htmlFor="result-reg">
                    {L("Registration Number", "রেজিস্ট্রেশন নম্বর")}{" "}
                    <span className="text-red-500" aria-hidden="true">
                      *
                    </span>
                  </label>
                  <Input
                    id="result-reg"
                    className={fieldCls}
                    value={regNumber}
                    onChange={(e) => setRegNumber(e.target.value)}
                    placeholder="e.g. 2026000009"
                    maxLength={40}
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>
                {searchType === "dob" ? (
                  <div>
                    <label className={labelCls} htmlFor="result-dob">
                      {L("Date of Birth", "জন্মতারিখ")}{" "}
                      <span className="text-red-500" aria-hidden="true">
                        *
                      </span>
                    </label>
                    <Input
                      id="result-dob"
                      className={`${fieldCls} pr-9`}
                      type="date"
                      value={dob}
                      onChange={(e) => setDob(e.target.value)}
                    />
                  </div>
                ) : (
                  <div>
                    <label className={labelCls} htmlFor="result-roll">
                      {L("Exam Roll", "পরীক্ষার রোল")}{" "}
                      <span className="text-red-500" aria-hidden="true">
                        *
                      </span>
                    </label>
                    <Input
                      id="result-roll"
                      className={fieldCls}
                      value={roll}
                      onChange={(e) => setRoll(e.target.value)}
                      placeholder="e.g. 110001"
                      maxLength={6}
                      inputMode="numeric"
                      autoComplete="off"
                    />
                  </div>
                )}
              </div>

              <Button type="submit" className="w-full h-11" disabled={!canSearch}>
                {loading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Search className="h-4 w-4 mr-2" />
                )}
                {loading
                  ? L("Searching…", "খোঁজা হচ্ছে…")
                  : L("Search Result", "ফলাফল খুঁজুন")}
              </Button>
            </form>
          </CardContent>
        </Card>

        {searched && !foundResult && !loading && (
          <Card className="mt-6">
            <CardContent className="p-8 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
                <SearchX className="h-6 w-6 text-red-500" />
              </div>
              <p className={`text-sm ${isDark ? "text-zinc-400" : "text-gray-600"}`}>
                {lookupError ||
                  L(
                    "No result found. Please check your details and try again.",
                    "কোনো ফলাফল পাওয়া যায়নি। তথ্য দেখে আবার চেষ্টা করুন।"
                  )}
              </p>
              <p className={`mt-2 text-xs ${isDark ? "text-zinc-600" : "text-gray-400"}`}>
                {L(
                  "Results appear only after they are published. Need help? Contact your institution.",
                  "ফলাফল প্রকাশিত হলে তবেই দেখা যায়। সাহায্য দরকার? আপনার প্রতিষ্ঠানের সঙ্গে যোগাযোগ করুন।"
                )}
              </p>
            </CardContent>
          </Card>
        )}

        {foundResult && (
          <div ref={outcomeRef} className="mt-6 scroll-mt-20 space-y-4">
            <Card className={panelCls}>
              <CardContent className="p-5 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-md ${
                        isDark ? "bg-white/[0.06]" : "bg-gray-100"
                      }`}
                    >
                      <CheckCircle
                        className={`h-4 w-4 ${foundResult.pass ? "text-green-500" : "text-red-500"}`}
                      />
                    </div>
                    <span
                      className={`text-sm font-medium ${
                        isDark ? "text-zinc-300" : "text-gray-700"
                      }`}
                    >
                      {L("Result", "ফলাফল")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge status={foundResult.pass ? "ACTIVE" : "REJECTED"}>
                      {foundResult.pass ? L("Pass", "উত্তীর্ণ") : L("Fail", "উত্তীর্ণ নয়")}
                    </Badge>
                    <Badge status={foundResult.status}>
                      {L("Published", "প্রকাশিত")}
                    </Badge>
                  </div>
                </div>

                {/* Candidate */}
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    {
                      label: L("Student Name", "শিক্ষার্থীর নাম"),
                      value: foundResult.studentName,
                    },
                    {
                      label: L("Institution", "প্রতিষ্ঠান"),
                      value:
                        (lang === "bn"
                          ? foundResult.institutionName
                          : foundResult.institutionNameEn) ||
                        foundResult.institutionName,
                    },
                    { label: L("Class", "শ্রেণি"), value: foundResult.className },
                    { label: L("Exam", "পরীক্ষা"), value: foundResult.examName },
                    { label: L("Roll", "রোল"), value: foundResult.roll || "—" },
                    {
                      label: L("Registration No", "রেজিস্ট্রেশন নম্বর"),
                      value: foundResult.registrationNumber,
                    },
                  ].map((item) => (
                    <div key={item.label}>
                      <span
                        className={`text-[10px] uppercase tracking-wider ${
                          isDark ? "text-zinc-600" : "text-gray-400"
                        }`}
                      >
                        {item.label}
                      </span>
                      <p
                        className={`text-sm mt-0.5 break-words ${
                          isDark ? "text-zinc-200" : "text-gray-800"
                        }`}
                      >
                        {item.value || "—"}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Subject-wise marks */}
                {foundResult.subjectMarks.length > 0 && (
                  <div
                    className={`mt-4 border-t pt-4 ${
                      isDark ? "border-white/[0.06]" : "border-gray-200"
                    }`}
                  >
                    <h4
                      className={`text-xs font-medium mb-2 ${
                        isDark ? "text-zinc-500" : "text-gray-500"
                      }`}
                    >
                      {L("Subject-wise Marks", "বিষয়ভিত্তিক নম্বর")}
                    </h4>
                    <div className="space-y-1">
                      {foundResult.subjectMarks.map((sm) => (
                        <div
                          key={sm.subjectId}
                          className={`flex items-center justify-between text-sm py-1.5 px-2 rounded ${
                            isDark ? "hover:bg-white/[0.04]" : "hover:bg-gray-50"
                          }`}
                        >
                          <span className={isDark ? "text-zinc-400" : "text-gray-600"}>
                            {sm.subjectName}
                          </span>
                          <span
                            className={`font-medium ${
                              isDark ? "text-zinc-200" : "text-gray-900"
                            }`}
                          >
                            {sm.marks} / {sm.fullMarks}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Summary */}
                <div
                  className={`mt-4 border-t pt-4 grid grid-cols-2 md:grid-cols-4 gap-3 ${
                    isDark ? "border-white/[0.06]" : "border-gray-200"
                  }`}
                >
                  {[
                    {
                      label: L("Total", "মোট"),
                      value: `${foundResult.totalMarks}/${foundResult.totalFullMarks}`,
                    },
                    {
                      label: L("Percentage", "শতকরা"),
                      value: `${foundResult.percentage.toFixed(1)}%`,
                    },
                    { label: L("Grade", "গ্রেড"), value: foundResult.grade || "—" },
                    ...(foundResult.position > 0
                      ? [
                          {
                            label: L("Position", "অবস্থান"),
                            value: String(foundResult.position),
                          },
                        ]
                      : []),
                  ].map((cell) => (
                    <div
                      key={cell.label}
                      className={`text-center p-3 rounded-md border ${statCell}`}
                    >
                      <span
                        className={`text-[10px] uppercase tracking-wider ${
                          isDark ? "text-zinc-500" : "text-gray-400"
                        }`}
                      >
                        {cell.label}
                      </span>
                      <p
                        className={`text-lg font-bold mt-0.5 ${
                          isDark ? "text-zinc-100" : "text-gray-900"
                        }`}
                      >
                        {cell.value}
                      </p>
                    </div>
                  ))}
                </div>

                {foundResult.scholarshipStatus !== "NOT_ELIGIBLE" &&
                  foundResult.scholarshipStatus !== "PENDING" && (
                    <div className="mt-4 flex items-start gap-2 rounded-lg border border-green-500/20 bg-green-500/10 p-3">
                      <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                      <span className="text-xs text-green-600 dark:text-green-400">
                        {L(
                          `Congratulations! You are eligible for the ${foundResult.scholarshipStatus} scholarship.`,
                          `অভিনন্দন! আপনি ${foundResult.scholarshipStatus} বৃত্তির জন্য যোগ্য।`
                        )}
                      </span>
                    </div>
                  )}

                {/* Actions */}
                <div className="mt-5 flex flex-col sm:flex-row gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 h-10"
                    onClick={handleDownload}
                    disabled={!!busy}
                  >
                    {busy === "pdf" ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    {L("Download PDF", "PDF ডাউনলোড")}
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 h-10"
                    onClick={handlePrint}
                    disabled={!!busy}
                  >
                    {busy === "print" ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Printer className="h-4 w-4 mr-2" />
                    )}
                    {L("Print", "প্রিন্ট")}
                  </Button>
                </div>
                {actionError && (
                  <p className="mt-2 text-xs text-red-500">{actionError}</p>
                )}
                <div className="mt-4">
                  <Link
                    href={`/status?reg=${encodeURIComponent(foundResult.registrationNumber)}`}
                    className="inline-flex items-center gap-1 text-sm font-medium text-brand-accent hover:underline"
                  >
                    {L("Track this application →", "আবেদনের অবস্থা দেখুন →")}
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      {/* Hidden staging area — html2canvas (PDF) and the print window read this node */}
      {foundResult && (
        <div
          aria-hidden
          style={{ position: "fixed", left: -10000, top: 0, background: "#fff", zIndex: -1 }}
        >
          {useTranscript && sheet ? (
            /* Released by the office (0040): the SAME transcript component the
             * student portal /marksheet export, so this PDF is pixel-identical
             * to the dashboard marksheet. */
            <MarksheetSheet
              ref={sheetRef}
              data={{
                result: foundResult,
                gradeBands: sheet.gradeBands,
                passPercent: sheet.passPercent,
                fatherName: sheet.fatherName,
                motherName: sheet.motherName,
                sessionName: sheet.sessionName,
                examDate: sheet.examDate,
                generatedAt: foundResult.marksheetGeneratedAt,
                scholarshipCategories: sheet.scholarshipCategories,
              }}
              lang={lang === "bn" ? "bn" : "en"}
              brandName={brandName}
              brandLogo={b.brandLogo}
              mdSignature={b.mdSignature}
              watermarkUrl={b.brandWatermark || undefined}
              watermarkText={b.brandShort || "BMA"}
              generatedOn={new Date(
                foundResult.marksheetGeneratedAt || Date.now()
              ).toLocaleDateString(lang === "bn" ? "bn-BD" : "en-GB")}
            />
          ) : (
            <ResultSheet
              ref={sheetRef}
              result={foundResult}
              lang={lang === "bn" ? "bn" : "en"}
              brandName={brandName}
              brandLogo={b.brandLogo}
              generatedOn={new Date().toLocaleDateString(
                lang === "bn" ? "bn-BD" : "en-GB"
              )}
              verifyUrl={
                typeof window !== "undefined"
                  ? `${window.location.origin}/verify-certificate`
                  : "/verify-certificate"
              }
            />
          )}
        </div>
      )}
    </div>
  );
}
