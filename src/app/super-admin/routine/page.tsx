"use client";
import { useState, useEffect, useMemo } from "react";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { useTheme } from "@/contexts/theme-context";
import { useLang } from "@/contexts/language-context";
import { cn } from "@/lib/utils/helpers";
import { useCurrentSession } from "@/lib/storage/sessions";
import { useExams, useUpdateExam } from "@/lib/storage/exams";
import { useClasses } from "@/lib/storage/classes";
import { formatDate } from "@/lib/storage/storage";
import { ExamRoutineSlot } from "@/lib/types";
import { CalendarDays, Save, Sparkles, AlertTriangle, FileText, Clock, Copy, ClipboardPaste } from "lucide-react";
import { LoadingBar } from "@/components/ui/loading-bar";

type SlotDraft = { date: string; startTime: string; endTime: string };

/**
 * All YYYY-MM-DD dates from start..end inclusive (falls back to a
 * single-day window when only start is set). Caps at 62 days.
 */
function enumerateDays(start: string, end: string): string[] {
  if (!start) return [];
  const lastStr = end || start;
  const out: string[] = [];
  const d = new Date(`${start}T00:00:00`);
  const last = new Date(`${lastStr}T00:00:00`);
  if (Number.isNaN(d.getTime()) || Number.isNaN(last.getTime()) || last < d) return [];
  while (d <= last && out.length < 62) {
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    d.setDate(d.getDate() + 1);
  }
  return out;
}

function dayLabel(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });
}

const slotKey = (classId: string, subjectId: string) => `${classId}|${subjectId}`;

export default function RoutinePage() {
  const { theme } = useTheme();
  const { lang: language } = useLang();
  const isDark = theme === "dark";
  const isBn = language === "bn";
  const { toast } = useToast();

  const [mounted, setMounted] = useState(false);
  const [selectedExamId, setSelectedExamId] = useState("");
  const [slots, setSlots] = useState<Record<string, SlotDraft>>({});
  // Copy/paste between classes: source class + its positional slot sequence.
  const [copiedRoutine, setCopiedRoutine] = useState<{ fromId: string; fromName: string; slots: SlotDraft[] } | null>(null);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { setCopiedRoutine(null); }, [selectedExamId]);

  const { data: currentSession } = useCurrentSession();
  const { data: exams = [], isFetching } = useExams(currentSession?.id, 1, 100);
  const { data: allClasses = [] } = useClasses();
  const updateExamMutation = useUpdateExam();

  const exam = useMemo(() => exams.find(e => e.id === selectedExamId), [exams, selectedExamId]);

  // Load the saved routine into the draft whenever the selected exam (or its saved routine) changes.
  useEffect(() => {
    const map: Record<string, SlotDraft> = {};
    (exam?.routine || []).forEach(r => {
      map[slotKey(r.classId, r.subjectId)] = { date: r.date, startTime: r.startTime || "", endTime: r.endTime || "" };
    });
    setSlots(map);
  }, [exam?.id, exam?.routine]);

  const classMap = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    allClasses.forEach(c => map.set(c.id, { id: c.id, name: c.name }));
    return map;
  }, [allClasses]);

  // The exam window: routine dates may ONLY fall inside these days.
  const days = useMemo(
    () => (exam ? enumerateDays(exam.examStartDate || "", exam.examEndDate || "") : []),
    [exam]
  );

  const classSections = useMemo(() => {
    if (!exam) return [];
    return exam.classes.map((classId, idx) => {
      const subjects = exam.subjects.filter(s =>
        (s.classId || '') === classId || (!s.classId && idx === 0)
      );
      const scheduled = subjects.filter(s => slots[slotKey(classId, s.id)]?.date).length;
      return { classId, name: classMap.get(classId)?.name || classId, subjects, scheduled };
    });
  }, [exam, classMap, slots]);

  const metrics = useMemo(() => {
    const total = exam?.subjects.length ?? null;
    const scheduled = classSections.reduce((n, sec) => n + sec.scheduled, 0);
    return { total, scheduled, unscheduled: total !== null ? Math.max(total - scheduled, 0) : null };
  }, [exam, classSections]);

  // Day-wise preview of the draft routine (what admit cards will read later).
  const preview = useMemo(() => {
    const rows: { date: string; startTime: string; endTime: string; className: string; subjectName: string }[] = [];
    classSections.forEach(sec => sec.subjects.forEach(s => {
      const v = slots[slotKey(sec.classId, s.id)];
      if (v?.date) rows.push({ date: v.date, startTime: v.startTime, endTime: v.endTime, className: sec.name, subjectName: s.name });
    }));
    rows.sort((a, b) =>
      a.date.localeCompare(b.date) ||
      a.className.localeCompare(b.className) ||
      (a.startTime || '99').localeCompare(b.startTime || '99')
    );
    const grouped: { date: string; rows: typeof rows }[] = [];
    rows.forEach(r => {
      const g = grouped[grouped.length - 1];
      if (g && g.date === r.date) g.rows.push(r);
      else grouped.push({ date: r.date, rows: [r] });
    });
    return grouped;
  }, [classSections, slots]);

  const setSlot = (key: string, patch: Partial<SlotDraft>) => {
    setSlots(prev => {
      const current = prev[key] ?? { date: '', startTime: '', endTime: '' };
      return { ...prev, [key]: { ...current, ...patch } };
    });
  };

  /** Copy one class's schedule (positional: subject 1st, 2nd, ...) to paste onto another class. */
  const copyClassRoutine = (sec: (typeof classSections)[0]) => {
    const seq: SlotDraft[] = sec.subjects.map(s => {
      const v = slots[slotKey(sec.classId, s.id)];
      return v ? { ...v } : { date: '', startTime: '', endTime: '' };
    });
    setCopiedRoutine({ fromId: sec.classId, fromName: sec.name, slots: seq });
    const count = seq.filter(x => x.date).length;
    toast('success', isBn
      ? `"${sec.name}" এর রুটিন কপি হয়েছে (${count} টি স্লট)`
      : `Routine of "${sec.name}" copied (${count} slot(s))`);
  };

  /** Paste the copied schedule onto this class, subject-by-position (overwrites, extra subjects cleared). */
  const pasteClassRoutine = (sec: (typeof classSections)[0]) => {
    if (!copiedRoutine) return;
    setSlots(prev => {
      const next = { ...prev };
      sec.subjects.forEach((s, i) => {
        next[slotKey(sec.classId, s.id)] = { ...(copiedRoutine.slots[i] || { date: '', startTime: '', endTime: '' }) };
      });
      return next;
    });
    const pasted = Math.min(copiedRoutine.slots.length, sec.subjects.length);
    toast('success', isBn
      ? `"${copiedRoutine.fromName}" → "${sec.name}": ${pasted} টি স্লট পেস্ট হয়েছে — প্রয়োগ করতে "রুটিন সংরক্ষণ" চাপুন`
      : `Pasted ${pasted} slot(s) "${copiedRoutine.fromName}" → "${sec.name}" — click "Save Routine" to apply`);
    if (sec.subjects.length > copiedRoutine.slots.length) {
      toast('warning', isBn
        ? `${sec.subjects.length - copiedRoutine.slots.length} টি বিষয়ের জন্য সোর্সে স্লট ছিল না — খালি রাখা হয়েছে`
        : `${sec.subjects.length - copiedRoutine.slots.length} subject(s) had no slot in the source — left unscheduled`);
    }
  };

  /** Spread each class's subjects across the window from day 1 (keeps existing times). */
  const autoSchedule = () => {
    if (!exam || days.length === 0) return;
    const next = { ...slots };
    let count = 0;
    exam.classes.forEach((classId, idx) => {
      const subjects = exam.subjects.filter(s => (s.classId || '') === classId || (!s.classId && idx === 0));
      subjects.forEach((s, i) => {
        const key = slotKey(classId, s.id);
        const prev = next[key] || { date: '', startTime: '', endTime: '' };
        next[key] = { ...prev, date: days[i % days.length] };
        count++;
      });
    });
    setSlots(next);
    toast('success', isBn ? `${count} টি বিষয় রুটিনে সাজানো হয়েছে` : `Scheduled ${count} subject(s) across the exam window`);
  };

  const handleSave = async () => {
    if (!exam) return;
    if (days.length === 0) {
      toast('error', isBn ? 'আগে পরীক্ষার শুরু/শেষ তারিখ সেট করুন (পরীক্ষা → সম্পাদনা)' : 'Set the exam start/end dates first (Exams → Edit)');
      return;
    }
    const routine: ExamRoutineSlot[] = [];
    for (const sec of classSections) {
      for (const s of sec.subjects) {
        const v = slots[slotKey(sec.classId, s.id)];
        if (!v?.date) continue;
        if (!days.includes(v.date)) {
          toast('error', isBn
            ? `"${s.name}" এর তারিখ পরীক্ষার সময়সীমার বাইরে (${v.date})`
            : `"${s.name}" date is outside the exam window (${v.date})`);
          return;
        }
        routine.push({
          id: `rts_${s.id}`,
          classId: sec.classId,
          subjectId: s.id,
          subjectName: s.name,
          date: v.date,
          startTime: v.startTime || undefined,
          endTime: v.endTime || undefined,
        });
      }
    }
    try {
      await updateExamMutation.mutateAsync({ id: exam.id, data: { routine } });
      toast('success', isBn ? `রুটিন সংরক্ষিত হয়েছে — ${routine.length} টি স্লট` : `Routine saved — ${routine.length} slot(s)`);
      if (metrics.unscheduled) {
        toast('warning', isBn
          ? `${metrics.unscheduled} টি বিষয় এখনো নির্ধারিত হয়নি`
          : `${metrics.unscheduled} subject(s) still unscheduled`);
      }
    } catch (err: any) {
      toast('error', isBn ? 'রুটিন সংরক্ষণ করা যায়নি' : (err?.message || 'Failed to save routine'));
    }
  };

  if (!mounted) return <RoutineSkeleton isDark={isDark} />;

  const card = isDark
    ? "bg-[#141416] border border-white/[0.06] rounded-md"
    : "bg-white border border-zinc-200 rounded-md shadow-sm";
  const iconBg = isDark ? "bg-white/[0.06]" : "bg-zinc-100";
  const iconColor = isDark ? "text-white" : "text-zinc-900";
  const inputCls = cn(
    "h-9 text-[12px] [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-70 hover:[&::-webkit-calendar-picker-indicator]:opacity-100",
    isDark ? "bg-white/[0.04] border-white/[0.06]" : "bg-white border-zinc-200"
  );
  const hasWindow = !!exam && days.length > 0;
  const hasSubjects = !!exam && exam.subjects.length > 0;
  const saving = updateExamMutation.isPending;

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0a0a0b]" : "bg-zinc-50"}`}>
      <LoadingBar isLoading={isFetching || saving} />
      <div className="max-w-[1600px] mx-auto p-6 lg:p-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className={`text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-zinc-900"}`}>
            {isBn ? 'পরীক্ষার রুটিন' : 'Exam Routine'}
          </h1>
          <p className="text-sm mt-1 text-zinc-500">
            {isBn
              ? 'পরীক্ষার শুরু–শেষ তারিখের মধ্যে দিনভিত্তিক বিষয় নির্ধারণ করুন — প্রবেশপত্র এই রুটিন থেকে তৈরি হবে'
              : 'Schedule subjects day-by-day inside the exam window — admit cards are built from this routine'}
          </p>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { label: isBn ? 'পরীক্ষার দিন' : 'Window Days', value: exam ? (hasWindow ? days.length : '—') : '—' },
            { label: isBn ? 'মোট বিষয়' : 'Subjects', value: metrics.total ?? '—' },
            { label: isBn ? 'নির্ধারিত' : 'Scheduled', value: metrics.scheduled ?? '—' },
            { label: isBn ? 'বাকি আছে' : 'Unscheduled', value: metrics.unscheduled ?? '—' },
          ].map((s) => (
            <div key={s.label} className={`${card} px-4 py-3 flex items-center gap-3`}>
              <div className={`h-10 w-10 rounded-md flex items-center justify-center shrink-0 ${iconBg}`}>
                <CalendarDays className={`h-5 w-5 ${iconColor}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-lg font-bold tracking-tight leading-tight ${isDark ? "text-white" : "text-zinc-900"}`}>{s.value}</p>
                <p className={`text-[11px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Controls */}
        <div className={`${card} p-4 mb-6`}>
          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            <div className="flex-1 min-w-0">
              <Select
                placeholder={isBn ? 'পরীক্ষা নির্বাচন করুন...' : 'Select an exam...'}
                options={exams.map(e => ({ label: `${e.name} (${e.code})`, value: e.id }))}
                value={selectedExamId}
                onChange={(e) => setSelectedExamId(e.target.value)}
                className={cn("w-full lg:w-96", isDark ? "bg-white/[0.04] border-white/[0.06]" : "bg-zinc-50 border-zinc-200")}
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={autoSchedule}
                disabled={!hasWindow || !hasSubjects}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2 rounded-md text-[11px] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                  isDark ? "bg-white/[0.06] text-zinc-300 hover:bg-white/[0.1]" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                )}
              >
                <Sparkles className="h-3.5 w-3.5" /> {isBn ? 'স্বয়ংক্রিয় সাজান' : 'Auto Schedule'}
              </button>
              <button
                onClick={handleSave}
                disabled={!hasWindow || saving}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2 rounded-md text-[11px] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                  isDark ? "bg-white text-black hover:bg-zinc-200" : "bg-zinc-900 text-white hover:bg-zinc-800"
                )}
              >
                <Save className="h-3.5 w-3.5" /> {saving ? (isBn ? 'সংরক্ষণ হচ্ছে...' : 'Saving...') : (isBn ? 'রুটিন সংরক্ষণ' : 'Save Routine')}
              </button>
            </div>
          </div>
          {exam && (
            <div className="flex flex-wrap items-center gap-2 mt-3">
              {hasWindow ? (
                <span className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px]", isDark ? "bg-white/[0.06] text-zinc-300" : "bg-zinc-100 text-zinc-600")}>
                  <CalendarDays className="h-3 w-3" />
                  {days.length === 1
                    ? dayLabel(days[0])
                    : `${formatDate(days[0])} → ${formatDate(days[days.length - 1])} · ${days.length} ${isBn ? 'দিন' : 'days'}`}
                </span>
              ) : (
                <span className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px]", isDark ? "bg-amber-500/10 text-amber-400" : "bg-amber-50 text-amber-700")}>
                  <AlertTriangle className="h-3 w-3" />
                  {isBn ? 'পরীক্ষার শুরু/শেষ তারিখ সেট করা হয়নি — পরীক্ষা → সম্পাদনা' : 'Exam start/end dates not set — Exams → Edit'}
                </span>
              )}
              <span className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px]", isDark ? "bg-white/[0.06] text-zinc-300" : "bg-zinc-100 text-zinc-600")}>
                <FileText className="h-3 w-3" /> {exam.name}
              </span>
            </div>
          )}
        </div>

        {/* Warnings / Empty states */}
        {!exam ? (
          <div className={`${card} py-16 flex flex-col items-center`}>
            <div className={`h-14 w-14 rounded-md flex items-center justify-center mb-4 ${iconBg}`}>
              <CalendarDays className={`h-7 w-7 ${iconColor}`} />
            </div>
            <p className={`text-sm font-medium ${isDark ? "text-white" : "text-zinc-900"}`}>
              {isBn ? 'শুরু করতে একটি পরীক্ষা নির্বাচন করুন' : 'Select an exam to build its routine'}
            </p>
          </div>
        ) : (
          <>
            {hasWindow && !hasSubjects && (
              <div className={cn("rounded-md border px-4 py-3 mb-6 text-[12px] flex items-center gap-2",
                isDark ? "border-amber-500/30 bg-amber-500/10 text-amber-400" : "border-amber-200 bg-amber-50 text-amber-700")}>
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {isBn ? 'এই পরীক্ষায় কোনো বিষয় নেই — আগে পরীক্ষা → সম্পাদনা → বিষয় ও নম্বর ধাপে বিষয় যোগ করুন।'
                  : 'This exam has no subjects — add them first in Exams → Edit → Subjects & Marks.'}
              </div>
            )}
            {exam.classes.length === 0 && (
              <div className={cn("rounded-md border px-4 py-3 mb-6 text-[12px] flex items-center gap-2",
                isDark ? "border-amber-500/30 bg-amber-500/10 text-amber-400" : "border-amber-200 bg-amber-50 text-amber-700")}>
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {isBn ? 'কোনো শ্রেণী নির্বাচিত হয়নি — পরীক্ষা → সম্পাদনা → শ্রেণী নির্বাচন।'
                  : 'No classes selected — Exams → Edit → Select Classes.'}
              </div>
            )}

            {/* Per-class scheduling */}
            {hasWindow && hasSubjects && classSections.map(sec => (
              <div key={sec.classId} className={`${card} mb-6`}>
                <div className={`px-5 py-3.5 border-b flex items-center justify-between ${isDark ? "border-white/[0.06]" : "border-zinc-100"}`}>
                  <div className="flex items-center gap-2">
                    <CalendarDays className={`h-4 w-4 ${isDark ? "text-zinc-400" : "text-zinc-500"}`} />
                    <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>{sec.name}</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => copyClassRoutine(sec)}
                      disabled={sec.scheduled === 0}
                      title={isBn ? 'এই শ্রেণীর রুটিন কপি করুন' : "Copy this class's routine"}
                      className={cn(
                        "flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                        copiedRoutine?.fromId === sec.classId
                          ? isDark ? "bg-green-500/20 text-green-400 border border-green-500/30" : "bg-green-50 text-green-700 border border-green-200"
                          : isDark ? "bg-white/[0.08] text-zinc-300 hover:bg-white/[0.12] border border-transparent" : "bg-white text-zinc-700 hover:bg-zinc-100 border border-zinc-200"
                      )}
                    >
                      <Copy className="h-3 w-3" /> {isBn ? 'কপি' : 'Copy'}
                    </button>
                    {copiedRoutine && copiedRoutine.fromId !== sec.classId && (
                      <button
                        onClick={() => pasteClassRoutine(sec)}
                        title={isBn ? `"${copiedRoutine.fromName}" থেকে পেস্ট করুন` : `Paste from "${copiedRoutine.fromName}"`}
                        className={cn(
                          "flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-colors",
                          isDark ? "bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30" : "bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
                        )}
                      >
                        <ClipboardPaste className="h-3 w-3" /> {isBn ? `পেস্ট (${copiedRoutine.fromName})` : `Paste (${copiedRoutine.fromName})`}
                      </button>
                    )}
                    <span className={cn("px-2 py-0.5 rounded text-[10px] font-medium",
                      sec.scheduled === sec.subjects.length && sec.subjects.length > 0
                        ? "bg-green-500/10 text-green-500"
                        : isDark ? "bg-white/[0.06] text-zinc-400" : "bg-zinc-100 text-zinc-500")}>
                      {sec.scheduled}/{sec.subjects.length} {isBn ? 'নির্ধারিত' : 'scheduled'}
                    </span>
                  </div>
                </div>
                {sec.subjects.length === 0 ? (
                  <div className={`px-5 py-4 text-center text-[11px] ${isDark ? 'text-zinc-600' : 'text-zinc-400'}`}>
                    {isBn ? 'এই শ্রেণীর জন্য কোনো বিষয় নেই' : 'No subjects for this class'}
                  </div>
                ) : (
                  <div className="p-4">
                    <div className="grid grid-cols-[1fr_170px_110px_110px] gap-2 mb-2 px-1">
                      <span className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>{isBn ? 'বিষয়' : 'Subject'}</span>
                      <span className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>{isBn ? 'তারিখ' : 'Date'}</span>
                      <span className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>{isBn ? 'শুরু' : 'Start'}</span>
                      <span className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>{isBn ? 'শেষ' : 'End'}</span>
                    </div>
                    <div className="space-y-2">
                      {sec.subjects.map(s => {
                        const key = slotKey(sec.classId, s.id);
                        const v = slots[key] || { date: '', startTime: '', endTime: '' };
                        const outsideWindow = !!v.date && !days.includes(v.date);
                        const dateOptions = days.map(d => ({ label: dayLabel(d), value: d }));
                        if (outsideWindow) dateOptions.unshift({ label: `${v.date} ⚠`, value: v.date });
                        return (
                          <div key={s.id} className="grid grid-cols-[1fr_170px_110px_110px] gap-2 items-center">
                            <div className="min-w-0">
                              <p className={`text-[12px] font-medium truncate ${isDark ? 'text-zinc-200' : 'text-zinc-800'}`}>{s.name}</p>
                              <p className={`text-[10px] ${isDark ? 'text-zinc-600' : 'text-zinc-400'}`}>{s.fullMarks} {isBn ? 'নম্বর' : 'marks'}</p>
                            </div>
                            <Select
                              placeholder={isBn ? 'তারিখ নির্বাচন...' : 'Select date...'}
                              options={dateOptions}
                              value={v.date}
                              onChange={(e) => setSlot(key, { date: e.target.value })}
                              className={cn("h-9 text-[12px]",
                                outsideWindow ? "border-amber-500/50" : "",
                                isDark ? "bg-white/[0.04] border-white/[0.06]" : "bg-white border-zinc-200")}
                            />
                            <Input type="time" value={v.startTime} onChange={(e) => setSlot(key, { startTime: e.target.value })}
                              className={inputCls} style={{ colorScheme: isDark ? 'dark' : 'light' }} />
                            <Input type="time" value={v.endTime} onChange={(e) => setSlot(key, { endTime: e.target.value })}
                              className={inputCls} style={{ colorScheme: isDark ? 'dark' : 'light' }} />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Day-wise preview */}
            {hasWindow && preview.length > 0 && (
              <div className={`${card} mb-6`}>
                <div className={`px-5 py-4 border-b ${isDark ? "border-white/[0.06]" : "border-zinc-100"}`}>
                  <div className="flex items-center gap-2">
                    <Clock className={`h-4 w-4 ${isDark ? "text-zinc-400" : "text-zinc-500"}`} />
                    <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>
                      {isBn ? 'দিনভিত্তিক প্রিভিউ' : 'Day-wise Preview'}
                    </h3>
                    <span className={`text-[11px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>({preview.length} {isBn ? 'দিন' : 'days'})</span>
                  </div>
                </div>
                <div className="p-4 grid md:grid-cols-2 gap-3">
                  {preview.map(day => (
                    <div key={day.date} className={`rounded-md border p-3 ${isDark ? 'border-white/[0.06] bg-white/[0.02]' : 'border-zinc-200 bg-zinc-50'}`}>
                      <p className={`text-[12px] font-semibold mb-2 ${isDark ? 'text-white' : 'text-zinc-900'}`}>{dayLabel(day.date)}</p>
                      <div className="space-y-1.5">
                        {day.rows.map((r, i) => (
                          <div key={i} className="flex items-center justify-between gap-2 text-[11px]">
                            <span className={`truncate ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                              <span className={`px-1.5 py-0.5 rounded mr-1.5 text-[9px] ${isDark ? "bg-white/[0.08] text-zinc-400" : "bg-zinc-100 text-zinc-600"}`}>{r.className}</span>
                              {r.subjectName}
                            </span>
                            <span className={`shrink-0 font-mono ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                              {r.startTime || r.endTime
                                ? `${r.startTime || '—'}${r.startTime && r.endTime ? '–' : ''}${r.endTime || ''}`
                                : '—'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function RoutineSkeleton({ isDark }: { isDark: boolean }) {
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
