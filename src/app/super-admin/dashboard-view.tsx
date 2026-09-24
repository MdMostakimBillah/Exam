"use client";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Building2, Users, FileText, DollarSign, ArrowRight, TrendingUp, GraduationCap, CheckCircle, ClipboardList, Wallet, Calendar, AlertTriangle } from "lucide-react";
import { useTheme } from "@/contexts/theme-context";
import { useLang } from "@/contexts/language-context";
import { useAuth } from "@/lib/auth/auth";
import { useCurrentSession } from "@/lib/storage/sessions";
import { useDashboardStats, useDashboardInstitutions, useDashboardRegistrations, useDashboardPayments } from "@/lib/storage/dashboard";
import type { DashboardStats } from "@/lib/data/dashboard";
import Link from "next/link";
import { formatDate, formatCurrency } from "@/lib/storage/storage";
import { LoadingBar } from "@/components/ui/loading-bar";

const ZERO_STATS: DashboardStats = {
  institutions_total: 0,
  institutions_pending: 0,
  students_total: 0,
  exams_active: 0,
  registrations_total: 0,
  registrations_pending: 0,
  registrations_verified_approved: 0,
  registrations_approved: 0,
  results_total: 0,
  payments_total: 0,
  payments_due: 0,
};

const isPendingReg = (r: { status: string }) =>
  r.status !== 'APPROVED' && r.status !== 'VERIFIED' && r.status !== 'REJECTED';

function DashboardSkeleton({ isDark }: { isDark: boolean }) {
  const sk = isDark ? "bg-white/[0.05]" : "bg-zinc-200/70";
  return (
    <div className="animate-pulse">
      <div className={`h-7 w-56 rounded-md ${sk} mb-2.5`} />
      <div className={`h-4 w-80 max-w-full rounded-md ${sk} mb-8`} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={`a${i}`} className={`h-[66px] rounded-md ${sk}`} />
        ))}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={`b${i}`} className={`h-[66px] rounded-md ${sk}`} />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className={`h-56 rounded-md ${sk}`} />
        <div className={`h-56 rounded-md ${sk}`} />
      </div>
      <div className="grid grid-cols-12 gap-6">
        <div className={`col-span-12 lg:col-span-7 h-72 rounded-md ${sk}`} />
        <div className={`col-span-12 lg:col-span-5 h-72 rounded-md ${sk}`} />
      </div>
    </div>
  );
}

export function SuperAdminDashboardView({ isLoading }: { isLoading?: boolean }) {
  const router = useRouter();
  const { theme } = useTheme();
  const { lang: language } = useLang();
  const { user } = useAuth();

  const isDark = theme === "dark";
  const isBn = language === "bn";

  // ---- Live data (auto-refresh: stats every 30s, lists every 60s + on focus) ----
  const sessionQuery = useCurrentSession();
  const currentSession = sessionQuery.data;
  const sessionId = currentSession?.id;
  const statsQuery = useDashboardStats(sessionId);
  const institutionsQuery = useDashboardInstitutions();
  const registrationsQuery = useDashboardRegistrations(sessionId);
  const paymentsQuery = useDashboardPayments(sessionId);

  const stats = statsQuery.data ?? ZERO_STATS;
  const institutions = useMemo(() => institutionsQuery.data ?? [], [institutionsQuery.data]);
  const registrations = useMemo(() => registrationsQuery.data ?? [], [registrationsQuery.data]);
  const payments = useMemo(() => paymentsQuery.data ?? [], [paymentsQuery.data]);

  // Disabled queries (no session yet) sit in isPending forever — only treat
  // them as loading while a session actually exists.
  const regsLoading = !!sessionId && registrationsQuery.isPending;
  const paysLoading = !!sessionId && paymentsQuery.isPending;
  const showSkeleton =
    sessionQuery.isPending
    || institutionsQuery.isPending
    || (!!sessionId && statsQuery.isPending);

  // ---- Actionable queues ----
  const pendingRegs = useMemo(() =>
    registrations
      .filter(isPendingReg)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [registrations]);

  const pendingPayments = useMemo(() =>
    payments
      .filter(p => p.status === 'PENDING')
      .sort((a, b) => new Date(b.submittedAt || b.createdAt).getTime() - new Date(a.submittedAt || a.createdAt).getTime()),
    [payments]);

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
  const iconBg = "bg-brand-accent-soft";
  const iconColor = "text-brand-accent";
  const subtext = isDark ? "text-zinc-500" : "text-zinc-400";
  const shimmer = isDark ? "bg-white/[0.04]" : "bg-zinc-100";

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

  const widgetRowsSkeleton = (
    <div className="animate-pulse">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className={`flex items-center gap-3 px-5 py-3.5 border-b ${isDark ? "border-white/[0.04]" : "border-zinc-100"}`}>
          <div className={`h-9 w-9 rounded-md ${shimmer}`} />
          <div className="flex-1">
            <div className={`h-3.5 w-2/5 rounded ${shimmer} mb-2`} />
            <div className={`h-3 w-3/5 rounded ${shimmer}`} />
          </div>
          <div className={`h-4 w-14 rounded ${shimmer}`} />
        </div>
      ))}
    </div>
  );

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0a0a0b]" : "bg-zinc-50"}`}>
      <LoadingBar isLoading={!!isLoading} />
      <div className="max-w-[1600px] mx-auto p-6 lg:p-8">
        {/* Header — personalized */}
        <div className="mb-8">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className={`text-2xl lg:text-3xl font-bold tracking-tight ${isDark ? "text-white" : "text-zinc-900"}`}>
              {user?.name
                ? (isBn ? `স্বাগতম, ${user.name}` : `Welcome back, ${user.name}`)
                : (isBn ? 'বিএমএ-তে স্বাগতম' : 'Welcome to BMA')}
            </h1>
            {currentSession && (
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium ${isDark ? "bg-white/[0.06] text-zinc-300 border border-white/[0.08]" : "bg-zinc-100 text-zinc-600 border border-zinc-200"}`}>
                <Calendar className="h-3 w-3" />
                {currentSession.name}
                {currentSession.startDate && (
                  <> · {formatDate(currentSession.startDate)}{currentSession.endDate ? ` – ${formatDate(currentSession.endDate)}` : ''}</>
                )}
              </span>
            )}
          </div>
          <p className={`text-sm mt-1.5 ${subtext}`}>
            {isBn ? 'বাংলাদেশ মাদ্রাসা এসোসিয়েশন পরিচালনা করুন' : 'Manage Bangladesh Madrasah Association operations'}
          </p>
        </div>

        {/* Stats error — surface it instead of showing silent zeros */}
        {statsQuery.isError && (
          <div className={`mb-6 flex items-center gap-2.5 px-4 py-3 rounded-md border text-[13px] ${isDark ? "border-red-500/30 bg-red-500/10 text-red-400" : "border-red-200 bg-red-50 text-red-600"}`}>
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {isBn
              ? 'পরিসংখ্যান আনা যায়নি — Supabase SQL Editor এ 0001, 0009 ও 0011 মাইগ্রেশন চালান'
              : 'Stats unavailable — run migrations 0001, 0009 and 0011 in the Supabase SQL Editor'}
          </div>
        )}

        {showSkeleton ? (
          <DashboardSkeleton isDark={isDark} />
        ) : (
          <>
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
                      <p className={`text-[11px] ${subtext}`}>{s.label}</p>
                    </div>
                    <ArrowRight className={`h-4 w-4 shrink-0 ${isDark ? 'text-zinc-600' : 'text-zinc-300'}`} />
                  </div>
                </Link>
              ))}
            </div>

            {/* Revenue Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {[
                { icon: TrendingUp, label: isBn ? 'মোট আয়' : 'Total Revenue', value: formatCurrency(stats.payments_total), href: '/super-admin/payments' },
                { icon: DollarSign, label: isBn ? 'বকেয়া' : 'Total Due', value: formatCurrency(stats.payments_due), href: '/super-admin/payments' },
                { icon: Users, label: isBn ? 'নিবন্ধিত' : 'Registered', value: stats.registrations_total, href: '/super-admin/registrations' },
                { icon: CheckCircle, label: isBn ? 'অনুমোদিত' : 'Approved', value: stats.registrations_approved, href: '/super-admin/registrations' },
              ].map((s) => (
                <Link key={s.label} href={s.href} className="block">
                  <div className={`${card} ${cardHover} px-4 py-3 flex items-center gap-3`}>
                    <div className={`h-10 w-10 rounded-md flex items-center justify-center shrink-0 ${iconBg}`}>
                      <s.icon className={`h-5 w-5 ${iconColor}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-lg font-bold tracking-tight leading-tight ${isDark ? "text-white" : "text-zinc-900"}`}>{s.value}</p>
                      <p className={`text-[11px] ${subtext}`}>{s.label}</p>
                    </div>
                    <ArrowRight className={`h-4 w-4 shrink-0 ${isDark ? 'text-zinc-600' : 'text-zinc-300'}`} />
                  </div>
                </Link>
              ))}
            </div>

            {/* Actionable queues */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Pending registrations */}
              <div className={card}>
                <div className={`p-5 border-b flex items-center justify-between ${isDark ? "border-white/[0.06]" : "border-zinc-100"}`}>
                  <div className="flex items-center gap-2">
                    <ClipboardList className={`h-4 w-4 ${isDark ? "text-zinc-400" : "text-zinc-500"}`} />
                    <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>
                      {isBn ? 'অনুমোদনের অপেক্ষায় নিবন্ধন' : 'Registrations Awaiting Approval'}
                    </h3>
                    <span className={`min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold flex items-center justify-center ${isDark ? "bg-white/[0.08] text-zinc-300" : "bg-zinc-900 text-white"}`}>
                      {pendingRegs.length}
                    </span>
                  </div>
                  <Link href="/super-admin/registrations" className={`text-xs font-medium transition-colors ${isDark ? 'text-zinc-500 hover:text-zinc-300' : 'text-zinc-400 hover:text-zinc-600'}`}>
                    {isBn ? 'সব দেখুন' : 'View all'} <ArrowRight className="h-3 w-3 inline ml-0.5" />
                  </Link>
                </div>
                <div className={`divide-y ${isDark ? 'divide-white/[0.04]' : 'divide-zinc-100'}`}>
                  {regsLoading ? widgetRowsSkeleton
                    : pendingRegs.length === 0 ? (
                      <p className={`px-5 py-8 text-center text-[13px] ${subtext}`}>
                        {isBn ? 'কোনো নিবন্ধন অনুমোদনের অপেক্ষায় নেই' : 'No registrations awaiting approval'}
                      </p>
                    ) : (
                      pendingRegs.slice(0, 5).map((r) => (
                        <button
                          key={r.id}
                          onClick={() => router.push('/super-admin/registrations')}
                          className={`w-full text-left flex items-center gap-3 px-5 py-3 transition-colors ${isDark ? "hover:bg-white/[0.02]" : "hover:bg-zinc-50/50"}`}
                        >
                          <div className={`h-9 w-9 rounded-md flex items-center justify-center shrink-0 text-xs font-bold ${isDark ? 'bg-white/[0.06] text-zinc-400' : 'bg-zinc-100 text-zinc-500'}`}>
                            {r.studentName.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium truncate ${isDark ? "text-zinc-200" : "text-zinc-700"}`}>{r.studentName}</p>
                            <p className={`text-[11px] truncate ${subtext}`}>{r.institutionName} · {r.className}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className={`text-sm font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>{formatCurrency(Number(r.paymentAmount || 0))}</p>
                            <p className={`text-[10px] ${subtext}`}>{formatDate(r.createdAt)}</p>
                          </div>
                        </button>
                      ))
                    )}
                </div>
              </div>

              {/* Payments awaiting review */}
              <div className={card}>
                <div className={`p-5 border-b flex items-center justify-between ${isDark ? "border-white/[0.06]" : "border-zinc-100"}`}>
                  <div className="flex items-center gap-2">
                    <Wallet className={`h-4 w-4 ${isDark ? "text-zinc-400" : "text-zinc-500"}`} />
                    <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>
                      {isBn ? 'পেমেন্ট যাচাইয়ের অপেক্ষায়' : 'Payments Awaiting Review'}
                    </h3>
                    <span className={`min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold flex items-center justify-center ${isDark ? "bg-white/[0.08] text-zinc-300" : "bg-zinc-900 text-white"}`}>
                      {pendingPayments.length}
                    </span>
                  </div>
                  <Link href="/super-admin/payments" className={`text-xs font-medium transition-colors ${isDark ? 'text-zinc-500 hover:text-zinc-300' : 'text-zinc-400 hover:text-zinc-600'}`}>
                    {isBn ? 'সব দেখুন' : 'View all'} <ArrowRight className="h-3 w-3 inline ml-0.5" />
                  </Link>
                </div>
                <div className={`divide-y ${isDark ? 'divide-white/[0.04]' : 'divide-zinc-100'}`}>
                  {paysLoading ? widgetRowsSkeleton
                    : pendingPayments.length === 0 ? (
                      <p className={`px-5 py-8 text-center text-[13px] ${subtext}`}>
                        {isBn ? 'কোনো পেমেন্ট যাচাইয়ের অপেক্ষায় নেই' : 'No payments awaiting review'}
                      </p>
                    ) : (
                      pendingPayments.slice(0, 5).map((p) => (
                        <button
                          key={p.id}
                          onClick={() => router.push('/super-admin/payments')}
                          className={`w-full text-left flex items-center gap-3 px-5 py-3 transition-colors ${isDark ? "hover:bg-white/[0.02]" : "hover:bg-zinc-50/50"}`}
                        >
                          <div className={`h-9 w-9 rounded-md flex items-center justify-center shrink-0 text-xs font-bold ${isDark ? 'bg-white/[0.06] text-zinc-400' : 'bg-zinc-100 text-zinc-500'}`}>
                            {p.institutionName.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium truncate ${isDark ? "text-zinc-200" : "text-zinc-700"}`}>{p.institutionName}</p>
                            <p className={`text-[11px] truncate ${subtext}`}>
                              {p.paymentMethod === 'BKASH' ? 'bKash' : 'Cash'} · {p.studentCount} {isBn ? 'জন' : 'student(s)'} · {formatDate(p.date)}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className={`text-sm font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>{formatCurrency(Number(p.amount || 0))}</p>
                            <p className={`text-[10px] ${subtext}`}>{formatDate(p.submittedAt || p.createdAt)}</p>
                          </div>
                        </button>
                      ))
                    )}
                </div>
              </div>
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
                          <p className={`text-[11px] truncate ${subtext}`}>{inst.address}</p>
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
                            className={`w-full rounded-t-md transition-all bg-brand-accent-strong`}
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
                        <p className={`text-[11px] ${subtext}`}>{isBn ? 'মোট প্রতিষ্ঠান' : 'Total Institutions'}</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>+{stats.institutions_pending}</p>
                        <p className={`text-[11px] ${subtext}`}>{isBn ? 'বাকি অনুমোদন' : 'Pending'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
