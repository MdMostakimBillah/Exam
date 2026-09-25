"use client";
import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useExamsFull } from "@/lib/storage/exams";
import { useClasses } from "@/lib/storage/classes";
import { useSaveGradingScale, useGradingScale } from "@/lib/storage/grading";
import { useUpdateExam } from "@/lib/storage/exams";
import { useToast } from "@/components/ui/toast";
import { useLang } from "@/contexts/language-context";
import { Save, Settings2 } from "lucide-react";
import type { ExamSubject, GradingScale, Class } from "@/lib/types";

export function MarksSetupPanel() {
  const { lang } = useLang();
  const isBn = lang === "bn";
  const { toast } = useToast();
  const { data: exams = [] } = useExamsFull();
  const { data: allClasses = [] } = useClasses();
  const classMap = useMemo(() => {
    const m = new Map<string, Class>();
    allClasses.forEach((c) => m.set(c.id, c));
    return m;
  }, [allClasses]);

  const [examId, setExamId] = useState("");
  const [classId, setClassId] = useState("");
  const [subjectsInput, setSubjectsInput] = useState<string>("");
  const [scaleInput, setScaleInput] = useState<string>("");

  const exam = useMemo(() => exams.find((e) => e.id === examId), [exams, examId]);
  const examClassIds = useMemo(() => exam?.classes || [], [exam]);
  const selectedClass = useMemo(() => classMap.get(classId), [classMap, classId]);
  const classSubjects = useMemo(() =>
    (selectedClass ? (exam?.subjects || []).filter((s) => s.classId === classId) : []),
    [exam, selectedClass, classId]);

  const { data: grading } = useGradingScale();
  const saveScale = useSaveGradingScale();
  const updateExam = useUpdateExam();

  const handleSaveSubjects = async () => {
    if (!examId || !classId) return;
    try {
      const subjects: ExamSubject[] = JSON.parse(subjectsInput || "[]");
      await updateExam.mutateAsync({ id: examId, data: { subjects } });
      toast("success", isBn ? "বিষয় সংরক্ষিত হয়েছে" : "Subjects saved");
    } catch {
      toast("error", "Invalid subjects JSON");
    }
  };

  const handleSaveScale = async () => {
    try {
      const scale: GradingScale = JSON.parse(scaleInput || "{}");
      await saveScale.mutateAsync(scale);
      toast("success", isBn ? "স্কেল সংরক্ষিত হয়েছে" : "Grading scale saved");
    } catch {
      toast("error", "Invalid scale JSON");
    }
  };

  const card = "bg-white border border-zinc-200 rounded-md shadow-sm";

  return (
    <div className="space-y-6">
      <div className={card}>
        <div className="px-5 py-4 border-b border-zinc-100 flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-brand-accent" />
          <h3 className="text-sm font-semibold text-zinc-900">
            {isBn ? "পরীক্ষা ও ক্লাস সেটআপ" : "Exam & Class Setup"}
          </h3>
        </div>
        <div className="p-4 flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-[11px] mb-1.5 text-zinc-600">{isBn ? "পরীক্ষা" : "Exam"}</label>
            <Select value={examId} onChange={(e) => { setExamId(e.target.value); setClassId(""); setSubjectsInput(""); }}
              options={[{ label: isBn ? "পরীক্ষা নির্বাচন করুন" : "Select exam", value: "" }, ...exams.map(e => ({ label: e.name, value: e.id }))]}
              placeholder={isBn ? "পরীক্ষা নির্বাচন করুন" : "Select exam"} />
          </div>
          {exam && (
            <div className="flex-1">
              <label className="block text-[11px] mb-1.5 text-zinc-600">{isBn ? "শ্রেণী" : "Class"}</label>
              <Select value={classId} onChange={(e) => { setClassId(e.target.value); setSubjectsInput(""); }}
                options={[{ label: isBn ? "শ্রেণী নির্বাচন করুন" : "Select class", value: "" }, ...examClassIds.map(c => ({ label: classMap.get(c)?.name || c, value: c }))]}
                placeholder={isBn ? "শ্রেণী নির্বাচন করুন" : "Select class"} />
            </div>
          )}
        </div>
      </div>

      {selectedClass && (
        <div className={card}>
          <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-900">
              {isBn ? `বিষয় — ${selectedClass.name}` : `Subjects — ${selectedClass.name}`}
            </h3>
            <span className="text-[11px] text-zinc-500">
              {isBn ? "JSON অ্যারে পেস্ট করুন:" : "Paste JSON array:"}
            </span>
          </div>
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              {classSubjects.map((s) => (
                <Badge key={s.id} variant="secondary" className="text-[10px]">
                  {s.name} ({s.fullMarks}/{s.passMarks})
                </Badge>
              ))}
            </div>
            <textarea
              className="w-full h-32 rounded-md border bg-white px-3 py-2 text-xs font-mono text-zinc-700 focus:outline-none focus:ring-2 focus:ring-brand-accent/30"
              value={subjectsInput}
              onChange={(e) => setSubjectsInput(e.target.value)}
              placeholder={JSON.stringify([
                { id: "sub1", classId, name: "Mathematics", fullMarks: 100, passMarks: 33, duration: 180, negativeMarks: 0 },
                { id: "sub2", classId, name: "Science", fullMarks: 100, passMarks: 33, duration: 180, negativeMarks: 0 },
              ], null, 2)}
            />
            <Button size="sm" onClick={handleSaveSubjects} disabled={updateExam.isPending}>
              <Save className="h-3.5 w-3.5 mr-1" /> {isBn ? "সংরক্ষণ" : "Save Subjects"}
            </Button>
          </div>
        </div>
      )}

      <div className={card}>
        <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-900">{isBn ? "গ্রেড স্কেল" : "Grade Scale"}</h3>
        </div>
        <div className="p-4 space-y-3">
          {/* Thresholds — user-settable.  Merged back into the JSON on every change. */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { key: "passPercent", label: isBn ? "পাস (%)" : "Pass (%)" },
              { key: "talentpoolPercent", label: isBn ? "ট্যালেন্টপুল (%)" : "Talentpool (%)" },
              { key: "generalScholarshipMin", label: isBn ? "সাধারণ নিম্ন (%)" : "General min (%)" },
              { key: "generalScholarshipMax", label: isBn ? "সাধারণ উচ্চ (%)" : "General max (%)" },
            ].map((f) => (
              <label key={f.key} className="flex flex-col gap-1">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wide">{f.label}</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  className="rounded-md border bg-white px-2 py-1.5 text-sm text-zinc-700 focus:outline-none focus:ring-2 focus:ring-brand-accent/30"
                  value={grading ? (grading as any)[f.key] : f.key === "talentpoolPercent" ? 90 : f.key === "generalScholarshipMin" ? 80 : f.key === "generalScholarshipMax" ? 89 : 33}
                  onChange={(e) => {
                    if (!grading) return;
                    const v = Number(e.target.value);
                    if (!Number.isFinite(v)) return;
                    const next = { ...grading, [f.key]: v };
                    setScaleInput(JSON.stringify(next, null, 2));
                  }}
                />
              </label>
            ))}
          </div>
          <textarea
            className="w-full h-24 rounded-md border bg-white px-3 py-2 text-xs font-mono text-zinc-700 focus:outline-none focus:ring-2 focus:ring-brand-accent/30"
            value={scaleInput}
            onChange={(e) => setScaleInput(e.target.value)}
            placeholder={JSON.stringify({
              bands: [
                { min: 80, grade: "A+" }, { min: 70, grade: "A" }, { min: 60, grade: "A-" },
                { min: 50, grade: "B" }, { min: 40, grade: "C" }, { min: 33, grade: "D" },
              ],
              passPercent: 33,
              talentpoolPercent: 90,
              generalScholarshipMin: 80,
              generalScholarshipMax: 89,
            }, null, 2)}
          />
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handleSaveScale} disabled={saveScale.isPending}>
              <Save className="h-3.5 w-3.5 mr-1" /> {isBn ? "সংরক্ষণ" : "Save Scale"}
            </Button>
            {grading && (
              <code className="text-[11px] text-zinc-500">
                pass {grading.passPercent}% · A+ ≥ {grading.bands[0]?.min ?? 80}% · Talentpool ≥ {grading.talentpoolPercent}% · General {grading.generalScholarshipMin}–{grading.generalScholarshipMax}%
              </code>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
