"use client";
import { useState, useEffect, useMemo } from "react";
import { MarksProcessPanel } from "@/components/marks/MarksProcessPanel";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableCheckbox } from "@/components/ui/table-checkbox";
import { useTableSelection } from "@/hooks/use-table-selection";
import { PdfExportModal, type PdfColumn } from "@/components/ui/pdf-export-modal";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useResults } from "@/lib/storage/results";
import { useInstitutionName } from "@/lib/storage/institutions";
import { useExamsFull } from "@/lib/storage/exams";
import { Award, BarChart3, Download, FileDown, TrendingUp, Users } from "lucide-react";
import { useTheme } from "@/contexts/theme-context";
import { useLang } from "@/contexts/language-context";
import { LoadingBar } from "@/components/ui/loading-bar";

export default function ResultsPage() {
  const { theme } = useTheme();
  const { lang: language } = useLang();
  const isDark = theme === "dark";
  const isBn = language === "bn";
  // Institution names: stored Bangla value renders as name_en in English.
  const instName = useInstitutionName();
  const [mounted, setMounted] = useState(false);
  const [examFilter, setExamFilter] = useState("");
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [exportScope, setExportScope] = useState<"all" | "selected">("all");

  const { data: results = [], isFetching, error: resultsError } = useResults(undefined, 1, 200);
  const { data: exams = [] } = useExamsFull();
  const filtered = useMemo(() => examFilter ? results.filter(r => r.examId === examFilter) : results, [results, examFilter]);

  const totalCandidates = filtered.length;
  const passed = useMemo(() => filtered.filter(r => r.pass).length, [filtered]);
  const scholarshipWinners = useMemo(() => filtered.filter(r => r.scholarshipStatus !== 'NOT_ELIGIBLE' && r.scholarshipStatus !== 'PENDING').length, [filtered]);
  const avgScore = useMemo(() => filtered.length > 0 ? Math.round(filtered.reduce((sum, r) => sum + r.percentage, 0) / filtered.length) : 0, [filtered]);

  const selection = useTableSelection(filtered);

  const pdfColumns: PdfColumn[] = useMemo(() => [
    { header: isBn ? 'অবস্থান' : 'Position', key: "position" },
    { header: isBn ? 'শিক্ষার্থী' : 'Student', key: "studentName" },
    { header: isBn ? 'প্রতিষ্ঠান' : 'Institution', key: "institutionName" },
    { header: isBn ? 'শ্রেণী' : 'Class', key: "className" },
    { header: isBn ? 'মোট নম্বর' : 'Total', key: "total" },
    { header: isBn ? 'শতাংশ' : '%', key: "percentage" },
    { header: isBn ? 'গ্রেড' : 'Grade', key: "grade" },
    { header: isBn ? 'বৃত্তি' : 'Scholarship', key: "scholarshipStatus" },
  ], [isBn]);

  const pdfData = useMemo(() => (exportScope === "selected"
    ? filtered.filter(r => selection.isSelected(r.id))
    : filtered
  ).map(r => ({
    position: `#${r.position}`,
    studentName: r.studentName,
    institutionName: instName(r.institutionName, r.institutionId),
    className: r.className,
    total: `${r.totalMarks}/${r.totalFullMarks}`,
    percentage: `${r.percentage.toFixed(1)}%`,
    grade: r.grade,
    scholarshipStatus: r.scholarshipStatus,
  })), [filtered, exportScope, selection, instName]);

  const examOptions = useMemo(() => [{ label: isBn ? 'সব পরীক্ষা' : 'All Exams', value: '' }, ...exams.map(e => ({ label: e.name, value: e.id }))], [exams, isBn]);

  useEffect(() => { setMounted(true); }, []);

  if (!mounted) return <ResultsSkeleton isDark={isDark} />;

  const card = isDark
    ? "bg-[#141416] border border-white/[0.06] rounded-md"
    : "bg-white border border-zinc-200 rounded-md shadow-sm";
  const iconColor = "text-brand-accent";

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0a0a0b]" : "bg-zinc-50"}`}>
      <LoadingBar isLoading={isFetching} />
      <div className="max-w-[1600px] mx-auto p-6 lg:p-8">
        {/* Page Header */}
        <div className="mb-8 flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-accent text-brand-accent-fg shadow-lg shadow-black/10">
            <Award className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h1 className={`text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-zinc-900"}`}>
              {isBn ? 'ফলাফল' : 'Results'}
            </h1>
            <p className={`text-sm mt-1 ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>
              {isBn ? 'পরীক্ষার ফলাফল দেখুন' : 'View examination results'}
            </p>
          </div>
        </div>
        <div className="mb-6">
          <MarksProcessPanel />
        </div>
        {/* Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { label: isBn ? 'মোট প্রার্থী' : 'Total Candidates', value: totalCandidates, icon: Users, tile: 'bg-brand-accent-soft text-brand-accent' },
            { label: isBn ? 'পাসের হার' : 'Pass Rate', value: `${totalCandidates > 0 ? Math.round((passed / totalCandidates) * 100) : 0}%`, icon: TrendingUp, tile: 'bg-brand-accent-soft text-brand-accent' },
            { label: isBn ? 'বৃত্তিপ্রাপ্ত' : 'Scholarship', value: scholarshipWinners, icon: Award, tile: 'bg-brand-accent-soft text-brand-accent' },
            { label: isBn ? 'গড় স্কোর' : 'Avg Score', value: `${avgScore}%`, icon: BarChart3, tile: 'bg-brand-accent-soft text-brand-accent' },
          ].map((s) => (
            <div key={s.label} className={`${card} px-4 py-3 flex items-center gap-3`}>
              <div className={`h-10 w-10 rounded-md flex items-center justify-center shrink-0 ${s.tile}`}>
                <s.icon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-lg font-bold tracking-tight leading-tight ${isDark ? "text-white" : "text-zinc-900"}`}>{s.value}</p>
                <p className={`text-[11px] ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className={`${card} p-4 mb-6`}>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label className={`block text-[11px] mb-1.5 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>{isBn ? 'পরীক্ষা' : 'Exam'}</label>
              <Select
                options={examOptions}
                value={examFilter}
                onChange={(e) => setExamFilter(e.target.value)}
                className={isDark ? "bg-white/[0.04] border-white/[0.06]" : "bg-zinc-50 border-zinc-200"}
              />
            </div>
            <div className="flex items-end">
              <button
                type="button"
                disabled={filtered.length === 0}
                onClick={() => { setExportScope("all"); setShowPdfModal(true); }}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${isDark ? "bg-white/[0.06] text-zinc-400 hover:text-white hover:bg-white/[0.1]" : "bg-zinc-100 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200"}`}
              >
                <Download className="h-3.5 w-3.5" /> {isBn ? 'ফলাফল এক্সপোর্ট' : 'Export Results'}
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        {resultsError ? (
          <div className={`${card} p-10 text-center text-sm text-red-600 dark:text-red-400`}>
            {resultsError.message}
          </div>
        ) : filtered.length === 0 ? (
          <div className={`${card} flex flex-col items-center justify-center py-16`}>
            <div className={`h-14 w-14 rounded-md flex items-center justify-center mb-4 ${isDark ? 'bg-white/[0.08]' : 'bg-zinc-100'}`}>
              <Award className={`h-7 w-7 ${iconColor}`} />
            </div>
            <p className={`text-sm font-medium ${isDark ? "text-white" : "text-zinc-900"}`}>{isBn ? 'কোনো ফলাফল পাওয়া যায়নি' : 'No results found'}</p>
            <p className={`text-[11px] mt-1 ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>{isBn ? 'পরীক্ষা প্রকাশের পর ফলাফল এখানে দেখা যাবে।' : 'Results will appear here once exams are published.'}</p>
          </div>
        ) : (
          <div className={`${card}`}>
            <div className={`px-5 py-4 border-b ${isDark ? "border-white/[0.06]" : "border-zinc-100"}`}>
              <div className="flex items-center gap-2">
                <Award className={`h-4 w-4 ${isDark ? "text-zinc-400" : "text-zinc-500"}`} />
                <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>
                  {isBn ? 'ফলাফল তালিকা' : 'Results'}
                </h3>
                <span className={`text-[11px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>({filtered.length})</span>
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow className={isDark ? 'border-white/[0.04] hover:bg-transparent' : 'border-zinc-100 hover:bg-transparent'}>
                  <TableHead className="w-10">
                    <TableCheckbox checked={selection.allSelected} indeterminate={selection.someSelected} onChange={selection.toggleAll} />
                  </TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'অবস্থান' : 'Position'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'শিক্ষার্থী' : 'Student'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider hidden md:table-cell ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'প্রতিষ্ঠান' : 'Institution'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'শ্রেণী' : 'Class'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'মোট নম্বর' : 'Total'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'শতাংশ' : '%'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'গ্রেড' : 'Grade'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'বৃত্তি' : 'Scholarship'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.slice(0, 20).map(result => (
                  <TableRow key={result.id} className={`${isDark ? 'border-white/[0.04] hover:bg-white/[0.02]' : 'border-zinc-100 hover:bg-zinc-50/50'} ${selection.isSelected(result.id) ? ('bg-brand-accent-soft') : ''}`}>
                    <TableCell className="w-10">
                      <TableCheckbox checked={selection.isSelected(result.id)} onChange={() => selection.toggle(result.id)} />
                    </TableCell>
                    <TableCell>
                      <span className={`text-sm font-bold ${result.position <= 3 ? (isDark ? "text-amber-400" : "text-amber-600") : (isDark ? "text-zinc-300" : "text-zinc-600")}`}>
                        #{result.position}
                      </span>
                    </TableCell>
                    <TableCell className={`text-sm font-medium ${isDark ? "text-zinc-100" : "text-zinc-800"}`}>{result.studentName}</TableCell>
                    <TableCell className={`text-[11px] hidden md:table-cell ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>{instName(result.institutionName, result.institutionId)}</TableCell>
                    <TableCell className={`text-[11px] ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>{result.className}</TableCell>
                    <TableCell className={`text-[11px] ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>{result.totalMarks}/{result.totalFullMarks}</TableCell>
                    <TableCell className={`text-[11px] ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>{result.percentage.toFixed(1)}%</TableCell>
                    <TableCell>
                      <span className={`text-[11px] font-bold ${result.grade === 'F' ? (isDark ? "text-red-400" : "text-red-600") : (isDark ? "text-emerald-400" : "text-emerald-600")}`}>
                        {result.grade}
                      </span>
                    </TableCell>
                    <TableCell><Badge status={result.scholarshipStatus} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {selection.selectedCount > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 animate-slideUp">
          <div className={`flex items-center gap-3 px-5 py-3 rounded-md shadow-2xl ${isDark ? 'bg-[#1a1a1c] border border-white/[0.1]' : 'bg-white border border-zinc-200'}`}>
            <span className={`text-[11px] font-medium ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
              {selection.selectedCount} {isBn ? 'টি নির্বাচিত' : 'selected'}
            </span>
            <button onClick={() => { setExportScope("selected"); setShowPdfModal(true); }} className="flex items-center gap-2 px-4 py-2 rounded-md text-[11px] font-medium bg-brand-accent text-brand-accent-fg hover:opacity-90 transition-colors">
              <FileDown className="h-3.5 w-3.5" /> {isBn ? 'ডাউনলোড পিডিএফ' : 'Download PDF'}
            </button>
          </div>
        </div>
      )}

      <PdfExportModal
        open={showPdfModal}
        onClose={() => setShowPdfModal(false)}
        title={exportScope === "selected"
          ? `${isBn ? 'নির্বাচিত ফলাফল' : 'Selected results'} (${pdfData.length})`
          : (isBn ? 'ফলাফল তালিকা' : 'Results List')}
        columns={pdfColumns}
        data={pdfData}
      />
    </div>
  );
}

function ResultsSkeleton({ isDark }: { isDark: boolean }) {
  const card = isDark ? "bg-[#141416] border border-white/[0.06]" : "bg-zinc-200 border border-zinc-300 shadow-sm";

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0a0a0b]" : "bg-zinc-50"}`}>
      <div className="max-w-[1600px] mx-auto p-6 lg:p-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className={`${card} rounded-md h-[52px]`} />
          ))}
        </div>
        <div className={`${card} rounded-md h-12 mb-6`} />
        <div className={`${card} rounded-md h-64`} />
      </div>
    </div>
  );
}
