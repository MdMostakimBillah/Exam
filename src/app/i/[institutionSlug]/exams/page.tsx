"use client";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { useInstitutionBySlug } from "@/lib/storage/institutions";
import { useExams } from "@/lib/storage/exams";
import { useClasses } from "@/lib/storage/classes";
import { Exam } from "@/lib/types";
import { FileText, Search, Calendar, CreditCard, FileDown } from "lucide-react";
import { PdfExportModal, type PdfColumn } from "@/components/ui/pdf-export-modal";
import { formatDate } from "@/lib/storage/storage";
import { useTheme } from "@/contexts/theme-context";
import { useLang } from "@/contexts/language-context";
import { cn } from "@/lib/utils/helpers";

export default function InstitutionExamsPage() {
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
  const [showPdfModal, setShowPdfModal] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const { data: inst } = useInstitutionBySlug(slug);
  const { data: exams = [] } = useExams();
  const { data: allClasses = [] } = useClasses();

  const filtered = exams.filter(e => {
    const matchesSearch = e.name.toLowerCase().includes(search.toLowerCase()) || e.code.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = !statusFilter || e.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const pdfColumns: PdfColumn[] = [
    { header: isBn ? 'পরীক্ষা' : 'Exam', key: 'name' },
    { header: isBn ? 'কোড' : 'Code', key: 'code' },
    { header: isBn ? 'বছর' : 'Year', key: 'academicYear' },
    { header: isBn ? 'তারিখ' : 'Date', key: 'examDate' },
    { header: isBn ? 'ফি' : 'Fee', key: 'registrationFee' },
    { header: isBn ? 'স্ট্যাটাস' : 'Status', key: 'status' },
  ];

  const pdfData = filtered.map(e => ({
    name: e.name,
    code: e.code,
    academicYear: e.academicYear,
    examDate: formatDate(e.examDate).split(',')[0],
    registrationFee: `৳${e.registrationFee}`,
    status: e.status,
  }));

  const openCount = exams.filter(e => e.status === 'OPEN').length;
  const closedCount = exams.filter(e => e.status === 'CLOSED').length;
  const publishedCount = exams.filter(e => e.status === 'PUBLISHED').length;
  const draftCount = exams.filter(e => e.status === 'DRAFT').length;

  if (!mounted) return <ExamsSkeleton isDark={isDark} />;
  if (!inst) return null;

  const card = isDark
    ? "bg-[#141416] border border-white/[0.06] rounded-md"
    : "bg-white border border-zinc-200 rounded-md shadow-sm";
  const iconBg = isDark ? "bg-white/[0.08]" : "bg-zinc-100";
  const iconColor = isDark ? "text-zinc-300" : "text-zinc-600";
  const inputCls = isDark ? "bg-white/[0.04] border-white/[0.08] text-white placeholder:text-zinc-600" : "bg-zinc-50 border-zinc-200 text-zinc-900 placeholder:text-zinc-400";

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0a0a0b]" : "bg-zinc-50"}`}>
      <div className="max-w-[1600px] mx-auto p-6 lg:p-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className={`text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-zinc-900"}`}>
            {isBn ? 'পরীক্ষা' : 'Exams'}
          </h1>
          <p className={`text-sm mt-1 ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>
            {isBn ? 'সমস্ত পরীক্ষা দেখুন' : 'View all examinations'}
          </p>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: isBn ? 'মোট পরীক্ষা' : 'Total Exams', value: exams.length },
            { label: isBn ? 'ড্রাফট' : 'Draft', value: draftCount },
            { label: isBn ? 'ওপেন' : 'Open', value: openCount },
            { label: isBn ? 'প্রকাশিত' : 'Published', value: publishedCount },
          ].map((s) => (
            <div key={s.label} className={`${card} px-4 py-3 flex items-center gap-3`}>
              <div className={`h-10 w-10 rounded-md flex items-center justify-center shrink-0 ${iconBg}`}>
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
        <div className={`${card} p-4 mb-8`}>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${isDark ? "text-zinc-600" : "text-zinc-400"}`} />
              <Input placeholder={isBn ? "নাম বা কোড দিয়ে অনুসন্ধান..." : "Search by name or code..."} value={search} onChange={(e) => setSearch(e.target.value)} className={cn("pl-10", inputCls)} />
            </div>
            <Select
              options={[
                { label: isBn ? `সব (${exams.length})` : `All (${exams.length})`, value: '' },
                { label: isBn ? `ড্রাফট (${draftCount})` : `Draft (${draftCount})`, value: 'DRAFT' },
                { label: isBn ? `ওপেন (${openCount})` : `Open (${openCount})`, value: 'OPEN' },
                { label: isBn ? `বন্ধ (${closedCount})` : `Closed (${closedCount})`, value: 'CLOSED' },
                { label: isBn ? `প্রকাশিত (${publishedCount})` : `Published (${publishedCount})`, value: 'PUBLISHED' },
              ]}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={cn("w-full sm:w-40", inputCls)}
            />
          </div>
        </div>

        {/* Table */}
        <div className={`${card}`}>
          <div className={`px-5 py-4 border-b ${isDark ? "border-white/[0.06]" : "border-zinc-100"}`}>
            <div className="flex items-center gap-2">
              <FileText className={`h-4 w-4 ${isDark ? "text-zinc-400" : "text-zinc-500"}`} />
              <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>{isBn ? 'পরীক্ষার তালিকা' : 'Examinations'}</h3>
              <span className={`text-[11px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>({filtered.length})</span>
            </div>
          </div>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className={`h-14 w-14 rounded-md flex items-center justify-center mb-4 ${isDark ? 'bg-white/[0.08]' : 'bg-zinc-100'}`}>
                <FileText className={`h-7 w-7 ${iconColor}`} />
              </div>
              <p className={`text-sm font-medium ${isDark ? "text-white" : "text-zinc-900"}`}>{isBn ? 'কোনো পরীক্ষা পাওয়া যায়নি' : 'No exams found'}</p>
              <p className={`text-xs mt-1 ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>{isBn ? 'নতুন পরীক্ষা যোগ করুন' : 'Add a new exam to get started'}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className={isDark ? 'border-white/[0.04] hover:bg-transparent' : 'border-zinc-100 hover:bg-transparent'}>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'পরীক্ষা' : 'Exam'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'কোড' : 'Code'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider hidden md:table-cell ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'বছর' : 'Year'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider hidden lg:table-cell ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'তারিখ' : 'Date'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider hidden lg:table-cell ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'ফি' : 'Fee'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'স্ট্যাটাস' : 'Status'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(exam => (
                  <TableRow key={exam.id} className={`${isDark ? 'border-white/[0.04] hover:bg-white/[0.02]' : 'border-zinc-100 hover:bg-zinc-50/50'}`}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <div className={`h-8 w-8 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0 ${isDark ? 'bg-white/[0.08] text-zinc-300' : 'bg-zinc-100 text-zinc-600'}`}>
                          {exam.name.charAt(0)}
                        </div>
                        <div>
                          <p className={`text-sm font-medium ${isDark ? "text-zinc-100" : "text-zinc-800"}`}>{exam.name}</p>
                          <p className={`text-[10px] ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>{exam.subjects?.length || 0} {isBn ? 'বিষয়' : 'subjects'}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className={`text-[11px] font-mono ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>{exam.code}</TableCell>
                    <TableCell className={`text-[11px] hidden md:table-cell ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>{exam.academicYear}</TableCell>
                    <TableCell className={`text-[11px] hidden lg:table-cell ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(exam.examDate).split(',')[0]}
                      </div>
                    </TableCell>
                    <TableCell className={`text-[11px] hidden lg:table-cell ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>
                      <div className="flex items-center gap-1">
                        <CreditCard className="h-3 w-3" />
                        ৳{exam.registrationFee}
                      </div>
                    </TableCell>
                    <TableCell><Badge status={exam.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {/* Floating PDF Download Button */}
      <button
        onClick={() => setShowPdfModal(true)}
        className={`fixed bottom-6 right-6 h-12 w-12 rounded-full flex items-center justify-center shadow-lg transition-colors ${
          isDark ? "bg-white text-black hover:bg-zinc-200" : "bg-zinc-900 text-white hover:bg-zinc-800"
        }`}
      >
        <FileDown className="h-5 w-5" />
      </button>

      <PdfExportModal open={showPdfModal} onClose={() => setShowPdfModal(false)} title={isBn ? 'পরীক্ষার তালিকা' : 'Exam List'} columns={pdfColumns} data={pdfData} />
    </div>
  );
}

function ExamsSkeleton({ isDark }: { isDark: boolean }) {
  const card = isDark ? "bg-[#141416] border border-white/[0.06]" : "bg-white border border-zinc-200 shadow-sm";
  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0a0a0b]" : "bg-zinc-50"}`}>
      <div className="max-w-[1600px] mx-auto p-6 lg:p-8">
        <div className="mb-8">
          <div className={`h-8 w-48 rounded-md ${isDark ? 'bg-white/[0.06]' : 'bg-zinc-200'}`} />
          <div className={`h-4 w-64 rounded mt-2 ${isDark ? 'bg-white/[0.04]' : 'bg-zinc-200/60'}`} />
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
