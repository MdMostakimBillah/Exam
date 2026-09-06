"use client";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { getCertificatesByInstitution, createCertificate, updateCertificate } from "@/lib/storage/certificates";
import { getResultsByInstitution } from "@/lib/storage/results";
import { getExams } from "@/lib/storage/exams";
import { getInstitutionBySlug } from "@/lib/storage/institutions";
import { Certificate, Result } from "@/lib/types";
import { Award, Search, Plus, Eye, XCircle, FileText, Layers } from "lucide-react";
import { formatDate } from "@/lib/storage/storage";
import { useTheme } from "@/contexts/theme-context";
import { useLang } from "@/contexts/language-context";
import { cn } from "@/lib/utils/helpers";

function generateCertNumber(existingCerts: Certificate[]): string {
  const year = new Date().getFullYear();
  const prefix = `CERT-${year}-`;
  const existingNumbers = existingCerts
    .map(c => c.certificateNumber)
    .filter(n => n.startsWith(prefix))
    .map(n => parseInt(n.replace(prefix, ''), 10))
    .filter(n => !isNaN(n));
  const nextNum = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
  return `${prefix}${String(nextNum).padStart(4, '0')}`;
}

export default function InstitutionCertificatesPage() {
  const params = useParams();
  const slug = params.institutionSlug as string;
  const { theme } = useTheme();
  const { lang: language, t } = useLang();
  const isDark = theme === "dark";
  const isBn = language === "bn";
  const { toast } = useToast();
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [selectedResult, setSelectedResult] = useState("");
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [selectedExam, setSelectedExam] = useState("");
  const [showDetailModal, setShowDetailModal] = useState<Certificate | null>(null);

  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return <CertificatesSkeleton isDark={isDark} />;

  const inst = getInstitutionBySlug(slug);
  if (!inst) return null;

  const certificates = getCertificatesByInstitution(inst.id);
  const results = getResultsByInstitution(inst.id);
  const allExams = getExams();
  const exams = allExams.filter(e => results.some(r => r.examId === e.id));
  const publishedResults = results.filter(r => r.status === 'PUBLISHED');

  const years = [...new Set(certificates.map(c => c.examYear))].sort().reverse();

  const filtered = certificates.filter(c => {
    const matchesSearch = c.studentName.toLowerCase().includes(search.toLowerCase()) || c.certificateNumber.toLowerCase().includes(search.toLowerCase());
    const matchesYear = !yearFilter || c.examYear === yearFilter;
    return matchesSearch && matchesYear;
  });

  const validCerts = certificates.filter(c => c.status === 'VERIFIED').length;
  const currentYear = String(new Date().getFullYear());
  const thisYearCerts = certificates.filter(c => c.examYear === currentYear).length;

  const availableResults = publishedResults.filter(r => !certificates.some(c => c.resultId === r.id));

  const handleGenerate = () => {
    if (!selectedResult) {
      toast("error", isBn ? "একটি ফলাফল নির্বাচন করুন" : "Please select a result");
      return;
    }
    const result = results.find(r => r.id === selectedResult);
    if (!result) return;

    const exam = allExams.find(e => e.id === result.examId);
    const certNumber = generateCertNumber(certificates);
    const today = new Date().toISOString().split('T')[0];

    createCertificate({
      certificateNumber: certNumber,
      studentId: result.studentId,
      studentName: result.studentName,
      institutionId: inst.id,
      institutionName: inst.name,
      examId: result.examId,
      examName: result.examName,
      className: result.className,
      position: result.position,
      totalMarks: result.totalMarks,
      examYear: exam ? exam.academicYear : currentYear,
      issueDate: today,
      qrCode: certNumber,
      status: 'GENERATED',
      resultId: result.id,
    });

    toast("success", isBn ? "সার্টিফিকেট তৈরি হয়েছে" : "Certificate generated");
    setShowGenerateModal(false);
    setSelectedResult("");
    setRefreshKey(k => k + 1);
  };

  const handleBatchGenerate = () => {
    if (!selectedExam) {
      toast("error", isBn ? "একটি পরীক্ষা নির্বাচন করুন" : "Please select an exam");
      return;
    }
    const examResults = publishedResults.filter(r => r.examId === selectedExam && !certificates.some(c => c.resultId === r.id));
    if (examResults.length === 0) {
      toast("warning", isBn ? "কোনো যোগ্য ফলাফল নেই" : "No eligible results found");
      return;
    }

    const exam = allExams.find(e => e.id === selectedExam);
    const today = new Date().toISOString().split('T')[0];
    let currentCerts = [...certificates];

    examResults.forEach(result => {
      const certNumber = generateCertNumber(currentCerts);
      const cert = createCertificate({
        certificateNumber: certNumber,
        studentId: result.studentId,
        studentName: result.studentName,
        institutionId: inst.id,
        institutionName: inst.name,
        examId: result.examId,
        examName: result.examName,
        className: result.className,
        position: result.position,
        totalMarks: result.totalMarks,
        examYear: exam ? exam.academicYear : currentYear,
        issueDate: today,
        qrCode: certNumber,
        status: 'GENERATED',
        resultId: result.id,
      });
      currentCerts.push(cert);
    });

    toast("success", isBn ? `${examResults.length}টি সার্টিফিকেট তৈরি হয়েছে` : `${examResults.length} certificates generated`);
    setShowBatchModal(false);
    setSelectedExam("");
    setRefreshKey(k => k + 1);
  };

  const handleMarkInvalid = (cert: Certificate) => {
    updateCertificate(cert.id, { status: 'DRAFT' });
    toast("success", isBn ? "সার্টিফিকেট অকার্যকর করা হয়েছে" : "Certificate marked invalid");
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
              {isBn ? 'সার্টিফিকেট' : 'Certificates'}
            </h1>
            <p className={`text-sm mt-1 ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>
              {isBn ? 'শিক্ষার্থীদের সার্টিফিকেট তৈরি ও পরিচালনা করুন' : 'Generate and manage student certificates'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { setShowBatchModal(true); setSelectedExam(""); }} className={cn("flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-medium transition-all", isDark ? "bg-white/[0.06] text-zinc-300 hover:bg-white/[0.1]" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200")}>
              <Layers className="h-4 w-4" /> {isBn ? 'ব্যাচ তৈরি' : 'Batch Generate'}
            </button>
            <button onClick={() => { setShowGenerateModal(true); setSelectedResult(""); }} className={cn("flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-medium transition-all", isDark ? "bg-white text-black hover:bg-white/90" : "bg-zinc-900 text-white hover:bg-zinc-800")}>
              <Plus className="h-4 w-4" /> {isBn ? 'সার্টিফিকেট তৈরি' : 'Generate Certificate'}
            </button>
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {[
            { icon: Award, label: isBn ? 'মোট তৈরি' : 'Total Generated', value: certificates.length },
            { icon: Award, label: isBn ? 'যাচাইকৃত' : 'Verified', value: validCerts },
            { icon: Award, label: isBn ? 'এই বছর' : 'This Year', value: thisYearCerts },
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
              <Input placeholder={isBn ? "শিক্ষার্থী বা সার্টিফিকেট নম্বর দিয়ে অনুসন্ধান..." : "Search by student or certificate number..."} value={search} onChange={(e) => setSearch(e.target.value)} className={cn("pl-10", inputCls)} />
            </div>
            <Select options={[{ label: isBn ? 'সব বছর' : 'All Years', value: '' }, ...years.map(y => ({ label: y, value: y }))]} value={yearFilter} onChange={(e) => setYearFilter(e.target.value)} className={cn("w-full sm:w-36", inputCls)} />
          </div>
        </div>

        {/* Table */}
        <div className={`${card}`}>
          <div className={`px-5 py-4 border-b ${isDark ? "border-white/[0.06]" : "border-zinc-100"}`}>
            <div className="flex items-center gap-2">
              <FileText className={`h-4 w-4 ${isDark ? "text-zinc-400" : "text-zinc-500"}`} />
              <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>{isBn ? 'সার্টিফিকেট তালিকা' : 'Certificates List'}</h3>
              <span className={`text-[11px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>({filtered.length})</span>
            </div>
          </div>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className={`h-14 w-14 rounded-2xl flex items-center justify-center mb-4 ${isDark ? 'bg-white/[0.08]' : 'bg-zinc-100'}`}>
                <Award className={`h-7 w-7 ${iconColor}`} />
              </div>
              <p className={`text-sm font-medium ${isDark ? "text-white" : "text-zinc-900"}`}>{isBn ? 'কোনো সার্টিফিকেট পাওয়া যায়নি' : 'No certificates found'}</p>
              <p className={`text-xs mt-1 ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>{isBn ? 'নতুন সার্টিফিকেট তৈরি করুন' : 'Generate a new certificate to get started'}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className={isDark ? 'border-white/[0.04] hover:bg-transparent' : 'border-zinc-100 hover:bg-transparent'}>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'সার্টিফিকেট নম্বর' : 'Cert #'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'শিক্ষার্থী' : 'Student'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'পরীক্ষা' : 'Exam'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'পজিশন' : 'Grade'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'প্রদানের তারিখ' : 'Issue Date'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'স্থিতি' : 'Valid'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(cert => (
                  <TableRow key={cert.id} className={`${isDark ? 'border-white/[0.04] hover:bg-white/[0.02]' : 'border-zinc-100 hover:bg-zinc-50/50'}`}>
                    <TableCell>
                      <span className={`text-[11px] font-mono ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>{cert.certificateNumber}</span>
                    </TableCell>
                    <TableCell className={`text-sm font-medium ${isDark ? "text-zinc-100" : "text-zinc-800"}`}>{cert.studentName}</TableCell>
                    <TableCell className={`text-[11px] ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>{cert.examName}</TableCell>
                    <TableCell>
                      <span className={`text-[11px] font-bold ${cert.position <= 3 ? (isDark ? "text-amber-400" : "text-amber-600") : (isDark ? "text-zinc-300" : "text-zinc-600")}`}>
                        #{cert.position}
                      </span>
                    </TableCell>
                    <TableCell className={`text-[11px] ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>{formatDate(cert.issueDate)}</TableCell>
                    <TableCell>
                      <Badge status={cert.status === 'VERIFIED' ? 'VERIFIED' : cert.status === 'GENERATED' ? 'ACTIVE' : 'DRAFT'} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <button onClick={() => setShowDetailModal(cert)} className={`p-1.5 rounded-lg transition-all ${isDark ? "text-zinc-500 hover:text-white hover:bg-white/[0.05]" : "text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100"}`}>
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        {cert.status !== 'DRAFT' && (
                          <button onClick={() => handleMarkInvalid(cert)} className={`p-1.5 rounded-lg transition-all text-red-400 hover:bg-red-500/10`}>
                            <XCircle className="h-3.5 w-3.5" />
                          </button>
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

      {/* Generate Certificate Modal */}
      <Modal open={showGenerateModal} onClose={() => setShowGenerateModal(false)} title={isBn ? 'সার্টিফিকেট তৈরি করুন' : 'Generate Certificate'} description={isBn ? 'প্রকাশিত ফলাফল থেকে একটি নির্বাচন করুন' : 'Select a published result to generate certificate'}>
        <div className="space-y-4">
          <div>
            <label className={`block text-[11px] mb-1.5 font-medium ${labelCls}`}>{isBn ? 'ফলাফল নির্বাচন করুন *' : 'Select Result *'}</label>
            <Select
              options={[
                { label: isBn ? '-- ফলাফল নির্বাচন করুন --' : '-- Select Result --', value: '' },
                ...availableResults.map(r => ({
                  label: `${r.studentName} - ${r.examName} (#${r.position})`,
                  value: r.id,
                }))
              ]}
              value={selectedResult}
              onChange={(e) => setSelectedResult(e.target.value)}
              className={inputCls}
            />
          </div>
          {availableResults.length === 0 && (
            <p className={`text-xs ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
              {isBn ? 'সব প্রকাশিত ফলাফলের জন্য ইতিমধ্যে সার্টিফিকেট তৈরি করা হয়েছে।' : 'All published results already have certificates generated.'}
            </p>
          )}
        </div>
        <ModalFooter>
          <button onClick={() => setShowGenerateModal(false)} className={`px-4 py-2 rounded-xl text-[13px] font-medium transition-all ${isDark ? "bg-white/[0.06] text-zinc-300 hover:bg-white/[0.1]" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"}`}>{isBn ? 'বাতিল' : 'Cancel'}</button>
          <button onClick={handleGenerate} className={`px-4 py-2 rounded-xl text-[13px] font-medium transition-all ${isDark ? "bg-white text-black hover:bg-white/90" : "bg-zinc-900 text-white hover:bg-zinc-800"}`}>
            {isBn ? 'তৈরি করুন' : 'Generate'}
          </button>
        </ModalFooter>
      </Modal>

      {/* Batch Generate Modal */}
      <Modal open={showBatchModal} onClose={() => setShowBatchModal(false)} title={isBn ? 'ব্যাচ তৈরি' : 'Batch Generate'} description={isBn ? 'একটি পরীক্ষার সব প্রকাশিত ফলাফলের জন্য সার্টিফিকেট তৈরি করুন' : 'Generate certificates for all published results of an exam'}>
        <div className="space-y-4">
          <div>
            <label className={`block text-[11px] mb-1.5 font-medium ${labelCls}`}>{isBn ? 'পরীক্ষা নির্বাচন করুন *' : 'Select Exam *'}</label>
            <Select
              options={[
                { label: isBn ? '-- পরীক্ষা নির্বাচন করুন --' : '-- Select Exam --', value: '' },
                ...exams.map(e => ({
                  label: `${e.name} (${e.academicYear})`,
                  value: e.id,
                }))
              ]}
              value={selectedExam}
              onChange={(e) => setSelectedExam(e.target.value)}
              className={inputCls}
            />
          </div>
          {selectedExam && (
            <p className={`text-xs ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
              {isBn
                ? `${publishedResults.filter(r => r.examId === selectedExam && !certificates.some(c => c.resultId === r.id)).length}টি সার্টিফিকেট তৈরি হবে।`
                : `${publishedResults.filter(r => r.examId === selectedExam && !certificates.some(c => c.resultId === r.id)).length} certificates will be generated.`
              }
            </p>
          )}
        </div>
        <ModalFooter>
          <button onClick={() => setShowBatchModal(false)} className={`px-4 py-2 rounded-xl text-[13px] font-medium transition-all ${isDark ? "bg-white/[0.06] text-zinc-300 hover:bg-white/[0.1]" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"}`}>{isBn ? 'বাতিল' : 'Cancel'}</button>
          <button onClick={handleBatchGenerate} className={`px-4 py-2 rounded-xl text-[13px] font-medium transition-all ${isDark ? "bg-white text-black hover:bg-white/90" : "bg-zinc-900 text-white hover:bg-zinc-800"}`}>
            {isBn ? 'ব্যাচ তৈরি করুন' : 'Generate Batch'}
          </button>
        </ModalFooter>
      </Modal>

      {/* Certificate Detail Modal */}
      <Modal open={!!showDetailModal} onClose={() => setShowDetailModal(null)} title={isBn ? 'সার্টিফিকেট বিবরণ' : 'Certificate Details'} maxWidth="max-w-xl">
        {showDetailModal && (
          <div className="space-y-4">
            {[
              { label: isBn ? 'সার্টিফিকেট নম্বর' : 'Certificate Number', value: showDetailModal.certificateNumber },
              { label: isBn ? 'শিক্ষার্থী' : 'Student', value: showDetailModal.studentName },
              { label: isBn ? 'পরীক্ষা' : 'Exam', value: showDetailModal.examName },
              { label: isBn ? 'শ্রেণী' : 'Class', value: showDetailModal.className },
              { label: isBn ? 'পজিশন' : 'Position', value: `#${showDetailModal.position}` },
              { label: isBn ? 'মোট নম্বর' : 'Total Marks', value: String(showDetailModal.totalMarks) },
              { label: isBn ? 'পরীক্ষার বছর' : 'Exam Year', value: showDetailModal.examYear },
              { label: isBn ? 'প্রদানের তারিখ' : 'Issue Date', value: formatDate(showDetailModal.issueDate) },
              { label: isBn ? 'স্থিতি' : 'Status', value: showDetailModal.status },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between">
                <span className={`text-[11px] font-medium ${labelCls}`}>{item.label}</span>
                <span className={`text-[11px] ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>{item.value}</span>
              </div>
            ))}
          </div>
        )}
        <ModalFooter>
          <button onClick={() => setShowDetailModal(null)} className={`px-4 py-2 rounded-xl text-[13px] font-medium transition-all ${isDark ? "bg-white/[0.06] text-zinc-300 hover:bg-white/[0.1]" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"}`}>{isBn ? 'বন্ধ' : 'Close'}</button>
        </ModalFooter>
      </Modal>
    </div>
  );
}

function CertificatesSkeleton({ isDark }: { isDark: boolean }) {
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
        <div className={`${card} rounded-2xl h-12 mb-8`} />
        <div className={`${card} rounded-2xl h-64`} />
      </div>
    </div>
  );
}