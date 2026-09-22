"use client";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Building2, Users, FileText, DollarSign, ArrowRight, TrendingUp, GraduationCap, CheckCircle, Download } from "lucide-react";
import { useTheme } from "@/contexts/theme-context";
import { useLang } from "@/contexts/language-context";
import Link from "next/link";
import type { DashboardData, DashboardStats } from "@/lib/data/dashboard";
import { LoadingBar } from "@/components/ui/loading-bar";

export function SuperAdminDashboardView({ data, stats, isLoading }: { data: DashboardData; stats: DashboardStats; isLoading?: boolean }) {
  const { theme } = useTheme();
  const { lang: language } = useLang();

  const isDark = theme === "dark";
  const isBn = language === "bn";

  const { institutions, students, exams, registrations, results, payments } = data;

  const monthlyInstitutions = useMemo(() => Array.from({ length: 12 }, (_, i) =>
    institutions.filter(inst => {
      const d = new Date(inst.createdAt);
      return d.getFullYear() === new Date().getFullYear() && d.getMonth() === i;
    }).length
  ), [institutions]);
  const maxMonthly = useMemo(() => Math.max(...monthlyInstitutions, 1), [monthlyInstitutions]);
  const card = isDark
    ? "bg-[#141416] border border-white/[0.06] rounded-md"
    : "bg-white border border-zinc-200 rounded-md shadow-sm";
  const cardHover = isDark
    ? "hover:border-white/[0.1] transition-colors"
    : "hover:border-zinc-300 transition-colors";
  const iconBg = isDark ? "bg-white/[0.06]" : "bg-zinc-100";
  const iconColor = isDark ? "text-white" : "text-zinc-900";

  const downloadPDF = () => {
    const content = institutions.map((inst, i) => `${i + 1}. ${inst.name} | ${inst.address} | ${inst.contactPerson} | ${inst.phone}`).join("\n");
    const text = `Institutions List\n\n${content}`;
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "institutions.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0a0a0b]" : "bg-zinc-50"}`}>
      <LoadingBar isLoading={!!isLoading} />
      <div className="max-w-[1600px] mx-auto p-6 lg:p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className={`text-2xl lg:text-3xl font-bold tracking-tight ${isDark ? "text-white" : "text-zinc-900"}`}>
            {isBn ? 'বিএমএ-তে স্বাগতম' : 'Welcome to BMA'}
          </h1>
          <p className={`text-sm mt-1.5 ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>
            {isBn ? 'বাংলাদেশ মাদ্রাসা এসোসিয়েশন পরিচালনা করুন' : 'Manage Bangladesh Madrasah Association operations'}
          </p>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { icon: Building2, label: isBn ? 'মোট প্রতিষ্ঠান' : 'Total Institutions', value: stats.institutions_total, href: '/super-admin/institutions' },
            { icon: Users, label: isBn ? 'মোট শিক্ষার্থী' : 'Total Students', value: stats.students_total, href: '/super-admin/students' },
            { icon: FileText, label: isBn ? 'সক্রিয় পরীক্ষা' : 'Active Exams', value: stats.exams_active, href: '/super-admin/exams' },
            { icon: GraduationCap, label: isBn ? 'ফলাফল' : 'Results Published', value: stats.results_total, href: '/super-admin/results' },
          ].map((s) => (
            <Link key={s.label} href={s.href} className="block">
              <div className={`${card} ${cardHover} px-4 py-3 flex items-center gap-3`}>
                <div className={`h-10 w-10 rounded-md flex items-center justify-center shrink-0 ${iconBg}`}>
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
            { icon: TrendingUp, label: isBn ? 'মোট আয়' : 'Total Revenue', value: '৳' + stats.payments_total.toLocaleString() },
            { icon: DollarSign, label: isBn ? 'বকেয়া' : 'Total Due', value: '৳' + stats.payments_due.toLocaleString() },
            { icon: Users, label: isBn ? 'নিবন্ধিত' : 'Registered', value: stats.registrations_total },
            { icon: CheckCircle, label: isBn ? 'অনুমোদিত' : 'Approved', value: stats.registrations_approved },
          ].map((s) => (
            <div key={s.label} className={`${card} px-4 py-3 flex items-center gap-3`}>
              <div className={`h-10 w-10 rounded-md flex items-center justify-center shrink-0 ${iconBg}`}>
                <s.icon className={`h-5 w-5 ${iconColor}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-lg font-bold tracking-tight leading-tight ${isDark ? "text-white" : "text-zinc-900"}`}>{s.value}</p>
                <p className={`text-[11px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Recent Institutions + Graph */}
        <div className="grid grid-cols-12 gap-6">
          {/* Recent Institutions */}
          <div className="col-span-12 lg:col-span-7">
            <div className={`${card}`}>
              <div className={`p-5 border-b ${isDark ? "border-white/[0.06]" : "border-zinc-100"}`}>
                <div className="flex items-center justify-between">
                  <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>
                    {isBn ? 'সাম্প্রতিক প্রতিষ্ঠান' : 'Recently Added'}
                  </h3>
                  <Link href="/super-admin/institutions" className={`text-xs font-medium transition-colors ${isDark ? 'text-zinc-500 hover:text-zinc-300' : 'text-zinc-400 hover:text-zinc-600'}`}>
                    {isBn ? 'সব দেখুন' : 'View all'} <ArrowRight className="h-3 w-3 inline ml-0.5" />
                  </Link>
                </div>
              </div>
              <div className={`divide-y ${isDark ? 'divide-white/[0.04]' : 'divide-zinc-100'}`}>
                {[...institutions].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5).map((inst) => (
                  <div key={inst.id} className={`flex items-center gap-3 px-5 py-3 transition-colors ${isDark ? "hover:bg-white/[0.02]" : "hover:bg-zinc-50/50"}`}>
                    <div className={`h-9 w-9 rounded-md flex items-center justify-center shrink-0 text-xs font-bold ${isDark ? 'bg-white/[0.06] text-zinc-400' : 'bg-zinc-100 text-zinc-500'}`}>
                      {inst.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${isDark ? "text-zinc-200" : "text-zinc-700"}`}>{inst.name}</p>
                      <p className={`text-[11px] truncate ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>{inst.address}</p>
                    </div>
                    <Badge status={inst.status} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Institution Graph */}
          <div className="col-span-12 lg:col-span-5">
            <div className={`${card} h-full`}>
              <div className={`p-5 border-b ${isDark ? "border-white/[0.06]" : "border-zinc-100"}`}>
                <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>
                  {isBn ? 'প্রতিষ্ঠান যোগ' : 'Institutions Added'}
                </h3>
              </div>
              <div className="p-5">
                <div className="flex items-end gap-2 h-32">
                  {monthlyInstitutions.map((h, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className={`w-full rounded-t-md transition-all ${isDark ? "bg-white/[0.12]" : "bg-zinc-200"}`}
                        style={{ height: `${(h / maxMonthly) * 100}%` }}
                      />
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 mt-3">
                  {['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'].map((m) => (
                    <span key={m} className={`flex-1 text-center text-[9px] ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>{m}</span>
                  ))}
                </div>
                <div className={`flex items-center justify-between mt-4 pt-3 border-t ${isDark ? "border-white/[0.04]" : "border-zinc-100"}`}>
                  <div>
                    <p className={`text-2xl font-bold ${isDark ? "text-white" : "text-zinc-900"}`}>{stats.institutions_total}</p>
                    <p className={`text-[11px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>{isBn ? 'মোট প্রতিষ্ঠান' : 'Total Institutions'}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>+{stats.institutions_pending}</p>
                    <p className={`text-[11px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>{isBn ? 'বাকি অনুমোদন' : 'Pending'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
