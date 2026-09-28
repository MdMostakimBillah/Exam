"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { lookupStudentApplicationStatus } from "@/lib/auth/student-apply";
import type { ApplicationStatus } from "@/lib/auth/student-apply";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTheme } from "@/contexts/theme-context";
import { useLang } from "@/contexts/language-context";
import {
  Award,
  CalendarClock,
  Loader2,
  Search,
  UserCheck,
  Wallet,
  XCircle,
} from "lucide-react";

const SAFE_KEY = /^[A-Za-z0-9][A-Za-z0-9 _\-/:.]{2,39}$/;

const REG_LABELS: Record<string, { en: string; bn: string }> = {
  PENDING: { en: "Awaiting approval", bn: "অনুমোদনের অপেক্ষায়" },
  VERIFIED: { en: "Verified", bn: "যাচাইকৃত" },
  PAYMENT_PENDING: { en: "Payment pending", bn: "পেমেন্ট বাকি" },
  APPROVED: { en: "Approved", bn: "অনুমোদিত" },
  REJECTED: { en: "Rejected", bn: "প্রত্যাখ্যাত" },
};

const STUDENT_LABELS: Record<string, { en: string; bn: string }> = {
  ACTIVE: { en: "Active", bn: "সক্রিয়" },
  PENDING: { en: "Awaiting verification", bn: "যাচাইয়ের অপেক্ষায়" },
  INACTIVE: { en: "Inactive", bn: "নিষ্ক্রিয়" },
  SUSPENDED: { en: "Suspended", bn: "স্থগিত" },
};

const EXAM_LABELS: Record<string, { en: string; bn: string }> = {
  DRAFT: { en: "Being prepared", bn: "প্রস্তুতি চলছে" },
  OPEN: { en: "Registration open", bn: "নিবন্ধন খোলা" },
  CLOSED: { en: "Registration closed", bn: "নিবন্ধন বন্ধ" },
  EXAM_COMPLETED: { en: "Exam completed", bn: "পরীক্ষা সম্পন্ন" },
  RESULT_PROCESSING: { en: "Result processing", bn: "ফলাফল প্রক্রিয়ায়" },
  PUBLISHED: { en: "Result published", bn: "ফলাফল প্রকাশিত" },
  ARCHIVED: { en: "Archived", bn: "সংরক্ষিত" },
};

export default function StatusPage() {
  const { theme } = useTheme();
  const { t, lang } = useLang();
  const isDark = theme === "dark";
  const L = useCallback((en: string, bn: string) => (lang === "bn" ? bn : en), [lang]);

  const [regNumber, setRegNumber] = useState("");
  const [dob, setDob] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);
  const [status, setStatus] = useState<ApplicationStatus | null>(null);

  // /status?reg=REGNO from the apply success screen.
  useEffect(() => {
    const reg = new URLSearchParams(window.location.search).get("reg");
    if (reg) setRegNumber(reg);
  }, []);

  const label = (map: Record<string, { en: string; bn: string }>, key: string) => {
    const entry = map[key];
    if (!entry) return key;
    return lang === "bn" ? entry.bn : entry.en;
  };

  const handleSearch = useCallback(async () => {
    const reg = regNumber.trim();
    if (!reg) return;
    setSearched(true);
    setStatus(null);
    setError("");
    setLoading(true);
    try {
      const res = await lookupStudentApplicationStatus({
        registrationNumber: reg,
        dob,
      });
      if (res.ok) {
        setStatus(res.status ?? null);
        if (!res.status) {
          setError(
            L(
              "No application found for this registration number and date of birth. Check both fields and try again.",
              "এই রেজিস্ট্রেশন নম্বর ও জন্মতারিখে কোনো আবেদন পাওয়া যায়নি। উভয় ঘর দেখে আবার চেষ্টা করুন।"
            )
          );
        }
      } else {
        setError(res.error || L("Lookup failed. Please try again.", "লুকআপ ব্যর্থ। আবার চেষ্টা করুন।"));
      }
    } catch {
      setError(L("Lookup failed. Please try again.", "লুকআপ ব্যর্থ। আবার চেষ্টা করুন।"));
    } finally {
      setLoading(false);
    }
  }, [regNumber, dob, L]);

  const labelCls = `block text-xs mb-1 ${isDark ? "text-zinc-500" : "text-gray-500"}`;
  const sectionIconCls = `flex h-8 w-8 items-center justify-center rounded-md`;

  const statusRow = (
    icon: React.ReactNode,
    title: string,
    valueBadge: React.ReactNode,
    detail?: React.ReactNode
  ) => (
    <div className={`flex items-start gap-3 rounded-lg border p-4 ${isDark ? "border-white/10 bg-white/[0.03]" : "border-gray-200 bg-white"}`}>
      <div className={sectionIconCls}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className={`text-xs font-medium ${isDark ? "text-zinc-400" : "text-gray-600"}`}>{title}</span>
          {valueBadge}
        </div>
        {detail && <div className={`mt-1 text-xs ${isDark ? "text-zinc-500" : "text-gray-500"}`}>{detail}</div>}
      </div>
    </div>
  );

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#080808]" : "bg-gray-50"}`}>
      <header className={`border-b backdrop-blur-xl ${isDark ? "border-white/[0.06] bg-[#080808]/80" : "border-gray-200 bg-white/80"}`}>
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className={`flex h-8 w-8 items-center justify-center rounded-md font-bold text-sm ${"bg-brand-accent text-brand-accent-fg"}`}>B</div>
            <span className={`text-sm font-semibold ${isDark ? "text-zinc-100" : "text-gray-900"}`}>{t("brand")}</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/apply" className={`text-xs ${isDark ? "text-zinc-500 hover:text-zinc-300" : "text-gray-500 hover:text-gray-900"}`}>
              {L("Apply", "আবেদন")}
            </Link>
            <Link href="/result" className={`text-xs ${isDark ? "text-zinc-500 hover:text-zinc-300" : "text-gray-500 hover:text-gray-900"}`}>
              {t("nav.results")}
            </Link>
            <Link href="/login" className={`text-xs ${isDark ? "text-zinc-500 hover:text-zinc-300" : "text-gray-500 hover:text-gray-900"}`}>
              {t("nav.signIn")}
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-16">
        <div className="text-center mb-8">
          <h1 className={`text-2xl font-bold tracking-tight mb-2 ${isDark ? "text-zinc-100" : "text-gray-900"}`}>
            {L("Track Application Status", "আবেদনের অবস্থা দেখুন")}
          </h1>
          <p className={`text-sm ${isDark ? "text-zinc-500" : "text-gray-500"}`}>
            {L(
              "Enter your registration number and date of birth to see payment, approval, exam and result status.",
              "পেমেন্ট, অনুমোদন, পরীক্ষা ও ফলাফলের অবস্থা দেখতে রেজিস্ট্রেশন নম্বর ও জন্মতারিখ দিন।"
            )}
          </p>
        </div>

        <Card>
          <CardContent className="p-6">
            <div className="space-y-3">
              <div>
                <label className={labelCls} htmlFor="status-reg">
                  {L("Registration Number", "রেজিস্ট্রেশন নম্বর")}
                </label>
                <Input
                  id="status-reg"
                  value={regNumber}
                  onChange={(e) => setRegNumber(e.target.value)}
                  placeholder="e.g. 2026000012"
                  maxLength={40}
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
              <div>
                <label className={labelCls} htmlFor="status-dob">
                  {L("Date of Birth", "জন্মতারিখ")}
                </label>
                <Input id="status-dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
              </div>
              <Button
                onClick={handleSearch}
                disabled={loading || !SAFE_KEY.test(regNumber.trim()) || !dob}
                className="w-full"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Search className="h-4 w-4 mr-2" />
                )}
                {loading ? L("Checking…", "যাচাই হচ্ছে…") : L("Check Status", "অবস্থা দেখুন")}
              </Button>
            </div>
          </CardContent>
        </Card>

        {searched && !loading && error && !status && (
          <div className="mt-6 text-center py-8">
            <XCircle className="h-10 w-10 text-zinc-700 mx-auto mb-3" />
            <p className={`text-sm ${isDark ? "text-zinc-500" : "text-gray-500"}`}>{error}</p>
          </div>
        )}

        {status && (
          <div className="mt-6 space-y-4">
            {/* Identity card */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="truncate">
                    {lang === "bn" && status.studentNameBn ? status.studentNameBn : status.studentName}
                  </CardTitle>
                  <Badge status={status.applicationStatus}>
                    {label(REG_LABELS, status.applicationStatus)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-6 pt-0 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    {
                      label: L("Institution", "প্রতিষ্ঠান"),
                      value:
                        lang === "bn"
                          ? status.institutionName
                          : status.institutionNameEn || status.institutionName,
                    },
                    { label: L("Class", "শ্রেণি"), value: status.className },
                    { label: L("Exam", "পরীক্ষা"), value: status.exam.name },
                    { label: L("Registration No", "রেজিস্ট্রেশন নম্বর"), value: status.registrationNumber },
                    { label: L("Roll", "রোল"), value: status.roll || "—" },
                    {
                      label: L("Applied", "আবেদনের তারিখ"),
                      value: status.appliedAt
                        ? new Date(status.appliedAt).toLocaleDateString(lang === "bn" ? "bn-BD" : "en-GB")
                        : "—",
                    },
                  ].map((item) => (
                    <div key={item.label}>
                      <span className={`text-[10px] uppercase tracking-wider ${isDark ? "text-zinc-600" : "text-gray-400"}`}>
                        {item.label}
                      </span>
                      <p className={`text-sm mt-0.5 break-words ${isDark ? "text-zinc-200" : "text-gray-800"}`}>
                        {item.value || "—"}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Status sections */}
            {statusRow(
              <Wallet className={`h-4 w-4 ${status.paid ? "text-green-500" : "text-amber-500"}`} />,
              L("Registration Fee Payment", "রেজিস্ট্রেশন ফি পেমেন্ট"),
              status.paid ? (
                <Badge status="PAID">{L("Paid", "পরিশোধিত")}</Badge>
              ) : (
                <Badge status="PAYMENT_PENDING">{L("Not paid", "পরিশোধ করা হয়নি")}</Badge>
              ),
              status.paid ? (
                <>
                  ৳{status.paidAmount ?? status.expectedFee}
                  {status.paidAt && (
                    <> · {new Date(status.paidAt).toLocaleDateString(lang === "bn" ? "bn-BD" : "en-GB")}</>
                  )}
                </>
              ) : (
                <>
                  {L(
                    `Pay ৳${status.expectedFee} in cash at your institution — no online payment. The status will change to Paid once your institution records it.`,
                    `আপনার প্রতিষ্ঠানে নগদ ৳${status.expectedFee} পরিশোধ করুন — অনলাইন পেমেন্ট নেই। প্রতিষ্ঠান রেকর্ড করলে অবস্থা "পরিশোধিত" হবে।`
                  )}
                </>
              )
            )}

            {statusRow(
              <UserCheck className={`h-4 w-4 ${status.studentStatus === "ACTIVE" ? "text-green-500" : isDark ? "text-zinc-400" : "text-gray-500"}`} />,
              L("Student Record", "শিক্ষার্থী রেকর্ড"),
              <Badge status={status.studentStatus}>{label(STUDENT_LABELS, status.studentStatus)}</Badge>,
              status.studentStatus === "ACTIVE"
                ? L("Your institution has verified your registration.", "আপনার প্রতিষ্ঠান আপনার নিবন্ধন যাচাই করেছে।")
                : L(
                    "Your institution must verify this record — contact them if this stays unchanged.",
                    "প্রতিষ্ঠানকে এই রেকর্ড যাচাই করতে হবে — পরিবর্তন না হলে তাদের সঙ্গে যোগাযোগ করুন।"
                  )
            )}

            {statusRow(
              <CalendarClock className={`h-4 w-4 ${isDark ? "text-sky-400" : "text-sky-500"}`} />,
              L("Examination", "পরীক্ষা"),
              <Badge status={status.exam.status}>{label(EXAM_LABELS, status.exam.status)}</Badge>,
              <>
                {status.exam.name}
                {status.exam.examDate && (
                  <>
                    {" · "}
                    {L("Exam day", "পরীক্ষার দিন")}:{" "}
                    {new Date(status.exam.examDate).toLocaleDateString(lang === "bn" ? "bn-BD" : "en-GB")}
                  </>
                )}
              </>
            )}

            {statusRow(
              <Award className={`h-4 w-4 ${status.result?.status === "PUBLISHED" ? "text-green-500" : isDark ? "text-zinc-400" : "text-gray-500"}`} />,
              L("Result", "ফলাফল"),
              status.result ? (
                <Badge status={status.result.status}>
                  {status.result.status === "PUBLISHED" ? L("Published", "প্রকাশিত") : L("Processing", "প্রক্রিয়ায়")}
                </Badge>
              ) : (
                <Badge status="DRAFT">{L("Not published", "প্রকাশিত হয়নি")}</Badge>
              ),
              status.result?.status === "PUBLISHED" ? (
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className={`font-medium ${isDark ? "text-zinc-200" : "text-gray-800"}`}>
                    {L("Grade", "গ্রেড")}: {status.result.grade || "—"}
                  </span>
                  <span>
                    {L("Total", "মোট")}: {status.result.totalMarks}/{status.result.totalFullMarks}
                  </span>
                  <span>{status.result.percentage.toFixed(1)}%</span>
                  {status.result.position > 0 && <span>{L("Position", "অবস্থান")}: {status.result.position}</span>}
                  <Link href={`/result?reg=${encodeURIComponent(status.registrationNumber)}`} className="text-brand-accent hover:underline">
                    {L("View full result →", "সম্পূর্ণ ফলাফল →")}
                  </Link>
                </span>
              ) : status.result ? (
                L("Marks entry / result processing is in progress.", "নম্বর প্রবেশ / ফলাফল প্রক্রিয়া চলছে।")
              ) : (
                L("The result has not been published yet. Check back later.", "ফলাফল এখনো প্রকাশিত হয়নি। পরে আবার দেখুন।")
              )
            )}
          </div>
        )}
      </main>
    </div>
  );
}
