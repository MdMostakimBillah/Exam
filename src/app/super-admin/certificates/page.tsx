"use client";
import { useState, useEffect, useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableCheckbox } from "@/components/ui/table-checkbox";
import { useTableSelection } from "@/hooks/use-table-selection";
import { PdfExportModal, type PdfColumn } from "@/components/ui/pdf-export-modal";
import { CertificatePreviewModal } from "@/components/certificate/certificate-preview-modal";
import { Pagination } from "@/components/ui/pagination";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { useCertificates, useUpdateCertificate } from "@/lib/storage/certificates";
import { useInstitutionName } from "@/lib/storage/institutions";
import { Award, Search, Download, QrCode, FileDown, Eye, XCircle, RotateCcw } from "lucide-react";
import { formatDate } from "@/lib/storage/storage";
import { useTheme } from "@/contexts/theme-context";
import { useLang } from "@/contexts/language-context";
import { Certificate } from "@/lib/types";

const PAGE_SIZE = 20;

export default function CertificatesPage() {
  const { theme } = useTheme();
  const { lang: language } = useLang();
  const { toast } = useToast();
  const isDark = theme === "dark";
  const isBn = language === "bn";
  // Institution names: stored Bangla value renders as name_en in English.
  const instName = useInstitutionName();
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [page, setPage] = useState(1);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [pdfScope, setPdfScope] = useState<"all" | "selected">("all");
  const [previewCert, setPreviewCert] = useState<Certificate | null>(null);

  const { data: certificates = [] } = useCertificates(undefined, 1, 1000);
  const updateCert = useUpdateCertificate();
  const years = useMemo(() => [...new Set(certificates.map(c => c.examYear))], [certificates]);
  const filtered = useMemo(() => certificates.filter(c => {
    const matchesSearch = c.studentName.toLowerCase().includes(search.toLowerCase()) || c.certificateNumber.toLowerCase().includes(search.toLowerCase()) ||
      instName(c.institutionName, c.institutionId).toLowerCase().includes(search.toLowerCase());
    const matchesYear = !yearFilter || c.examYear === yearFilter;
    return matchesSearch && matchesYear;
  }), [certificates, search, yearFilter, instName]);

  const selection = useTableSelection(filtered);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const pdfColumns: PdfColumn[] = useMemo(() => [
    { header: isBn ? 'সার্টিফিকেট নং' : 'Certificate No', key: "certificateNumber" },
    { header: isBn ? 'শিক্ষার্থী' : 'Student', key: "studentName" },
    { header: isBn ? 'প্রতিষ্ঠান' : 'Institution', key: "institutionName" },
    { header: isBn ? 'পরীক্ষা' : 'Exam', key: "examName" },
    { header: isBn ? 'অবস্থান' : 'Position', key: "position" },
    { header: isBn ? 'তারিখ' : 'Issue Date', key: "issueDate" },
    { header: isBn ? 'স্ট্যাটাস' : 'Status', key: "status" },
  ], [isBn]);

  // Toolbar "Export" → every filtered row; selection bar → just the selection.
  const exportRows = pdfScope === "selected"
    ? filtered.filter(c => selection.isSelected(c.id))
    : filtered;
  const pdfData = exportRows.map(c => ({
    certificateNumber: c.certificateNumber,
    studentName: c.studentName,
    institutionName: instName(c.institutionName, c.institutionId),
    examName: c.examName,
    position: `#${c.position}`,
    issueDate: formatDate(c.issueDate),
    status: c.status,
  }));

  const verifiedCount = useMemo(() => certificates.filter(c => c.status === 'VERIFIED').length, [certificates]);
  const currentYear = String(new Date().getFullYear());
  const thisYearCount = useMemo(
    () => certificates.filter(c => c.examYear === currentYear).length,
    [certificates, currentYear]
  );

  useEffect(() => { setMounted(true); }, []);

  const handleSearch = (value: string) => { setSearch(value); setPage(1); };
  const handleYear = (value: string) => { setYearFilter(value); setPage(1); };

  const handleStatus = async (cert: Certificate, status: "DRAFT" | "GENERATED") => {
    try {
      await updateCert.mutateAsync({ id: cert.id, data: { status } });
      toast("success", status === "DRAFT"
        ? (isBn ? "সার্টিফিকেট বাতিল করা হয়েছে" : "Certificate revoked")
        : (isBn ? "সার্টিফিকেট পুনঃসক্রিয় করা হয়েছে" : "Certificate re-issued"));
    } catch {
      toast("error", isBn ? "আপডেট ব্যর্থ হয়েছে" : "Update failed");
    }
  };

  if (!mounted) return <CertificatesSkeleton isDark={isDark} />;

  const card = isDark ? "bg-[#141416] border border-white/[0.06] rounded-md" : "bg-white border border-zinc-200 rounded-md shadow-sm";
  const iconBg = "bg-brand-accent-soft";
  const iconColor = "text-brand-accent";
  const thCls = `text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`;
  const actionBtn = "rounded p-1.5 transition-colors";

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0a0a0b]" : "bg-zinc-50"}`}>
      <div className="max-w-[1600px] mx-auto p-6 lg:p-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className={`text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-zinc-900"}`}>
            {isBn ? 'সার্টিফিকেট' : 'Certificates'}
          </h1>
          <p className={`text-sm mt-1 ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>
            {isBn ? 'প্রদত্ত সার্টিফিকেট দেখুন এবং পরিচালনা করুন' : 'View and manage issued certificates'}
          </p>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {[
            { label: isBn ? 'মোট সার্টিফিকেট' : 'Total Generated', value: certificates.length },
            { label: isBn ? 'যাচাইকৃত' : 'Verified', value: verifiedCount },
            { label: isBn ? 'এ বছর' : 'This Year', value: thisYearCount },
          ].map((s) => (
            <div key={s.label} className={`${card} px-4 py-3 flex items-center gap-3`}>
              <div className={`h-10 w-10 rounded-md flex items-center justify-center shrink-0 ${iconBg}`}>
                <Award className={`h-5 w-5 ${iconColor}`} />
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
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${isDark ? "text-zinc-500" : "text-zinc-400"}`} />
              <Input placeholder={isBn ? "শিক্ষার্থী বা সার্টিফিকেট নম্বর দিয়ে অনুসন্ধান..." : "Search by student or certificate number..."} value={search} onChange={(e) => handleSearch(e.target.value)}
                className={`pl-10 ${isDark ? "bg-white/[0.04] border-white/[0.06]" : "bg-zinc-50 border-zinc-200"}`} />
            </div>
            <Select options={[{ label: isBn ? 'সব বছর' : 'All Years', value: '' }, ...years.map(y => ({ label: y, value: y }))]} value={yearFilter} onChange={(e) => handleYear(e.target.value)}
              className={`w-full sm:w-36 ${isDark ? "bg-white/[0.04] border-white/[0.06]" : "bg-zinc-50 border-zinc-200"}`} />
            <button
              onClick={() => { setPdfScope("all"); setShowPdfModal(true); }}
              disabled={filtered.length === 0}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-[11px] font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none ${isDark ? "bg-white/[0.06] text-zinc-400 hover:text-white hover:bg-white/[0.1]" : "bg-zinc-100 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200"}`}
            >
              <Download className="h-3.5 w-3.5" /> {isBn ? 'এক্সপোর্ট' : 'Export'}
            </button>
          </div>
        </div>

        {/* Table */}
        <div className={`${card}`}>
          <div className={`px-5 py-4 border-b ${isDark ? "border-white/[0.06]" : "border-zinc-100"}`}>
            <div className="flex items-center gap-2">
              <Award className={`h-4 w-4 ${isDark ? "text-zinc-400" : "text-zinc-500"}`} />
              <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>{isBn ? 'সার্টিফিকেট তালিকা' : 'Certificates'}</h3>
              <span className={`text-[11px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>({filtered.length})</span>
            </div>
          </div>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className={`h-14 w-14 rounded-md flex items-center justify-center mb-4 ${isDark ? 'bg-white/[0.08]' : 'bg-zinc-100'}`}>
                <Award className={`h-7 w-7 ${iconColor}`} />
              </div>
              <p className={`text-sm font-medium ${isDark ? "text-white" : "text-zinc-900"}`}>{isBn ? 'কোনো সার্টিফিকেট পাওয়া যায়নি' : 'No certificates found'}</p>
            </div>
          ) : (
            <>
            <Table>
              <TableHeader>
                <TableRow className={isDark ? 'border-white/[0.04] hover:bg-transparent' : 'border-zinc-100 hover:bg-transparent'}>
                  <TableHead className="w-10">
                    <TableCheckbox checked={selection.allSelected} indeterminate={selection.someSelected} onChange={selection.toggleAll} />
                  </TableHead>
                  <TableHead className={thCls}>{isBn ? 'সার্টিফিকেট নং' : 'Certificate No'}</TableHead>
                  <TableHead className={thCls}>{isBn ? 'শিক্ষার্থী' : 'Student'}</TableHead>
                  <TableHead className={`hidden md:table-cell ${thCls}`}>{isBn ? 'প্রতিষ্ঠান' : 'Institution'}</TableHead>
                  <TableHead className={`hidden lg:table-cell ${thCls}`}>{isBn ? 'পরীক্ষা' : 'Exam'}</TableHead>
                  <TableHead className={thCls}>{isBn ? 'অবস্থান' : 'Position'}</TableHead>
                  <TableHead className={`hidden lg:table-cell ${thCls}`}>{isBn ? 'তারিখ' : 'Issue Date'}</TableHead>
                  <TableHead className={thCls}>{isBn ? 'স্ট্যাটাস' : 'Status'}</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map(cert => (
                  <TableRow key={cert.id} className={`${isDark ? 'border-white/[0.04]' : 'border-zinc-100'} ${selection.isSelected(cert.id) ? ('bg-brand-accent-soft') : ''}`}>
                    <TableCell className="w-10">
                      <TableCheckbox checked={selection.isSelected(cert.id)} onChange={() => selection.toggle(cert.id)} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <QrCode className={`h-4 w-4 ${isDark ? "text-zinc-500" : "text-zinc-400"}`} />
                        <span className={`text-[11px] font-mono ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>{cert.certificateNumber}</span>
                      </div>
                    </TableCell>
                    <TableCell className={`text-sm font-medium ${isDark ? "text-zinc-100" : "text-zinc-800"}`}>{cert.studentName}</TableCell>
                    <TableCell className={`text-[11px] hidden md:table-cell ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>{instName(cert.institutionName, cert.institutionId)}</TableCell>
                    <TableCell className={`text-[11px] hidden lg:table-cell ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>{cert.examName}</TableCell>
                    <TableCell>
                      <span className={`text-[11px] font-bold ${isDark ? "text-amber-400" : "text-amber-600"}`}>#{cert.position}</span>
                    </TableCell>
                    <TableCell className={`text-[11px] hidden lg:table-cell ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>{formatDate(cert.issueDate)}</TableCell>
                    <TableCell><Badge status={cert.status} /></TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setPreviewCert(cert)}
                          title={isBn ? 'প্রিভিউ' : 'Preview'}
                          aria-label={isBn ? 'সার্টিফিকেট প্রিভিউ' : 'Preview certificate'}
                          className={`${actionBtn} ${isDark ? 'text-zinc-400 hover:text-white hover:bg-white/[0.08]' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'}`}
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        {cert.status !== 'DRAFT' ? (
                          <button
                            onClick={() => handleStatus(cert, "DRAFT")}
                            title={isBn ? 'বাতিল করুন' : 'Revoke'}
                            aria-label={isBn ? 'সার্টিফিকেট বাতিল করুন' : 'Revoke certificate'}
                            className={`${actionBtn} ${isDark ? 'text-zinc-500 hover:text-red-400 hover:bg-red-500/10' : 'text-zinc-400 hover:text-red-600 hover:bg-red-50'}`}
                          >
                            <XCircle className="h-4 w-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleStatus(cert, "GENERATED")}
                            title={isBn ? 'পুনঃসক্রিয় করুন' : 'Re-issue'}
                            aria-label={isBn ? 'সার্টিফিকেট পুনঃসক্রিয় করুন' : 'Re-issue certificate'}
                            className={`${actionBtn} ${isDark ? 'text-zinc-500 hover:text-emerald-400 hover:bg-emerald-500/10' : 'text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50'}`}
                          >
                            <RotateCcw className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="px-5">
              <Pagination currentPage={safePage} totalPages={totalPages} onPageChange={setPage} />
            </div>
            </>
          )}
        </div>
      </div>

      {selection.selectedCount > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 animate-slideUp">
          <div className={`flex items-center gap-3 px-5 py-3 rounded-md shadow-2xl ${isDark ? 'bg-[#1a1a1c] border border-white/[0.1]' : 'bg-white border border-zinc-200'}`}>
            <span className={`text-[11px] font-medium ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
              {selection.selectedCount} {isBn ? 'টি নির্বাচিত' : 'selected'}
            </span>
            <button onClick={() => { setPdfScope("selected"); setShowPdfModal(true); }} className="flex items-center gap-2 px-4 py-2 rounded-md text-[11px] font-medium bg-brand-accent text-brand-accent-fg hover:opacity-90 transition-colors">
              <FileDown className="h-3.5 w-3.5" /> {isBn ? 'ডাউনলোড পিডিএফ' : 'Download PDF'}
            </button>
          </div>
        </div>
      )}

      <PdfExportModal open={showPdfModal} onClose={() => setShowPdfModal(false)} title={isBn ? 'সার্টিফিকেট তালিকা' : 'Certificates List'} columns={pdfColumns} data={pdfData} />
      <CertificatePreviewModal open={!!previewCert} onClose={() => setPreviewCert(null)} cert={previewCert} />
    </div>
  );
}

function CertificatesSkeleton({ isDark }: { isDark: boolean }) {
  const card = isDark ? "bg-[#141416] border border-white/[0.06]" : "bg-zinc-200 border border-zinc-300 shadow-sm";
  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0a0a0b]" : "bg-zinc-50"}`}>
      <div className="max-w-[1600px] mx-auto p-6 lg:p-8">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className={`${card} rounded-md h-[52px]`} />
          ))}
        </div>
        <div className={`${card} rounded-md h-12 mb-6`} />
        <div className={`${card} rounded-md h-64`} />
      </div>
    </div>
  );
}
