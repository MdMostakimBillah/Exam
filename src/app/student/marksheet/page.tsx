"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useStudentSession } from "@/lib/auth/student-auth";
import { useTheme } from "@/contexts/theme-context";
import { useLang } from "@/contexts/language-context";
import { PageLoading } from "@/components/ui/page-loading";
import { Button } from "@/components/ui/button";
import { PdfExportModal, type PdfColumn } from "@/components/ui/pdf-export-modal";
import { useResultsByStudent } from "@/lib/storage/results";
import { FileDown, FileText, Loader2, Trophy, XCircle } from "lucide-react";

/**
 * Student Marksheet — the student's own processed results with a PDF
 * download option. The whole section is permission-gated: the super admin
 * must grant the institution `allow_marksheet_download` (migration 0038),
 * same mechanism as admit cards. The nav item only renders when it is on;
 * the redirect here covers a permission revoked mid-session.
 */
export default function StudentMarksheetPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const { lang: language } = useLang();
  const isDark = theme === "dark";
  const isBn = language === "bn";

  const { data: student, isLoading: studentLoading } = useStudentSession();
  const { data: results = [], isLoading: resultsLoading } = useResultsByStudent(student?.id || "");
  const [showPdf, setShowPdf] = useState(false);

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

  const pdfColumns: PdfColumn[] = [
    { header: isBn ? "পরীক্ষা" : "Exam", key: "examName" },
    { header: isBn ? "শ্রেণি" : "Class", key: "className" },
    { header: isBn ? "রোল" : "Roll", key: "roll" },
    { header: isBn ? "মোট নম্বর" : "Total", key: "total" },
    { header: isBn ? "শতাংশ" : "%", key: "percentage" },
    { header: isBn ? "গ্রেড" : "Grade", key: "grade" },
    { header: isBn ? "অবস্থান" : "Position", key: "position" },
    { header: isBn ? "ফলাফল" : "Result", key: "result" },
  ];

  const pdfData = results.map((r) => ({
    examName: r.examName,
    className: r.className,
    roll: r.roll || "—",
    total: `${r.totalMarks}/${r.totalFullMarks}`,
    percentage: `${r.percentage.toFixed(1)}%`,
    grade: r.grade || "—",
    position: r.position > 0 ? `#${r.position}` : "—",
    result: r.pass ? (isBn ? "উত্তীর্ণ" : "PASS") : (isBn ? "অনুত্তীর্ণ" : "FAIL"),
  }));

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
          onClick={() => setShowPdf(true)}
          disabled={results.length === 0}
          size="sm"
        >
          <FileDown className="h-4 w-4" />
          {isBn ? "মার্কশিট PDF" : "Download marksheet"}
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

                  <div className="grid grid-cols-4 gap-2 text-center shrink-0">
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
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <PdfExportModal
        open={showPdf}
        onClose={() => setShowPdf(false)}
        title={isBn ? `আমার মার্কশিট (${results.length})` : `My Marksheet (${results.length})`}
        columns={pdfColumns}
        data={pdfData}
      />
    </div>
  );
}
