"use client";
import { useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHeader, TableRow, TableHead } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { getExams, createExam, updateExam, deleteExam } from "@/lib/storage/exams";
import { getClasses, getActiveClasses } from "@/lib/storage/classes";
import { getRegistrations } from "@/lib/storage/registrations";
import { Exam } from "@/lib/types";
import { FileText, Search, Plus, MoreVertical, Edit, Trash2, Calendar, Users, CreditCard } from "lucide-react";
import { formatDate } from "@/lib/storage/storage";
import { useTheme } from "@/contexts/theme-context";
import { useLang } from "@/contexts/language-context";

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
  const [formData, setFormData] = useState({
    name: "", code: "", academicYear: "", description: "",
    registrationStartDate: "", registrationEndDate: "", examDate: "",
    registrationFee: 0, lateFee: 0, classes: [] as string[],
    subjects: [] as { id: string; name: string; fullMarks: number; passMarks: number; duration: number; negativeMarks: number }[]
  });

  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return <ExamsSkeleton isDark={isDark} />;

  const exams = getExams();
  const registrations = getRegistrations();
  const allClasses = getClasses();
  const filtered = exams.filter(e => {
    const matchesSearch = e.name.toLowerCase().includes(search.toLowerCase()) || e.code.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = !statusFilter || e.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusCounts = {
    all: exams.length,
    OPEN: exams.filter(e => e.status === 'OPEN').length,
    PUBLISHED: exams.filter(e => e.status === 'PUBLISHED').length,
    CLOSED: exams.filter(e => e.status === 'CLOSED').length,
  };

  const handleCreate = () => {
    setEditingExam(null);
    setFormData({
      name: "", code: "", academicYear: "", description: "",
      registrationStartDate: "", registrationEndDate: "", examDate: "",
      registrationFee: 0, lateFee: 0, classes: [],
      subjects: []
    });
    setShowModal(true);
  };

  const handleEdit = (exam: Exam) => {
    setEditingExam(exam);
    setFormData({
      name: exam.name, code: exam.code, academicYear: exam.academicYear, description: exam.description,
      registrationStartDate: exam.registrationStartDate, registrationEndDate: exam.registrationEndDate,
      examDate: exam.examDate, registrationFee: exam.registrationFee, lateFee: exam.lateFee,
      classes: exam.classes, subjects: exam.subjects
    });
    setShowModal(true);
    setMenuOpenId(null);
  };

  const handleSave = () => {
    if (!formData.name || !formData.code) {
      toast('error', isBn ? 'নাম এবং কোড আবশ্যক' : 'Name and code are required');
      return;
    }
    if (editingExam) {
      updateExam(editingExam.id, formData);
      toast('success', isBn ? 'পরীক্ষা আপডেট হয়েছে' : 'Exam updated');
    } else {
      createExam({ ...formData, status: 'DRAFT' });
      toast('success', isBn ? 'পরীক্ষা তৈরি হয়েছে' : 'Exam created');
    }
    setShowModal(false);
  };

  const handleDelete = (exam: Exam) => {
    if (confirm(isBn ? `"${exam.name}" মুছে ফেলতে চান?` : `Delete "${exam.name}"?`)) {
      deleteExam(exam.id);
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

  const addSubject = () => {
    setFormData(prev => ({
      ...prev,
      subjects: [...prev.subjects, { id: `sub_${Date.now()}`, name: "", fullMarks: 100, passMarks: 40, duration: 60, negativeMarks: 0 }]
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

  const card = isDark
    ? "bg-[#141416] border border-white/[0.06] rounded-2xl"
    : "bg-white border border-zinc-200 rounded-2xl shadow-sm";
  const iconBg = isDark ? "bg-white/[0.06]" : "bg-zinc-100";
  const iconColor = isDark ? "text-white" : "text-zinc-900";

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0a0a0b]" : "bg-zinc-50"}`}>
      <div className="p-6 lg:p-8">
        {/* Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { label: isBn ? 'মোট পরীক্ষা' : 'Total Exams', value: statusCounts.all },
            { label: isBn ? 'ওপেন' : 'Open', value: statusCounts.OPEN },
            { label: isBn ? 'প্রকাশিত' : 'Published', value: statusCounts.PUBLISHED },
            { label: isBn ? 'বন্ধ' : 'Closed', value: statusCounts.CLOSED },
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
            <button onClick={handleCreate} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-medium transition-colors ${isDark ? "bg-white text-black hover:bg-zinc-200" : "bg-zinc-900 text-white hover:bg-zinc-800"}`}>
              <Plus className="h-3.5 w-3.5" /> {isBn ? 'নতুন পরীক্ষা' : 'Add Exam'}
            </button>
          </div>
        </div>

        {/* Table */}
        <div className={`${card}`}>
          <div className={`px-5 py-4 border-b ${isDark ? "border-white/[0.06]" : "border-zinc-100"}`}>
            <div className="flex items-center gap-2">
              <FileText className={`h-4 w-4 ${isDark ? "text-zinc-500" : "text-zinc-400"}`} />
              <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>
                {isBn ? 'পরীক্ষার তালিকা' : 'Exams'}
              </h3>
              <span className={`text-[11px] ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>({filtered.length})</span>
            </div>
          </div>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className={`h-14 w-14 rounded-2xl flex items-center justify-center mb-4 ${isDark ? 'bg-white/[0.06]' : 'bg-zinc-100'}`}>
                <FileText className={`h-7 w-7 ${iconColor}`} />
              </div>
              <p className={`text-sm font-medium ${isDark ? "text-white" : "text-zinc-900"}`}>{isBn ? 'কোনো পরীক্ষা পাওয়া যায়নি' : 'No exams found'}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className={isDark ? 'border-white/[0.04] hover:bg-transparent' : 'border-zinc-100 hover:bg-transparent'}>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>{isBn ? 'নাম' : 'Name'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>{isBn ? 'কোড' : 'Code'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider hidden md:table-cell ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>{isBn ? 'তারিখ' : 'Date'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider hidden lg:table-cell ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>{isBn ? 'নিবন্ধন' : 'Registrations'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider hidden lg:table-cell ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>{isBn ? 'ফি' : 'Fee'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>{isBn ? 'শ্রেণী' : 'Classes'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>{isBn ? 'স্ট্যাটাস' : 'Status'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>{isBn ? 'কার্য' : 'Actions'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(exam => {
                  const examRegs = registrations.filter(r => r.examId === exam.id);
                  const examClasses = allClasses.filter(c => exam.classes.includes(c.id));
                  return (
                    <TableRow key={exam.id} className={`${isDark ? 'border-white/[0.04] hover:bg-white/[0.02]' : 'border-zinc-100 hover:bg-zinc-50/50'}`}>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <div className={`h-8 w-8 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 ${isDark ? 'bg-white/[0.06] text-zinc-400' : 'bg-zinc-100 text-zinc-500'}`}>
                            {exam.name.charAt(0)}
                          </div>
                          <div>
                            <p className={`text-sm font-medium ${isDark ? 'text-zinc-200' : 'text-zinc-700'}`}>{exam.name}</p>
                            <p className={`text-[10px] ${isDark ? 'text-zinc-600' : 'text-zinc-400'}`}>{exam.academicYear}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className={`text-[11px] font-mono ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>{exam.code}</TableCell>
                      <TableCell className={`text-[11px] hidden md:table-cell ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(exam.examDate).split(',')[0]}
                        </div>
                      </TableCell>
                      <TableCell className={`text-[11px] hidden lg:table-cell ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                        <div className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {examRegs.length}
                        </div>
                      </TableCell>
                      <TableCell className={`text-[11px] hidden lg:table-cell ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                        <div className="flex items-center gap-1">
                          <CreditCard className="h-3 w-3" />
                          ৳{exam.registrationFee}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 flex-wrap">
                          {examClasses.slice(0, 2).map(cls => (
                            <span key={cls.id} className={`px-1.5 py-0.5 rounded text-[9px] ${isDark ? "bg-white/[0.04] text-zinc-500" : "bg-zinc-100 text-zinc-600"}`}>
                              {cls.name}
                            </span>
                          ))}
                          {examClasses.length > 2 && (
                            <span className={`px-1.5 py-0.5 rounded text-[9px] ${isDark ? "bg-white/[0.04] text-zinc-500" : "bg-zinc-100 text-zinc-600"}`}>
                              +{examClasses.length - 2}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell><Badge status={exam.status} /></TableCell>
                      <TableCell>
                        <div className="relative">
                          <button
                            onClick={() => setMenuOpenId(menuOpenId === exam.id ? null : exam.id)}
                            className={`h-7 w-7 rounded-lg flex items-center justify-center transition-colors ${isDark ? 'hover:bg-white/[0.06] text-zinc-500' : 'hover:bg-zinc-100 text-zinc-400'}`}
                          >
                            <MoreVertical className="h-3.5 w-3.5" />
                          </button>
                          {menuOpenId === exam.id && (
                            <>
                              <div className="fixed inset-0 z-40" onClick={() => setMenuOpenId(null)} />
                              <div className={`absolute right-0 top-8 z-50 w-40 rounded-xl border py-1 shadow-lg ${isDark ? 'bg-[#1a1a1c] border-white/[0.08]' : 'bg-white border-zinc-200'}`}>
                                <button onClick={() => handleEdit(exam)} className={`flex items-center gap-2 w-full px-3 py-2 text-[11px] ${isDark ? 'text-zinc-400 hover:bg-white/[0.05] hover:text-white' : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'}`}>
                                  <Edit className="h-3.5 w-3.5" /> {isBn ? 'সম্পাদনা' : 'Edit'}
                                </button>
                                <button onClick={() => handleDelete(exam)} className={`flex items-center gap-2 w-full px-3 py-2 text-[11px] ${isDark ? 'text-red-400 hover:bg-red-500/10' : 'text-red-600 hover:bg-red-50'}`}>
                                  <Trash2 className="h-3.5 w-3.5" /> {isBn ? 'মুছুন' : 'Delete'}
                                </button>
                              </div>
                            </>
                          )}
                        </div>
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
      <Modal open={showModal} onClose={() => setShowModal(false)}>
        <div className={`${isDark ? 'bg-[#141416] border border-white/[0.06]' : 'bg-white border-zinc-200'} rounded-2xl p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto`}>
          <h3 className={`text-sm font-semibold mb-4 ${isDark ? 'text-white' : 'text-zinc-900'}`}>
            {editingExam ? (isBn ? 'পরীক্ষা সম্পাদনা' : 'Edit Exam') : (isBn ? 'নতুন পরীক্ষা' : 'New Exam')}
          </h3>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={`block text-[11px] mb-1.5 ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>{isBn ? 'নাম' : 'Name'}</label>
                <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder={isBn ? 'পরীক্ষার নাম' : 'Exam name'}
                  className={isDark ? "bg-white/[0.04] border-white/[0.06]" : "bg-zinc-50 border-zinc-200"} />
              </div>
              <div>
                <label className={`block text-[11px] mb-1.5 ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>{isBn ? 'কোড' : 'Code'}</label>
                <Input value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value })} placeholder={isBn ? 'পরীক্ষা কোড' : 'Exam code'}
                  className={isDark ? "bg-white/[0.04] border-white/[0.06]" : "bg-zinc-50 border-zinc-200"} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={`block text-[11px] mb-1.5 ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>{isBn ? 'শিক্ষাবর্ষ' : 'Academic Year'}</label>
                <Input value={formData.academicYear} onChange={(e) => setFormData({ ...formData, academicYear: e.target.value })} placeholder="2024-2025"
                  className={isDark ? "bg-white/[0.04] border-white/[0.06]" : "bg-zinc-50 border-zinc-200"} />
              </div>
              <div>
                <label className={`block text-[11px] mb-1.5 ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>{isBn ? 'পরীক্ষার তারিখ' : 'Exam Date'}</label>
                <Input type="date" value={formData.examDate} onChange={(e) => setFormData({ ...formData, examDate: e.target.value })}
                  className={isDark ? "bg-white/[0.04] border-white/[0.06]" : "bg-zinc-50 border-zinc-200"} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={`block text-[11px] mb-1.5 ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>{isBn ? 'নিবন্ধন শুরু' : 'Registration Start'}</label>
                <Input type="date" value={formData.registrationStartDate} onChange={(e) => setFormData({ ...formData, registrationStartDate: e.target.value })}
                  className={isDark ? "bg-white/[0.04] border-white/[0.06]" : "bg-zinc-50 border-zinc-200"} />
              </div>
              <div>
                <label className={`block text-[11px] mb-1.5 ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>{isBn ? 'নিবন্ধন শেষ' : 'Registration End'}</label>
                <Input type="date" value={formData.registrationEndDate} onChange={(e) => setFormData({ ...formData, registrationEndDate: e.target.value })}
                  className={isDark ? "bg-white/[0.04] border-white/[0.06]" : "bg-zinc-50 border-zinc-200"} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={`block text-[11px] mb-1.5 ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>{isBn ? 'নিবন্ধন ফি' : 'Registration Fee'}</label>
                <Input type="number" value={formData.registrationFee} onChange={(e) => setFormData({ ...formData, registrationFee: Number(e.target.value) })}
                  className={isDark ? "bg-white/[0.04] border-white/[0.06]" : "bg-zinc-50 border-zinc-200"} />
              </div>
              <div>
                <label className={`block text-[11px] mb-1.5 ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>{isBn ? 'বিলম্ব ফি' : 'Late Fee'}</label>
                <Input type="number" value={formData.lateFee} onChange={(e) => setFormData({ ...formData, lateFee: Number(e.target.value) })}
                  className={isDark ? "bg-white/[0.04] border-white/[0.06]" : "bg-zinc-50 border-zinc-200"} />
              </div>
            </div>
            <div>
              <label className={`block text-[11px] mb-1.5 ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>{isBn ? 'বিবরণ' : 'Description'}</label>
              <Input value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder={isBn ? 'পরীক্ষার বিবরণ' : 'Exam description'}
                className={isDark ? "bg-white/[0.04] border-white/[0.06]" : "bg-zinc-50 border-zinc-200"} />
            </div>

            {/* Classes Selection */}
            <div>
              <label className={`block text-[11px] mb-1.5 ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>{isBn ? 'শ্রেণী নির্বাচন করুন' : 'Select Classes'}</label>
              <div className={`p-3 rounded-xl border ${isDark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-zinc-50 border-zinc-200'}`}>
                <div className="flex flex-wrap gap-2">
                  {getActiveClasses().map(cls => (
                    <button
                      key={cls.id}
                      onClick={() => toggleClass(cls.id)}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
                        formData.classes.includes(cls.id)
                          ? isDark ? 'bg-white text-black' : 'bg-zinc-900 text-white'
                          : isDark ? 'bg-white/[0.04] text-zinc-400 hover:bg-white/[0.08]' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                      }`}
                    >
                      {cls.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Subjects */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className={`text-[11px] ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>{isBn ? 'বিষয়সমূহ' : 'Subjects'}</label>
                <button onClick={addSubject} className={`text-[11px] ${isDark ? 'text-zinc-400 hover:text-white' : 'text-zinc-600 hover:text-zinc-900'}`}>
                  + {isBn ? 'বিষয় যোগ করুন' : 'Add Subject'}
                </button>
              </div>
              {formData.subjects.length > 0 && (
                <div className={`p-3 rounded-xl border ${isDark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-zinc-50 border-zinc-200'}`}>
                  <div className="space-y-2">
                    {formData.subjects.map((subject, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <Input value={subject.name} onChange={(e) => updateSubject(idx, 'name', e.target.value)} placeholder={isBn ? 'বিষয়ের নাম' : 'Subject name'}
                          className={`flex-1 ${isDark ? "bg-white/[0.04] border-white/[0.06]" : "bg-white border-zinc-200"}`} />
                        <Input type="number" value={subject.fullMarks} onChange={(e) => updateSubject(idx, 'fullMarks', Number(e.target.value))} placeholder="Full"
                          className={`w-16 ${isDark ? "bg-white/[0.04] border-white/[0.06]" : "bg-white border-zinc-200"}`} />
                        <Input type="number" value={subject.passMarks} onChange={(e) => updateSubject(idx, 'passMarks', Number(e.target.value))} placeholder="Pass"
                          className={`w-16 ${isDark ? "bg-white/[0.04] border-white/[0.06]" : "bg-white border-zinc-200"}`} />
                        <button onClick={() => removeSubject(idx)} className="text-red-400 hover:text-red-300">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <button onClick={() => setShowModal(false)} className={`px-4 py-2 rounded-xl text-[11px] font-medium transition-colors ${isDark ? "bg-white/[0.06] text-zinc-400 hover:text-white" : "bg-zinc-100 text-zinc-600 hover:text-zinc-900"}`}>
              {isBn ? 'বাতিল' : 'Cancel'}
            </button>
            <button onClick={handleSave} className={`px-4 py-2 rounded-xl text-[11px] font-medium transition-colors ${isDark ? "bg-white text-black hover:bg-zinc-200" : "bg-zinc-900 text-white hover:bg-zinc-800"}`}>
              {editingExam ? (isBn ? 'আপডেট' : 'Update') : (isBn ? 'তৈরি' : 'Create')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function ExamsSkeleton({ isDark }: { isDark: boolean }) {
  const card = isDark ? "bg-[#141416] border border-white/[0.06]" : "bg-white border border-zinc-200 shadow-sm";

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0a0a0b]" : "bg-zinc-50"}`}>
      <div className="p-6 lg:p-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className={`${card} rounded-2xl h-[52px]`} />
          ))}
        </div>
        <div className={`${card} rounded-2xl h-12 mb-6`} />
        <div className={`${card} rounded-2xl h-64`} />
      </div>
    </div>
  );
}
