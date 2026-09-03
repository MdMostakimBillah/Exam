"use client";
import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { getInstitutions } from "@/lib/storage/institutions";
import { getStudents } from "@/lib/storage/students";
import { getExams } from "@/lib/storage/exams";
import { getRegistrations } from "@/lib/storage/registrations";
import { getResults } from "@/lib/storage/results";
import { getPayments } from "@/lib/storage/payments";
import { getAuditLogs } from "@/lib/storage/audit-logs";
import { Building2, Users, FileText, CheckCircle, Clock, DollarSign, ChevronRight, ArrowRight } from "lucide-react";
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

  const bg = isDark ? "bg-[#0a0a0b]" : "bg-zinc-50";
  const text = isDark ? "text-zinc-100" : "text-zinc-900";
  const textSec = isDark ? "text-zinc-400" : "text-zinc-500";
  const cardBg = isDark ? "bg-white/[0.03] border-white/[0.08]" : "bg-white border-zinc-200 shadow-sm";

  const pendingActions = [
    ...(pendingInstitutions > 0 ? [{ icon: Building2, label: isBn ? 'প্রতিষ্ঠান অনুমোদন' : 'Institution Approval', count: pendingInstitutions, href: '/super-admin/institutions', color: 'amber' }] : []),
    ...(pendingStudents > 0 ? [{ icon: Users, label: isBn ? 'শিক্ষার্থী নিবন্ধন' : 'Student Registration', count: pendingStudents, href: '/super-admin/registrations', color: 'blue' }] : []),
    ...(totalDue > 0 ? [{ icon: DollarSign, label: isBn ? 'বকেয়া পেমেন্ট' : 'Pending Payments', count: '৳' + totalDue.toLocaleString(), href: '/super-admin/payments', color: 'rose' }] : []),
  ];

  return (
    <div className={`min-h-screen ${bg}`}>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className={`absolute top-1/4 -left-32 w-96 h-96 rounded-full blur-[120px] ${isDark ? "bg-blue-500/5" : "bg-blue-500/[0.03]"}`} />
        <div className={`absolute bottom-1/4 -right-32 w-96 h-96 rounded-full blur-[120px] ${isDark ? "bg-purple-500/5" : "bg-purple-500/[0.03]"}`} />
      </div>

      <div className="p-6 lg:p-8 relative z-10">
        <div className="mb-8">
          <h1 className={`text-2xl lg:text-3xl font-bold tracking-tight ${text}`}>
            {isBn ? 'ড্যাশবোর্ড' : 'Dashboard'}
          </h1>
          <p className={`text-sm mt-1 ${textSec}`}>
            {isBn ? 'বাংলাদেশ মাদ্রাসা এসোসিয়েশন পরিচালনা করুন' : 'Manage Bangladesh Education Society operations'}
          </p>
        </div>

        {/* Revenue Hero */}
        <div className={`rounded-2xl p-6 mb-6 border ${isDark ? "bg-gradient-to-br from-white/[0.05] to-white/[0.02] border-white/[0.08]" : "bg-gradient-to-br from-zinc-900 to-zinc-800 border-zinc-700"}`}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className={`text-sm font-medium ${isDark ? "text-zinc-400" : "text-zinc-300"}`}>
                {isBn ? 'মোট আয়' : 'Total Revenue'}
              </p>
              <p className="text-3xl lg:text-4xl font-bold mt-1 text-white">
                ৳{totalRevenue.toLocaleString()}
              </p>
              <div className="flex items-center gap-4 mt-2">
                <span className="text-xs text-emerald-400">
                  {isBn ? 'সংগৃহীত' : 'Collected'}
                </span>
                <span className="text-xs text-amber-400">
                  {isBn ? 'বকেয়া' : 'Due'}: ৳{totalDue.toLocaleString()}
                </span>
              </div>
            </div>
            <Link
              href="/super-admin/payments"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all bg-white/10 text-white hover:bg-white/15"
            >
              {isBn ? 'পেমেন্ট দেখুন' : 'View Payments'} <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { icon: Building2, label: isBn ? 'প্রতিষ্ঠান' : 'Institutions', value: institutions.length, sub: `${pendingInstitutions} ${isBn ? 'বাকি' : 'pending'}`, href: '/super-admin/institutions', accent: 'blue' },
            { icon: Users, label: isBn ? 'শিক্ষার্থী' : 'Students', value: students.length, sub: `${approvedStudents} ${isBn ? 'অনুমোদিত' : 'approved'}`, href: '/super-admin/students', accent: 'emerald' },
            { icon: FileText, label: isBn ? 'সক্রিয় পরীক্ষা' : 'Active Exams', value: activeExams, sub: `${exams.length} ${isBn ? 'মোট' : 'total'}`, href: '/super-admin/exams', accent: 'purple' },
            { icon: CheckCircle, label: isBn ? 'ফলাফল' : 'Results', value: results.length, sub: `${verifiedRegs} ${isBn ? 'যাচাইকৃত' : 'verified'}`, href: '/super-admin/results', accent: 'amber' },
          ].map((s) => (
            <Link key={s.label} href={s.href}>
              <Card className={`${cardBg} rounded-2xl border hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group`}>
                <CardContent className="p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-white/10' : 'bg-zinc-100 border border-zinc-200'}`}>
                      <s.icon className={`h-5 w-5 ${textSec}`} />
                    </div>
                    <ArrowRight className={`h-4 w-4 ml-auto opacity-0 group-hover:opacity-100 transition-opacity ${textSec}`} />
                  </div>
                  <p className={`text-2xl font-bold ${text}`}>{s.value}</p>
                  <p className={`text-xs mt-0.5 ${textSec}`}>{s.label}</p>
                  <p className={`text-[11px] mt-1 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>{s.sub}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Pending Actions + Activity */}
        <div className="grid grid-cols-12 gap-6 mb-6">
          <div className="col-span-12 lg:col-span-4">
            <Card className={`${cardBg} rounded-2xl border h-full`}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-5">
                  <h3 className={`text-sm font-semibold ${text}`}>
                    {isBn ? 'অপেক্ষমাণ কার্য' : 'Pending Actions'}
                  </h3>
                  {pendingActions.length > 0 && (
                    <span className={`h-5 px-2 rounded-full flex items-center justify-center text-[10px] font-bold ${isDark ? "bg-amber-500/20 text-amber-400" : "bg-amber-100 text-amber-700"}`}>
                      {pendingActions.length}
                    </span>
                  )}
                </div>
                {pendingActions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8">
                    <div className={`h-12 w-12 rounded-full flex items-center justify-center mb-3 ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}>
                      <CheckCircle className={`h-6 w-6 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
                    </div>
                    <p className={`text-sm font-medium ${text}`}>{isBn ? 'সব আপ টু ডেট' : 'All caught up'}</p>
                    <p className={`text-xs ${textSec}`}>{isBn ? 'কোনো অপেক্ষমাণ কার্য নেই' : 'No pending actions'}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {pendingActions.map((action) => (
                      <Link key={action.label} href={action.href} className={`flex items-center justify-between p-3 rounded-xl transition-all ${isDark ? "bg-white/[0.03] hover:bg-white/[0.06]" : "bg-zinc-50 hover:bg-zinc-100 border border-zinc-100"}`}>
                        <div className="flex items-center gap-3">
                          <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${isDark ? `bg-${action.color}-500/10` : `bg-${action.color}-50`}`}>
                            <action.icon className={`h-4 w-4 text-${action.color}-500`} />
                          </div>
                          <span className={`text-sm font-medium ${text}`}>{action.label}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-semibold ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{action.count}</span>
                          <ChevronRight className={`h-3.5 w-3.5 ${textSec}`} />
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="col-span-12 lg:col-span-8">
            <Card className={`${cardBg} rounded-2xl border`}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-5">
                  <h3 className={`text-sm font-semibold ${text}`}>
                    {isBn ? 'সাম্প্রতিক কার্যকলাপ' : 'Recent Activity'}
                  </h3>
                  <Link href="/super-admin/notifications" className={`text-xs transition-colors ${isDark ? 'text-zinc-400 hover:text-zinc-200' : 'text-zinc-500 hover:text-zinc-700'}`}>
                    {isBn ? 'সব দেখুন' : 'View all'} <ArrowRight className="h-3 w-3 inline" />
                  </Link>
                </div>
                <div className="space-y-1">
                  {logs.slice(0, 6).map((log) => (
                    <div key={log.id} className={`flex items-start gap-3 p-3 rounded-xl transition-colors ${isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-zinc-50'}`}>
                      <div className={`h-8 w-8 rounded-lg flex items-center justify-center text-[10px] font-semibold shrink-0 ${isDark ? 'bg-white/10 text-zinc-300' : 'bg-zinc-100 text-zinc-600'}`}>
                        {log.userName.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${text}`}>{log.details}</p>
                        <p className={`text-xs mt-0.5 ${textSec}`}>
                          {log.userName} · {new Date(log.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <span className={`text-[11px] shrink-0 ${textSec}`}>
                        {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Recent Institutions */}
        <Card className={`${cardBg} rounded-2xl border`}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className={`text-sm font-semibold ${text}`}>
                {isBn ? 'সাম্প্রতিক প্রতিষ্ঠান' : 'Recent Institutions'}
              </h3>
              <Link href="/super-admin/institutions" className={`text-xs transition-colors ${isDark ? 'text-zinc-400 hover:text-zinc-200' : 'text-zinc-500 hover:text-zinc-700'}`}>
                {isBn ? 'সব দেখুন' : 'View all'} <ArrowRight className="h-3 w-3 inline" />
              </Link>
            </div>
            <Table>
              <TableHeader>
                <TableRow className={isDark ? 'border-white/[0.06]' : 'border-zinc-200'}>
                  <TableHead className={textSec}>{isBn ? 'প্রতিষ্ঠান' : 'Institution'}</TableHead>
                  <TableHead className={textSec}>Code</TableHead>
                  <TableHead className={textSec}>{isBn ? 'শিক্ষার্থী' : 'Students'}</TableHead>
                  <TableHead className={textSec}>{isBn ? 'স্থিতি' : 'Status'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {institutions.slice(0, 5).map(inst => (
                  <TableRow key={inst.id} className={`${isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-zinc-50'}`}>
                    <TableCell className={`text-sm font-medium ${text}`}>{inst.name}</TableCell>
                    <TableCell className={`text-sm font-mono ${textSec}`}>{inst.code}</TableCell>
                    <TableCell className={`text-sm ${textSec}`}>{inst.totalStudents.toLocaleString()}</TableCell>
                    <TableCell><Badge status={inst.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DashboardSkeleton({ isDark }: { isDark: boolean }) {
  const bg = isDark ? "bg-[#0a0a0b]" : "bg-zinc-50";
  const cardBg = isDark ? "bg-white/[0.03]" : "bg-white";

  return (
    <div className={`min-h-screen ${bg}`}>
      <div className="p-6 lg:p-8">
        <div className={`h-8 w-32 rounded mb-8 ${isDark ? 'bg-zinc-800' : 'bg-zinc-200'}`} />
        <div className={`h-32 rounded-2xl mb-6 ${isDark ? 'bg-white/[0.03]' : 'bg-zinc-200'}`} />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className={`h-28 rounded-2xl ${cardBg}`} />
          ))}
        </div>
        <div className="grid grid-cols-12 gap-6">
          <div className={`col-span-12 lg:col-span-4 h-48 rounded-2xl ${cardBg}`} />
          <div className={`col-span-12 lg:col-span-8 h-48 rounded-2xl ${cardBg}`} />
        </div>
      </div>
    </div>
  );
}
