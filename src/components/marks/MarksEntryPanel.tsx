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
import { BookOpen, Save } from "lucide-react";
import type { SheetRow, SubjectMark } from "@/lib/storage/marks";
import type { ExamSubject } from "@/lib/types";

export function MarksEntryPanel() {
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
  const [subjectId, setSubjectId] = useState("");

  const exam = useMemo(() => exams.find((e) => e.id === examId), [exams, examId]);
  const examClassIds = useMemo(() => exam?.classes || [], [exam]);
  const selectedClassName = classId ? classMap.get(classId)?.name : "";

  const classSubjectIds = useMemo(() =>
    (exam ? (exam.subjects || []).filter((s) => s.classId === classId) : []).map((s) => s.id),
    [exam, classId]);

  const subjectMap = useMemo(() => {
    const m = new Map<string, { name: string; fullMarks: number }>();
    (exam?.subjects || []).forEach((s) => m.set(s.id, { name: s.name, fullMarks: s.fullMarks }));
    return m;
  }, [exam]);

  const subjectOptions = useMemo(() => {
    if (classSubjectIds.length === 0) return [{ label: isBn ? "বিষয় নির্বাচন করুন" : "Select subject", value: "" }];
    return classSubjectIds.map((sid) => {
      const s = subjectMap.get(sid);
      return { label: `${s?.name} (${s?.fullMarks})`, value: sid };
    });
  }, [classSubjectIds, subjectMap, isBn]);

  const { data: rows = [], isLoading } = useMarksSheet(examId, selectedClassName || "", examId ? undefined : undefined);
  const saveMarks = useSaveExamMarks();

  const [localMarks, setLocalMarks] = useState<Record<string, Record<string, number>>>({});

  useMemo(() => {
    const initial: Record<string, Record<string, number>> = {};
    rows.forEach((r) => {
      initial[r.registrationId] = {};
      r.subjectMarks.forEach((sm) => {
        if (sm.marks !== null) initial[r.registrationId][sm.subjectId] = sm.marks;
      });
    });
    setLocalMarks(initial);
  }, [rows]);

  const handleMarkChange = useCallback((regId: string, sid: string, val: number) => {
    setLocalMarks((prev) => ({ ...prev, [regId]: { ...(prev[regId] || {}), [sid]: val } }));
  }, []);

  const handleSave = async () => {
    if (!examId || !subjectId) return;
    const fullMarks = subjectMap.get(subjectId)?.fullMarks || 100;
    const rowsToSave = rows
      .map((r) => ({ registrationId: r.registrationId, subjectId, marks: localMarks[r.registrationId]?.[subjectId] ?? 0 }))
      .filter((row) => {
        const v = row.marks;
        return v >= 0 && v <= fullMarks;
      });
    try {
      const result = await saveMarks.mutateAsync({ examId, rows: rowsToSave });
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
          <BookOpen className="h-4 w-4 text-brand-accent" />
          <h3 className="text-sm font-semibold text-zinc-900">{isBn ? "বিষয়ভিত্তিক নম্বর প্রবেশ" : "Subject-wise Marks Entry"}</h3>
        </div>
        <div className="p-4 flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <label className="block text-[11px] mb-1.5 text-zinc-600">{isBn ? "পরীক্ষা" : "Exam"}</label>
            <Select value={examId} onChange={(e) => { setExamId(e.target.value); setClassId(""); setSubjectId(""); }}
              options={[{ label: isBn ? "পরীক্ষা নির্বাচন করুন" : "Select exam", value: "" }, ...exams.map(e => ({ label: e.name, value: e.id }))]}
              placeholder={isBn ? "পরীক্ষা নির্বাচন করুন" : "Select exam"} />
          </div>
          {exam && (
            <>
              <div className="flex-1">
                <label className="block text-[11px] mb-1.5 text-zinc-600">{isBn ? "শ্রেণী" : "Class"}</label>
                <Select value={classId} onChange={(e) => { setClassId(e.target.value); setSubjectId(""); }}
                  options={[{ label: isBn ? "শ্রেণী নির্বাচন করুন" : "Select class", value: "" }, ...examClassIds.map(c => ({ label: classMap.get(c)?.name || c, value: c }))]}
                  placeholder={isBn ? "শ্রেণী নির্বাচন করুন" : "Select class"} />
              </div>
              <div className="flex-1">
                <label className="block text-[11px] mb-1.5 text-zinc-600">{isBn ? "বিষয়" : "Subject"}</label>
                <Select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}
                  options={subjectOptions}
                  placeholder={isBn ? "বিষয় নির্বাচন করুন" : "Select subject"} />
              </div>
            </>
          )}
        </div>
      </div>

      {examId && classId && subjectId && (
        <div className={card}>
          <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-900">
              {isBn ? "নম্বর প্রবেশ" : "Marks Entry"}
              <span className="text-[11px] text-zinc-500 ml-2">({rows.length})</span>
            </h3>
            <Button size="sm" onClick={handleSave} disabled={saveMarks.isPending}>
              <Save className="h-3.5 w-3.5 mr-1" /> {isBn ? "সংরক্ষণ" : "Save All"}
            </Button>
          </div>
          {isLoading ? (
            <div className="p-8 text-center text-sm text-zinc-500">{isBn ? "লোড হচ্ছে..." : "Loading..."}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[10px] uppercase tracking-wider">{isBn ? "রোল" : "Roll"}</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider">{isBn ? "শিক্ষার্থী" : "Student"}</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider">{isBn ? "রেজিস্ট্রেশন নম্বর" : "Reg No"}</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider">{isBn ? "নম্বর" : "Marks"}</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider">{isBn ? "পূর্ণ" : "Full"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const sm = r.subjectMarks.find((s) => s.subjectId === subjectId);
                  const mark = localMarks[r.registrationId]?.[subjectId] ?? sm?.marks ?? "";
                  return (
                    <TableRow key={r.registrationId}>
                      <TableCell className="text-[11px] text-zinc-600">{r.examRoll || ""}</TableCell>
                      <TableCell className="text-sm font-medium text-zinc-800">{r.studentName}</TableCell>
                      <TableCell className="text-[11px] font-mono text-zinc-600">{r.registrationNumber}</TableCell>
                      <TableCell>
                        <Input type="number" min={0} max={subjectMap.get(subjectId)?.fullMarks || 100}
                          value={mark}
                          onChange={(e) => handleMarkChange(r.registrationId, subjectId, parseInt(e.target.value) || 0)}
                          className="w-20 h-8 text-xs" placeholder={`0-${subjectMap.get(subjectId)?.fullMarks || 100}`} />
                      </TableCell>
                      <TableCell className="text-[11px] text-zinc-500">{subjectMap.get(subjectId)?.fullMarks || "-"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      )}
    </div>
  );
}
