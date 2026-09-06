"use client";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { getInstitutionBySlug } from "@/lib/storage/institutions";
import { getExams, createExam, updateExam, deleteExam } from "@/lib/storage/exams";
import { getClasses } from "@/lib/storage/classes";
import { Exam, ExamStatus } from "@/lib/types";
import { FileText, Search, Calendar, Users, CreditCard, Plus, MoreVertical, Edit, Trash2, X } from "lucide-react";
import { formatDate } from "@/lib/storage/storage";
import { useTheme } from "@/contexts/theme-context";
import { useLang } from "@/contexts/language-context";
import { cn } from "@/lib/utils/helpers";

interface SubjectForm {
  id: string;
  name: string;
  fullMarks: number;
  passMarks: number;
  duration: number;
  negativeMarks: number;
}

const emptyForm = {
  name: "",
  code: "",
  academicYear: "",
  description: "",
  registrationStartDate: "",
  registrationEndDate: "",
  examDate: "",
  registrationFee: 0,
  lateFee: 0,
  classes: [] as string[],
  subjects: [] as SubjectForm[],
  status: "DRAFT" as ExamStatus,
};

export default function InstitutionExamsPage() {
  const params = useParams();
  const slug = params.institutionSlug as string;
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<Exam | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return <ExamsSkeleton isDark={isDark} />;

  const inst = getInstitutionBySlug(slug);
  if (!inst) return null;

  const exams = getExams();
  const allClasses = getClasses();

  const filtered = exams.filter(e => {
    const matchesSearch = e.name.toLowerCase().includes(search.toLowerCase()) || e.code.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = !statusFilter || e.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const openCount = exams.filter(e => e.status === 'OPEN').length;
  const closedCount = exams.filter(e => e.status === 'CLOSED').length;
  const publishedCount = exams.filter(e => e.status === 'PUBLISHED').length;
  const draftCount = exams.filter(e => e.status === 'DRAFT').length;

  const handleCreate = () => {
    setEditingExam(null);
    setFormData(emptyForm);
    setShowModal(true);
    setMenuOpenId(null);
  };

  const handleEdit = (e: Exam) => {
    setEditingExam(e);
    setFormData({
      name: e.name,
      code: e.code,
      academicYear: e.academicYear,
      description: e.description,
      registrationStartDate: e.registrationStartDate,
      registrationEndDate: e.registrationEndDate,
      examDate: e.examDate,
      registrationFee: e.registrationFee,
      lateFee: e.lateFee,
      classes: e.classes,
      subjects: e.subjects.map(s => ({ ...s })),
      status: e.status,
    });
    setShowModal(true);
    setMenuOpenId(null);
  };

  const handleSave = () => {
    if (!formData.name || !formData.code || !formData.academicYear) {
      toast("error", isBn ? "প্রয়োজনীয় ঘর পূরণ করুন" : "Please fill required fields");
      return;
    }
    if (editingExam) {
      updateExam(editingExam.id, {
        name: formData.name,
        code: formData.code,
        academicYear: formData.academicYear,
        description: formData.description,
        registrationStartDate: formData.registrationStartDate,
        registrationEndDate: formData.registrationEndDate,
        examDate: formData.examDate,
        registrationFee: formData.registrationFee,
        lateFee: formData.lateFee,
        classes: formData.classes,
        subjects: formData.subjects,
        status: formData.status,
      });
      toast("success", isBn ? "পরীক্ষা আপডেট হয়েছে" : "Exam updated");
    } else {
      createExam({
        name: formData.name,
        code: formData.code,
        academicYear: formData.academicYear,
        description: formData.description,
        registrationStartDate: formData.registrationStartDate,
        registrationEndDate: formData.registrationEndDate,
        examDate: formData.examDate,
        registrationFee: formData.registrationFee,
        lateFee: formData.lateFee,
        classes: formData.classes,
        subjects: formData.subjects,
        status: formData.status,
      });
      toast("success", isBn ? "পরীক্ষা যোগ হয়েছে" : "Exam created");
    }
    setShowModal(false);
    setRefreshKey(k => k + 1);
  };

  const handleDelete = (e: Exam) => {
    deleteExam(e.id);
    toast("success", isBn ? "পরীক্ষা মুছে ফেলা হয়েছে" : "Exam deleted");
    setShowDeleteConfirm(null);
    setRefreshKey(k => k + 1);
  };

  const addSubject = () => {
    setFormData(prev => ({
      ...prev,
      subjects: [...prev.subjects, { id: crypto.randomUUID(), name: "", fullMarks: 100, passMarks: 33, duration: 120, negativeMarks: 0 }],
    }));
  };

  const updateSubject = (index: number, field: string, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      subjects: prev.subjects.map((s, i) => i === index ? { ...s, [field]: value } : s),
    }));
  };

  const removeSubject = (index: number) => {
    setFormData(prev => ({
      ...prev,
      subjects: prev.subjects.filter((_, i) => i !== index),
    }));
  };

  const toggleClass = (classId: string) => {
    setFormData(prev => ({
      ...prev,
      classes: prev.classes.includes(classId)
        ? prev.classes.filter(c => c !== classId)
        : [...prev.classes, classId],
    }));
  };

  const card = isDark
    ? "bg-[#141416] border border-white/[0.06] rounded-2xl"
    : "bg-white border border-zinc-200 rounded-2xl shadow-sm";
  const iconBg = isDark ? "bg-white/[0.08]" : "bg-zinc-100";
  const iconColor = isDark ? "text-zinc-300" : "text-zinc-600";
  const inputCls = isDark ? "bg-white/[0.04] border-white/[0.08] text-white placeholder:text-zinc-600" : "bg-zinc-50 border-zinc-200 text-zinc-900 placeholder:text-zinc-400";
  const labelCls = isDark ? "text-zinc-400" : "text-zinc-600";

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0a0a0b]" : "bg-zinc-50"}`}>
      <div className="max-w-[1600px] mx-auto p-6 lg:p-8">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className={`text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-zinc-900"}`}>
              {isBn ? 'পরীক্ষা' : 'Exams'}
            </h1>
            <p className={`text-sm mt-1 ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>
              {isBn ? 'সমস্ত পরীক্ষা পরিচালনা করুন' : 'Manage all examinations'}
            </p>
          </div>
          <button onClick={handleCreate} className={cn("flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-medium transition-all", isDark ? "bg-white text-black hover:bg-white/90" : "bg-zinc-900 text-white hover:bg-zinc-800")}>
            <Plus className="h-4 w-4" /> {isBn ? 'পরীক্ষা যোগ করুন' : 'Add Exam'}
          </button>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: isBn ? 'মোট পরীক্ষা' : 'Total Exams', value: exams.length },
            { label: isBn ? 'ড্রাফট' : 'Draft', value: draftCount },
            { label: isBn ? 'ওপেন' : 'Open', value: openCount },
            { label: isBn ? 'প্রকাশিত' : 'Published', value: publishedCount },
          ].map((s) => (
            <div key={s.label} className={`${card} px-4 py-3 flex items-center gap-3`}>
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
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
        <div className={`${card} p-4 mb-8`}>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${isDark ? "text-zinc-600" : "text-zinc-400"}`} />
              <Input placeholder={isBn ? "নাম বা কোড দিয়ে অনুসন্ধান..." : "Search by name or code..."} value={search} onChange={(e) => setSearch(e.target.value)} className={cn("pl-10", inputCls)} />
            </div>
            <Select
              options={[
                { label: isBn ? `সব (${exams.length})` : `All (${exams.length})`, value: '' },
                { label: isBn ? `ড্রাফট (${draftCount})` : `Draft (${draftCount})`, value: 'DRAFT' },
                { label: isBn ? `ওপেন (${openCount})` : `Open (${openCount})`, value: 'OPEN' },
                { label: isBn ? `বন্ধ (${closedCount})` : `Closed (${closedCount})`, value: 'CLOSED' },
                { label: isBn ? `প্রকাশিত (${publishedCount})` : `Published (${publishedCount})`, value: 'PUBLISHED' },
              ]}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={cn("w-full sm:w-40", inputCls)}
            />
          </div>
        </div>

        {/* Table */}
        <div className={`${card}`}>
          <div className={`px-5 py-4 border-b ${isDark ? "border-white/[0.06]" : "border-zinc-100"}`}>
            <div className="flex items-center gap-2">
              <FileText className={`h-4 w-4 ${isDark ? "text-zinc-400" : "text-zinc-500"}`} />
              <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>{isBn ? 'পরীক্ষার তালিকা' : 'Examinations'}</h3>
              <span className={`text-[11px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>({filtered.length})</span>
            </div>
          </div>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className={`h-14 w-14 rounded-2xl flex items-center justify-center mb-4 ${isDark ? 'bg-white/[0.08]' : 'bg-zinc-100'}`}>
                <FileText className={`h-7 w-7 ${iconColor}`} />
              </div>
              <p className={`text-sm font-medium ${isDark ? "text-white" : "text-zinc-900"}`}>{isBn ? 'কোনো পরীক্ষা পাওয়া যায়নি' : 'No exams found'}</p>
              <p className={`text-xs mt-1 ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>{isBn ? 'নতুন পরীক্ষা যোগ করুন' : 'Add a new exam to get started'}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className={isDark ? 'border-white/[0.04] hover:bg-transparent' : 'border-zinc-100 hover:bg-transparent'}>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'পরীক্ষা' : 'Exam'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'কোড' : 'Code'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider hidden md:table-cell ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'বছর' : 'Year'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider hidden lg:table-cell ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'তারিখ' : 'Date'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider hidden lg:table-cell ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'ফি' : 'Fee'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'স্ট্যাটাস' : 'Status'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(exam => (
                  <TableRow key={exam.id} className={`${isDark ? 'border-white/[0.04] hover:bg-white/[0.02]' : 'border-zinc-100 hover:bg-zinc-50/50'}`}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <div className={`h-8 w-8 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 ${isDark ? 'bg-white/[0.08] text-zinc-300' : 'bg-zinc-100 text-zinc-600'}`}>
                          {exam.name.charAt(0)}
                        </div>
                        <div>
                          <p className={`text-sm font-medium ${isDark ? "text-zinc-100" : "text-zinc-800"}`}>{exam.name}</p>
                          <p className={`text-[10px] ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>{exam.subjects?.length || 0} {isBn ? 'বিষয়' : 'subjects'}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className={`text-[11px] font-mono ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>{exam.code}</TableCell>
                    <TableCell className={`text-[11px] hidden md:table-cell ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>{exam.academicYear}</TableCell>
                    <TableCell className={`text-[11px] hidden lg:table-cell ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(exam.examDate).split(',')[0]}
                      </div>
                    </TableCell>
                    <TableCell className={`text-[11px] hidden lg:table-cell ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>
                      <div className="flex items-center gap-1">
                        <CreditCard className="h-3 w-3" />
                        ৳{exam.registrationFee}
                      </div>
                    </TableCell>
                    <TableCell><Badge status={exam.status} /></TableCell>
                    <TableCell>
                      <div className="relative">
                        <button onClick={() => setMenuOpenId(menuOpenId === exam.id ? null : exam.id)} className={`p-1.5 rounded-lg transition-all ${isDark ? "text-zinc-500 hover:text-white hover:bg-white/[0.05]" : "text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100"}`}>
                          <MoreVertical className="h-3.5 w-3.5" />
                        </button>
                        {menuOpenId === exam.id && (
                          <div className={`absolute right-0 top-full mt-1 w-36 rounded-xl border z-50 py-1 shadow-xl ${isDark ? "border-white/[0.06] bg-[#141416]" : "border-zinc-200 bg-white shadow-zinc-200/50"}`}>
                            <button onClick={() => handleEdit(exam)} className={`flex items-center gap-2 w-full px-3 py-2 text-xs transition-colors ${isDark ? "text-zinc-400 hover:text-white hover:bg-white/[0.05]" : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50"}`}><Edit className="h-3.5 w-3.5" /> {isBn ? 'সম্পাদনা' : 'Edit'}</button>
                            <button onClick={() => { setShowDeleteConfirm(exam); setMenuOpenId(null); }} className="flex items-center gap-2 w-full px-3 py-2 text-xs transition-colors text-red-400 hover:bg-red-500/10"><Trash2 className="h-3.5 w-3.5" /> {isBn ? 'মুছুন' : 'Delete'}</button>
                          </div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editingExam ? (isBn ? 'পরীক্ষা সম্পাদনা' : 'Edit Exam') : (isBn ? 'নতুন পরীক্ষা' : 'New Exam')} maxWidth="max-w-2xl">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={`block text-[11px] mb-1.5 font-medium ${labelCls}`}>{isBn ? 'পরীক্ষার নাম *' : 'Exam Name *'}</label>
              <Input placeholder={isBn ? 'পরীক্ষার নাম' : 'Exam name'} value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={`block text-[11px] mb-1.5 font-medium ${labelCls}`}>{isBn ? 'কোড *' : 'Code *'}</label>
              <Input placeholder={isBn ? 'পরীক্ষা কোড' : 'Exam code'} value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={`block text-[11px] mb-1.5 font-medium ${labelCls}`}>{isBn ? 'শিক্ষাবর্ষ *' : 'Academic Year *'}</label>
              <Input placeholder={isBn ? '2024-25' : '2024-25'} value={formData.academicYear} onChange={(e) => setFormData({ ...formData, academicYear: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={`block text-[11px] mb-1.5 font-medium ${labelCls}`}>{isBn ? 'পরীক্ষার তারিখ' : 'Exam Date'}</label>
              <Input type="date" value={formData.examDate} onChange={(e) => setFormData({ ...formData, examDate: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={`block text-[11px] mb-1.5 font-medium ${labelCls}`}>{isBn ? 'নিবন্ধন শুরু' : 'Registration Start'}</label>
              <Input type="date" value={formData.registrationStartDate} onChange={(e) => setFormData({ ...formData, registrationStartDate: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={`block text-[11px] mb-1.5 font-medium ${labelCls}`}>{isBn ? 'নিবন্ধন শেষ' : 'Registration End'}</label>
              <Input type="date" value={formData.registrationEndDate} onChange={(e) => setFormData({ ...formData, registrationEndDate: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={`block text-[11px] mb-1.5 font-medium ${labelCls}`}>{isBn ? 'নিবন্ধন ফি' : 'Registration Fee'}</label>
              <Input type="number" placeholder="0" value={formData.registrationFee || ''} onChange={(e) => setFormData({ ...formData, registrationFee: Number(e.target.value) })} className={inputCls} />
            </div>
            <div>
              <label className={`block text-[11px] mb-1.5 font-medium ${labelCls}`}>{isBn ? 'বিলম্ব ফি' : 'Late Fee'}</label>
              <Input type="number" placeholder="0" value={formData.lateFee || ''} onChange={(e) => setFormData({ ...formData, lateFee: Number(e.target.value) })} className={inputCls} />
            </div>
            <div className="col-span-2">
              <label className={`block text-[11px] mb-1.5 font-medium ${labelCls}`}>{isBn ? 'বিবরণ' : 'Description'}</label>
              <Input placeholder={isBn ? 'পরীক্ষার বিবরণ' : 'Exam description'} value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className={inputCls} />
            </div>
          </div>

          <div>
            <label className={`block text-[11px] mb-1.5 font-medium ${labelCls}`}>{isBn ? 'অবস্থা' : 'Status'}</label>
            <Select
              options={[
                { label: isBn ? 'ড্রাফট' : 'Draft', value: 'DRAFT' },
                { label: isBn ? 'ওপেন' : 'Open', value: 'OPEN' },
                { label: isBn ? 'বন্ধ' : 'Closed', value: 'CLOSED' },
                { label: isBn ? 'প্রকাশিত' : 'Published', value: 'PUBLISHED' },
              ]}
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as ExamStatus })}
              className={inputCls}
            />
          </div>

          <div>
            <label className={`block text-[11px] mb-1.5 font-medium ${labelCls}`}>{isBn ? 'শ্রেণী' : 'Classes'}</label>
            <div className={`flex flex-wrap gap-2 p-3 rounded-xl border ${isDark ? "bg-white/[0.02] border-white/[0.06]" : "bg-zinc-50 border-zinc-200"}`}>
              {allClasses.map(cls => (
                <button
                  key={cls.id}
                  type="button"
                  onClick={() => toggleClass(cls.id)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${formData.classes.includes(cls.id) ? (isDark ? "bg-white text-black" : "bg-zinc-900 text-white") : (isDark ? "bg-white/[0.06] text-zinc-400 hover:bg-white/[0.1]" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200")}`}
                >
                  {cls.name}
                </button>
              ))}
              {allClasses.length === 0 && (
                <p className={`text-[11px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>{isBn ? 'কোনো শ্রেণী পাওয়া যায়নি' : 'No classes available'}</p>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={`text-[11px] font-medium ${labelCls}`}>{isBn ? 'বিষয়সমূহ' : 'Subjects'}</label>
              <button type="button" onClick={addSubject} className="flex items-center gap-1 text-[11px] font-medium text-blue-500 hover:text-blue-400 transition-colors">
                <Plus className="h-3 w-3" /> {isBn ? 'বিষয় যোগ করুন' : 'Add Subject'}
              </button>
            </div>
            {formData.subjects.length > 0 && (
              <div className="space-y-2">
                {formData.subjects.map((subject, idx) => (
                  <div key={subject.id} className={`flex items-center gap-2 p-3 rounded-xl border ${isDark ? "bg-white/[0.02] border-white/[0.06]" : "bg-zinc-50 border-zinc-200"}`}>
                    <div className="flex-1 grid grid-cols-4 gap-2">
                      <Input placeholder={isBn ? 'বিষয়ের নাম' : 'Subject name'} value={subject.name} onChange={(e) => updateSubject(idx, 'name', e.target.value)} className={cn(inputCls, "text-[11px]")} />
                      <Input type="number" placeholder={isBn ? 'পূর্ণমান' : 'Full marks'} value={subject.fullMarks || ''} onChange={(e) => updateSubject(idx, 'fullMarks', Number(e.target.value))} className={cn(inputCls, "text-[11px]")} />
                      <Input type="number" placeholder={isBn ? 'পাসমান' : 'Pass marks'} value={subject.passMarks || ''} onChange={(e) => updateSubject(idx, 'passMarks', Number(e.target.value))} className={cn(inputCls, "text-[11px]")} />
                      <Input type="number" placeholder={isBn ? 'সময় (মিনিট)' : 'Duration (min)'} value={subject.duration || ''} onChange={(e) => updateSubject(idx, 'duration', Number(e.target.value))} className={cn(inputCls, "text-[11px]")} />
                    </div>
                    <button type="button" onClick={() => removeSubject(idx)} className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-all">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {formData.subjects.length === 0 && (
              <p className={`text-[11px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>{isBn ? 'কোনো বিষয় যোগ করা হয়নি' : 'No subjects added yet'}</p>
            )}
          </div>
        </div>
        <ModalFooter>
          <button onClick={() => setShowModal(false)} className={`px-4 py-2 rounded-xl text-[13px] font-medium transition-all ${isDark ? "bg-white/[0.06] text-zinc-300 hover:bg-white/[0.1]" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"}`}>{isBn ? 'বাতিল' : 'Cancel'}</button>
          <button onClick={handleSave} className={`px-4 py-2 rounded-xl text-[13px] font-medium transition-all ${isDark ? "bg-white text-black hover:bg-white/90" : "bg-zinc-900 text-white hover:bg-zinc-800"}`}>
            {editingExam ? (isBn ? 'আপডেট' : 'Update') : (isBn ? 'তৈরি করুন' : 'Create')}
          </button>
        </ModalFooter>
      </Modal>

      {/* Delete Confirmation */}
      <Modal open={!!showDeleteConfirm} onClose={() => setShowDeleteConfirm(null)} title={isBn ? 'পরীক্ষা মুছুন?' : 'Delete Exam?'}>
        <p className={`text-sm ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
          {isBn ? `"${showDeleteConfirm?.name}" মুছে ফেলা হবে। এই কাজটি পূর্বাবস্থায় ফেরানো যাবে না।` : `"${showDeleteConfirm?.name}" will be permanently deleted. This action cannot be undone.`}
        </p>
        <ModalFooter>
          <button onClick={() => setShowDeleteConfirm(null)} className={`px-4 py-2 rounded-xl text-[13px] font-medium transition-all ${isDark ? "bg-white/[0.06] text-zinc-300 hover:bg-white/[0.1]" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"}`}>{isBn ? 'বাতিল' : 'Cancel'}</button>
          <button onClick={() => showDeleteConfirm && handleDelete(showDeleteConfirm)} className="px-4 py-2 rounded-xl text-[13px] font-medium transition-all bg-red-600 text-white hover:bg-red-700">{isBn ? 'মুছুন' : 'Delete'}</button>
        </ModalFooter>
      </Modal>
    </div>
  );
}

function ExamsSkeleton({ isDark }: { isDark: boolean }) {
  const card = isDark ? "bg-[#141416] border border-white/[0.06]" : "bg-white border border-zinc-200 shadow-sm";
  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0a0a0b]" : "bg-zinc-50"}`}>
      <div className="max-w-[1600px] mx-auto p-6 lg:p-8">
        <div className="mb-8">
          <div className={`h-8 w-48 rounded-lg ${isDark ? 'bg-white/[0.06]' : 'bg-zinc-200'}`} />
          <div className={`h-4 w-64 rounded mt-2 ${isDark ? 'bg-white/[0.04]' : 'bg-zinc-200/60'}`} />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[1, 2, 3, 4].map((i) => (<div key={i} className={`${card} rounded-2xl h-[52px]`} />))}
        </div>
        <div className={`${card} rounded-2xl h-12 mb-8`} />
        <div className={`${card} rounded-2xl h-64`} />
      </div>
    </div>
  );
}
