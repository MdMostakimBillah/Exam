"use client";
import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { useParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { useInstitutionBySlug } from "@/lib/storage/institutions";
import { useRegistrationsByInstitution, useCreateRegistration, useDeleteRegistration, useUpdateRegistration, generateGlobalRegistrationNumber } from "@/lib/storage/registrations";
import { useExams } from "@/lib/storage/exams";
import { useStudentsByInstitution, useCreateStudent, useUpdateStudent, useStudentById, fetchStudentIdsByInstitution } from "@/lib/storage/students";
import { useClasses } from "@/lib/storage/classes";
import { useCurrentSession } from "@/lib/storage/sessions";
import { Registration } from "@/lib/types";
import { formatDate } from "@/lib/storage/storage";
import { useTheme } from "@/contexts/theme-context";
import { useLang } from "@/contexts/language-context";
import { cn } from "@/lib/utils/helpers";
import { ClipboardList, Search, Plus, Eye, FileDown, Upload, User, Users, Camera, AlertCircle, Trash2, Edit, Loader2 } from "lucide-react";
import { TableActionMenu, TableActionItem } from "@/components/ui/table-action-menu";
import { TableCheckbox } from "@/components/ui/table-checkbox";
import { useTableSelection } from "@/hooks/use-table-selection";
import { PdfExportModal, type PdfColumn } from "@/components/ui/pdf-export-modal";
import { LoadingBar } from "@/components/ui/loading-bar";

const MAX_PHOTO_SIZE = 500 * 1024;

type Step = 1 | 2 | 3;

interface StudentForm {
  englishName: string;
  banglaName: string;
  class: string;
  roll: string;
  dateOfBirth: string;
  gender: "MALE" | "FEMALE" | "OTHER";
  fatherName: string;
  motherName: string;
  phone: string;
  address: string;
  photo: string;
}

const emptyStudentForm: StudentForm = {
  englishName: "", banglaName: "", class: "", roll: "",
  dateOfBirth: "", gender: "MALE",
  fatherName: "", motherName: "", phone: "", address: "", photo: "",
};

export default function InstitutionRegistrationsPage() {
  const params = useParams();
  const slug = params.institutionSlug as string;
  const { theme } = useTheme();
  const { lang: language } = useLang();
  const isDark = theme === "dark";
  const isBn = language === "bn";
  const { toast } = useToast();
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [examFilter, setExamFilter] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [viewingReg, setViewingReg] = useState<Registration | null>(null);
  const [deletingReg, setDeletingReg] = useState<Registration | null>(null);
  const [editingReg, setEditingReg] = useState<Registration | null>(null);
  const [editStep, setEditStep] = useState<Step>(1);
  const [editStudentForm, setEditStudentForm] = useState({
    englishName: "", banglaName: "", class: "", roll: "",
    dateOfBirth: "", gender: "MALE" as "MALE" | "FEMALE" | "OTHER",
    fatherName: "", motherName: "", phone: "", address: "", photo: "",
  });
  const [refreshKey, setRefreshKey] = useState(0);

  const [step, setStep] = useState<Step>(1);
  const [studentForm, setStudentForm] = useState<StudentForm>(emptyStudentForm);
  const [selectedExamId, setSelectedExamId] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [generatedRegNumber, setGeneratedRegNumber] = useState("");
  const [generatedStudentId, setGeneratedStudentId] = useState("");

  useEffect(() => { setMounted(true); }, []);

  const { data: inst } = useInstitutionBySlug(slug);
  const { data: currentSession } = useCurrentSession();
  const { data: registrations = [], isFetching } = useRegistrationsByInstitution(inst?.id || '', currentSession?.id);
  const { data: exams = [] } = useExams();
  const { data: students = [] } = useStudentsByInstitution(inst?.id || '', currentSession?.id);
  const { data: allClasses = [] } = useClasses();
  const createRegistrationMutation = useCreateRegistration();
  const deleteRegistrationMutation = useDeleteRegistration();
  const updateRegistrationMutation = useUpdateRegistration();
  const updateStudentMutation = useUpdateStudent();
  const createStudentMutation = useCreateStudent();
  const classNames = allClasses.length > 0 ? allClasses.map(c => c.name) : [];

  const filtered = registrations.filter(r => {
    const matchesSearch = r.studentName.toLowerCase().includes(search.toLowerCase()) || r.registrationNumber.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = !statusFilter || r.status === statusFilter;
    const matchesExam = !examFilter || r.examId === examFilter;
    return matchesSearch && matchesStatus && matchesExam;
  });

  const selection = useTableSelection(filtered);

  const pdfColumns: PdfColumn[] = [
    { header: isBn ? "রেজিস্ট্রেশন নম্বর" : "Registration Number", key: 'registrationNumber' },
    { header: isBn ? "শিক্ষার্থী" : "Student", key: 'studentName' },
    { header: isBn ? "পরীক্ষা" : "Exam", key: 'examName' },
    { header: isBn ? "স্থিতি" : "Status", key: 'status' },
    { header: isBn ? "পেমেন্ট" : "Payment", key: 'paymentStatus' },
    { header: isBn ? "পরিমাণ" : "Amount", key: 'paymentAmount' },
    { header: isBn ? "তারিখ" : "Date", key: 'createdAt' },
  ];

  const pdfData = filtered.map(r => ({
    registrationNumber: r.registrationNumber,
    studentName: r.studentName,
    examName: r.examName,
    status: r.status,
    paymentStatus: r.paymentStatus,
    paymentAmount: `৳${r.paymentAmount.toLocaleString()}`,
    createdAt: formatDate(r.createdAt),
  }));

  const statusCounts = {
    all: registrations.length,
    PENDING: registrations.filter(r => r.status === "PENDING").length,
    APPROVED: registrations.filter(r => r.status === "APPROVED").length,
    REJECTED: registrations.filter(r => r.status === "REJECTED").length,
  };

  /**
   * Generate a global 10-digit registration number using the database function.
   * Format: YYYYNNNNNN (e.g., 2026000001, 2026000002, ...)
   * The sequential number is global across ALL institutions.
   */
  const generateRegistrationNumber = async () => {
    return generateGlobalRegistrationNumber();
  };

  const generateStudentId = async () => {
    const year = new Date().getFullYear();
    const prefix = `STU-${year}-`;
    // Fetch ALL student_ids for this institution+session (no pagination)
    const allIds = await fetchStudentIdsByInstitution(inst?.id || '', currentSession?.id);
    const existingNums = allIds
      .filter(id => id.startsWith(prefix))
      .map(id => parseInt(id.replace(prefix, ''), 10))
      .filter(n => !isNaN(n));
    const maxNum = existingNums.length > 0 ? Math.max(...existingNums) : 0;
    return `${prefix}${String(maxNum + 1).padStart(4, "0")}`;
  };

  const selectedExam = exams.find(e => e.id === selectedExamId);

  if (!mounted) return <RegistrationsSkeleton isDark={isDark} />;
  if (!inst) return null;

  const handleCreate = async () => {
    try {
      const [newStudentId, newRegNumber] = await Promise.all([generateStudentId(), generateRegistrationNumber()]);
      setStep(1);
      setStudentForm({ ...emptyStudentForm });
      setGeneratedStudentId(newStudentId);
      setGeneratedRegNumber(newRegNumber);
      setSelectedExamId("");
      setPhotoError("");
      setShowModal(true);
      setMenuOpenId(null);
    } catch {
      toast("error", isBn
        ? "রেজিস্ট্রেশন নম্বর তৈরি করা যায়নি। আবার চেষ্টা করুন।"
        : "Could not generate registration number. Please try again.");
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoError("");
    if (file.size > MAX_PHOTO_SIZE) {
      const sizeKB = (file.size / 1024).toFixed(1);
      setPhotoError(isBn ? `ছবির আকার ${sizeKB}KB। সর্বোচ্চ 500KB অনুমোদিত।` : `Photo is ${sizeKB}KB. Maximum 500KB allowed.`);
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setStudentForm(prev => ({ ...prev, photo: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const canProceedStep1 = studentForm.englishName.trim() !== "" && studentForm.class.trim() !== "";
  const canProceedStep2 = studentForm.fatherName.trim() !== "" && studentForm.phone.trim() !== "" && studentForm.address.trim() !== "";
  const canSubmitStep3 = selectedExamId !== "" && canProceedStep1 && canProceedStep2;

  const handleNext = () => {
    if (step === 1 && !canProceedStep1) {
      toast("error", isBn ? "প্রয়োজনীয় ঘর পূরণ করুন" : "Please fill required fields");
      return;
    }
    if (step === 2 && !canProceedStep2) {
      toast("error", isBn ? "প্রয়োজনীয় ঘর পূরণ করুন" : "Please fill required fields");
      return;
    }
    setStep(s => (s + 1) as Step);
  };

  const handleBack = () => setStep(s => (s - 1) as Step);

  const handleSave = async () => {
    if (!canSubmitStep3) {
      toast("error", isBn ? "প্রয়োজনীয় ঘর পূরণ করুন" : "Please fill required fields");
      return;
    }
    if (inst && inst.status !== "ACTIVE") {
      toast("error", isBn ? "প্রতিষ্ঠান সক্রিয় হয়নি। শিক্ষার্থী নিবন্ধন করা যাবে না।" : "Institution is not active. Cannot register students.");
      return;
    }
    const exam = exams.find(e => e.id === selectedExamId);
    if (!exam) return;

    setSubmitting(true);
    try {
      const newStudent = await createStudentMutation.mutateAsync({
        sessionId: currentSession?.id || '',
        institutionId: inst!.id,
        firstName: studentForm.englishName.trim(),
        lastName: "",
        firstNameBn: studentForm.banglaName.trim() || undefined,
        lastNameBn: undefined,
        studentId: generatedStudentId,
        class: studentForm.class,
        section: "",
        roll: studentForm.roll.trim(),
        dateOfBirth: studentForm.dateOfBirth,
        gender: studentForm.gender,
        fatherName: studentForm.fatherName.trim(),
        motherName: studentForm.motherName.trim(),
        phone: studentForm.phone.trim(),
        address: studentForm.address.trim(),
        photo: studentForm.photo || undefined,
        status: "ACTIVE",
      });

      await createRegistrationMutation.mutateAsync({
        sessionId: currentSession?.id || '',
        applicationId: generatedRegNumber,
        registrationNumber: generatedRegNumber,
        studentId: newStudent.id,
        studentName: newStudent.firstName,
        institutionId: inst!.id,
        institutionName: inst!.name,
        examId: exam.id,
        examName: exam.name,
        className: newStudent.class,
        status: "PENDING",
        paymentStatus: "PENDING",
        studentPaymentStatus: "NOT_SUBMITTED",
        paymentAmount: exam.registrationFee,
      });

      toast("success", isBn ? "শিক্ষার্থী ও নিবন্ধন তৈরি হয়েছে" : "Student and registration created");
      setShowModal(false);
      setRefreshKey(k => k + 1);
    } catch (err: any) {
      console.error("Registration failed:", err);
      toast("error", isBn ? "নিবন্ধন ব্যর্থ হয়েছে। আবার চেষ্টা করুন।" : "Registration failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingReg) return;
    await deleteRegistrationMutation.mutateAsync(deletingReg.id);
    toast("success", isBn ? "নিবন্ধন মুছে ফেলা হয়েছে" : "Registration deleted");
    setDeletingReg(null);
    setRefreshKey(k => k + 1);
  };

  const handleEdit = (reg: Registration) => {
    setEditingReg(reg);
    setMenuOpenId(null);
    // Find the student from the students list
    const student = students.find(s => s.id === reg.studentId);
    if (student) {
      setEditStudentForm({
        englishName: student.firstName,
        banglaName: student.firstNameBn || "",
        class: student.class,
        roll: student.roll,
        dateOfBirth: student.dateOfBirth || "",
        gender: student.gender || "MALE",
        fatherName: student.fatherName || "",
        motherName: student.motherName || "",
        phone: student.phone || "",
        address: student.address || "",
        photo: student.photo || "",
      });
    } else {
      setEditStudentForm({
        englishName: reg.studentName.split(" ")[0] || "",
        banglaName: "",
        class: reg.className || "",
        roll: "",
        dateOfBirth: "", gender: "MALE",
        fatherName: "", motherName: "", phone: "", address: "",
        photo: "",
      });
    }
    setEditStep(1);
  };

  const handleSaveEdit = async () => {
    if (!editingReg) return;
    setSubmitting(true);
    try {
      const student = students.find(s => s.id === editingReg.studentId);
      if (student) {
        await updateStudentMutation.mutateAsync({
          id: student.id,
          data: {
            firstName: editStudentForm.englishName.trim(),
            firstNameBn: editStudentForm.banglaName.trim() || undefined,
            class: editStudentForm.class,
            roll: editStudentForm.roll.trim(),
            dateOfBirth: editStudentForm.dateOfBirth,
            gender: editStudentForm.gender,
            fatherName: editStudentForm.fatherName.trim(),
            motherName: editStudentForm.motherName.trim(),
            phone: editStudentForm.phone.trim(),
            address: editStudentForm.address.trim(),
            photo: editStudentForm.photo || undefined,
          },
        });
      }
      toast("success", isBn ? "শিক্ষার্থী তথ্য আপডেট হয়েছে" : "Student data updated");
      setEditingReg(null);
      setRefreshKey(k => k + 1);
    } catch (err: any) {
      console.error("Update failed:", err);
      toast("error", isBn ? "আপডেট ব্যর্থ হয়েছে। আবার চেষ্টা করুন।" : "Update failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoError("");
    if (file.size > MAX_PHOTO_SIZE) {
      const sizeKB = (file.size / 1024).toFixed(1);
      setPhotoError(isBn ? `ছবির আকার ${sizeKB}KB। সর্বোচ্চ 500KB অনুমোদিত।` : `Photo is ${sizeKB}KB. Maximum 500KB allowed.`);
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setEditStudentForm(prev => ({ ...prev, photo: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const card = isDark
    ? "bg-[#141416] border border-white/[0.06] rounded-md"
    : "bg-white border border-zinc-200 rounded-md shadow-sm";
  const iconBg = isDark ? "bg-white/[0.08]" : "bg-zinc-100";
  const iconColor = isDark ? "text-zinc-300" : "text-zinc-600";
  const inputCls = isDark ? "bg-white/[0.04] border-white/[0.08] text-white placeholder:text-zinc-600" : "bg-zinc-50 border-zinc-200 text-zinc-900 placeholder:text-zinc-400";
  const labelCls = isDark ? "text-zinc-400" : "text-zinc-600";

  const stepLabels = [
    isBn ? "শিক্ষার্থী তথ্য" : "Student Info",
    isBn ? "অভিভাবক তথ্য" : "Guardian Info",
    isBn ? "ছবি ও পরীক্ষা" : "Photo & Exam",
  ];

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0a0a0b]" : "bg-zinc-50"}`}>
      <LoadingBar isLoading={isFetching} />
      <div className="max-w-[1600px] mx-auto p-6 lg:p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className={`text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-zinc-900"}`}>
              {isBn ? "নিবন্ধন" : "Registrations"}
            </h1>
            <p className={`text-sm mt-1 ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>
              {isBn ? "বৃত্তি পরীক্ষার জন্য শিক্ষার্থী নিবন্ধন পরিচালনা করুন" : "Manage student registrations for scholarship exams"}
            </p>
          </div>
          <button onClick={handleCreate} className={cn("flex items-center gap-2 px-4 py-2.5 rounded-md text-[13px] font-medium transition-all", isDark ? "bg-white text-black hover:bg-white/90" : "bg-zinc-900 text-white hover:bg-zinc-800")}>
            <Plus className="h-4 w-4" /> {isBn ? "নতুন নিবন্ধন" : "New Registration"}
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { icon: ClipboardList, label: isBn ? "মোট" : "Total", value: statusCounts.all },
            { icon: ClipboardList, label: isBn ? "মুলতুবি" : "Pending", value: statusCounts.PENDING },
            { icon: ClipboardList, label: isBn ? "অনুমোদিত" : "Approved", value: statusCounts.APPROVED },
            { icon: ClipboardList, label: isBn ? "প্রত্যাখ্যাত" : "Rejected", value: statusCounts.REJECTED },
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

        <div className={`${card} p-4 mb-8`}>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${isDark ? "text-zinc-600" : "text-zinc-400"}`} />
              <Input placeholder={isBn ? "শিক্ষার্থী বা রেজিস্ট্রেশন নম্বর দিয়ে অনুসন্ধান..." : "Search by student or registration number..."} value={search} onChange={(e) => setSearch(e.target.value)} className={cn("pl-10", inputCls)} />
            </div>
            <Select options={[{ label: isBn ? "সব পরীক্ষা" : "All Exams", value: "" }, ...exams.map(e => ({ label: e.name, value: e.id }))]} value={examFilter} onChange={(e) => setExamFilter(e.target.value)} className={cn("w-full sm:w-48", inputCls)} />
            <Select
              options={[
                { label: isBn ? "সব স্থিতি" : "All Status", value: "" },
                { label: isBn ? "মুলতুবি" : "Pending", value: "PENDING" },
                { label: isBn ? "অনুমোদিত" : "Approved", value: "APPROVED" },
                { label: isBn ? "প্রত্যাখ্যাত" : "Rejected", value: "REJECTED" },
              ]}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={cn("w-full sm:w-40", inputCls)}
            />
          </div>
        </div>

        <div className={`${card}`}>
          <div className={`px-5 py-4 border-b ${isDark ? "border-white/[0.06]" : "border-zinc-100"}`}>
            <div className="flex items-center gap-2">
              <ClipboardList className={`h-4 w-4 ${isDark ? "text-zinc-400" : "text-zinc-500"}`} />
              <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>{isBn ? "নিবন্ধন তালিকা" : "Registrations List"}</h3>
              <span className={`text-[11px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>({filtered.length})</span>
            </div>
          </div>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className={`h-14 w-14 rounded-md flex items-center justify-center mb-4 ${isDark ? "bg-white/[0.08]" : "bg-zinc-100"}`}>
                <ClipboardList className={`h-7 w-7 ${iconColor}`} />
              </div>
              <p className={`text-sm font-medium ${isDark ? "text-white" : "text-zinc-900"}`}>{isBn ? "কোনো নিবন্ধন পাওয়া যায়নি" : "No registrations found"}</p>
              <p className={`text-xs mt-1 ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>{isBn ? "নতুন নিবন্ধন যোগ করুন" : "Add a new registration to get started"}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className={isDark ? "border-white/[0.04] hover:bg-transparent" : "border-zinc-100 hover:bg-transparent"}>
                  <TableHead className="w-10">
                    <TableCheckbox checked={selection.allSelected} indeterminate={selection.someSelected} onChange={selection.toggleAll} />
                  </TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>{isBn ? "রেজিস্ট্রেশন নম্বর" : "Registration Number"}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>{isBn ? "শিক্ষার্থী" : "Student"}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>{isBn ? "পরীক্ষা" : "Exam"}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>{isBn ? "স্থিতি" : "Status"}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>{isBn ? "পেমেন্ট" : "Payment"}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>{isBn ? "পরিমাণ" : "Amount"}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>{isBn ? "তারিখ" : "Date"}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? "text-zinc-400" : "text-zinc-500"}`}></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(reg => (
                  <TableRow key={reg.id} className={`${isDark ? "border-white/[0.04] hover:bg-white/[0.02]" : "border-zinc-100 hover:bg-zinc-50/50"} ${selection.isSelected(reg.id) ? (isDark ? 'bg-[#9333ea]/10' : 'bg-purple-50') : ''}`}>
                    <TableCell className="w-10">
                      <TableCheckbox checked={selection.isSelected(reg.id)} onChange={() => selection.toggle(reg.id)} />
                    </TableCell>
                    <TableCell className={`text-[11px] font-mono ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>{reg.registrationNumber}</TableCell>
                    <TableCell className={`text-sm font-medium ${isDark ? "text-zinc-100" : "text-zinc-800"}`}>{reg.studentName}</TableCell>
                    <TableCell className={`text-[11px] ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>{reg.examName}</TableCell>
                    <TableCell><Badge status={reg.status} /></TableCell>
                    <TableCell><Badge status={reg.paymentStatus} /></TableCell>
                    <TableCell className={`text-[11px] ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>&#2547;{reg.paymentAmount.toLocaleString()}</TableCell>
                    <TableCell className={`text-[11px] ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>{formatDate(reg.createdAt)}</TableCell>
                    <TableCell>
                      <TableActionMenu id={reg.id} openId={menuOpenId} onToggle={setMenuOpenId} isDark={isDark}>
                        <TableActionItem onClick={() => { setViewingReg(reg); setMenuOpenId(null); }} isDark={isDark}>
                          <Eye className="h-3.5 w-3.5" /> {isBn ? "বিস্তারিত" : "View Details"}
                        </TableActionItem>
                        <TableActionItem onClick={() => handleEdit(reg)} isDark={isDark}>
                          <Edit className="h-3.5 w-3.5" /> {isBn ? 'সম্পাদনা' : 'Edit'}
                        </TableActionItem>
                        <TableActionItem onClick={() => { setDeletingReg(reg); setMenuOpenId(null); }} isDark={isDark} variant="danger">
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
      </div>

      {/* Multi-Step Registration Modal */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={isBn ? "নতুন নিবন্ধন" : "New Registration"}
        maxWidth="max-w-xl"
      >
        {/* Step Indicator */}
        <div className="flex items-center gap-2 mb-4 px-2">
          {stepLabels.map((label, i) => {
            const num = (i + 1) as Step;
            const isActive = step === num;
            const isDone = step > num;
            return (
              <div key={i} className="flex items-center gap-2 flex-1">
                <div className={cn(
                  "h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 transition-colors",
                  isDone ? "bg-green-500 text-white" : isActive ? (isDark ? "bg-white text-black" : "bg-zinc-900 text-white") : (isDark ? "bg-white/[0.08] text-zinc-500" : "bg-zinc-100 text-zinc-400")
                )}>
                  {isDone ? "✓" : num}
                </div>
                <span className={cn("text-[11px] font-medium hidden sm:block", isActive ? (isDark ? "text-white" : "text-zinc-900") : (isDark ? "text-zinc-500" : "text-zinc-400"))}>
                  {label}
                </span>
                {i < 2 && <div className={cn("flex-1 h-px mx-2", isDone ? "bg-green-500" : isDark ? "bg-white/[0.08]" : "bg-zinc-200")} />}
              </div>
            );
          })}
        </div>

        {/* Step 1: Student Basic Info */}
        {step === 1 && (
          <div className="px-2 py-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={`block text-[11px] mb-1.5 font-medium ${labelCls}`}>{isBn ? 'ইংরেজি নাম *' : 'English Name *'}</label>
                <Input placeholder={isBn ? 'ইংরেজি নাম' : 'English name'} value={studentForm.englishName} onChange={(e) => setStudentForm({ ...studentForm, englishName: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className={`block text-[11px] mb-1.5 font-medium ${labelCls}`}>{isBn ? 'বাংলা নাম' : 'Bangla Name'}</label>
                <Input placeholder={isBn ? 'বাংলা নাম' : 'Bangla name'} value={studentForm.banglaName} onChange={(e) => setStudentForm({ ...studentForm, banglaName: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className={`block text-[11px] mb-1.5 font-medium ${labelCls}`}>{isBn ? 'শ্রেণী *' : 'Class *'}</label>
                <Select
                  options={[{ label: isBn ? 'শ্রেণী নির্বাচন' : 'Select class', value: '' }, ...classNames.map(c => ({ label: c, value: c }))]}
                  value={studentForm.class}
                  onChange={(e) => setStudentForm({ ...studentForm, class: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={`block text-[11px] mb-1.5 font-medium ${labelCls}`}>{isBn ? 'রোল' : 'Roll'}</label>
                <Input placeholder={isBn ? 'রোল নম্বর' : 'Roll number'} value={studentForm.roll} onChange={(e) => setStudentForm({ ...studentForm, roll: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className={`block text-[11px] mb-1.5 font-medium ${labelCls}`}>{isBn ? 'জন্ম তারিখ' : 'Date of Birth'}</label>
                <Input type="date" value={studentForm.dateOfBirth} onChange={(e) => setStudentForm({ ...studentForm, dateOfBirth: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className={`block text-[11px] mb-1.5 font-medium ${labelCls}`}>{isBn ? 'লিঙ্গ' : 'Gender'}</label>
                <Select
                  options={[
                    { label: isBn ? 'পুরুষ' : 'Male', value: 'MALE' },
                    { label: isBn ? 'মহিলা' : 'Female', value: 'FEMALE' },
                    { label: isBn ? 'অন্যান্য' : 'Other', value: 'OTHER' },
                  ]}
                  value={studentForm.gender}
                  onChange={(e) => setStudentForm({ ...studentForm, gender: e.target.value as "MALE" | "FEMALE" | "OTHER" })}
                  className={inputCls}
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Guardian Info */}
        {step === 2 && (
          <div className="px-2 py-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={`block text-[11px] mb-1.5 font-medium ${labelCls}`}>{isBn ? 'পিতার নাম *' : "Father's Name *"}</label>
                <Input placeholder={isBn ? 'পিতার নাম' : "Father's name"} value={studentForm.fatherName} onChange={(e) => setStudentForm({ ...studentForm, fatherName: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className={`block text-[11px] mb-1.5 font-medium ${labelCls}`}>{isBn ? 'মাতার নাম' : "Mother's Name"}</label>
                <Input placeholder={isBn ? 'মাতার নাম' : "Mother's name"} value={studentForm.motherName} onChange={(e) => setStudentForm({ ...studentForm, motherName: e.target.value })} className={inputCls} />
              </div>
            </div>
            <div>
              <label className={`block text-[11px] mb-1.5 font-medium ${labelCls}`}>{isBn ? 'ফোন নম্বর *' : 'Phone Number *'}</label>
              <Input placeholder={isBn ? 'ফোন নম্বর' : 'Phone number'} value={studentForm.phone} onChange={(e) => setStudentForm({ ...studentForm, phone: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={`block text-[11px] mb-1.5 font-medium ${labelCls}`}>{isBn ? 'ঠিকানা *' : 'Address *'}</label>
              <Input placeholder={isBn ? 'পূর্ণ ঠিকানা' : 'Full address'} value={studentForm.address} onChange={(e) => setStudentForm({ ...studentForm, address: e.target.value })} className={inputCls} />
            </div>
          </div>
        )}

        {/* Step 3: Photo & Exam */}
        {step === 3 && (
          <div className="px-2 py-3 space-y-4">
            {/* Profile Picture */}
            <div>
              <label className={`block text-[11px] mb-1.5 font-medium ${labelCls}`}>{isBn ? 'প্রোফাইল ছবি' : 'Profile Picture'} <span className="text-red-400">(max 500KB)</span></label>
              <div className="flex items-start gap-4">
                <div className={cn("h-20 w-20 rounded-md flex items-center justify-center shrink-0 overflow-hidden", studentForm.photo ? "" : (isDark ? "bg-white/[0.06] border border-white/[0.08]" : "bg-zinc-100 border border-zinc-200"))}>
                  {studentForm.photo ? (
                    <Image src={studentForm.photo} alt="Preview" width={80} height={80} unoptimized className="h-full w-full object-cover" />
                  ) : (
                    <Camera className={cn("h-6 w-6", isDark ? "text-zinc-600" : "text-zinc-400")} />
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <label className={cn("inline-flex items-center gap-2 px-3 py-2 rounded-md text-[12px] font-medium cursor-pointer transition-colors", isDark ? "bg-white/[0.06] text-zinc-300 hover:bg-white/[0.1]" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200")}>
                    <Upload className="h-3.5 w-3.5" />
                    {isBn ? 'ছবি আপলোড করুন' : 'Upload Photo'}
                    <input type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
                  </label>
                  {studentForm.photo && (
                    <button onClick={() => setStudentForm(prev => ({ ...prev, photo: "" }))} className="text-[11px] text-red-400 hover:text-red-300 ml-2">
                      {isBn ? 'সরান' : 'Remove'}
                    </button>
                  )}
                  {photoError && (
                    <p className="text-[11px] text-red-400 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" /> {photoError}
                    </p>
                  )}
                  <p className={`text-[10px] ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>
                    {isBn ? 'JPG, PNG। সর্বোচ্চ 500KB আকার অনুমোদিত।' : 'JPG, PNG. Maximum 500KB file size allowed.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Exam Selection */}
            <div>
              <label className={`block text-[11px] mb-1.5 font-medium ${labelCls}`}>{isBn ? "পরীক্ষা *" : "Exam *"}</label>
              <Select
                options={[{ label: isBn ? "পরীক্ষা নির্বাচন করুন" : "Select exam", value: "" }, ...exams.map(e => ({ label: `${e.name} (${e.academicYear})`, value: e.id }))]}
                value={selectedExamId}
                onChange={(e) => setSelectedExamId(e.target.value)}
                className={inputCls}
              />
            </div>

            {selectedExam && (
              <div className={`${isDark ? "bg-white/[0.04]" : "bg-zinc-50"} rounded-md p-3 border ${isDark ? "border-white/[0.06]" : "border-zinc-200"}`}>
                <p className={`text-[11px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>{isBn ? "নিবন্ধন ফি" : "Registration Fee"}</p>
                <p className={`text-sm font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>&#2547;{selectedExam.registrationFee.toLocaleString()}</p>
              </div>
            )}

            <div>
              <label className={`block text-[11px] mb-1.5 font-medium ${labelCls}`}>{isBn ? "রেজিস্ট্রেশন নম্বর" : "Registration Number"}</label>
              <Input value={generatedRegNumber} disabled className={cn("opacity-60", inputCls)} />
            </div>
          </div>
        )}

        {/* Footer */}
        <div className={`px-2 py-3 border-t flex items-center justify-between ${isDark ? "border-white/[0.06]" : "border-zinc-200"}`}>
          <div>
            {step > 1 && (
              <button onClick={handleBack} className={`px-4 py-2 rounded-md text-[13px] font-medium transition-all ${isDark ? "bg-white/[0.06] text-zinc-300 hover:bg-white/[0.1]" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"}`}>
                {isBn ? 'পূর্ববর্তী' : 'Back'}
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowModal(false)} className={`px-4 py-2 rounded-md text-[13px] font-medium transition-all ${isDark ? "bg-white/[0.06] text-zinc-300 hover:bg-white/[0.1]" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"}`}>
              {isBn ? 'বাতিল' : 'Cancel'}
            </button>
            {step < 3 ? (
              <button onClick={handleNext} className={`px-4 py-2 rounded-md text-[13px] font-medium transition-all ${isDark ? "bg-white text-black hover:bg-white/90" : "bg-zinc-900 text-white hover:bg-zinc-800"}`}>
                {isBn ? 'পরবর্তী' : 'Next'}
              </button>
            ) : (
              <button onClick={handleSave} disabled={!canSubmitStep3 || submitting} className={cn("px-4 py-2 rounded-md text-[13px] font-medium transition-all flex items-center gap-2", canSubmitStep3 && !submitting ? (isDark ? "bg-white text-black hover:bg-white/90" : "bg-zinc-900 text-white hover:bg-zinc-800") : "opacity-50 cursor-not-allowed")}>
                {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {isBn ? 'নিবন্ধন করুন' : 'Register'}
              </button>
            )}
          </div>
        </div>
      </Modal>

      {/* View Details Modal - Profile Style */}
      <Modal open={!!viewingReg} onClose={() => setViewingReg(null)} title="" maxWidth="max-w-xl">
        {viewingReg && (() => {
          const student = students.find(s => s.id === viewingReg.studentId);
          const studentPhoto = student?.photo;
          const initials = viewingReg.studentName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
          const genderLabel = student?.gender === 'MALE' ? (isBn ? 'পুরুষ' : 'Male') : student?.gender === 'FEMALE' ? (isBn ? 'মহিলা' : 'Female') : (isBn ? 'অন্যান্য' : 'Other');
          return (
            <div className="-mt-2 -mb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {/* Profile Header */}
              <div className="flex flex-col items-center mb-5">
                <div className={cn(
                  "h-20 w-20 rounded-full flex items-center justify-center overflow-hidden mb-3 ring-2 ring-offset-2",
                  isDark ? "ring-white/10 ring-offset-[#141416]" : "ring-zinc-200 ring-offset-white"
                )}>
                  {studentPhoto ? (
                    <Image src={studentPhoto} alt={viewingReg.studentName} width={80} height={80} unoptimized className="h-full w-full object-cover" />
                  ) : (
                    <div className={cn(
                      "h-full w-full flex items-center justify-center text-lg font-bold",
                      isDark ? "bg-white/[0.08] text-white" : "bg-zinc-100 text-zinc-700"
                    )}>
                      {initials}
                    </div>
                  )}
                </div>
                <h3 className={`text-base font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>{viewingReg.studentName}</h3>
                {student?.firstNameBn && <p className={`text-[12px] mt-0.5 ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>{student.firstNameBn}</p>}
                <p className={`text-[11px] mt-0.5 ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>{viewingReg.className} &middot; {viewingReg.institutionName}</p>
              </div>

              {/* Status Badges */}
              <div className="flex items-center justify-center gap-2 mb-5">
                <Badge status={viewingReg.status} />
                <Badge status={viewingReg.paymentStatus} />
              </div>

              {/* Student Info Section */}
              <div className={`rounded-lg p-4 mb-3 ${isDark ? "bg-white/[0.03]" : "bg-zinc-50"}`}>
                <h4 className={`text-[11px] font-semibold uppercase tracking-wider mb-3 ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>{isBn ? "শিক্ষার্থী তথ্য" : "Student Information"}</h4>
                <div className="space-y-2.5">
                  {([
                    { label: isBn ? "রেজিস্ট্রেশন নম্বর" : "Registration Number", value: viewingReg.registrationNumber },
                    { label: isBn ? "শিক্ষার্থী আইডি" : "Student ID", value: student?.studentId || viewingReg.studentId },
                    { label: isBn ? "শ্রেণী" : "Class", value: viewingReg.className },
                    student?.section ? { label: isBn ? "শাখা" : "Section", value: student.section } : null,
                    student?.roll ? { label: isBn ? "রোল" : "Roll", value: student.roll } : null,
                    student?.dateOfBirth ? { label: isBn ? "জন্ম তারিখ" : "Date of Birth", value: student.dateOfBirth } : null,
                    student?.gender ? { label: isBn ? "লিঙ্গ" : "Gender", value: genderLabel } : null,
                  ] as { label: string; value: string }[]).filter(Boolean).map((item) => (
                    <div key={item.label} className="flex items-center justify-between">
                      <span className={`text-[11px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>{item.label}</span>
                      <span className={`text-[12px] font-medium ${isDark ? "text-zinc-200" : "text-zinc-700"}`}>{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Guardian Info Section */}
              {student && (
                <div className={`rounded-lg p-4 mb-3 ${isDark ? "bg-white/[0.03]" : "bg-zinc-50"}`}>
                  <h4 className={`text-[11px] font-semibold uppercase tracking-wider mb-3 ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>{isBn ? "অভিভাবক তথ্য" : "Guardian Information"}</h4>
                  <div className="space-y-2.5">
                    {([
                      { label: isBn ? "পিতার নাম" : "Father's Name", value: student.fatherName },
                      student.motherName ? { label: isBn ? "মাতার নাম" : "Mother's Name", value: student.motherName } : null,
                      { label: isBn ? "ফোন" : "Phone", value: student.phone },
                      { label: isBn ? "ঠিকানা" : "Address", value: student.address },
                    ] as { label: string; value: string }[]).filter(Boolean).map((item) => (
                      <div key={item.label} className="flex items-center justify-between">
                        <span className={`text-[11px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>{item.label}</span>
                        <span className={`text-[12px] font-medium text-right max-w-[60%] ${isDark ? "text-zinc-200" : "text-zinc-700"}`}>{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Exam & Payment Section */}
              <div className={`rounded-lg p-4 ${isDark ? "bg-white/[0.03]" : "bg-zinc-50"}`}>
                <h4 className={`text-[11px] font-semibold uppercase tracking-wider mb-3 ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>{isBn ? "পরীক্ষা ও পেমেন্ট" : "Exam & Payment"}</h4>
                <div className="space-y-2.5">
                  {[
                    { label: isBn ? "পরীক্ষা" : "Exam", value: viewingReg.examName },
                    { label: isBn ? "পরিমাণ" : "Amount", value: `৳${viewingReg.paymentAmount.toLocaleString()}` },
                    { label: isBn ? "তৈরি" : "Created", value: formatDate(viewingReg.createdAt) },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between">
                      <span className={`text-[11px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>{item.label}</span>
                      <span className={`text-[12px] font-medium ${isDark ? "text-zinc-200" : "text-zinc-700"}`}>{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Close Button */}
              <div className="flex justify-end mt-5">
                <button onClick={() => setViewingReg(null)} className={`px-5 py-2 rounded-md text-[13px] font-medium transition-all ${isDark ? "bg-white/[0.06] text-zinc-300 hover:bg-white/[0.1]" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"}`}>{isBn ? "বন্ধ" : "Close"}</button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* Delete Confirmation Modal */}
      {deletingReg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm animate-fadeIn" onClick={() => setDeletingReg(null)} />
          <div className={`relative z-50 w-full max-w-md rounded-md p-6 shadow-2xl animate-scaleIn backdrop-blur-xl ${isDark ? 'border border-white/[0.06] bg-[#0D0D0D]' : 'border border-zinc-200 bg-white'}`}>
            <h3 className={`text-sm font-semibold mb-2 ${isDark ? "text-white" : "text-zinc-900"}`}>{isBn ? 'নিবন্ধন মুছুন?' : 'Delete Registration?'}</h3>
            <p className={`text-sm ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
              {isBn ? `"${deletingReg.studentName}" -এর "${deletingReg.examName}" নিবন্ধন মুছে ফেলা হবে। এই কাজটি পূর্বাবস্থায় ফেরানো যাবে না।` : `Registration for "${deletingReg.studentName}" in "${deletingReg.examName}" will be deleted. This action cannot be undone.`}
            </p>
            <div className="flex items-center justify-end gap-2 mt-6">
              <button onClick={() => setDeletingReg(null)} className={`px-4 py-2 rounded-md text-[13px] font-medium transition-all ${isDark ? "bg-white/[0.06] text-zinc-300 hover:bg-white/[0.1]" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"}`}>
                {isBn ? 'বাতিল' : 'Cancel'}
              </button>
              <button onClick={handleDelete} className="px-4 py-2 rounded-md text-[13px] font-medium transition-all bg-red-600 text-white hover:bg-red-700">
                {isBn ? 'মুছুন' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Student Data Modal - Multi-Step */}
      <Modal open={!!editingReg} onClose={() => setEditingReg(null)} title={isBn ? "শিক্ষার্থী তথ্য সম্পাদনা" : "Edit Student Data"} maxWidth="max-w-xl">
        {editingReg && (
          <>
            <p className={`text-[11px] -mt-2 mb-3 ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>{editingReg.studentName} — {editingReg.examName}</p>

            {/* Step Indicator */}
            <div className="flex items-center gap-2 mb-4">
              {stepLabels.map((label, i) => {
                const num = (i + 1) as Step;
                const isActive = editStep === num;
                const isDone = editStep > num;
                return (
                  <div key={i} className="flex items-center gap-2 flex-1">
                    <div className={cn(
                      "h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 transition-colors",
                      isDone ? "bg-green-500 text-white" : isActive ? (isDark ? "bg-white text-black" : "bg-zinc-900 text-white") : (isDark ? "bg-white/[0.08] text-zinc-500" : "bg-zinc-100 text-zinc-400")
                    )}>
                      {isDone ? "✓" : num}
                    </div>
                    <span className={cn("text-[11px] font-medium hidden sm:block", isActive ? (isDark ? "text-white" : "text-zinc-900") : (isDark ? "text-zinc-500" : "text-zinc-400"))}>
                      {label}
                    </span>
                    {i < 2 && <div className={cn("flex-1 h-px mx-2", isDone ? "bg-green-500" : isDark ? "bg-white/[0.08]" : "bg-zinc-200")} />}
                  </div>
                );
              })}
            </div>

            {/* Step 1: Student Basic Info */}
            {editStep === 1 && (
              <div className="py-2">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-[11px] mb-1.5 font-medium ${labelCls}`}>{isBn ? 'ইংরেজি নাম *' : 'English Name *'}</label>
                    <Input placeholder={isBn ? 'ইংরেজি নাম' : 'English name'} value={editStudentForm.englishName} onChange={(e) => setEditStudentForm({ ...editStudentForm, englishName: e.target.value })} className={inputCls} />
                  </div>
                  <div>
                    <label className={`block text-[11px] mb-1.5 font-medium ${labelCls}`}>{isBn ? 'বাংলা নাম' : 'Bangla Name'}</label>
                    <Input placeholder={isBn ? 'বাংলা নাম' : 'Bangla name'} value={editStudentForm.banglaName} onChange={(e) => setEditStudentForm({ ...editStudentForm, banglaName: e.target.value })} className={inputCls} />
                  </div>
                  <div>
                    <label className={`block text-[11px] mb-1.5 font-medium ${labelCls}`}>{isBn ? 'শ্রেণী *' : 'Class *'}</label>
                    <Select
                      options={[{ label: isBn ? 'শ্রেণী নির্বাচন' : 'Select class', value: '' }, ...classNames.map(c => ({ label: c, value: c }))]}
                      value={editStudentForm.class}
                      onChange={(e) => setEditStudentForm({ ...editStudentForm, class: e.target.value })}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={`block text-[11px] mb-1.5 font-medium ${labelCls}`}>{isBn ? 'রোল' : 'Roll'}</label>
                    <Input placeholder={isBn ? 'রোল নম্বর' : 'Roll number'} value={editStudentForm.roll} onChange={(e) => setEditStudentForm({ ...editStudentForm, roll: e.target.value })} className={inputCls} />
                  </div>
                  <div>
                    <label className={`block text-[11px] mb-1.5 font-medium ${labelCls}`}>{isBn ? 'জন্ম তারিখ' : 'Date of Birth'}</label>
                    <Input type="date" value={editStudentForm.dateOfBirth} onChange={(e) => setEditStudentForm({ ...editStudentForm, dateOfBirth: e.target.value })} className={inputCls} />
                  </div>
                  <div>
                    <label className={`block text-[11px] mb-1.5 font-medium ${labelCls}`}>{isBn ? 'লিঙ্গ' : 'Gender'}</label>
                    <Select
                      options={[
                        { label: isBn ? 'পুরুষ' : 'Male', value: 'MALE' },
                        { label: isBn ? 'মহিলা' : 'Female', value: 'FEMALE' },
                        { label: isBn ? 'অন্যান্য' : 'Other', value: 'OTHER' },
                      ]}
                      value={editStudentForm.gender}
                      onChange={(e) => setEditStudentForm({ ...editStudentForm, gender: e.target.value as "MALE" | "FEMALE" | "OTHER" })}
                      className={inputCls}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Guardian Info */}
            {editStep === 2 && (
              <div className="py-2">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-[11px] mb-1.5 font-medium ${labelCls}`}>{isBn ? 'পিতার নাম *' : "Father's Name *"}</label>
                    <Input placeholder={isBn ? 'পিতার নাম' : "Father's name"} value={editStudentForm.fatherName} onChange={(e) => setEditStudentForm({ ...editStudentForm, fatherName: e.target.value })} className={inputCls} />
                  </div>
                  <div>
                    <label className={`block text-[11px] mb-1.5 font-medium ${labelCls}`}>{isBn ? 'মাতার নাম' : "Mother's Name"}</label>
                    <Input placeholder={isBn ? 'মাতার নাম' : "Mother's name"} value={editStudentForm.motherName} onChange={(e) => setEditStudentForm({ ...editStudentForm, motherName: e.target.value })} className={inputCls} />
                  </div>
                </div>
                <div className="mt-4">
                  <label className={`block text-[11px] mb-1.5 font-medium ${labelCls}`}>{isBn ? 'ফোন নম্বর *' : 'Phone Number *'}</label>
                  <Input placeholder={isBn ? 'ফোন নম্বর' : 'Phone number'} value={editStudentForm.phone} onChange={(e) => setEditStudentForm({ ...editStudentForm, phone: e.target.value })} className={inputCls} />
                </div>
                <div className="mt-4">
                  <label className={`block text-[11px] mb-1.5 font-medium ${labelCls}`}>{isBn ? 'ঠিকানা *' : 'Address *'}</label>
                  <Input placeholder={isBn ? 'পূর্ণ ঠিকানা' : 'Full address'} value={editStudentForm.address} onChange={(e) => setEditStudentForm({ ...editStudentForm, address: e.target.value })} className={inputCls} />
                </div>
              </div>
            )}

            {/* Step 3: Photo */}
            {editStep === 3 && (
              <div className="py-2 space-y-4">
                <div>
                  <label className={`block text-[11px] mb-1.5 font-medium ${labelCls}`}>{isBn ? 'প্রোফাইল ছবি' : 'Profile Picture'} <span className="text-red-400">(max 500KB)</span></label>
                  <div className="flex items-start gap-4">
                    <div className={cn("h-20 w-20 rounded-md flex items-center justify-center shrink-0 overflow-hidden", editStudentForm.photo ? "" : (isDark ? "bg-white/[0.06] border border-white/[0.08]" : "bg-zinc-100 border border-zinc-200"))}>
                      {editStudentForm.photo ? (
                        <Image src={editStudentForm.photo} alt="Preview" width={80} height={80} unoptimized className="h-full w-full object-cover" />
                      ) : (
                        <Camera className={cn("h-6 w-6", isDark ? "text-zinc-600" : "text-zinc-400")} />
                      )}
                    </div>
                    <div className="flex-1 space-y-2">
                      <label className={cn("inline-flex items-center gap-2 px-3 py-2 rounded-md text-[12px] font-medium cursor-pointer transition-colors", isDark ? "bg-white/[0.06] text-zinc-300 hover:bg-white/[0.1]" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200")}>
                        <Upload className="h-3.5 w-3.5" />
                        {isBn ? 'ছবি আপলোড করুন' : 'Upload Photo'}
                        <input type="file" accept="image/*" onChange={handleEditPhotoChange} className="hidden" />
                      </label>
                      {editStudentForm.photo && (
                        <button onClick={() => setEditStudentForm(prev => ({ ...prev, photo: "" }))} className="text-[11px] text-red-400 hover:text-red-300 ml-2">
                          {isBn ? 'সরান' : 'Remove'}
                        </button>
                      )}
                      {photoError && (
                        <p className="text-[11px] text-red-400 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" /> {photoError}
                        </p>
                      )}
                      <p className={`text-[10px] ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>
                        {isBn ? 'JPG, PNG। সর্বোচ্চ 500KB আকার অনুমোদিত।' : 'JPG, PNG. Maximum 500KB file size allowed.'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className={`px-0 py-3 border-t flex items-center justify-between mt-2 ${isDark ? "border-white/[0.06]" : "border-zinc-200"}`}>
              <div>
                {editStep > 1 && (
                  <button onClick={() => setEditStep(s => (s - 1) as Step)} className={`px-4 py-2 rounded-md text-[13px] font-medium transition-all ${isDark ? "bg-white/[0.06] text-zinc-300 hover:bg-white/[0.1]" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"}`}>
                    {isBn ? 'পূর্ববর্তী' : 'Back'}
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setEditingReg(null)} className={`px-4 py-2 rounded-md text-[13px] font-medium transition-all ${isDark ? "bg-white/[0.06] text-zinc-300 hover:bg-white/[0.1]" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"}`}>
                  {isBn ? 'বাতিল' : 'Cancel'}
                </button>
                {editStep < 3 ? (
                  <button onClick={() => setEditStep(s => (s + 1) as Step)} className={`px-4 py-2 rounded-md text-[13px] font-medium transition-all ${isDark ? "bg-white text-black hover:bg-white/90" : "bg-zinc-900 text-white hover:bg-zinc-800"}`}>
                    {isBn ? 'পরবর্তী' : 'Next'}
                  </button>
                ) : (
                  <button onClick={handleSaveEdit} disabled={submitting} className={cn("px-4 py-2 rounded-md text-[13px] font-medium transition-all flex items-center gap-2", !submitting ? (isDark ? "bg-white text-black hover:bg-white/90" : "bg-zinc-900 text-white hover:bg-zinc-800") : "opacity-50 cursor-not-allowed")}>
                    {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    {isBn ? 'সংরক্ষণ' : 'Save'}
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </Modal>

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

      <PdfExportModal
        open={showPdfModal}
        onClose={() => setShowPdfModal(false)}
        title={isBn ? 'নিবন্ধন তালিকা' : 'Registration List'}
        columns={pdfColumns}
        data={pdfData}
      />
    </div>
  );
}

function RegistrationsSkeleton({ isDark }: { isDark: boolean }) {
  const card = isDark ? "bg-[#141416] border border-white/[0.06]" : "bg-zinc-200 border border-zinc-300 shadow-sm";
  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0a0a0b]" : "bg-zinc-50"}`}>
      <div className="max-w-[1600px] mx-auto p-6 lg:p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className={`h-8 w-48 rounded-md ${isDark ? "bg-white/[0.06]" : "bg-zinc-300"}`} />
            <div className={`h-4 w-64 rounded mt-2 ${isDark ? "bg-white/[0.04]" : "bg-zinc-300/80"}`} />
          </div>
          <div className={`h-10 w-36 rounded-md ${isDark ? "bg-white/[0.06]" : "bg-zinc-300"}`} />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[1, 2, 3, 4].map((i) => (<div key={i} className={`${card} rounded-md h-[52px]`} />))}
        </div>
        <div className={`${card} rounded-md h-12 mb-8`} />
        <div className={`${card} rounded-md h-64`} />
      </div>
    </div>
  );
}
