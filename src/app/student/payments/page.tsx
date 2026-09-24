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
import { usePaymentsByStudent } from "@/lib/storage/payments";
import {
  CreditCard,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  ChevronRight,
} from "lucide-react";

export default function StudentPaymentsPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const { lang: language } = useLang();
  const isDark = theme === "dark";
  const isBn = language === "bn";

  const { data: student, isLoading: studentLoading } = useStudentSession();
  const { data: payments = [], isLoading: paymentsLoading } = usePaymentsByStudent(student?.id || '', {
    enabled: !!student?.id,
  });

  useEffect(() => {
    if (!studentLoading && !student) {
      router.push("/student/login");
    }
  }, [student, studentLoading, router]);

  if (studentLoading || !student) return <PageLoading isDark={isDark} />;

  const loading = paymentsLoading;

  const card = isDark
    ? "bg-[#141416] border border-white/[0.06] rounded-xl"
    : "bg-white border border-zinc-200 rounded-xl shadow-sm";
  const iconBg = "bg-brand-accent-soft";
  const iconColor = "text-brand-accent";

  const statusBadge = (status: string) => {
    if (status === "PAID") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-500/10 text-green-400 border border-green-500/20">
          <CheckCircle className="h-3 w-3" /> {isBn ? "যাচাইকৃত" : "Verified"}
        </span>
      );
    }
    if (status === "PENDING") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
          <Clock className="h-3 w-3" /> {isBn ? "পরিশোধ প্রক্রিয়াধীন" : "Pending"}
        </span>
      );
    }
    if (status === "FAILED") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-500/10 text-red-400 border border-red-500/20">
          <XCircle className="h-3 w-3" /> {isBn ? "বাতিল" : "Rejected"}
        </span>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className={`text-xl font-bold tracking-tight ${isDark ? "text-white" : "text-zinc-900"}`}>
          {isBn ? "পেমেন্ট ইতিহাস" : "Payment History"}
        </h1>
        <p className={`text-sm mt-1 ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>
          {isBn ? "আপনার সমস্ত পেমেন্ট দেখুন" : "View all your submitted payments"}
        </p>
      </div>

      <div className={card}>
        <div className={`px-5 py-4 border-b ${isDark ? "border-white/[0.06]" : "border-zinc-100"}`}>
          <div className="flex items-center gap-2">
            <CreditCard className={`h-4 w-4 ${isDark ? "text-zinc-400" : "text-zinc-500"}`} />
            <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>
              {isBn ? "পেমেন্ট তালিকা" : "Payments"}
            </h3>
            <span className={`text-[11px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
              ({payments.length})
            </span>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className={`h-6 w-6 animate-spin ${iconColor}`} />
          </div>
        ) : payments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className={`h-12 w-12 rounded-lg flex items-center justify-center mb-3 ${iconBg}`}>
              <CreditCard className={`h-6 w-6 ${iconColor}`} />
            </div>
            <p className={`text-sm font-medium ${isDark ? "text-white" : "text-zinc-900"}`}>
              {isBn ? "কোনো পেমেন্ট নেই" : "No payments found"}
            </p>
            <Link
              href="/student/dashboard"
              className={cn(
                "mt-3 text-xs font-medium transition-colors",
                isDark ? "text-zinc-400 hover:text-white" : "text-zinc-500 hover:text-zinc-900"
              )}
            >
              {isBn ? "ড্যাশবোর্ডে ফিরুন" : "Back to Dashboard"}
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-white/[0.04]">
            {payments.map((payment) => (
              <div
                key={payment.id}
                className={`px-5 py-4 ${isDark ? "hover:bg-white/[0.02]" : "hover:bg-zinc-50/50"} transition-colors`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className={`text-sm font-medium truncate ${isDark ? "text-zinc-100" : "text-zinc-800"}`}>
                        {payment.examName}
                      </p>
                      {statusBadge(payment.status)}
                    </div>
                    <div className="flex items-center gap-3 text-[11px]">
                      <span className={isDark ? "text-zinc-500" : "text-zinc-400"}>
                        {isBn ? "ট্রানজেকশন" : "TX"}: {payment.transactionId}
                      </span>
                      <span className={isDark ? "text-zinc-500" : "text-zinc-400"}>
                        {isBn ? "রসিদ" : "Receipt"}: {payment.receiptNumber}
                      </span>
                    </div>
                    {payment.rejectionReason && (
                      <p className="text-[11px] text-red-400 mt-1">
                        {isBn ? "কারণ" : "Reason"}: {payment.rejectionReason}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>
                      ৳{payment.amount.toLocaleString()}
                    </p>
                    <p className={`text-[10px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
                      {formatDate(payment.createdAt).split(",")[0]}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
