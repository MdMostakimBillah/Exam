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
import { Building2, Users, FileText, CheckCircle, DollarSign, ChevronRight, ArrowRight, TrendingUp, Activity, Sparkles } from "lucide-react";
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

  const colorMap: Record<string, { bg: string; text: string; glow: string }> = {
    amber: { bg: isDark ? "bg-amber-500/10" : "bg-amber-50", text: isDark ? "text-amber-400" : "text-amber-600", glow: "shadow-amber-500/20" },
    blue: { bg: isDark ? "bg-blue-500/10" : "bg-blue-50", text: isDark ? "text-blue-400" : "text-blue-600", glow: "shadow-blue-500/20" },
    rose: { bg: isDark ? "bg-rose-500/10" : "bg-rose-50", text: isDark ? "text-rose-400" : "text-rose-600", glow: "shadow-rose-500/20" },
    emerald: { bg: isDark ? "bg-emerald-500/10" : "bg-emerald-50", text: isDark ? "text-emerald-400" : "text-emerald-600", glow: "shadow-emerald-500/20" },
    purple: { bg: isDark ? "bg-purple-500/10" : "bg-purple-50", text: isDark ? "text-purple-400" : "text-purple-600", glow: "shadow-purple-500/20" },
  };

  const accentMap: Record<string, { gradient: string; iconBg: string; text: string }> = {
    blue: { gradient: isDark ? "from-blue-500/20 via-blue-500/5 to-transparent" : "from-blue-500/10 via-blue-500/5 to-transparent", iconBg: isDark ? "bg-blue-500/15" : "bg-blue-100", text: isDark ? "text-blue-400" : "text-blue-600" },
    emerald: { gradient: isDark ? "from-emerald-500/20 via-emerald-500/5 to-transparent" : "from-emerald-500/10 via-emerald-500/5 to-transparent", iconBg: isDark ? "bg-emerald-500/15" : "bg-emerald-100", text: isDark ? "text-emerald-400" : "text-emerald-600" },
    purple: { gradient: isDark ? "from-purple-500/20 via-purple-500/5 to-transparent" : "from-purple-500/10 via-purple-500/5 to-transparent", iconBg: isDark ? "bg-purple-500/15" : "bg-purple-100", text: isDark ? "text-purple-400" : "text-purple-600" },
    amber: { gradient: isDark ? "from-amber-500/20 via-amber-500/5 to-transparent" : "from-amber-500/10 via-amber-500/5 to-transparent", iconBg: isDark ? "bg-amber-500/15" : "bg-amber-100", text: isDark ? "text-amber-400" : "text-amber-600" },
  };

  const pendingActions = [
    ...(pendingInstitutions > 0 ? [{ icon: Building2, label: isBn ? 'প্রতিষ্ঠান অনুমোদন' : 'Institution Approval', count: pendingInstitutions, href: '/super-admin/institutions', color: 'amber' }] : []),
    ...(pendingStudents > 0 ? [{ icon: Users, label: isBn ? 'শিক্ষার্থী নিবন্ধন' : 'Student Registration', count: pendingStudents, href: '/super-admin/registrations', color: 'blue' }] : []),
    ...(totalDue > 0 ? [{ icon: DollarSign, label: isBn ? 'বকেয়া পেমেন্ট' : 'Pending Payments', count: '৳' + totalDue.toLocaleString(), href: '/super-admin/payments', color: 'rose' }] : []),
  ];

  const metrics = [
    { icon: Building2, label: isBn ? 'প্রতিষ্ঠান' : 'Institutions', value: institutions.length, sub: `${pendingInstitutions} ${isBn ? 'বাকি' : 'pending'}`, href: '/super-admin/institutions', accent: 'blue' },
    { icon: Users, label: isBn ? 'শিক্ষার্থী' : 'Students', value: students.length, sub: `${approvedStudents} ${isBn ? 'অনুমোদিত' : 'approved'}`, href: '/super-admin/students', accent: 'emerald' },
    { icon: FileText, label: isBn ? 'সক্রিয় পরীক্ষা' : 'Active Exams', value: activeExams, sub: `${exams.length} ${isBn ? 'মোট' : 'total'}`, href: '/super-admin/exams', accent: 'purple' },
    { icon: CheckCircle, label: isBn ? 'ফলাফল' : 'Results', value: results.length, sub: `${verifiedRegs} ${isBn ? 'যাচাইকৃত' : 'verified'}`, href: '/super-admin/results', accent: 'amber' },
  ];

  return (
    <div className={`min-h-screen relative overflow-hidden ${isDark ? "bg-[#08080a]" : "bg-zinc-50"}`}>
      {/* Ambient background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className={`absolute -top-[300px] -right-[200px] w-[700px] h-[700px] rounded-full blur-[150px] ${isDark ? "bg-blue-600/[0.04]" : "bg-blue-500/[0.06]"}`} />
        <div className={`absolute top-[40%] -left-[200px] w-[600px] h-[600px] rounded-full blur-[150px] ${isDark ? "bg-purple-600/[0.03]" : "bg-purple-500/[0.05]"}`} />
        <div className={`absolute -bottom-[200px] right-[20%] w-[500px] h-[500px] rounded-full blur-[150px] ${isDark ? "bg-emerald-600/[0.03]" : "bg-emerald-500/[0.04]"}`} />
      </div>

      <div className="p-6 lg:p-8 relative z-10">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${isDark ? "bg-white/10" : "bg-zinc-900"}`}>
              <Sparkles className={`h-4 w-4 ${isDark ? "text-white" : "text-white"}`} />
            </div>
            <h1 className={`text-2xl lg:text-3xl font-bold tracking-tight ${isDark ? "text-white" : "text-zinc-900"}`}>
              {isBn ? 'ড্যাশবোর্ড' : 'Dashboard'}
            </h1>
          </div>
          <p className={`text-sm mt-2 ml-11 ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>
            {isBn ? 'বাংলাদেশ মাদ্রাসা এসোসিয়েশন পরিচালনা করুন' : 'Manage Bangladesh Education Society operations'}
          </p>
        </div>

        {/* Revenue Hero — Premium Glass Card */}
        <div className="relative group mb-6">
          <div className={`absolute -inset-[1px] rounded-2xl bg-gradient-to-r ${isDark ? "from-white/10 via-white/[0.02] to-white/10" : "from-zinc-300 via-zinc-200 to-zinc-300"} opacity-50`} />
          <div className={`relative rounded-2xl overflow-hidden ${isDark ? "bg-gradient-to-br from-white/[0.06] via-white/[0.02] to-white/[0.04]" : "bg-gradient-to-br from-white via-white to-zinc-50 shadow-lg shadow-zinc-200/50"}`}>
            <div className={`absolute inset-0 bg-gradient-to-br ${isDark ? "from-blue-500/[0.06] via-transparent to-purple-500/[0.06]" : "from-blue-500/[0.04] via-transparent to-purple-500/[0.04]"}`} />
            <div className="relative p-6 lg:p-8">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`h-6 w-6 rounded-md flex items-center justify-center ${isDark ? "bg-emerald-500/20" : "bg-emerald-100"}`}>
                      <TrendingUp className={`h-3.5 w-3.5 ${isDark ? "text-emerald-400" : "text-emerald-600"}`} />
                    </div>
                    <span className={`text-xs font-medium uppercase tracking-wider ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
                      {isBn ? 'মোট আয়' : 'Total Revenue'}
                    </span>
                  </div>
                  <p className={`text-4xl lg:text-5xl font-bold tracking-tight ${isDark ? "text-white" : "text-zinc-900"}`}>
                    ৳{totalRevenue.toLocaleString()}
                  </p>
                  <div className="flex items-center gap-5 mt-3">
                    <div className="flex items-center gap-1.5">
                      <div className={`h-1.5 w-1.5 rounded-full ${isDark ? "bg-emerald-400" : "bg-emerald-500"}`} />
                      <span className={`text-xs font-medium ${isDark ? "text-emerald-400" : "text-emerald-600"}`}>
                        {isBn ? 'সংগৃহীত' : 'Collected'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className={`h-1.5 w-1.5 rounded-full ${isDark ? "bg-amber-400" : "bg-amber-500"}`} />
                      <span className={`text-xs font-medium ${isDark ? "text-amber-400" : "text-amber-600"}`}>
                        {isBn ? 'বকেয়া' : 'Due'}: ৳{totalDue.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
                <Link
                  href="/super-admin/payments"
                  className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${isDark ? "bg-white/10 text-white hover:bg-white/15 border border-white/[0.08]" : "bg-zinc-900 text-white hover:bg-zinc-800 shadow-lg shadow-zinc-900/20"}`}
                >
                  {isBn ? 'পেমেন্ট দেখুন' : 'View Payments'} <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Metric Cards — Glass */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {metrics.map((s) => (
            <Link key={s.label} href={s.href} className="group block">
              <div className="relative">
                <div className={`absolute -inset-[1px] rounded-2xl bg-gradient-to-b ${isDark ? "from-white/[0.12] to-white/[0.04]" : "from-zinc-200 to-zinc-200/50"} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
                <div className={`relative rounded-2xl overflow-hidden transition-all duration-300 group-hover:-translate-y-0.5 ${isDark ? "bg-white/[0.04] backdrop-blur-xl border border-white/[0.06] hover:border-white/[0.12]" : "bg-white border border-zinc-200 hover:border-zinc-300 shadow-sm hover:shadow-md"}`}>
                  <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl ${accentMap[s.accent].gradient} rounded-bl-[60px]`} />
                  <div className="relative p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${accentMap[s.accent].iconBg}`}>
                        <s.icon className={`h-5 w-5 ${accentMap[s.accent].text}`} />
                      </div>
                      <ArrowRight className={`h-4 w-4 transition-all duration-200 -translate-x-1 opacity-0 group-hover:opacity-100 group-hover:translate-x-0 ${isDark ? "text-zinc-500" : "text-zinc-400"}`} />
                    </div>
                    <p className={`text-3xl font-bold tracking-tight ${isDark ? "text-white" : "text-zinc-900"}`}>{s.value}</p>
                    <p className={`text-xs font-medium mt-1 ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>{s.label}</p>
                    <p className={`text-[11px] mt-1.5 ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>{s.sub}</p>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Pending Actions + Activity Feed */}
        <div className="grid grid-cols-12 gap-6 mb-6">
          {/* Pending Actions */}
          <div className="col-span-12 lg:col-span-4">
            <div className={`h-full rounded-2xl overflow-hidden ${isDark ? "bg-white/[0.04] backdrop-blur-xl border border-white/[0.06]" : "bg-white border border-zinc-200 shadow-sm"}`}>
              <div className={`p-5 border-b ${isDark ? "border-white/[0.06]" : "border-zinc-100"}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className={`h-4 w-4 ${isDark ? "text-zinc-500" : "text-zinc-400"}`} />
                    <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>
                      {isBn ? 'অপেক্ষমাণ কার্য' : 'Pending Actions'}
                    </h3>
                  </div>
                  {pendingActions.length > 0 && (
                    <span className={`h-5 min-w-[20px] px-1.5 rounded-full flex items-center justify-center text-[10px] font-bold ${isDark ? "bg-amber-500/20 text-amber-400" : "bg-amber-100 text-amber-700"}`}>
                      {pendingActions.length}
                    </span>
                  )}
                </div>
              </div>
              <div className="p-4">
                {pendingActions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10">
                    <div className={`h-14 w-14 rounded-2xl flex items-center justify-center mb-4 ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}>
                      <CheckCircle className={`h-7 w-7 ${isDark ? 'text-emerald-400' : 'text-emerald-500'}`} />
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
                        className={`group/item flex items-center justify-between p-3 rounded-xl transition-all duration-200 ${isDark ? "bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.04] hover:border-white/[0.08]" : "bg-zinc-50 hover:bg-zinc-100 border border-zinc-100 hover:border-zinc-200"}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${colorMap[action.color].bg}`}>
                            <action.icon className={`h-4 w-4 ${colorMap[action.color].text}`} />
                          </div>
                          <span className={`text-sm font-medium ${isDark ? "text-zinc-200" : "text-zinc-700"}`}>{action.label}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-semibold ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>{action.count}</span>
                          <ChevronRight className={`h-3.5 w-3.5 transition-transform duration-200 group-hover/item:translate-x-0.5 ${isDark ? "text-zinc-600" : "text-zinc-300"}`} />
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
            <div className={`rounded-2xl overflow-hidden ${isDark ? "bg-white/[0.04] backdrop-blur-xl border border-white/[0.06]" : "bg-white border border-zinc-200 shadow-sm"}`}>
              <div className={`p-5 border-b ${isDark ? "border-white/[0.06]" : "border-zinc-100"}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className={`h-4 w-4 ${isDark ? "text-zinc-500" : "text-zinc-400"}`} />
                    <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>
                      {isBn ? 'সাম্প্রতিক কার্যকলাপ' : 'Recent Activity'}
                    </h3>
                  </div>
                  <Link href="/super-admin/notifications" className={`text-xs font-medium transition-colors ${isDark ? 'text-zinc-500 hover:text-zinc-300' : 'text-zinc-400 hover:text-zinc-600'}`}>
                    {isBn ? 'সব দেখুন' : 'View all'} <ArrowRight className="h-3 w-3 inline ml-0.5" />
                  </Link>
                </div>
              </div>
              <div className="divide-y ${isDark ? 'divide-white/[0.04]' : 'divide-zinc-100'}">
                {logs.slice(0, 6).map((log) => (
                  <div key={log.id} className={`flex items-start gap-3 p-4 transition-colors ${isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-zinc-50/50'}`}>
                    <div className={`h-9 w-9 rounded-xl flex items-center justify-center text-[10px] font-bold tracking-wider shrink-0 ${isDark ? 'bg-white/[0.06] text-zinc-400 border border-white/[0.04]' : 'bg-zinc-100 text-zinc-500 border border-zinc-200'}`}>
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
        <div className={`rounded-2xl overflow-hidden ${isDark ? "bg-white/[0.04] backdrop-blur-xl border border-white/[0.06]" : "bg-white border border-zinc-200 shadow-sm"}`}>
          <div className={`p-5 border-b ${isDark ? "border-white/[0.06]" : "border-zinc-100"}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className={`h-4 w-4 ${isDark ? "text-zinc-500" : "text-zinc-400"}`} />
                <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>
                  {isBn ? 'সাম্প্রতিক প্রতিষ্ঠান' : 'Recent Institutions'}
                </h3>
              </div>
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
  const card = isDark ? "bg-white/[0.04] border-white/[0.06]" : "bg-white border-zinc-200 shadow-sm";

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#08080a]" : "bg-zinc-50"}`}>
      <div className="p-6 lg:p-8">
        <div className="flex items-center gap-3 mb-8">
          <div className={`h-8 w-8 rounded-lg ${shimmer}`} />
          <div className={`h-8 w-40 rounded-lg ${shimmer}`} />
        </div>
        <div className={`h-36 rounded-2xl mb-6 ${card}`} />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className={`h-32 rounded-2xl ${card}`} />
          ))}
        </div>
        <div className="grid grid-cols-12 gap-6">
          <div className={`col-span-12 lg:col-span-4 h-56 rounded-2xl ${card}`} />
          <div className={`col-span-12 lg:col-span-8 h-56 rounded-2xl ${card}`} />
        </div>
      </div>
    </div>
  );
}
