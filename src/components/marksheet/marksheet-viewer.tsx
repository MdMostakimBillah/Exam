"use client";

import { useRef, useState, type ReactNode } from "react";
import { Loader2, Download, Printer } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { useLang } from "@/contexts/language-context";
import { useTheme } from "@/contexts/theme-context";
import { useBranding, BRANDING_DEFAULTS } from "@/lib/storage/branding";
import { DEFAULT_GRADE_BANDS, useExamMarkSetup } from "@/lib/storage/mark-setup";
import { useExamsFull } from "@/lib/storage/exams";
import { useCurrentSession } from "@/lib/storage/sessions";
import { useStudentById } from "@/lib/storage/students";
import { useResultById } from "@/lib/storage/results";
import { useInstitutionName } from "@/lib/storage/institutions";
import { MarksheetSheet } from "@/components/marksheet/marksheet-sheet";
import {
  downloadMarksheetPdf,
  openMarksheetPrintWindow,
  printMarksheet,
} from "@/lib/pdf/marksheet-pdf";
import type { Result } from "@/lib/types";

/**
 * The one place a transcript is previewed: super admin (generate & view tab),
 * institution results and the student portal all open this modal, so grade
 * bands, branding, father/mother names and the PDF/print buttons live here
 * once instead of three times.
 *
 * `note` is the caller's context line (release state, permission hint, …).
 */
export function MarksheetViewer({
  result,
  onClose,
  note,
}: {
  result: Result;
  onClose: () => void;
  note?: ReactNode;
}) {
  const { theme } = useTheme();
  const { lang, t } = useLang();
  const isDark = theme === "dark";
  const isBn = lang === "bn";
  const L = (en: string, bn: string) => (isBn ? bn : en);

  const [busy, setBusy] = useState<"" | "pdf" | "print">("");
  const [actionError, setActionError] = useState("");
  const sheetRef = useRef<HTMLDivElement>(null);

  const { data: examSetup } = useExamMarkSetup(result.examId);
  const { data: exams = [] } = useExamsFull();
  const { data: currentSession } = useCurrentSession();
  const { data: fullStudent } = useStudentById(result.studentId);
  const { data: brandData } = useBranding();
  const brand = { ...BRANDING_DEFAULTS, ...(brandData ?? {}) };

  // Every list view hands us the LIGHT row: RESULT_LIST_COLUMNS deliberately
  // drops the heavy subject_marks JSONB, so the sheet would render its
  // "No subject marks available" placeholder for a result that does have its
  // seven subjects. Fetch the full row here (one id lookup, cached) and hold
  // the sheet back until it lands instead of flashing the empty table.
  const { data: fullResult, isFetched: fullFetched } = useResultById(result.id);
  const instName = useInstitutionName();
  const needsSubjects = result.subjectMarks.length === 0;
  const resolved: Result | null =
    fullResult ?? (!needsSubjects || fullFetched ? result : null);
  // Institution names are stored Bangla-first; show them in the page language
  // exactly like every table does (name_en in English when it exists).
  const transcript: Result | null = resolved
    ? {
        ...resolved,
        institutionName:
          instName(resolved.institutionName, resolved.institutionId) ||
          resolved.institutionName,
      }
    : null;

  const handleDownload = async () => {
    if (!sheetRef.current || busy) return;
    setActionError("");
    setBusy("pdf");
    try {
      await downloadMarksheetPdf(sheetRef.current, `marksheet-${result.registrationNumber || "sheet"}.pdf`);
    } catch {
      setActionError(L("Could not build the PDF. Please try again.", "PDF তৈরি করা যায়নি। আবার চেষ্টা করুন।"));
    } finally {
      setBusy("");
    }
  };

  const handlePrint = async () => {
    if (!sheetRef.current || busy) return;
    setActionError("");
    // Must open synchronously inside the click gesture or popups get blocked.
    const win = openMarksheetPrintWindow();
    if (!win) {
      setActionError(L(
        "Pop-up blocked — allow pop-ups for this site to print.",
        "পপআপ ব্লক হয়েছে — প্রিন্ট করতে সাইটটির পপআপ অনুমোদন দিন।"
      ));
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
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`${L("Marksheet", "মার্কশিট")} — ${result.studentName}`}
      description={`${result.examName} · ${result.className}`}
      maxWidth="max-w-[900px]"
      maxHeight="max-h-[92vh]"
    >
      <div className={`flex flex-wrap items-center justify-between gap-3 pb-3 mb-3 border-b ${isDark ? "border-white/[0.06]" : "border-zinc-200"}`}>
        <div className={`text-[11px] ${result.marksheetGeneratedAt ? (isDark ? "text-zinc-500" : "text-zinc-500") : "text-amber-500"}`}>
          {note ?? (result.marksheetGeneratedAt
            ? L("Published — students can download it on /marksheet", "প্রকাশিত — শিক্ষার্থীরা /marksheet থেকে ডাউনলোড করতে পারে")
            : L("Not generated by the office yet (preview only)", "অফিস এখনও জেনারেট করেনি (প্রিভিউ)"))}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDownload}
            disabled={!!busy || !transcript}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors disabled:opacity-60 ${isDark ? "bg-white/[0.06] text-zinc-300 hover:bg-white/[0.1]" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"}`}
          >
            {busy === "pdf" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            {L("Download PDF", "PDF ডাউনলোড")}
          </button>
          <button
            type="button"
            onClick={handlePrint}
            disabled={!!busy || !transcript}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors disabled:opacity-60 ${isDark ? "bg-white/[0.06] text-zinc-300 hover:bg-white/[0.1]" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"}`}
          >
            {busy === "print" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />}
            {L("Print", "প্রিন্ট")}
          </button>
        </div>
      </div>

      {actionError && <p className="mb-2 text-xs text-red-500">{actionError}</p>}

      <div className={`overflow-x-auto rounded-md border p-3 ${isDark ? "border-white/10 bg-white/[0.02]" : "border-zinc-200 bg-zinc-50"}`}>
        {!transcript ? (
          // Full row (with subject_marks) still loading — never print a sheet
          // whose marks table we have not read yet.
          <div className="flex items-center justify-center gap-2 py-24 text-zinc-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-[11px]">{L("Loading marks…", "নম্বর লোড হচ্ছে…")}</span>
          </div>
        ) : (
          <MarksheetSheet
            ref={sheetRef}
            data={{
              result: transcript,
              gradeBands: examSetup?.gradeBands ?? DEFAULT_GRADE_BANDS,
              passPercent: examSetup?.passPercent ?? 33,
              fatherName: fullStudent?.fatherName || "",
              motherName: fullStudent?.motherName || "",
              sessionName: currentSession?.name || "",
              examDate: exams.find((item) => item.id === result.examId)?.examDate || "",
              generatedAt: transcript.marksheetGeneratedAt,
              scholarshipCategories: examSetup?.scholarshipCategories ?? [],
            }}
            lang={lang}
            brandName={(lang === "bn" ? brand.brandNameBn : brand.brandName) || t("brand")}
            brandLogo={brand.brandLogo}
            mdSignature={brand.mdSignature}
            generatedOn={
              transcript.marksheetGeneratedAt
                ? new Date(transcript.marksheetGeneratedAt).toLocaleDateString(isBn ? "bn-BD" : "en-GB")
                : L("Not generated yet", "এখনও জেনারেট করা হয়নি")
            }
          />
        )}
      </div>
    </Modal>
  );
}
