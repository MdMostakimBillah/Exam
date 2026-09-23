"use client";
import { useState, useEffect, useMemo } from "react";
import { Table, TableBody, TableCell, TableHeader, TableRow, TableHead } from "@/components/ui/table";
import { TableCheckbox } from "@/components/ui/table-checkbox";
import { useTableSelection } from "@/hooks/use-table-selection";
import { PdfExportModal, type PdfColumn } from "@/components/ui/pdf-export-modal";
import { useAdmitCards } from "@/lib/storage/admit-cards";
import { useExams } from "@/lib/storage/exams";
import { useClasses } from "@/lib/storage/classes";
import { FileCheck, Download, Printer, Eye, FileDown } from "lucide-react";
import { useTheme } from "@/contexts/theme-context";
import { useLang } from "@/contexts/language-context";

export default function AdmitCardsPage() {
  const { theme } = useTheme();
  const { lang: language, t } = useLang();
  const isDark = theme === "dark";
  const isBn = language === "bn";
  const [mounted, setMounted] = useState(false);
  const [showPdfModal, setShowPdfModal] = useState(false);

  const { data: cards = [] } = useAdmitCards();
  const { data: exams = [] } = useExams();
  const { data: allClasses = [] } = useClasses();

  const selection = useTableSelection(cards);

  // Subjects for a card = the exam's subjects stored for that card's class.
  const classIdByName = useMemo(() => {
    const map = new Map<string, string>();
    allClasses.forEach(c => map.set(c.name, c.id));
    return map;
  }, [allClasses]);
  const getSubjectNames = useMemo(() => (examName: string, className: string): string => {
    const exam = exams.find(e => e.name === examName);
    if (!exam || exam.subjects.length === 0) return '';
    const classId = classIdByName.get(className);
    const subs = classId
      ? exam.subjects.filter(s => !s.classId || s.classId === classId)
      : exam.subjects;
    return subs.map(s => s.name).filter(Boolean).join(', ');
  }, [exams, classIdByName]);

  const pdfColumns = useMemo<PdfColumn[]>(() => [
    { header: isBn ? 'শিক্ষার্থী' : 'Student', key: "studentName" },
    { header: isBn ? 'প্রতিষ্ঠান' : 'Institution', key: "institutionName" },
    { header: isBn ? 'রেজি নং' : 'Reg No', key: "registrationNumber" },
    { header: isBn ? 'পরীক্ষা' : 'Exam', key: "examName" },
    { header: isBn ? 'শ্রেণী' : 'Class', key: "className" },
    { header: isBn ? 'বিষয়' : 'Subjects', key: "subjects" },
    { header: isBn ? 'রোল' : 'Roll', key: "roll" },
    { header: isBn ? 'কেন্দ্র' : 'Center', key: "examCenter" },
    { header: isBn ? 'তারিখ' : 'Date', key: "examDate" },
  ], [isBn]);

  const pdfData = useMemo(() => cards.map(c => ({
    studentName: c.studentName,
    institutionName: c.institutionName,
    registrationNumber: c.registrationNumber,
    examName: c.examName,
    className: c.className,
    subjects: getSubjectNames(c.examName, c.className),
    roll: c.roll,
    examCenter: c.examCenter,
    examDate: new Date(c.examDate).toLocaleDateString(),
  })), [cards, getSubjectNames]);

  useEffect(() => { setMounted(true); }, []);

  if (!mounted) return <AdmitCardsSkeleton isDark={isDark} />;

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
            {isBn ? 'প্রবেশপত্র' : 'Admit Cards'}
          </h1>
          <p className={`text-sm mt-1 ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>
            {isBn ? 'প্রবেশপত্র তৈরি এবং পরিচালনা করুন' : 'Generate and manage admit cards'}
          </p>
        </div>

        {/* Metric Card */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {[
            { label: isBn ? 'মোট প্রবেশপত্র' : 'Total Cards', value: cards.length },
            { label: isBn ? 'ইস্যুকৃত' : 'Issued', value: cards.length },
            { label: isBn ? 'ডাউনলোড' : 'Downloaded', value: 0 },
          ].map((s) => (
            <div key={s.label} className={`${card} px-4 py-3 flex items-center gap-3`}>
              <div className={`h-10 w-10 rounded-md flex items-center justify-center shrink-0 ${iconBg}`}>
                <FileCheck className={`h-5 w-5 ${iconColor}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-lg font-bold tracking-tight leading-tight ${isDark ? "text-white" : "text-zinc-900"}`}>{s.value}</p>
                <p className={`text-[11px] ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className={`${card}`}>
          <div className={`px-5 py-4 border-b ${isDark ? "border-white/[0.06]" : "border-zinc-100"}`}>
            <div className="flex items-center gap-2">
              <FileCheck className={`h-4 w-4 ${isDark ? "text-zinc-400" : "text-zinc-500"}`} />
              <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>
                {isBn ? 'প্রবেশপত্র তালিকা' : 'Admit Cards'}
              </h3>
              <span className={`text-[11px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>({cards.length})</span>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow className={isDark ? 'border-white/[0.04] hover:bg-transparent' : 'border-zinc-100 hover:bg-transparent'}>
                <TableHead className="w-10">
                  <TableCheckbox checked={selection.allSelected} indeterminate={selection.someSelected} onChange={selection.toggleAll} />
                </TableHead>
                <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'শিক্ষার্থী' : 'Student'}</TableHead>
                <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'রেজি নং' : 'Reg No'}</TableHead>
                <TableHead className={`text-[10px] font-medium uppercase tracking-wider hidden md:table-cell ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'পরীক্ষা' : 'Exam'}</TableHead>
                <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'শ্রেণী' : 'Class'}</TableHead>
                <TableHead className={`text-[10px] font-medium uppercase tracking-wider hidden lg:table-cell ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'বিষয়' : 'Subjects'}</TableHead>
                <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'রোল' : 'Roll'}</TableHead>
                <TableHead className={`text-[10px] font-medium uppercase tracking-wider hidden lg:table-cell ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'কেন্দ্র' : 'Center'}</TableHead>
                <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'তারিখ' : 'Date'}</TableHead>
                <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'কার্য' : 'Actions'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cards.map(c => (
                <TableRow key={c.id} className={`${isDark ? 'border-white/[0.04] hover:bg-white/[0.02]' : 'border-zinc-100 hover:bg-zinc-50/50'} ${selection.isSelected(c.id) ? (isDark ? 'bg-[#9333ea]/10' : 'bg-purple-50') : ''}`}>
                  <TableCell className="w-10">
                    <TableCheckbox checked={selection.isSelected(c.id)} onChange={() => selection.toggle(c.id)} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <div className={`h-8 w-8 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0 ${isDark ? 'bg-white/[0.08] text-zinc-300' : 'bg-zinc-100 text-zinc-600'}`}>
                        {c.studentName.charAt(0)}
                      </div>
                      <div>
                        <p className={`text-sm font-medium ${isDark ? 'text-zinc-100' : 'text-zinc-800'}`}>{c.studentName}</p>
                        <p className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-zinc-600'}`}>{c.institutionName}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className={`text-[11px] font-mono ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>{c.registrationNumber}</TableCell>
                  <TableCell className={`text-[11px] hidden md:table-cell ${isDark ? 'text-zinc-300' : 'text-zinc-600'}`}>{c.examName}</TableCell>
                  <TableCell className={`text-[11px] ${isDark ? 'text-zinc-300' : 'text-zinc-600'}`}>{c.className}</TableCell>
                  <TableCell className={`text-[11px] hidden lg:table-cell max-w-[220px] truncate ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`} title={getSubjectNames(c.examName, c.className)}>
                    {getSubjectNames(c.examName, c.className) || '-'}
                  </TableCell>
                  <TableCell className={`text-[11px] ${isDark ? 'text-zinc-300' : 'text-zinc-600'}`}>{c.roll}</TableCell>
                  <TableCell className={`text-[11px] hidden lg:table-cell ${isDark ? 'text-zinc-300' : 'text-zinc-600'}`}>{c.examCenter}</TableCell>
                  <TableCell className={`text-[11px] ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>{new Date(c.examDate).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <button className={`h-7 w-7 rounded-md flex items-center justify-center transition-colors ${isDark ? 'hover:bg-white/[0.08] text-zinc-400' : 'hover:bg-zinc-100 text-zinc-500'}`}><Eye className="h-3.5 w-3.5" /></button>
                      <button className={`h-7 w-7 rounded-md flex items-center justify-center transition-colors ${isDark ? 'hover:bg-white/[0.08] text-zinc-400' : 'hover:bg-zinc-100 text-zinc-500'}`}><Download className="h-3.5 w-3.5" /></button>
                      <button className={`h-7 w-7 rounded-md flex items-center justify-center transition-colors ${isDark ? 'hover:bg-white/[0.08] text-zinc-400' : 'hover:bg-zinc-100 text-zinc-500'}`}><Printer className="h-3.5 w-3.5" /></button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
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

      <PdfExportModal open={showPdfModal} onClose={() => setShowPdfModal(false)} title={isBn ? 'প্রবেশপত্র তালিকা' : 'Admit Cards List'} columns={pdfColumns} data={pdfData} />
    </div>
  );
}

function AdmitCardsSkeleton({ isDark }: { isDark: boolean }) {
  const card = isDark ? "bg-[#141416] border border-white/[0.06]" : "bg-white border border-zinc-200 shadow-sm";

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0a0a0b]" : "bg-zinc-50"}`}>
      <div className="max-w-[1600px] mx-auto p-6 lg:p-8">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className={`${card} rounded-md h-[52px]`} />
          ))}
        </div>
        <div className={`${card} rounded-md h-64`} />
      </div>
    </div>
  );
}
