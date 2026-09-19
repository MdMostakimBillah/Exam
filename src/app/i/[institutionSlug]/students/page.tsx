"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import Image from "next/image";
import { useParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useInstitutionBySlug } from "@/lib/storage/institutions";
import { useStudentsByInstitution, useUpdateStudent, useDeleteStudent } from "@/lib/storage/students";
import { useRegistrationsByInstitution } from "@/lib/storage/registrations";
import { useClasses } from "@/lib/storage/classes";
import { Student, Registration } from "@/lib/types";
import { Users, Search, GraduationCap, FileDown, UserCheck, ClipboardList, Edit, Trash2 } from "lucide-react";
import { TableActionMenu, TableActionItem } from "@/components/ui/table-action-menu";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { TableCheckbox } from "@/components/ui/table-checkbox";
import { useTableSelection } from "@/hooks/use-table-selection";
import { PdfExportModal, type PdfColumn } from "@/components/ui/pdf-export-modal";
import { useTheme } from "@/contexts/theme-context";
import { useLang } from "@/contexts/language-context";
import { cn } from "@/lib/utils/helpers";
import { useCurrentSession } from "@/lib/storage/sessions";

function getRegistrationStatus(
  studentId: string,
  registrations: Registration[]
): { label: string; status: "PENDING" | "APPROVED" | "REJECTED" | "NONE" } {
  const regs = registrations.filter(r => r.studentId === studentId);
  if (regs.length === 0) return { label: "No Registration", status: "NONE" };
  if (regs.some(r => r.status === "APPROVED")) return { label: "Approved", status: "APPROVED" };
  if (regs.some(r => r.status === "REJECTED")) return { label: "Rejected", status: "REJECTED" };
  return { label: "Pending", status: "PENDING" };
}

export default function InstitutionStudentsPage() {
  const params = useParams();
  const slug = params.institutionSlug as string;
  const { theme } = useTheme();
  const { lang: language, t } = useLang();
  const isDark = theme === "dark";
  const isBn = language === "bn";
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [editForm, setEditForm] = useState({ firstName: "", lastName: "", class: "", section: "", roll: "" });
  const [deletingStudent, setDeletingStudent] = useState<Student | null>(null);
  const { toast } = useToast();
  const updateStudentMutation = useUpdateStudent();
  const deleteStudentMutation = useDeleteStudent();

  useEffect(() => { setMounted(true); }, []);

  const { data: inst } = useInstitutionBySlug(slug);
  const { data: currentSession } = useCurrentSession();
  const { data: students = [] } = useStudentsByInstitution(inst?.id || '', currentSession?.id);
  const { data: registrations = [] } = useRegistrationsByInstitution(inst?.id || '', currentSession?.id);
  const { data: allClasses = [] } = useClasses();
  const classNames = useMemo(() => allClasses.length > 0 ? allClasses.map(c => c.name) : [...new Set(students.map(s => s.class))], [allClasses, students]);

  const studentRegStatus = useMemo(() => {
    const map: Record<string, { label: string; status: "PENDING" | "APPROVED" | "REJECTED" | "NONE" }> = {};
    for (const s of students) {
      map[s.id] = getRegistrationStatus(s.id, registrations);
    }
    return map;
  }, [students, registrations]);

  const filtered = students.filter(s => {
    const matchesSearch = `${s.firstName} ${s.lastName}`.toLowerCase().includes(search.toLowerCase()) || s.studentId.toLowerCase().includes(search.toLowerCase());
    const matchesClass = !classFilter || s.class === classFilter;
    const regStatus = studentRegStatus[s.id]?.status || "NONE";
    const matchesStatus = !statusFilter || regStatus === statusFilter;
    return matchesSearch && matchesClass && matchesStatus;
  });

  const selection = useTableSelection(filtered);

  const pdfColumns: PdfColumn[] = [
    { header: isBn ? 'শিক্ষার্থী' : 'Student', key: 'name' },
    { header: isBn ? 'আইডি' : 'ID', key: 'studentId' },
    { header: isBn ? 'শ্রেণী' : 'Class', key: 'class' },
    { header: isBn ? 'শাখা' : 'Section', key: 'section' },
    { header: isBn ? 'রোল' : 'Roll', key: 'roll' },
    { header: isBn ? 'নিবন্ধন স্থিতি' : 'Registration Status', key: 'regStatus' },
    { header: isBn ? 'স্থিতি' : 'Status', key: 'status' },
  ];

  const pdfData = filtered.map(s => ({
    name: `${s.firstName} ${s.lastName}`,
    studentId: s.studentId,
    class: s.class,
    section: s.section,
    roll: s.roll,
    regStatus: studentRegStatus[s.id]?.label || "None",
    status: s.status,
  }));

  const activeStudents = students.filter(s => s.status === 'ACTIVE').length;
  const registeredCount = students.filter(s => {
    const rs = studentRegStatus[s.id];
    return rs && rs.status !== "NONE";
  }).length;
  const pendingCount = students.filter(s => studentRegStatus[s.id]?.status === "PENDING").length;
  const approvedCount = students.filter(s => studentRegStatus[s.id]?.status === "APPROVED").length;
  const rejectedCount = students.filter(s => studentRegStatus[s.id]?.status === "REJECTED").length;

  const handleEdit = (student: Student) => {
    setEditingStudent(student);
    setEditForm({
      firstName: student.firstName,
      lastName: student.lastName,
      class: student.class,
      section: student.section,
      roll: student.roll,
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
      },
    });
    toast("success", isBn ? "শিক্ষার্থী আপডেট হয়েছে" : "Student updated");
    setEditingStudent(null);
    setRefreshKey(k => k + 1);
  };

  const handleDelete = async () => {
    if (!deletingStudent) return;
    await deleteStudentMutation.mutateAsync(deletingStudent.id);
    toast("success", isBn ? "শিক্ষার্থী মুছে ফেলা হয়েছে" : "Student deleted");
    setDeletingStudent(null);
    setRefreshKey(k => k + 1);
  };

  if (!mounted) return <StudentsSkeleton isDark={isDark} />;
  if (!inst) return null;

  const card = isDark
    ? "bg-[#141416] border border-white/[0.06] rounded-md"
    : "bg-white border border-zinc-200 rounded-md shadow-sm";
  const iconBg = isDark ? "bg-white/[0.08]" : "bg-zinc-100";
  const iconColor = isDark ? "text-zinc-300" : "text-zinc-600";
  const inputCls = isDark ? "bg-white/[0.04] border-white/[0.08] text-white placeholder:text-zinc-600" : "bg-zinc-50 border-zinc-200 text-zinc-900 placeholder:text-zinc-400";

  const regStatusBadge = (status: string) => {
    const map: Record<string, string> = {
      PENDING: isDark ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" : "bg-yellow-50 text-yellow-700 border-yellow-200",
      APPROVED: isDark ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-green-50 text-green-700 border-green-200",
      REJECTED: isDark ? "bg-red-500/10 text-red-400 border-red-500/20" : "bg-red-50 text-red-700 border-red-200",
      NONE: isDark ? "bg-zinc-500/10 text-zinc-400 border-zinc-500/20" : "bg-zinc-50 text-zinc-500 border-zinc-200",
    };
    return map[status] || map.NONE;
  };

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0a0a0b]" : "bg-zinc-50"}`}>
      <div className="max-w-[1600px] mx-auto p-6 lg:p-8">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className={`text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-zinc-900"}`}>
              {isBn ? 'শিক্ষার্থী' : 'Students'}
            </h1>
            <p className={`text-sm mt-1 ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>
              {isBn ? 'সমস্ত নিবন্ধিত শিক্ষার্থী দেখুন' : 'View all registered students and their registration status'}
            </p>
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          {[
            { icon: Users, label: isBn ? 'মোট শিক্ষার্থী' : 'Total Students', value: students.length },
            { icon: GraduationCap, label: isBn ? 'সক্রিয়' : 'Active', value: activeStudents },
            { icon: ClipboardList, label: isBn ? 'নিবন্ধিত' : 'Registered', value: registeredCount },
            { icon: UserCheck, label: isBn ? 'অনুমোদিত' : 'Approved', value: approvedCount },
            { icon: Users, label: isBn ? 'মুলতুবি' : 'Pending', value: pendingCount },
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
        <div className={`${card} p-4 mb-8`}>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${isDark ? "text-zinc-600" : "text-zinc-400"}`} />
              <Input placeholder={isBn ? "নাম বা আইডি দিয়ে অনুসন্ধান..." : "Search by name or ID..."} value={search} onChange={(e) => setSearch(e.target.value)} className={cn("pl-10", inputCls)} />
            </div>
            <Select options={[{ label: isBn ? 'সব শ্রেণী' : 'All Classes', value: '' }, ...classNames.map(c => ({ label: c, value: c }))]} value={classFilter} onChange={(e) => setClassFilter(e.target.value)} className={cn("w-full sm:w-36", inputCls)} />
            <Select
              options={[
                { label: isBn ? 'সব নিবন্ধন' : 'All Registration', value: '' },
                { label: isBn ? 'মুলতুবি' : 'Pending', value: 'PENDING' },
                { label: isBn ? 'অনুমোদিত' : 'Approved', value: 'APPROVED' },
                { label: isBn ? 'প্রত্যাখ্যাত' : 'Rejected', value: 'REJECTED' },
                { label: isBn ? 'নিবন্ধন নেই' : 'No Registration', value: 'NONE' },
              ]}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={cn("w-full sm:w-44", inputCls)}
            />
          </div>
        </div>

        {/* Table */}
        <div className={`${card}`}>
          <div className={`px-5 py-4 border-b ${isDark ? "border-white/[0.06]" : "border-zinc-100"}`}>
            <div className="flex items-center gap-2">
              <GraduationCap className={`h-4 w-4 ${isDark ? "text-zinc-400" : "text-zinc-500"}`} />
              <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>{isBn ? 'শিক্ষার্থী তালিকা' : 'Students List'}</h3>
              <span className={`text-[11px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>({filtered.length})</span>
            </div>
          </div>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className={`h-14 w-14 rounded-md flex items-center justify-center mb-4 ${isDark ? 'bg-white/[0.08]' : 'bg-zinc-100'}`}>
                <Users className={`h-7 w-7 ${iconColor}`} />
              </div>
              <p className={`text-sm font-medium ${isDark ? "text-white" : "text-zinc-900"}`}>{isBn ? 'কোনো শিক্ষার্থী পাওয়া যায়নি' : 'No students found'}</p>
              <p className={`text-xs mt-1 ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>{isBn ? 'ফিল্টার পরিবর্তন করে চেষ্টা করুন' : 'Try adjusting your filters'}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className={isDark ? 'border-white/[0.04] hover:bg-transparent' : 'border-zinc-100 hover:bg-transparent'}>
                    <TableHead className="w-10">
                      <TableCheckbox checked={selection.allSelected} indeterminate={selection.someSelected} onChange={selection.toggleAll} />
                    </TableHead>
                    <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'শিক্ষার্থী' : 'Student'}</TableHead>
                    <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'আইডি' : 'ID'}</TableHead>
                    <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'শ্রেণী' : 'Class'}</TableHead>
                    <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'শাখা' : 'Section'}</TableHead>
                    <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'রোল' : 'Roll'}</TableHead>
                    <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'নিবন্ধন স্থিতি' : 'Registration'}</TableHead>
                    <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'স্থিতি' : 'Status'}</TableHead>
                    <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(student => {
                  const regInfo = studentRegStatus[student.id] || { label: "None", status: "NONE" as const };
                  return (
                    <TableRow key={student.id} className={`${isDark ? 'border-white/[0.04] hover:bg-white/[0.02]' : 'border-zinc-100 hover:bg-zinc-50/50'} ${selection.isSelected(student.id) ? (isDark ? 'bg-[#9333ea]/10' : 'bg-purple-50') : ''}`}>
                      <TableCell className="w-10">
                        <TableCheckbox checked={selection.isSelected(student.id)} onChange={() => selection.toggle(student.id)} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          {student.photo ? (
                            <Image src={student.photo} alt="" width={32} height={32} unoptimized className="rounded-md object-cover shrink-0" />
                          ) : (
                            <div className={`h-8 w-8 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0 ${isDark ? 'bg-white/[0.08] text-zinc-300' : 'bg-zinc-100 text-zinc-600'}`}>
                              {student.firstName.charAt(0)}
                            </div>
                          )}
                          <span className={`text-sm font-medium ${isDark ? "text-zinc-100" : "text-zinc-800"}`}>{student.firstName} {student.lastName}</span>
                        </div>
                      </TableCell>
                      <TableCell className={`text-[11px] font-mono ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>{student.studentId}</TableCell>
                      <TableCell className={`text-[11px] ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>{student.class}</TableCell>
                      <TableCell className={`text-[11px] ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>{student.section}</TableCell>
                      <TableCell className={`text-[11px] ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>{student.roll}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${regStatusBadge(regInfo.status)}`}>
                          {regInfo.label}
                        </span>
                      </TableCell>
                      <TableCell><Badge status={student.status} /></TableCell>
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
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {/* Floating PDF Download Button */}
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

      <PdfExportModal open={showPdfModal} onClose={() => setShowPdfModal(false)} title={isBn ? 'শিক্ষার্থী তালিকা' : 'Student List'} columns={pdfColumns} data={pdfData} />

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
                  <label className={`block text-[11px] mb-1.5 font-medium ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>{isBn ? 'ইংরেজি নাম' : 'First Name'}</label>
                  <Input value={editForm.firstName} onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className={`block text-[11px] mb-1.5 font-medium ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>{isBn ? 'শেষ নাম' : 'Last Name'}</label>
                  <Input value={editForm.lastName} onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className={`block text-[11px] mb-1.5 font-medium ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>{isBn ? 'শ্রেণী' : 'Class'}</label>
                  <Input value={editForm.class} onChange={(e) => setEditForm({ ...editForm, class: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className={`block text-[11px] mb-1.5 font-medium ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>{isBn ? 'শাখা' : 'Section'}</label>
                  <Input value={editForm.section} onChange={(e) => setEditForm({ ...editForm, section: e.target.value })} className={inputCls} />
                </div>
                <div className="col-span-2">
                  <label className={`block text-[11px] mb-1.5 font-medium ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>{isBn ? 'রোল' : 'Roll'}</label>
                  <Input value={editForm.roll} onChange={(e) => setEditForm({ ...editForm, roll: e.target.value })} className={inputCls} />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-6">
              <button onClick={() => setEditingStudent(null)} className={`px-4 py-2 rounded-md text-[13px] font-medium transition-all ${isDark ? "bg-white/[0.06] text-zinc-300 hover:bg-white/[0.1]" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"}`}>
                {isBn ? 'বাতিল' : 'Cancel'}
              </button>
              <button onClick={handleSaveEdit} className={`px-4 py-2 rounded-md text-[13px] font-medium transition-all ${isDark ? "bg-white text-black hover:bg-white/90" : "bg-zinc-900 text-white hover:bg-zinc-800"}`}>
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
              {isBn ? `"${deletingStudent.firstName} ${deletingStudent.lastName}" মুছে ফেলা হবে। এই কাজটি পূর্বাবস্থায় ফেরানো যাবে না।` : `"${deletingStudent.firstName} ${deletingStudent.lastName}" will be deleted. This action cannot be undone.`}
            </p>
            <div className="flex items-center justify-end gap-2 mt-6">
              <button onClick={() => setDeletingStudent(null)} className={`px-4 py-2 rounded-md text-[13px] font-medium transition-all ${isDark ? "bg-white/[0.06] text-zinc-300 hover:bg-white/[0.1]" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"}`}>
                {isBn ? 'বাতিল' : 'Cancel'}
              </button>
              <button onClick={handleDelete} className="px-4 py-2 rounded-md text-[13px] font-medium transition-all bg-red-600 text-white hover:bg-red-700">
                {isBn ? 'মুছুন' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StudentsSkeleton({ isDark }: { isDark: boolean }) {
  const card = isDark ? "bg-[#141416] border border-white/[0.06]" : "bg-white border border-zinc-200 shadow-sm";
  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0a0a0b]" : "bg-zinc-50"}`}>
      <div className="max-w-[1600px] mx-auto p-6 lg:p-8">
        <div className="mb-8">
          <div className={`h-8 w-48 rounded-md ${isDark ? 'bg-white/[0.06]' : 'bg-zinc-200'}`} />
          <div className={`h-4 w-64 rounded mt-2 ${isDark ? 'bg-white/[0.04]' : 'bg-zinc-200/60'}`} />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          {[1, 2, 3, 4, 5].map((i) => (<div key={i} className={`${card} rounded-md h-[52px]`} />))}
        </div>
        <div className={`${card} rounded-md h-64`} />
      </div>
    </div>
  );
}
