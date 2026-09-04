"use client";
import { useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { getInstitutions } from "@/lib/storage/institutions";
import { getStudents } from "@/lib/storage/students";
import { getExams } from "@/lib/storage/exams";
import { getRegistrations } from "@/lib/storage/registrations";
import { getResults } from "@/lib/storage/results";
import { getPayments } from "@/lib/storage/payments";
import { getAuditLogs } from "@/lib/storage/audit-logs";
import { Building2, Users, FileText, CheckCircle, DollarSign, ChevronRight, ArrowRight, TrendingUp, Activity, GraduationCap } from "lucide-react";
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
  const logs = getAuditLogs();

  const totalRevenue = payments.reduce((sum, p) => sum + (p.status === 'PAID' ? p.amount : 0), 0);
  const totalDue = payments.reduce((sum, p) => sum + (p.status === 'PENDING' ? p.amount : 0), 0);
  const activeExams = exams.filter(e => e.status === 'OPEN' || e.status === 'PUBLISHED').length;
  const pendingInstitutions = institutions.filter(i => i.status === 'PENDING').length;
  const verifiedRegs = registrations.filter(r => r.status === 'VERIFIED' || r.status === 'APPROVED').length;
  const pendingStudents = registrations.filter(r => r.status === 'PENDING').length;
  const approvedStudents = registrations.filter(r => r.status === 'APPROVED').length;

  const card = isDark
    ? "bg-[#141416] border border-white/[0.06] rounded-2xl"
    : "bg-white border border-zinc-200 rounded-2xl shadow-sm";
  const cardHover = isDark
    ? "hover:border-white/[0.1] transition-colors"
    : "hover:border-zinc-300 transition-colors";
  const iconBg = isDark ? "bg-white/[0.06]" : "bg-zinc-100";
  const iconColor = isDark ? "text-white" : "text-zinc-900";

  const pendingActions = [
    ...(pendingInstitutions > 0 ? [{ icon: Building2, label: isBn ? 'প্রতিষ্ঠান অনুমোদন' : 'Institution Approval', count: pendingInstitutions, href: '/super-admin/institutions' }] : []),
    ...(pendingStudents > 0 ? [{ icon: Users, label: isBn ? 'শিক্ষার্থী নিবন্ধন' : 'Student Registration', count: pendingStudents, href: '/super-admin/registrations' }] : []),
    ...(totalDue > 0 ? [{ icon: DollarSign, label: isBn ? 'বকেয়া পেমেন্ট' : 'Pending Payments', count: '৳' + totalDue.toLocaleString(), href: '/super-admin/payments' }] : []),
  ];

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0a0a0b]" : "bg-zinc-50"}`}>
      <div className="p-6 lg:p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className={`text-2xl lg:text-3xl font-bold tracking-tight ${isDark ? "text-white" : "text-zinc-900"}`}>
            {isBn ? 'ড্যাশবোর্ড' : 'Dashboard'}
          </h1>
          <p className={`text-sm mt-1.5 ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>
            {isBn ? 'বাংলাদেশ মাদ্রাসা এসোসিয়েশন পরিচালনা করুন' : 'Manage Bangladesh Education Society operations'}
          </p>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { icon: Building2, label: isBn ? 'মোট প্রতিষ্ঠান' : 'Total Institutions', value: institutions.length, sub: `${pendingInstitutions} ${isBn ? 'বাকি' : 'pending'}`, href: '/super-admin/institutions' },
            { icon: Users, label: isBn ? 'মোট শিক্ষার্থী' : 'Total Students', value: students.length, sub: `${approvedStudents} ${isBn ? 'অনুমোদিত' : 'approved'}`, href: '/super-admin/students' },
            { icon: FileText, label: isBn ? 'সক্রিয় পরীক্ষা' : 'Active Exams', value: activeExams, sub: `${exams.length} ${isBn ? 'মোট' : 'total'}`, href: '/super-admin/exams' },
            { icon: GraduationCap, label: isBn ? 'ফলাফল' : 'Results Published', value: results.length, sub: `${verifiedRegs} ${isBn ? 'যাচাইকৃত' : 'verified'}`, href: '/super-admin/results' },
          ].map((s) => (
            <Link key={s.label} href={s.href} className="block">
              <div className={`${card} ${cardHover} px-3 py-2.5 flex items-center gap-2.5`}>
                <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
                  <s.icon className={`h-4 w-4 ${iconColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-base font-bold tracking-tight leading-tight ${isDark ? "text-white" : "text-zinc-900"}`}>{s.value}</p>
                  <p className={`text-[10px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>{s.label}</p>
                </div>
                <ArrowRight className={`h-3 w-3 shrink-0 ${isDark ? 'text-zinc-600' : 'text-zinc-300'}`} />
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
            <div key={s.label} className={`${card} px-3 py-2.5 flex items-center gap-2.5`}>
              <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
                <s.icon className={`h-4 w-4 ${iconColor}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-base font-bold tracking-tight leading-tight ${isDark ? "text-white" : "text-zinc-900"}`}>{s.value}</p>
                <p className={`text-[10px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Pending Actions + Activity */}
        <div className="grid grid-cols-12 gap-6 mb-6">
          {/* Pending Actions */}
          <div className="col-span-12 lg:col-span-4">
            <div className={`${card} h-full`}>
              <div className={`p-5 border-b ${isDark ? "border-white/[0.06]" : "border-zinc-100"}`}>
                <div className="flex items-center justify-between">
                  <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>
                    {isBn ? 'অপেক্ষমাণ কার্য' : 'Pending Actions'}
                  </h3>
                  {pendingActions.length > 0 && (
                    <span className={`h-5 min-w-[20px] px-1.5 rounded-full flex items-center justify-center text-[10px] font-bold ${isDark ? "bg-white/10 text-white" : "bg-zinc-900 text-white"}`}>
                      {pendingActions.length}
                    </span>
                  )}
                </div>
              </div>
              <div className="p-4">
                {pendingActions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10">
                    <div className={`h-14 w-14 rounded-2xl flex items-center justify-center mb-4 ${isDark ? 'bg-white/[0.06]' : 'bg-zinc-100'}`}>
                      <CheckCircle className={`h-7 w-7 ${iconColor}`} />
                    </div>
                    <p className={`text-sm font-medium ${isDark ? "text-white" : "text-zinc-900"}`}>{isBn ? 'সব আপ টু ডেট' : 'All caught up'}</p>
                    <p className={`text-xs mt-1 ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>{isBn ? 'কোনো অপেক্ষমাণ কার্য নেই' : 'No pending actions'}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {pendingActions.map((action) => (
                      <Link
                        key={action.label}
                        href={action.href}
                        className={`group flex items-center justify-between p-3 rounded-xl transition-colors ${isDark ? "hover:bg-white/[0.04]" : "hover:bg-zinc-50"}`}
                      >
                        <div className="flex items-center gap-3">
                          <action.icon className={`h-4 w-4 ${iconColor}`} />
                          <span className={`text-sm font-medium ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>{action.label}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-semibold ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>{action.count}</span>
                          <ChevronRight className={`h-3.5 w-3.5 ${isDark ? "text-zinc-600" : "text-zinc-300"}`} />
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Activity Feed */}
          <div className="col-span-12 lg:col-span-8">
            <div className={`${card}`}>
              <div className={`p-5 border-b ${isDark ? "border-white/[0.06]" : "border-zinc-100"}`}>
                <div className="flex items-center justify-between">
                  <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>
                    {isBn ? 'সাম্প্রতিক কার্যকলাপ' : 'Recent Activity'}
                  </h3>
                  <Link href="/super-admin/notifications" className={`text-xs font-medium transition-colors ${isDark ? 'text-zinc-500 hover:text-zinc-300' : 'text-zinc-400 hover:text-zinc-600'}`}>
                    {isBn ? 'সব দেখুন' : 'View all'} <ArrowRight className="h-3 w-3 inline ml-0.5" />
                  </Link>
                </div>
              </div>
              <div className={`${isDark ? 'divide-white/[0.04]' : 'divide-zinc-100'} divide-y`}>
                {logs.slice(0, 6).map((log) => (
                  <div key={log.id} className={`flex items-start gap-3 p-4 transition-colors ${isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-zinc-50/50'}`}>
                    <div className={`h-9 w-9 rounded-xl flex items-center justify-center text-[10px] font-bold tracking-wider shrink-0 ${isDark ? 'bg-white/[0.06] text-zinc-400' : 'bg-zinc-100 text-zinc-500'}`}>
                      {log.userName.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm leading-relaxed ${isDark ? "text-zinc-200" : "text-zinc-700"}`}>{log.details}</p>
                      <p className={`text-xs mt-1 ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>
                        {log.userName} · {new Date(log.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <span className={`text-[11px] font-mono shrink-0 mt-0.5 ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>
                      {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Recent Institutions Table */}
        <div className={`${card}`}>
          <div className={`p-5 border-b ${isDark ? "border-white/[0.06]" : "border-zinc-100"}`}>
            <div className="flex items-center justify-between">
              <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>
                {isBn ? 'সাম্প্রতিক প্রতিষ্ঠান' : 'Recent Institutions'}
              </h3>
              <Link href="/super-admin/institutions" className={`text-xs font-medium transition-colors ${isDark ? 'text-zinc-500 hover:text-zinc-300' : 'text-zinc-400 hover:text-zinc-600'}`}>
                {isBn ? 'সব দেখুন' : 'View all'} <ArrowRight className="h-3 w-3 inline ml-0.5" />
              </Link>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow className={isDark ? 'border-white/[0.04] hover:bg-transparent' : 'border-zinc-100 hover:bg-transparent'}>
                <TableHead className={`text-xs font-medium uppercase tracking-wider ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>{isBn ? 'প্রতিষ্ঠান' : 'Institution'}</TableHead>
                <TableHead className={`text-xs font-medium uppercase tracking-wider ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>Code</TableHead>
                <TableHead className={`text-xs font-medium uppercase tracking-wider ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>{isBn ? 'শিক্ষার্থী' : 'Students'}</TableHead>
                <TableHead className={`text-xs font-medium uppercase tracking-wider ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>{isBn ? 'স্থিতি' : 'Status'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {institutions.slice(0, 5).map(inst => (
                <TableRow key={inst.id} className={`${isDark ? 'border-white/[0.04] hover:bg-white/[0.02]' : 'border-zinc-100 hover:bg-zinc-50/50'}`}>
                  <TableCell className={`text-sm font-medium ${isDark ? "text-zinc-200" : "text-zinc-700"}`}>{inst.name}</TableCell>
                  <TableCell className={`text-sm font-mono ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>{inst.code}</TableCell>
                  <TableCell className={`text-sm ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>{inst.totalStudents.toLocaleString()}</TableCell>
                  <TableCell><Badge status={inst.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
        <div className={`h-8 w-40 rounded-lg mb-8 ${shimmer}`} />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className={`${card} rounded-2xl h-28`} />
          ))}
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className={`${card} rounded-2xl h-28`} />
          ))}
        </div>
        <div className="grid grid-cols-12 gap-6">
          <div className={`col-span-12 lg:col-span-4 h-52 ${card} rounded-2xl`} />
          <div className={`col-span-12 lg:col-span-8 h-52 ${card} rounded-2xl`} />
        </div>
      </div>
    </div>
  );
}
