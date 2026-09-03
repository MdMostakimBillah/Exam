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
import { Building2, Users, CreditCard, TrendingUp, Clock, CheckCircle, XCircle, ArrowRight, DollarSign, Wallet } from "lucide-react";
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
  const border = isDark ? "border-white/[0.06]" : "border-zinc-200/50";
  const glassCard = isDark 
    ? "bg-white/[0.03] backdrop-blur-2xl border border-white/[0.08]" 
    : "bg-white/60 backdrop-blur-xl border border-white/80";

  const stats = [
    { label: isBn ? 'মোট প্রতিষ্ঠান' : 'Institutions', value: institutions.length, icon: Building2 },
    { label: isBn ? 'মোট শিক্ষার্থী' : 'Students', value: students.length, icon: Users },
    { label: isBn ? 'সক্রিয় পরীক্ষা' : 'Active Exams', value: activeExams, icon: TrendingUp },
    { label: isBn ? 'আবেদন প্রতীক্ষা' : 'Pending', value: pendingStudents, icon: Clock },
    { label: isBn ? 'অনুমোদিত' : 'Approved', value: approvedStudents, icon: CheckCircle },
    { label: isBn ? 'মোট আয়' : 'Collected', value: '৳' + totalRevenue.toLocaleString(), icon: DollarSign },
    { label: isBn ? 'বকেয়া' : 'Due Amount', value: '৳' + totalDue.toLocaleString(), icon: Wallet },
    { label: isBn ? 'প্রত্যাখ্যান' : 'Rejected', value: registrations.filter(r => r.status === 'REJECTED').length, icon: XCircle },
  ];

  return (
    <div className={`min-h-screen ${bg}`}>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-blue-500/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-purple-500/5 rounded-full blur-[120px]" />
      </div>

      <div className="p-6 lg:p-8 relative z-10">
        <div className="mb-8">
          <h1 className={`text-2xl lg:text-3xl font-bold tracking-tight ${text}`}>
            {t("brand")}
          </h1>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-4 gap-4 mb-8">
          {stats.map((stat) => (
            <Card key={stat.label} className={`${glassCard} hover:-translate-y-0.5 transition-all duration-200`}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${isDark ? 'bg-white/10' : 'bg-zinc-100'}`}>
                    <stat.icon className={`h-5 w-5 ${textSec}`} />
                  </div>
                  <div className="min-w-0">
                    <p className={`text-xl font-semibold ${text}`}>{stat.value}</p>
                    <p className={`text-xs ${textSec} truncate`}>{stat.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-12 gap-6 mb-6">
          <div className="col-span-12 lg:col-span-8">
            <Card className={`${glassCard}`}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className={`text-sm font-semibold ${text}`}>
                    {isBn ? 'সাম্প্রতিক কার্যকলাপ' : 'Recent Activity'}
                  </h3>
                  <Link href="/super-admin/notifications" className={`text-xs ${isDark ? 'text-zinc-400 hover:text-zinc-200' : 'text-zinc-500 hover:text-zinc-700'} transition-colors`}>
                    {isBn ? 'সব দেখুন' : 'View all'} <ArrowRight className="h-3 w-3 inline" />
                  </Link>
                </div>
                <div className="space-y-4">
                  {logs.slice(0, 6).map((log, i) => (
                    <div key={log.id} className={`flex items-start gap-3 pb-4 border-b last:border-0 last:pb-0 ${isDark ? 'border-white/[0.04]' : 'border-zinc-100'}`}>
                      <div className={`h-8 w-8 rounded-lg flex items-center justify-center text-[10px] font-semibold ${isDark ? 'bg-white/10 text-zinc-300' : 'bg-zinc-100 text-zinc-600'}`}>
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

          <div className="col-span-12 lg:col-span-4">
            <Card className={`${glassCard} mb-6`}>
              <CardContent className="p-6">
                <h3 className={`text-sm font-semibold mb-4 ${text}`}>
                  {isBn ? 'নিবন্ধন' : 'Registrations'}
                </h3>
                <div className="flex items-end gap-1 h-20">
                  {[40, 55, 70, 85, 60, 75, 90, 65, 80, 95, 70, 88].map((h, i) => (
                    <div 
                      key={i} 
                      className={`flex-1 rounded-t transition-all duration-300 ${
                        isDark ? 'bg-white/10 hover:bg-white/15' : 'bg-zinc-200 hover:bg-zinc-300'
                      }`} 
                      style={{ height: `${h}%` }} 
                    />
                  ))}
                </div>
                <div className="flex justify-between mt-3">
                  {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'].map(m => (
                    <span key={m} className={`text-[10px] ${textSec}`}>{m}</span>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className={`${glassCard}`}>
              <CardContent className="p-6">
                <h3 className={`text-sm font-semibold mb-4 ${text}`}>
                  {isBn ? 'দ্রুত পরিসংখ্যান' : 'Quick Stats'}
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className={`text-sm ${textSec}`}>{isBn ? 'অনুমোদন প্রতীক্ষা' : 'Pending Institutions'}</span>
                    <span className={`text-sm font-medium ${text}`}>{pendingInstitutions}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={`text-sm ${textSec}`}>{isBn ? 'যাচাইকৃত নিবন্ধন' : 'Verified'}</span>
                    <span className={`text-sm font-medium ${text}`}>{verifiedRegs}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={`text-sm ${textSec}`}>{isBn ? 'ফলাফল প্রকাশিত' : 'Results Published'}</span>
                    <span className={`text-sm font-medium ${text}`}>{results.length}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <Card className={`${glassCard}`}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-sm font-semibold ${text}`}>
                {isBn ? 'সাম্প্রতিক প্রতিষ্ঠান' : 'Recent Institutions'}
              </h3>
              <Link href="/super-admin/institutions" className={`text-xs ${isDark ? 'text-zinc-400 hover:text-zinc-200' : 'text-zinc-500 hover:text-zinc-700'} transition-colors`}>
                {isBn ? 'সব দেখুন' : 'View all'} <ArrowRight className="h-3 w-3 inline" />
              </Link>
            </div>
            <Table>
              <TableHeader>
                <TableRow className={border}>
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
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[...Array(8)].map((_, i) => (
            <div key={i} className={`h-20 rounded-lg ${cardBg}`} />
          ))}
        </div>
      </div>
    </div>
  );
}
