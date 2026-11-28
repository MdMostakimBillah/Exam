"use client";
import { useState, useEffect, useMemo } from "react";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { useTheme } from "@/contexts/theme-context";
import { useLang } from "@/contexts/language-context";
import { cn } from "@/lib/utils/helpers";
import { useCurrentSession } from "@/lib/storage/sessions";
import { useExams, useUpdateExam } from "@/lib/storage/exams";
import { useClasses } from "@/lib/storage/classes";
import { formatDate } from "@/lib/storage/storage";
import { ExamRoutineSlot, ExamSubject } from "@/lib/types";
import {
  CalendarDays,
  Save,
  Sparkles,
  AlertTriangle,
  FileText,
  Clock,
  Copy,
  ClipboardPaste,
  Plus,
  Pencil,
  Trash2,
  Check,
  Calendar,
  Layers,
} from "lucide-react";
import { LoadingBar } from "@/components/ui/loading-bar";

type SlotDraft = { date: string; startTime: string; endTime: string };

interface SubjectModalState {
  mode: "create" | "edit";
  classId: string;
  className: string;
  subjectId?: string;
  name: string;
  fullMarks: number;
  passMarks: number;
  duration: number;
  date?: string;
  startTime?: string;
  endTime?: string;
}

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
    out.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    );
    d.setDate(d.getDate() + 1);
  }
  return out;
}

function dayLabel(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
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
  const [draftSubjects, setDraftSubjects] = useState<ExamSubject[]>([]);

  // Modals state
  const [subjectModal, setSubjectModal] = useState<SubjectModalState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    subject: ExamSubject;
    classId: string;
    className: string;
  } | null>(null);
  const [showDatesModal, setShowDatesModal] = useState(false);
  const [windowStartDate, setWindowStartDate] = useState("");
  const [windowEndDate, setWindowEndDate] = useState("");
  const [selectedClassToAdd, setSelectedClassToAdd] = useState("");

  // Copy/paste between classes: source class + its positional slot sequence.
  const [copiedRoutine, setCopiedRoutine] = useState<{
    fromId: string;
    fromName: string;
    slots: SlotDraft[];
  } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setCopiedRoutine(null);
  }, [selectedExamId]);

  const { data: currentSession } = useCurrentSession();
  const { data: exams = [], isFetching } = useExams(currentSession?.id, 1, 100);
  const { data: allClasses = [] } = useClasses();
  const updateExamMutation = useUpdateExam();

  const exam = useMemo(() => exams.find((e) => e.id === selectedExamId), [exams, selectedExamId]);

  // Sync draftSubjects and slots whenever selected exam changes
  useEffect(() => {
    if (exam) {
      const normalizedSubjects = (exam.subjects || []).map((s) => ({
        ...s,
        classId: s.classId || exam.classes[0] || "",
      }));
      setDraftSubjects(normalizedSubjects);
      const map: Record<string, SlotDraft> = {};
      (exam.routine || []).forEach((r) => {
        map[slotKey(r.classId, r.subjectId)] = {
          date: r.date,
          startTime: r.startTime || "",
          endTime: r.endTime || "",
        };
      });
      setSlots(map);
      setWindowStartDate(exam.examStartDate || exam.examDate || "");
      setWindowEndDate(exam.examEndDate || exam.examStartDate || exam.examDate || "");
    } else {
      setDraftSubjects([]);
      setSlots({});
      setWindowStartDate("");
      setWindowEndDate("");
    }
  }, [exam?.id, exam?.subjects, exam?.routine, exam?.examStartDate, exam?.examEndDate, exam?.examDate]);

  const classMap = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    allClasses.forEach((c) => map.set(c.id, { id: c.id, name: c.name }));
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
      const subjects = draftSubjects.filter(
        (s) => (s.classId || "") === classId || (!s.classId && idx === 0)
      );
      const scheduled = subjects.filter((s) => slots[slotKey(classId, s.id)]?.date).length;
      return { classId, name: classMap.get(classId)?.name || classId, subjects, scheduled };
    });
  }, [exam, draftSubjects, classMap, slots]);

  const availableClassesToAdd = useMemo(() => {
    if (!exam) return [];
    return allClasses.filter((c) => !exam.classes.includes(c.id));
  }, [allClasses, exam]);

  const metrics = useMemo(() => {
    const total = draftSubjects.length;
    const scheduled = classSections.reduce((n, sec) => n + sec.scheduled, 0);
    return {
      total: exam ? total : null,
      scheduled: exam ? scheduled : null,
      unscheduled: exam ? Math.max(total - scheduled, 0) : null,
    };
  }, [exam, draftSubjects, classSections]);

  // Day-wise preview of the draft routine (what admit cards will read later).
  const preview = useMemo(() => {
    const rows: {
      date: string;
      startTime: string;
      endTime: string;
      className: string;
      subjectName: string;
    }[] = [];
    classSections.forEach((sec) =>
      sec.subjects.forEach((s) => {
        const v = slots[slotKey(sec.classId, s.id)];
        if (v?.date) {
          rows.push({
            date: v.date,
            startTime: v.startTime,
            endTime: v.endTime,
            className: sec.name,
            subjectName: s.name,
          });
        }
      })
    );
    rows.sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.className.localeCompare(b.className) ||
        (a.startTime || "99").localeCompare(b.startTime || "99")
    );
    const grouped: { date: string; rows: typeof rows }[] = [];
    rows.forEach((r) => {
      const g = grouped[grouped.length - 1];
      if (g && g.date === r.date) g.rows.push(r);
      else grouped.push({ date: r.date, rows: [r] });
    });
    return grouped;
  }, [classSections, slots]);

  const setSlot = (key: string, patch: Partial<SlotDraft>) => {
    setSlots((prev) => {
      const current = prev[key] ?? { date: "", startTime: "", endTime: "" };
      return { ...prev, [key]: { ...current, ...patch } };
    });
  };

  /** Build the clean array of ExamRoutineSlot from current state */
  const buildCurrentRoutine = (
    subjectsToUse: ExamSubject[] = draftSubjects,
    slotsToUse: Record<string, SlotDraft> = slots
  ): ExamRoutineSlot[] => {
    if (!exam) return [];
    const routine: ExamRoutineSlot[] = [];
    exam.classes.forEach((classId, idx) => {
      const classSubjs = subjectsToUse.filter(
        (s) => (s.classId || "") === classId || (!s.classId && idx === 0)
      );
      classSubjs.forEach((s) => {
        const v = slotsToUse[slotKey(classId, s.id)];
        if (v?.date && (days.length === 0 || days.includes(v.date))) {
          routine.push({
            id: `rts_${s.id}`,
            classId,
            subjectId: s.id,
            subjectName: s.name,
            date: v.date,
            startTime: v.startTime || undefined,
            endTime: v.endTime || undefined,
          });
        }
      });
    });
    return routine;
  };

  /** Open modal to add a new subject to a specific class */
  const openAddSubjectModal = (classId: string, className: string) => {
    setSubjectModal({
      mode: "create",
      classId,
      className,
      name: "",
      fullMarks: 100,
      passMarks: 33,
      duration: 150,
      date: "",
      startTime: "",
      endTime: "",
    });
  };

  /** Open modal to edit an existing subject */
  const openEditSubjectModal = (s: ExamSubject, classId: string, className: string) => {
    const existingSlot = slots[slotKey(classId, s.id)] || { date: "", startTime: "", endTime: "" };
    setSubjectModal({
      mode: "edit",
      classId,
      className,
      subjectId: s.id,
      name: s.name,
      fullMarks: s.fullMarks,
      passMarks: s.passMarks,
      duration: s.duration || 150,
      date: existingSlot.date,
      startTime: existingSlot.startTime,
      endTime: existingSlot.endTime,
    });
  };

  /** Save subject (Add or Edit) and persist to database */
  const handleSaveSubjectModal = async () => {
    if (!exam || !subjectModal) return;
    const name = subjectModal.name.trim();
    if (!name) {
      toast("error", isBn ? "বিষয়ের নাম লিখুন" : "Subject name is required");
      return;
    }

    const isDuplicate = draftSubjects.some(
      (s) =>
        (s.classId || "") === subjectModal.classId &&
        s.name.trim().toLowerCase() === name.toLowerCase() &&
        s.id !== subjectModal.subjectId
    );
    if (isDuplicate) {
      toast(
        "warning",
        isBn
          ? `এই শ্রেণীতে "${name}" নামের একটি বিষয় ইতিমধ্যে রয়েছে`
          : `A subject named "${name}" already exists in this class`
      );
    }

    let updatedSubjects: ExamSubject[];
    let updatedSlots = { ...slots };

    if (subjectModal.mode === "create") {
      const newId = `sub_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const newSubject: ExamSubject = {
        id: newId,
        classId: subjectModal.classId,
        name,
        fullMarks: Number(subjectModal.fullMarks) || 100,
        passMarks: Number(subjectModal.passMarks) || 33,
        duration: Number(subjectModal.duration) || 150,
        negativeMarks: 0,
      };
      updatedSubjects = [...draftSubjects, newSubject];

      if (subjectModal.date || subjectModal.startTime || subjectModal.endTime) {
        updatedSlots[slotKey(subjectModal.classId, newId)] = {
          date: subjectModal.date || "",
          startTime: subjectModal.startTime || "",
          endTime: subjectModal.endTime || "",
        };
      }
    } else {
      updatedSubjects = draftSubjects.map((s) =>
        s.id === subjectModal.subjectId
          ? {
              ...s,
              name,
              fullMarks: Number(subjectModal.fullMarks) || 100,
              passMarks: Number(subjectModal.passMarks) || 33,
              duration: Number(subjectModal.duration) || 150,
            }
          : s
      );

      if (subjectModal.subjectId) {
        const key = slotKey(subjectModal.classId, subjectModal.subjectId);
        updatedSlots[key] = {
          date: subjectModal.date || "",
          startTime: subjectModal.startTime || "",
          endTime: subjectModal.endTime || "",
        };
      }
    }

    setDraftSubjects(updatedSubjects);
    setSlots(updatedSlots);
    setSubjectModal(null);

    const routine = buildCurrentRoutine(updatedSubjects, updatedSlots);

    try {
      await updateExamMutation.mutateAsync({
        id: exam.id,
        data: {
          subjects: updatedSubjects,
          routine,
        },
      });
      toast(
        "success",
        subjectModal.mode === "create"
          ? isBn
            ? `"${name}" বিষয় যোগ করা হয়েছে`
            : `Subject "${name}" added successfully`
          : isBn
          ? `"${name}" বিষয় আপডেট হয়েছে`
          : `Subject "${name}" updated successfully`
      );
    } catch (err: any) {
      toast("error", err?.message || (isBn ? "সংরক্ষণ ব্যর্থ" : "Save failed"));
    }
  };

  /** Remove subject from a class */
  const handleConfirmDeleteSubject = async () => {
    if (!exam || !deleteTarget) return;
    const { subject, classId } = deleteTarget;

    const updatedSubjects = draftSubjects.filter((s) => s.id !== subject.id);
    const updatedSlots = { ...slots };
    delete updatedSlots[slotKey(classId, subject.id)];

    setDraftSubjects(updatedSubjects);
    setSlots(updatedSlots);
    setDeleteTarget(null);

    const routine = buildCurrentRoutine(updatedSubjects, updatedSlots);

    try {
      await updateExamMutation.mutateAsync({
        id: exam.id,
        data: {
          subjects: updatedSubjects,
          routine,
        },
      });
      toast(
        "success",
        isBn
          ? `"${subject.name}" বিষয় মুছে ফেলা হয়েছে`
          : `Subject "${subject.name}" removed successfully`
      );
    } catch (err: any) {
      toast("error", err?.message || (isBn ? "মুছতে ব্যর্থ" : "Delete failed"));
    }
  };

  /** Save exam window dates directly */
  const handleSaveExamWindow = async () => {
    if (!exam) return;
    if (!windowStartDate || !windowEndDate) {
      toast("error", isBn ? "শুরু ও শেষ তারিখ উভয়ই নির্বাচন করুন" : "Select both start and end dates");
      return;
    }
    if (windowEndDate < windowStartDate) {
      toast("error", isBn ? "শেষ তারিখ শুরুর তারিখের পরে হতে হবে" : "End date must be after start date");
      return;
    }

    try {
      await updateExamMutation.mutateAsync({
        id: exam.id,
        data: {
          examStartDate: windowStartDate,
          examEndDate: windowEndDate,
          examDate: windowStartDate,
        },
      });
      setShowDatesModal(false);
      toast(
        "success",
        isBn
          ? "পরীক্ষার সময়সীমা সংরক্ষিত হয়েছে"
          : "Exam window dates saved successfully"
      );
    } catch (err: any) {
      toast("error", err?.message || (isBn ? "সংরক্ষণ ব্যর্থ" : "Failed to save dates"));
    }
  };

  /** Add class to the exam directly */
  const handleAddClassToExam = async () => {
    if (!exam || !selectedClassToAdd) return;
    const nextClasses = [...exam.classes, selectedClassToAdd];
    const targetClassName = classMap.get(selectedClassToAdd)?.name || selectedClassToAdd;

    try {
      await updateExamMutation.mutateAsync({
        id: exam.id,
        data: {
          classes: nextClasses,
        },
      });
      setSelectedClassToAdd("");
      toast(
        "success",
        isBn
          ? `"${targetClassName}" পরীক্ষায় যোগ করা হয়েছে`
          : `Class "${targetClassName}" added to exam`
      );
    } catch (err: any) {
      toast("error", err?.message || (isBn ? "শ্রেণি যোগ করতে ব্যর্থ" : "Failed to add class"));
    }
  };

  /** Copy one class's schedule (positional: subject 1st, 2nd, ...) to paste onto another class. */
  const copyClassRoutine = (sec: (typeof classSections)[0]) => {
    const seq: SlotDraft[] = sec.subjects.map((s) => {
      const v = slots[slotKey(sec.classId, s.id)];
      return v ? { ...v } : { date: "", startTime: "", endTime: "" };
    });
    setCopiedRoutine({ fromId: sec.classId, fromName: sec.name, slots: seq });
    const count = seq.filter((x) => x.date).length;
    toast(
      "success",
      isBn
        ? `"${sec.name}" এর রুটিন কপি হয়েছে (${count} টি স্লট)`
        : `Routine of "${sec.name}" copied (${count} slot(s))`
    );
  };

  /** Paste the copied schedule onto this class, subject-by-position. */
  const pasteClassRoutine = (sec: (typeof classSections)[0]) => {
    if (!copiedRoutine) return;
    setSlots((prev) => {
      const next = { ...prev };
      sec.subjects.forEach((s, i) => {
        next[slotKey(sec.classId, s.id)] = {
          ...(copiedRoutine.slots[i] || { date: "", startTime: "", endTime: "" }),
        };
      });
      return next;
    });
    const pasted = Math.min(copiedRoutine.slots.length, sec.subjects.length);
    toast(
      "success",
      isBn
        ? `"${copiedRoutine.fromName}" → "${sec.name}": ${pasted} টি স্লট পেস্ট হয়েছে — প্রয়োগ করতে "রুটিন সংরক্ষণ" চাপুন`
        : `Pasted ${pasted} slot(s) "${copiedRoutine.fromName}" → "${sec.name}" — click "Save Routine" to apply`
    );
    if (sec.subjects.length > copiedRoutine.slots.length) {
      toast(
        "warning",
        isBn
          ? `${sec.subjects.length - copiedRoutine.slots.length} টি বিষয়ের জন্য সোর্সে স্লট ছিল না — খালি রাখা হয়েছে`
          : `${sec.subjects.length - copiedRoutine.slots.length} subject(s) had no slot in the source — left unscheduled`
      );
    }
  };

  /** Spread each class's subjects across the window from day 1 (keeps existing times). */
  const autoSchedule = () => {
    if (!exam || days.length === 0) return;
    const next = { ...slots };
    let count = 0;
    exam.classes.forEach((classId, idx) => {
      const subjects = draftSubjects.filter(
        (s) => (s.classId || "") === classId || (!s.classId && idx === 0)
      );
      subjects.forEach((s, i) => {
        const key = slotKey(classId, s.id);
        const prev = next[key] || { date: "", startTime: "", endTime: "" };
        next[key] = { ...prev, date: days[i % days.length] };
        count++;
      });
    });
    setSlots(next);
    toast(
      "success",
      isBn
        ? `${count} টি বিষয় রুটিনে সাজানো হয়েছে`
        : `Scheduled ${count} subject(s) across the exam window`
    );
  };

  /** Save entire routine and subjects atomically */
  const handleSave = async () => {
    if (!exam) return;
    if (days.length === 0) {
      toast(
        "error",
        isBn
          ? "আগে পরীক্ষার শুরু/শেষ তারিখ সেট করুন"
          : "Set the exam start/end dates first"
      );
      setShowDatesModal(true);
      return;
    }

    const routine: ExamRoutineSlot[] = [];
    for (const sec of classSections) {
      for (const s of sec.subjects) {
        const v = slots[slotKey(sec.classId, s.id)];
        if (!v?.date) continue;
        if (!days.includes(v.date)) {
          toast(
            "error",
            isBn
              ? `"${s.name}" এর তারিখ পরীক্ষার সময়সীমার বাইরে (${v.date})`
              : `"${s.name}" date is outside the exam window (${v.date})`
          );
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
      await updateExamMutation.mutateAsync({
        id: exam.id,
        data: {
          subjects: draftSubjects,
          routine,
        },
      });
      toast(
        "success",
        isBn
          ? `রুটিন সংরক্ষিত হয়েছে — ${routine.length} টি স্লট`
          : `Routine saved — ${routine.length} slot(s)`
      );
      if (metrics.unscheduled) {
        toast(
          "warning",
          isBn
            ? `${metrics.unscheduled} টি বিষয় এখনো নির্ধারিত হয়নি`
            : `${metrics.unscheduled} subject(s) still unscheduled`
        );
      }
    } catch (err: any) {
      toast("error", isBn ? "রুটিন সংরক্ষণ করা যায়নি" : err?.message || "Failed to save routine");
    }
  };

  if (!mounted) return <RoutineSkeleton isDark={isDark} />;

  const card = isDark
    ? "bg-[#141416] border border-white/[0.06] rounded-md"
    : "bg-white border border-zinc-200 rounded-md shadow-sm";
  const iconBg = "bg-brand-accent-soft";
  const iconColor = "text-brand-accent";
  const inputCls = cn(
    "h-9 text-[12px] [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-70 hover:[&::-webkit-calendar-picker-indicator]:opacity-100",
    isDark ? "bg-white/[0.04] border-white/[0.06]" : "bg-white border-zinc-200"
  );
  const hasWindow = !!exam && days.length > 0;
  const hasSubjects = !!exam && draftSubjects.length > 0;
  const saving = updateExamMutation.isPending;

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0a0a0b]" : "bg-zinc-50"}`}>
      <LoadingBar isLoading={isFetching || saving} />
      <div className="max-w-[1600px] mx-auto p-6 lg:p-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className={`text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-zinc-900"}`}>
            {isBn ? "পরীক্ষার রুটিন ও বিষয় ব্যবস্থাপনা" : "Exam Routine & Subject Management"}
          </h1>
          <p className="text-sm mt-1 text-zinc-500">
            {isBn
              ? "যেকোনো শ্রেণীতে নতুন বিষয় যোগ করুন, সম্পাদনা বা মুছুন এবং পরীক্ষার সময়সূচি নির্ধারণ করুন — প্রবেশপত্র এই রুটিন থেকে তৈরি হবে"
              : "Add, edit, or remove subjects for any class and schedule exam dates and times — admit cards are built from this routine"}
          </p>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { label: isBn ? "পরীক্ষার দিন" : "Window Days", value: exam ? (hasWindow ? days.length : "—") : "—" },
            { label: isBn ? "মোট বিষয়" : "Total Subjects", value: metrics.total ?? "—" },
            { label: isBn ? "নির্ধারিত" : "Scheduled", value: metrics.scheduled ?? "—" },
            { label: isBn ? "বাকি আছে" : "Unscheduled", value: metrics.unscheduled ?? "—" },
          ].map((s) => (
            <div key={s.label} className={`${card} px-4 py-3 flex items-center gap-3`}>
              <div className={`h-10 w-10 rounded-md flex items-center justify-center shrink-0 ${iconBg}`}>
                <CalendarDays className={`h-5 w-5 ${iconColor}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-lg font-bold tracking-tight leading-tight ${isDark ? "text-white" : "text-zinc-900"}`}>
                  {s.value}
                </p>
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
                placeholder={isBn ? "পরীক্ষা নির্বাচন করুন..." : "Select an exam..."}
                options={exams.map((e) => ({ label: `${e.name} (${e.code})`, value: e.id }))}
                value={selectedExamId}
                onChange={(e) => setSelectedExamId(e.target.value)}
                className={cn(
                  "w-full lg:w-96",
                  isDark ? "bg-white/[0.04] border-white/[0.06]" : "bg-zinc-50 border-zinc-200"
                )}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {exam && (
                <button
                  type="button"
                  onClick={() => setShowDatesModal(true)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-2 rounded-md text-[11px] font-medium transition-colors border",
                    isDark
                      ? "bg-white/[0.04] border-white/[0.08] text-zinc-300 hover:bg-white/[0.08]"
                      : "bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-100"
                  )}
                  title={isBn ? "পরীক্ষার শুরু ও শেষ তারিখ নির্ধারণ করুন" : "Set exam window dates"}
                >
                  <Calendar className="h-3.5 w-3.5 text-brand-accent" />
                  {isBn ? "সময়সীমা তারিখ" : "Exam Dates"}
                </button>
              )}
              <button
                type="button"
                onClick={autoSchedule}
                disabled={!hasWindow || !hasSubjects}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2 rounded-md text-[11px] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                  isDark ? "bg-white/[0.06] text-zinc-300 hover:bg-white/[0.1]" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                )}
              >
                <Sparkles className="h-3.5 w-3.5" /> {isBn ? "স্বয়ংক্রিয় সাজান" : "Auto Schedule"}
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!hasWindow || saving}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2 rounded-md text-[11px] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                  "bg-brand-accent text-brand-accent-fg hover:opacity-90"
                )}
              >
                <Save className="h-3.5 w-3.5" />{" "}
                {saving
                  ? isBn
                    ? "সংরক্ষণ হচ্ছে..."
                    : "Saving..."
                  : isBn
                  ? "রুটিন সংরক্ষণ"
                  : "Save Routine"}
              </button>
            </div>
          </div>

          {exam && (
            <div className="flex flex-wrap items-center gap-2 mt-3">
              {hasWindow ? (
                <span
                  onClick={() => setShowDatesModal(true)}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] cursor-pointer transition-colors",
                    isDark
                      ? "bg-white/[0.06] text-zinc-300 hover:bg-white/[0.1]"
                      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                  )}
                  title={isBn ? "তারিখ পরিবর্তন করতে ক্লিক করুন" : "Click to edit dates"}
                >
                  <CalendarDays className="h-3 w-3 text-brand-accent" />
                  {days.length === 1
                    ? dayLabel(days[0])
                    : `${formatDate(days[0])} → ${formatDate(days[days.length - 1])} · ${days.length} ${
                        isBn ? "দিন" : "days"
                      }`}
                  <Pencil className="h-2.5 w-2.5 ml-0.5 opacity-60" />
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowDatesModal(true)}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium transition-colors",
                    isDark
                      ? "bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
                      : "bg-amber-50 text-amber-700 hover:bg-amber-100"
                  )}
                >
                  <AlertTriangle className="h-3 w-3" />
                  {isBn
                    ? "পরীক্ষার শুরু/শেষ তারিখ সেট করা হয়নি — এখানে ক্লিক করে তারিখ দিন"
                    : "Exam start/end dates not set — Click here to set dates"}
                </button>
              )}
              <span
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px]",
                  isDark ? "bg-white/[0.06] text-zinc-300" : "bg-zinc-100 text-zinc-600"
                )}
              >
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
              {isBn ? "শুরু করতে একটি পরীক্ষা নির্বাচন করুন" : "Select an exam to build its routine"}
            </p>
          </div>
        ) : (
          <>
            {/* Inline warning to set dates if missing */}
            {!hasWindow && (
              <div
                className={cn(
                  "rounded-md border p-4 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-3",
                  isDark
                    ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                    : "border-amber-200 bg-amber-50 text-amber-800"
                )}
              >
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-semibold">
                      {isBn ? "পরীক্ষার সময়সীমা (শুরু ও শেষ তারিখ) নির্ধারণ করুন" : "Set Exam Schedule Window"}
                    </h4>
                    <p className="text-xs opacity-90 mt-0.5">
                      {isBn
                        ? "রুটিনে দিনভিত্তিক বিষয় বণ্টন করার জন্য পরীক্ষার শুরু ও শেষ তারিখ প্রয়োজন।"
                        : "Exam start and end dates are required to schedule subjects day-by-day."}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    type="date"
                    value={windowStartDate}
                    onChange={(e) => setWindowStartDate(e.target.value)}
                    className="h-8 text-xs w-36"
                  />
                  <span>→</span>
                  <Input
                    type="date"
                    value={windowEndDate}
                    onChange={(e) => setWindowEndDate(e.target.value)}
                    className="h-8 text-xs w-36"
                  />
                  <Button
                    type="button"
                    size="sm"
                    disabled={!windowStartDate || !windowEndDate || windowEndDate < windowStartDate || saving}
                    onClick={handleSaveExamWindow}
                  >
                    <Save className="h-3.5 w-3.5 mr-1" />
                    {isBn ? "তারিখ নির্ধারণ" : "Set Dates"}
                  </Button>
                </div>
              </div>
            )}

            {/* If exam has no classes at all */}
            {exam.classes.length === 0 && (
              <div
                className={cn(
                  "rounded-md border p-6 mb-6 text-center flex flex-col items-center",
                  isDark ? "border-white/[0.08] bg-white/[0.02]" : "border-zinc-200 bg-white"
                )}
              >
                <Layers className="h-10 w-10 text-zinc-400 mb-2" />
                <h4 className="text-sm font-semibold mb-1">
                  {isBn ? "এই পরীক্ষায় কোনো শ্রেণি নির্বাচন করা হয়নি" : "No classes selected for this exam"}
                </h4>
                <p className="text-xs text-zinc-500 max-w-md mb-4">
                  {isBn
                    ? "রুটিন তৈরি করতে এবং বিষয় যোগ করতে নিচে থেকে শ্রেণি নির্বাচন করে যোগ করুন।"
                    : "Add one or more classes to start adding subjects and scheduling the routine."}
                </p>
                <div className="flex items-center gap-2">
                  <Select
                    placeholder={isBn ? "শ্রেণি নির্বাচন করুন..." : "Select class..."}
                    options={availableClassesToAdd.map((c) => ({ label: c.name, value: c.id }))}
                    value={selectedClassToAdd}
                    onChange={(e) => setSelectedClassToAdd(e.target.value)}
                    className="w-56 text-xs"
                  />
                  <Button
                    type="button"
                    size="sm"
                    disabled={!selectedClassToAdd || saving}
                    onClick={handleAddClassToExam}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    {isBn ? "শ্রেণি যোগ করুন" : "Add Class"}
                  </Button>
                </div>
              </div>
            )}

            {/* Per-class scheduling & Subject Management */}
            {classSections.map((sec) => (
              <div key={sec.classId} className={`${card} mb-6`}>
                <div
                  className={`px-5 py-3.5 border-b flex flex-wrap items-center justify-between gap-3 ${
                    isDark ? "border-white/[0.06]" : "border-zinc-100"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <CalendarDays className={`h-4 w-4 ${isDark ? "text-zinc-400" : "text-zinc-500"}`} />
                    <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>
                      {sec.name}
                    </h3>
                    <button
                      type="button"
                      onClick={() => openAddSubjectModal(sec.classId, sec.name)}
                      className={cn(
                        "flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium transition-colors",
                        isDark
                          ? "bg-brand-accent/15 text-brand-accent hover:bg-brand-accent/25 border border-brand-accent/30"
                          : "bg-brand-accent/10 text-brand-accent hover:bg-brand-accent/20 border border-brand-accent/20"
                      )}
                      title={isBn ? `${sec.name}-এ নতুন বিষয় যোগ করুন` : `Add new subject to ${sec.name}`}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      {isBn ? "বিষয় যোগ করুন" : "Add Subject"}
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => copyClassRoutine(sec)}
                      disabled={sec.scheduled === 0}
                      title={isBn ? "এই শ্রেণীর রুটিন কপি করুন" : "Copy this class's routine"}
                      className={cn(
                        "flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                        copiedRoutine?.fromId === sec.classId
                          ? isDark
                            ? "bg-green-500/20 text-green-400 border border-green-500/30"
                            : "bg-green-50 text-green-700 border border-green-200"
                          : isDark
                          ? "bg-white/[0.08] text-zinc-300 hover:bg-white/[0.12] border border-transparent"
                          : "bg-white text-zinc-700 hover:bg-zinc-100 border border-zinc-200"
                      )}
                    >
                      <Copy className="h-3 w-3" /> {isBn ? "কপি" : "Copy"}
                    </button>
                    {copiedRoutine && copiedRoutine.fromId !== sec.classId && (
                      <button
                        type="button"
                        onClick={() => pasteClassRoutine(sec)}
                        title={
                          isBn
                            ? `"${copiedRoutine.fromName}" থেকে পেস্ট করুন`
                            : `Paste from "${copiedRoutine.fromName}"`
                        }
                        className={cn(
                          "flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-colors",
                          isDark
                            ? "bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30"
                            : "bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
                        )}
                      >
                        <ClipboardPaste className="h-3 w-3" />{" "}
                        {isBn ? `পেস্ট (${copiedRoutine.fromName})` : `Paste (${copiedRoutine.fromName})`}
                      </button>
                    )}
                    <span
                      className={cn(
                        "px-2 py-0.5 rounded text-[10px] font-medium",
                        sec.scheduled === sec.subjects.length && sec.subjects.length > 0
                          ? "bg-green-500/10 text-green-500"
                          : isDark
                          ? "bg-white/[0.06] text-zinc-400"
                          : "bg-zinc-100 text-zinc-500"
                      )}
                    >
                      {sec.scheduled}/{sec.subjects.length} {isBn ? "নির্ধারিত" : "scheduled"}
                    </span>
                  </div>
                </div>

                {sec.subjects.length === 0 ? (
                  <div className={`px-5 py-8 text-center text-[12px] ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>
                    <p className="mb-2.5">{isBn ? "এই শ্রেণীর জন্য কোনো বিষয় যোগ করা হয়নি" : "No subjects for this class yet"}</p>
                    <button
                      type="button"
                      onClick={() => openAddSubjectModal(sec.classId, sec.name)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-brand-accent text-brand-accent-fg hover:opacity-90 transition-opacity"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      {isBn ? "প্রথম বিষয় যোগ করুন" : "Add First Subject"}
                    </button>
                  </div>
                ) : (
                  <div className="p-4">
                    <div className="grid grid-cols-[1fr_170px_100px_100px_70px] gap-2 mb-2 px-1">
                      <span className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
                        {isBn ? "বিষয় ও নম্বর" : "Subject & Marks"}
                      </span>
                      <span className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
                        {isBn ? "তারিখ" : "Date"}
                      </span>
                      <span className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
                        {isBn ? "শুরু" : "Start"}
                      </span>
                      <span className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
                        {isBn ? "শেষ" : "End"}
                      </span>
                      <span className={`text-[10px] font-medium uppercase tracking-wider text-right ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
                        {isBn ? "কাজ" : "Action"}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {sec.subjects.map((s) => {
                        const key = slotKey(sec.classId, s.id);
                        const v = slots[key] || { date: "", startTime: "", endTime: "" };
                        const outsideWindow = !!v.date && !days.includes(v.date);
                        const dateOptions = days.map((d) => ({ label: dayLabel(d), value: d }));
                        if (outsideWindow) dateOptions.unshift({ label: `${v.date} ⚠`, value: v.date });
                        return (
                          <div
                            key={s.id}
                            className={`grid grid-cols-[1fr_170px_100px_100px_70px] gap-2 items-center rounded-md p-1.5 transition-colors ${
                              isDark ? "hover:bg-white/[0.02]" : "hover:bg-zinc-50"
                            }`}
                          >
                            <div className="min-w-0 pr-1">
                              <p className={`text-[12px] font-medium truncate ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>
                                {s.name}
                              </p>
                              <p className={`text-[10px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
                                {s.fullMarks} {isBn ? "নম্বর" : "marks"}
                                {s.passMarks ? ` · ${isBn ? "পাস" : "pass"} ${s.passMarks}` : ""}
                                {s.duration ? ` · ${s.duration} ${isBn ? "মি." : "min"}` : ""}
                              </p>
                            </div>
                            <Select
                              placeholder={isBn ? "তারিখ নির্বাচন..." : "Select date..."}
                              options={dateOptions}
                              value={v.date}
                              onChange={(e) => setSlot(key, { date: e.target.value })}
                              className={cn(
                                "h-9 text-[12px]",
                                outsideWindow ? "border-amber-500/50" : "",
                                isDark ? "bg-white/[0.04] border-white/[0.06]" : "bg-white border-zinc-200"
                              )}
                            />
                            <Input
                              type="time"
                              value={v.startTime}
                              onChange={(e) => setSlot(key, { startTime: e.target.value })}
                              className={inputCls}
                              style={{ colorScheme: isDark ? "dark" : "light" }}
                            />
                            <Input
                              type="time"
                              value={v.endTime}
                              onChange={(e) => setSlot(key, { endTime: e.target.value })}
                              className={inputCls}
                              style={{ colorScheme: isDark ? "dark" : "light" }}
                            />
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => openEditSubjectModal(s, sec.classId, sec.name)}
                                className={`p-1.5 rounded transition-colors ${
                                  isDark
                                    ? "hover:bg-white/[0.08] text-zinc-400 hover:text-white"
                                    : "hover:bg-zinc-200 text-zinc-500 hover:text-zinc-900"
                                }`}
                                title={isBn ? "বিষয় সম্পাদনা" : "Edit subject"}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteTarget({ subject: s, classId: sec.classId, className: sec.name })}
                                className="p-1.5 rounded hover:bg-red-500/10 text-zinc-400 hover:text-red-500 transition-colors"
                                title={isBn ? "বিষয় মুছে ফেলুন" : "Remove subject"}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Option to add more classes to exam if some exist unassigned */}
            {exam && availableClassesToAdd.length > 0 && (
              <div className={`${card} p-4 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3`}>
                <div className="flex items-center gap-2">
                  <Layers className={`h-4 w-4 ${iconColor}`} />
                  <span className={`text-xs font-semibold ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
                    {isBn ? "আরও শ্রেণি যুক্ত করুন" : "Add More Classes to Exam"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Select
                    placeholder={isBn ? "শ্রেণি নির্বাচন করুন..." : "Select class..."}
                    options={availableClassesToAdd.map((c) => ({ label: c.name, value: c.id }))}
                    value={selectedClassToAdd}
                    onChange={(e) => setSelectedClassToAdd(e.target.value)}
                    className="w-48 text-xs"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={!selectedClassToAdd || saving}
                    onClick={handleAddClassToExam}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    {isBn ? "শ্রেণি যোগ করুন" : "Add Class"}
                  </Button>
                </div>
              </div>
            )}

            {/* Day-wise preview */}
            {hasWindow && preview.length > 0 && (
              <div className={`${card} mb-6`}>
                <div className={`px-5 py-4 border-b ${isDark ? "border-white/[0.06]" : "border-zinc-100"}`}>
                  <div className="flex items-center gap-2">
                    <Clock className={`h-4 w-4 ${isDark ? "text-zinc-400" : "text-zinc-500"}`} />
                    <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>
                      {isBn ? "দিনভিত্তিক প্রিভিউ" : "Day-wise Preview"}
                    </h3>
                    <span className={`text-[11px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
                      ({preview.length} {isBn ? "দিন" : "days"})
                    </span>
                  </div>
                </div>
                <div className="p-4 grid md:grid-cols-2 gap-3">
                  {preview.map((day) => (
                    <div
                      key={day.date}
                      className={`rounded-md border p-3 ${
                        isDark ? "border-white/[0.06] bg-white/[0.02]" : "border-zinc-200 bg-zinc-50"
                      }`}
                    >
                      <p className={`text-[12px] font-semibold mb-2 ${isDark ? "text-white" : "text-zinc-900"}`}>
                        {dayLabel(day.date)}
                      </p>
                      <div className="space-y-1.5">
                        {day.rows.map((r, i) => (
                          <div key={i} className="flex items-center justify-between gap-2 text-[11px]">
                            <span className={`truncate ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
                              <span
                                className={`px-1.5 py-0.5 rounded mr-1.5 text-[9px] ${
                                  isDark ? "bg-white/[0.08] text-zinc-400" : "bg-zinc-100 text-zinc-600"
                                }`}
                              >
                                {r.className}
                              </span>
                              {r.subjectName}
                            </span>
                            <span className={`shrink-0 font-mono ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
                              {r.startTime || r.endTime
                                ? `${r.startTime || "—"}${r.startTime && r.endTime ? "–" : ""}${r.endTime || ""}`
                                : "—"}
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

      {/* Modal: Add or Edit Subject */}
      {subjectModal && (
        <Modal
          open={Boolean(subjectModal)}
          onClose={() => setSubjectModal(null)}
          title={
            subjectModal.mode === "create"
              ? isBn
                ? `"${subjectModal.className}"-এ নতুন বিষয় যোগ করুন`
                : `Add Subject to "${subjectModal.className}"`
              : isBn
              ? `"${subjectModal.className}" এর বিষয় সম্পাদনা`
              : `Edit Subject in "${subjectModal.className}"`
          }
          description={
            isBn
              ? "বিষয়ের নাম, পূর্ণমান ও পাস নম্বর নির্ধারণ করুন।"
              : "Set subject name, full marks, and pass marks for this class."
          }
          maxWidth="max-w-md"
        >
          <div className="space-y-4 py-2">
            <div>
              <label className={`block text-xs font-medium mb-1 ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
                {isBn ? "বিষয়ের নাম *" : "Subject Name *"}
              </label>
              <Input
                value={subjectModal.name}
                onChange={(e) => setSubjectModal({ ...subjectModal, name: e.target.value })}
                placeholder={isBn ? "যেমন: বাংলা ১ম পত্র" : "e.g., Mathematics"}
                autoFocus
              />
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label className={`block text-xs font-medium mb-1 ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
                  {isBn ? "পূর্ণমান (Full Marks)" : "Full Marks"}
                </label>
                <Input
                  type="number"
                  min="1"
                  value={subjectModal.fullMarks}
                  onChange={(e) => setSubjectModal({ ...subjectModal, fullMarks: Number(e.target.value) || 0 })}
                  placeholder="100"
                />
              </div>
              <div>
                <label className={`block text-xs font-medium mb-1 ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
                  {isBn ? "পাস নম্বর (Pass)" : "Pass Marks"}
                </label>
                <Input
                  type="number"
                  min="0"
                  value={subjectModal.passMarks}
                  onChange={(e) => setSubjectModal({ ...subjectModal, passMarks: Number(e.target.value) || 0 })}
                  placeholder="33"
                />
              </div>
              <div>
                <label className={`block text-xs font-medium mb-1 ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
                  {isBn ? "সময় (মিনিট)" : "Duration (min)"}
                </label>
                <Input
                  type="number"
                  min="1"
                  value={subjectModal.duration}
                  onChange={(e) => setSubjectModal({ ...subjectModal, duration: Number(e.target.value) || 0 })}
                  placeholder="150"
                />
              </div>
            </div>

            {hasWindow && (
              <div
                className={`rounded-lg border p-3 space-y-3 ${
                  isDark ? "border-white/[0.08] bg-white/[0.02]" : "border-zinc-200 bg-zinc-50"
                }`}
              >
                <p className={`text-[11px] font-semibold ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
                  {isBn ? "রুটিন সময়সূচি (ঐচ্ছিক)" : "Routine Schedule (Optional)"}
                </p>
                <div>
                  <label className={`block text-[11px] mb-1 ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
                    {isBn ? "পরীক্ষার তারিখ" : "Exam Date"}
                  </label>
                  <Select
                    placeholder={isBn ? "তারিখ নির্বাচন করুন..." : "Select date..."}
                    options={[
                      { label: isBn ? "নির্ধারিত নয়" : "Unscheduled", value: "" },
                      ...days.map((d) => ({ label: dayLabel(d), value: d })),
                    ]}
                    value={subjectModal.date || ""}
                    onChange={(e) => setSubjectModal({ ...subjectModal, date: e.target.value })}
                    className="text-xs"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={`block text-[11px] mb-1 ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
                      {isBn ? "শুরু" : "Start Time"}
                    </label>
                    <Input
                      type="time"
                      value={subjectModal.startTime || ""}
                      onChange={(e) => setSubjectModal({ ...subjectModal, startTime: e.target.value })}
                      className="text-xs"
                      style={{ colorScheme: isDark ? "dark" : "light" }}
                    />
                  </div>
                  <div>
                    <label className={`block text-[11px] mb-1 ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
                      {isBn ? "শেষ" : "End Time"}
                    </label>
                    <Input
                      type="time"
                      value={subjectModal.endTime || ""}
                      onChange={(e) => setSubjectModal({ ...subjectModal, endTime: e.target.value })}
                      className="text-xs"
                      style={{ colorScheme: isDark ? "dark" : "light" }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
          <ModalFooter>
            <Button type="button" variant="secondary" onClick={() => setSubjectModal(null)}>
              {isBn ? "বাতিল" : "Cancel"}
            </Button>
            <Button
              type="button"
              variant="default"
              onClick={handleSaveSubjectModal}
              disabled={!subjectModal.name.trim() || saving}
              isLoading={saving}
            >
              <Check className="h-4 w-4 mr-1" />
              {subjectModal.mode === "create"
                ? isBn
                  ? "বিষয় যোগ করুন"
                  : "Add Subject"
                : isBn
                ? "আপডেট করুন"
                : "Update Subject"}
            </Button>
          </ModalFooter>
        </Modal>
      )}

      {/* Modal: Delete Subject Confirmation */}
      {deleteTarget && (
        <Modal
          open={Boolean(deleteTarget)}
          onClose={() => setDeleteTarget(null)}
          title={isBn ? "বিষয়টি মুছে ফেলতে চান?" : "Remove Subject?"}
          description={
            isBn
              ? `"${deleteTarget.className}" থেকে "${deleteTarget.subject.name}" বিষয়টি মুছে ফেলা হবে। এই বিষয়ের সংরক্ষিত রুটিন স্লটও মুছে যাবে।`
              : `"${deleteTarget.subject.name}" will be removed from "${deleteTarget.className}". Any scheduled routine slot for this subject will also be deleted.`
          }
          maxWidth="max-w-sm"
        >
          <ModalFooter>
            <Button type="button" variant="secondary" onClick={() => setDeleteTarget(null)}>
              {isBn ? "বাতিল" : "Cancel"}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmDeleteSubject}
              isLoading={saving}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              {isBn ? "মুছে ফেলুন" : "Remove"}
            </Button>
          </ModalFooter>
        </Modal>
      )}

      {/* Modal: Set Exam Dates Window */}
      {showDatesModal && exam && (
        <Modal
          open={showDatesModal}
          onClose={() => setShowDatesModal(false)}
          title={isBn ? "পরীক্ষার শুরু ও শেষ তারিখ" : "Exam Window Dates"}
          description={
            isBn
              ? `"${exam.name}" পরীক্ষার সময়সীমা নির্ধারণ করুন। রুটিনের সকল তারিখ এই সীমার মধ্যে থাকতে হবে।`
              : `Set the start and end dates for "${exam.name}". All routine slots will be scheduled within these dates.`
          }
          maxWidth="max-w-md"
        >
          <div className="space-y-4 py-2">
            <div>
              <label className={`block text-xs font-medium mb-1 ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
                {isBn ? "পরীক্ষা শুরুর তারিখ *" : "Exam Start Date *"}
              </label>
              <Input
                type="date"
                value={windowStartDate}
                onChange={(e) => setWindowStartDate(e.target.value)}
              />
            </div>
            <div>
              <label className={`block text-xs font-medium mb-1 ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
                {isBn ? "পরীক্ষা শেষ তারিখ *" : "Exam End Date *"}
              </label>
              <Input
                type="date"
                value={windowEndDate}
                onChange={(e) => setWindowEndDate(e.target.value)}
              />
            </div>
          </div>
          <ModalFooter>
            <Button type="button" variant="secondary" onClick={() => setShowDatesModal(false)}>
              {isBn ? "বাতিল" : "Cancel"}
            </Button>
            <Button
              type="button"
              variant="default"
              onClick={handleSaveExamWindow}
              disabled={!windowStartDate || !windowEndDate || windowEndDate < windowStartDate || saving}
              isLoading={saving}
            >
              <Save className="h-4 w-4 mr-1" />
              {isBn ? "তারিখ সংরক্ষণ" : "Save Dates"}
            </Button>
          </ModalFooter>
        </Modal>
      )}
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
