"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  getApplyFormOptions,
  submitStudentApplication,
} from "@/lib/auth/student-apply";
import type { ApplyOptions, ApplyResult } from "@/lib/auth/student-apply";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "@/contexts/theme-context";
import { useLang } from "@/contexts/language-context";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  ClipboardList,
  Loader2,
  UserPlus,
} from "lucide-react";

const NAME_RE = /^[\p{L}\p{M}][\p{L}\p{M} .'’\-]{1,59}$/u;
const PHONE_RE = /^[0-9+][0-9+\-() ]{5,19}$/;
const GENDERS = ["MALE", "FEMALE", "OTHER"] as const;

/** Bilingual exam-status labels (tracking shown on /apply and /status). */
const EXAM_STATUS_LABELS: Record<string, { en: string; bn: string }> = {
  DRAFT: { en: "Being prepared", bn: "প্রস্তুতি চলছে" },
  OPEN: { en: "Registration open", bn: "নিবন্ধন খোলা" },
  CLOSED: { en: "Registration closed", bn: "নিবন্ধন বন্ধ" },
  EXAM_COMPLETED: { en: "Exam completed", bn: "পরীক্ষা সম্পন্ন" },
  RESULT_PROCESSING: { en: "Result processing", bn: "ফলাফল প্রক্রিয়ায়" },
  PUBLISHED: { en: "Result published", bn: "ফলাফল প্রকাশিত" },
  ARCHIVED: { en: "Archived", bn: "সংরক্ষিত" },
};

type Step = 1 | 2 | 3;

const emptyForm = {
  institutionId: "",
  classId: "",
  englishName: "",
  banglaName: "",
  dateOfBirth: "",
  gender: "MALE",
  fatherName: "",
  motherName: "",
  phone: "",
  address: "",
  roll: "",
};

export default function ApplyPage() {
  const { theme } = useTheme();
  const { t, lang } = useLang();
  const isDark = theme === "dark";
  const L = useCallback((en: string, bn: string) => (lang === "bn" ? bn : en), [lang]);
  const exLabel = (status: string) => {
    const entry = EXAM_STATUS_LABELS[status];
    return entry ? (lang === "bn" ? entry.bn : entry.en) : status;
  };

  const [options, setOptions] = useState<ApplyOptions | null>(null);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [optionsError, setOptionsError] = useState("");

  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState(emptyForm);
  const [fieldError, setFieldError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [done, setDone] = useState<ApplyResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await getApplyFormOptions();
      if (cancelled) return;
      setOptions(res);
      setOptionsLoading(false);
      if (!res.ok) setOptionsError(res.error || "");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const set = (key: keyof typeof emptyForm, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const validDate = (dob: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) return false;
    const parsed = new Date(`${dob}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime())) return false;
    if (parsed.toISOString().slice(0, 10) !== dob) return false;
    const year = parsed.getUTCFullYear();
    return year >= 2000 && year <= new Date().getUTCFullYear();
  };

  const validateStep = useCallback((): string => {
    if (step === 1) {
      if (!form.institutionId)
        return L("Please select your institution.", "অনুগ্রহ করে আপনার প্রতিষ্ঠান নির্বাচন করুন।");
      if (!form.classId)
        return L("Please select your class.", "অনুগ্রহ করে আপনার শ্রেণি নির্বাচন করুন।");
      return "";
    }
    if (!NAME_RE.test(form.englishName.trim()))
      return L(
        "Enter the student's name in English (2–60 letters).",
        "শিক্ষার্থীর নাম (ইংরেজি) লিখুন (২-৬০ অক্ষর)।"
      );
    if (!validDate(form.dateOfBirth))
      return L("Please enter a valid date of birth.", "অনুগ্রহ করে সঠিক জন্মতারিখ দিন।");
    if (!GENDERS.includes(form.gender as (typeof GENDERS)[number]))
      return L("Please select gender.", "অনুগ্রহ করে লিঙ্গ নির্বাচন করুন।");
    if (!NAME_RE.test(form.fatherName.trim()))
      return L(
        "Enter the father's / guardian's name.",
        "পিতা / অভিভাবকের নাম লিখুন।"
      );
    if (!PHONE_RE.test(form.phone.trim()))
      return L("Please enter a valid phone number.", "অনুগ্রহ করে সঠিক ফোন নম্বর দিন।");
    if (form.address.trim().length < 3 || form.address.trim().length > 120)
      return L(
        "Please enter the present address (3–120 characters).",
        "বর্তমান ঠিকানা লিখুন (৩-১২০ অক্ষর)।"
      );
    if (form.roll.trim() && !/^\d{1,6}$/.test(form.roll.trim()))
      return L("Please enter a valid roll number.", "অনুগ্রহ করে সঠিক রোল নম্বর দিন।");
    return "";
  }, [step, form, L]);

  const handleNext = () => {
    const err = validateStep();
    if (err) {
      setFieldError(err);
      return;
    }
    setFieldError("");
    setStep((s) => (s + 1) as Step);
  };

  const handleBack = () => {
    setFieldError("");
    setSubmitError("");
    setStep((s) => (s - 1) as Step);
  };

  const handleSubmit = async () => {
    const err = validateStep();
    if (err) {
      setFieldError(err);
      return;
    }
    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await submitStudentApplication({
        institutionId: form.institutionId,
        classId: form.classId,
        englishName: form.englishName.trim(),
        banglaName: form.banglaName.trim() || undefined,
        dateOfBirth: form.dateOfBirth,
        gender: form.gender,
        fatherName: form.fatherName.trim(),
        motherName: form.motherName.trim() || undefined,
        phone: form.phone.trim(),
        address: form.address.trim(),
        roll: form.roll.trim() || undefined,
      });
      if (res.ok && res.registrationNumber) {
        setDone(res);
      } else {
        setSubmitError(res.error || L("Could not submit. Please try again.", "জমা দেওয়া যায়নি। আবার চেষ্টা করুন।"));
      }
    } catch {
      setSubmitError(L("Could not submit. Please try again.", "জমা দেওয়া যায়নি। আবার চেষ্টা করুন।"));
    } finally {
      setSubmitting(false);
    }
  };

  const selectedInstitution = options?.institutions?.find(
    (i) => i.id === form.institutionId
  );
  const selectedClass = options?.classes?.find((c) => c.id === form.classId);

  /* ---------------------------------------------------------------- */
  /* Success screen                                                    */
  /* ---------------------------------------------------------------- */
  if (done) {
    const instName =
      lang === "bn"
        ? done.institutionName
        : done.institutionNameEn || done.institutionName;
    return (
      <div className={`min-h-screen ${isDark ? "bg-[#080808]" : "bg-gray-50"}`}>
        <main className="max-w-2xl mx-auto px-6 py-16">
          <Card>
            <CardContent className="p-8 text-center space-y-6">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-500/10">
                <CheckCircle className="h-7 w-7 text-green-500" />
              </div>
              <div>
                <h1 className={`text-xl font-bold mb-1 ${isDark ? "text-zinc-100" : "text-gray-900"}`}>
                  {done.alreadyApplied
                    ? L("You have already applied", "আপনি ইতিমধ্যে আবেদন করেছেন")
                    : L("Application submitted!", "আবেদন জমা হয়েছে!")}
                </h1>
                <p className={`text-sm ${isDark ? "text-zinc-500" : "text-gray-500"}`}>
                  {done.alreadyApplied
                    ? L(
                        "An application already exists for this student. Keep this registration number.",
                        "এই শিক্ষার্থীর জন্য আবেদন ইতিমধ্যে আছে। এই রেজিস্ট্রেশন নম্বরটি সংরক্ষণ করুন।"
                      )
                    : L(
                        "Save your registration number — you will need it with your date of birth to check the status.",
                        "আপনার রেজিস্ট্রেশন নম্বরটি সংরক্ষণ করুন — অবস্থা জানতে এটি জন্মতারিখসহ লাগবে।"
                      )}
                </p>
              </div>

              <div className={`rounded-lg border p-5 ${isDark ? "border-white/10 bg-white/5" : "border-gray-200 bg-gray-50"}`}>
                <span className={`text-[10px] uppercase tracking-wider ${isDark ? "text-zinc-500" : "text-gray-500"}`}>
                  {L("Registration Number", "রেজিস্ট্রেশন নম্বর")}
                </span>
                <p className={`mt-1 text-2xl font-bold tracking-widest ${isDark ? "text-zinc-50" : "text-gray-900"}`}>
                  {done.registrationNumber}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-left">
                {[
                  { label: L("Student", "শিক্ষার্থী"), value: done.studentName },
                  { label: L("Institution", "প্রতিষ্ঠান"), value: instName },
                  { label: L("Class", "শ্রেণি"), value: done.className },
                  { label: L("Examination", "পরীক্ষা"), value: done.examName },
                ].map((item) => (
                  <div key={item.label}>
                    <span className={`text-[10px] uppercase tracking-wider ${isDark ? "text-zinc-600" : "text-gray-400"}`}>
                      {item.label}
                    </span>
                    <p className={`text-sm mt-0.5 ${isDark ? "text-zinc-200" : "text-gray-800"}`}>
                      {item.value || "—"}
                    </p>
                  </div>
                ))}
              </div>

              <div className={`rounded-md border p-4 text-left text-xs leading-relaxed ${
                isDark ? "border-amber-500/20 bg-amber-500/5 text-amber-200/90" : "border-amber-200 bg-amber-50 text-amber-800"
              }`}>
                {L(
                  "Pay the registration fee in cash at your institution — no online payment is needed. Your institution will record the payment; afterwards the status below will show it as paid.",
                  "রেজিস্ট্রেশন ফি আপনার প্রতিষ্ঠানে নগদ পরিশোধ করুন — কোনো অনলাইন পেমেন্ট প্রয়োজন নেই। প্রতিষ্ঠান পেমেন্ট রেকর্ড করবে; তারপর নিচের অবস্থায় পরিশোধিত দেখাবে।"
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Link href={`/status?reg=${encodeURIComponent(done.registrationNumber || "")}`} className="flex-1">
                  <Button className="w-full">
                    <ClipboardList className="h-4 w-4 mr-2" />
                    {L("Track Application", "আবেদনের অবস্থা দেখুন")}
                  </Button>
                </Link>
                <Link href="/" className="flex-1">
                  <Button variant="secondary" className="w-full">
                    {L("Back to Home", "হোমে ফিরুন")}
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /* Form                                                              */
  /* ---------------------------------------------------------------- */
  const labelCls = `block text-xs mb-1 ${isDark ? "text-zinc-500" : "text-gray-500"}`;

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#080808]" : "bg-gray-50"}`}>
      <header className={`border-b backdrop-blur-xl ${isDark ? "border-white/[0.06] bg-[#080808]/80" : "border-gray-200 bg-white/80"}`}>
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className={`flex h-8 w-8 items-center justify-center rounded-md font-bold text-sm ${"bg-brand-accent text-brand-accent-fg"}`}>B</div>
            <span className={`text-sm font-semibold ${isDark ? "text-zinc-100" : "text-gray-900"}`}>{t("brand")}</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/status" className={`text-xs ${isDark ? "text-zinc-500 hover:text-zinc-300" : "text-gray-500 hover:text-gray-900"}`}>
              {L("Track Application", "অবস্থা দেখুন")}
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

      <main className="max-w-2xl mx-auto px-6 py-12">
        <div className="text-center mb-6">
          <h1 className={`text-2xl font-bold tracking-tight mb-2 ${isDark ? "text-zinc-100" : "text-gray-900"}`}>
            {L("Apply for Examination", "পরীক্ষায় আবেদন করুন")}
          </h1>
          <p className={`text-sm ${isDark ? "text-zinc-500" : "text-gray-500"}`}>
            {L(
              "Select your institution and register as a candidate. It takes about two minutes.",
              "আপনার প্রতিষ্ঠান নির্বাচন করে পরীক্ষার্থী হিসেবে নিবন্ধন করুন। প্রায় দুই মিনিট সময় লাগবে।"
            )}
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-1.5 mb-6">
          {[
            { n: 1 as Step, label: L("Institution", "প্রতিষ্ঠান") },
            { n: 2 as Step, label: L("Student Info", "তথ্য") },
            { n: 3 as Step, label: L("Review", "পর্যালোচনা") },
          ].map((s) => (
            <div key={s.n} className="flex items-center gap-1.5">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium transition-colors ${
                  step >= s.n
                    ? "border-brand-accent/30 bg-brand-accent-soft text-brand-accent"
                    : isDark
                      ? "border-white/10 text-zinc-600"
                      : "border-gray-200 text-gray-400"
                }`}
              >
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded-full text-[9px] ${
                    step >= s.n ? "bg-brand-accent text-brand-accent-fg" : "bg-transparent border border-current"
                  }`}
                >
                  {s.n}
                </span>
                {s.label}
              </span>
              {s.n < 3 && <div className={`h-px w-4 ${isDark ? "bg-white/10" : "bg-gray-200"}`} />}
            </div>
          ))}
        </div>

        {optionsLoading && (
          <Card>
            <CardContent className="p-10 flex items-center justify-center gap-3">
              <Loader2 className={`h-5 w-5 animate-spin ${isDark ? "text-zinc-500" : "text-gray-400"}`} />
              <span className={`text-sm ${isDark ? "text-zinc-500" : "text-gray-500"}`}>
                {L("Loading form…", "ফর্ম লোড হচ্ছে…")}
              </span>
            </CardContent>
          </Card>
        )}

        {!optionsLoading && optionsError && (
          <Card>
            <CardContent className="p-6 text-center space-y-3">
              <p className={`text-sm ${isDark ? "text-amber-300" : "text-amber-700"}`}>
                {options?.examStatus && options.examName
                  ? L(
                      `Registration is not open right now. The examination "${options.examName}" has status "${exLabel(options.examStatus)}" — students can only apply while the exam status is Open.`,
                      `এখন নিবন্ধন খোলা নেই। "${options.examName}"পরীক্ষার বর্তমান স্ট্যাটাস "${exLabel(options.examStatus)}" — পরীক্ষার স্ট্যাটাস খোলা থাকলে তবেই শিক্ষার্থীরা আবেদন করতে পারবে।`
                    )
                  : optionsError}
              </p>
              {options?.examStatus && (
                <div className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs ${isDark ? "border-white/10 bg-white/5 text-zinc-300" : "border-gray-200 bg-gray-50 text-gray-700"}`}>
                  <span className="font-medium">{options.examName}</span>
                  <Badge status={options.examStatus}>{exLabel(options.examStatus)}</Badge>
                </div>
              )}
              <div>
                <Link href="/">
                  <Button variant="secondary">
                    {L("Back to Home", "হোমে ফিরুন")}
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {!optionsLoading && options?.ok && (
          <>
            {/* Exam banner */}
            <div className={`mb-4 rounded-lg border px-4 py-3 text-xs ${isDark ? "border-white/10 bg-white/5 text-zinc-400" : "border-gray-200 bg-white text-gray-600"}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  <span className={`font-medium ${isDark ? "text-zinc-200" : "text-gray-900"}`}>
                    {options.exam?.name}
                  </span>
                  {options.sessionName && <span className="opacity-70"> · {options.sessionName}</span>}
                  {options.exam?.status && (
                    <Badge status={options.exam.status} className="ml-2 align-middle">
                      {exLabel(options.exam.status)}
                    </Badge>
                  )}
                </span>
                <span>
                  {L("Fee", "ফি")}: <span className={`font-semibold ${isDark ? "text-zinc-100" : "text-gray-900"}`}>৳{options.exam?.fee}</span>
                  {options.exam?.examDate && (
                    <span className="opacity-70">
                      {" · "}
                      {L("Exam", "পরীক্ষা")}: {new Date(options.exam.examDate).toLocaleDateString(lang === "bn" ? "bn-BD" : "en-GB")}
                    </span>
                  )}
                </span>
              </div>
            </div>

            <Card>
              <CardContent className="p-6 space-y-4">
                {submitError && (
                  <div className={`rounded-md border px-3 py-2 text-xs ${isDark ? "border-red-500/20 bg-red-500/10 text-red-300" : "border-red-200 bg-red-50 text-red-700"}`}>
                    {submitError}
                  </div>
                )}

                {/* ---------- Step 1 ---------- */}
                {step === 1 && (
                  <div className="space-y-4">
                    <div>
                      <label className={labelCls} htmlFor="apply-institution">
                        {L("Your Institution", "আপনার প্রতিষ্ঠান")}
                      </label>
                      <Select
                        id="apply-institution"
                        value={form.institutionId}
                        onChange={(e) => set("institutionId", e.target.value)}
                        placeholder={L("Select institution…", "প্রতিষ্ঠান নির্বাচন করুন…")}
                        options={(options.institutions ?? []).map((i) => ({
                          value: i.id,
                          label:
                            lang === "bn"
                              ? i.name + (i.district ? ` (${i.district})` : "")
                              : (i.nameEn || i.name) + (i.district ? ` (${i.district})` : ""),
                        }))}
                      />
                      <p className={`mt-1 text-[11px] ${isDark ? "text-zinc-600" : "text-gray-400"}`}>
                        {L(
                          "Only students enrolled at a registered institution can apply.",
                          "নিবন্ধিত প্রতিষ্ঠানে ভর্থি শিক্ষার্থীরাই আবেদন করতে পারবে।"
                        )}
                      </p>
                    </div>
                    <div>
                      <label className={labelCls} htmlFor="apply-class">
                        {L("Class", "শ্রেণি")}
                      </label>
                      <Select
                        id="apply-class"
                        value={form.classId}
                        onChange={(e) => set("classId", e.target.value)}
                        placeholder={L("Select class…", "শ্রেণি নির্বাচন করুন…")}
                        options={(options.classes ?? []).map((c) => ({
                          value: c.id,
                          label: c.name,
                        }))}
                      />
                    </div>
                  </div>
                )}

                {/* ---------- Step 2 ---------- */}
                {step === 2 && (
                  <div className="space-y-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className={labelCls} htmlFor="apply-name">
                          {L("Student Name (English)", "শিক্ষার্থীর নাম (ইংরেজি)")} *
                        </label>
                        <Input
                          id="apply-name"
                          value={form.englishName}
                          onChange={(e) => set("englishName", e.target.value)}
                          placeholder="e.g. Abdul Karim"
                          maxLength={60}
                          autoComplete="off"
                        />
                      </div>
                      <div>
                        <label className={labelCls} htmlFor="apply-name-bn">
                          {L("Student Name (Bangla)", "শিক্ষার্থীর নাম (বাংলা)")}
                        </label>
                        <Input
                          id="apply-name-bn"
                          value={form.banglaName}
                          onChange={(e) => set("banglaName", e.target.value)}
                          placeholder="আব্দুল করিম"
                          maxLength={80}
                          autoComplete="off"
                        />
                      </div>
                      <div>
                        <label className={labelCls} htmlFor="apply-dob">
                          {L("Date of Birth", "জন্মতারিখ")} *
                        </label>
                        <Input
                          id="apply-dob"
                          type="date"
                          value={form.dateOfBirth}
                          onChange={(e) => set("dateOfBirth", e.target.value)}
                        />
                      </div>
                      <div>
                        <label className={labelCls} htmlFor="apply-gender">
                          {L("Gender", "লিঙ্গ")} *
                        </label>
                        <Select
                          id="apply-gender"
                          value={form.gender}
                          onChange={(e) => set("gender", e.target.value)}
                          options={[
                            { value: "MALE", label: L("Male", "পুরুষ") },
                            { value: "FEMALE", label: L("Female", "নারী") },
                            { value: "OTHER", label: L("Other", "অন্যান্য") },
                          ]}
                        />
                      </div>
                      <div>
                        <label className={labelCls} htmlFor="apply-father">
                          {L("Father / Guardian Name", "পিতা / অভিভাবকের নাম")} *
                        </label>
                        <Input
                          id="apply-father"
                          value={form.fatherName}
                          onChange={(e) => set("fatherName", e.target.value)}
                          maxLength={60}
                          autoComplete="off"
                        />
                      </div>
                      <div>
                        <label className={labelCls} htmlFor="apply-mother">
                          {L("Mother Name", "মাতার নাম")}
                        </label>
                        <Input
                          id="apply-mother"
                          value={form.motherName}
                          onChange={(e) => set("motherName", e.target.value)}
                          maxLength={60}
                          autoComplete="off"
                        />
                      </div>
                      <div>
                        <label className={labelCls} htmlFor="apply-phone">
                          {L("Phone", "ফোন")} *
                        </label>
                        <Input
                          id="apply-phone"
                          value={form.phone}
                          onChange={(e) => set("phone", e.target.value)}
                          placeholder="01XXXXXXXXX"
                          maxLength={20}
                          inputMode="tel"
                          autoComplete="tel"
                        />
                      </div>
                      <div>
                        <label className={labelCls} htmlFor="apply-roll">
                          {L("Class Roll (optional)", "ক্লাস রোল (ঐচ্ছিক)")}
                        </label>
                        <Input
                          id="apply-roll"
                          value={form.roll}
                          onChange={(e) => set("roll", e.target.value)}
                          placeholder="e.g. 12"
                          maxLength={6}
                          inputMode="numeric"
                        />
                      </div>
                    </div>
                    <div>
                      <label className={labelCls} htmlFor="apply-address">
                        {L("Present Address", "বর্তমান ঠিকানা")} *
                      </label>
                      <Input
                        id="apply-address"
                        value={form.address}
                        onChange={(e) => set("address", e.target.value)}
                        placeholder={L("Village / Road, Upazila, District", "গ্রাম/রোড, উপজেলা, জেলা")}
                        maxLength={120}
                        autoComplete="street-address"
                      />
                    </div>
                  </div>
                )}

                {/* ---------- Step 3: review ---------- */}
                {step === 3 && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        {
                          label: L("Institution", "প্রতিষ্ঠান"),
                          value:
                            lang === "bn"
                              ? selectedInstitution?.name
                              : selectedInstitution?.nameEn || selectedInstitution?.name,
                        },
                        { label: L("Class", "শ্রেণি"), value: selectedClass?.name },
                        { label: L("Student Name (English)", "নাম (ইংরেজি)"), value: form.englishName.trim() },
                        { label: L("Student Name (Bangla)", "নাম (বাংলা)"), value: form.banglaName.trim() || "—" },
                        { label: L("Date of Birth", "জন্মতারিখ"), value: form.dateOfBirth },
                        {
                          label: L("Gender", "লিঙ্গ"),
                          value:
                            form.gender === "MALE" ? L("Male", "পুরুষ") : form.gender === "FEMALE" ? L("Female", "নারী") : L("Other", "অন্যান্য"),
                        },
                        { label: L("Father / Guardian", "পিতা / অভিভাবক"), value: form.fatherName.trim() },
                        { label: L("Mother", "মাতা"), value: form.motherName.trim() || "—" },
                        { label: L("Phone", "ফোন"), value: form.phone.trim() },
                        { label: L("Class Roll", "ক্লাস রোল"), value: form.roll.trim() || "—" },
                        { label: L("Address", "ঠিকানা"), value: form.address.trim() },
                        { label: L("Examination Fee", "রেজিস্ট্রেশন ফি"), value: `৳${options.exam?.fee ?? 0}` },
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
                    <div className={`rounded-md border p-4 text-xs leading-relaxed ${
                      isDark ? "border-white/10 bg-white/5 text-zinc-400" : "border-gray-200 bg-gray-50 text-gray-600"
                    }`}>
                      {L(
                        "By submitting, you confirm the information is correct. Pay the fee in cash at your institution — there is no online payment. Keep the registration number to track your application.",
                        "জমা দেওয়ার আগে নিশ্চিত করুন যে তথ্য সঠিক। ফি প্রতিষ্ঠানে নগদ পরিশোধ করুন — অনলাইন পেমেন্ট নেই। আবেদন ট্র্যাক করতে রেজিস্ট্রেশন নম্বর সংরক্ষণ করুন।"
                      )}
                    </div>
                  </div>
                )}

                {fieldError && (
                  <p className={`text-xs ${isDark ? "text-red-400" : "text-red-600"}`}>{fieldError}</p>
                )}

                {/* Navigation */}
                <div className="flex items-center justify-between pt-2">
                  {step > 1 ? (
                    <Button variant="ghost" onClick={handleBack} disabled={submitting}>
                      <ArrowLeft className="h-4 w-4 mr-1" />
                      {L("Back", "পিছনে")}
                    </Button>
                  ) : (
                    <span />
                  )}
                  {step < 3 ? (
                    <Button onClick={handleNext}>
                      {L("Continue", "এগিয়ে যান")} <ArrowRight className="h-4 w-4 ml-1" />
                    </Button>
                  ) : (
                    <Button onClick={handleSubmit} disabled={submitting}>
                      {submitting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          {L("Submitting…", "জমা হচ্ছে…")}
                        </>
                      ) : (
                        <>
                          <UserPlus className="h-4 w-4 mr-2" />
                          {L("Submit Application", "আবেদন জমা দিন")}
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            <p className={`mt-4 text-center text-xs ${isDark ? "text-zinc-600" : "text-gray-400"}`}>
              {L("Already applied?", "আবেদন করেছেন?")}{" "}
              <Link href="/status" className="text-brand-accent hover:underline">
                {L("Track your application →", "আবেদনের অবস্থা দেখুন →")}
              </Link>
            </p>
          </>
        )}
      </main>
    </div>
  );
}
