"use client";
import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHeader, TableRow, TableHead } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { getExams } from "@/lib/storage/exams";
import { getRegistrations } from "@/lib/storage/registrations";
import { getMarks, createMark, updateMark } from "@/lib/storage/marks";
import { BookOpen, Save, Download } from "lucide-react";
import { useTheme } from "@/contexts/theme-context";
import { useLang } from "@/contexts/language-context";

export default function MarksPage() {
  const { theme } = useTheme();
  const { lang: language, t } = useLang();
  const isDark = theme === "dark";
  const { toast } = useToast();
  const [selectedExam, setSelectedExam] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [marksData, setMarksData] = useState<Record<string, number>>({});
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return <div className="h-8 w-48 skeleton rounded" />;

  const exams = getExams();
  const selectedExamData = exams.find(e => e.id === selectedExam);
  const approvedRegs = getRegistrations().filter(r => r.examId === selectedExam && r.status === 'APPROVED');
  const existingMarks = getMarks().filter(m => m.examId === selectedExam && m.subjectId === selectedSubject);

  const handleMarkChange = (regId: string, value: string) => {
    setMarksData(prev => ({ ...prev, [regId]: parseInt(value) || 0 }));
  };

  const handleSaveAll = () => {
    approvedRegs.forEach(reg => {
      const marks = marksData[reg.id];
      if (marks !== undefined) {
        const existing = existingMarks.find(m => m.registrationId === reg.id);
        if (existing) updateMark(existing.id, { marks });
        else createMark({
          studentId: reg.studentId, registrationId: reg.id, examId: selectedExam,
          subjectId: selectedSubject, subjectName: selectedExamData?.subjects.find(s => s.id === selectedSubject)?.name || '',
          marks, enteredBy: 'u1',
        });
      }
    });
    toast('success', 'Marks saved successfully');
  };

  return (
    <div>
      <PageHeader title="Marks Entry" description="Enter and manage student examination marks.">
        <Button variant="outline" size="sm"><Download className="h-4 w-4 mr-2" /> Import</Button>
        <Button size="sm" onClick={handleSaveAll}><Save className="h-4 w-4 mr-2" /> Save All</Button>
      </PageHeader>

      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs text-zinc-500 mb-1">Exam</label>
              <Select value={selectedExam} onChange={(e) => { setSelectedExam(e.target.value); setSelectedSubject(""); setMarksData({}); }}
                options={exams.map(e => ({ label: e.name, value: e.id }))} placeholder="Select exam" />
            </div>
            {selectedExamData && (
              <div className="flex-1">
                <label className="block text-xs text-zinc-500 mb-1">Subject</label>
                <Select value={selectedSubject} onChange={(e) => { setSelectedSubject(e.target.value); setMarksData({}); }}
                  options={selectedExamData.subjects.map(s => ({ label: `${s.name} (${s.fullMarks})`, value: s.id }))} placeholder="Select subject" />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {selectedExam && selectedSubject && (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Roll</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Reg No</TableHead>
                  <TableHead>Marks</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {approvedRegs.map(reg => {
                  const existing = existingMarks.find(m => m.registrationId === reg.id);
                  const entered = marksData[reg.id];
                  const currentMarks = entered !== undefined ? entered : existing?.marks;
                  const fullMarks = selectedExamData?.subjects.find(s => s.id === selectedSubject)?.fullMarks || 100;
                  return (
                    <TableRow key={reg.id}>
                      <TableCell className={`text-sm ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{reg.id.slice(-3)}</TableCell>
                      <TableCell className={`text-sm ${isDark ? 'text-zinc-200' : 'text-zinc-700'}`}>{reg.studentName}</TableCell>
                      <TableCell className="text-xs text-zinc-500 font-mono">{reg.applicationId}</TableCell>
                      <TableCell>
                        <Input type="number" min={0} max={fullMarks} value={currentMarks || ''}
                          onChange={(e) => handleMarkChange(reg.id, e.target.value)}
                          className="w-20 h-8 text-xs" placeholder={`0-${fullMarks}`} />
                      </TableCell>
                      <TableCell>
                        {currentMarks !== undefined ? (
                          <span className={`text-[10px] ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>Entered</span>
                        ) : (
                          <span className={`text-[10px] ${isDark ? 'text-zinc-600' : 'text-zinc-400'}`}>Pending</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
}
