"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, Inbox, Play, RefreshCw, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { useLang } from "@/contexts/language-context";
import { useTheme } from "@/contexts/theme-context";
import { useExamsFull } from "@/lib/storage/exams";
import { useExamMarkSetup } from "@/lib/storage/mark-setup";
import { useProcessExamResults, useResultsByExam, type ProcessExamResultsResult } from "@/lib/storage/results";
import { useExamClassNames } from "@/lib/storage/registrations";
import { useCurrentSession } from "@/lib/storage/sessions";

export function MarksProcessPanel() {
  const { lang } = useLang();
  const { theme } = useTheme();
  const { toast } = useToast();
  const isBn = lang === "bn";
  const isDark = theme === "dark";
  const bi = (bn: string, en: string) => (isBn ? bn : en);
  const [examId, setExamId] = useState("");
  const [className, setClassName] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [lastRun, setLastRun] = useState<ProcessExamResultsResult | null>(null);
  const { data: exams = [] } = useExamsFull();
  const { data: currentSession } = useCurrentSession();
  const { data: setup } = useExamMarkSetup(examId);
  const { data: classNames = [] } = useExamClassNames(examId);
  const { data: results = [], isLoading, error: resultsError } = useResultsByExam(examId, currentSession?.id);
  const processResults = useProcessExamResults();
  const exam = useMemo(() => exams.find((item) => item.id === examId), [examId, exams]);

  // Class-wise scope: with a class selected, the preview table only shows
  // that class's stored results, mirroring what a scoped run will touch.
  const visibleResults = useMemo(
    () => (className ? results.filter((item) => item.className === className) : results),
    [className, results],
  );

  const handleProcess = async () => {
    if (!examId) return;
    try {
      const result = await processResults.mutateAsync({ examId, className: className || undefined });
      setLastRun(result);
      setConfirmOpen(false);
      if (result.totalUniqueStudents === 0) {
        toast(
          "warning",
          className
            ? bi(
              `${className} শ্রেণিতে কোনো অনুমোদিত নিবন্ধন পাওয়া যায়নি`,
              `No approved registrations found for class ${className}`,
            )
            : bi("কোনো অনুমোদিত নিবন্ধন পাওয়া যায়নি", "No approved registrations found"),
        );
        return;
      }
      const scopeBn = className ? ` (${className} শ্রেণি)` : "";
      const scopeEn = className ? ` (class ${className})` : "";
      if (result.processed === 0) {
        const n = result.skipped;
        toast(
          "warning",
          bi(
            `কোনো নতুন ফলাফল তৈরি হয়নি${scopeBn} — ${n} জনের নম্বর অসম্পূর্ণ`,
            `No new results generated${scopeEn} — ${n} student${n === 1 ? "" : "s"} ha${n === 1 ? "s" : "ve"} incomplete marks`,
          ),
        );
        return;
      }
      toast(
        "success",
        bi(
          `${result.processed} জন শিক্ষার্থীর ফলাফল প্রক্রিয়া হয়েছে${scopeBn}`,
          `${result.processed} student results processed${scopeEn}`,
        ),
      );
    } catch (error) {
      toast("error", error instanceof Error ? error.message : bi("ফলাফল প্রক্রিয়া ব্যর্থ", "Could not process results"));
    }
  };

  const card = isDark
    ? "rounded-md border border-white/[0.06] bg-[#141416]"
    : "rounded-md border border-zinc-200 bg-white shadow-sm";
  const inputClass = isDark
    ? "bg-white/[0.04] border-white/[0.08] text-white"
    : "bg-zinc-50 border-zinc-200 text-zinc-900";
  const headingClass = isDark ? "text-white" : "text-zinc-900";
  const labelClass = isDark ? "text-zinc-400" : "text-zinc-600";
  const mutedClass = isDark ? "text-zinc-500" : "text-zinc-500";
  const borderClass = isDark ? "border-white/[0.06]" : "border-zinc-100";

  return (
    <div className="space-y-5">
      <section className={card}>
        <div className={`flex items-center justify-between gap-3 border-b px-5 py-4 ${borderClass}`}>
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand-accent-soft text-brand-accent">
              <Play className="h-4 w-4" />
            </span>
            <div>
              <h3 className={`text-sm font-semibold ${headingClass}`}>{bi("পরীক্ষার ফলাফল প্রক্রিয়া", "Process exam results")}</h3>
              <p className={`mt-0.5 text-[11px] ${mutedClass}`}>{bi("নতুন নিয়ম প্রয়োগ হবে শুধু এটি স্পষ্টভাবে চালানোর পরে। শ্রেণি নির্বাচন করে একটি করে ফলাফল প্রক্রিয়া করা যায়।", "New rules apply only after this explicit run. Select a class to process one class at a time.")}</p>
            </div>
          </div>
          {examId && (
            <span className={`hidden shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-semibold sm:inline-flex ${isDark ? "border-white/[0.08] bg-white/[0.04] text-zinc-300" : "border-zinc-200 bg-zinc-50 text-zinc-600"}`}>
              <span className="h-1.5 w-1.5 rounded-full bg-brand-accent" />
              {className ? bi(`পরিধি: ${className} শ্রেণি`, `Scope: class ${className}`) : bi("পরিধি: সব শ্রেণি", "Scope: all classes")}
            </span>
          )}
        </div>
        <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-end">
          <div className="flex-1">
            <label className={`mb-1.5 block text-[11px] font-medium ${labelClass}`} htmlFor="process-results-exam">
              {bi("পরীক্ষা", "Exam")}
            </label>
            <Select
              id="process-results-exam"
              value={examId}
              onChange={(event) => { setExamId(event.target.value); setClassName(""); setLastRun(null); }}
              options={[
                { label: bi("পরীক্ষা নির্বাচন করুন", "Select exam"), value: "" },
                ...exams.map((item) => ({ label: `${item.name} · ${item.code}`, value: item.id })),
              ]}
              className={inputClass}
            />
          </div>
          <div className="flex-1">
            <label className={`mb-1.5 block text-[11px] font-medium ${labelClass}`} htmlFor="process-results-class">
              {bi("শ্রেণি", "Class")}
            </label>
            <Select
              id="process-results-class"
              value={className}
              onChange={(event) => { setClassName(event.target.value); setLastRun(null); }}
              disabled={!examId}
              options={[
                { label: bi("সব শ্রেণি", "All classes"), value: "" },
                ...classNames.map((name) => ({ label: name, value: name })),
              ]}
              className={inputClass}
            />
          </div>
          {setup && (
            <div className={`flex shrink-0 items-center gap-2 rounded-lg border px-3 py-[7px] text-[11px] ${isDark ? "border-white/[0.08] bg-white/[0.04] text-zinc-400" : "border-zinc-200 bg-zinc-50 text-zinc-600"}`}>
              <span className={`font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>{bi("গ্রেড স্কেল", "Grade Scale")} v{setup.version}</span>
              <span className={isDark ? "text-zinc-600" : "text-zinc-300"}>·</span>
              <span>{bi("পাস", "Pass")} {setup.passPercent}%</span>
            </div>
          )}
          <Button type="button" onClick={() => setConfirmOpen(true)} disabled={!examId || processResults.isPending} isLoading={processResults.isPending}>
            <Play className="mr-2 h-4 w-4" /> {bi("ফলাফল প্রক্রিয়া করুন", "Process results")}
          </Button>
        </div>
      </section>

      {examId && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              {
                icon: Users,
                label: bi("অনুমোদিত শিক্ষার্থী", "Approved students"),
                value: lastRun?.totalUniqueStudents,
                tile: "bg-brand-accent-soft text-brand-accent",
              },
              {
                icon: CheckCircle2,
                label: bi("প্রক্রিয়াকৃত", "Processed"),
                value: lastRun?.processed,
                tile: "bg-brand-accent-soft text-brand-accent",
              },
              {
                icon: AlertTriangle,
                label: bi("অসম্পূর্ণ", "Missing / incomplete"),
                value: lastRun?.missingIncomplete,
                tile: "bg-brand-accent-soft text-brand-accent",
              },
              {
                icon: RefreshCw,
                label: bi("সর্বমোট এড়িয়ে যাওয়া", "Total skipped"),
                value: lastRun?.skipped,
                tile: "bg-brand-accent-soft text-brand-accent",
              },
            ].map((item) => (
              <div key={item.label} className={`${card} px-4 py-3`}>
                <div className="flex items-center gap-3">
                  <div className={`rounded-md p-2 ${item.tile}`}><item.icon className="h-4 w-4" /></div>
                  <div>
                    <p className={`text-lg font-bold leading-none ${item.value !== undefined ? headingClass : isDark ? "text-zinc-600" : "text-zinc-300"}`}>{item.value ?? "—"}</p>
                    <p className={`mt-1 text-[10px] ${mutedClass}`}>{item.label}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {!lastRun && (
            <p className={`flex items-center gap-1.5 text-[11px] ${mutedClass}`}>
              <Info className="h-3.5 w-3.5 shrink-0" />
              {bi("ফলাফল প্রক্রিয়া করার পর এখানে পরিসংখ্যান দেখা যাবে।", "Statistics appear here after you process results.")}
            </p>
          )}

          {lastRun && (
            <div className={`flex items-start gap-2.5 rounded-md border p-4 text-xs ${lastRun.skipped > 0 ? "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300" : "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"}`}>
              {lastRun.skipped > 0
                ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
              <div>
                <p className="font-semibold">
                  {lastRun.className
                    ? bi(`পরিধি: ${lastRun.className} শ্রেণি`, `Scope: class ${lastRun.className}`)
                    : bi("পরিধি: সব শ্রেণি", "Scope: all classes")}
                </p>
                <p className="mt-0.5">
                  {lastRun.skipped > 0
                    ? bi(
                      `${lastRun.missingIncomplete} জনের কিছু বিষয় অনুপস্থিত এবং ${lastRun.withoutRequiredSubjects} জনের কোনো প্রযোজ্য বিষয় নেই। তাদের পুরোনো ফলাফল অপরিবর্তিত আছে।`,
                      `${lastRun.missingIncomplete} students have missing marks and ${lastRun.withoutRequiredSubjects} have no required subjects. Their existing results were left unchanged.`,
                    )
                    : bi("সব অনুমোদিত শিক্ষার্থীর প্রয়োজনীয় নম্বর সম্পূর্ণ।", "All approved students have complete required marks.")}
                </p>
              </div>
            </div>
          )}

          <section className={card}>
            <div className={`flex items-center justify-between border-b px-5 py-4 ${borderClass}`}>
              <div>
                <h3 className={`text-sm font-semibold ${headingClass}`}>{bi("সংরক্ষিত ফলাফল", "Stored results")}</h3>
                <p className={`mt-0.5 text-[11px] ${mutedClass}`}>
                  {exam ? `${exam.name} · ` : ""}
                  {className ? `${className} · ` : ""}
                  {Math.min(visibleResults.length, 50)} {bi("টি প্রিভিউ", "previewed")}
                </p>
              </div>
              {setup?.version !== undefined && <Badge variant="outline">v{setup.version}</Badge>}
            </div>
            {isLoading ? (
              <div className={`p-8 text-center text-sm ${mutedClass}`}>{bi("ফলাফল লোড হচ্ছে...", "Loading results...")}</div>
            ) : resultsError ? (
              <div className="p-8 text-center text-sm text-red-600 dark:text-red-400">{resultsError.message}</div>
            ) : visibleResults.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <div className={`mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl ${isDark ? "bg-white/[0.06]" : "bg-zinc-100"}`}>
                  <Inbox className={`h-6 w-6 ${isDark ? "text-zinc-500" : "text-zinc-400"}`} />
                </div>
                <p className={`text-sm font-semibold ${headingClass}`}>
                  {className
                    ? bi(`${className} শ্রেণির কোনো ফলাফল এখনও নেই।`, `No results for class ${className} yet.`)
                    : bi("এই পরীক্ষার কোনো ফলাফল এখনও নেই।", "No results exist for this exam yet.")}
                </p>
                <p className={`mx-auto mt-1 max-w-sm text-xs ${mutedClass}`}>
                  {bi("উপরে ফলাফল প্রক্রিয়া করলে তৈরি ফলাফল এখানে দেখা যাবে।", "Results you generate above will appear here.")}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className={isDark ? "border-white/[0.04] hover:bg-transparent" : "border-zinc-100 hover:bg-transparent"}>
                    <TableHead className={isDark ? "text-zinc-400" : "text-zinc-500"}>{bi("শিক্ষার্থী", "Student")}</TableHead>
                    <TableHead className={isDark ? "text-zinc-400" : "text-zinc-500"}>{bi("শ্রেণি", "Class")}</TableHead>
                    <TableHead className={isDark ? "text-zinc-400" : "text-zinc-500"}>{bi("গ্রেড", "Grade")}</TableHead>
                    <TableHead className={isDark ? "text-zinc-400" : "text-zinc-500"}>{bi("শতাংশ", "%")}</TableHead>
                    <TableHead className={isDark ? "text-zinc-400" : "text-zinc-500"}>{bi("ফলাফল", "Result")}</TableHead>
                    <TableHead className={isDark ? "text-zinc-400" : "text-zinc-500"}>{bi("বৃত্তি", "Scholarship")}</TableHead>
                    <TableHead className={isDark ? "text-zinc-400" : "text-zinc-500"}>{bi("অবস্থা", "Status")}</TableHead>
                    <TableHead className={isDark ? "text-zinc-400" : "text-zinc-500"}>{bi("গ্রেড স্কেল", "Grade Scale")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleResults.slice(0, 50).map((result) => (
                    <TableRow key={result.id} className={isDark ? "border-white/[0.04]" : "border-zinc-100"}>
                      <TableCell className={`text-sm font-medium ${isDark ? "text-zinc-100" : "text-zinc-800"}`}>{result.studentName}</TableCell>
                      <TableCell className={`text-[11px] ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>{result.className || "—"}</TableCell>
                      <TableCell><Badge>{result.grade}</Badge></TableCell>
                      <TableCell className={`text-[11px] ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>{result.percentage.toFixed(1)}%</TableCell>
                      <TableCell><Badge status={result.pass ? "APPROVED" : "REJECTED"}>{result.pass ? bi("পাস", "Pass") : bi("ফেল", "Fail")}</Badge></TableCell>
                      <TableCell><Badge status={result.scholarshipStatus}>{result.scholarshipStatus}</Badge></TableCell>
                      <TableCell><Badge status={result.status}>{result.status}</Badge></TableCell>
                      <TableCell className={`text-[11px] ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>{result.markSetupVersion ? `v${result.markSetupVersion}` : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </section>
        </>
      )}

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={bi("ফলাফল পুনরায় প্রক্রিয়া করবেন?", "Process results now?")}
        description={
          exam
            ? `${exam.name} · ${className || bi("সব শ্রেণি", "All classes")} · ${bi("গ্রেড স্কেল", "Grade Scale")} v${setup?.version || 0}`
            : ""
        }
        maxWidth="max-w-md"
      >
        <div className="space-y-3 text-sm text-zinc-600 dark:text-zinc-400">
          <p>
            {className
              ? bi(
                `শুধু ${className} শ্রেণির সব প্রয়োজনীয় বিষয়ের নম্বর পাওয়া শিক্ষার্থীদের ফলাফল তৈরি বা আপডেট হবে। অন্য শ্রেণির ফলাফল অপরিবর্তিত থাকবে।`,
                `Only ${className} students with marks for every required subject will be created or updated. Other classes are left unchanged.`,
              )
              : bi(
                "শুধু সব প্রয়োজনীয় বিষয়ের নম্বর পাওয়া শিক্ষার্থীদের ফলাফল তৈরি বা আপডেট হবে।",
                "Only students with marks for every required subject will be created or updated.",
              )}
          </p>
          <p>{bi("আগে প্রক্রিয়াকৃত ফলাফল স্পষ্টভাবে পুনরায় প্রক্রিয়া করলে DRAFT অবস্থায় ফিরবে।", "Explicit reprocessing resets previously processed rows to DRAFT.")}</p>
        </div>
        <ModalFooter>
          <Button type="button" variant="secondary" onClick={() => setConfirmOpen(false)}>{bi("বাতিল", "Cancel")}</Button>
          <Button type="button" onClick={() => void handleProcess()} isLoading={processResults.isPending}><Play className="mr-2 h-4 w-4" />{bi("নিশ্চিত করে প্রক্রিয়া", "Confirm and process")}</Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
