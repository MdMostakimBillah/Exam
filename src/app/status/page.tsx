"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { PublicNav } from "@/components/layout/public-nav";
import { lookupStudentApplicationStatus } from "@/lib/auth/student-apply";
import type { ApplicationStatus } from "@/lib/auth/student-apply";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useTheme } from "@/contexts/theme-context";
import { useLang } from "@/contexts/language-context";
import {
  Award,
  CalendarClock,
  Check,
  Loader2,
  Search,
  SearchX,
  UserCheck,
  Wallet,
  X,
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

/** Journey-stepper labels: Applied → Payment → Approval → Exam → Result. */
const STAGE_LABELS: { en: string; bn: string }[] = [
  { en: "Applied", bn: "আবেদন" },
  { en: "Payment", bn: "পেমেন্ট" },
  { en: "Approval", bn: "অনুমোদন" },
  { en: "Exam", bn: "পরীক্ষা" },
  { en: "Result", bn: "ফলাফল" },
];

type StageState = "done" | "current" | "todo" | "error";

/** Map the lookup payload onto the five journey stages. */
function stageStates(s: ApplicationStatus): StageState[] {
  // The Approval stage tracks the *application* status (mirrors the badge in
  // the identity card) — an ACTIVE student record alone is not an approval.
  const approved = s.applicationStatus === "APPROVED";
  const rejected = s.applicationStatus === "REJECTED";
  const examDone = ["EXAM_COMPLETED", "RESULT_PROCESSING", "PUBLISHED", "ARCHIVED"].includes(
    s.exam.status
  );
  const resultDone = s.result?.status === "PUBLISHED";
  const defs: { done: boolean; error?: boolean }[] = [
    { done: true },
    { done: s.paid },
    { done: approved, error: rejected },
    { done: examDone },
    { done: resultDone },
  ];
  let currentAssigned = false;
  return defs.map((d) => {
    if (d.done) return "done";
    if (d.error) {
      currentAssigned = true; // a rejection stops the journey — nothing after it is "next"
      return "error";
    }
    if (!currentAssigned) {
      currentAssigned = true;
      return "current";
    }
    return "todo";
  });
}

export default function StatusPage() {
  const { theme } = useTheme();
  const { lang } = useLang();
  const isDark = theme === "dark";
  const L = useCallback((en: string, bn: string) => (lang === "bn" ? bn : en), [lang]);

  const [regNumber, setRegNumber] = useState("");
  const [dob, setDob] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);
  const [status, setStatus] = useState<ApplicationStatus | null>(null);
  const outcomeRef = useRef<HTMLDivElement>(null);

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

  // Bring a fresh outcome into view (after commit — a rAF inside the handler
  // can fire before React paints the new cards).
  useEffect(() => {
    if (!status) return;
    const id = requestAnimationFrame(() =>
      outcomeRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    );
    return () => cancelAnimationFrame(id);
  }, [status]);

  const dateFmt = (value: string) =>
    value ? new Date(value).toLocaleDateString(lang === "bn" ? "bn-BD" : "en-GB") : "—";

  /* Polished field chrome (same as /apply): taller inputs, brand focus ring. */
  const labelCls = `flex items-center gap-1 text-[13px] font-medium mb-1.5 ${
    isDark ? "text-zinc-300" : "text-gray-700"
  }`;
  const fieldCls = `h-11 rounded-lg focus-visible:ring-[color:var(--brand-accent)] focus-visible:border-transparent hover:border-zinc-400/70 ${
    isDark ? "dark:hover:border-white/25" : ""
  }`;
  const panelCls = isDark ? "border-white/10 bg-white/[0.03]" : "border-gray-200 bg-white";
  const sectionIconCls = `flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
    isDark ? "bg-white/[0.06]" : "bg-gray-100"
  }`;

  const statusRow = (
    icon: React.ReactNode,
    title: string,
    valueBadge: React.ReactNode,
    detail?: React.ReactNode
  ) => (
    <div className={`flex items-start gap-3 rounded-lg border p-4 ${panelCls}`}>
      <div className={sectionIconCls}>{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className={`text-xs font-medium ${isDark ? "text-zinc-400" : "text-gray-600"}`}>
            {title}
          </span>
          {valueBadge}
        </div>
        {detail && (
          <div className={`mt-1 text-xs ${isDark ? "text-zinc-500" : "text-gray-500"}`}>{detail}</div>
        )}
      </div>
    </div>
  );

  const stages = status ? stageStates(status) : [];

  const stageCircle = (state: StageState, index: number) => {
    if (state === "done")
      return (
        <div data-state={state} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-500 text-white">
          <Check className="h-4 w-4" strokeWidth={3} />
        </div>
      );
    if (state === "error")
      return (
        <div data-state={state} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-500 text-white">
          <X className="h-4 w-4" strokeWidth={3} />
        </div>
      );
    if (state === "current")
      return (
        <div data-state={state} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-accent text-brand-accent-fg ring-4 ring-brand-accent/20">
          <span className="h-2 w-2 animate-pulse rounded-full bg-current" />
        </div>
      );
    return (
      <div
        data-state={state}
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-medium ${
          isDark
            ? "border-white/15 bg-zinc-900 text-zinc-500"
            : "border-gray-200 bg-white text-gray-400"
        }`}
      >
        {index + 1}
      </div>
    );
  };

  const stageTextCls = (state: StageState) =>
    state === "done"
      ? isDark
        ? "text-green-400"
        : "text-green-600"
      : state === "error"
        ? "text-red-500"
        : state === "current"
          ? isDark
            ? "text-zinc-100"
            : "text-gray-900"
          : isDark
            ? "text-zinc-600"
            : "text-gray-400";

  const published = status?.result?.status === "PUBLISHED";
  const scholarship = status?.result?.scholarshipStatus ?? "";
  const awarded = Boolean(scholarship && scholarship !== "NOT_ELIGIBLE" && scholarship !== "PENDING");

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#080808]" : "bg-gray-50"}`}>
      <PublicNav />

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
        <div className="text-center mb-6">
          <h1
            className={`text-2xl font-bold tracking-tight mb-2 ${isDark ? "text-zinc-100" : "text-gray-900"}`}
          >
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
          <CardContent className="p-5 sm:p-6">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSearch();
              }}
              className="space-y-3"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelCls} htmlFor="status-reg">
                    {L("Registration Number", "রেজিস্ট্রেশন নম্বর")}{" "}
                    <span className="text-red-500" aria-hidden="true">
                      *
                    </span>
                  </label>
                  <Input
                    id="status-reg"
                    className={fieldCls}
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
                    {L("Date of Birth", "জন্মতারিখ")}{" "}
                    <span className="text-red-500" aria-hidden="true">
                      *
                    </span>
                  </label>
                  <Input
                    id="status-dob"
                    className={`${fieldCls} pr-9`}
                    type="date"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                  />
                </div>
              </div>
              <Button
                type="submit"
                className="w-full h-11"
                disabled={loading || !SAFE_KEY.test(regNumber.trim()) || !dob}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Search className="h-4 w-4 mr-2" />
                )}
                {loading ? L("Checking…", "যাচাই হচ্ছে…") : L("Check Status", "অবস্থা দেখুন")}
              </Button>
            </form>
          </CardContent>
        </Card>

        {searched && !loading && error && !status && (
          <Card className="mt-6">
            <CardContent className="p-8 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
                <SearchX className="h-6 w-6 text-red-500" />
              </div>
              <p className={`text-sm ${isDark ? "text-zinc-400" : "text-gray-600"}`}>{error}</p>
              <p className={`mt-2 text-xs ${isDark ? "text-zinc-600" : "text-gray-400"}`}>
                {L(
                  "Both fields must exactly match your application. Need help? Contact your institution.",
                  "উভয় ঘর আপনার আবেদনের সঙ্গে মিলতে হবে। সাহায্য দরকার? আপনার প্রতিষ্ঠানের সঙ্গে যোগাযোগ করুন।"
                )}
              </p>
            </CardContent>
          </Card>
        )}

        {status && (
          <div ref={outcomeRef} className="mt-6 scroll-mt-20 space-y-4">
            {/* Journey stepper */}
            <Card>
              <CardContent className="p-5 sm:p-6">
                <div className="grid grid-cols-5 gap-1">
                  {stages.map((state, i) => {
                    const leftFilled = i > 0 && stages[i - 1] === "done";
                    const rightFilled = i < stages.length - 1 && state === "done";
                    const lineCls = (filled: boolean) =>
                      `h-0.5 flex-1 rounded-full ${
                        filled
                          ? "bg-green-500"
                          : isDark
                            ? "bg-white/10"
                            : "bg-gray-200"
                      }`;
                    return (
                      <div key={STAGE_LABELS[i].en} className="flex flex-col items-center gap-2">
                        <div className="flex w-full items-center">
                          <div
                            className={`${lineCls(leftFilled)} ${i === 0 ? "opacity-0" : ""}`}
                          />
                          {stageCircle(state, i)}
                          <div
                            className={`${lineCls(rightFilled)} ${
                              i === stages.length - 1 ? "opacity-0" : ""
                            }`}
                          />
                        </div>
                        <span
                          className={`text-center text-[10px] font-medium leading-tight ${stageTextCls(state)}`}
                        >
                          {lang === "bn" ? STAGE_LABELS[i].bn : STAGE_LABELS[i].en}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Identity card */}
            <Card>
              <CardContent className="p-5 sm:p-6">
                <div className="flex items-center gap-4">
                  {status.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={status.photoUrl}
                      alt={
                        lang === "bn" && status.studentNameBn
                          ? status.studentNameBn
                          : status.studentName
                      }
                      className={`h-14 w-14 shrink-0 rounded-full object-cover ring-1 ${
                        isDark ? "ring-white/15" : "ring-zinc-200"
                      }`}
                    />
                  ) : (
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-accent text-brand-accent-fg text-lg font-bold">
                      {(lang === "bn" && status.studentNameBn
                        ? status.studentNameBn
                        : status.studentName
                      )
                        .trim()
                        .charAt(0)
                        .toUpperCase() || "?"}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2
                        className={`truncate text-lg font-semibold ${
                          isDark ? "text-zinc-100" : "text-gray-900"
                        }`}
                      >
                        {lang === "bn" && status.studentNameBn ? status.studentNameBn : status.studentName}
                      </h2>
                      <Badge status={status.applicationStatus}>
                        {label(REG_LABELS, status.applicationStatus)}
                      </Badge>
                    </div>
                    <p className={`truncate text-sm ${isDark ? "text-zinc-500" : "text-gray-500"}`}>
                      {lang === "bn"
                        ? status.institutionName
                        : status.institutionNameEn || status.institutionName}
                      {" · "}
                      {status.className}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: L("Registration No", "রেজিস্ট্রেশন নম্বর"), value: status.registrationNumber },
                    { label: L("Roll", "রোল"), value: status.roll || "—" },
                    { label: L("Exam", "পরীক্ষা"), value: status.exam.name || "—" },
                    { label: L("Applied", "আবেদনের তারিখ"), value: dateFmt(status.appliedAt) },
                  ].map((item) => (
                    <div key={item.label}>
                      <span
                        className={`text-[10px] uppercase tracking-wider ${
                          isDark ? "text-zinc-600" : "text-gray-400"
                        }`}
                      >
                        {item.label}
                      </span>
                      <p
                        className={`text-sm mt-0.5 break-words ${
                          isDark ? "text-zinc-200" : "text-gray-800"
                        }`}
                      >
                        {item.value || "—"}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Status sections */}
            {statusRow(
              <Wallet
                className={`h-4 w-4 ${status.paid ? "text-green-500" : "text-amber-500"}`}
              />,
              L("Registration Fee Payment", "রেজিস্ট্রেশন ফি পেমেন্ট"),
              status.paid ? (
                <Badge status="PAID">{L("Paid", "পরিশোধিত")}</Badge>
              ) : (
                <Badge status="PAYMENT_PENDING">{L("Not paid", "পরিশোধ করা হয়নি")}</Badge>
              ),
              status.paid ? (
                <>
                  ৳{status.paidAmount ?? status.expectedFee}
                  {status.paidAt && <> · {dateFmt(status.paidAt)}</>}
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
              <UserCheck
                className={`h-4 w-4 ${
                  status.studentStatus === "ACTIVE"
                    ? "text-green-500"
                    : isDark
                      ? "text-zinc-400"
                      : "text-gray-500"
                }`}
              />,
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
                <div>
                  {status.exam.name}
                  {status.exam.examDate && (
                    <>
                      {" · "}
                      {L("Exam day", "পরীক্ষার দিন")}: {dateFmt(status.exam.examDate)}
                    </>
                  )}
                </div>
                {status.exam.startDate && status.exam.endDate && (
                  <div>
                    {L("Registration window", "নিবন্ধনের সময়")}: {dateFmt(status.exam.startDate)} –{" "}
                    {dateFmt(status.exam.endDate)}
                  </div>
                )}
              </>
            )}

            {/* Result — the payoff card */}
            <Card className={panelCls}>
              <CardContent className="p-5 sm:p-6">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className={sectionIconCls}>
                      <Award
                        className={`h-4 w-4 ${
                          published
                            ? "text-brand-accent"
                            : isDark
                              ? "text-zinc-400"
                              : "text-gray-500"
                        }`}
                      />
                    </div>
                    <span
                      className={`text-sm font-medium ${isDark ? "text-zinc-300" : "text-gray-700"}`}
                    >
                      {L("Result", "ফলাফল")}
                    </span>
                  </div>
                  {status.result ? (
                    <Badge status={status.result.status}>
                      {published ? L("Published", "প্রকাশিত") : L("Processing", "প্রক্রিয়ায়")}
                    </Badge>
                  ) : (
                    <Badge status="DRAFT">{L("Not published", "প্রকাশিত হয়নি")}</Badge>
                  )}
                </div>

                {published && status.result ? (
                  <>
                    <div className="mt-4 flex flex-wrap items-end gap-x-8 gap-y-4">
                      <div>
                        <div
                          className={`text-[10px] uppercase tracking-wider ${
                            isDark ? "text-zinc-600" : "text-gray-400"
                          }`}
                        >
                          {L("Grade", "গ্রেড")}
                        </div>
                        <div className="mt-1 text-4xl font-bold leading-none text-brand-accent">
                          {status.result.grade || "—"}
                        </div>
                      </div>
                      {[
                        {
                          label: L("Total", "মোট"),
                          value: `${status.result.totalMarks}/${status.result.totalFullMarks}`,
                        },
                        {
                          label: L("Percentage", "শতকরা"),
                          value: `${status.result.percentage.toFixed(1)}%`,
                        },
                        ...(status.result.position > 0
                          ? [
                              {
                                label: L("Position", "অবস্থান"),
                                value: String(status.result.position),
                              },
                            ]
                          : []),
                      ].map((stat) => (
                        <div key={stat.label}>
                          <div
                            className={`text-[10px] uppercase tracking-wider ${
                              isDark ? "text-zinc-600" : "text-gray-400"
                            }`}
                          >
                            {stat.label}
                          </div>
                          <div
                            className={`mt-1 text-lg font-semibold ${
                              isDark ? "text-zinc-100" : "text-gray-900"
                            }`}
                          >
                            {stat.value}
                          </div>
                        </div>
                      ))}
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${
                          status.result.pass
                            ? "border-green-500/20 bg-green-500/10 text-green-500"
                            : "border-red-500/20 bg-red-500/10 text-red-500"
                        }`}
                      >
                        {status.result.pass ? L("Pass", "উত্তীর্ণ") : L("Fail", "উত্তীর্ণ নয়")}
                      </span>
                    </div>

                    {awarded && (
                      <div className="mt-4 flex items-start gap-2 rounded-lg border border-green-500/20 bg-green-500/10 p-3">
                        <Award className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                        <p className="text-xs text-green-600 dark:text-green-400">
                          {L(
                            `Congratulations! You are eligible for the ${scholarship} scholarship.`,
                            `অভিনন্দন! আপনি ${scholarship} বৃত্তির জন্য যোগ্য।`
                          )}
                        </p>
                      </div>
                    )}

                    <div className="mt-4">
                      <Link
                        href={`/result?reg=${encodeURIComponent(status.registrationNumber)}`}
                        className="inline-flex items-center gap-1 text-sm font-medium text-brand-accent hover:underline"
                      >
                        {L("View full result →", "সম্পূর্ণ ফলাফল →")}
                      </Link>
                    </div>
                  </>
                ) : status.result ? (
                  <p className={`mt-3 text-sm ${isDark ? "text-zinc-500" : "text-gray-500"}`}>
                    {L(
                      "Marks entry / result processing is in progress. Your result will appear here once published.",
                      "নম্বর প্রবেশ / ফলাফল প্রক্রিয়া চলছে। প্রকাশিত হলে ফলাফল এখানে দেখা যাবে।"
                    )}
                  </p>
                ) : (
                  <p className={`mt-3 text-sm ${isDark ? "text-zinc-500" : "text-gray-500"}`}>
                    {L(
                      "The result has not been published yet. Check back later — you can search again with the same details.",
                      "ফলাফল এখনো প্রকাশিত হয়নি। পরে আবার দেখুন — একই তথ্য দিয়ে আবার যাচাই করতে পারেন।"
                    )}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
