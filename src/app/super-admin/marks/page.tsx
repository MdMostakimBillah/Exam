"use client";
import { useState, useEffect, useMemo } from "react";
import { Table, TableBody, TableCell, TableHeader, TableRow, TableHead } from "@/components/ui/table";
import { TableCheckbox } from "@/components/ui/table-checkbox";
import { useTableSelection } from "@/hooks/use-table-selection";
import { PdfExportModal, type PdfColumn } from "@/components/ui/pdf-export-modal";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { getExams } from "@/lib/storage/exams";
import { getRegistrations } from "@/lib/storage/registrations";
import { getMarks, createMark, updateMark } from "@/lib/storage/marks";
import { getCurrentSession } from "@/lib/storage/sessions";
import { BookOpen, Save, Download, FileDown } from "lucide-react";
import { useTheme } from "@/contexts/theme-context";
import { useLang } from "@/contexts/language-context";

export default function MarksPage() {
  const { theme } = useTheme();
  const { lang: language, t } = useLang();
  const isDark = theme === "dark";
  const isBn = language === "bn";
  const { toast } = useToast();
  const [selectedExam, setSelectedExam] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [marksData, setMarksData] = useState<Record<string, number>>({});
  const [mounted, setMounted] = useState(false);
  const [showPdfModal, setShowPdfModal] = useState(false);

  const exams = useMemo(() => getExams(), []);
  const selectedExamData = useMemo(() => exams.find(e => e.id === selectedExam), [exams, selectedExam]);
  const approvedRegs = useMemo(() => getRegistrations().filter(r => r.examId === selectedExam && r.status === 'APPROVED'), [selectedExam]);
  const existingMarks = useMemo(() => getMarks().filter(m => m.examId === selectedExam && m.subjectId === selectedSubject), [selectedExam, selectedSubject]);

  const filtered = useMemo(() => {
    const existingMarkMap = new Map(existingMarks.map(m => [m.registrationId, m]));
    return approvedRegs.map(reg => {
      const existing = existingMarkMap.get(reg.id);
      const entered = marksData[reg.id];
      const currentMarks = entered !== undefined ? entered : existing?.marks;
      return { ...reg, currentMarks };
    });
  }, [approvedRegs, existingMarks, marksData]);

  const selection = useTableSelection(filtered);

  const pdfColumns: PdfColumn[] = useMemo(() => [
    { header: isBn ? 'রোল' : 'Roll', key: "roll" },
    { header: isBn ? 'শিক্ষার্থী' : 'Student', key: "studentName" },
    { header: isBn ? 'আবেদন আইডি' : 'Reg No', key: "applicationId" },
    { header: isBn ? 'নম্বর' : 'Marks', key: "marks" },
  ], [isBn]);

  const pdfData = useMemo(() => filtered.map(reg => ({
    roll: reg.id.slice(-3),
    studentName: reg.studentName,
    applicationId: reg.applicationId,
    marks: reg.currentMarks !== undefined ? String(reg.currentMarks) : '',
  })), [filtered]);

  const examOptions = useMemo(() => exams.map(e => ({ label: e.name, value: e.id })), [exams]);
  const subjectOptions = useMemo(() => selectedExamData?.subjects.map(s => ({ label: `${s.name} (${s.fullMarks})`, value: s.id })) ?? [], [selectedExamData]);

  useEffect(() => { setMounted(true); }, []);

  const currentSession = getCurrentSession();

  if (!mounted) return <MarksSkeleton isDark={isDark} />;

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
          sessionId: currentSession?.id || '',
          studentId: reg.studentId, registrationId: reg.id, examId: selectedExam,
          subjectId: selectedSubject, subjectName: selectedExamData?.subjects.find(s => s.id === selectedSubject)?.name || '',
          marks, enteredBy: 'u1',
        });
      }
    });
    toast('success', isBn ? 'নম্বর সফলভাবে সংরক্ষিত হয়েছে' : 'Marks saved successfully');
  };

  const card = isDark
    ? "bg-[#141416] border border-white/[0.06] rounded-md"
    : "bg-white border border-zinc-200 rounded-md shadow-sm";
  const iconBg = isDark ? "bg-white/[0.06]" : "bg-zinc-100";
  const iconColor = isDark ? "text-white" : "text-zinc-900";

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0a0a0b]" : "bg-zinc-50"}`}>
      <div className="max-w-[1600px] mx-auto p-6 lg:p-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className={`text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-zinc-900"}`}>
            {isBn ? 'নম্বর প্রবেশ' : 'Marks Entry'}
          </h1>
          <p className={`text-sm mt-1 ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>
            {isBn ? 'পরীক্ষার নম্বর প্রবেশ এবং পরিচালনা করুন' : 'Enter and manage examination marks'}
          </p>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {[
            { label: isBn ? 'মোট পরীক্ষা' : 'Total Exams', value: exams.length },
            { label: isBn ? 'নম্বর প্রবেশ' : 'Marks Entered', value: existingMarks.length },
            { label: isBn ? 'অপেক্ষমান' : 'Pending', value: approvedRegs.length - existingMarks.length },
          ].map((s) => (
            <div key={s.label} className={`${card} px-4 py-3 flex items-center gap-3`}>
              <div className={`h-10 w-10 rounded-md flex items-center justify-center shrink-0 ${iconBg}`}>
                <BookOpen className={`h-5 w-5 ${iconColor}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-lg font-bold tracking-tight leading-tight ${isDark ? "text-white" : "text-zinc-900"}`}>{s.value}</p>
                <p className={`text-[11px] ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className={`${card} p-4 mb-6`}>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label className={`block text-[11px] mb-1.5 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>{isBn ? 'পরীক্ষা' : 'Exam'}</label>
              <Select value={selectedExam} onChange={(e) => { setSelectedExam(e.target.value); setSelectedSubject(""); setMarksData({}); }}
                options={examOptions} placeholder={isBn ? 'পরীক্ষা নির্বাচন করুন' : 'Select exam'}
                className={isDark ? "bg-white/[0.04] border-white/[0.06]" : "bg-zinc-50 border-zinc-200"} />
            </div>
            {selectedExamData && (
              <div className="flex-1">
                <label className={`block text-[11px] mb-1.5 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>{isBn ? 'বিষয়' : 'Subject'}</label>
                <Select value={selectedSubject} onChange={(e) => { setSelectedSubject(e.target.value); setMarksData({}); }}
                  options={subjectOptions} placeholder={isBn ? 'বিষয় নির্বাচন করুন' : 'Select subject'}
                  className={isDark ? "bg-white/[0.04] border-white/[0.06]" : "bg-zinc-50 border-zinc-200"} />
              </div>
            )}
            <div className="flex items-end gap-2">
              <button className={`flex items-center gap-2 px-4 py-2 rounded-md text-[11px] font-medium transition-colors ${isDark ? "bg-white/[0.06] text-zinc-400 hover:text-white hover:bg-white/[0.1]" : "bg-zinc-100 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200"}`}>
                <Download className="h-3.5 w-3.5" /> {isBn ? 'ইমপোর্ট' : 'Import'}
              </button>
              <button onClick={handleSaveAll} className={`flex items-center gap-2 px-4 py-2 rounded-md text-[11px] font-medium transition-colors ${isDark ? "bg-white text-black hover:bg-zinc-200" : "bg-zinc-900 text-white hover:bg-zinc-800"}`}>
                <Save className="h-3.5 w-3.5" /> {isBn ? 'সংরক্ষণ' : 'Save All'}
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        {selectedExam && selectedSubject && (
          <div className={`${card}`}>
            <div className={`px-5 py-4 border-b ${isDark ? "border-white/[0.06]" : "border-zinc-100"}`}>
              <div className="flex items-center gap-2">
                <BookOpen className={`h-4 w-4 ${isDark ? "text-zinc-400" : "text-zinc-500"}`} />
                <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>
                  {isBn ? 'নম্বর প্রবেশ' : 'Marks Entry'}
                </h3>
                <span className={`text-[11px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>({approvedRegs.length})</span>
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow className={isDark ? 'border-white/[0.04] hover:bg-transparent' : 'border-zinc-100 hover:bg-transparent'}>
                  <TableHead className="w-10">
                    <TableCheckbox checked={selection.allSelected} indeterminate={selection.someSelected} onChange={selection.toggleAll} />
                  </TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'রোল' : 'Roll'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'শিক্ষার্থী' : 'Student'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'আবেদন আইডি' : 'Reg No'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'নম্বর' : 'Marks'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'স্থিতি' : 'Status'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {approvedRegs.map(reg => {
                  const existing = existingMarks.find(m => m.registrationId === reg.id);
                  const entered = marksData[reg.id];
                  const currentMarks = entered !== undefined ? entered : existing?.marks;
                  const fullMarks = selectedExamData?.subjects.find(s => s.id === selectedSubject)?.fullMarks || 100;
                  return (
                    <TableRow key={reg.id} className={`${isDark ? 'border-white/[0.04] hover:bg-white/[0.02]' : 'border-zinc-100 hover:bg-zinc-50/50'} ${selection.isSelected(reg.id) ? (isDark ? 'bg-[#9333ea]/10' : 'bg-purple-50') : ''}`}>
                      <TableCell className="w-10">
                        <TableCheckbox checked={selection.isSelected(reg.id)} onChange={() => selection.toggle(reg.id)} />
                      </TableCell>
                      <TableCell className={`text-[11px] ${isDark ? 'text-zinc-300' : 'text-zinc-600'}`}>{reg.id.slice(-3)}</TableCell>
                      <TableCell className={`text-sm font-medium ${isDark ? 'text-zinc-100' : 'text-zinc-800'}`}>{reg.studentName}</TableCell>
                      <TableCell className={`text-[11px] font-mono ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>{reg.applicationId}</TableCell>
                      <TableCell>
                        <Input type="number" min={0} max={fullMarks} value={currentMarks || ''}
                          onChange={(e) => handleMarkChange(reg.id, e.target.value)}
                          className={`w-20 h-8 text-xs ${isDark ? "bg-white/[0.04] border-white/[0.06]" : "bg-zinc-50 border-zinc-200"}`} placeholder={`0-${fullMarks}`} />
                      </TableCell>
                      <TableCell>
                        {currentMarks !== undefined ? (
                          <span className={`text-[10px] font-medium ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>{isBn ? 'প্রবেশ' : 'Entered'}</span>
                        ) : (
                          <span className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-zinc-600'}`}>{isBn ? 'অপেক্ষমান' : 'Pending'}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Empty State */}
        {(!selectedExam || !selectedSubject) && (
          <div className={`${card} flex flex-col items-center justify-center py-16`}>
            <div className={`h-14 w-14 rounded-md flex items-center justify-center mb-4 ${isDark ? 'bg-white/[0.08]' : 'bg-zinc-100'}`}>
              <BookOpen className={`h-7 w-7 ${iconColor}`} />
            </div>
            <p className={`text-sm font-medium ${isDark ? "text-white" : "text-zinc-900"}`}>{isBn ? 'পরীক্ষা ও বিষয় নির্বাচন করুন' : 'Select exam and subject to enter marks'}</p>
          </div>
        )}
      </div>

      {selection.selectedCount > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 animate-slideUp">
          <div className={`flex items-center gap-3 px-5 py-3 rounded-md shadow-2xl ${isDark ? 'bg-[#1a1a1c] border border-white/[0.1]' : 'bg-white border border-zinc-200'}`}>
            <span className={`text-[11px] font-medium ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
              {selection.selectedCount} {isBn ? 'টি নির্বাচিত' : 'selected'}
            </span>
            <button onClick={() => setShowPdfModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-md text-[11px] font-medium bg-[#9333ea] text-white hover:bg-[#7e22ce] transition-colors">
              <FileDown className="h-3.5 w-3.5" /> {isBn ? 'ডাউনলোড পিডিএফ' : 'Download PDF'}
            </button>
          </div>
        </div>
      )}

      <PdfExportModal open={showPdfModal} onClose={() => setShowPdfModal(false)} title={isBn ? 'নম্বর তালিকা' : 'Marks List'} columns={pdfColumns} data={pdfData} />
    </div>
  );
}

function MarksSkeleton({ isDark }: { isDark: boolean }) {
  const card = isDark ? "bg-[#141416] border border-white/[0.06]" : "bg-white border border-zinc-200 shadow-sm";

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0a0a0b]" : "bg-zinc-50"}`}>
      <div className="max-w-[1600px] mx-auto p-6 lg:p-8">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className={`${card} rounded-md h-[52px]`} />
          ))}
        </div>
        <div className={`${card} rounded-md h-12 mb-6`} />
        <div className={`${card} rounded-md h-64`} />
      </div>
    </div>
  );
}
