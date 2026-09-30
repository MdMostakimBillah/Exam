"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, FileDown, Inbox, Table2, Users } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { useLang } from "@/contexts/language-context";
import { useTheme } from "@/contexts/theme-context";
import { BRANDING_DEFAULTS, useBranding } from "@/lib/storage/branding";
import { useClasses } from "@/lib/storage/classes";
import { useExamsFull } from "@/lib/storage/exams";
import { useInstitutionName, useInstitutions } from "@/lib/storage/institutions";
import { calculateGradePointForSetup, useExamMarkSetup } from "@/lib/storage/mark-setup";
import { useResultsByExamFull } from "@/lib/storage/results";
import { useCurrentSession } from "@/lib/storage/sessions";
import {
  exportTabulationPdf,
  type TabulationRow,
  type TabulationSheet,
} from "@/lib/pdf/tabulation-pdf";
import type { ExamSubject, Result } from "@/lib/types";

/**
 * Super-admin Marks page → "Tabulation" tab.
 *
 * ONE table per class: student, roll, reg no, every subject in its own
 * column, then BOTH positions side by side —
 *   • Position (All Institutions): `results.position`, which
 *     process_exam_results ranks across the SAME class in ALL institutions
 *     (RANK() PARTITION BY class_name ORDER BY total_marks DESC)
 *   • Institution Position: the same competition ranking restricted to the
 *     student's own institution (RANK() PARTITION BY class_name,
 *     institution_id) — recomputed here from the class's results so it
 *     always matches the stored overall rank's tie semantics (ties share a
 *     rank, the next rank is skipped).
 * The Download button exports the per-class PDF sheets (unchanged).
 */
export function TabulationPanel() {
  const { lang } = useLang();
  const { theme } = useTheme();
  const isBn = lang === "bn";
  const isDark = theme === "dark";
  const bi = (bn: string, en: string) => (isBn ? bn : en);
  const { toast } = useToast();
  const instName = useInstitutionName();
  const { data: branding } = useBranding();
  const { data: currentSession } = useCurrentSession();
  const { data: exams = [] } = useExamsFull();
  const { data: allClasses = [] } = useClasses();

  const [examId, setExamId] = useState("");
  const [classId, setClassId] = useState("");
  /** Optional institution scope — narrows the sheet to ONE institution's rows. */
  const [institutionId, setInstitutionId] = useState("");
  const [downloading, setDownloading] = useState(false);
  const { data: institutions = [] } = useInstitutions();

  // Default to the first exam (and its first class) so the sheet is visible
  // without hunting through selects.
  useEffect(() => {
    if (!examId && exams.length) setExamId(exams[0].id);
  }, [examId, exams]);

  const exam = useMemo(() => exams.find((item) => item.id === examId), [examId, exams]);

  const classEntries = useMemo(() => {
    const byId = new Map(allClasses.map((item) => [item.id, item]));
    const byCode = new Map(allClasses.map((item) => [item.code, item]));
    return (exam?.classes || []).map((reference) => {
      const resolved = byId.get(reference) || byCode.get(reference);
      return { id: resolved?.id || "", name: resolved?.name || reference };
    }).filter((item) => item.id);
  }, [allClasses, exam]);

  useEffect(() => {
    if (classEntries.length && !classEntries.some((item) => item.id === classId)) {
      setClassId(classEntries[0].id);
    }
  }, [classEntries, classId]);

  const { data: results = [], isLoading: resultsLoading } = useResultsByExamFull(examId, currentSession?.id);
  const { data: setup } = useExamMarkSetup(examId);

  const className = classEntries.find((item) => item.id === classId)?.name || "";

  const subjects = useMemo(
    () => (exam?.subjects || []).filter((subject) => !subject.classId || subject.classId === classId),
    [classId, exam],
  );
  const subjectById = useMemo(() => new Map(subjects.map((subject) => [subject.id, subject])), [subjects]);

  /** Average grade points across the student's subjects (GPA-5, 2dp). */
  const gpaFor = (result: Result): number | null => {
    const bands = setup?.gradeBands || [];
    if (!bands.length || !result.subjectMarks.length) return null;
    let sum = 0;
    for (const mark of result.subjectMarks) {
      const percent = mark.fullMarks > 0 ? (mark.marks / mark.fullMarks) * 100 : 0;
      sum += calculateGradePointForSetup(percent, bands) ?? 0;
    }
    return Math.round((sum / result.subjectMarks.length) * 100) / 100;
  };

  /**
   * Position first (unranked last), then total marks as the visible tie
   * order. Ties on BOTH position and total get a stable registration-number
   * tie-break — otherwise two equal students would swap rows between loads
   * (and between PDF exports), since SQL's insert order for equal ranks is
   * not guaranteed.
   */
  const byPosition = (list: Result[]) =>
    [...list].sort((a, b) => {
      const pa = a.position > 0 ? a.position : Number.MAX_SAFE_INTEGER;
      const pb = b.position > 0 ? b.position : Number.MAX_SAFE_INTEGER;
      if (pa !== pb) return pa - pb;
      if (a.totalMarks !== b.totalMarks) return b.totalMarks - a.totalMarks;
      const ra = a.registrationNumber || "";
      const rb = b.registrationNumber || "";
      if (ra !== rb) return ra.localeCompare(rb);
      return (a.studentName || "").localeCompare(b.studentName || "");
    });

  const classResults = useMemo(
    () => byPosition(results.filter((item) => item.className === className)),
    [className, results],
  );

  /**
   * Rows shown on screen (and in the PDF) after the optional institution
   * scope. Positions are NOT recomputed: the cross-institution `position`
   * stays the class-wide rank so filtering only hides rows.
   */
  const visibleClassResults = useMemo(
    () => (institutionId ? classResults.filter((item) => item.institutionId === institutionId) : classResults),
    [classResults, institutionId],
  );

  /**
   * Rank inside the student's OWN institution — RANK() PARTITION BY
   * class_name, institution_id ORDER BY total_marks DESC, mirrored in JS so
   * ties behave exactly like the stored `position` (shared rank, skipped
   * next). Keyed by result id.
   */
  const instPositionByResult = useMemo(() => {
    const map = new Map<string, number>();
    const groups = new Map<string, Result[]>();
    for (const result of classResults) {
      const key = result.institutionId || result.institutionName || "";
      const list = groups.get(key);
      if (list) list.push(result);
      else groups.set(key, [result]);
    }
    for (const list of groups.values()) {
      const sorted = [...list].sort((a, b) => b.totalMarks - a.totalMarks);
      let rank = 0;
      let prevTotal: number | null = null;
      sorted.forEach((result, index) => {
        if (prevTotal === null || result.totalMarks !== prevTotal) {
          rank = index + 1;
          prevTotal = result.totalMarks;
        }
        map.set(result.id, rank);
      });
    }
    return map;
  }, [classResults]);

  const examOptions = useMemo(
    () => exams.map((item) => ({ label: item.name, value: item.id })),
    [exams],
  );
  const classOptions = useMemo(
    () => classEntries.map((item) => ({ label: item.name, value: item.id })),
    [classEntries],
  );
  const institutionOptions = useMemo(
    () => [
      { label: isBn ? "সব প্রতিষ্ঠান" : "All institutions", value: "" },
      ...institutions.map((item) => ({ label: instName(item.name, item.id), value: item.id })),
    ],
    [institutions, instName, isBn],
  );

  const subjectsForClass = (name: string) => {
    const entry = classEntries.find((item) => item.name === name);
    const classRef =
      entry?.id ||
      allClasses.find((item) => item.name === name || item.code === name)?.id ||
      null;
    return (exam?.subjects || []).filter(
      (subject) => !subject.classId || subject.classId === classRef,
    );
  };

  const buildRow = (result: Result): TabulationRow => {
    const marks: Record<string, number | null> = {};
    for (const mark of result.subjectMarks) marks[mark.subjectId] = mark.marks;
    return {
      roll: result.roll,
      registration: result.registrationNumber,
      student: result.studentName,
      institution: instName(result.institutionName, result.institutionId),
      marks,
      total: result.totalMarks,
      totalFull: result.totalFullMarks,
      gpa: gpaFor(result),
      position: result.position,
    };
  };

  const handleDownload = async () => {
    if (!exam || downloading || results.length === 0) return;
    setDownloading(true);
    try {
      // One sheet per class — every class that has processed results, in the
      // exam's class order first, then any stragglers alphabetically. An
      // institution scope narrows every sheet to that institution's rows.
      const source = institutionId
        ? results.filter((item) => item.institutionId === institutionId)
        : results;
      if (source.length === 0) {
        toast("error", bi("এই প্রতিষ্ঠানের জন্য কোন ফলাফল নেই", "No results for this institution"));
        return;
      }
      const byClass = new Map<string, Result[]>();
      for (const result of source) {
        const list = byClass.get(result.className) || [];
        list.push(result);
        byClass.set(result.className, list);
      }
      const orderedNames = [
        ...classEntries.map((item) => item.name),
        ...[...byClass.keys()].filter(
          (name) => !classEntries.some((item) => item.name === name),
        ).sort(),
      ].filter((name) => byClass.has(name));

      const sheets: TabulationSheet[] = orderedNames.map((name) => ({
        className: name,
        subjects: subjectsForClass(name).map((subject: ExamSubject) => ({
          id: subject.id,
          name: subject.name,
          fullMarks: subject.fullMarks,
        })),
        rows: byPosition(byClass.get(name) || []).map(buildRow),
      }));
      if (sheets.length === 0) return;

      const brand = { ...BRANDING_DEFAULTS, ...(branding ?? {}) };
      const companyName = isBn ? brand.brandNameBn || brand.brandName : brand.brandName;
      const companySubtitle = isBn ? brand.brandName : "";

      await exportTabulationPdf({
        examName: exam.name,
        sessionName: currentSession?.name,
        sheets,
        companyName,
        companySubtitle,
        accent: brand.accentColor,
        watermark: brand.brandWatermark || undefined,
        watermarkText: brand.brandShort || undefined,
        labels: {
          title: bi("ট্যাবুলেশন মার্কশিট", "Tabulation Marks Sheet"),
          classLabel: bi("ক্লাস", "Class"),
          examLabel: bi("পরীক্ষা", "Exam"),
          sessionLabel: bi("সেশন", "Session"),
          candidatesLabel: bi("প্রার্থী", "Candidates"),
          subjectsLabel: bi("বিষয়", "Subjects"),
          roll: bi("রোল", "Roll"),
          reg: bi("রেজি. নং", "Reg. No"),
          student: bi("শিক্ষার্থী", "Student"),
          institution: bi("প্রতিষ্ঠান", "Institution"),
          total: bi("মোট", "Total"),
          gpa: "GPA",
          position: bi("অবস্থান", "Position"),
          absent: "—",
        },
      });
      toast("success", bi("সব ট্যাবুলেশন মার্কশিট ডাউনলোড হয়েছে", "All tabulation mark sheets downloaded"));
    } catch (error) {
      toast("error", error instanceof Error ? error.message : bi("ডাউনলোড ব্যর্থ", "Download failed"));
    } finally {
      setDownloading(false);
    }
  };

  const card = isDark
    ? "rounded-xl border border-white/[0.06] bg-[#141416]"
    : "rounded-xl border border-zinc-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]";
  const labelCls = `block text-[11px] mb-1.5 font-medium ${isDark ? "text-zinc-400" : "text-zinc-600"}`;
  const selectCls = isDark
    ? "bg-white/[0.04] border-white/[0.06] text-zinc-200"
    : "bg-zinc-50 border-zinc-200";
  const thCls = isDark ? "text-zinc-400" : "text-zinc-500";
  const mutedCls = isDark ? "text-zinc-500" : "text-zinc-500";
  const empty = results.length === 0 && !resultsLoading;

  return (
    <div className="flex flex-col gap-4 animate-fadeIn">
      {/* Filters + export */}
      <div className={`${card} p-4 flex flex-col gap-3 lg:flex-row lg:items-end`}>
        <div className="flex-1 min-w-[180px]">
          <label className={labelCls} htmlFor="tab-exam">{bi("পরীক্ষা", "Exam")}</label>
          <Select
            id="tab-exam"
            options={examOptions}
            value={examId}
            onChange={(e) => {
              setExamId(e.target.value);
              setClassId("");
            }}
            placeholder={bi("পরীক্ষা নির্বাচন করুন", "Select exam")}
            className={selectCls}
          />
        </div>
        <div className="flex-1 min-w-[180px]">
          <label className={labelCls} htmlFor="tab-class">{bi("ক্লাস", "Class")}</label>
          <Select
            id="tab-class"
            options={classOptions}
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            disabled={!classOptions.length}
            placeholder={bi("ক্লাস নির্বাচন করুন", "Select class")}
            className={selectCls}
          />
        </div>
        <div className="flex-1 min-w-[180px]">
          <label className={labelCls} htmlFor="tab-institution">{bi("প্রতিষ্ঠান", "Institution")}</label>
          <Select
            id="tab-institution"
            options={institutionOptions}
            value={institutionId}
            onChange={(e) => setInstitutionId(e.target.value)}
            className={selectCls}
          />
        </div>
        <div className="flex items-center gap-3 lg:pb-1">
          <div className={`hidden items-center gap-1.5 text-[11px] sm:flex ${mutedCls}`}>
            <Users className="h-3.5 w-3.5" />
            <span>
              {resultsLoading
                ? bi("লোড হচ্ছে...", "Loading...")
                : institutionId
                  ? `${visibleClassResults.length} / ${classResults.length} ${bi("ফলাফল", "results")}`
                  : `${results.length} ${bi("ফলাফল", "results")}`}
            </span>
          </div>
          <Button
            type="button"
            onClick={handleDownload}
            disabled={!examId || empty || downloading}
            isLoading={downloading}
          >
            <FileDown className="h-4 w-4" />
            {bi("সব মার্কশিট PDF", "Download all sheets (PDF)")}
          </Button>
        </div>
      </div>

      {/* Position explainer */}
      <div className={`flex flex-wrap items-center justify-between gap-2 px-1 text-[11px] ${mutedCls}`}>
        <span className="inline-flex items-center gap-1.5">
          <Table2 className="h-3.5 w-3.5" />
          {bi(
            "অবস্থান = একই ক্লাসের সব প্রতিষ্ঠানের মধ্যে র‍্যাঙ্ক · প্রতিষ্ঠান অবস্থান = নিজ প্রতিষ্ঠানের একই ক্লাসের মধ্যে র‍্যাঙ্ক",
            "Position = rank in this class across all institutions · Institution Position = rank within the student's own institution",
          )}
        </span>
        <span>
          {className
            ? `${className} · ${subjects.length} ${bi("বিষয়", "subjects")}`
            : ""}
        </span>
      </div>

      {/* Empty: nothing processed yet for the exam */}
      {empty ? (
        <div className={`${card} p-10 text-center`}>
          <Inbox className={`mx-auto h-8 w-8 ${isDark ? "text-zinc-600" : "text-zinc-400"}`} />
          <p className={`mt-3 text-sm font-medium ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
            {bi("এক্সামের ফলাফল এখনও প্রসেস করা হয়নি।", "Results have not been processed for this exam yet.")}
          </p>
          <p className={`mt-1 text-[11px] ${mutedCls}`}>
            {bi(
              "ট্যাবুলেশন মার্কশিট দেখতে আগে Results পাতায় ফলাফল প্রক্রিয়া করুন।",
              "Process results on the Results page first to build the tabulation.",
            )}
          </p>
          <Link href="/super-admin/results" className="mt-4 inline-block">
            <Button type="button" variant="secondary">
              {bi("Results পাতায় যান", "Go to Results")}
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      ) : visibleClassResults.length === 0 ? (
        <div className={`${card} p-8 text-center text-sm ${mutedCls}`}>
          {classResults.length > 0
            ? bi(
                "এই প্রতিষ্ঠানের জন্য এই ক্লাসে কোনো ফলাফল নেই।",
                "No results for this institution in this class.",
              )
            : bi(
                "এই ক্লাসে কোনো প্রসেসকৃত ফলাফল নেই।",
                "No processed results for this class yet.",
              )}
        </div>
      ) : (
        <div className={`${card} overflow-hidden`}>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className={isDark ? "border-white/[0.06]" : "border-zinc-200"}>
                  <TableHead className={thCls}>{bi("শিক্ষার্থী", "Student")}</TableHead>
                  <TableHead className={`text-center ${thCls}`}>{bi("রোল", "Roll")}</TableHead>
                  <TableHead className={`text-center ${thCls}`}>{bi("রেজি. নং", "Reg. No")}</TableHead>
                  {subjects.map((subject) => (
                    <TableHead key={subject.id} className={`text-center ${thCls}`}>
                      <span className="flex flex-col leading-tight">
                        <span>{subject.name}</span>
                        <span className={`text-[9px] font-normal ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>
                          /{subject.fullMarks}
                        </span>
                      </span>
                    </TableHead>
                  ))}
                  <TableHead className={`text-center font-semibold ${isDark ? "text-zinc-200" : "text-zinc-700"}`}>
                    {bi("অবস্থান (সব প্রতিষ্ঠান)", "Position (All Institutions)")}
                  </TableHead>
                  <TableHead className={`text-center font-semibold ${isDark ? "text-zinc-200" : "text-zinc-700"}`}>
                    {bi("প্রতিষ্ঠান অবস্থান", "Institution Position")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleClassResults.map((result) => {
                  const position = result.position > 0 ? result.position : 0;
                  const instPosition = instPositionByResult.get(result.id) ?? 0;
                  const rankCls = (rank: number) =>
                    rank > 0 && rank <= 3
                      ? "font-bold text-brand-accent"
                      : rank > 0
                        ? isDark ? "text-zinc-300" : "text-zinc-700"
                        : mutedCls;
                  return (
                    <TableRow
                      key={result.id}
                      className={`${isDark ? "border-white/[0.04] hover:bg-white/[0.02]" : "border-zinc-100 hover:bg-zinc-50/60"}`}
                    >
                      <TableCell className={`text-[12px] font-medium ${isDark ? "text-zinc-100" : "text-zinc-900"}`}>
                        {result.studentName}
                      </TableCell>
                      <TableCell className={`text-center text-xs ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
                        {result.roll || "—"}
                      </TableCell>
                      <TableCell className={`text-center text-xs ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
                        {result.registrationNumber || "—"}
                      </TableCell>
                      {subjects.map((subject) => {
                        const mark = result.subjectMarks.find((item) => item.subjectId === subject.id)?.marks;
                        const failed = mark !== undefined && mark < subject.passMarks;
                        return (
                          <TableCell
                            key={subject.id}
                            className={`text-center text-xs tabular-nums ${
                              failed
                                ? "text-red-500 font-medium"
                                : isDark
                                  ? "text-zinc-300"
                                  : "text-zinc-700"
                            }`}
                          >
                            {mark === undefined ? "—" : mark}
                          </TableCell>
                        );
                      })}
                      <TableCell className={`text-center text-xs tabular-nums ${rankCls(position)}`}>
                        {position > 0 ? position : "—"}
                      </TableCell>
                      <TableCell className={`text-center text-xs tabular-nums ${rankCls(instPosition)}`}>
                        {instPosition > 0 ? instPosition : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
