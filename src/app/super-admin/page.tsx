"use client";
import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { getInstitutions } from "@/lib/storage/institutions";
import { getStudents } from "@/lib/storage/students";
import { getExams } from "@/lib/storage/exams";
import { getRegistrations } from "@/lib/storage/registrations";
import { getResults } from "@/lib/storage/results";
import { getPayments } from "@/lib/storage/payments";
import { Building2, Users, FileText, DollarSign, ArrowRight, TrendingUp, GraduationCap, CheckCircle, ChevronRight } from "lucide-react";
import { useTheme } from "@/contexts/theme-context";
import { useLang } from "@/contexts/language-context";
import Link from "next/link";

export default function SuperAdminDashboard() {
  const [mounted, setMounted] = useState(false);
  const { theme } = useTheme();
  const { lang: language, t } = useLang();

  useEffect(() => { setMounted(true); }, []);

  const isDark = theme === "dark";
  const isBn = language === "bn";

  if (!mounted) return <DashboardSkeleton isDark={isDark} />;

  const institutions = getInstitutions();
  const students = getStudents();
  const exams = getExams();
  const registrations = getRegistrations();
  const results = getResults();
  const payments = getPayments();

  const totalRevenue = payments.reduce((sum, p) => sum + (p.status === 'PAID' ? p.amount : 0), 0);
  const totalDue = payments.reduce((sum, p) => sum + (p.status === 'PENDING' ? p.amount : 0), 0);
  const activeExams = exams.filter(e => e.status === 'OPEN' || e.status === 'PUBLISHED').length;
  const pendingInstitutions = institutions.filter(i => i.status === 'PENDING').length;
  const verifiedRegs = registrations.filter(r => r.status === 'VERIFIED' || r.status === 'APPROVED').length;
  const approvedStudents = registrations.filter(r => r.status === 'APPROVED').length;

  const card = isDark
    ? "bg-[#141416] border border-white/[0.06] rounded-2xl"
    : "bg-white border border-zinc-200 rounded-2xl shadow-sm";
  const cardHover = isDark
    ? "hover:border-white/[0.1] transition-colors"
    : "hover:border-zinc-300 transition-colors";
  const iconBg = isDark ? "bg-white/[0.06]" : "bg-zinc-100";
  const iconColor = isDark ? "text-white" : "text-zinc-900";

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0a0a0b]" : "bg-zinc-50"}`}>
      <div className="p-6 lg:p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className={`text-2xl lg:text-3xl font-bold tracking-tight ${isDark ? "text-white" : "text-zinc-900"}`}>
            {isBn ? 'সুপার এডমিনে স্বাগতম' : 'Welcome to Superadmin'}
          </h1>
          <p className={`text-sm mt-1.5 ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>
            {isBn ? 'বাংলাদেশ মাদ্রাসা এসোসিয়েশন পরিচালনা করুন' : 'Manage Bangladesh Education Society operations'}
          </p>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { icon: Building2, label: isBn ? 'মোট প্রতিষ্ঠান' : 'Total Institutions', value: institutions.length, href: '/super-admin/institutions' },
            { icon: Users, label: isBn ? 'মোট শিক্ষার্থী' : 'Total Students', value: students.length, href: '/super-admin/students' },
            { icon: FileText, label: isBn ? 'সক্রিয় পরীক্ষা' : 'Active Exams', value: activeExams, href: '/super-admin/exams' },
            { icon: GraduationCap, label: isBn ? 'ফলাফল' : 'Results Published', value: results.length, href: '/super-admin/results' },
          ].map((s) => (
            <Link key={s.label} href={s.href} className="block">
              <div className={`${card} ${cardHover} px-4 py-3 flex items-center gap-3`}>
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
                  <s.icon className={`h-5 w-5 ${iconColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-lg font-bold tracking-tight leading-tight ${isDark ? "text-white" : "text-zinc-900"}`}>{s.value}</p>
                  <p className={`text-[11px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>{s.label}</p>
                </div>
                <ArrowRight className={`h-4 w-4 shrink-0 ${isDark ? 'text-zinc-600' : 'text-zinc-300'}`} />
              </div>
            </Link>
          ))}
        </div>

        {/* Revenue Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { icon: TrendingUp, label: isBn ? 'মোট আয়' : 'Total Revenue', value: '৳' + totalRevenue.toLocaleString() },
            { icon: DollarSign, label: isBn ? 'বকেয়া' : 'Total Due', value: '৳' + totalDue.toLocaleString() },
            { icon: Users, label: isBn ? 'নিবন্ধিত' : 'Registered', value: registrations.length },
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

        {/* Institutions Overview */}
        <div className={`${card}`}>
          <div className={`p-5 border-b ${isDark ? "border-white/[0.06]" : "border-zinc-100"}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className={`h-4 w-4 ${isDark ? "text-zinc-500" : "text-zinc-400"}`} />
                <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>
                  {isBn ? 'প্রতিষ্ঠান তালিকা' : 'Institutions Overview'}
                </h3>
              </div>
              <Link href="/super-admin/institutions" className={`text-xs font-medium transition-colors ${isDark ? 'text-zinc-500 hover:text-zinc-300' : 'text-zinc-400 hover:text-zinc-600'}`}>
                {isBn ? 'সব দেখুন' : 'View all'} <ArrowRight className="h-3 w-3 inline ml-0.5" />
              </Link>
            </div>
          </div>
          <div className="p-4 space-y-3">
            {institutions.slice(0, 8).map((inst) => {
              const instRegs = registrations.filter(r => r.institutionId === inst.id);
              const instApproved = instRegs.filter(r => r.status === 'APPROVED').length;
              const instPending = instRegs.filter(r => r.status === 'PENDING').length;
              const total = inst.totalStudents || 1;
              const approvedPct = Math.round((instApproved / total) * 100);
              const pendingPct = Math.round((instPending / total) * 100);

              return (
                <div key={inst.id} className={`flex items-center gap-4 p-3 rounded-xl transition-colors ${isDark ? "hover:bg-white/[0.03]" : "hover:bg-zinc-50"}`}>
                  {/* Institution Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className={`text-sm font-medium truncate ${isDark ? "text-zinc-200" : "text-zinc-700"}`}>{inst.name}</p>
                      <Badge status={inst.status} />
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`text-[11px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
                        {isBn ? 'মোট' : 'Total'}: <span className={`font-semibold ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>{inst.totalStudents}</span>
                      </span>
                      <span className={`text-[11px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
                        {isBn ? 'অনুমোদিত' : 'Approved'}: <span className={`font-semibold ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>{instApproved}</span>
                      </span>
                      <span className={`text-[11px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
                        {isBn ? 'বাকি' : 'Pending'}: <span className={`font-semibold ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>{instPending}</span>
                      </span>
                    </div>
                  </div>

                  {/* Mini Bar Graph */}
                  <div className="flex items-end gap-1 h-8 shrink-0">
                    <div className="w-5 rounded-t-sm relative" style={{ height: `${Math.max(approvedPct, 5)}%` }}>
                      <div className={`absolute inset-0 rounded-t-sm ${isDark ? "bg-white/40" : "bg-zinc-900/40"}`} />
                    </div>
                    <div className="w-5 rounded-t-sm relative" style={{ height: `${Math.max(pendingPct, 5)}%` }}>
                      <div className={`absolute inset-0 rounded-t-sm ${isDark ? "bg-white/20" : "bg-zinc-400/40"}`} />
                    </div>
                  </div>

                  <ChevronRight className={`h-4 w-4 shrink-0 ${isDark ? "text-zinc-600" : "text-zinc-300"}`} />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function DashboardSkeleton({ isDark }: { isDark: boolean }) {
  const shimmer = isDark ? "bg-white/[0.04]" : "bg-zinc-200/60";
  const card = isDark ? "bg-[#141416] border border-white/[0.06]" : "bg-white border border-zinc-200 shadow-sm";

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0a0a0b]" : "bg-zinc-50"}`}>
      <div className="p-6 lg:p-8">
        <div className={`h-8 w-48 rounded-lg mb-8 ${shimmer}`} />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className={`${card} rounded-2xl h-[52px]`} />
          ))}
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className={`${card} rounded-2xl h-[52px]`} />
          ))}
        </div>
        <div className={`${card} rounded-2xl h-64`} />
      </div>
    </div>
  );
}
