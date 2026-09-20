"use client";
import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { useInstitutionBySlug } from "@/lib/storage/institutions";
import { useResultsByInstitution, useCreateResult, useUpdateResult, useDeleteResult } from "@/lib/storage/results";
import { useRegistrationsByInstitution } from "@/lib/storage/registrations";
import { useExams, useExamById } from "@/lib/storage/exams";
import { useStudentsByInstitution } from "@/lib/storage/students";
import { useCurrentSession } from "@/lib/storage/sessions";
import { Result, Registration, Exam, ExamSubject } from "@/lib/types";
import { formatDate } from "@/lib/storage/storage";
import { Award, Trophy, Plus, Edit, Trash2, CheckCircle2, XCircle, BarChart3, TrendingUp, FileDown } from "lucide-react";
import { TableActionMenu, TableActionItem } from "@/components/ui/table-action-menu";
import { TableCheckbox } from "@/components/ui/table-checkbox";
import { useTableSelection } from "@/hooks/use-table-selection";
import { PdfExportModal, type PdfColumn } from "@/components/ui/pdf-export-modal";
import { useTheme } from "@/contexts/theme-context";
import { useLang } from "@/contexts/language-context";
import { cn } from "@/lib/utils/helpers";
import { LoadingBar } from "@/components/ui/loading-bar";

function calcGrade(pct: number): string {
  if (pct >= 80) return "A+";
  if (pct >= 70) return "A";
  if (pct >= 60) return "A-";
  if (pct >= 50) return "B";
  if (pct >= 40) return "C";
  if (pct >= 33) return "D";
  return "F";
}

export default function InstitutionResultsPage() {
  const params = useParams();
  const slug = params.institutionSlug as string;
  const { theme } = useTheme();
  const { lang: language, t } = useLang();
  const isDark = theme === "dark";
  const isBn = language === "bn";
  const { toast } = useToast();
  const [mounted, setMounted] = useState(false);
  const [examFilter, setExamFilter] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingResult, setEditingResult] = useState<Result | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<Result | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [selectedRegistration, setSelectedRegistration] = useState("");
  const [selectedExamId, setSelectedExamId] = useState("");
  const [marksInput, setMarksInput] = useState<Record<string, string>>({});
  const [showPdfModal, setShowPdfModal] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const { data: inst } = useInstitutionBySlug(slug);
  const { data: currentSession } = useCurrentSession();
  const { data: results = [], isFetching } = useResultsByInstitution(inst?.id || '', currentSession?.id);
  const { data: exams = [] } = useExams();
  const { data: registrations = [] } = useRegistrationsByInstitution(inst?.id || '', currentSession?.id);
  const { data: students = [] } = useStudentsByInstitution(inst?.id || '', currentSession?.id);
  const createResultMutation = useCreateResult();
  const updateResultMutation = useUpdateResult();
  const deleteResultMutation = useDeleteResult();

  const approvedRegistrations = registrations.filter(r => r.status === "APPROVED");
  const existingRegNumbers = new Set(results.map(r => r.registrationNumber));
  const availableRegistrations = approvedRegistrations.filter(r => !existingRegNumbers.has(r.id));

  const filtered = examFilter ? results.filter(r => r.examId === examFilter) : results;

  const selection = useTableSelection(filtered);

  const pdfColumns: PdfColumn[] = [
    { header: isBn ? "শিক্ষার্থী" : "Student", key: 'studentName' },
    { header: isBn ? "পরীক্ষা" : "Exam", key: 'examName' },
    { header: isBn ? "মোট" : "Total", key: 'total' },
    { header: isBn ? "শতাংশ" : "%", key: 'percentage' },
    { header: isBn ? "গ্রেড" : "Grade", key: 'grade' },
    { header: isBn ? "অবস্থান" : "Position", key: 'position' },
    { header: isBn ? "প্রকাশিত" : "Published", key: 'published' },
  ];

  const pdfData = filtered.map(r => ({
    studentName: r.studentName,
    examName: r.examName,
    total: `${r.totalMarks}/${r.totalFullMarks}`,
    percentage: `${r.percentage.toFixed(1)}%`,
    grade: r.grade,
    position: `#${r.position}`,
    published: r.status === "PUBLISHED" ? (isBn ? "হ্যাঁ" : "Yes") : (isBn ? "না" : "No"),
  }));

  const totalResults = filtered.length;
  const publishedCount = filtered.filter(r => r.status === "PUBLISHED").length;
  const avgGrade = totalResults > 0 ? Math.round(filtered.reduce((sum, r) => sum + r.percentage, 0) / totalResults) : 0;
  const passRate = totalResults > 0 ? Math.round((filtered.filter(r => r.pass).length / totalResults) * 100) : 0;

  if (!mounted) return <ResultsSkeleton isDark={isDark} />;
  if (!inst) return null;

  const handleCreate = () => {
    setEditingResult(null);
    setSelectedRegistration("");
    setSelectedExamId("");
    setMarksInput({});
    setShowModal(true);
    setMenuOpenId(null);
  };

  const handleEdit = (r: Result) => {
    setEditingResult(r);
    setSelectedRegistration(r.registrationNumber);
    setSelectedExamId(r.examId);
    const marksRec: Record<string, string> = {};
    r.subjectMarks.forEach(s => { marksRec[s.subjectId] = String(s.marks); });
    setMarksInput(marksRec);
    setShowModal(true);
    setMenuOpenId(null);
  };

  const handleDelete = async (r: Result) => {
    await deleteResultMutation.mutateAsync(r.id);
    toast("success", isBn ? "ফলাফল মুছে ফেলা হয়েছে" : "Result deleted");
    setShowDeleteConfirm(null);
    setRefreshKey(k => k + 1);
  };

  const handleTogglePublish = async (r: Result) => {
    const newStatus = r.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED";
    await updateResultMutation.mutateAsync({ id: r.id, data: { status: newStatus } });
    toast("success", isBn
      ? (newStatus === "PUBLISHED" ? "ফলাফল প্রকাশিত হয়েছে" : "ফলাফল খসড়ায় ফেরানো হয়েছে")
      : (newStatus === "PUBLISHED" ? "Result published" : "Result moved to draft")
    );
    setRefreshKey(k => k + 1);
  };

  const handlePublishAll = async () => {
    if (!examFilter) {
      toast("error", isBn ? "প্রথমে একটি পরীক্ষা নির্বাচন করুন" : "Please select an exam first");
      return;
    }
    const unpublished = results.filter(r => r.examId === examFilter && r.status !== "PUBLISHED");
    if (unpublished.length === 0) {
      toast("error", isBn ? "কোনো অপ্রকাশিত ফলাফল নেই" : "No unpublished results for this exam");
      return;
    }
    for (const r of unpublished) {
      await updateResultMutation.mutateAsync({ id: r.id, data: { status: "PUBLISHED" } });
    }
    toast("success", isBn ? `${unpublished.length}টি ফলাফল প্রকাশিত হয়েছে` : `${unpublished.length} results published`);
    setRefreshKey(k => k + 1);
  };

  const handleSave = async () => {
    if (editingResult) {
      const exam = exams.find(e => e.id === editingResult.examId);
      if (!exam) return;
      let totalM = 0;
      let totalFull = 0;
      const subjectMarks = exam.subjects.map((subj: ExamSubject) => {
        const m = parseFloat(marksInput[subj.id] || "0") || 0;
        totalM += m;
        totalFull += subj.fullMarks;
        return { subjectId: subj.id, subjectName: subj.name, marks: m, fullMarks: subj.fullMarks };
      });
      const pct = totalFull > 0 ? Math.round((totalM / totalFull) * 1000) / 10 : 0;
      await updateResultMutation.mutateAsync({
        id: editingResult.id,
        data: {
          subjectMarks,
          totalMarks: totalM,
          totalFullMarks: totalFull,
          percentage: pct,
          grade: calcGrade(pct),
          pass: pct >= 33,
          scholarshipStatus: pct >= 60 ? "ELIGIBLE" : "NOT_ELIGIBLE",
        },
      });
      toast("success", isBn ? "ফলাফল আপডেট হয়েছে" : "Result updated");
    } else {
      if (!selectedRegistration) {
        toast("error", isBn ? "নিবন্ধন নির্বাচন করুন" : "Please select a registration");
        return;
      }
      const reg = registrations.find(r => r.id === selectedRegistration);
      if (!reg) return;
      const exam = exams.find(e => e.id === reg.examId);
      if (!exam) return;
      let totalM = 0;
      let totalFull = 0;
      const subjectMarks = exam.subjects.map((subj: ExamSubject) => {
        const m = parseFloat(marksInput[subj.id] || "0") || 0;
        totalM += m;
        totalFull += subj.fullMarks;
        return { subjectId: subj.id, subjectName: subj.name, marks: m, fullMarks: subj.fullMarks };
      });
      const pct = totalFull > 0 ? Math.round((totalM / totalFull) * 1000) / 10 : 0;
      const student = students.find(s => s.id === reg.studentId);
      await createResultMutation.mutateAsync({
        sessionId: currentSession?.id || '',
        studentId: reg.studentId,
        studentName: reg.studentName,
        institutionId: inst!.id,
        institutionName: inst!.name,
        examId: reg.examId,
        examName: reg.examName,
        className: reg.className,
        roll: student?.roll || "",
        registrationNumber: reg.id,
        subjectMarks,
        totalMarks: totalM,
        totalFullMarks: totalFull,
        percentage: pct,
        grade: calcGrade(pct),
        position: 0,
        pass: pct >= 33,
        scholarshipStatus: pct >= 60 ? "ELIGIBLE" : "NOT_ELIGIBLE",
        status: "DRAFT",
      });
      toast("success", isBn ? "ফলাফল যোগ হয়েছে" : "Result created");
    }
    setShowModal(false);
    setRefreshKey(k => k + 1);
  };

  const selectedExamForModal = editingResult
    ? exams.find(e => e.id === editingResult.examId)
    : selectedRegistration
      ? exams.find(e => e.id === registrations.find(r => r.id === selectedRegistration)?.examId)
      : null;

  const card = isDark
    ? "bg-[#141416] border border-white/[0.06] rounded-md"
    : "bg-white border border-zinc-200 rounded-md shadow-sm";
  const iconBg = isDark ? "bg-white/[0.08]" : "bg-zinc-100";
  const iconColor = isDark ? "text-zinc-300" : "text-zinc-600";
  const inputCls = isDark ? "bg-white/[0.04] border-white/[0.08] text-white placeholder:text-zinc-600" : "bg-zinc-50 border-zinc-200 text-zinc-900 placeholder:text-zinc-400";
  const labelCls = isDark ? "text-zinc-400" : "text-zinc-600";

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0a0a0b]" : "bg-zinc-50"}`}>
      <LoadingBar isLoading={isFetching} />
      <div className="max-w-[1600px] mx-auto p-6 lg:p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className={`text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-zinc-900"}`}>
              {isBn ? "ফলাফল" : "Results"}
            </h1>
            <p className={`text-sm mt-1 ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>
              {isBn ? "পরীক্ষার ফলাফল পরিচালনা করুন" : "Manage examination results"}
            </p>
          </div>
          <button onClick={handleCreate} className={cn("flex items-center gap-2 px-4 py-2.5 rounded-md text-[13px] font-medium transition-all", isDark ? "bg-white text-black hover:bg-white/90" : "bg-zinc-900 text-white hover:bg-zinc-800")}>
            <Plus className="h-4 w-4" /> {isBn ? "ফলাফল যোগ করুন" : "Add Result"}
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { icon: Award, label: isBn ? "মোট ফলাফল" : "Total Results", value: totalResults },
            { icon: CheckCircle2, label: isBn ? "প্রকাশিত" : "Published", value: publishedCount },
            { icon: BarChart3, label: isBn ? "গড় গ্রেড" : "Average Grade", value: `${avgGrade}%` },
            { icon: TrendingUp, label: isBn ? "পাসের হার" : "Pass Rate", value: `${passRate}%` },
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
            <div className="flex-1">
              <Select
                options={[{ label: isBn ? "সব পরীক্ষা" : "All Exams", value: "" }, ...exams.map(e => ({ label: e.name, value: e.id }))]}
                value={examFilter}
                onChange={(e) => setExamFilter(e.target.value)}
                className={cn("w-full sm:w-56", inputCls)}
              />
            </div>
            {examFilter && (
              <button onClick={handlePublishAll} className={cn("flex items-center gap-2 px-4 py-2 rounded-md text-[13px] font-medium transition-all", isDark ? "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20" : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100")}>
                <CheckCircle2 className="h-4 w-4" /> {isBn ? "সব প্রকাশ করুন" : "Publish All"}
              </button>
            )}
          </div>
        </div>

        <div className={`${card}`}>
          <div className={`px-5 py-4 border-b ${isDark ? "border-white/[0.06]" : "border-zinc-100"}`}>
            <div className="flex items-center gap-2">
              <Award className={`h-4 w-4 ${isDark ? "text-zinc-400" : "text-zinc-500"}`} />
              <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>
                {isBn ? "ফলাফল তালিকা" : "Results List"}
              </h3>
              <span className={`text-[11px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>({filtered.length})</span>
            </div>
          </div>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className={`h-14 w-14 rounded-md flex items-center justify-center mb-4 ${isDark ? "bg-white/[0.08]" : "bg-zinc-100"}`}>
                <Award className={`h-7 w-7 ${iconColor}`} />
              </div>
              <p className={`text-sm font-medium ${isDark ? "text-white" : "text-zinc-900"}`}>{isBn ? "কোনো ফলাফল পাওয়া যায়নি" : "No results found"}</p>
              <p className={`text-xs mt-1 ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>{isBn ? "ফলাফল যোগ করতে উপরের বোতাম ব্যবহার করুন" : "Use the button above to add results"}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className={isDark ? "border-white/[0.04] hover:bg-transparent" : "border-zinc-100 hover:bg-transparent"}>
                  <TableHead className="w-10">
                    <TableCheckbox checked={selection.allSelected} indeterminate={selection.someSelected} onChange={selection.toggleAll} />
                  </TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>{isBn ? "শিক্ষার্থী" : "Student"}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>{isBn ? "পরীক্ষা" : "Exam"}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>{isBn ? "মোট" : "Total"}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>{isBn ? "শতাংশ" : "%"}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>{isBn ? "গ্রেড" : "Grade"}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>{isBn ? "অবস্থান" : "Position"}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>{isBn ? "প্রকাশিত" : "Published"}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? "text-zinc-400" : "text-zinc-500"}`}></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(result => (
                  <TableRow key={result.id} className={`${isDark ? "border-white/[0.04] hover:bg-white/[0.02]" : "border-zinc-100 hover:bg-zinc-50/50"} ${selection.isSelected(result.id) ? (isDark ? 'bg-[#9333ea]/10' : 'bg-purple-50') : ''}`}>
                    <TableCell className="w-10">
                      <TableCheckbox checked={selection.isSelected(result.id)} onChange={() => selection.toggle(result.id)} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <div className={`h-8 w-8 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0 ${isDark ? "bg-white/[0.08] text-zinc-300" : "bg-zinc-100 text-zinc-600"}`}>
                          {result.studentName.charAt(0)}
                        </div>
                        <div>
                          <span className={`text-sm font-medium ${isDark ? "text-zinc-100" : "text-zinc-800"}`}>{result.studentName}</span>
                          <p className={`text-[10px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>{result.className}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className={`text-[11px] ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>{result.examName}</TableCell>
                    <TableCell className={`text-[11px] ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>{result.totalMarks}/{result.totalFullMarks}</TableCell>
                    <TableCell className={`text-[11px] ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>{result.percentage.toFixed(1)}%</TableCell>
                    <TableCell>
                      <span className={`text-[11px] font-bold ${result.grade === "F" ? (isDark ? "text-red-400" : "text-red-600") : (isDark ? "text-emerald-400" : "text-emerald-600")}`}>
                        {result.grade}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`text-sm font-bold ${result.position <= 3 ? (isDark ? "text-amber-400" : "text-amber-600") : (isDark ? "text-zinc-300" : "text-zinc-600")}`}>
                        #{result.position}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge status={result.status === "PUBLISHED" ? "APPROVED" : "PENDING"} />
                    </TableCell>
                    <TableCell>
                      <TableActionMenu id={result.id} openId={menuOpenId} onToggle={setMenuOpenId} isDark={isDark}>
                        <TableActionItem onClick={() => handleEdit(result)} isDark={isDark}>
                          <Edit className="h-3.5 w-3.5" /> {isBn ? "সম্পাদনা" : "Edit"}
                        </TableActionItem>
                        <TableActionItem onClick={() => { handleTogglePublish(result); setMenuOpenId(null); }} isDark={isDark}>
                          {result.status === "PUBLISHED" ? <XCircle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                          {result.status === "PUBLISHED" ? (isBn ? "খসড়ায়" : "Unpublish") : (isBn ? "প্রকাশ করুন" : "Publish")}
                        </TableActionItem>
                        <TableActionItem onClick={() => { setShowDeleteConfirm(result); setMenuOpenId(null); }} isDark={isDark} variant="danger">
                          <Trash2 className="h-3.5 w-3.5" /> {isBn ? "মুছুন" : "Delete"}
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

      {/* Add/Edit Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editingResult ? (isBn ? "ফলাফল সম্পাদনা" : "Edit Result") : (isBn ? "নতুন ফলাফল" : "New Result")} maxWidth="max-w-xl">
        <div className="space-y-4">
          {!editingResult && (
            <div>
              <label className={`block text-[11px] mb-1.5 font-medium ${labelCls}`}>{isBn ? "নিবন্ধন *" : "Registration *"}</label>
              <Select
                options={[{ label: isBn ? "নিবন্ধন নির্বাচন করুন" : "Select registration", value: "" }, ...availableRegistrations.map(r => ({ label: `${r.studentName} - ${r.examName} (${r.className})`, value: r.id }))]}
                value={selectedRegistration}
                onChange={(e) => {
                  setSelectedRegistration(e.target.value);
                  const reg = registrations.find(r => r.id === e.target.value);
                  if (reg) setSelectedExamId(reg.examId);
                  setMarksInput({});
                }}
                className={inputCls}
              />
              {availableRegistrations.length === 0 && (
                <p className={`text-[11px] mt-1 ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>{isBn ? "সব অনুমোদিত নিবন্ধনের জন্য ফলাফল ইতিমধ্যে তৈরি হয়েছে" : "Results already created for all approved registrations"}</p>
              )}
            </div>
          )}

          {selectedExamForModal && (
            <div className="space-y-3">
              <p className={`text-[11px] font-medium ${labelCls}`}>{isBn ? "বিষয় অনুযায়ী নম্বর" : "Marks by Subject"}</p>
              {selectedExamForModal.subjects.map((subj: ExamSubject) => (
                <div key={subj.id} className="flex items-center gap-3">
                  <span className={`text-[11px] flex-1 ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>{subj.name}</span>
                  <span className={`text-[10px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>{subj.fullMarks}</span>
                  <Input
                    type="number"
                    min={0}
                    max={subj.fullMarks}
                    value={marksInput[subj.id] || ""}
                    onChange={(e) => setMarksInput({ ...marksInput, [subj.id]: e.target.value })}
                    className={cn("w-20 text-center text-[12px]", inputCls)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
        <ModalFooter>
          <button onClick={() => setShowModal(false)} className={`px-4 py-2 rounded-md text-[13px] font-medium transition-all ${isDark ? "bg-white/[0.06] text-zinc-300 hover:bg-white/[0.1]" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"}`}>{isBn ? "বাতিল" : "Cancel"}</button>
          <button onClick={handleSave} className={`px-4 py-2 rounded-md text-[13px] font-medium transition-all ${isDark ? "bg-white text-black hover:bg-white/90" : "bg-zinc-900 text-white hover:bg-zinc-800"}`}>
            {editingResult ? (isBn ? "আপডেট" : "Update") : (isBn ? "তৈরি করুন" : "Create")}
          </button>
        </ModalFooter>
      </Modal>

      {/* Delete Confirmation */}
      <Modal open={!!showDeleteConfirm} onClose={() => setShowDeleteConfirm(null)} title={isBn ? "ফলাফল মুছুন?" : "Delete Result?"}>
        <p className={`text-sm ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
          {isBn ? `"${showDeleteConfirm?.studentName}" এর ফলাফল মুছে ফেলা হবে। এই কাজটি পূর্বাবস্থায় ফেরানো যাবে না।` : `"${showDeleteConfirm?.studentName}"'s result will be permanently deleted. This action cannot be undone.`}
        </p>
        <ModalFooter>
          <button onClick={() => setShowDeleteConfirm(null)} className={`px-4 py-2 rounded-md text-[13px] font-medium transition-all ${isDark ? "bg-white/[0.06] text-zinc-300 hover:bg-white/[0.1]" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"}`}>{isBn ? "বাতিল" : "Cancel"}</button>
          <button onClick={() => showDeleteConfirm && handleDelete(showDeleteConfirm)} className="px-4 py-2 rounded-md text-[13px] font-medium transition-all bg-red-600 text-white hover:bg-red-700">{isBn ? "মুছুন" : "Delete"}</button>
        </ModalFooter>
      </Modal>

      {/* Floating PDF Download Button */}
      {filtered.length > 0 && (
        <button
          onClick={() => setShowPdfModal(true)}
          className={`fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-3 rounded-full shadow-lg transition-all ${isDark ? "bg-[#9333ea] text-white hover:bg-[#7e22ce] shadow-[#9333ea]/20" : "bg-[#9333ea] text-white hover:bg-[#7e22ce] shadow-[#9333ea]/30"}`}
        >
          <FileDown className="h-4 w-4" />
          <span className="text-[13px] font-medium">{isBn ? 'পিডিএফ ডাউনলোড' : 'Download PDF'}</span>
        </button>
      )}

      <PdfExportModal
        open={showPdfModal}
        onClose={() => setShowPdfModal(false)}
        title={isBn ? 'ফলাফল তালিকা' : 'Result List'}
        columns={pdfColumns}
        data={pdfData}
      />
    </div>
  );
}

function ResultsSkeleton({ isDark }: { isDark: boolean }) {
  const card = isDark ? "bg-[#141416] border border-white/[0.06]" : "bg-zinc-200 border border-zinc-300 shadow-sm";
  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0a0a0b]" : "bg-zinc-50"}`}>
      <div className="max-w-[1600px] mx-auto p-6 lg:p-8">
        <div className="mb-8">
          <div className={`h-8 w-48 rounded-md ${isDark ? "bg-white/[0.06]" : "bg-zinc-300"}`} />
          <div className={`h-4 w-64 rounded mt-2 ${isDark ? "bg-white/[0.04]" : "bg-zinc-300/80"}`} />
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