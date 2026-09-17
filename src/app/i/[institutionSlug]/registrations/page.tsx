"use client";
import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { useParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { getInstitutionBySlug } from "@/lib/storage/institutions";
import { getRegistrationsByInstitution, createRegistration, updateRegistration } from "@/lib/storage/registrations";
import { getExams } from "@/lib/storage/exams";
import { getStudentsByInstitution, createStudent } from "@/lib/storage/students";
import { getClasses } from "@/lib/storage/classes";
import { getCurrentSession } from "@/lib/storage/sessions";
import { Registration } from "@/lib/types";
import { formatDate } from "@/lib/storage/storage";
import { useTheme } from "@/contexts/theme-context";
import { useLang } from "@/contexts/language-context";
import { cn } from "@/lib/utils/helpers";
import { ClipboardList, Search, Plus, Eye, CheckCircle, XCircle, Banknote, FileDown, Upload, User, Users, Camera, AlertCircle } from "lucide-react";
import { TableActionMenu, TableActionItem } from "@/components/ui/table-action-menu";
import { TableCheckbox } from "@/components/ui/table-checkbox";
import { useTableSelection } from "@/hooks/use-table-selection";
import { PdfExportModal, type PdfColumn } from "@/components/ui/pdf-export-modal";

const MIN_PHOTO_SIZE = 500 * 1024;

type Step = 1 | 2 | 3;

interface StudentForm {
  firstName: string;
  lastName: string;
  studentId: string;
  class: string;
  section: string;
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
  firstName: "", lastName: "", studentId: "", class: "", section: "", roll: "",
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
  const [confirmAction, setConfirmAction] = useState<{ type: "approve" | "reject"; reg: Registration } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [step, setStep] = useState<Step>(1);
  const [studentForm, setStudentForm] = useState<StudentForm>(emptyStudentForm);
  const [selectedExamId, setSelectedExamId] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [showPdfModal, setShowPdfModal] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const inst = getInstitutionBySlug(slug);
  const currentSession = getCurrentSession();
  const registrations = inst ? getRegistrationsByInstitution(inst.id) : [];
  const exams = getExams();
  const students = inst ? getStudentsByInstitution(inst.id) : [];
  const allClasses = getClasses();
  const classNames = allClasses.length > 0 ? allClasses.map(c => c.name) : [];

  const filtered = registrations.filter(r => {
    const matchesSearch = r.studentName.toLowerCase().includes(search.toLowerCase()) || r.applicationId.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = !statusFilter || r.status === statusFilter;
    const matchesExam = !examFilter || r.examId === examFilter;
    return matchesSearch && matchesStatus && matchesExam;
  });

  const selection = useTableSelection(filtered);

  const pdfColumns: PdfColumn[] = [
    { header: isBn ? "আবেদন আইডি" : "Application ID", key: 'applicationId' },
    { header: isBn ? "শিক্ষার্থী" : "Student", key: 'studentName' },
    { header: isBn ? "পরীক্ষা" : "Exam", key: 'examName' },
    { header: isBn ? "স্থিতি" : "Status", key: 'status' },
    { header: isBn ? "পেমেন্ট" : "Payment", key: 'paymentStatus' },
    { header: isBn ? "পরিমাণ" : "Amount", key: 'paymentAmount' },
    { header: isBn ? "তারিখ" : "Date", key: 'createdAt' },
  ];

  const pdfData = filtered.map(r => ({
    applicationId: r.applicationId,
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

  const generateAppId = () => {
    const year = new Date().getFullYear();
    const count = registrations.length + 1;
    return `APP-${year}-${String(count).padStart(4, "0")}`;
  };

  const generateStudentId = () => {
    const year = new Date().getFullYear();
    const count = students.length + 1;
    return `STU-${year}-${String(count).padStart(4, "0")}`;
  };

  const selectedExam = exams.find(e => e.id === selectedExamId);

  if (!mounted) return <RegistrationsSkeleton isDark={isDark} />;
  if (!inst) return null;

  const handleCreate = () => {
    setStep(1);
    setStudentForm({ ...emptyStudentForm, studentId: generateStudentId() });
    setSelectedExamId("");
    setPhotoError("");
    setShowModal(true);
    setMenuOpenId(null);
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoError("");
    if (file.size < MIN_PHOTO_SIZE) {
      const sizeKB = (file.size / 1024).toFixed(1);
      setPhotoError(isBn ? `ছবির আকার ${sizeKB}KB। ন্যূনতম 500KB প্রয়োজন।` : `Photo is ${sizeKB}KB. Minimum 500KB required.`);
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setStudentForm(prev => ({ ...prev, photo: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const canProceedStep1 = studentForm.firstName.trim() !== "" && studentForm.lastName.trim() !== "" && studentForm.studentId.trim() !== "" && studentForm.class.trim() !== "";
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
    const exam = exams.find(e => e.id === selectedExamId);
    if (!exam) return;

    const newStudent = await createStudent({
      sessionId: currentSession?.id || '',
      institutionId: inst.id,
      firstName: studentForm.firstName.trim(),
      lastName: studentForm.lastName.trim(),
      studentId: studentForm.studentId.trim(),
      class: studentForm.class,
      section: studentForm.section.trim(),
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

    await createRegistration({
      sessionId: currentSession?.id || '',
      applicationId: generateAppId(),
      studentId: newStudent.id,
      studentName: `${newStudent.firstName} ${newStudent.lastName}`,
      institutionId: inst.id,
      institutionName: inst.name,
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
  };

  const handleApprove = (reg: Registration) => {
    updateRegistration(reg.id, { status: "APPROVED" });
    toast("success", isBn ? "নিবন্ধন অনুমোদিত হয়েছে" : "Registration approved");
    setConfirmAction(null);
    setRefreshKey(k => k + 1);
  };

  const handleReject = (reg: Registration) => {
    updateRegistration(reg.id, { status: "REJECTED" });
    toast("success", isBn ? "নিবন্ধন প্রত্যাখ্যাত হয়েছে" : "Registration rejected");
    setConfirmAction(null);
    setRefreshKey(k => k + 1);
  };

  const handleMarkPaid = (reg: Registration) => {
    updateRegistration(reg.id, { paymentStatus: "PAID" });
    toast("success", isBn ? "পেমেন্ট চিহ্নিত হয়েছে" : "Marked as paid");
    setMenuOpenId(null);
    setRefreshKey(k => k + 1);
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
              <Input placeholder={isBn ? "শিক্ষার্থী বা আবেদন আইডি দিয়ে অনুসন্ধান..." : "Search by student or application ID..."} value={search} onChange={(e) => setSearch(e.target.value)} className={cn("pl-10", inputCls)} />
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
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>{isBn ? "আবেদন আইডি" : "Application ID"}</TableHead>
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
                    <TableCell className={`text-[11px] font-mono ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>{reg.applicationId}</TableCell>
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
                        {reg.status === "PENDING" && (
                          <>
                            <TableActionItem onClick={() => { setConfirmAction({ type: "approve", reg }); setMenuOpenId(null); }} isDark={isDark} variant="success">
                              <CheckCircle className="h-3.5 w-3.5" /> {isBn ? "অনুমোদন" : "Approve"}
                            </TableActionItem>
                            <TableActionItem onClick={() => { setConfirmAction({ type: "reject", reg }); setMenuOpenId(null); }} isDark={isDark} variant="danger">
                              <XCircle className="h-3.5 w-3.5" /> {isBn ? "প্রত্যাখ্যান" : "Reject"}
                            </TableActionItem>
                          </>
                        )}
                        {reg.paymentStatus !== "PAID" && (
                          <TableActionItem onClick={() => handleMarkPaid(reg)} isDark={isDark}>
                            <Banknote className="h-3.5 w-3.5" /> {isBn ? "পেমেন্ট চিহ্নিত করুন" : "Mark Paid"}
                          </TableActionItem>
                        )}
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
      <Modal open={showModal} onClose={() => setShowModal(false)} title={isBn ? "নতুন নিবন্ধন" : "New Registration"} maxWidth="max-w-xl">
        {/* Step Indicator */}
        <div className="flex items-center gap-2 mb-6">
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
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={`block text-[11px] mb-1.5 font-medium ${labelCls}`}>{isBn ? 'প্রথম নাম *' : 'First Name *'}</label>
                <Input placeholder={isBn ? 'প্রথম নাম' : 'First name'} value={studentForm.firstName} onChange={(e) => setStudentForm({ ...studentForm, firstName: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className={`block text-[11px] mb-1.5 font-medium ${labelCls}`}>{isBn ? 'শেষ নাম *' : 'Last Name *'}</label>
                <Input placeholder={isBn ? 'শেষ নাম' : 'Last name'} value={studentForm.lastName} onChange={(e) => setStudentForm({ ...studentForm, lastName: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className={`block text-[11px] mb-1.5 font-medium ${labelCls}`}>{isBn ? 'শিক্ষার্থী আইডি *' : 'Student ID *'}</label>
                <Input placeholder={isBn ? 'আইডি' : 'Student ID'} value={studentForm.studentId} onChange={(e) => setStudentForm({ ...studentForm, studentId: e.target.value })} className={inputCls} />
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
                <label className={`block text-[11px] mb-1.5 font-medium ${labelCls}`}>{isBn ? 'শাখা' : 'Section'}</label>
                <Input placeholder={isBn ? 'শাখা' : 'Section'} value={studentForm.section} onChange={(e) => setStudentForm({ ...studentForm, section: e.target.value })} className={inputCls} />
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
          <div className="space-y-4">
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
          <div className="space-y-5">
            {/* Profile Picture */}
            <div>
              <label className={`block text-[11px] mb-1.5 font-medium ${labelCls}`}>{isBn ? 'প্রোফাইল ছবি' : 'Profile Picture'} <span className="text-red-400">(min 500KB)</span></label>
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
                    {isBn ? 'JPG, PNG। ন্যূনতম 500KB আকার প্রয়োজন।' : 'JPG, PNG. Minimum 500KB file size required.'}
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
              <label className={`block text-[11px] mb-1.5 font-medium ${labelCls}`}>{isBn ? "আবেদন আইডি" : "Application ID"}</label>
              <Input value={generateAppId()} disabled className={cn("opacity-60", inputCls)} />
            </div>
          </div>
        )}

        <ModalFooter>
          <div className="flex items-center justify-between w-full">
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
                <button onClick={handleSave} disabled={!canSubmitStep3} className={cn("px-4 py-2 rounded-md text-[13px] font-medium transition-all", canSubmitStep3 ? (isDark ? "bg-white text-black hover:bg-white/90" : "bg-zinc-900 text-white hover:bg-zinc-800") : "opacity-50 cursor-not-allowed")}>
                  {isBn ? 'নিবন্ধন করুন' : 'Register'}
                </button>
              )}
            </div>
          </div>
        </ModalFooter>
      </Modal>

      {/* View Details Modal */}
      <Modal open={!!viewingReg} onClose={() => setViewingReg(null)} title={isBn ? "নিবন্ধন বিস্তারিত" : "Registration Details"} maxWidth="max-w-lg">
        {viewingReg && (
          <div className="space-y-3">
            {[
              { label: isBn ? "আবেদন আইডি" : "Application ID", value: viewingReg.applicationId },
              { label: isBn ? "শিক্ষার্থী" : "Student", value: viewingReg.studentName },
              { label: isBn ? "পরীক্ষা" : "Exam", value: viewingReg.examName },
              { label: isBn ? "শ্রেণী" : "Class", value: viewingReg.className },
              { label: isBn ? "স্থিতি" : "Status", value: viewingReg.status, isStatus: true },
              { label: isBn ? "পেমেন্ট স্থিতি" : "Payment Status", value: viewingReg.paymentStatus, isStatus: true },
              { label: isBn ? "পরিমাণ" : "Amount", value: `৳${viewingReg.paymentAmount.toLocaleString()}` },
              { label: isBn ? "তৈরি" : "Created", value: formatDate(viewingReg.createdAt) },
            ].map((item) => (
              <div key={item.label} className={`flex items-center justify-between py-2 border-b ${isDark ? "border-white/[0.06]" : "border-zinc-100"}`}>
                <span className={`text-[11px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>{item.label}</span>
                {item.isStatus ? <Badge status={item.value as string} /> : <span className={`text-[11px] font-medium ${isDark ? "text-zinc-200" : "text-zinc-700"}`}>{item.value}</span>}
              </div>
            ))}
          </div>
        )}
        <ModalFooter>
          <button onClick={() => setViewingReg(null)} className={`px-4 py-2 rounded-md text-[13px] font-medium transition-all ${isDark ? "bg-white/[0.06] text-zinc-300 hover:bg-white/[0.1]" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"}`}>{isBn ? "বন্ধ" : "Close"}</button>
        </ModalFooter>
      </Modal>

      {/* Approve / Reject Confirmation */}
      <Modal open={!!confirmAction} onClose={() => setConfirmAction(null)} title={confirmAction?.type === "approve" ? (isBn ? "নিবন্ধন অনুমোদন?" : "Approve Registration?") : (isBn ? "নিবন্ধন প্রত্যাখ্যান?" : "Reject Registration?")}>
        <p className={`text-sm ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
          {confirmAction?.type === "approve"
            ? (isBn ? `"${confirmAction?.reg.applicationId}" অনুমোদিত হবে।` : `"${confirmAction?.reg.applicationId}" will be approved.`)
            : (isBn ? `"${confirmAction?.reg.applicationId}" প্রত্যাখ্যাত হবে। এই কাজটি পূর্বাবস্থায় ফেরানো যাবে না।` : `"${confirmAction?.reg.applicationId}" will be rejected. This action cannot be undone.`)}
        </p>
        <ModalFooter>
          <button onClick={() => setConfirmAction(null)} className={`px-4 py-2 rounded-md text-[13px] font-medium transition-all ${isDark ? "bg-white/[0.06] text-zinc-300 hover:bg-white/[0.1]" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"}`}>{isBn ? "বাতিল" : "Cancel"}</button>
          <button
            onClick={() => confirmAction && (confirmAction.type === "approve" ? handleApprove(confirmAction.reg) : handleReject(confirmAction.reg))}
            className={cn("px-4 py-2 rounded-md text-[13px] font-medium transition-all", confirmAction?.type === "approve" ? "bg-green-600 text-white hover:bg-green-700" : "bg-red-600 text-white hover:bg-red-700")}
          >
            {confirmAction?.type === "approve" ? (isBn ? "অনুমোদন" : "Approve") : (isBn ? "প্রত্যাখ্যান" : "Reject")}
          </button>
        </ModalFooter>
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
  const card = isDark ? "bg-[#141416] border border-white/[0.06]" : "bg-white border border-zinc-200 shadow-sm";
  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0a0a0b]" : "bg-zinc-50"}`}>
      <div className="max-w-[1600px] mx-auto p-6 lg:p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className={`h-8 w-48 rounded-md ${isDark ? "bg-white/[0.06]" : "bg-zinc-200"}`} />
            <div className={`h-4 w-64 rounded mt-2 ${isDark ? "bg-white/[0.04]" : "bg-zinc-200/60"}`} />
          </div>
          <div className={`h-10 w-36 rounded-md ${isDark ? "bg-white/[0.06]" : "bg-zinc-200"}`} />
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
