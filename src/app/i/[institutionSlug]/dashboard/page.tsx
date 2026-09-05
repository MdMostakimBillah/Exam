"use client";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getInstitutionBySlug } from "@/lib/storage/institutions";
import { getStudentsByInstitution } from "@/lib/storage/students";
import { getRegistrationsByInstitution } from "@/lib/storage/registrations";
import { getExams } from "@/lib/storage/exams";
import { getResultsByInstitution } from "@/lib/storage/results";
import { getPaymentsByInstitution } from "@/lib/storage/payments";
import { Users, FileText, ClipboardList, Clock, CheckCircle, XCircle, DollarSign, Wallet, Activity, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useTheme } from "@/contexts/theme-context";
import { useLang } from "@/contexts/language-context";

export default function InstitutionDashboardPage() {
  const params = useParams();
  const slug = params.institutionSlug as string;
  const [mounted, setMounted] = useState(false);
  const { theme } = useTheme();
  const { lang: language, t } = useLang();

  useEffect(() => { setMounted(true); }, []);

  const isDark = theme === "dark";
  const isBn = language === "bn";

  if (!mounted) return <DashboardSkeleton isDark={isDark} />;

  const inst = getInstitutionBySlug(slug);
  if (!inst) return null;

  const students = getStudentsByInstitution(inst.id);
  const registrations = getRegistrationsByInstitution(inst.id);
  const exams = getExams();
  const results = getResultsByInstitution(inst.id);
  const payments = getPaymentsByInstitution(inst.id);

  const totalCollected = payments.reduce((sum, p) => sum + (p.status === 'PAID' ? p.amount : 0), 0);
  const totalDue = payments.reduce((sum, p) => sum + (p.status === 'PENDING' ? p.amount : 0), 0);
  const pendingStudents = registrations.filter(r => r.status === 'PENDING').length;
  const approvedStudents = registrations.filter(r => r.status === 'APPROVED' || r.status === 'VERIFIED').length;
  const rejectedStudents = registrations.filter(r => r.status === 'REJECTED').length;
  const activeExams = exams.filter(e => e.status === 'OPEN' || e.status === 'PUBLISHED').length;

  const card = isDark ? "bg-[#141416] border border-white/[0.06] rounded-2xl" : "bg-white border border-zinc-200 rounded-2xl shadow-sm";
  const iconBg = isDark ? "bg-white/[0.08]" : "bg-zinc-100";
  const iconColor = isDark ? "text-zinc-300" : "text-zinc-600";

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0a0a0b]" : "bg-zinc-50"}`}>
      <div className="max-w-[1600px] mx-auto p-6 lg:p-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <h1 className={`text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-zinc-900"}`}>
              {isBn ? 'প্রতিষ্ঠান ড্যাশবোর্ড' : 'Institution Dashboard'}
            </h1>
            <Badge status={inst.status} />
          </div>
          <p className={`text-sm mt-1 ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>
            {isBn ? 'আপনার প্রতিষ্ঠানের পরিসংখ্যান এবং পরিচালনা' : 'Overview and management of your institution'}
          </p>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { icon: Users, label: isBn ? 'মোট শিক্ষার্থী' : 'Total Students', value: students.length },
            { icon: Activity, label: isBn ? 'সক্রিয় পরীক্ষা' : 'Active Exams', value: activeExams },
            { icon: Clock, label: isBn ? 'আবেদন প্রতীক্ষা' : 'Pending Applications', value: pendingStudents },
            { icon: CheckCircle, label: isBn ? 'অনুমোদিত' : 'Approved', value: approvedStudents },
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

        {/* Revenue Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {[
            { icon: DollarSign, label: isBn ? 'সংগ্রহিত' : 'Total Collected', value: `৳${totalCollected.toLocaleString()}` },
            { icon: Wallet, label: isBn ? 'বকেয়া' : 'Total Due', value: `৳${totalDue.toLocaleString()}` },
            { icon: XCircle, label: isBn ? 'প্রত্যাখ্যান' : 'Rejected', value: rejectedStudents },
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

        {/* Content Grid */}
        <div className="grid grid-cols-12 gap-6">
          {/* Available Exams */}
          <div className="col-span-12 lg:col-span-8">
            <div className={`${card}`}>
              <div className={`px-5 py-4 border-b ${isDark ? "border-white/[0.06]" : "border-zinc-100"}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className={`h-4 w-4 ${isDark ? "text-zinc-400" : "text-zinc-500"}`} />
                    <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>
                      {isBn ? 'উপলব্ধ পরীক্ষা' : 'Available Exams'}
                    </h3>
                  </div>
                  <Link href={`/i/${slug}/exams`} className={`text-[11px] font-medium transition-colors ${isDark ? 'text-zinc-500 hover:text-zinc-300' : 'text-zinc-400 hover:text-zinc-600'}`}>
                    {isBn ? 'সব দেখুন' : 'View all'} <ArrowRight className="h-3 w-3 inline ml-0.5" />
                  </Link>
                </div>
              </div>
              {exams.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className={`h-14 w-14 rounded-2xl flex items-center justify-center mb-4 ${isDark ? 'bg-white/[0.08]' : 'bg-zinc-100'}`}>
                    <FileText className={`h-7 w-7 ${iconColor}`} />
                  </div>
                  <p className={`text-sm font-medium ${isDark ? "text-white" : "text-zinc-900"}`}>{isBn ? 'কোনো পরীক্ষা নেই' : 'No exams available'}</p>
                </div>
              ) : (
                <div className={`divide-y ${isDark ? 'divide-white/[0.04]' : 'divide-zinc-100'}`}>
                  {exams.slice(0, 5).map(exam => (
                    <div key={exam.id} className={`flex items-center justify-between px-5 py-3 transition-colors ${isDark ? "hover:bg-white/[0.02]" : "hover:bg-zinc-50/50"}`}>
                      <div className="flex items-center gap-3">
                        <div className={`h-9 w-9 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 ${isDark ? 'bg-white/[0.08] text-zinc-400' : 'bg-zinc-100 text-zinc-500'}`}>
                          {exam.name.charAt(0)}
                        </div>
                        <div>
                          <p className={`text-sm font-medium ${isDark ? "text-zinc-200" : "text-zinc-700"}`}>{exam.name}</p>
                          <p className={`text-[11px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>{exam.code} · {exam.academicYear}</p>
                        </div>
                      </div>
                      <Badge status={exam.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT'} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Registration Stats */}
          <div className="col-span-12 lg:col-span-4">
            <div className={`${card} h-full`}>
              <div className={`px-5 py-4 border-b ${isDark ? "border-white/[0.06]" : "border-zinc-100"}`}>
                <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>
                  {isBn ? 'নিবন্ধন পরিসংখ্যান' : 'Registration Stats'}
                </h3>
              </div>
              <div className="p-5 space-y-4">
                {[
                  { label: isBn ? 'বিচারাধীন' : 'Pending', value: pendingStudents, icon: Clock },
                  { label: isBn ? 'অনুমোদিত' : 'Approved', value: approvedStudents, icon: CheckCircle },
                  { label: isBn ? 'প্রত্যাখ্যান' : 'Rejected', value: rejectedStudents, icon: XCircle },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <item.icon className={`h-4 w-4 ${isDark ? "text-zinc-500" : "text-zinc-400"}`} />
                      <span className={`text-[11px] ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>{item.label}</span>
                    </div>
                    <span className={`text-sm font-bold ${isDark ? "text-white" : "text-zinc-900"}`}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Recent Students */}
        <div className={`${card} mt-6`}>
          <div className={`px-5 py-4 border-b ${isDark ? "border-white/[0.06]" : "border-zinc-100"}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className={`h-4 w-4 ${isDark ? "text-zinc-400" : "text-zinc-500"}`} />
                <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>
                  {isBn ? 'সাম্প্রতিক শিক্ষার্থী' : 'Recent Students'}
                </h3>
              </div>
              <Link href={`/i/${slug}/students`} className={`text-[11px] font-medium transition-colors ${isDark ? 'text-zinc-500 hover:text-zinc-300' : 'text-zinc-400 hover:text-zinc-600'}`}>
                {isBn ? 'সব দেখুন' : 'View all'} <ArrowRight className="h-3 w-3 inline ml-0.5" />
              </Link>
            </div>
          </div>
          {students.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className={`h-14 w-14 rounded-2xl flex items-center justify-center mb-4 ${isDark ? 'bg-white/[0.08]' : 'bg-zinc-100'}`}>
                <Users className={`h-7 w-7 ${iconColor}`} />
              </div>
              <p className={`text-sm font-medium ${isDark ? "text-white" : "text-zinc-900"}`}>{isBn ? 'কোনো শিক্ষার্থী নেই' : 'No students yet'}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className={isDark ? 'border-white/[0.04] hover:bg-transparent' : 'border-zinc-100 hover:bg-transparent'}>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'নাম' : 'Name'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'আইডি' : 'Student ID'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider hidden md:table-cell ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'শ্রেণী' : 'Class'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'স্থিতি' : 'Status'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.slice(0, 5).map(s => (
                  <TableRow key={s.id} className={isDark ? 'border-white/[0.04]' : 'border-zinc-100'}>
                    <TableCell className={`text-sm font-medium ${isDark ? "text-zinc-100" : "text-zinc-800"}`}>{s.firstName} {s.lastName}</TableCell>
                    <TableCell className={`text-[11px] font-mono ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>{s.studentId}</TableCell>
                    <TableCell className={`text-[11px] hidden md:table-cell ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>{s.class}</TableCell>
                    <TableCell><Badge status={s.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </div>
  );
}

function DashboardSkeleton({ isDark }: { isDark: boolean }) {
  const card = isDark ? "bg-[#141416] border border-white/[0.06]" : "bg-white border border-zinc-200 shadow-sm";
  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0a0a0b]" : "bg-zinc-50"}`}>
      <div className="max-w-[1600px] mx-auto p-6 lg:p-8">
        <div className="mb-8">
          <div className={`h-8 w-48 rounded-lg ${isDark ? 'bg-white/[0.06]' : 'bg-zinc-200'}`} />
          <div className={`h-4 w-64 rounded mt-2 ${isDark ? 'bg-white/[0.04]' : 'bg-zinc-200/60'}`} />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className={`${card} rounded-2xl h-[52px]`} />
          ))}
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className={`${card} rounded-2xl h-[52px]`} />
          ))}
        </div>
        <div className={`${card} rounded-2xl h-64`} />
      </div>
    </div>
  );
}
