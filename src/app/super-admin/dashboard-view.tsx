"use client";
import { useMemo, Fragment } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import {
  Building2, Users, FileText, DollarSign, ArrowRight, TrendingUp, GraduationCap,
  CheckCircle, ClipboardList, Wallet, AlertTriangle, CreditCard,
  BadgeCheck, UserPlus, Clock,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTheme } from "@/contexts/theme-context";
import { useLang } from "@/contexts/language-context";
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

/**
 * Epoch ms of midnight in Asia/Dhaka (UTC+6, no DST) for the day `now` falls
 * on. The server stores UTC timestamps, so "today" is derived here rather than
 * via `new Date().setHours(0,0,0,0)`, which would use the browser's timezone.
 */
function startOfDhakaDay(now: Date = new Date()): number {
  const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000;
  const local = new Date(now.getTime() + DHAKA_OFFSET_MS);
  return (
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) -
    DHAKA_OFFSET_MS
  );
}

/**
 * KPI card in the dashboard's original style: accent icon tile on the left,
 * value over label.
 */
function StatCard({
  icon: Icon,
  label,
  value,
  href,
  isDark,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  href: string;
  isDark: boolean;
}) {
  const shell = isDark
    ? "bg-[#141416] border border-white/[0.06] hover:border-white/[0.1] transition-colors rounded-md"
    : "bg-white border border-zinc-200 hover:border-zinc-300 transition-colors rounded-md shadow-sm";
  return (
    <Link href={href} className="block">
      <div className={`${shell} px-4 py-3 flex items-center gap-3`}>
        <div className="h-10 w-10 rounded-md flex items-center justify-center shrink-0 bg-brand-accent-soft">
          <Icon className="h-5 w-5 text-brand-accent" />
        </div>
        <div className="flex-1 min-w-0">
          {/* truncate keeps a long currency figure from widening the card on a phone */}
          <p className={`text-base sm:text-lg font-bold tracking-tight leading-tight truncate ${isDark ? "text-white" : "text-zinc-900"}`}>{value}</p>
          <p className={`text-[11px] truncate ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>{label}</p>
        </div>
      </div>
    </Link>
  );
}

function DashboardSkeleton({ isDark }: { isDark: boolean }) {
  const sk = isDark ? "bg-white/[0.05]" : "bg-zinc-200/70";
  return (
    <div className="animate-pulse">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={`t${i}`} className={`h-[66px] rounded-md ${sk}`} />
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={`a${i}`} className={`h-[66px] rounded-md ${sk}`} />
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

  // ---- Today (Asia/Dhaka) metrics, derived from the already-fetched lists ----
  const dayStartMs = startOfDhakaDay();
  const isToday = (iso?: string) => (iso ? new Date(iso).getTime() >= dayStartMs : false);

  const today = useMemo(() => {
    const paidToday = payments.filter((p) => p.status === "PAID" && isToday(p.createdAt));
    const dueToday = payments.filter((p) => p.status === "PENDING" && isToday(p.createdAt));
    const regToday = registrations.filter((r) => isToday(r.createdAt));
    // Approved today = approval timestamp (updatedAt) landed today, not merely
    // an old registration that still carries APPROVED.
    const approvedToday = registrations.filter(
      (r) => r.status === "APPROVED" && isToday(r.updatedAt)
    );
    return {
      due: dueToday.reduce((s, p) => s + Number(p.amount || 0), 0),
      paid: paidToday.length,
      registrations: regToday.length,
      approved: approvedToday.length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payments, registrations, dayStartMs]);

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

  // ---- Institutions-added graph (current year, one bar per month) ----
  const year = new Date().getFullYear();
  const monthlyInstitutions = useMemo(() => Array.from({ length: 12 }, (_, i) =>
    institutions.filter(inst => {
      const d = new Date(inst.createdAt);
      return d.getFullYear() === year && d.getMonth() === i;
    }).length
  ), [institutions, year]);
  const maxMonthly = useMemo(() => Math.max(...monthlyInstitutions, 1), [monthlyInstitutions]);
  const addedThisYear = useMemo(
    () => monthlyInstitutions.reduce((sum, n) => sum + n, 0),
    [monthlyInstitutions]
  );

  const card = isDark
    ? "bg-[#141416] border border-white/[0.06] rounded-md"
    : "bg-white border border-zinc-200 rounded-md shadow-sm";
  const subtext = isDark ? "text-zinc-500" : "text-zinc-400";
  const shimmer = isDark ? "bg-white/[0.04]" : "bg-zinc-100";

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

  // KPI grids — kept as data so adding a card is a one-line change.
  const todayCards = [
    { icon: CreditCard, label: isBn ? 'আজ পরিশোধিত' : "Today's Paid", value: today.paid, href: '/super-admin/payments' },
    { icon: Clock, label: isBn ? 'আজকের বকেয়া' : "Today's Due", value: formatCurrency(today.due), href: '/super-admin/payments' },
    { icon: UserPlus, label: isBn ? 'আজকের নিবন্ধন' : "Today's Registrations", value: today.registrations, href: '/super-admin/registrations' },
    { icon: BadgeCheck, label: isBn ? 'আজ অনুমোদিত' : "Today's Approved", value: today.approved, href: '/super-admin/registrations' },
  ];

  const overviewCards = [
    { icon: Building2, label: isBn ? 'মোট প্রতিষ্ঠান' : 'Total Institutions', value: stats.institutions_total, href: '/super-admin/institutions' },
    { icon: Users, label: isBn ? 'মোট শিক্ষার্থী' : 'Total Students', value: stats.students_total, href: '/super-admin/students' },
    { icon: FileText, label: isBn ? 'সক্রিয় পরীক্ষা' : 'Active Exams', value: stats.exams_active, href: '/super-admin/exams' },
    { icon: GraduationCap, label: isBn ? 'ফলাফল' : 'Results Published', value: stats.results_total, href: '/super-admin/results' },
    { icon: TrendingUp, label: isBn ? 'মোট আয়' : 'Total Revenue', value: formatCurrency(stats.payments_total), href: '/super-admin/payments' },
    { icon: DollarSign, label: isBn ? 'বকেয়া' : 'Total Due', value: formatCurrency(stats.payments_due), href: '/super-admin/payments' },
    { icon: ClipboardList, label: isBn ? 'নিবন্ধিত' : 'Registered', value: stats.registrations_total, href: '/super-admin/registrations' },
    { icon: CheckCircle, label: isBn ? 'অনুমোদিত' : 'Approved', value: stats.registrations_approved, href: '/super-admin/registrations' },
  ];

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0a0a0b]" : "bg-zinc-50"}`}>
      <LoadingBar isLoading={!!isLoading} />
      <div className="max-w-[1600px] mx-auto p-4 sm:p-6 lg:p-8">
        {/* Header — simple; the session lives in the topbar selector */}
        <div className="mb-8">
          <h1 className={`text-2xl lg:text-3xl font-bold tracking-tight ${isDark ? "text-white" : "text-zinc-900"}`}>
            {isBn ? 'বিএমএ-তে স্বাগতম' : 'Welcome to BMA'}
          </h1>
          <p className={`text-sm mt-1.5 ${subtext}`}>
            {isBn ? 'বাংলাদেশ মাদ্রাসা এসোসিয়েশন পরিচালনা করুন' : 'Manage Bangladesh Madrasah Association operations'}
          </p>
        </div>

        {/* Stats error — surface it instead of showing silent zeros */}
        {statsQuery.isError && (
          <div className={`mb-6 flex items-center gap-2.5 px-4 py-3 rounded-lg border text-[13px] ${isDark ? "border-red-500/30 bg-red-500/10 text-red-400" : "border-red-200 bg-red-50 text-red-600"}`}>
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
            {/* Today — Asia/Dhaka day, recomputed against the live lists */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {todayCards.map((s) => (
                <StatCard key={s.label} {...s} isDark={isDark} />
              ))}
            </div>

            {/* Overview — lifetime totals */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {overviewCards.map((s) => (
                <StatCard key={s.label} {...s} isDark={isDark} />
              ))}
            </div>

            {/* Actionable queues */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6">
              {/* Pending registrations */}
              <div className={card}>
                <div className={`p-4 sm:p-5 border-b flex flex-wrap items-center justify-between gap-2 ${isDark ? "border-white/[0.06]" : "border-zinc-100"}`}>
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
                <div className={`p-4 sm:p-5 border-b flex flex-wrap items-center justify-between gap-2 ${isDark ? "border-white/[0.06]" : "border-zinc-100"}`}>
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
            <div className="grid grid-cols-12 gap-4 sm:gap-6">
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
                    {institutions.length === 0 && (
                      <p className={`px-5 py-8 text-center text-[13px] ${subtext}`}>
                        {isBn ? 'কোনো প্রতিষ্ঠান নেই' : 'No institutions yet'}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Institutions Added graph */}
              <div className="col-span-12 lg:col-span-5">
                <div className={`${card} h-full`}>
                  <div className={`p-5 border-b ${isDark ? "border-white/[0.06]" : "border-zinc-100"}`}>
                    <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>
                      {isBn ? 'প্রতিষ্ঠান যোগ' : 'Institutions Added'}
                    </h3>
                  </div>
                  <div className="p-5">
                    {addedThisYear === 0 ? (
                      <div className="h-32 flex flex-col items-center justify-center gap-1 text-center">
                        <p className={`text-[13px] ${subtext}`}>
                          {isBn ? 'এই বছর কোনো প্রতিষ্ঠান যোগ হয়নি' : 'No institutions added this year'}
                        </p>
                        <Link href="/super-admin/institutions" className={`text-xs font-medium ${isDark ? 'text-zinc-500 hover:text-zinc-300' : 'text-zinc-400 hover:text-zinc-600'}`}>
                          {isBn ? 'প্রতিষ্ঠান দেখুন' : 'View institutions'}
                        </Link>
                      </div>
                    ) : (
                      <Fragment>
                        {/*
                          Each column is h-full inside the h-32 track, giving the
                          bar a definite containing block. The old markup sized
                          bars with % inside an auto-height flex column, which the
                          browser resolves to auto (0px), so nothing rendered.
                        */}
                        <div className="flex items-end gap-2 h-32">
                          {monthlyInstitutions.map((h, i) => {
                            const pct = h > 0 ? Math.max((h / maxMonthly) * 100, 8) : 0;
                            return (
                              <div
                                key={i}
                                className="flex-1 h-full flex flex-col justify-end items-center gap-1"
                              >
                                {h > 0 && (
                                  <span className={`text-[9px] font-bold leading-none ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
                                    {h}
                                  </span>
                                )}
                                <div
                                  className="w-full rounded-t-md transition-all bg-brand-accent-strong"
                                  style={{ height: `${pct}%` }}
                                  title={`${h} ${isBn ? 'টি প্রতিষ্ঠান' : 'institutions'}`}
                                />
                              </div>
                            );
                          })}
                        </div>
                        <div className="flex gap-2 mt-3">
                          {['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'].map((m, i) => (
                            <span key={`${m}${i}`} className={`flex-1 text-center text-[9px] ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>{m}</span>
                          ))}
                        </div>
                      </Fragment>
                    )}
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
