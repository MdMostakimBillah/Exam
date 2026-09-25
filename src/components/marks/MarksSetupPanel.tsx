"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Plus, Save, Settings2, Trash2, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { useLang } from "@/contexts/language-context";
import { useTheme } from "@/contexts/theme-context";
import { useExamsFull } from "@/lib/storage/exams";
import {
  calculateGradeForSetup,
  calculateGradePointForSetup,
  calculatePassForSetup,
  calculateScholarshipForSetup,
  useExamMarkSetup,
  useSaveExamMarkSetup,
  validateExamMarkSetup,
} from "@/lib/storage/mark-setup";
import type { ExamMarkSetup, ExamMarkSetupInput } from "@/lib/types";

interface MarksSetupPanelProps {
  onDirtyChange?: (dirty: boolean) => void;
}

function makeId(prefix: string): string {
  const random = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  return `${prefix}_${random}`;
}

export function MarksSetupPanel({ onDirtyChange }: MarksSetupPanelProps) {
  const { lang } = useLang();
  const { theme } = useTheme();
  const { toast } = useToast();
  const isBn = lang === "bn";
  const isDark = theme === "dark";
  const bi = (bn: string, en: string) => (isBn ? bn : en);

  const { data: exams = [], isLoading: examsLoading } = useExamsFull();
  const [examId, setExamId] = useState("");
  const [draft, setDraft] = useState<ExamMarkSetupInput | null>(null);
  const [baseline, setBaseline] = useState<ExamMarkSetupInput | null>(null);
  const [previewPercent, setPreviewPercent] = useState("75");
  const [pendingExamId, setPendingExamId] = useState<string | null>(null);
  const loadedExamRef = useRef("");
  const requestedExamAppliedRef = useRef(false);
  const editRevisionRef = useRef(0);
  const activeExamRef = useRef("");

  const { data: setup, isLoading: setupLoading, error: setupError } = useExamMarkSetup(examId);
  const saveSetup = useSaveExamMarkSetup();

  useEffect(() => {
    activeExamRef.current = examId;
  }, [examId]);

  useEffect(() => {
    if (!setup || setup.examId !== examId) return;
    if (loadedExamRef.current === examId && draft && baseline) return;
    const nextDraft: ExamMarkSetupInput = {
      examId: setup.examId,
      subjects: setup.subjects,
      gradeBands: setup.gradeBands,
      scholarshipCategories: setup.scholarshipCategories,
      passPercent: setup.passPercent,
    };
    loadedExamRef.current = examId;
    editRevisionRef.current = 0;
    setDraft(nextDraft);
    setBaseline(nextDraft);
  }, [baseline, draft, examId, setup]);

  useEffect(() => {
    if (typeof window === "undefined" || exams.length === 0 || requestedExamAppliedRef.current) return;
    requestedExamAppliedRef.current = true;
    const requestedExamId = new URLSearchParams(window.location.search).get("exam");
    if (requestedExamId && requestedExamId !== examId && exams.some((item) => item.id === requestedExamId)) {
      loadedExamRef.current = "";
      setDraft(null);
      setBaseline(null);
      setExamId(requestedExamId);
    }
  }, [examId, exams]);

  const dirty = !!draft && !!baseline && JSON.stringify(draft) !== JSON.stringify(baseline);
  const validation = useMemo(
    () => draft
      ? validateExamMarkSetup(draft, [], false)
      : { valid: false, errors: [], subjectErrors: {}, gradeErrors: {}, scholarshipErrors: {} },
    [draft],
  );

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  const applyExamSelection = (nextExamId: string) => {
    loadedExamRef.current = "";
    setDraft(null);
    setBaseline(null);
    setExamId(nextExamId);
    const nextUrl = nextExamId
      ? `${window.location.pathname}?exam=${encodeURIComponent(nextExamId)}`
      : window.location.pathname;
    window.history.replaceState(window.history.state, "", nextUrl);
  };

  const requestExamChange = (nextExamId: string) => {
    if (nextExamId === examId) return;
    if (dirty) {
      setPendingExamId(nextExamId);
      return;
    }
    applyExamSelection(nextExamId);
  };

  const updateGradeBand = (id: string, patch: Partial<ExamMarkSetupInput["gradeBands"][number]>) => {
    editRevisionRef.current += 1;
    setDraft((current) => current
      ? { ...current, gradeBands: current.gradeBands.map((band) => band.id === id ? { ...band, ...patch } : band) }
      : current);
  };

  const addGradeBand = () => {
    editRevisionRef.current += 1;
    setDraft((current) => current
      ? { ...current, gradeBands: [...current.gradeBands, { id: makeId("grade"), grade: "", points: 0, minPercent: 0, maxPercent: 0 }] }
      : current);
  };

  const removeGradeBand = (id: string) => {
    editRevisionRef.current += 1;
    setDraft((current) => current
      ? { ...current, gradeBands: current.gradeBands.filter((band) => band.id !== id) }
      : current);
  };

  const updateScholarship = (id: string, patch: Partial<ExamMarkSetupInput["scholarshipCategories"][number]>) => {
    editRevisionRef.current += 1;
    setDraft((current) => current
      ? { ...current, scholarshipCategories: current.scholarshipCategories.map((category) => category.id === id ? { ...category, ...patch } : category) }
      : current);
  };

  const addScholarship = () => {
    editRevisionRef.current += 1;
    setDraft((current) => current
      ? { ...current, scholarshipCategories: [...current.scholarshipCategories, { id: makeId("scholarship"), name: "", minPercent: 0, maxPercent: 0 }] }
      : current);
  };

  const removeScholarship = (id: string) => {
    editRevisionRef.current += 1;
    setDraft((current) => current
      ? { ...current, scholarshipCategories: current.scholarshipCategories.filter((category) => category.id !== id) }
      : current);
  };

  const handleSave = async () => {
    if (!draft || !validation.valid || !dirty) return;
    const savingExamId = examId;
    const savingRevision = editRevisionRef.current;
    const savingDraft = draft;
    try {
      const result = await saveSetup.mutateAsync({ input: savingDraft, examClassIds: [], validateSubjects: false });
      if (activeExamRef.current === savingExamId && editRevisionRef.current === savingRevision) {
        editRevisionRef.current = 0;
        setDraft(result.setup);
        setBaseline(result.setup);
      }
      toast("success", bi(`গ্রেড স্কেল সংরক্ষিত হয়েছে (সংস্করণ ${result.version})`, `Grade Scale saved (version ${result.version})`));
    } catch (error) {
      toast("error", error instanceof Error ? error.message : bi("গ্রেড স্কেল সংরক্ষণ ব্যর্থ", "Could not save Grade Scale"));
    }
  };

  const previewValue = Number(previewPercent);
  const previewGrade = draft && Number.isFinite(previewValue) ? calculateGradeForSetup(previewValue, draft.gradeBands) : "—";
  const previewPoints = draft && Number.isFinite(previewValue) ? calculateGradePointForSetup(previewValue, draft.gradeBands) : null;
  const previewScholarship = draft && Number.isFinite(previewValue) ? calculateScholarshipForSetup(previewValue, draft.scholarshipCategories) : "NOT_ELIGIBLE";
  const previewPass = draft && Number.isFinite(previewValue) ? calculatePassForSetup(previewValue, draft.passPercent) : false;

  const card = isDark ? "rounded-md border border-white/[0.06] bg-[#141416]" : "rounded-md border border-zinc-200 bg-white shadow-sm";
  const inputClass = isDark ? "h-9 bg-white/[0.04] border-white/[0.08] text-white" : "h-9 bg-white border-zinc-200 text-zinc-900";
  const labelClass = isDark ? "text-zinc-400" : "text-zinc-600";
  const mutedClass = "text-zinc-500";
  const headingClass = isDark ? "text-white" : "text-zinc-900";
  const borderClass = isDark ? "border-white/[0.06]" : "border-zinc-100";
  const softClass = isDark ? "bg-white/[0.02]" : "bg-zinc-50";
  const gradeError = (id: string) => validation.gradeErrors[id]?.[0];
  const scholarshipError = (id: string) => validation.scholarshipErrors[id]?.[0];

  return (
    <div className="space-y-6">
      <fieldset disabled={saveSetup.isPending} className="contents">
        <div className={card}>
          <div className={`flex flex-col gap-4 border-b px-5 py-4 sm:flex-row sm:items-end ${borderClass}`}>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <label className={`text-[11px] font-medium ${labelClass}`} htmlFor="grade-scale-exam">{bi("পরীক্ষা", "Exam")}</label>
              <Select
                id="grade-scale-exam"
                value={examId}
                onChange={(event) => requestExamChange(event.target.value)}
                options={[
                  { label: bi("পরীক্ষা নির্বাচন করুন", "Select exam"), value: "" },
                  ...exams.map((item) => ({ label: `${item.name} · ${item.code}`, value: item.id })),
                ]}
                className={isDark ? "bg-white/[0.04] border-white/[0.08]" : "bg-zinc-50 border-zinc-200"}
              />
            </div>
            {setup && (
              <div className="flex items-center gap-2 pb-1">
                <Badge variant="outline">{bi("সংস্করণ", "Version")} {setup.version}</Badge>
                {dirty ? <Badge className="border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400">{bi("অসংরক্ষিত পরিবর্তন", "Unsaved changes")}</Badge> : <Badge className="border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">{bi("সংরক্ষিত", "Saved")}</Badge>}
              </div>
            )}
          </div>
          {setup && <div className={`flex flex-col gap-3 px-5 py-3 text-[11px] sm:flex-row sm:items-center sm:justify-between ${mutedClass} ${softClass}`}><span>{bi("সর্বশেষ সংরক্ষণ", "Last saved")}: {new Date(setup.updatedAt).toLocaleString()}</span><span>{bi("বিষয় ও নম্বর Exams পাতায় থাকে", "Subjects and marks are managed on the Exams page")}</span></div>}
        </div>

        {!examId && !examsLoading && <div className={`${card} p-10 text-center`}><Settings2 className={`mx-auto mb-3 h-8 w-8 ${isDark ? "text-zinc-600" : "text-zinc-300"}`} /><p className={`text-sm font-medium ${headingClass}`}>{bi("একটি পরীক্ষা নির্বাচন করুন", "Select an exam to configure Grade Scale")}</p><p className={`mt-1 text-xs ${mutedClass}`}>{bi("গ্রেড, পয়েন্ট, পাস এবং বৃত্তির নিয়ম এখানে সেট করুন।", "Configure grades, points, pass rules, and scholarships here.")}</p></div>}
        {setupError && examId && <div className="rounded-md border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400">{setupError.message}</div>}
        {(setupLoading || examsLoading) && examId && <div className={`${card} animate-pulse p-10 text-center text-sm ${mutedClass}`}>{bi("গ্রেড স্কেল লোড হচ্ছে...", "Loading Grade Scale...")}</div>}

        {draft && (
          <>
            {validation.errors.length > 0 && <div className="rounded-md border border-red-500/20 bg-red-500/10 p-4"><div className="flex items-center gap-2 text-sm font-semibold text-red-700 dark:text-red-300"><TriangleAlert className="h-4 w-4" />{bi("গ্রেড স্কেল সংরক্ষণের আগে সমস্যাগুলো ঠিক করুন", "Fix these issues before saving Grade Scale")}</div><ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-red-600 dark:text-red-400">{validation.errors.slice(0, 8).map((error) => <li key={error}>{error}</li>)}</ul></div>}

            <section className={card}>
              <div className={`border-b px-5 py-4 ${borderClass}`}><div className="flex items-center gap-2"><Settings2 className="h-4 w-4 text-brand-accent" /><h3 className={`text-sm font-semibold ${headingClass}`}>{bi("গ্রেড স্কেল", "Grade Scale")}</h3></div><p className={`mt-1 text-[11px] ${mutedClass}`}>{bi("ডিফল্ট: A+ 5.0, A 4.0, A- 3.5, B 3.0, C 2.0, D 1.0, F 0.0। প্রয়োজন অনুযায়ী পরিবর্তন করুন।", "Default: A+ 5.0, A 4.0, A- 3.5, B 3.0, C 2.0, D 1.0, F 0.0. Change the values to match your requirement.")}</p></div>
              <div className="space-y-3 p-4">
                {draft.gradeBands.map((band) => { const error = gradeError(band.id); return <div key={band.id} className={`rounded-md border p-3 ${error ? "border-red-500/40" : isDark ? "border-white/[0.06]" : "border-zinc-200"}`}><div className="grid grid-cols-2 gap-2 md:grid-cols-[minmax(120px,1fr)_90px_110px_110px_36px]"><Input value={band.grade} onChange={(event) => updateGradeBand(band.id, { grade: event.target.value })} placeholder={bi("গ্রেড", "Grade")} className={inputClass} aria-label={bi("গ্রেড", "Grade")} /><NumberField label={bi("পয়েন্ট", "Points")} value={band.points} min={0} max={5} onChange={(value) => updateGradeBand(band.id, { points: value })} className={inputClass} /><NumberField label={bi("সর্বনিম্ন %", "Min %")} value={band.minPercent} min={0} max={100} onChange={(value) => updateGradeBand(band.id, { minPercent: value })} className={inputClass} /><NumberField label={bi("সর্বোচ্চ %", "Max %")} value={band.maxPercent} min={0} max={100} onChange={(value) => updateGradeBand(band.id, { maxPercent: value })} className={inputClass} /><Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-red-500" onClick={() => removeGradeBand(band.id)} aria-label={bi("গ্রেড মুছুন", "Remove grade")}><Trash2 className="h-4 w-4" /></Button></div>{error && <p className="mt-2 text-[11px] text-red-500">{error}</p>}</div>; })}
                <Button type="button" size="sm" variant="secondary" onClick={addGradeBand}><Plus className="mr-1.5 h-3.5 w-3.5" /> {bi("গ্রেড যোগ", "Add grade")}</Button>
              </div>
            </section>

            <section className={card}>
              <div className={`border-b px-5 py-4 ${borderClass}`}><h3 className={`text-sm font-semibold ${headingClass}`}>{bi("বৃত্তির ক্যাটাগরি", "Scholarship categories")}</h3><p className={`mt-1 text-[11px] ${mutedClass}`}>{bi("নাম ব্যবহারকারী নির্ধারণ করবেন। NOT_ELIGIBLE স্বয়ংক্রিয়।", "You define the names. NOT_ELIGIBLE remains automatic.")}</p></div>
              <div className="space-y-3 p-4">{draft.scholarshipCategories.map((category) => { const error = scholarshipError(category.id); return <div key={category.id} className={`rounded-md border p-3 ${error ? "border-red-500/40" : isDark ? "border-white/[0.06]" : "border-zinc-200"}`}><div className="grid grid-cols-2 gap-2 md:grid-cols-[minmax(180px,1fr)_120px_120px_36px]"><Input value={category.name} onChange={(event) => updateScholarship(category.id, { name: event.target.value })} placeholder={bi("ক্যাটাগরির নাম", "Category name")} className={`${inputClass} col-span-2 md:col-span-1`} aria-label={bi("ক্যাটাগরির নাম", "Category name")} /><NumberField label={bi("সর্বনিম্ন %", "Min %")} value={category.minPercent} min={0} max={100} onChange={(value) => updateScholarship(category.id, { minPercent: value })} className={inputClass} /><NumberField label={bi("সর্বোচ্চ %", "Max %")} value={category.maxPercent} min={0} max={100} onChange={(value) => updateScholarship(category.id, { maxPercent: value })} className={inputClass} /><Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-red-500" onClick={() => removeScholarship(category.id)} aria-label={bi("ক্যাটাগরি মুছুন", "Remove category")}><Trash2 className="h-4 w-4" /></Button></div>{error && <p className="mt-2 text-[11px] text-red-500">{error}</p>}</div>; })}<div className="flex flex-col gap-3 rounded-md border border-dashed border-zinc-300 p-3 dark:border-white/[0.1] sm:flex-row sm:items-center sm:justify-between"><div><p className={`text-xs font-medium ${headingClass}`}>NOT_ELIGIBLE</p><p className={`text-[11px] ${mutedClass}`}>{bi("সব বৃত্তির রেঞ্জের বাইরে স্বয়ংক্রিয়", "Automatic outside every scholarship range")}</p></div><Badge status="NOT_ELIGIBLE">{bi("স্বয়ংক্রিয়", "Automatic")}</Badge></div><Button type="button" size="sm" variant="secondary" onClick={addScholarship}><Plus className="mr-1.5 h-3.5 w-3.5" /> {bi("ক্যাটাগরি যোগ", "Add category")}</Button></div>
            </section>

            <section className={card}><div className={`grid gap-5 p-5 lg:grid-cols-[1fr_1.2fr] ${borderClass}`}><div><h3 className={`text-sm font-semibold ${headingClass}`}>{bi("পাসের শতাংশ ও নিয়ম প্রিভিউ", "Pass percentage and rule preview")}</h3><p className={`mt-1 text-[11px] ${mutedClass}`}>{bi("এই গ্রেড স্কেল নম্বর প্রবেশের সময় লাইভ গ্রেড দেখাবে।", "This Grade Scale provides live grade feedback during mark entry.")}</p></div><div className="grid gap-3 sm:grid-cols-[150px_1fr]"><div><label className={`mb-1.5 block text-[10px] font-medium uppercase tracking-wider ${labelClass}`} htmlFor="grade-scale-pass">{bi("পাস %", "Pass %")}</label><Input id="grade-scale-pass" type="number" min={0} max={100} step={0.01} value={draft.passPercent} onChange={(event) => { editRevisionRef.current += 1; setDraft({ ...draft, passPercent: Number(event.target.value) }); }} className={inputClass} aria-invalid={!!validation.passPercentError} />{validation.passPercentError && <p className="mt-1 text-[10px] text-red-500">{validation.passPercentError}</p>}</div><div><label className={`mb-1.5 block text-[10px] font-medium uppercase tracking-wider ${labelClass}`} htmlFor="grade-scale-preview">{bi("নমুনা %", "Sample %")}</label><Input id="grade-scale-preview" type="number" min={0} max={100} step={0.01} value={previewPercent} onChange={(event) => setPreviewPercent(event.target.value)} className={inputClass} /></div><div className={`flex flex-wrap items-center gap-2 rounded-md p-3 sm:col-span-2 ${softClass}`}><Badge>{bi("গ্রেড", "Grade")}: {previewGrade}{previewPoints === null ? "" : ` (${previewPoints.toFixed(1)})`}</Badge><Badge>{bi("বৃত্তি", "Scholarship")}: {previewScholarship}</Badge><Badge status={previewPass ? "APPROVED" : "REJECTED"}>{previewPass ? bi("পাস", "Pass") : bi("ফেল", "Fail")}</Badge></div></div></div></section>

            <div className={`${card} sticky bottom-4 z-10 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between`}><div className="flex items-center gap-2 text-xs">{dirty ? <TriangleAlert className="h-4 w-4 text-amber-500" /> : <CheckCircle2 className="h-4 w-4 text-emerald-500" />}<span className={dirty ? (isDark ? "text-amber-300" : "text-amber-700") : mutedClass}>{dirty ? bi("অসংরক্ষিত পরিবর্তন আছে", "You have unsaved changes") : bi("সব পরিবর্তন সংরক্ষিত", "All changes are saved")}</span></div><Button type="button" onClick={handleSave} disabled={!dirty || !validation.valid || saveSetup.isPending} isLoading={saveSetup.isPending}><Save className="mr-2 h-4 w-4" /> {bi("গ্রেড স্কেল সংরক্ষণ", "Save Grade Scale")}</Button></div>
          </>
        )}
      </fieldset>

      <Modal open={!!pendingExamId} onClose={() => setPendingExamId(null)} title={bi("অসংরক্ষিত পরিবর্তন", "Unsaved changes")} description={bi("বর্তমান গ্রেড স্কেলের অসংরক্ষিত পরিবর্তন থাকলে পরীক্ষা বদলাবেন না।", "Stay on this exam to keep its unsaved Grade Scale changes.")} maxWidth="max-w-md"><ModalFooter><Button type="button" variant="secondary" onClick={() => setPendingExamId(null)}>{bi("থাকুন", "Stay")}</Button><Button type="button" variant="destructive" onClick={() => { if (pendingExamId) applyExamSelection(pendingExamId); setPendingExamId(null); }}>{bi("পরীক্ষা বদলান", "Switch exam")}</Button></ModalFooter></Modal>
    </div>
  );
}

function NumberField({ label, value, min, max, onChange, className }: { label: string; value: number; min?: number; max?: number; onChange: (value: number) => void; className?: string }) {
  return <label className="min-w-0"><span className="mb-1 block text-[9px] font-medium uppercase tracking-wider text-zinc-500">{label}</span><Input type="number" min={min} max={max} step="0.01" value={value} onChange={(event) => onChange(Number(event.target.value))} className={className} /></label>;
}
