"use client";
import { useState, useEffect, useMemo } from "react";
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
import { getStudentsByInstitution } from "@/lib/storage/students";
import { Registration } from "@/lib/types";
import { formatDate } from "@/lib/storage/storage";
import { useTheme } from "@/contexts/theme-context";
import { useLang } from "@/contexts/language-context";
import { cn } from "@/lib/utils/helpers";
import { ClipboardList, Search, Plus, MoreVertical, Eye, CheckCircle, XCircle, Banknote } from "lucide-react";

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

  const [formData, setFormData] = useState({ studentId: "", examId: "" });

  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return <RegistrationsSkeleton isDark={isDark} />;

  const inst = getInstitutionBySlug(slug);
  if (!inst) return null;

  const registrations = getRegistrationsByInstitution(inst.id);
  const exams = getExams();
  const students = getStudentsByInstitution(inst.id);

  const filtered = registrations.filter(r => {
    const matchesSearch = r.studentName.toLowerCase().includes(search.toLowerCase()) || r.applicationId.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = !statusFilter || r.status === statusFilter;
    const matchesExam = !examFilter || r.examId === examFilter;
    return matchesSearch && matchesStatus && matchesExam;
  });

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

  const selectedExam = exams.find(e => e.id === formData.examId);

  const handleCreate = () => {
    setFormData({ studentId: "", examId: "" });
    setShowModal(true);
    setMenuOpenId(null);
  };

  const handleSave = () => {
    if (!formData.studentId || !formData.examId) {
      toast("error", isBn ? "প্রয়োজনীয় ঘর পূরণ করুন" : "Please fill required fields");
      return;
    }
    const student = students.find(s => s.id === formData.studentId);
    const exam = exams.find(e => e.id === formData.examId);
    if (!student || !exam) return;

    createRegistration({
      applicationId: generateAppId(),
      studentId: student.id,
      studentName: `${student.firstName} ${student.lastName}`,
      institutionId: inst.id,
      institutionName: inst.name,
      examId: exam.id,
      examName: exam.name,
      className: student.class,
      status: "PENDING",
      paymentStatus: "PENDING",
      paymentAmount: exam.registrationFee,
    });
    toast("success", isBn ? "নিবন্ধন তৈরি হয়েছে" : "Registration created");
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
    ? "bg-[#141416] border border-white/[0.06] rounded-2xl"
    : "bg-white border border-zinc-200 rounded-2xl shadow-sm";
  const iconBg = isDark ? "bg-white/[0.08]" : "bg-zinc-100";
  const iconColor = isDark ? "text-zinc-300" : "text-zinc-600";
  const inputCls = isDark ? "bg-white/[0.04] border-white/[0.08] text-white placeholder:text-zinc-600" : "bg-zinc-50 border-zinc-200 text-zinc-900 placeholder:text-zinc-400";
  const labelCls = isDark ? "text-zinc-400" : "text-zinc-600";

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
          <button onClick={handleCreate} className={cn("flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-medium transition-all", isDark ? "bg-white text-black hover:bg-white/90" : "bg-zinc-900 text-white hover:bg-zinc-800")}>
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
              <div className={`h-14 w-14 rounded-2xl flex items-center justify-center mb-4 ${isDark ? "bg-white/[0.08]" : "bg-zinc-100"}`}>
                <ClipboardList className={`h-7 w-7 ${iconColor}`} />
              </div>
              <p className={`text-sm font-medium ${isDark ? "text-white" : "text-zinc-900"}`}>{isBn ? "কোনো নিবন্ধন পাওয়া যায়নি" : "No registrations found"}</p>
              <p className={`text-xs mt-1 ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>{isBn ? "নতুন নিবন্ধন যোগ করুন" : "Add a new registration to get started"}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className={isDark ? "border-white/[0.04] hover:bg-transparent" : "border-zinc-100 hover:bg-transparent"}>
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
                  <TableRow key={reg.id} className={`${isDark ? "border-white/[0.04] hover:bg-white/[0.02]" : "border-zinc-100 hover:bg-zinc-50/50"}`}>
                    <TableCell className={`text-[11px] font-mono ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>{reg.applicationId}</TableCell>
                    <TableCell className={`text-sm font-medium ${isDark ? "text-zinc-100" : "text-zinc-800"}`}>{reg.studentName}</TableCell>
                    <TableCell className={`text-[11px] ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>{reg.examName}</TableCell>
                    <TableCell><Badge status={reg.status} /></TableCell>
                    <TableCell><Badge status={reg.paymentStatus} /></TableCell>
                    <TableCell className={`text-[11px] ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>&#2547;{reg.paymentAmount.toLocaleString()}</TableCell>
                    <TableCell className={`text-[11px] ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>{formatDate(reg.createdAt)}</TableCell>
                    <TableCell>
                      <div className="relative">
                        <button onClick={() => setMenuOpenId(menuOpenId === reg.id ? null : reg.id)} className={`p-1.5 rounded-lg transition-all ${isDark ? "text-zinc-500 hover:text-white hover:bg-white/[0.05]" : "text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100"}`}>
                          <MoreVertical className="h-3.5 w-3.5" />
                        </button>
                        {menuOpenId === reg.id && (
                          <div className={`absolute right-0 top-full mt-1 w-44 rounded-xl border z-50 py-1 shadow-xl ${isDark ? "border-white/[0.06] bg-[#141416]" : "border-zinc-200 bg-white shadow-zinc-200/50"}`}>
                            <button onClick={() => { setViewingReg(reg); setMenuOpenId(null); }} className={`flex items-center gap-2 w-full px-3 py-2 text-xs transition-colors ${isDark ? "text-zinc-400 hover:text-white hover:bg-white/[0.05]" : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50"}`}>
                              <Eye className="h-3.5 w-3.5" /> {isBn ? "বিস্তারিত" : "View Details"}
                            </button>
                            {reg.status === "PENDING" && (
                              <>
                                <button onClick={() => { setConfirmAction({ type: "approve", reg }); setMenuOpenId(null); }} className={`flex items-center gap-2 w-full px-3 py-2 text-xs transition-colors ${isDark ? "text-green-400 hover:bg-green-500/10" : "text-green-600 hover:bg-green-50"}`}>
                                  <CheckCircle className="h-3.5 w-3.5" /> {isBn ? "অনুমোদন" : "Approve"}
                                </button>
                                <button onClick={() => { setConfirmAction({ type: "reject", reg }); setMenuOpenId(null); }} className={`flex items-center gap-2 w-full px-3 py-2 text-xs transition-colors text-red-400 hover:bg-red-500/10`}>
                                  <XCircle className="h-3.5 w-3.5" /> {isBn ? "প্রত্যাখ্যান" : "Reject"}
                                </button>
                              </>
                            )}
                            {reg.paymentStatus !== "PAID" && (
                              <button onClick={() => handleMarkPaid(reg)} className={`flex items-center gap-2 w-full px-3 py-2 text-xs transition-colors ${isDark ? "text-blue-400 hover:bg-blue-500/10" : "text-blue-600 hover:bg-blue-50"}`}>
                                <Banknote className="h-3.5 w-3.5" /> {isBn ? "পেমেন্ট চিহ্নিত করুন" : "Mark Paid"}
                              </button>
                            )}
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

      {/* Add Registration Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={isBn ? "নতুন নিবন্ধন" : "New Registration"} maxWidth="max-w-lg">
        <div className="space-y-4">
          <div>
            <label className={`block text-[11px] mb-1.5 font-medium ${labelCls}`}>{isBn ? "শিক্ষার্থী *" : "Student *"}</label>
            <Select
              options={[{ label: isBn ? "শিক্ষার্থী নির্বাচন করুন" : "Select student", value: "" }, ...students.map(s => ({ label: `${s.firstName} ${s.lastName} (${s.studentId})`, value: s.id }))]}
              value={formData.studentId}
              onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
              className={inputCls}
            />
          </div>
          <div>
            <label className={`block text-[11px] mb-1.5 font-medium ${labelCls}`}>{isBn ? "পরীক্ষা *" : "Exam *"}</label>
            <Select
              options={[{ label: isBn ? "পরীক্ষা নির্বাচন করুন" : "Select exam", value: "" }, ...exams.map(e => ({ label: `${e.name} (${e.academicYear})`, value: e.id }))]}
              value={formData.examId}
              onChange={(e) => setFormData({ ...formData, examId: e.target.value })}
              className={inputCls}
            />
          </div>
          {selectedExam && (
            <div className={`${isDark ? "bg-white/[0.04]" : "bg-zinc-50"} rounded-xl p-3 border ${isDark ? "border-white/[0.06]" : "border-zinc-200"}`}>
              <p className={`text-[11px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>{isBn ? "নিবন্ধন ফি" : "Registration Fee"}</p>
              <p className={`text-sm font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>&#2547;{selectedExam.registrationFee.toLocaleString()}</p>
            </div>
          )}
          <div>
            <label className={`block text-[11px] mb-1.5 font-medium ${labelCls}`}>{isBn ? "আবেদন আইডি" : "Application ID"}</label>
            <Input value={generateAppId()} disabled className={cn("opacity-60", inputCls)} />
          </div>
        </div>
        <ModalFooter>
          <button onClick={() => setShowModal(false)} className={`px-4 py-2 rounded-xl text-[13px] font-medium transition-all ${isDark ? "bg-white/[0.06] text-zinc-300 hover:bg-white/[0.1]" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"}`}>{isBn ? "বাতিল" : "Cancel"}</button>
          <button onClick={handleSave} className={`px-4 py-2 rounded-xl text-[13px] font-medium transition-all ${isDark ? "bg-white text-black hover:bg-white/90" : "bg-zinc-900 text-white hover:bg-zinc-800"}`}>
            {isBn ? "তৈরি করুন" : "Create"}
          </button>
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
          <button onClick={() => setViewingReg(null)} className={`px-4 py-2 rounded-xl text-[13px] font-medium transition-all ${isDark ? "bg-white/[0.06] text-zinc-300 hover:bg-white/[0.1]" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"}`}>{isBn ? "বন্ধ" : "Close"}</button>
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
          <button onClick={() => setConfirmAction(null)} className={`px-4 py-2 rounded-xl text-[13px] font-medium transition-all ${isDark ? "bg-white/[0.06] text-zinc-300 hover:bg-white/[0.1]" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"}`}>{isBn ? "বাতিল" : "Cancel"}</button>
          <button
            onClick={() => confirmAction && (confirmAction.type === "approve" ? handleApprove(confirmAction.reg) : handleReject(confirmAction.reg))}
            className={cn("px-4 py-2 rounded-xl text-[13px] font-medium transition-all", confirmAction?.type === "approve" ? "bg-green-600 text-white hover:bg-green-700" : "bg-red-600 text-white hover:bg-red-700")}
          >
            {confirmAction?.type === "approve" ? (isBn ? "অনুমোদন" : "Approve") : (isBn ? "প্রত্যাখ্যান" : "Reject")}
          </button>
        </ModalFooter>
      </Modal>
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
            <div className={`h-8 w-48 rounded-lg ${isDark ? "bg-white/[0.06]" : "bg-zinc-200"}`} />
            <div className={`h-4 w-64 rounded mt-2 ${isDark ? "bg-white/[0.04]" : "bg-zinc-200/60"}`} />
          </div>
          <div className={`h-10 w-36 rounded-xl ${isDark ? "bg-white/[0.06]" : "bg-zinc-200"}`} />
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
