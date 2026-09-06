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
import { getStudentsByInstitution, createStudent, updateStudent, deleteStudent } from "@/lib/storage/students";
import { getClasses } from "@/lib/storage/classes";
import { Student } from "@/lib/types";
import { Users, Search, GraduationCap, Plus, MoreVertical, Edit, Trash2, Eye, EyeOff } from "lucide-react";
import { useTheme } from "@/contexts/theme-context";
import { useLang } from "@/contexts/language-context";
import { cn } from "@/lib/utils/helpers";

const emptyForm = {
  firstName: "", lastName: "", studentId: "", class: "", section: "", roll: "",
  dateOfBirth: "", gender: "MALE" as "MALE" | "FEMALE" | "OTHER",
  fatherName: "", motherName: "", phone: "", address: "", status: "ACTIVE" as "ACTIVE" | "INACTIVE",
};

export default function InstitutionStudentsPage() {
  const params = useParams();
  const slug = params.institutionSlug as string;
  const { theme } = useTheme();
  const { lang: language, t } = useLang();
  const isDark = theme === "dark";
  const isBn = language === "bn";
  const { toast } = useToast();
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<Student | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return <StudentsSkeleton isDark={isDark} />;

  const inst = getInstitutionBySlug(slug);
  if (!inst) return null;

  const students = getStudentsByInstitution(inst.id);
  const allClasses = getClasses();
  const classNames = allClasses.length > 0 ? allClasses.map(c => c.name) : [...new Set(students.map(s => s.class))];

  const filtered = students.filter(s => {
    const matchesSearch = `${s.firstName} ${s.lastName}`.toLowerCase().includes(search.toLowerCase()) || s.studentId.toLowerCase().includes(search.toLowerCase());
    const matchesClass = !classFilter || s.class === classFilter;
    return matchesSearch && matchesClass;
  });

  const activeStudents = students.filter(s => s.status === 'ACTIVE').length;

  const handleCreate = () => {
    setEditingStudent(null);
    setFormData(emptyForm);
    setShowModal(true);
    setMenuOpenId(null);
  };

  const handleEdit = (s: Student) => {
    setEditingStudent(s);
    setFormData({
      firstName: s.firstName, lastName: s.lastName, studentId: s.studentId, class: s.class,
      section: s.section, roll: s.roll, dateOfBirth: s.dateOfBirth, gender: s.gender,
      fatherName: s.fatherName, motherName: s.motherName, phone: s.phone, address: s.address,
      status: s.status,
    });
    setShowModal(true);
    setMenuOpenId(null);
  };

  const handleSave = () => {
    if (!formData.firstName || !formData.lastName || !formData.studentId || !formData.class) {
      toast("error", isBn ? "প্রয়োজনীয় ঘর পূরণ করুন" : "Please fill required fields");
      return;
    }
    if (editingStudent) {
      updateStudent(editingStudent.id, { ...formData, updatedAt: new Date().toISOString() });
      toast("success", isBn ? "শিক্ষার্থী আপডেট হয়েছে" : "Student updated");
    } else {
      createStudent({ ...formData, institutionId: inst.id });
      toast("success", isBn ? "শিক্ষার্থী যোগ হয়েছে" : "Student created");
    }
    setShowModal(false);
    setRefreshKey(k => k + 1);
  };

  const handleDelete = (s: Student) => {
    deleteStudent(s.id);
    toast("success", isBn ? "শিক্ষার্থী মুছে ফেলা হয়েছে" : "Student deleted");
    setShowDeleteConfirm(null);
    setRefreshKey(k => k + 1);
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
              {isBn ? 'শিক্ষার্থী' : 'Students'}
            </h1>
            <p className={`text-sm mt-1 ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>
              {isBn ? 'সমস্ত নিবন্ধিত শিক্ষার্থী পরিচালনা করুন' : 'Manage all registered students'}
            </p>
          </div>
          <button onClick={handleCreate} className={cn("flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-medium transition-all", isDark ? "bg-white text-black hover:bg-white/90" : "bg-zinc-900 text-white hover:bg-zinc-800")}>
            <Plus className="h-4 w-4" /> {isBn ? 'শিক্ষার্থী যোগ করুন' : 'Add Student'}
          </button>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {[
            { icon: Users, label: isBn ? 'মোট শিক্ষার্থী' : 'Total Students', value: students.length },
            { icon: GraduationCap, label: isBn ? 'সক্রিয়' : 'Active', value: activeStudents },
            { icon: Users, label: isBn ? 'শ্রেণী' : 'Classes', value: classNames.length },
          ].map((s) => (
            <div key={s.label} className={`${card} px-4 py-3 flex items-center gap-3`}>
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
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
              <div className={`h-14 w-14 rounded-2xl flex items-center justify-center mb-4 ${isDark ? 'bg-white/[0.08]' : 'bg-zinc-100'}`}>
                <Users className={`h-7 w-7 ${iconColor}`} />
              </div>
              <p className={`text-sm font-medium ${isDark ? "text-white" : "text-zinc-900"}`}>{isBn ? 'কোনো শিক্ষার্থী পাওয়া যায়নি' : 'No students found'}</p>
              <p className={`text-xs mt-1 ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>{isBn ? 'নতুন শিক্ষার্থী যোগ করুন' : 'Add a new student to get started'}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className={isDark ? 'border-white/[0.04] hover:bg-transparent' : 'border-zinc-100 hover:bg-transparent'}>
                    <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'শিক্ষার্থী' : 'Student'}</TableHead>
                    <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'আইডি' : 'ID'}</TableHead>
                    <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'শ্রেণী' : 'Class'}</TableHead>
                    <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'শাখা' : 'Section'}</TableHead>
                    <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'রোল' : 'Roll'}</TableHead>
                    <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'স্থিতি' : 'Status'}</TableHead>
                    <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(student => (
                  <TableRow key={student.id} className={`${isDark ? 'border-white/[0.04] hover:bg-white/[0.02]' : 'border-zinc-100 hover:bg-zinc-50/50'}`}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <div className={`h-8 w-8 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 ${isDark ? 'bg-white/[0.08] text-zinc-300' : 'bg-zinc-100 text-zinc-600'}`}>
                          {student.firstName.charAt(0)}
                        </div>
                        <span className={`text-sm font-medium ${isDark ? "text-zinc-100" : "text-zinc-800"}`}>{student.firstName} {student.lastName}</span>
                      </div>
                    </TableCell>
                    <TableCell className={`text-[11px] font-mono ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>{student.studentId}</TableCell>
                    <TableCell className={`text-[11px] ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>{student.class}</TableCell>
                    <TableCell className={`text-[11px] ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>{student.section}</TableCell>
                    <TableCell className={`text-[11px] ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>{student.roll}</TableCell>
                    <TableCell><Badge status={student.status} /></TableCell>
                    <TableCell>
                      <div className="relative">
                        <button onClick={() => setMenuOpenId(menuOpenId === student.id ? null : student.id)} className={`p-1.5 rounded-lg transition-all ${isDark ? "text-zinc-500 hover:text-white hover:bg-white/[0.05]" : "text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100"}`}>
                          <MoreVertical className="h-3.5 w-3.5" />
                        </button>
                        {menuOpenId === student.id && (
                          <div className={`absolute right-0 top-full mt-1 w-36 rounded-xl border z-50 py-1 shadow-xl ${isDark ? "border-white/[0.06] bg-[#141416]" : "border-zinc-200 bg-white shadow-zinc-200/50"}`}>
                            <button onClick={() => handleEdit(student)} className={`flex items-center gap-2 w-full px-3 py-2 text-xs transition-colors ${isDark ? "text-zinc-400 hover:text-white hover:bg-white/[0.05]" : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50"}`}><Edit className="h-3.5 w-3.5" /> {isBn ? 'সম্পাদনা' : 'Edit'}</button>
                            <button onClick={() => { setShowDeleteConfirm(student); setMenuOpenId(null); }} className={`flex items-center gap-2 w-full px-3 py-2 text-xs transition-colors text-red-400 hover:bg-red-500/10`}><Trash2 className="h-3.5 w-3.5" /> {isBn ? 'মুছুন' : 'Delete'}</button>
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
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editingStudent ? (isBn ? 'শিক্ষার্থী সম্পাদনা' : 'Edit Student') : (isBn ? 'নতুন শিক্ষার্থী' : 'New Student')} maxWidth="max-w-xl">
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: isBn ? 'প্রথম নাম *' : 'First Name *', key: 'firstName', placeholder: isBn ? 'প্রথম নাম' : 'First name' },
            { label: isBn ? 'শেষ নাম *' : 'Last Name *', key: 'lastName', placeholder: isBn ? 'শেষ নাম' : 'Last name' },
            { label: isBn ? 'শিক্ষার্থী আইডি *' : 'Student ID *', key: 'studentId', placeholder: isBn ? 'আইডি' : 'Student ID' },
            { label: isBn ? 'শ্রেণী *' : 'Class *', key: 'class', type: 'select', options: classNames },
            { label: isBn ? 'শাখা' : 'Section', key: 'section', placeholder: isBn ? 'শাখা' : 'Section' },
            { label: isBn ? 'রোল' : 'Roll', key: 'roll', placeholder: isBn ? 'রোল নম্বর' : 'Roll number' },
            { label: isBn ? 'জন্ম তারিখ' : 'Date of Birth', key: 'dateOfBirth', type: 'date' },
            { label: isBn ? 'লিঙ্গ' : 'Gender', key: 'gender', type: 'select', options: ['MALE', 'FEMALE', 'OTHER'] },
            { label: isBn ? 'পিতার নাম' : 'Father Name', key: 'fatherName', placeholder: isBn ? 'পিতার নাম' : 'Father name' },
            { label: isBn ? 'মাতার নাম' : 'Mother Name', key: 'motherName', placeholder: isBn ? 'মাতার নাম' : 'Mother name' },
            { label: isBn ? 'ফোন' : 'Phone', key: 'phone', placeholder: isBn ? 'ফোন নম্বর' : 'Phone number' },
            { label: isBn ? 'ঠিকানা' : 'Address', key: 'address', placeholder: isBn ? 'পূর্ণ ঠিকানা' : 'Full address' },
          ].map(field => (
            <div key={field.key} className={field.key === 'address' ? 'col-span-2' : ''}>
              <label className={`block text-[11px] mb-1.5 font-medium ${labelCls}`}>{field.label}</label>
              {field.type === 'select' ? (
                <Select
                  options={(field.options || []).map(o => typeof o === 'string' ? { label: o, value: o } : o)}
                  value={String((formData as any)[field.key])}
                  onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                  className={inputCls}
                />
              ) : field.type === 'date' ? (
                <Input type="date" value={String((formData as any)[field.key])} onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })} className={inputCls} />
              ) : (
                <Input placeholder={field.placeholder} value={String((formData as any)[field.key])} onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })} className={inputCls} />
              )}
            </div>
          ))}
        </div>
        <ModalFooter>
          <button onClick={() => setShowModal(false)} className={`px-4 py-2 rounded-xl text-[13px] font-medium transition-all ${isDark ? "bg-white/[0.06] text-zinc-300 hover:bg-white/[0.1]" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"}`}>{isBn ? 'বাতিল' : 'Cancel'}</button>
          <button onClick={handleSave} className={`px-4 py-2 rounded-xl text-[13px] font-medium transition-all ${isDark ? "bg-white text-black hover:bg-white/90" : "bg-zinc-900 text-white hover:bg-zinc-800"}`}>
            {editingStudent ? (isBn ? 'আপডেট' : 'Update') : (isBn ? 'তৈরি করুন' : 'Create')}
          </button>
        </ModalFooter>
      </Modal>

      {/* Delete Confirmation */}
      <Modal open={!!showDeleteConfirm} onClose={() => setShowDeleteConfirm(null)} title={isBn ? 'শিক্ষার্থী মুছুন?' : 'Delete Student?'}>
        <p className={`text-sm ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
          {isBn ? `"${showDeleteConfirm?.firstName} ${showDeleteConfirm?.lastName}" মুছে ফেলা হবে। এই কাজটি পূর্বাবস্থায় ফেরানো যাবে না।` : `"${showDeleteConfirm?.firstName} ${showDeleteConfirm?.lastName}" will be permanently deleted. This action cannot be undone.`}
        </p>
        <ModalFooter>
          <button onClick={() => setShowDeleteConfirm(null)} className={`px-4 py-2 rounded-xl text-[13px] font-medium transition-all ${isDark ? "bg-white/[0.06] text-zinc-300 hover:bg-white/[0.1]" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"}`}>{isBn ? 'বাতিল' : 'Cancel'}</button>
          <button onClick={() => showDeleteConfirm && handleDelete(showDeleteConfirm)} className="px-4 py-2 rounded-xl text-[13px] font-medium transition-all bg-red-600 text-white hover:bg-red-700">{isBn ? 'মুছুন' : 'Delete'}</button>
        </ModalFooter>
      </Modal>
    </div>
  );
}

function StudentsSkeleton({ isDark }: { isDark: boolean }) {
  const card = isDark ? "bg-[#141416] border border-white/[0.06]" : "bg-white border border-zinc-200 shadow-sm";
  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0a0a0b]" : "bg-zinc-50"}`}>
      <div className="max-w-[1600px] mx-auto p-6 lg:p-8">
        <div className="mb-8">
          <div className={`h-8 w-48 rounded-lg ${isDark ? 'bg-white/[0.06]' : 'bg-zinc-200'}`} />
          <div className={`h-4 w-64 rounded mt-2 ${isDark ? 'bg-white/[0.04]' : 'bg-zinc-200/60'}`} />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {[1, 2, 3].map((i) => (<div key={i} className={`${card} rounded-2xl h-[52px]`} />))}
        </div>
        <div className={`${card} rounded-2xl h-64`} />
      </div>
    </div>
  );
}
