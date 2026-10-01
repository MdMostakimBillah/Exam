"use client";
import { useState, useEffect, useMemo, type ReactNode } from "react";
import { MarksProcessPanel } from "@/components/marks/MarksProcessPanel";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableCheckbox } from "@/components/ui/table-checkbox";
import { useTableSelection } from "@/hooks/use-table-selection";
import { PdfExportModal, type PdfColumn } from "@/components/ui/pdf-export-modal";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import {
  useResults,
  useGenerateMarksheets,
  useExamPublishStatus,
  usePublishClassResults,
} from "@/lib/storage/results";
import { useInstitutionName } from "@/lib/storage/institutions";
import { useExamsFull } from "@/lib/storage/exams";
import { useClasses } from "@/lib/storage/classes";
import { MarksheetViewer } from "@/components/marksheet/marksheet-viewer";
import type { Result } from "@/lib/types";
import {
  Award,
  BarChart3,
  CheckCircle2,
  Download,
  FileDown,
  Play,
  ScrollText,
  Send,
  TrendingUp,
  Users,
} from "lucide-react";
import { useTheme } from "@/contexts/theme-context";
import { useLang } from "@/contexts/language-context";
import { LoadingBar } from "@/components/ui/loading-bar";

/**
 * Super-admin Results — the pipeline as three tabs, in the order the office
 * actually works:
 *
 *   1. Process by class  — run the mark setup over one class (MarksProcessPanel)
 *   2. Marksheet         — generate the transcript for an exam/class, then
 *                          view every student's sheet (download/print)
 *   3. Publish class-wise— release one class at a time; when the exam's LAST
 *                          class goes out, exams.status flips to PUBLISHED
 *                          on its own (see publishClassResults).
 */
type Tab = "process" | "marksheets" | "publish";

export default function ResultsPage() {
  const { theme } = useTheme();
  const { lang: language } = useLang();
  const isDark = theme === "dark";
  const isBn = language === "bn";
  // Institution names: stored Bangla value renders as name_en in English.
  const instName = useInstitutionName();
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("process");
  const [examFilter, setExamFilter] = useState("");
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [exportScope, setExportScope] = useState<"all" | "selected">("all");
  const [viewing, setViewing] = useState<Result | null>(null);
  const [publishingClass, setPublishingClass] = useState<string | null>(null);

  const { toast } = useToast();
  const generateMarksheets = useGenerateMarksheets();
  const publishClass = usePublishClassResults();
  const { data: allClasses = [] } = useClasses();
  const [genClass, setGenClass] = useState("");

  const { data: results = [], isFetching, error: resultsError } = useResults(undefined, 1, 500);
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
  const selectedExam = useMemo(() => exams.find(e => e.id === examFilter), [exams, examFilter]);

  /** Exam class refs → display names (refs store ids or codes). */
  const examClassNames = useMemo(() => {
    const byId = new Map(allClasses.map(c => [c.id, c.name]));
    const byCode = new Map(allClasses.map(c => [c.code, c.name]));
    return (selectedExam?.classes || [])
      .map(ref => byId.get(ref) || byCode.get(ref) || ref)
      .filter((name, i, arr) => arr.indexOf(name) === i);
  }, [allClasses, selectedExam]);

  const genClassOptions = useMemo(() => [
    { label: isBn ? 'সব শ্রেণি' : 'All classes', value: '' },
    ...examClassNames.map(name => ({ label: name, value: name })),
  ], [examClassNames, isBn]);

  // Switching exams must not keep a class that the new exam does not run.
  useEffect(() => { setGenClass(""); }, [examFilter]);

  /** Students in the marksheet tab's scope (exam + optional class). */
  const scopeResults = useMemo(
    () => (genClass ? filtered.filter(r => r.className === genClass) : filtered),
    [filtered, genClass],
  );
  const scopeGenerated = scopeResults.filter(r => r.marksheetGeneratedAt).length;

  // Publish tab: exact per-class counts, read in pages from the DB.
  const { data: publishStatus, isLoading: publishLoading } = useExamPublishStatus(examFilter);

  const tabs: { id: Tab; label: string; labelBn: string; icon: ReactNode }[] = useMemo(() => [
    { id: "process", label: "Process by class", labelBn: "শ্রেণিভিত্তিক প্রক্রিয়া", icon: <Play className="h-4 w-4" /> },
    { id: "marksheets", label: "Marksheet", labelBn: "মার্কশিট", icon: <ScrollText className="h-4 w-4" /> },
    { id: "publish", label: "Publish class-wise", labelBn: "শ্রেণিভিত্তিক প্রকাশ", icon: <Send className="h-4 w-4" /> },
  ], []);

  /**
   * Release step (0040): stamp marksheet_generated_at on this exam's results
   * (optionally one class). Until then /marksheet tells students the sheet is
   * not generated yet — results can be processed and reviewed in between.
   */
  const handleGenerateMarksheet = async () => {
    if (!examFilter || generateMarksheets.isPending) return;
    const scope = genClass
      ? `${selectedExam?.name} — ${genClass}`
      : selectedExam?.name || "";
    const okToProceed = typeof window === "undefined" || window.confirm(
      isBn
        ? `"${scope}" এর জন্য মার্কশিট তৈরি করবেন? এরপর শিক্ষার্থীরা /marksheet থেকে দেখতে ও ডাউনলোড করতে পারবে।`
        : `Generate the marksheet for "${scope}"? Students will then see and download it on /marksheet.`
    );
    if (!okToProceed) return;
    try {
      const count = await generateMarksheets.mutateAsync({
        examId: examFilter,
        className: genClass || undefined,
      });
      toast("success", isBn
        ? `${count} টি ফলাফলের মার্কশিট তৈরি হয়েছে — এখন শিক্ষার্থীরা দেখতে পারবে।`
        : `Marksheet generated for ${count} result(s) — students can now view it.`);
    } catch (err) {
      toast("error", err instanceof Error ? err.message : (isBn ? "মার্কশিট তৈরি করা যায়নি" : "Could not generate the marksheet"));
    }
  };

  /**
   * Publish tab (class-wise). Publishing the exam's LAST unpublished class
   * also flips exams.status to PUBLISHED — no second manual switch.
   */
  const handlePublishClass = async (className: string) => {
    if (!examFilter || publishClass.isPending) return;
    const scope = `${selectedExam?.name} — ${className}`;
    const okToProceed = typeof window === "undefined" || window.confirm(
      isBn
        ? `"${scope}" শ্রেণির ফলাফল প্রকাশ করবেন? শিক্ষার্থীরা এখান থেকে ফলাফল দেখতে পারবে। শেষ শ্রেণি প্রকাশ হলে পরীক্ষার স্ট্যাটাস স্বয়ংক্রিয়ভাবে "Published" হয়ে যাবে।`
        : `Publish the results of "${scope}"? Students will see them. When the exam's LAST class is published, the exam status automatically becomes "Published".`
    );
    if (!okToProceed) return;
    setPublishingClass(className);
    try {
      const res = await publishClass.mutateAsync({ examId: examFilter, className });
      if (res.examPublished) {
        toast("success", isBn
          ? `${className} শ্রেণি প্রকাশিত — সব শ্রেণি শেষ হয়েছে, পরীক্ষার স্ট্যাটাস এখন "Published"।`
          : `${className} published — every class is out, the exam status is now "Published".`);
      } else if (res.published === 0) {
        toast("warning", isBn
          ? `${className} শ্রেণি ইতিমধ্যে প্রকাশিত (${res.remaining} টি ফলাফল এখনও বাকি)`
          : `${className} was already published (${res.remaining} result(s) still pending)`);
      } else {
        toast("success", isBn
          ? `${className} শ্রেণির ${res.published} টি ফলাফল প্রকাশিত — বাকি ${res.remaining} টি`
          : `${res.published} result(s) published for ${className} — ${res.remaining} still pending`);
      }
    } catch (err) {
      toast("error", err instanceof Error ? err.message : (isBn ? "প্রকাশ করা যায়নি" : "Could not publish"));
    } finally {
      setPublishingClass(null);
    }
  };

  // Publish tab rows: every class the exam runs, merged with the classes
  // that actually hold results (so an empty class shows "no results" too).
  // Declared with the other hooks — this runs before the skeleton return.
  const publishRows = useMemo(() => {
    const fromResults = publishStatus?.classes ?? [];
    const names = [...examClassNames, ...fromResults.map(c => c.className)]
      .filter((name, i, arr) => arr.indexOf(name) === i)
      .sort((a, b) => a.localeCompare(b));
    return names.map(name => fromResults.find(c => c.className === name) || { className: name, total: 0, published: 0 });
  }, [examClassNames, publishStatus]);

  useEffect(() => { setMounted(true); }, []);

  if (!mounted) return <ResultsSkeleton isDark={isDark} />;

  const card = isDark
    ? "bg-[#141416] border border-white/[0.06] rounded-md"
    : "bg-white border border-zinc-200 rounded-md shadow-sm";
  const iconColor = "text-brand-accent";
  const inputCls = isDark ? "bg-white/[0.04] border-white/[0.06]" : "bg-zinc-50 border-zinc-200";
  const labelCls = isDark ? 'text-zinc-400' : 'text-zinc-600';
  const mutedCls = isDark ? 'text-zinc-500' : 'text-zinc-500';
  const primaryBtn = `flex items-center gap-2 px-4 py-2 rounded-md text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${isDark ? "bg-white text-zinc-900 hover:bg-zinc-200" : "bg-zinc-900 text-white hover:bg-zinc-700"}`;
  const secondaryBtn = `flex items-center gap-2 px-4 py-2 rounded-md text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${isDark ? "bg-white/[0.06] text-zinc-400 hover:text-white hover:bg-white/[0.1]" : "bg-zinc-100 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200"}`;

  /** Exam + class pickers shared by the marksheet and publish tabs. */
  const examPicker = (withClass: boolean) => (
    <div className="flex flex-col sm:flex-row gap-3">
      <div className="flex-1">
        <label className={`block text-[11px] mb-1.5 ${labelCls}`}>{isBn ? 'পরীক্ষা' : 'Exam'}</label>
        <Select
          options={examOptions}
          value={examFilter}
          onChange={(e) => setExamFilter(e.target.value)}
          className={inputCls}
        />
      </div>
      {withClass && (
        <div className="flex-1">
          <label className={`block text-[11px] mb-1.5 ${labelCls}`}>{isBn ? 'শ্রেণি' : 'Class'}</label>
          <Select
            options={genClassOptions}
            value={genClass}
            onChange={(e) => setGenClass(e.target.value)}
            disabled={!examFilter}
            className={inputCls}
          />
        </div>
      )}
    </div>
  );

  const allClassesPublished = !!publishStatus && publishStatus.total > 0 && publishStatus.published >= publishStatus.total;
  const examIsPublished = publishStatus?.examStatus === 'PUBLISHED';

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0a0a0b]" : "bg-zinc-50"}`}>
      <LoadingBar isLoading={isFetching} />
      <div className="max-w-[1600px] mx-auto p-6 lg:p-8">
        {/* Page Header */}
        <div className="mb-6 flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-accent text-brand-accent-fg shadow-lg shadow-black/10">
            <Award className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h1 className={`text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-zinc-900"}`}>
              {isBn ? 'ফলাফল' : 'Results'}
            </h1>
            <p className={`text-sm mt-1 ${mutedCls}`}>
              {isBn
                ? 'প্রক্রিয়া করুন → মার্কশিট তৈরি করুন → শ্রেণিভিত্তিক ফলাফল প্রকাশ করুন'
                : 'Process → generate marksheet → publish class by class'}
            </p>
          </div>
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

        {/* Tabs */}
        <div className={`${card} p-1.5 mb-6 flex flex-wrap gap-1.5`}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-[13px] transition-all duration-200 ${
                activeTab === tab.id
                  ? "bg-brand-accent text-brand-accent-fg font-medium"
                  : isDark ? "text-zinc-500 hover:text-white hover:bg-white/[0.05]" : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"
              }`}
            >
              {tab.icon}
              {isBn ? tab.labelBn : tab.label}
            </button>
          ))}
        </div>

        {/* ── Tab 1: process by class ── */}
        {activeTab === "process" && (
          <div className="space-y-5">
            <MarksProcessPanel />
            <div className={`${card} px-4 py-3 flex items-start gap-2.5`}>
              <span className={`mt-0.5 h-4 w-4 shrink-0 ${iconColor}`}><BarChart3 className="h-4 w-4" /></span>
              <p className={`text-[11px] leading-relaxed ${mutedCls}`}>
                {isBn
                  ? 'পরবর্তী ধাপ: "মার্কশিট" ট্যাব থেকে মার্কশিট তৈরি করুন, তারপর "শ্রেণিভিত্তিক প্রকাশ" ট্যাব থেকে একটি করে শ্রেণি প্রকাশ করুন।'
                  : 'Next steps: generate the transcript in the "Marksheet" tab, then release one class at a time in the "Publish class-wise" tab.'}
              </p>
            </div>
          </div>
        )}

        {/* ── Tab 2: generate marksheet + view every student ── */}
        {activeTab === "marksheets" && (
          <div className="space-y-6">
            <div className={`${card} p-4`}>
              {examPicker(true)}
              <div className={`mt-4 pt-4 border-t flex flex-col sm:flex-row gap-3 ${isDark ? 'border-white/[0.06]' : 'border-zinc-100'}`}>
                <div className="flex items-center gap-2 sm:self-center">
                  <ScrollText className={`h-4 w-4 ${iconColor}`} />
                  <span className={`text-[11px] font-semibold uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                    {isBn ? 'মার্কশিট তৈরি' : 'Generate marksheet'}
                  </span>
                </div>
                <div className="flex-1" />
                <div className="flex items-end">
                  <button
                    type="button"
                    disabled={!examFilter || generateMarksheets.isPending}
                    onClick={handleGenerateMarksheet}
                    className={primaryBtn}
                  >
                    {generateMarksheets.isPending
                      ? <span className="h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      : <ScrollText className="h-3.5 w-3.5" />}
                    {isBn ? 'মার্কশিট তৈরি করুন' : 'Generate marksheet'}
                  </button>
                </div>
              </div>
              <p className={`mt-2 text-[11px] ${mutedCls}`}>
                {examFilter
                  ? (
                    <>
                      <span className={`font-semibold ${scopeGenerated === scopeResults.length ? 'text-emerald-500' : 'text-amber-500'}`}>
                        {scopeGenerated}/{scopeResults.length}
                      </span>
                      {' '}
                      {isBn ? 'টি ফলাফলের মার্কশিট তৈরি হয়েছে' : 'results have a generated marksheet'}
                      {' · '}
                      {isBn
                        ? 'তৈরি করলেই শিক্ষার্থীরা /marksheet পেজে রোল, রেজিস্ট্রেশন ও জন্মতারিখ দিয়ে দেখতে ও ডাউনলোড করতে পারবে।'
                        : 'once generated, students view and download it on /marksheet with roll, registration number and date of birth.'}
                    </>
                  )
                  : (isBn ? 'মার্কশিট তৈরি করতে একটি পরীক্ষা নির্বাচন করুন। নিচে প্রতিটি শিক্ষার্থীর মার্কশিট দেখা যায়।' : 'Select an exam to generate. Every student\'s transcript is listed below.')}
              </p>
            </div>

            {/* Every student in scope */}
            {resultsError ? (
              <div className={`${card} p-10 text-center text-sm text-red-600 dark:text-red-400`}>
                {resultsError.message}
              </div>
            ) : scopeResults.length === 0 ? (
              <div className={`${card} flex flex-col items-center justify-center py-16`}>
                <div className={`h-14 w-14 rounded-md flex items-center justify-center mb-4 ${isDark ? 'bg-white/[0.08]' : 'bg-zinc-100'}`}>
                  <Award className={`h-7 w-7 ${iconColor}`} />
                </div>
                <p className={`text-sm font-medium ${isDark ? "text-white" : "text-zinc-900"}`}>{isBn ? 'কোনো ফলাফল পাওয়া যায়নি' : 'No results found'}</p>
                <p className={`text-[11px] mt-1 ${mutedCls}`}>{isBn ? 'প্রথমে ট্যাব ১ থেকে ফলাফল প্রক্রিয়া করুন।' : 'Process the results first (tab 1).'}</p>
              </div>
            ) : (
              <div className={`${card}`}>
                <div className={`px-5 py-4 border-b flex flex-wrap items-center justify-between gap-3 ${isDark ? "border-white/[0.06]" : "border-zinc-100"}`}>
                  <div className="flex items-center gap-2">
                    <ScrollText className={`h-4 w-4 ${isDark ? "text-zinc-400" : "text-zinc-500"}`} />
                    <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>
                      {isBn ? 'শিক্ষার্থীদের মার্কশিট' : "Students' marksheets"}
                    </h3>
                    <span className={`text-[11px] ${mutedCls}`}>({scopeResults.length})</span>
                  </div>
                  <button
                    type="button"
                    disabled={filtered.length === 0}
                    onClick={() => { setExportScope("all"); setShowPdfModal(true); }}
                    className={secondaryBtn}
                  >
                    <Download className="h-3.5 w-3.5" /> {isBn ? 'ফলাফল এক্সপোর্ট' : 'Export Results'}
                  </button>
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
                      <TableHead className={`text-[10px] font-medium uppercase tracking-wider hidden lg:table-cell ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'রোল' : 'Roll'}</TableHead>
                      <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'মোট নম্বর' : 'Total'}</TableHead>
                      <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'শতাংশ' : '%'}</TableHead>
                      <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'গ্রেড' : 'Grade'}</TableHead>
                      <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'মার্কশিট' : 'Marksheet'}</TableHead>
                      <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'প্রকাশ' : 'Published'}</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scopeResults.map(result => (
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
                        <TableCell className={`text-[11px] hidden lg:table-cell ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>{result.roll || '—'}</TableCell>
                        <TableCell className={`text-[11px] ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>{result.totalMarks}/{result.totalFullMarks}</TableCell>
                        <TableCell className={`text-[11px] ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>{result.percentage.toFixed(1)}%</TableCell>
                        <TableCell>
                          <span className={`text-[11px] font-bold ${result.grade === 'F' ? (isDark ? "text-red-400" : "text-red-600") : (isDark ? "text-emerald-400" : "text-emerald-600")}`}>
                            {result.grade}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                            result.marksheetGeneratedAt
                              ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                              : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                          }`}>
                            {result.marksheetGeneratedAt
                              ? (isBn ? 'তৈরি' : 'Generated')
                              : (isBn ? 'বাকি' : 'Not yet')}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                            result.status === 'PUBLISHED'
                              ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                              : 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
                          }`}>
                            {result.status === 'PUBLISHED'
                              ? (isBn ? 'প্রকাশিত' : 'Published')
                              : (isBn ? 'খসড়া' : 'Draft')}
                          </span>
                        </TableCell>
                        <TableCell>
                          <button
                            type="button"
                            onClick={() => setViewing(result)}
                            title={isBn ? 'মার্কশিট দেখুন' : 'View marksheet'}
                            className={`rounded-md p-1.5 transition-colors ${isDark ? "text-zinc-400 hover:text-white hover:bg-white/[0.08]" : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100"}`}
                          >
                            <ScrollText className="h-4 w-4" />
                          </button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}

        {/* ── Tab 3: publish class-wise (exam auto-publishes on the last class) ── */}
        {activeTab === "publish" && (
          <div className="space-y-6">
            <div className={`${card} p-4 space-y-4`}>
              {examPicker(false)}

              {examFilter && selectedExam && (
                <div className={`flex flex-wrap items-center justify-between gap-3 pt-3 border-t ${isDark ? 'border-white/[0.06]' : 'border-zinc-100'}`}>
                  <div className="flex items-center gap-2">
                    <span className={`text-[11px] ${mutedCls}`}>{isBn ? 'পরীক্ষার স্ট্যাটাস' : 'Exam status'}:</span>
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                      examIsPublished
                        ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                        : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                    }`}>
                      {examIsPublished && <CheckCircle2 className="h-3.5 w-3.5" />}
                      {selectedExam.status}
                    </span>
                  </div>
                  {publishStatus && (
                    <span className={`text-[11px] ${mutedCls}`}>
                      {isBn ? 'প্রকাশিত ফলাফল' : 'Published results'}:{" "}
                      <span className={`font-semibold ${allClassesPublished ? 'text-emerald-500' : 'text-amber-500'}`}>
                        {publishStatus.published}/{publishStatus.total}
                      </span>
                    </span>
                  )}
                </div>
              )}
            </div>

            {!examFilter ? (
              <div className={`${card} flex flex-col items-center justify-center py-16`}>
                <div className={`h-14 w-14 rounded-md flex items-center justify-center mb-4 ${isDark ? 'bg-white/[0.08]' : 'bg-zinc-100'}`}>
                  <Send className={`h-7 w-7 ${iconColor}`} />
                </div>
                <p className={`text-sm font-medium ${isDark ? "text-white" : "text-zinc-900"}`}>
                  {isBn ? 'একটি পরীক্ষা নির্বাচন করুন' : 'Select an exam'}
                </p>
                <p className={`text-[11px] mt-1 ${mutedCls}`}>
                  {isBn ? 'শ্রেণি ধরে ধরে ফলাফল প্রকাশ করতে পারুন।' : 'Publish one class at a time.'}
                </p>
              </div>
            ) : publishLoading ? (
              <div className={`${card} p-6 space-y-3`}>
                {[...Array(3)].map((_, i) => (
                  <div key={i} className={`h-12 rounded-md ${isDark ? 'bg-white/[0.05]' : 'bg-zinc-100'}`} />
                ))}
              </div>
            ) : (
              <>
                {allClassesPublished && (
                  <div className={`rounded-md border px-4 py-3 flex items-start gap-2.5 ${
                    isDark ? 'border-emerald-500/25 bg-emerald-500/10' : 'border-emerald-300 bg-emerald-50'
                  }`}>
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    <p className={`text-[12px] ${isDark ? 'text-emerald-300' : 'text-emerald-800'}`}>
                      {examIsPublished
                        ? (isBn
                          ? 'সব শ্রেণি প্রকাশিত — পরীক্ষার স্ট্যাটাস "Published"। শিক্ষার্থীরা এখন /result পেজে ফলাফল দেখতে পারে।'
                          : 'Every class is published and the exam status is "Published" — students can now see results on /result.')
                        : (isBn
                          ? 'সব শ্রেণির ফলাফল প্রকাশিত। পরীক্ষার স্ট্যাটাস "Published" হচ্ছে…'
                          : 'Every class is published — the exam status is being set to "Published".')}
                    </p>
                  </div>
                )}

                <div className={`${card}`}>
                  <div className={`px-5 py-4 border-b flex items-center gap-2 ${isDark ? "border-white/[0.06]" : "border-zinc-100"}`}>
                    <Send className={`h-4 w-4 ${isDark ? "text-zinc-400" : "text-zinc-500"}`} />
                    <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>
                      {isBn ? 'শ্রেণিভিত্তিক প্রকাশ' : 'Class-wise publishing'}
                    </h3>
                    <span className={`text-[11px] ${mutedCls}`}>
                      ({isBn ? `${selectedExam?.name}` : `${selectedExam?.name}`})
                    </span>
                  </div>

                  <div className="divide-y divide-zinc-100 dark:divide-white/[0.04]">
                    {publishRows.length === 0 && (
                      <div className={`px-5 py-8 text-center text-[12px] ${mutedCls}`}>
                        {isBn
                          ? 'এই পরীক্ষায় কোনো ফলাফল নেই — প্রথমে ট্যাব ১ থেকে ফলাফল প্রক্রিয়া করুন।'
                          : 'No results for this exam yet — process them in tab 1 first.'}
                      </div>
                    )}

                    {publishRows.map(row => {
                      const done = row.total > 0 && row.published >= row.total;
                      const noResults = row.total === 0;
                      const pending = publishingClass === row.className && publishClass.isPending;
                      const pct = row.total > 0 ? Math.round((row.published / row.total) * 100) : 0;
                      return (
                        <div key={row.className} className={`px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 ${isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-zinc-50/50'} transition-colors`}>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className={`text-sm font-medium ${isDark ? 'text-zinc-100' : 'text-zinc-800'}`}>{row.className}</p>
                              {done && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                              {noResults && (
                                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${isDark ? 'border-amber-500/25 text-amber-400' : 'border-amber-300 text-amber-600'}`}>
                                  {isBn ? 'কোনো ফলাফল নেই' : 'No results'}
                                </span>
                              )}
                            </div>
                            <div className="mt-2 flex items-center gap-2">
                              <div className={`h-1.5 w-40 max-w-[50vw] rounded-full overflow-hidden ${isDark ? 'bg-white/[0.08]' : 'bg-zinc-200'}`}>
                                <div
                                  className={`h-full rounded-full transition-all ${done ? 'bg-emerald-500' : 'bg-brand-accent'}`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className={`text-[11px] ${mutedCls}`}>{row.published}/{row.total}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {done ? (
                              <span className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-[11px] font-medium ${isDark ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-400' : 'border-emerald-300 bg-emerald-50 text-emerald-700'}`}>
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                {isBn ? 'প্রকাশিত' : 'Published'}
                              </span>
                            ) : (
                              <button
                                type="button"
                                disabled={noResults || publishClass.isPending}
                                onClick={() => handlePublishClass(row.className)}
                                className={primaryBtn}
                              >
                                {pending
                                  ? <span className="h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                  : <Send className="h-3.5 w-3.5" />}
                                {isBn ? 'এই শ্রেণি প্রকাশ করুন' : 'Publish this class'}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <p className={`text-[11px] leading-relaxed ${mutedCls}`}>
                  {isBn
                    ? 'একটি করে শ্রেণি প্রকাশ করুন — পরীক্ষার সব শ্রেণি শেষ হলে পরীক্ষার স্ট্যাটাস স্বয়ংক্রিয়ভাবে "Published" হয়ে যায়, আলাদা করে প্রকাশ করার দরকার নেই।'
                    : 'Publish one class at a time — when the exam\'s last class is published, the exam status automatically becomes "Published" (no separate switch to flip).'}
                </p>
              </>
            )}
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

      {viewing && (
        <MarksheetViewer
          result={viewing}
          onClose={() => setViewing(null)}
          note={viewing.marksheetGeneratedAt
            ? (isBn ? 'প্রকাশিত মার্কশিট — শিক্ষার্থীরা /marksheet থেকে দেখতে ও ডাউনলোড করতে পারে' : 'Released — students can view and download it on /marksheet')
            : (isBn ? 'মার্কশিট এখনও তৈরি করা হয়নি (প্রিভিউ)' : 'Marksheet not generated yet (preview)')}
        />
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
