"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useStudentSession } from "@/lib/auth/student-auth";
import { useTheme } from "@/contexts/theme-context";
import { useLang } from "@/contexts/language-context";
import { PageLoading } from "@/components/ui/page-loading";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useResultsByStudent } from "@/lib/storage/results";
import { useStudentById } from "@/lib/storage/students";
import { useExamsFull } from "@/lib/storage/exams";
import { useCurrentSession } from "@/lib/storage/sessions";
import { DEFAULT_GRADE_BANDS, useExamMarkSetup } from "@/lib/storage/mark-setup";
import { useBranding, BRANDING_DEFAULTS } from "@/lib/storage/branding";
import { MarksheetSheet } from "@/components/marksheet/marksheet-sheet";
import {
  downloadMarksheetPdf,
  openMarksheetPrintWindow,
  printMarksheet,
} from "@/lib/pdf/marksheet-pdf";
import type { Result } from "@/lib/types";
import {
  FileText,
  Loader2,
  Printer,
  ScrollText,
  Trophy,
  XCircle,
  Download,
} from "lucide-react";

/**
 * Student Marksheet — the student's own processed results, each opening as
 * an A4 board-style transcript (preview + Download PDF / Print, using the
 * same <MarksheetSheet> node as /marksheet and the institution action).
 * The whole section is permission-gated: the super admin must grant the
 * institution `allow_marksheet_download` (migration 0038), same mechanism as
 * admit cards. The nav item only renders when it is on; the redirect here
 * covers a permission revoked mid-session.
 */
export default function StudentMarksheetPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const { lang: language, t } = useLang();
  const isDark = theme === "dark";
  const isBn = language === "bn";

  const { data: student, isLoading: studentLoading } = useStudentSession();
  const { data: results = [], isLoading: resultsLoading } = useResultsByStudent(student?.id || "");

  // Transcript viewer for one result.
  const [viewing, setViewing] = useState<Result | null>(null);
  const [busy, setBusy] = useState<"" | "pdf" | "print">("");
  const [actionError, setActionError] = useState("");
  const sheetRef = useRef<HTMLDivElement>(null);
  const { data: examSetup } = useExamMarkSetup(viewing?.examId || "");
  const { data: exams = [] } = useExamsFull();
  const { data: currentSession } = useCurrentSession();
  const { data: fullStudent } = useStudentById(viewing?.studentId || "");
  const { data: brandData } = useBranding();
  const brand = { ...BRANDING_DEFAULTS, ...(brandData ?? {}) };

  useEffect(() => {
    if (!studentLoading && !student) {
      router.push("/student/login");
    } else if (!studentLoading && student && !student.allowMarksheetDownload) {
      router.push("/student/dashboard");
    }
  }, [student, studentLoading, router]);

  if (studentLoading || !student || !student.allowMarksheetDownload) {
    return <PageLoading isDark={isDark} />;
  }

  const card = isDark
    ? "bg-[#141416] border border-white/[0.06] rounded-xl"
    : "bg-white border border-zinc-200 rounded-xl shadow-sm";
  const iconBg = "bg-brand-accent-soft";
  const iconColor = "text-brand-accent";

  const handleDownload = async () => {
    if (!sheetRef.current || busy) return;
    setActionError("");
    setBusy("pdf");
    try {
      await downloadMarksheetPdf(sheetRef.current, `marksheet-${viewing?.registrationNumber || "sheet"}.pdf`);
    } catch {
      setActionError(isBn ? "PDF তৈরি করা যায়নি। আবার চেষ্টা করুন।" : "Could not build the PDF. Please try again.");
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
      setActionError(isBn ? "পপআপ ব্লক হয়েছে — প্রিন্ট করতে সাইটটির পপআপ অনুমোদন দিন।" : "Pop-up blocked — allow pop-ups for this site to print.");
      return;
    }
    setBusy("print");
    try {
      await printMarksheet(win, sheetRef.current);
    } catch {
      win.close?.();
      setActionError(isBn ? "প্রিন্ট ব্যর্থ। আবার চেষ্টা করুন।" : "Print failed. Please try again.");
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className={`text-xl font-bold tracking-tight ${isDark ? "text-white" : "text-zinc-900"}`}>
            {isBn ? "আমার মার্কশিট" : "My Marksheet"}
          </h1>
          <p className={`text-sm mt-1 ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>
            {(isBn ? student.institutionName : student.institutionNameEn || student.institutionName) ||
              "\u00A0"}
            &middot; {student.class} {student.section && `- ${student.section}`}
          </p>
        </div>
        <Button
          type="button"
          onClick={() => setViewing(results[0])}
          disabled={results.length === 0}
          size="sm"
        >
          <ScrollText className="h-4 w-4" />
          {isBn ? "মার্কশিট দেখুন" : "View marksheet"}
        </Button>
      </div>

      {/* Results list */}
      <div className={card}>
        <div className={`px-5 py-4 border-b ${isDark ? "border-white/[0.06]" : "border-zinc-100"}`}>
          <div className="flex items-center gap-2">
            <Trophy className={`h-4 w-4 ${iconColor}`} />
            <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>
              {isBn ? "ফলাফল" : "Results"}
            </h3>
            <span className={`text-[11px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
              ({results.length})
            </span>
          </div>
        </div>

        {resultsLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className={`h-6 w-6 animate-spin ${iconColor}`} />
          </div>
        ) : results.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className={`h-12 w-12 rounded-lg flex items-center justify-center mb-3 ${iconBg}`}>
              <FileText className={`h-6 w-6 ${iconColor}`} />
            </div>
            <p className={`text-sm font-medium ${isDark ? "text-white" : "text-zinc-900"}`}>
              {isBn ? "এখনও কোনো ফলাফল প্রকাশ করা হয়নি" : "No results published yet"}
            </p>
            <p className={`text-[11px] mt-1 ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
              {isBn
                ? "আপনার প্রতিষ্ঠান ফলাফল প্রকাশ করলে এখানে দেখা যাবে।"
                : "Results will appear here once your institution publishes them."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-white/[0.04]">
            {results.map((r) => (
              <div key={r.id} className={`px-5 py-4 ${isDark ? "hover:bg-white/[0.02]" : "hover:bg-zinc-50/50"} transition-colors`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <p className={`text-sm font-medium truncate ${isDark ? "text-zinc-100" : "text-zinc-800"}`}>
                        {r.examName}
                      </p>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                          r.pass
                            ? "bg-green-500/10 text-green-400 border-green-500/20"
                            : "bg-red-500/10 text-red-400 border-red-500/20"
                        }`}
                      >
                        {r.pass ? (
                          <Trophy className="h-3 w-3" />
                        ) : (
                          <XCircle className="h-3 w-3" />
                        )}
                        {r.pass ? (isBn ? "উত্তীর্ণ" : "Pass") : isBn ? "অনুত্তীর্ণ" : "Fail"}
                      </span>
                      {!r.marksheetGeneratedAt && (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                          isDark ? "bg-amber-500/10 text-amber-400 border-amber-500/20" : "bg-amber-50 text-amber-600 border-amber-300"
                        }`}>
                          {isBn ? "এখনও জেনারেট হয়নি" : "Not generated yet"}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] flex-wrap">
                      <span className={isDark ? "text-zinc-500" : "text-zinc-400"}>
                        {isBn ? "শ্রেণি" : "Class"}: {r.className}
                      </span>
                      <span className={isDark ? "text-zinc-500" : "text-zinc-400"}>
                        {isBn ? "রোল" : "Roll"}: {r.roll || "—"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="grid grid-cols-4 gap-2 text-center">
                      {[
                        { label: isBn ? "মোট" : "Total", value: `${r.totalMarks}/${r.totalFullMarks}` },
                        { label: isBn ? "শতাংশ" : "Percent", value: `${r.percentage.toFixed(1)}%` },
                        { label: isBn ? "গ্রেড" : "Grade", value: r.grade || "—" },
                        {
                          label: isBn ? "অবস্থান" : "Position",
                          value: r.position > 0 ? `#${r.position}` : "—",
                        },
                      ].map((s) => (
                        <div key={s.label} className="min-w-[54px]">
                          <p className={`text-sm font-bold leading-tight ${isDark ? "text-white" : "text-zinc-900"}`}>
                            {s.value}
                          </p>
                          <p className={`text-[9px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>{s.label}</p>
                        </div>
                      ))}
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => { setActionError(""); setViewing(r); }}
                      title={isBn ? "মার্কশিট দেখুন" : "View marksheet"}
                    >
                      <ScrollText className="h-4 w-4" />
                      <span className="hidden sm:inline">{isBn ? "মার্কশিট" : "Marksheet"}</span>
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Transcript viewer — A4 sheet, download/print (same node everywhere) */}
      {viewing && (
        <Modal
          open
          onClose={() => { setViewing(null); setActionError(""); }}
          title={isBn ? `মার্কশিট — ${viewing.examName}` : `Marksheet — ${viewing.examName}`}
          description={`${viewing.studentName} · ${viewing.className}`}
          maxWidth="max-w-[900px]"
          maxHeight="max-h-[92vh]"
        >
          <div className={`flex flex-wrap items-center justify-between gap-3 pb-3 mb-3 border-b ${isDark ? "border-white/[0.06]" : "border-zinc-200"}`}>
            <div className={`text-[11px] ${viewing.marksheetGeneratedAt ? (isDark ? "text-zinc-500" : "text-zinc-500") : "text-amber-500"}`}>
              {viewing.marksheetGeneratedAt
                ? (isBn ? "প্রকাশিত মার্কশিট — নিচের /marksheet পেজেও দেখা যাবে" : "Published — also visible on the public /marksheet page")
                : (isBn ? "অফিস এখনও জেনারেট করেনি (প্রিভিউ)" : "Not generated by the office yet (preview only)")}
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={handleDownload} disabled={!!busy}>
                {busy === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {isBn ? "PDF ডাউনলোড" : "Download PDF"}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={handlePrint} disabled={!!busy}>
                {busy === "print" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                {isBn ? "প্রিন্ট" : "Print"}
              </Button>
            </div>
          </div>
          {actionError && <p className="mb-2 text-xs text-red-500">{actionError}</p>}
          <div className={`overflow-x-auto rounded-md border p-3 ${isDark ? "border-white/10 bg-white/[0.02]" : "border-zinc-200 bg-zinc-50"}`}>
            <MarksheetSheet
              ref={sheetRef}
              data={{
                result: viewing,
                gradeBands: examSetup?.gradeBands ?? DEFAULT_GRADE_BANDS,
                passPercent: examSetup?.passPercent ?? 33,
                fatherName: fullStudent?.fatherName || "",
                motherName: fullStudent?.motherName || "",
                sessionName: currentSession?.name || "",
                examDate: exams.find((item) => item.id === viewing.examId)?.examDate || "",
                generatedAt: viewing.marksheetGeneratedAt,
              }}
              lang={language === "bn" ? "bn" : "en"}
              brandName={(language === "bn" ? brand.brandNameBn : brand.brandName) || t("brand")}
              brandLogo={brand.brandLogo}
              mdSignature={brand.mdSignature}
              generatedOn={
                viewing.marksheetGeneratedAt
                  ? new Date(viewing.marksheetGeneratedAt).toLocaleDateString(isBn ? "bn-BD" : "en-GB")
                  : (isBn ? "এখনও জেনারেট করা হয়নি" : "Not generated yet")
              }
            />
          </div>
        </Modal>
      )}
    </div>
  );
}
