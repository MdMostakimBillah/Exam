"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useStudentSession } from "@/lib/auth/student-auth";
import { useTheme } from "@/contexts/theme-context";
import { useLang } from "@/contexts/language-context";
import { cn } from "@/lib/utils/helpers";
import { formatDate } from "@/lib/storage/storage";
import { PageLoading } from "@/components/ui/page-loading";
import { useRegistrationsByStudent } from "@/lib/storage/registrations";
import { Registration } from "@/lib/types";
import {
  FileText,
  CreditCard,
  Clock,
  CheckCircle,
  XCircle,
  ChevronRight,
  AlertCircle,
  Loader2,
} from "lucide-react";

export default function StudentDashboardPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const { lang: language } = useLang();
  const isDark = theme === "dark";
  const isBn = language === "bn";

  const { data: student, isLoading: studentLoading } = useStudentSession();
  const { data: registrations = [], isLoading: registrationsLoading } = useRegistrationsByStudent(student?.id || '', {
    enabled: !!student?.id,
  });

  useEffect(() => {
    if (!studentLoading && !student) {
      router.push("/student/login");
    }
  }, [student, studentLoading, router]);

  if (studentLoading || !student) return <PageLoading isDark={isDark} />;

  const loading = registrationsLoading;

  const card = isDark
    ? "bg-[#141416] border border-white/[0.06] rounded-xl"
    : "bg-white border border-zinc-200 rounded-xl shadow-sm";
  const iconBg = isDark ? "bg-white/[0.08]" : "bg-zinc-100";
  const iconColor = isDark ? "text-zinc-300" : "text-zinc-600";

  const totalDue = registrations
    .filter((r) => r.paymentStatus !== "PAID" && r.studentPaymentStatus !== "VERIFIED")
    .reduce((sum, r) => sum + (r.paymentAmount || 0), 0);

  const pendingCount = registrations.filter(
    (r) => r.studentPaymentStatus === "NOT_SUBMITTED" || r.studentPaymentStatus === "REJECTED"
  ).length;

  const approvedCount = registrations.filter(
    (r) => r.status === "APPROVED" || r.studentPaymentStatus === "VERIFIED"
  ).length;

  const submittedCount = registrations.filter(
    (r) => r.studentPaymentStatus === "SUBMITTED"
  ).length;

  const statusBadge = (reg: Registration | undefined) => {
    if (!reg) return null;
    if (reg.status === "APPROVED" || reg.studentPaymentStatus === "VERIFIED") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-500/10 text-green-400 border border-green-500/20">
          <CheckCircle className="h-3 w-3" /> {isBn ? "অনুমোদিত" : "Approved"}
        </span>
      );
    }
    if (reg.studentPaymentStatus === "SUBMITTED") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
          <Clock className="h-3 w-3" /> {isBn ? "পরিশোধ প্রক্রিয়াধীন" : "Payment Review"}
        </span>
      );
    }
    if (reg.status === "REJECTED" || reg.studentPaymentStatus === "REJECTED") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-500/10 text-red-400 border border-red-500/20">
          <XCircle className="h-3 w-3" /> {isBn ? "প্রত্যাখ্যাত" : "Rejected"}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
        <AlertCircle className="h-3 w-3" /> {isBn ? "পরিশোধ বাকি" : "Payment Due"}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h1 className={`text-xl font-bold tracking-tight ${isDark ? "text-white" : "text-zinc-900"}`}>
          {isBn ? `স্বাগতম, ${student.firstName}` : `Welcome, ${student.firstName}`}
        </h1>
        <p className={`text-sm mt-1 ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>
          {student.institutionName} &middot; {student.class} {student.section && `- ${student.section}`}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: isBn ? "মোট নিবন্ধন" : "Total Registrations", value: registrations.length, icon: FileText },
          { label: isBn ? "অনুমোদিত" : "Approved", value: approvedCount, icon: CheckCircle },
          { label: isBn ? "পরিশোধ প্রক্রিয়াধীন" : "Pending Review", value: submittedCount, icon: Clock },
          { label: isBn ? "মোট বকেয়" : "Total Due", value: `৳${totalDue.toLocaleString()}`, icon: CreditCard },
        ].map((s) => (
          <div key={s.label} className={`${card} px-4 py-3 flex items-center gap-3`}>
            <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
              <s.icon className={`h-4 w-4 ${iconColor}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-base font-bold tracking-tight leading-tight ${isDark ? "text-white" : "text-zinc-900"}`}>
                {s.value}
              </p>
              <p className={`text-[10px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Registrations List */}
      <div className={card}>
        <div className={`px-5 py-4 border-b ${isDark ? "border-white/[0.06]" : "border-zinc-100"}`}>
          <div className="flex items-center gap-2">
            <FileText className={`h-4 w-4 ${isDark ? "text-zinc-400" : "text-zinc-500"}`} />
            <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>
              {isBn ? "আমার নিবন্ধন" : "My Registrations"}
            </h3>
            <span className={`text-[11px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
              ({registrations.length})
            </span>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className={`h-6 w-6 animate-spin ${iconColor}`} />
          </div>
        ) : registrations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className={`h-12 w-12 rounded-lg flex items-center justify-center mb-3 ${iconBg}`}>
              <FileText className={`h-6 w-6 ${iconColor}`} />
            </div>
            <p className={`text-sm font-medium ${isDark ? "text-white" : "text-zinc-900"}`}>
              {isBn ? "কোনো নিবন্ধন নেই" : "No registrations found"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-white/[0.04]">
            {registrations.map((reg) => (
              <div
                key={reg.id}
                className={`px-5 py-4 flex items-center justify-between gap-4 ${
                  isDark ? "hover:bg-white/[0.02]" : "hover:bg-zinc-50/50"
                } transition-colors`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className={`text-sm font-medium truncate ${isDark ? "text-zinc-100" : "text-zinc-800"}`}>
                      {reg.examName}
                    </p>
                    {statusBadge(reg)}
                  </div>
                  <div className="flex items-center gap-3 text-[11px]">
                    <span className={isDark ? "text-zinc-500" : "text-zinc-400"}>
                      {isBn ? "নিবন্ধন" : "Registration"}: {reg.registrationNumber}
                    </span>
                    <span className={isDark ? "text-zinc-500" : "text-zinc-400"}>
                      {isBn ? "তারিখ" : "Date"}: {formatDate(reg.createdAt).split(",")[0]}
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <p className={`text-sm font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>
                    ৳{reg.paymentAmount?.toLocaleString()}
                  </p>
                  {(reg.studentPaymentStatus === "NOT_SUBMITTED" || reg.studentPaymentStatus === "REJECTED") && (
                    <Link
                      href={`/student/payments/${reg.id}/submit`}
                      className={cn(
                        "inline-flex items-center gap-1 text-[11px] font-medium mt-1 transition-colors",
                        isDark ? "text-blue-400 hover:text-blue-300" : "text-blue-600 hover:text-blue-700"
                      )}
                    >
                      {isBn ? "পরিশোধ করুন" : "Pay Now"} <ChevronRight className="h-3 w-3" />
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
