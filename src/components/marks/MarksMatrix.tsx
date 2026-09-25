"use client";
import { useState, useMemo, useCallback } from "react";
import { Table, TableBody, TableCell, TableHeader, TableRow, TableHead } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useExamsFull } from "@/lib/storage/exams";
import { useClasses } from "@/lib/storage/classes";
import { useMarksSheet, useSaveExamMarks } from "@/lib/storage/marks";
import { useToast } from "@/components/ui/toast";
import { useLang } from "@/contexts/language-context";
import { Grid3x3, Save } from "lucide-react";
import type { SheetRow, SubjectMark } from "@/lib/storage/marks";
import type { ExamSubject } from "@/lib/types";

export function MarksMatrix() {
  const { lang } = useLang();
  const isBn = lang === "bn";
  const { toast } = useToast();
  const { data: exams = [] } = useExamsFull();
  const { data: allClasses = [] } = useClasses();
  const classMap = useMemo(() => {
    const m = new Map<string, { name: string }>();
    allClasses.forEach((c) => m.set(c.id, c));
    return m;
  }, [allClasses]);

  const [examId, setExamId] = useState("");
  const [classId, setClassId] = useState("");

  const exam = useMemo(() => exams.find((e) => e.id === examId), [exams, examId]);
  const examClassIds = useMemo(() => exam?.classes || [], [exam]);
  const selectedClassName = classId ? classMap.get(classId)?.name : "";

  const { data: rows = [], isLoading } = useMarksSheet(examId, selectedClassName || "", examId ? undefined : undefined);
  const saveMarks = useSaveExamMarks();

  const classSubjectIds = useMemo(() =>
    (exam ? (exam.subjects || []).filter((s: ExamSubject) => s.classId === classId) : []).map((s: ExamSubject) => s.id),
    [exam, classId]);

  const subjectMap = useMemo(() => {
    const m = new Map<string, { name: string; fullMarks: number }>();
    (exam?.subjects || []).forEach((s) => m.set(s.id, { name: s.name, fullMarks: s.fullMarks }));
    return m;
  }, [exam]);

  const [localMarks, setLocalMarks] = useState<Record<string, Record<string, number>>>({});

  useMemo(() => {
    const initial: Record<string, Record<string, number>> = {};
    rows.forEach((r) => {
      initial[r.registrationId] = {};
      r.subjectMarks.forEach((sm: SubjectMark) => {
        if (sm.marks !== null) initial[r.registrationId][sm.subjectId] = sm.marks;
      });
    });
    setLocalMarks(initial);
  }, [rows]);

  const handleMarkChange = useCallback((regId: string, sid: string, val: number) => {
    setLocalMarks((prev) => ({ ...prev, [regId]: { ...(prev[regId] || {}), [sid]: val } }));
  }, []);

  const handleSave = async () => {
    if (!examId || classSubjectIds.length === 0) return;
    const allRows = classSubjectIds.flatMap((sid) =>
      rows.map((r) => ({ registrationId: r.registrationId, subjectId: sid, marks: localMarks[r.registrationId]?.[sid] ?? 0 }))
    );
    try {
      const result = await saveMarks.mutateAsync({ examId, rows: allRows });
      toast("success", `${isBn ? "সংরক্ষিত" : "Saved"} (${result.saved} new, ${result.updated} updated)`);
    } catch (e: any) {
      toast("error", e.message || "Save failed");
    }
  };

  const card = "bg-white border border-zinc-200 rounded-md shadow-sm";

  return (
    <div className="space-y-6">
      <div className={card}>
        <div className="px-5 py-4 border-b border-zinc-100 flex items-center gap-2 flex-wrap">
          <Grid3x3 className="h-4 w-4 text-brand-accent" />
          <h3 className="text-sm font-semibold text-zinc-900">{isBn ? "সব বিষয়ের ম্যাট্রিক্স" : "All Subjects Matrix"}</h3>
        </div>
        <div className="p-4 flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <label className="block text-[11px] mb-1.5 text-zinc-600">{isBn ? "পরীক্ষা" : "Exam"}</label>
            <Select value={examId} onChange={(e) => { setExamId(e.target.value); setClassId(""); }}
              options={[{ label: isBn ? "পরীক্ষা নির্বাচন করুন" : "Select exam", value: "" }, ...exams.map(e => ({ label: e.name, value: e.id }))]}
              placeholder={isBn ? "পরীক্ষা নির্বাচন করুন" : "Select exam"} />
          </div>
          {exam && (
            <div className="flex-1">
              <label className="block text-[11px] mb-1.5 text-zinc-600">{isBn ? "শ্রেণী" : "Class"}</label>
              <Select value={classId} onChange={(e) => setClassId(e.target.value)}
                options={[{ label: isBn ? "শ্রেণী নির্বাচন করুন" : "Select class", value: "" }, ...examClassIds.map(c => ({ label: classMap.get(c)?.name || c, value: c }))]}
                placeholder={isBn ? "শ্রেণী নির্বাচন করুন" : "Select class"} />
            </div>
          )}
        </div>
      </div>

      {examId && classId && classSubjectIds.length > 0 && (
        <div className={card}>
          <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-900">
              {isBn ? "ম্যাট্রিক্স" : "Matrix"}
              <span className="text-[11px] text-zinc-500 ml-2">({rows.length} {isBn ? "জন" : "students"})</span>
            </h3>
            <Button size="sm" onClick={handleSave} disabled={saveMarks.isPending}>
              <Save className="h-3.5 w-3.5 mr-1" /> {isBn ? "সংরক্ষণ" : "Save All"}
            </Button>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[10px] uppercase tracking-wider">{isBn ? "রোল" : "Roll"}</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider">{isBn ? "শিক্ষার্থী" : "Student"}</TableHead>
                  {classSubjectIds.map((sid) => {
                    const s = subjectMap.get(sid);
                    return (
                      <TableCell key={sid} className="text-[10px] uppercase tracking-wider text-center" colSpan={2}>
                        {s?.name} ({s?.fullMarks})
                      </TableCell>
                    );
                  })}
                </TableRow>
                <TableRow>
                  <TableHead className="text-[10px]"></TableHead>
                  <TableHead className="text-[10px]"></TableHead>
                  {classSubjectIds.map((sid) => (
                    <TableHead key={sid} className="text-[10px] uppercase">{isBn ? "নম্বর" : "Marks"}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.registrationId}>
                    <TableCell className="text-[11px] text-zinc-600">{r.examRoll || ""}</TableCell>
                    <TableCell className="text-sm font-medium text-zinc-800">{r.studentName}</TableCell>
                    {classSubjectIds.map((sid) => {
                      const mark = localMarks[r.registrationId]?.[sid] ?? r.subjectMarks.find((s: SubjectMark) => s.subjectId === sid)?.marks ?? "";
                      return (
                        <TableCell key={sid}>
                          <Input type="number" min={0} max={subjectMap.get(sid)?.fullMarks || 100}
                            value={mark}
                            onChange={(e) => handleMarkChange(r.registrationId, sid, parseInt(e.target.value) || 0)}
                            className="w-16 h-8 text-xs" />
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
