"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableCheckbox } from "@/components/ui/table-checkbox";
import { useTableSelection } from "@/hooks/use-table-selection";
import { PdfExportModal, type PdfColumn } from "@/components/ui/pdf-export-modal";
import { useStudents, useUpdateStudent, useDeleteStudent } from "@/lib/storage/students";
import { useInstitutions } from "@/lib/storage/institutions";
import { useAllRegistrations, normalizeRegistrationStatus } from "@/lib/storage/registrations";
import { useToast } from "@/components/ui/toast";
import { Users, Search, Download, GraduationCap, UserCheck, FileDown, Edit, Trash2 } from "lucide-react";
import { TableActionMenu, TableActionItem } from "@/components/ui/table-action-menu";
import { useTheme } from "@/contexts/theme-context";
import { useLang } from "@/contexts/language-context";
import { Student, Registration } from "@/lib/types";
import { LoadingBar } from "@/components/ui/loading-bar";

/** Bilingual gender label (module-level so memos can depend on it safely). */
function genderLabel(g: Student["gender"] | undefined, isBn: boolean): string {
  if (g === "MALE") return isBn ? "পুরুষ" : "Male";
  if (g === "FEMALE") return isBn ? "মহিলা" : "Female";
  if (g === "OTHER") return isBn ? "অন্যান্য" : "Other";
  return "-";
}

export default function StudentsPage() {
  const { theme } = useTheme();
  const { lang: language, t } = useLang();
  const isDark = theme === "dark";
  const isBn = language === "bn";
  const { toast } = useToast();
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [institutionFilter, setInstitutionFilter] = useState("");
  const [genderFilter, setGenderFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [deletingStudent, setDeletingStudent] = useState<Student | null>(null);
  const [editForm, setEditForm] = useState({ firstName: "", lastName: "", class: "", section: "", roll: "", status: "" });
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => { setMounted(true); }, []);

  const { data: students = [], isFetching } = useStudents();
  const { data: institutions = [] } = useInstitutions();
  const { data: regs = [] } = useAllRegistrations();
  const updateStudentMutation = useUpdateStudent();
  const deleteStudentMutation = useDeleteStudent();
  const classes = useMemo(() => [...new Set(students.map(s => s.class))], [students]);
  const institutionMap = useMemo(() => new Map(institutions.map(i => [i.id, i.name])), [institutions]);
  const getInstitutionName = useCallback((id: string) => institutionMap.get(id) || 'Unknown', [institutionMap]);

  // Latest registration per student (used for Registration Number + status).
  const latestReg = useMemo(() => {
    const map = new Map<string, Registration>();
    for (const r of regs) {
      if (!r.studentId) continue;
      const existing = map.get(r.studentId);
      if (!existing || new Date(r.createdAt || 0) >= new Date(existing.createdAt || 0)) {
        map.set(r.studentId, r);
      }
    }
    return map;
  }, [regs]);
  const getRegNumber = (studentId: string) => latestReg.get(studentId)?.registrationNumber || '-';
  const getRegStatus = (studentId: string) => normalizeRegistrationStatus(latestReg.get(studentId)?.status);

  const filtered = useMemo(() => students.filter(s => {
    const reg = latestReg.get(s.id);
    const regNum = reg?.registrationNumber || '';
    const regStatus = normalizeRegistrationStatus(reg?.status);
    const matchesSearch = `${s.firstName} ${s.lastName}`.toLowerCase().includes(search.toLowerCase())
      || s.studentId.toLowerCase().includes(search.toLowerCase())
      || regNum.toLowerCase().includes(search.toLowerCase())
      || (s.fatherName || '').toLowerCase().includes(search.toLowerCase())
      || (s.motherName || '').toLowerCase().includes(search.toLowerCase())
      || (s.phone || '').toLowerCase().includes(search.toLowerCase());
    const matchesClass = !classFilter || s.class === classFilter;
    const matchesInst = !institutionFilter || s.institutionId === institutionFilter;
    const matchesGender = !genderFilter || s.gender === genderFilter;
    const matchesStatus = !statusFilter || regStatus === statusFilter;
    return matchesSearch && matchesClass && matchesInst && matchesGender && matchesStatus;
  }), [students, latestReg, search, classFilter, institutionFilter, genderFilter, statusFilter, refreshKey]);

  const selection = useTableSelection(filtered);

  const pdfColumns: PdfColumn[] = useMemo(() => [
    { header: isBn ? 'ক্রমিক' : 'SN', key: 'sn' },
    { header: isBn ? 'শিক্ষার্থী' : 'Student', key: 'name' },
    { header: isBn ? 'রেজিস্ট্রেশন নম্বর' : 'Registration Number', key: 'regNumber' },
    { header: isBn ? 'প্রতিষ্ঠান' : 'Institution', key: 'institution' },
    { header: isBn ? 'পিতার নাম' : 'Father', key: 'father' },
    { header: isBn ? 'মাতার নাম' : 'Mother', key: 'mother' },
    { header: isBn ? 'ফোন' : 'Phone', key: 'phone' },
    { header: isBn ? 'লিঙ্গ' : 'Gender', key: 'gender' },
    { header: isBn ? 'শ্রেণী' : 'Class', key: 'class' },
    { header: isBn ? 'রোল' : 'Roll', key: 'roll' },
    { header: isBn ? 'স্থিতি' : 'Status', key: 'status' },
  ], [isBn]);

  const pdfData = useMemo(() => filtered
    .map((s, i) => ({ s, sn: i + 1 }))
    .filter(({ s }) => selection.isSelected(s.id))
    .map(({ s, sn }) => ({
      sn: String(sn),
      name: `${s.firstName} ${s.lastName}`,
      regNumber: latestReg.get(s.id)?.registrationNumber || '-',
      photo: s.photo || '',
      institution: getInstitutionName(s.institutionId),
      father: s.fatherName || '-',
      mother: s.motherName || '-',
      phone: s.phone || '-',
      gender: genderLabel(s.gender, isBn),
      class: s.class,
      roll: s.roll,
      status: normalizeRegistrationStatus(latestReg.get(s.id)?.status) || s.status,
    })), [filtered, selection, getInstitutionName, latestReg, isBn]);

  const approvedCount = useMemo(() => students.filter(s => normalizeRegistrationStatus(latestReg.get(s.id)?.status) === 'APPROVED').length, [students, latestReg]);
  const pendingCount = useMemo(() => students.filter(s => normalizeRegistrationStatus(latestReg.get(s.id)?.status) === 'PENDING').length, [students, latestReg]);
  const rejectedCount = useMemo(() => students.filter(s => normalizeRegistrationStatus(latestReg.get(s.id)?.status) === 'REJECTED').length, [students, latestReg]);

  const handleEdit = (student: Student) => {
    setEditingStudent(student);
    setEditForm({
      firstName: student.firstName,
      lastName: student.lastName,
      class: student.class,
      section: student.section,
      roll: student.roll,
      status: student.status,
    });
    setMenuOpenId(null);
  };

  const handleSaveEdit = async () => {
    if (!editingStudent) return;
    await updateStudentMutation.mutateAsync({
      id: editingStudent.id,
      data: {
        firstName: editForm.firstName,
        lastName: editForm.lastName,
        class: editForm.class,
        section: editForm.section,
        roll: editForm.roll,
        status: editForm.status as any,
      },
    });
    toast("success", isBn ? "শিক্ষার্থী আপডেট হয়েছে" : "Student updated");
    setEditingStudent(null);
    setRefreshKey(k => k + 1);
  };

  const handleDelete = async () => {
    if (!deletingStudent) return;
    await deleteStudentMutation.mutateAsync(deletingStudent.id);
    toast("success", isBn ? "শিক্ষার্থী মুছে ফেলা হয়েছে" : "Student deleted permanently");
    setDeletingStudent(null);
    setRefreshKey(k => k + 1);
  };

  if (!mounted) return <StudentsSkeleton isDark={isDark} />;

  const card = isDark
    ? "bg-[#141416] border border-white/[0.06] rounded-md"
    : "bg-white border border-zinc-200 rounded-md shadow-sm";
  const iconBg = "bg-brand-accent-soft";
  const iconColor = "text-brand-accent";
  const inputCls = isDark ? "bg-white/[0.04] border-white/[0.08] text-white placeholder:text-zinc-600" : "bg-zinc-50 border-zinc-200 text-zinc-900 placeholder:text-zinc-400";
  const labelCls = isDark ? "text-zinc-400" : "text-zinc-600";

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0a0a0b]" : "bg-zinc-50"}`}>
      <LoadingBar isLoading={isFetching} />
      <div className="max-w-[1600px] mx-auto p-6 lg:p-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className={`text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-zinc-900"}`}>
            {isBn ? 'শিক্ষার্থী' : 'Students'}
          </h1>
          <p className={`text-sm mt-1 ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>
            {isBn ? 'সমস্ত নিবন্ধিত শিক্ষার্থী দেখুন এবং পরিচালনা করুন' : 'View and manage all registered students'}
          </p>
        </div>
        {/* Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { icon: Users, label: isBn ? 'মোট শিক্ষার্থী' : 'Total Students', value: students.length },
            { icon: UserCheck, label: isBn ? 'অনুমোদিত' : 'Approved', value: approvedCount },
            { icon: Users, label: isBn ? 'মুলতুবি' : 'Pending', value: pendingCount },
            { icon: Users, label: isBn ? 'প্রত্যাখ্যাত' : 'Rejected', value: rejectedCount },
          ].map((s) => (
            <div key={s.label} className={`${card} px-4 py-3 flex items-center gap-3`}>
              <div className={`h-10 w-10 rounded-md flex items-center justify-center shrink-0 ${iconBg}`}>
                <s.icon className={`h-5 w-5 ${iconColor}`} />
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
                placeholder={isBn ? "নাম, অভিভাবক, ফোন বা রেজিস্ট্রেশন নম্বর দিয়ে অনুসন্ধান..." : "Search by name, parent, phone or reg number..."}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={`pl-10 ${inputCls}`}
              />
            </div>
            <Select
              options={[{ label: isBn ? 'সব শ্রেণী' : 'All Classes', value: '' }, ...classes.map(c => ({ label: c, value: c }))]}
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className={`w-full sm:w-36 ${inputCls}`}
            />
            <Select
              options={[{ label: isBn ? 'সব প্রতিষ্ঠান' : 'All Institutions', value: '' }, ...institutions.map(i => ({ label: i.name, value: i.id }))]}
              value={institutionFilter}
              onChange={(e) => setInstitutionFilter(e.target.value)}
              className={`w-full sm:w-48 ${inputCls}`}
            />
            <Select
              options={[
                { label: isBn ? 'সব লিঙ্গ' : 'All Gender', value: '' },
                { label: isBn ? 'পুরুষ' : 'Male', value: 'MALE' },
                { label: isBn ? 'মহিলা' : 'Female', value: 'FEMALE' },
                { label: isBn ? 'অন্যান্য' : 'Other', value: 'OTHER' },
              ]}
              value={genderFilter}
              onChange={(e) => setGenderFilter(e.target.value)}
              className={`w-full sm:w-32 ${inputCls}`}
            />
            <Select
              options={[
                { label: isBn ? 'সব স্ট্যাটাস' : 'All Status', value: '' },
                { label: 'APPROVED', value: 'APPROVED' },
                { label: 'PENDING', value: 'PENDING' },
                { label: 'REJECTED', value: 'REJECTED' },
              ]}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={`w-full sm:w-36 ${inputCls}`}
            />
            <button className={`flex items-center justify-center gap-2 px-4 py-2 rounded-md text-[11px] font-medium transition-colors ${isDark ? "bg-white/[0.06] text-zinc-400 hover:text-white hover:bg-white/[0.1]" : "bg-zinc-100 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200"}`}>
              <Download className="h-3.5 w-3.5" /> {isBn ? 'এক্সপোর্ট' : 'Export'}
            </button>
          </div>
        </div>

        {/* Table */}
        <div className={`${card}`}>
          <div className={`px-5 py-4 border-b ${isDark ? "border-white/[0.06]" : "border-zinc-100"}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GraduationCap className={`h-4 w-4 ${isDark ? "text-zinc-400" : "text-zinc-500"}`} />
                <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>
                  {isBn ? 'শিক্ষার্থী তালিকা' : 'Students List'}
                </h3>
                <span className={`text-[11px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>({filtered.length})</span>
              </div>
            </div>
          </div>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className={`h-14 w-14 rounded-md flex items-center justify-center mb-4 ${isDark ? 'bg-white/[0.06]' : 'bg-zinc-100'}`}>
                <Users className={`h-7 w-7 ${iconColor}`} />
              </div>
              <p className={`text-sm font-medium ${isDark ? "text-white" : "text-zinc-900"}`}>{isBn ? 'কোনো শিক্ষার্থী পাওয়া যায়নি' : 'No students found'}</p>
              <p className={`text-xs mt-1 ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>{isBn ? 'অনুসন্ধান বা ফিল্টার পরিবর্তন করুন' : 'Try adjusting your search or filters'}</p>
            </div>
          ) : (
            <Table className="min-w-[1300px] whitespace-nowrap">
              <TableHeader>
                <TableRow className={isDark ? 'border-white/[0.04] hover:bg-transparent' : 'border-zinc-100 hover:bg-transparent'}>
                  <TableHead className="w-10">
                    <TableCheckbox checked={selection.allSelected} indeterminate={selection.someSelected} onChange={selection.toggleAll} />
                  </TableHead>
                  <TableHead className={`w-12 text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'ক্রমিক' : 'SN'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'শিক্ষার্থী' : 'Student'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'রেজিস্ট্রেশন নম্বর' : 'Registration Number'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider hidden md:table-cell ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'প্রতিষ্ঠান' : 'Institution'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider hidden md:table-cell ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'পিতার নাম' : 'Father'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider hidden lg:table-cell ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'মাতার নাম' : 'Mother'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'ফোন' : 'Phone'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'লিঙ্গ' : 'Gender'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'শ্রেণী' : 'Class'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'রোল' : 'Roll'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'স্থিতি' : 'Status'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.slice(0, 20).map((student, idx) => (
                  <TableRow key={student.id} className={`${isDark ? 'border-white/[0.04] hover:bg-white/[0.02]' : 'border-zinc-100 hover:bg-zinc-50/50'} ${selection.isSelected(student.id) ? ('bg-brand-accent-soft') : ''}`}>
                    <TableCell className="w-10">
                      <TableCheckbox checked={selection.isSelected(student.id)} onChange={() => selection.toggle(student.id)} />
                    </TableCell>
                    <TableCell className={`w-12 text-[11px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>{idx + 1}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        {student.photo ? (
                          <Image src={student.photo} alt="" width={32} height={32} unoptimized className="rounded-md object-cover shrink-0 h-8 w-8" />
                        ) : (
                          <div className={`h-8 w-8 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0 ${isDark ? 'bg-white/[0.08] text-zinc-300' : 'bg-zinc-100 text-zinc-600'}`}>
                            {student.firstName.charAt(0)}
                          </div>
                        )}
                        <span className={`text-sm font-medium ${isDark ? "text-zinc-100" : "text-zinc-800"}`}>
                          {student.firstName} {student.lastName}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className={`text-[11px] font-mono ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>{getRegNumber(student.id)}</TableCell>
                    <TableCell className={`text-[11px] hidden md:table-cell ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>{getInstitutionName(student.institutionId)}</TableCell>
                    <TableCell className={`text-[11px] hidden md:table-cell ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>{student.fatherName || '-'}</TableCell>
                    <TableCell className={`text-[11px] hidden lg:table-cell ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>{student.motherName || '-'}</TableCell>
                    <TableCell className={`text-[11px] font-mono ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>{student.phone || '-'}</TableCell>
                    <TableCell className={`text-[11px] ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>{genderLabel(student.gender, isBn)}</TableCell>
                    <TableCell className={`text-[11px] ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>{student.class}</TableCell>
                    <TableCell className={`text-[11px] ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>{student.roll}</TableCell>
                    <TableCell><Badge status={getRegStatus(student.id) || student.status} /></TableCell>
                    <TableCell>
                      <TableActionMenu id={student.id} openId={menuOpenId} onToggle={setMenuOpenId} isDark={isDark}>
                        <TableActionItem onClick={() => handleEdit(student)} isDark={isDark}>
                          <Edit className="h-3.5 w-3.5" /> {isBn ? 'সম্পাদনা' : 'Edit'}
                        </TableActionItem>
                        <TableActionItem onClick={() => { setDeletingStudent(student); setMenuOpenId(null); }} isDark={isDark} variant="danger">
                          <Trash2 className="h-3.5 w-3.5" /> {isBn ? 'মুছুন' : 'Delete'}
                        </TableActionItem>
                      </TableActionMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Floating PDF Button */}
        {selection.selectedCount > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 animate-slideUp">
            <div className={`flex items-center gap-3 px-5 py-3 rounded-md shadow-2xl ${isDark ? 'bg-[#1a1a1c] border border-white/[0.1]' : 'bg-white border border-zinc-200'}`}>
              <span className={`text-[11px] font-medium ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                {selection.selectedCount} {isBn ? 'টি নির্বাচিত' : 'selected'}
              </span>
              <button
                onClick={() => setShowPdfModal(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-md text-[11px] font-medium bg-brand-accent text-brand-accent-fg hover:opacity-90 transition-colors"
              >
                <FileDown className="h-3.5 w-3.5" /> {isBn ? 'ডাউনলোড পিডিএফ' : 'Download PDF'}
              </button>
            </div>
          </div>
        )}

        {/* PDF Export Modal */}
        <PdfExportModal
          open={showPdfModal}
          onClose={() => setShowPdfModal(false)}
          title={isBn ? 'শিক্ষার্থী তালিকা' : 'Student List'}
          columns={pdfColumns}
          data={pdfData}
          imageKey="photo"
          imageHeader={isBn ? 'ছবি' : 'Photo'}
        />

        {/* Edit Student Modal */}
        {editingStudent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm animate-fadeIn" onClick={() => setEditingStudent(null)} />
            <div className={`relative z-50 w-full max-w-xl rounded-md p-6 shadow-2xl animate-scaleIn backdrop-blur-xl ${isDark ? 'border border-white/[0.06] bg-[#0D0D0D]' : 'border border-zinc-200 bg-white'}`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>{isBn ? 'শিক্ষার্থী সম্পাদনা' : 'Edit Student'}</h3>
                <button onClick={() => setEditingStudent(null)} className={`p-1 rounded ${isDark ? "text-zinc-500 hover:text-white" : "text-zinc-400 hover:text-zinc-600"}`}>×</button>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-[11px] mb-1.5 font-medium ${labelCls}`}>{isBn ? 'ইংরেজি নাম' : 'First Name'}</label>
                    <Input value={editForm.firstName} onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })} className={inputCls} />
                  </div>
                  <div>
                    <label className={`block text-[11px] mb-1.5 font-medium ${labelCls}`}>{isBn ? 'শেষ নাম' : 'Last Name'}</label>
                    <Input value={editForm.lastName} onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })} className={inputCls} />
                  </div>
                  <div>
                    <label className={`block text-[11px] mb-1.5 font-medium ${labelCls}`}>{isBn ? 'শ্রেণী' : 'Class'}</label>
                    <Input value={editForm.class} onChange={(e) => setEditForm({ ...editForm, class: e.target.value })} className={inputCls} />
                  </div>
                  <div>
                    <label className={`block text-[11px] mb-1.5 font-medium ${labelCls}`}>{isBn ? 'শাখা' : 'Section'}</label>
                    <Input value={editForm.section} onChange={(e) => setEditForm({ ...editForm, section: e.target.value })} className={inputCls} />
                  </div>
                  <div>
                    <label className={`block text-[11px] mb-1.5 font-medium ${labelCls}`}>{isBn ? 'রোল' : 'Roll'}</label>
                    <Input value={editForm.roll} onChange={(e) => setEditForm({ ...editForm, roll: e.target.value })} className={inputCls} />
                  </div>
                  <div>
                    <label className={`block text-[11px] mb-1.5 font-medium ${labelCls}`}>{isBn ? 'স্থিতি' : 'Status'} *</label>
                    <Select
                      options={[
                        { label: 'ACTIVE', value: 'ACTIVE' },
                        { label: 'PENDING', value: 'PENDING' },
                      ]}
                      value={editForm.status}
                      onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                      className={inputCls}
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 mt-6">
                <button onClick={() => setEditingStudent(null)} className={`px-4 py-2 rounded-md text-[13px] font-medium transition-all ${isDark ? "bg-white/[0.06] text-zinc-300 hover:bg-white/[0.1]" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"}`}>
                  {isBn ? 'বাতিল' : 'Cancel'}
                </button>
                <button onClick={handleSaveEdit} className={`px-4 py-2 rounded-md text-[13px] font-medium transition-all ${"bg-brand-accent text-brand-accent-fg hover:opacity-90"}`}>
                  {isBn ? 'সংরক্ষণ' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deletingStudent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm animate-fadeIn" onClick={() => setDeletingStudent(null)} />
            <div className={`relative z-50 w-full max-w-md rounded-md p-6 shadow-2xl animate-scaleIn backdrop-blur-xl ${isDark ? 'border border-white/[0.06] bg-[#0D0D0D]' : 'border border-zinc-200 bg-white'}`}>
              <h3 className={`text-sm font-semibold mb-2 ${isDark ? "text-white" : "text-zinc-900"}`}>{isBn ? 'শিক্ষার্থী মুছুন?' : 'Delete Student?'}</h3>
              <p className={`text-sm ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
                {isBn 
                  ? `"${deletingStudent.firstName} ${deletingStudent.lastName}" কে সম্পূর্ণভাবে মুছে ফেলা হবে। এই শিক্ষার্থীর সমস্ত নিবন্ধন, পরীক্ষার ফলাফল, মার্কস, অ্যাডমিট কার্ড এবং ছবি ডাটাবেজ থেকে মুছে ফেলা হবে। এই কাজটি পূর্বাবস্থায় ফেরানো যাবে না।`
                  : `"${deletingStudent.firstName} ${deletingStudent.lastName}" will be permanently deleted. All registrations, exam results, marks, admit cards, and photos will be removed from the database. This action cannot be undone.`}
              </p>
              <div className="flex items-center justify-end gap-2 mt-6">
                <button onClick={() => setDeletingStudent(null)} className={`px-4 py-2 rounded-md text-[13px] font-medium transition-all ${isDark ? "bg-white/[0.06] text-zinc-300 hover:bg-white/[0.1]" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"}`}>
                  {isBn ? 'বাতিল' : 'Cancel'}
                </button>
                <button onClick={handleDelete} className="px-4 py-2 rounded-md text-[13px] font-medium transition-all bg-red-600 text-white hover:bg-red-700">
                  {isBn ? 'মুছুন' : 'Delete Permanently'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StudentsSkeleton({ isDark }: { isDark: boolean }) {
  const shimmer = isDark ? "bg-white/[0.04]" : "bg-zinc-300/80";
  const card = isDark ? "bg-[#141416] border border-white/[0.06]" : "bg-zinc-200 border border-zinc-300 shadow-sm";

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
