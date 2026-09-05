"use client";
import { useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHeader, TableRow, TableHead } from "@/components/ui/table";
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
  const isBn = language === "bn";
  const { toast } = useToast();
  const [selectedExam, setSelectedExam] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [marksData, setMarksData] = useState<Record<string, number>>({});
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return <MarksSkeleton isDark={isDark} />;

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
    toast('success', isBn ? 'নম্বর সফলভাবে সংরক্ষিত হয়েছে' : 'Marks saved successfully');
  };

  const card = isDark
    ? "bg-[#141416] border border-white/[0.06] rounded-2xl"
    : "bg-white border border-zinc-200 rounded-2xl shadow-sm";
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
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
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
                options={exams.map(e => ({ label: e.name, value: e.id }))} placeholder={isBn ? 'পরীক্ষা নির্বাচন করুন' : 'Select exam'}
                className={isDark ? "bg-white/[0.04] border-white/[0.06]" : "bg-zinc-50 border-zinc-200"} />
            </div>
            {selectedExamData && (
              <div className="flex-1">
                <label className={`block text-[11px] mb-1.5 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>{isBn ? 'বিষয়' : 'Subject'}</label>
                <Select value={selectedSubject} onChange={(e) => { setSelectedSubject(e.target.value); setMarksData({}); }}
                  options={selectedExamData.subjects.map(s => ({ label: `${s.name} (${s.fullMarks})`, value: s.id }))} placeholder={isBn ? 'বিষয় নির্বাচন করুন' : 'Select subject'}
                  className={isDark ? "bg-white/[0.04] border-white/[0.06]" : "bg-zinc-50 border-zinc-200"} />
              </div>
            )}
            <div className="flex items-end gap-2">
              <button className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-medium transition-colors ${isDark ? "bg-white/[0.06] text-zinc-400 hover:text-white hover:bg-white/[0.1]" : "bg-zinc-100 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200"}`}>
                <Download className="h-3.5 w-3.5" /> {isBn ? 'ইমপোর্ট' : 'Import'}
              </button>
              <button onClick={handleSaveAll} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-medium transition-colors ${isDark ? "bg-white text-black hover:bg-zinc-200" : "bg-zinc-900 text-white hover:bg-zinc-800"}`}>
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
                    <TableRow key={reg.id} className={`${isDark ? 'border-white/[0.04] hover:bg-white/[0.02]' : 'border-zinc-100 hover:bg-zinc-50/50'}`}>
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
            <div className={`h-14 w-14 rounded-2xl flex items-center justify-center mb-4 ${isDark ? 'bg-white/[0.08]' : 'bg-zinc-100'}`}>
              <BookOpen className={`h-7 w-7 ${iconColor}`} />
            </div>
            <p className={`text-sm font-medium ${isDark ? "text-white" : "text-zinc-900"}`}>{isBn ? 'পরীক্ষা ও বিষয় নির্বাচন করুন' : 'Select exam and subject to enter marks'}</p>
          </div>
        )}
      </div>
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
            <div key={i} className={`${card} rounded-2xl h-[52px]`} />
          ))}
        </div>
        <div className={`${card} rounded-2xl h-12 mb-6`} />
        <div className={`${card} rounded-2xl h-64`} />
      </div>
    </div>
  );
}
