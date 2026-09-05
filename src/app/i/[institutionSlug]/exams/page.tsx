"use client";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Table, TableBody, TableCell, TableHeader, TableRow, TableHead } from "@/components/ui/table";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { getInstitutionBySlug } from "@/lib/storage/institutions";
import { getExams } from "@/lib/storage/exams";
import { getClasses } from "@/lib/storage/classes";
import { getRegistrationsByInstitution } from "@/lib/storage/registrations";
import { FileText, Calendar, Users, CreditCard, ArrowRight } from "lucide-react";
import Link from "next/link";
import { formatDate } from "@/lib/storage/storage";
import { useTheme } from "@/contexts/theme-context";
import { useLang } from "@/contexts/language-context";

export default function InstitutionExamsPage() {
  const params = useParams();
  const slug = params.institutionSlug as string;
  const { theme } = useTheme();
  const { lang: language, t } = useLang();
  const isDark = theme === "dark";
  const isBn = language === "bn";
  const [mounted, setMounted] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return <ExamsSkeleton isDark={isDark} />;

  const inst = getInstitutionBySlug(slug);
  if (!inst) return null;

  const exams = getExams();
  const classes = getClasses();
  const registrations = getRegistrationsByInstitution(inst.id);

  const filtered = exams.filter(e => {
    if (statusFilter && e.status !== statusFilter) return false;
    return true;
  });

  const card = isDark
    ? "bg-[#141416] border border-white/[0.06] rounded-2xl"
    : "bg-white border border-zinc-200 rounded-2xl shadow-sm";
  const iconBg = isDark ? "bg-white/[0.08]" : "bg-zinc-100";
  const iconColor = isDark ? "text-zinc-300" : "text-zinc-600";

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0a0a0b]" : "bg-zinc-50"}`}>
      <div className="max-w-[1600px] mx-auto p-6 lg:p-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className={`text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-zinc-900"}`}>
            {isBn ? 'পরীক্ষা' : 'Exams'}
          </h1>
          <p className={`text-sm mt-1 ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>
            {isBn ? 'উপলব্ধ পরীক্ষা দেখুন' : 'View available examinations'}
          </p>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: isBn ? 'উপলব্ধ পরীক্ষা' : 'Available Exams', value: exams.length },
            { label: isBn ? 'ওপেন' : 'Open', value: exams.filter(e => e.status === 'OPEN').length },
            { label: isBn ? 'প্রকাশিত' : 'Published', value: exams.filter(e => e.status === 'PUBLISHED').length },
            { label: isBn ? 'আমার নিবন্ধন' : 'My Registrations', value: registrations.length },
          ].map((s) => (
            <div key={s.label} className={`${card} px-4 py-3 flex items-center gap-3`}>
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
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
            <div className="flex-1">
              <label className={`block text-[11px] mb-1.5 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>{isBn ? 'স্ট্যাটাস' : 'Status'}</label>
              <Select
                options={[
                  { label: isBn ? 'সব স্ট্যাটাস' : 'All Status', value: '' },
                  { label: isBn ? 'ওপেন' : 'Open', value: 'OPEN' },
                  { label: isBn ? 'প্রকাশিত' : 'Published', value: 'PUBLISHED' },
                  { label: isBn ? 'বন্ধ' : 'Closed', value: 'CLOSED' },
                ]}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={isDark ? "bg-white/[0.04] border-white/[0.06]" : "bg-zinc-50 border-zinc-200"}
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className={`${card}`}>
          <div className={`px-5 py-4 border-b ${isDark ? "border-white/[0.06]" : "border-zinc-100"}`}>
            <div className="flex items-center gap-2">
              <FileText className={`h-4 w-4 ${isDark ? "text-zinc-400" : "text-zinc-500"}`} />
              <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>
                {isBn ? 'পরীক্ষার তালিকা' : 'Examinations'}
              </h3>
              <span className={`text-[11px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>({filtered.length})</span>
            </div>
          </div>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className={`h-14 w-14 rounded-2xl flex items-center justify-center mb-4 ${isDark ? 'bg-white/[0.08]' : 'bg-zinc-100'}`}>
                <FileText className={`h-7 w-7 ${iconColor}`} />
              </div>
              <p className={`text-sm font-medium ${isDark ? "text-white" : "text-zinc-900"}`}>{isBn ? 'কোনো পরীক্ষা পাওয়া যায়নি' : 'No exams available'}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className={isDark ? 'border-white/[0.04] hover:bg-transparent' : 'border-zinc-100 hover:bg-transparent'}>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'পরীক্ষা' : 'Exam'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider hidden md:table-cell ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'তারিখ' : 'Date'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider hidden lg:table-cell ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'নিবন্ধন' : 'Registrations'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider hidden lg:table-cell ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'ফি' : 'Fee'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'শ্রেণী' : 'Classes'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'স্ট্যাটাস' : 'Status'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'কার্য' : 'Actions'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(exam => {
                  const examRegs = registrations.filter(r => r.examId === exam.id);
                  const examClasses = classes.filter(c => exam.classes.includes(c.id));
                  return (
                    <TableRow key={exam.id} className={isDark ? 'border-white/[0.04]' : 'border-zinc-100'}>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <div className={`h-8 w-8 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 ${isDark ? 'bg-white/[0.08] text-zinc-300' : 'bg-zinc-100 text-zinc-600'}`}>
                            {exam.name.charAt(0)}
                          </div>
                          <div>
                            <p className={`text-sm font-medium ${isDark ? 'text-zinc-100' : 'text-zinc-800'}`}>{exam.name}</p>
                            <p className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>{exam.academicYear}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className={`text-[11px] hidden md:table-cell ${isDark ? 'text-zinc-300' : 'text-zinc-600'}`}>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(exam.examDate).split(',')[0]}
                        </div>
                      </TableCell>
                      <TableCell className={`text-[11px] hidden lg:table-cell ${isDark ? 'text-zinc-300' : 'text-zinc-600'}`}>
                        <div className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {examRegs.length}
                        </div>
                      </TableCell>
                      <TableCell className={`text-[11px] hidden lg:table-cell ${isDark ? 'text-zinc-300' : 'text-zinc-600'}`}>
                        <div className="flex items-center gap-1">
                          <CreditCard className="h-3 w-3" />
                          ৳{exam.registrationFee}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 flex-wrap">
                          {examClasses.slice(0, 2).map(cls => (
                            <span key={cls.id} className={`px-1.5 py-0.5 rounded text-[9px] ${isDark ? "bg-white/[0.08] text-zinc-300" : "bg-zinc-100 text-zinc-700"}`}>
                              {cls.name}
                            </span>
                          ))}
                          {examClasses.length > 2 && (
                            <span className={`px-1.5 py-0.5 rounded text-[9px] ${isDark ? "bg-white/[0.08] text-zinc-300" : "bg-zinc-100 text-zinc-700"}`}>
                              +{examClasses.length - 2}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell><Badge status={exam.status} /></TableCell>
                      <TableCell>
                        <Link href={`/i/${slug}/registrations`}>
                          <button className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${isDark ? "bg-white/[0.06] text-zinc-400 hover:text-white hover:bg-white/[0.1]" : "bg-zinc-100 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200"}`}>
                            {isBn ? 'নিবন্ধন' : 'Register'} <ArrowRight className="h-3 w-3" />
                          </button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </div>
  );
}

function ExamsSkeleton({ isDark }: { isDark: boolean }) {
  const card = isDark ? "bg-[#141416] border border-white/[0.06]" : "bg-white border border-zinc-200 shadow-sm";

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0a0a0b]" : "bg-zinc-50"}`}>
      <div className="max-w-[1600px] mx-auto p-6 lg:p-8">
        <div className="mb-8">
          <div className={`h-8 w-48 rounded-lg ${isDark ? 'bg-white/[0.06]' : 'bg-zinc-200'}`} />
          <div className={`h-4 w-64 rounded mt-2 ${isDark ? 'bg-white/[0.04]' : 'bg-zinc-200/60'}`} />
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
