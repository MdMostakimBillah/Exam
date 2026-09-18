"use client";
import { useState, useEffect, useMemo } from "react";
import { Table, TableBody, TableCell, TableHeader, TableRow, TableHead } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { useExams, useCreateExam, useUpdateExam, useDeleteExam } from "@/lib/storage/exams";
import { useClasses, useActiveClasses, getActiveClasses } from "@/lib/storage/classes";
import { useRegistrations } from "@/lib/storage/registrations";
import { useCurrentSession } from "@/lib/storage/sessions";
import { Exam } from "@/lib/types";
import { FileText, Search, Plus, Edit, Trash2, Calendar, Users, CreditCard, FileDown, ArrowLeft, ArrowRight, X, Copy, ClipboardPaste } from "lucide-react";
import { TableActionMenu, TableActionItem } from "@/components/ui/table-action-menu";
import { formatDate } from "@/lib/storage/storage";
import { useTheme } from "@/contexts/theme-context";
import { useLang } from "@/contexts/language-context";
import { TableCheckbox } from "@/components/ui/table-checkbox";
import { useTableSelection } from "@/hooks/use-table-selection";
import { PdfExportModal, type PdfColumn } from "@/components/ui/pdf-export-modal";
import { cn } from "@/lib/utils/helpers";

export default function ExamsPage() {
  const { theme } = useTheme();
  const { lang: language, t } = useLang();
  const isDark = theme === "dark";
  const isBn = language === "bn";
  const { toast } = useToast();

  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [examStep, setExamStep] = useState(1);
  const [copiedSubjects, setCopiedSubjects] = useState<{ name: string; fullMarks: number; passMarks: number; duration: number; negativeMarks: number }[] | null>(null);
  const [formData, setFormData] = useState({
    name: "", code: "", academicYear: "", description: "",
    registrationStartDate: "", registrationEndDate: "", examDate: "",
    registrationFee: 0, lateFee: 0, classes: [] as string[],
    subjects: [] as { id: string; classId: string; name: string; fullMarks: number; passMarks: number; duration: number; negativeMarks: number }[]
  });

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { if (!showModal) setCopiedSubjects(null); }, [showModal]);

  const { data: currentSession } = useCurrentSession();
  const { data: exams = [] } = useExams();
  const { data: registrations = [] } = useRegistrations();
  const { data: allClasses = [] } = useClasses();
  const createExamMutation = useCreateExam();
  const updateExamMutation = useUpdateExam();
  const deleteExamMutation = useDeleteExam();

  const filtered = useMemo(() => exams.filter(e => {
    const matchesSearch = e.name.toLowerCase().includes(search.toLowerCase()) || e.code.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = !statusFilter || e.status === statusFilter;
    return matchesSearch && matchesStatus;
  }), [exams, search, statusFilter]);

  const registrationCountMap = useMemo(() => {
    const map = new Map<string, number>();
    registrations.forEach(r => {
      map.set(r.examId, (map.get(r.examId) || 0) + 1);
    });
    return map;
  }, [registrations]);

  const classMap = useMemo(() => {
    const map = new Map<string, typeof allClasses[0]>();
    allClasses.forEach(c => map.set(c.id, c));
    return map;
  }, [allClasses]);

  const activeClasses = useMemo(() => getActiveClasses(), []);

  const selection = useTableSelection(filtered);

  const pdfColumns = useMemo<PdfColumn[]>(() => [
    { key: "name", header: isBn ? "নাম" : "Name" },
    { key: "code", header: isBn ? "কোড" : "Code" },
    { key: "academicYear", header: isBn ? "শিক্ষাবর্ষ" : "Academic Year" },
    { key: "examDate", header: isBn ? "পরীক্ষার তারিখ" : "Exam Date" },
    { key: "registrationFee", header: isBn ? "নিবন্ধন ফি" : "Fee" },
    { key: "status", header: isBn ? "স্ট্যাটাস" : "Status" },
  ], [isBn]);

  const pdfData = useMemo(() => filtered.map((exam) => ({
    name: exam.name,
    code: exam.code,
    academicYear: exam.academicYear,
    examDate: formatDate(exam.examDate).split(",")[0],
    registrationFee: `৳${exam.registrationFee}`,
    status: exam.status,
  })), [filtered]);

  const statusCounts = useMemo(() => ({
    all: exams.length,
    OPEN: exams.filter(e => e.status === 'OPEN').length,
    PUBLISHED: exams.filter(e => e.status === 'PUBLISHED').length,
    CLOSED: exams.filter(e => e.status === 'CLOSED').length,
  }), [exams]);

  if (!mounted) return <ExamsSkeleton isDark={isDark} />;

  const handleCreate = () => {
    setEditingExam(null);
    setFormData({
      name: "", code: "", academicYear: "", description: "",
      registrationStartDate: "", registrationEndDate: "", examDate: "",
      registrationFee: 0, lateFee: 0, classes: [],
      subjects: []
    });
    setExamStep(1);
    setCopiedSubjects(null);
    setShowModal(true);
  };

  const handleEdit = (exam: Exam) => {
    setEditingExam(exam);
    setFormData({
      name: exam.name, code: exam.code, academicYear: exam.academicYear, description: exam.description,
      registrationStartDate: exam.registrationStartDate, registrationEndDate: exam.registrationEndDate,
      examDate: exam.examDate, registrationFee: exam.registrationFee, lateFee: exam.lateFee,
      classes: exam.classes, subjects: exam.subjects.map(s => ({ ...s, classId: (s as any).classId || exam.classes[0] || '' }))
    });
    setExamStep(1);
    setCopiedSubjects(null);
    setShowModal(true);
    setMenuOpenId(null);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.code) {
      toast('error', isBn ? 'নাম এবং কোড আবশ্যক' : 'Name and code are required');
      return;
    }
    if (!currentSession?.id && !editingExam) {
      toast('error', isBn ? 'কোনো সক্রিয় সেশন পাওয়া যায়নি' : 'No active session found');
      return;
    }
    try {
      if (editingExam) {
        await updateExamMutation.mutateAsync({ id: editingExam.id, data: formData });
        toast('success', isBn ? 'পরীক্ষা আপডেট হয়েছে' : 'Exam updated');
      } else {
        await createExamMutation.mutateAsync({ ...formData, sessionId: currentSession!.id, status: 'DRAFT' });
        toast('success', isBn ? 'পরীক্ষা তৈরি হয়েছে' : 'Exam created');
      }
      setShowModal(false);
    } catch (err: any) {
      toast('error', isBn ? 'পরীক্ষা তৈরি করা যায়নি' : (err?.message || 'Failed to create exam'));
    }
  };

  const handleDelete = async (exam: Exam) => {
    if (confirm(isBn ? `"${exam.name}" মুছে ফেলতে চান?` : `Delete "${exam.name}"?`)) {
      await deleteExamMutation.mutateAsync(exam.id);
      toast('success', isBn ? 'পরীক্ষা মুছে ফেলা হয়েছে' : 'Exam deleted');
    }
    setMenuOpenId(null);
  };

  const toggleClass = (classId: string) => {
    setFormData(prev => ({
      ...prev,
      classes: prev.classes.includes(classId)
        ? prev.classes.filter(c => c !== classId)
        : [...prev.classes, classId]
    }));
  };

  const addSubjectForClass = (classId: string) => {
    setFormData(prev => ({
      ...prev,
      subjects: [...prev.subjects, { id: `sub_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, classId, name: "", fullMarks: 100, passMarks: 40, duration: 60, negativeMarks: 0 }]
    }));
  };

  const updateSubject = (index: number, field: string, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      subjects: prev.subjects.map((s, i) => i === index ? { ...s, [field]: value } : s)
    }));
  };

  const removeSubject = (index: number) => {
    setFormData(prev => ({
      ...prev,
      subjects: prev.subjects.filter((_, i) => i !== index)
    }));
  };

  const copySubjectsFromClass = (sourceClassId: string) => {
    const sourceSubjects = formData.subjects.filter(s => s.classId === sourceClassId);
    if (sourceSubjects.length === 0) return;
    setCopiedSubjects(sourceSubjects.map(s => ({ name: s.name, fullMarks: s.fullMarks, passMarks: s.passMarks, duration: s.duration, negativeMarks: s.negativeMarks })));
    toast('success', isBn ? 'বিষয়গুলো কপি হয়েছে। এখন যেকোনো শ্রেণীতে পেস্ট করুন।' : 'Subjects copied. Now paste to any class.');
  };

  const pasteSubjectsToClass = (targetClassId: string) => {
    if (!copiedSubjects || copiedSubjects.length === 0) return;
    const existingNames = formData.subjects.filter(s => s.classId === targetClassId).map(s => s.name);
    const newSubjects = copiedSubjects
      .filter(s => !existingNames.includes(s.name))
      .map(s => ({
        id: `sub_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        classId: targetClassId,
        name: s.name,
        fullMarks: s.fullMarks,
        passMarks: s.passMarks,
        duration: s.duration,
        negativeMarks: s.negativeMarks,
      }));
    if (newSubjects.length === 0) {
      toast('error', isBn ? 'সব বিষয় ইতিমধ্যে এই শ্রেণীতে আছে' : 'All subjects already exist in this class');
      return;
    }
    setFormData(prev => ({ ...prev, subjects: [...prev.subjects, ...newSubjects] }));
    toast('success', isBn ? `${newSubjects.length} টি বিষয় পেস্ট হয়েছে` : `${newSubjects.length} subject(s) pasted`);
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
            {isBn ? 'পরীক্ষা' : 'Exams'}
          </h1>
          <p className={`text-sm mt-1 ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>
            {isBn ? 'পরীক্ষা তৈরি এবং পরিচালনা করুন' : 'Create and manage examinations'}
          </p>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { label: isBn ? 'মোট পরীক্ষা' : 'Total Exams', value: statusCounts.all },
            { label: isBn ? 'ওপেন' : 'Open', value: statusCounts.OPEN },
            { label: isBn ? 'প্রকাশিত' : 'Published', value: statusCounts.PUBLISHED },
            { label: isBn ? 'বন্ধ' : 'Closed', value: statusCounts.CLOSED },
          ].map((s) => (
            <div key={s.label} className={`${card} px-4 py-3 flex items-center gap-3`}>
              <div className={`h-10 w-10 rounded-md flex items-center justify-center shrink-0 ${iconBg}`}>
                <FileText className={`h-5 w-5 ${iconColor}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-lg font-bold tracking-tight leading-tight ${isDark ? "text-white" : "text-zinc-900"}`}>{s.value}</p>
                <p className={`text-[11px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className={`${card} p-4 mb-6`}>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${isDark ? "text-zinc-600" : "text-zinc-400"}`} />
              <Input
                placeholder={isBn ? "নাম বা কোড দিয়ে অনুসন্ধান..." : "Search by name or code..."}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={`pl-10 ${isDark ? "bg-white/[0.04] border-white/[0.06]" : "bg-zinc-50 border-zinc-200"}`}
              />
            </div>
            <Select
              options={[
                { label: isBn ? 'সব স্ট্যাটাস' : 'All Status', value: '' },
                { label: isBn ? 'ওপেন' : 'Open', value: 'OPEN' },
                { label: isBn ? 'প্রকাশিত' : 'Published', value: 'PUBLISHED' },
                { label: isBn ? 'বন্ধ' : 'Closed', value: 'CLOSED' },
              ]}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={`w-full sm:w-40 ${isDark ? "bg-white/[0.04] border-white/[0.06]" : "bg-zinc-50 border-zinc-200"}`}
            />
            <button onClick={handleCreate} className={`flex items-center gap-2 px-4 py-2 rounded-md text-[11px] font-medium transition-colors ${isDark ? "bg-white text-black hover:bg-zinc-200" : "bg-zinc-900 text-white hover:bg-zinc-800"}`}>
              <Plus className="h-3.5 w-3.5" /> {isBn ? 'নতুন পরীক্ষা' : 'Add Exam'}
            </button>
          </div>
        </div>

        {/* Table */}
        <div className={`${card}`}>
          <div className={`px-5 py-4 border-b ${isDark ? "border-white/[0.06]" : "border-zinc-100"}`}>
            <div className="flex items-center gap-2">
              <FileText className={`h-4 w-4 ${isDark ? "text-zinc-400" : "text-zinc-500"}`} />
              <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>
                {isBn ? 'পরীক্ষার তালিকা' : 'Exams'}
              </h3>
              <span className={`text-[11px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>({filtered.length})</span>
            </div>
          </div>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className={`h-14 w-14 rounded-md flex items-center justify-center mb-4 ${isDark ? 'bg-white/[0.06]' : 'bg-zinc-100'}`}>
                <FileText className={`h-7 w-7 ${iconColor}`} />
              </div>
              <p className={`text-sm font-medium ${isDark ? "text-white" : "text-zinc-900"}`}>{isBn ? 'কোনো পরীক্ষা পাওয়া যায়নি' : 'No exams found'}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className={isDark ? 'border-white/[0.04] hover:bg-transparent' : 'border-zinc-100 hover:bg-transparent'}>
                  <TableHead className="w-10">
                    <TableCheckbox checked={selection.allSelected} indeterminate={selection.someSelected} onChange={selection.toggleAll} />
                  </TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'নাম' : 'Name'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'কোড' : 'Code'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider hidden md:table-cell ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'তারিখ' : 'Date'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider hidden lg:table-cell ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'নিবন্ধন' : 'Registrations'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider hidden lg:table-cell ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'ফি' : 'Fee'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'শ্রেণী' : 'Classes'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'স্ট্যাটাস' : 'Status'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'কার্য' : 'Actions'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(exam => {
                  const examRegCount = registrationCountMap.get(exam.id) || 0;
                  const examClasses = exam.classes.map(id => classMap.get(id)).filter(Boolean) as typeof allClasses;
                  return (
                    <TableRow key={exam.id} className={`${isDark ? 'border-white/[0.04] hover:bg-white/[0.02]' : 'border-zinc-100 hover:bg-zinc-50/50'} ${selection.isSelected(exam.id) ? (isDark ? 'bg-[#9333ea]/10' : 'bg-purple-50') : ''}`}>
                      <TableCell className="w-10">
                        <TableCheckbox checked={selection.isSelected(exam.id)} onChange={() => selection.toggle(exam.id)} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <div className={`h-8 w-8 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0 ${isDark ? 'bg-white/[0.08] text-zinc-300' : 'bg-zinc-100 text-zinc-600'}`}>
                            {exam.name.charAt(0)}
                          </div>
                          <div>
                            <p className={`text-sm font-medium ${isDark ? 'text-zinc-100' : 'text-zinc-800'}`}>{exam.name}</p>
                            <p className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>{exam.academicYear}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className={`text-[11px] font-mono ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>{exam.code}</TableCell>
                      <TableCell className={`text-[11px] hidden md:table-cell ${isDark ? 'text-zinc-300' : 'text-zinc-600'}`}>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(exam.examDate).split(',')[0]}
                        </div>
                      </TableCell>
                      <TableCell className={`text-[11px] hidden lg:table-cell ${isDark ? 'text-zinc-300' : 'text-zinc-600'}`}>
                        <div className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {examRegCount}
                        </div>
                      </TableCell>
                      <TableCell className={`text-[11px] hidden lg:table-cell ${isDark ? 'text-zinc-300' : 'text-zinc-600'}`}>
                        <div className="flex items-center gap-1">
                          <CreditCard className="h-3 w-3" />
                          ৳{exam.registrationFee}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 flex-wrap">
                          {examClasses.slice(0, 2).map(cls => (
                            <span key={cls.id} className={`px-1.5 py-0.5 rounded text-[9px] ${isDark ? "bg-white/[0.08] text-zinc-300" : "bg-zinc-100 text-zinc-700"}`}>
                              {cls.name}
                            </span>
                          ))}
                          {examClasses.length > 2 && (
                            <span className={`px-1.5 py-0.5 rounded text-[9px] ${isDark ? "bg-white/[0.08] text-zinc-300" : "bg-zinc-100 text-zinc-700"}`}>
                              +{examClasses.length - 2}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell><Badge status={exam.status} /></TableCell>
                      <TableCell>
                        <TableActionMenu id={exam.id} openId={menuOpenId} onToggle={setMenuOpenId} isDark={isDark}>
                          <TableActionItem onClick={() => handleEdit(exam)} isDark={isDark}>
                            <Edit className="h-3.5 w-3.5" /> {isBn ? 'সম্পাদনা' : 'Edit'}
                          </TableActionItem>
                          <TableActionItem onClick={() => handleDelete(exam)} isDark={isDark} variant="danger">
                            <Trash2 className="h-3.5 w-3.5" /> {isBn ? 'মুছুন' : 'Delete'}
                          </TableActionItem>
                        </TableActionMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className={`${isDark ? 'bg-[#141416] border border-white/[0.06]' : 'bg-white border-zinc-200'} rounded-lg shadow-2xl w-[90dvw] h-[90dvh] relative z-50 flex flex-col overflow-hidden animate-scaleIn`}>
          {/* Header */}
          <div className={`px-6 py-4 border-b flex items-start justify-between ${isDark ? 'border-white/[0.06]' : 'border-zinc-200'}`}>
            <div>
              <h3 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                {editingExam ? (isBn ? 'পরীক্ষা সম্পাদনা' : 'Edit Exam') : (isBn ? 'নতুন পরীক্ষা' : 'New Exam')}
              </h3>
            </div>
            <button onClick={() => setShowModal(false)} className={`rounded-md p-1.5 transition-all ${isDark ? "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.05]" : "text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100"}`}>
              <X className="h-4 w-4" />
            </button>
          </div>
          {/* Step Indicator */}
          <div className={`px-6 py-3 border-b flex items-center gap-2 ${isDark ? 'border-white/[0.06]' : 'border-zinc-200'}`}>
              {[
                { num: 1, label: isBn ? 'পরীক্ষার তথ্য' : 'Exam Info' },
                { num: 2, label: isBn ? 'শ্রেণী নির্বাচন' : 'Select Classes' },
                { num: 3, label: isBn ? 'বিষয় ও নম্বর' : 'Subjects & Marks' },
              ].map((step, i) => (
                <div key={step.num} className="flex items-center gap-2 flex-1">
                  <div className={cn(
                    "h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 transition-colors",
                    examStep > step.num ? "bg-green-500 text-white"
                      : examStep === step.num ? (isDark ? "bg-white text-black" : "bg-zinc-900 text-white")
                      : (isDark ? "bg-white/[0.08] text-zinc-500" : "bg-zinc-100 text-zinc-400")
                  )}>
                    {examStep > step.num ? "✓" : step.num}
                  </div>
                  <span className={cn(
                    "text-[11px] font-medium hidden sm:block",
                    examStep === step.num ? (isDark ? "text-white" : "text-zinc-900") : (isDark ? "text-zinc-500" : "text-zinc-400")
                  )}>
                    {step.label}
                  </span>
                  {i < 2 && <div className={cn("flex-1 h-px mx-2", examStep > step.num ? "bg-green-500" : isDark ? "bg-white/[0.08]" : "bg-zinc-200")} />}
                </div>
              ))}
            </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {/* Step 1: Exam Info */}
            {examStep === 1 && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-[12px] mb-1.5 font-medium ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>{isBn ? 'পরীক্ষার নাম *' : 'Exam Name *'}</label>
                    <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder={isBn ? 'পরীক্ষার নাম' : 'e.g. Scholarship Exam 2025'}
                      className={cn("h-10", isDark ? "bg-white/[0.04] border-white/[0.08]" : "bg-zinc-50 border-zinc-200")} />
                  </div>
                  <div>
                    <label className={`block text-[12px] mb-1.5 font-medium ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>{isBn ? 'কোড *' : 'Code *'}</label>
                    <Input value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value })} placeholder={isBn ? 'পরীক্ষা কোড' : 'e.g. SE-2025'}
                      className={cn("h-10", isDark ? "bg-white/[0.04] border-white/[0.08]" : "bg-zinc-50 border-zinc-200")} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-[12px] mb-1.5 font-medium ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>{isBn ? 'শিক্ষাবর্ষ' : 'Academic Year'}</label>
                    <Input value={formData.academicYear} onChange={(e) => setFormData({ ...formData, academicYear: e.target.value })} placeholder="2024-2025"
                      className={cn("h-10", isDark ? "bg-white/[0.04] border-white/[0.08]" : "bg-zinc-50 border-zinc-200")} />
                  </div>
                  <div>
                    <label className={`block text-[12px] mb-1.5 font-medium ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>{isBn ? 'পরীক্ষার তারিখ' : 'Exam Date'}</label>
                    <Input type="date" value={formData.examDate} onChange={(e) => setFormData({ ...formData, examDate: e.target.value })}
                      className={cn("h-10", isDark ? "bg-white/[0.04] border-white/[0.08]" : "bg-zinc-50 border-zinc-200")} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-[12px] mb-1.5 font-medium ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>{isBn ? 'নিবন্ধন শুরু' : 'Registration Start'}</label>
                    <Input type="date" value={formData.registrationStartDate} onChange={(e) => setFormData({ ...formData, registrationStartDate: e.target.value })}
                      className={cn("h-10", isDark ? "bg-white/[0.04] border-white/[0.08]" : "bg-zinc-50 border-zinc-200")} />
                  </div>
                  <div>
                    <label className={`block text-[12px] mb-1.5 font-medium ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>{isBn ? 'নিবন্ধন শেষ' : 'Registration End'}</label>
                    <Input type="date" value={formData.registrationEndDate} onChange={(e) => setFormData({ ...formData, registrationEndDate: e.target.value })}
                      className={cn("h-10", isDark ? "bg-white/[0.04] border-white/[0.08]" : "bg-zinc-50 border-zinc-200")} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-[12px] mb-1.5 font-medium ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>{isBn ? 'নিবন্ধন ফি (টাকা)' : 'Registration Fee (৳)'}</label>
                    <Input type="number" value={formData.registrationFee} onChange={(e) => setFormData({ ...formData, registrationFee: Number(e.target.value) })}
                      className={cn("h-10", isDark ? "bg-white/[0.04] border-white/[0.08]" : "bg-zinc-50 border-zinc-200")} />
                  </div>
                  <div>
                    <label className={`block text-[12px] mb-1.5 font-medium ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>{isBn ? 'বিলম্ব ফি (টাকা)' : 'Late Fee (৳)'}</label>
                    <Input type="number" value={formData.lateFee} onChange={(e) => setFormData({ ...formData, lateFee: Number(e.target.value) })}
                      className={cn("h-10", isDark ? "bg-white/[0.04] border-white/[0.08]" : "bg-zinc-50 border-zinc-200")} />
                  </div>
                </div>
                <div>
                  <label className={`block text-[12px] mb-1.5 font-medium ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>{isBn ? 'বিবরণ' : 'Description'}</label>
                  <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder={isBn ? 'পরীক্ষার বিবরণ' : 'Exam description'}
                    rows={3}
                    className={cn("w-full px-3 py-2 rounded-md text-sm resize-none", isDark ? "bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-zinc-600" : "bg-zinc-50 border border-zinc-200 text-zinc-900 placeholder:text-zinc-400")} />
                </div>
              </div>
            )}

            {/* Step 2: Select Classes */}
            {examStep === 2 && (
              <div className="space-y-4">
                <div>
                  <label className={`block text-[12px] mb-1.5 font-medium ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>{isBn ? 'শ্রেণী নির্বাচন করুন' : 'Select Classes'}</label>
                  <p className={`text-[11px] mb-3 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>{isBn ? 'এক বা একাধিক শ্রেণী নির্বাচন করুন' : 'Select one or more classes for this exam'}</p>
                  <div className={`p-4 rounded-md border ${isDark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-zinc-50 border-zinc-200'}`}>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                      {activeClasses.map(cls => (
                        <button
                          key={cls.id}
                          onClick={() => toggleClass(cls.id)}
                          className={cn(
                            "px-3 py-2.5 rounded-md text-[12px] font-medium transition-all border",
                            formData.classes.includes(cls.id)
                              ? isDark ? 'bg-white text-black border-white' : 'bg-zinc-900 text-white border-zinc-900'
                              : isDark ? 'bg-white/[0.04] text-zinc-400 border-white/[0.06] hover:bg-white/[0.08] hover:border-white/[0.12]' : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-100 hover:border-zinc-300'
                          )}
                        >
                          {cls.name}
                        </button>
                      ))}
                    </div>
                  </div>
                  {formData.classes.length > 0 && (
                    <p className={`text-[11px] mt-2 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                      {formData.classes.length} {isBn ? 'টি শ্রেণী নির্বাচিত' : 'class(es) selected'}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Step 3: Subjects per Class */}
            {examStep === 3 && (
              <div className="space-y-5">
                {formData.classes.length === 0 ? (
                  <div className={`text-center py-8 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                    <p className="text-sm">{isBn ? 'কোনো শ্রেণী নির্বাচিত হয়নি' : 'No classes selected'}</p>
                  </div>
                ) : (
                  formData.classes.map((classId) => {
                    const cls = activeClasses.find(c => c.id === classId);
                    const classSubjects = formData.subjects.filter(s => s.classId === classId);
                    return (
                      <div key={classId} className={`rounded-md border ${isDark ? 'border-white/[0.06] bg-white/[0.02]' : 'border-zinc-200 bg-zinc-50'}`}>
                        <div className={`px-4 py-3 border-b flex items-center justify-between ${isDark ? 'border-white/[0.06]' : 'border-zinc-200'}`}>
                          <div>
                            <h4 className={`text-[13px] font-semibold ${isDark ? 'text-white' : 'text-zinc-900'}`}>{cls?.name || classId}</h4>
                            <p className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>{classSubjects.length} {isBn ? 'টি বিষয়' : 'subject(s)'}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {classSubjects.length > 0 && (
                              <button
                                onClick={() => copySubjectsFromClass(classId)}
                                className={cn(
                                  "flex items-center gap-1 px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors",
                                  copiedSubjects
                                    ? isDark ? "bg-green-500/20 text-green-400 border border-green-500/30" : "bg-green-50 text-green-700 border border-green-200"
                                    : isDark ? "bg-white/[0.08] text-zinc-300 hover:bg-white/[0.12]" : "bg-white text-zinc-700 hover:bg-zinc-100 border border-zinc-200"
                                )}
                              >
                                <Copy className="h-3 w-3" /> {copiedSubjects ? (isBn ? 'আবার কপি' : 'Copy again') : (isBn ? 'কপি' : 'Copy')}
                              </button>
                            )}
                            {copiedSubjects && (
                              <button
                                onClick={() => pasteSubjectsToClass(classId)}
                                className={cn(
                                  "flex items-center gap-1 px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors",
                                  isDark ? "bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30" : "bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
                                )}
                              >
                                <ClipboardPaste className="h-3 w-3" /> {isBn ? 'পেস্ট' : 'Paste'}
                              </button>
                            )}
                            <button
                              onClick={() => addSubjectForClass(classId)}
                              className={cn(
                                "flex items-center gap-1 px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors",
                                isDark ? "bg-white/[0.08] text-zinc-300 hover:bg-white/[0.12]" : "bg-white text-zinc-700 hover:bg-zinc-100 border border-zinc-200"
                              )}
                            >
                              <Plus className="h-3 w-3" /> {isBn ? 'বিষয় যোগ' : 'Add Subject'}
                            </button>
                          </div>
                        </div>
                        {classSubjects.length > 0 ? (
                          <div className="p-3">
                            <div className="grid grid-cols-[1fr_80px_80px_32px] gap-2 mb-2 px-1">
                              <span className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>{isBn ? 'বিষয়ের নাম' : 'Subject Name'}</span>
                              <span className={`text-[10px] font-medium uppercase tracking-wider text-center ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>{isBn ? 'পূর্ণ নম্বর' : 'Full Marks'}</span>
                              <span className={`text-[10px] font-medium uppercase tracking-wider text-center ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>{isBn ? 'পাস নম্বর' : 'Pass Marks'}</span>
                              <span></span>
                            </div>
                            <div className="space-y-2">
                              {classSubjects.map((subject) => {
                                const globalIdx = formData.subjects.findIndex(s => s.id === subject.id);
                                return (
                                  <div key={subject.id} className="grid grid-cols-[1fr_80px_80px_32px] gap-2 items-center">
                                    <Input value={subject.name} onChange={(e) => updateSubject(globalIdx, 'name', e.target.value)} placeholder={isBn ? 'বিষয়ের নাম' : 'Subject name'}
                                      className={cn("h-9 text-[12px]", isDark ? "bg-white/[0.04] border-white/[0.06]" : "bg-white border-zinc-200")} />
                                    <Input type="number" value={subject.fullMarks} onChange={(e) => updateSubject(globalIdx, 'fullMarks', Number(e.target.value))} placeholder="100"
                                      className={cn("h-9 text-[12px] text-center", isDark ? "bg-white/[0.04] border-white/[0.06]" : "bg-white border-zinc-200")} />
                                    <Input type="number" value={subject.passMarks} onChange={(e) => updateSubject(globalIdx, 'passMarks', Number(e.target.value))} placeholder="40"
                                      className={cn("h-9 text-[12px] text-center", isDark ? "bg-white/[0.04] border-white/[0.06]" : "bg-white border-zinc-200")} />
                                    <button onClick={() => removeSubject(globalIdx)} className="text-red-400 hover:text-red-300 flex items-center justify-center">
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ) : (
                          <div className={`px-4 py-4 text-center text-[11px] ${isDark ? 'text-zinc-600' : 'text-zinc-400'}`}>
                            {isBn ? 'এই শ্রেণীর জন্য কোনো বিষয় যোগ করা হয়নি' : 'No subjects added for this class'}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className={`px-6 py-4 border-t flex items-center justify-between ${isDark ? 'border-white/[0.06]' : 'border-zinc-200'}`}>
            <button onClick={() => setShowModal(false)} className={`px-4 py-2 rounded-md text-[12px] font-medium transition-colors ${isDark ? "bg-white/[0.06] text-zinc-400 hover:text-white" : "bg-zinc-100 text-zinc-600 hover:text-zinc-900"}`}>
              {isBn ? 'বাতিল' : 'Cancel'}
            </button>
            <div className="flex gap-2">
              {examStep > 1 && (
                <button onClick={() => setExamStep(s => s - 1)} className={`flex items-center gap-1 px-4 py-2 rounded-md text-[12px] font-medium transition-colors ${isDark ? "bg-white/[0.06] text-zinc-300 hover:bg-white/[0.1]" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"}`}>
                  <ArrowLeft className="h-3.5 w-3.5" /> {isBn ? 'পূর্ববর্তী' : 'Back'}
                </button>
              )}
              {examStep < 3 ? (
                <button onClick={() => {
                  if (examStep === 1 && (!formData.name || !formData.code)) {
                    toast('error', isBn ? 'নাম এবং কোড আবশ্যক' : 'Name and code are required');
                    return;
                  }
                  if (examStep === 2 && formData.classes.length === 0) {
                    toast('error', isBn ? 'অন্তত একটি শ্রেণী নির্বাচন করুন' : 'Select at least one class');
                    return;
                  }
                  setExamStep(s => s + 1);
                }} className={`flex items-center gap-1 px-4 py-2 rounded-md text-[12px] font-medium transition-colors ${isDark ? "bg-white text-black hover:bg-zinc-200" : "bg-zinc-900 text-white hover:bg-zinc-800"}`}>
                  {isBn ? 'পরবর্তী' : 'Next'} <ArrowRight className="h-3.5 w-3.5" />
                </button>
              ) : (
                <button
                  onClick={handleSave}
                  disabled={createExamMutation.isPending || updateExamMutation.isPending}
                  className={`px-4 py-2 rounded-md text-[12px] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${isDark ? "bg-white text-black hover:bg-zinc-200" : "bg-zinc-900 text-white hover:bg-zinc-800"}`}
                >
                  {(createExamMutation.isPending || updateExamMutation.isPending)
                    ? (isBn ? 'সংরক্ষণ হচ্ছে...' : 'Saving...')
                    : editingExam ? (isBn ? 'আপডেট' : 'Update') : (isBn ? 'তৈরি করুন' : 'Create Exam')
                  }
                </button>
              )}
            </div>
          </div>
        </div>
        </div>
      )}

      {/* Floating PDF Download Button */}
      <button
        onClick={() => setShowPdfModal(true)}
        className={`fixed bottom-6 right-6 h-12 w-12 rounded-full flex items-center justify-center shadow-lg transition-colors ${
          isDark ? "bg-white text-black hover:bg-zinc-200" : "bg-zinc-900 text-white hover:bg-zinc-800"
        }`}
      >
        <FileDown className="h-5 w-5" />
      </button>

      {/* PDF Export Modal */}
      <PdfExportModal
        open={showPdfModal}
        onClose={() => setShowPdfModal(false)}
        title={isBn ? "পরীক্ষা রপ্তানি" : "Export Exams"}
        columns={pdfColumns}
        data={pdfData}
      />
    </div>
  );
}

function ExamsSkeleton({ isDark }: { isDark: boolean }) {
  const card = isDark ? "bg-[#141416] border border-white/[0.06]" : "bg-white border border-zinc-200 shadow-sm";

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
