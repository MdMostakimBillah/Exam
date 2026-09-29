"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
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
import { useBranding, BRANDING_DEFAULTS } from "@/lib/storage/branding";
import { MAX_IMAGE_SIZE } from "@/lib/utils/helpers";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  CheckCircle,
  ChevronDown,
  ClipboardList,
  Globe,
  Loader2,
  Moon,
  Sun,
  UserPlus,
  X,
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

/** Required-field marker (labels stay bilingual, the asterisk does not). */
function Req() {
  return (
    <span className="text-red-500" aria-hidden="true">
      *
    </span>
  );
}

/** `appearance-none` Selects have no native arrow — draw one ourselves. */
function SelectShell({ dark, children }: { dark: boolean; children: ReactNode }) {
  return (
    <div className="relative">
      {children}
      <ChevronDown
        className={`pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 ${
          dark ? "text-zinc-500" : "text-gray-400"
        }`}
      />
    </div>
  );
}

type PhotoResult =
  | { ok: true; dataUrl: string }
  | { ok: false; code: "TYPE" | "READ" | "SIZE" };

/**
 * Read the applicant's photo while keeping it under MAX_IMAGE_SIZE (350KB):
 * a small standard photo is stored as-is, a big camera photo is scaled to at
 * most 1024px and re-encoded as JPEG on a canvas. Returns an error CODE so
 * the caller translates it bilingually.
 */
async function readPhotoFile(file: File): Promise<PhotoResult> {
  if (!file.type.startsWith("image/")) return { ok: false, code: "TYPE" };

  const maxChars = Math.ceil((MAX_IMAGE_SIZE * 4) / 3) + 64;

  // Fast path — small JPG/PNG/WebP needs no re-encoding (keeps PNG edges sharp).
  if (
    ["image/jpeg", "image/png", "image/webp"].includes(file.type) &&
    file.size <= MAX_IMAGE_SIZE
  ) {
    const dataUrl = await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () =>
        resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
    if (dataUrl) return { ok: true, dataUrl };
    return { ok: false, code: "READ" };
  }

  // Too big (or an odd type): scale down + re-encode JPEG.
  try {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();

      const naturalMax = Math.max(img.naturalWidth, img.naturalHeight);
      if (naturalMax < 1) return { ok: false, code: "READ" };

      let side = Math.min(1024, naturalMax);
      let quality = 0.85;

      const encode = (): string => {
        const scale = side / naturalMax;
        const w = Math.max(1, Math.round(img.naturalWidth * scale));
        const h = Math.max(1, Math.round(img.naturalHeight * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return "";
        // JPEG has no alpha — paint white first so transparent PNGs
        // don't come out with black corners.
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        return canvas.toDataURL("image/jpeg", quality);
      };

      let out = encode();
      while (out.length > maxChars && (quality > 0.35 || side > 400)) {
        if (quality > 0.35) quality = Math.max(0.35, +(quality - 0.15).toFixed(2));
        else {
          side = Math.round(side * 0.7);
          quality = 0.85;
        }
        out = encode();
      }
      if (!out || out.length > maxChars) return { ok: false, code: "SIZE" };
      return { ok: true, dataUrl: out };
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch {
    return { ok: false, code: "READ" };
  }
}

export default function ApplyPage() {
  const { theme, toggleTheme } = useTheme();
  const { t, lang, setLang } = useLang();
  const isDark = theme === "dark";
  const L = useCallback((en: string, bn: string) => (lang === "bn" ? bn : en), [lang]);

  // Super-admin branding — the top bar shows the real logo/name instead of
  // the hardcoded "B" placeholder (same fallback chain as the landing page).
  const { data: brandData } = useBranding();
  const b = { ...BRANDING_DEFAULTS, ...(brandData ?? {}) };
  const brandName = (lang === "bn" ? b.brandNameBn : b.brandName) || t("brand");
  const brandLetter = brandName.trim().charAt(0).toUpperCase() || "B";
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

  // Optional applicant photo (base64 data URL, ≤350KB after readPhotoFile).
  const [photo, setPhoto] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    setPhotoError("");
    setPhotoBusy(true);
    try {
      const res = await readPhotoFile(file);
      if (res.ok) setPhoto(res.dataUrl);
      else
        setPhotoError(
          res.code === "TYPE"
            ? L("Please choose an image file (JPG, PNG or WebP).", "অনুগ্রহ করে ছবি নির্বাচন করুন (JPG, PNG বা WebP)।")
            : res.code === "SIZE"
              ? L("This photo is still too large. Please choose a smaller one (max 350KB).", "ছবির আকার এখনও বেশি। ছোট ছবি নির্বাচন করুন (সর্বোচ্চ 350KB)।")
              : L("Could not read this photo. Please try another one.", "ছবিটি পড়া যায়নি। অন্য একটি ছবি দিন।")
        );
    } finally {
      setPhotoBusy(false);
    }
  };

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
    // A photo the browser couldn't read must be fixed or explicitly
    // dismissed — never silently dropped from the application.
    if (photoError)
      return L(
        "Could not attach the student photo — choose another one or dismiss the message.",
        "শিক্ষার্থীর ছবি যুক্ত হয়নি — অন্য ছবি দিন বা বার্তাটি বাতিল করুন।"
      );
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
  }, [step, form, photoError, L]);

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
    if (photoBusy) return; // photo still being read/resized
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
        photo: photo || undefined,
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
  // Polished field chrome: taller inputs, softer corners, brand-colored
  // focus ring and a labeled asterisk instead of a bare "*" in the text.
  const labelCls = `flex items-center gap-1 text-[13px] font-medium mb-1.5 ${isDark ? "text-zinc-300" : "text-gray-700"}`;
  const fieldCls = `h-11 rounded-lg focus-visible:ring-[color:var(--brand-accent)] focus-visible:border-transparent hover:border-zinc-400/70 ${isDark ? "dark:hover:border-white/25" : ""}`;
  // Selects are `appearance-none` (own chevron) and date inputs have the
  // native picker icon — both need room on the right.
  const selectCls = `${fieldCls} pr-9`;
  const hintCls = `mt-1.5 text-[11px] ${isDark ? "text-zinc-600" : "text-gray-400"}`;
  const navPill = isDark
    ? "text-zinc-400 hover:text-white hover:bg-white/[0.07]"
    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100";
  const iconPill = isDark
    ? "text-zinc-400 hover:text-white hover:bg-white/[0.07]"
    : "text-gray-500 hover:text-gray-900 hover:bg-gray-100";

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#080808]" : "bg-gray-50"}`}>
      <header className={`sticky top-0 z-50 border-b backdrop-blur-xl ${isDark ? "border-white/[0.06] bg-[#080808]/80" : "border-gray-200 bg-white/80"}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-3">
          <Link href="/" className="group flex min-w-0 items-center gap-2.5">
            {b.brandLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={b.brandLogo}
                alt={brandName}
                className={`h-8 w-8 sm:h-9 sm:w-9 shrink-0 rounded-full object-contain bg-white/90 ring-1 ${isDark ? "ring-white/15" : "ring-zinc-200"}`}
              />
            ) : (
              <div className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-full bg-brand-accent text-brand-accent-fg text-sm font-bold">
                {brandLetter}
              </div>
            )}
            <span className={`truncate text-sm font-semibold transition-opacity group-hover:opacity-75 max-w-[45vw] sm:max-w-[320px] ${isDark ? "text-zinc-100" : "text-gray-900"}`}>
              {brandName}
            </span>
          </Link>

          <nav className="flex shrink-0 items-center gap-0.5 sm:gap-1.5">
            <Link
              href="/status"
              className={`hidden sm:inline-flex items-center rounded-md px-3 py-2 text-xs font-medium transition-colors ${navPill}`}
            >
              {L("Track Application", "অবস্থা দেখুন")}
            </Link>
            <Link
              href="/result"
              className={`hidden md:inline-flex items-center rounded-md px-3 py-2 text-xs font-medium transition-colors ${navPill}`}
            >
              {t("nav.results")}
            </Link>
            <button
              type="button"
              onClick={() => setLang(lang === "en" ? "bn" : "en")}
              aria-label={lang === "bn" ? "Switch to English" : "বাংলায় দেখুন"}
              className={`rounded-md p-2 transition-colors ${iconPill}`}
            >
              <Globe className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={isDark ? "Light mode" : "Dark mode"}
              className={`rounded-md p-2 transition-colors ${iconPill}`}
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <Link
              href="/login"
              className={`inline-flex h-9 items-center rounded-md px-3 sm:px-4 text-xs font-medium transition-all hover:opacity-90 bg-brand-accent text-brand-accent-fg`}
            >
              {t("nav.signIn")}
            </Link>
          </nav>
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
                  <div className="space-y-5">
                    <div>
                      <label className={labelCls} htmlFor="apply-institution">
                        {L("Your Institution", "আপনার প্রতিষ্ঠান")} <Req />
                      </label>
                      <SelectShell dark={isDark}>
                        <Select
                          id="apply-institution"
                          className={selectCls}
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
                      </SelectShell>
                      <p className={hintCls}>
                        {L(
                          "Only students enrolled at a registered institution can apply.",
                          "নিবন্ধিত প্রতিষ্ঠানে ভর্থি শিক্ষার্থীরাই আবেদন করতে পারবে।"
                        )}
                      </p>
                    </div>
                    <div>
                      <label className={labelCls} htmlFor="apply-class">
                        {L("Class", "শ্রেণি")} <Req />
                      </label>
                      <SelectShell dark={isDark}>
                        <Select
                          id="apply-class"
                          className={selectCls}
                          value={form.classId}
                          onChange={(e) => set("classId", e.target.value)}
                          placeholder={L("Select class…", "শ্রেণি নির্বাচন করুন…")}
                          options={(options.classes ?? []).map((c) => ({
                            value: c.id,
                            label: c.name,
                          }))}
                        />
                      </SelectShell>
                    </div>
                  </div>
                )}

                {/* ---------- Step 2 ---------- */}
                {step === 2 && (
                  <div className="space-y-5">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className={labelCls} htmlFor="apply-name">
                          {L("Student Name (English)", "শিক্ষার্থীর নাম (ইংরেজি)")} <Req />
                        </label>
                        <Input
                          id="apply-name"
                          className={fieldCls}
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
                          className={fieldCls}
                          value={form.banglaName}
                          onChange={(e) => set("banglaName", e.target.value)}
                          placeholder="আব্দুল করিম"
                          maxLength={80}
                          autoComplete="off"
                        />
                      </div>
                      <div>
                        <label className={labelCls} htmlFor="apply-dob">
                          {L("Date of Birth", "জন্মতারিখ")} <Req />
                        </label>
                        <Input
                          id="apply-dob"
                          type="date"
                          className={selectCls}
                          value={form.dateOfBirth}
                          onChange={(e) => set("dateOfBirth", e.target.value)}
                        />
                      </div>
                      <div>
                        <label className={labelCls} htmlFor="apply-gender">
                          {L("Gender", "লিঙ্গ")} <Req />
                        </label>
                        <SelectShell dark={isDark}>
                          <Select
                            id="apply-gender"
                            className={selectCls}
                            value={form.gender}
                            onChange={(e) => set("gender", e.target.value)}
                            options={[
                              { value: "MALE", label: L("Male", "পুরুষ") },
                              { value: "FEMALE", label: L("Female", "নারী") },
                              { value: "OTHER", label: L("Other", "অন্যান্য") },
                            ]}
                          />
                        </SelectShell>
                      </div>
                      <div>
                        <label className={labelCls} htmlFor="apply-father">
                          {L("Father / Guardian Name", "পিতা / অভিভাবকের নাম")} <Req />
                        </label>
                        <Input
                          id="apply-father"
                          className={fieldCls}
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
                          className={fieldCls}
                          value={form.motherName}
                          onChange={(e) => set("motherName", e.target.value)}
                          maxLength={60}
                          autoComplete="off"
                        />
                      </div>
                      <div>
                        <label className={labelCls} htmlFor="apply-phone">
                          {L("Phone", "ফোন")} <Req />
                        </label>
                        <Input
                          id="apply-phone"
                          className={fieldCls}
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
                          className={fieldCls}
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
                        {L("Present Address", "বর্তমান ঠিকানা")} <Req />
                      </label>
                      <Input
                        id="apply-address"
                        className={fieldCls}
                        value={form.address}
                        onChange={(e) => set("address", e.target.value)}
                        placeholder={L("Village / Road, Upazila, District", "গ্রাম/রোড, উপজেলা, জেলা")}
                        maxLength={120}
                        autoComplete="street-address"
                      />
                    </div>

                    {/* ---------- Student photo (optional) ---------- */}
                    <div className={`rounded-lg border p-4 ${isDark ? "border-white/10 bg-white/[0.04]" : "border-gray-200 bg-gray-50/70"}`}>
                      <div className={labelCls}>
                        {L("Student Photo", "শিক্ষার্থীর ছবি")}
                        <span className={`text-[11px] font-normal ${isDark ? "text-zinc-500" : "text-gray-400"}`}>
                          ({L("optional", "ঐচ্ছিক")})
                        </span>
                      </div>
                      <div className="flex items-start gap-4">
                        <button
                          type="button"
                          onClick={() => photoInputRef.current?.click()}
                          aria-label={L("Choose photo", "ছবি নির্বাচন করুন")}
                          className={`h-20 w-20 shrink-0 overflow-hidden rounded-lg flex items-center justify-center transition-all ${
                            photo
                              ? `ring-1 ${isDark ? "ring-white/15 hover:ring-white/30" : "ring-black/10 hover:ring-black/25"}`
                              : `border-2 border-dashed ${isDark ? "border-white/15 hover:border-white/35 text-zinc-500 hover:text-zinc-300" : "border-gray-300 hover:border-gray-400 text-gray-400 hover:text-gray-600"}`
                          }`}
                        >
                          {photo ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={photo} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <Camera className="h-6 w-6" />
                          )}
                        </button>
                        <div className="min-w-0">
                          <p className={`text-xs ${isDark ? "text-zinc-500" : "text-gray-500"}`}>
                            {L(
                              "Appears on the admit card. JPG, PNG or WebP up to 350KB — large photos are resized automatically.",
                              "অ্যাডমিট কার্ডে দেখানো হবে। JPG, PNG বা WebP — সর্বোচ্চ 350KB, বড় ছবি স্বয়ংক্রিয়ভাবে ছোট করা হবে।"
                            )}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={photoBusy}
                              onClick={() => photoInputRef.current?.click()}
                            >
                              {photoBusy ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Camera className="h-3.5 w-3.5" />
                              )}
                              {photo
                                ? L("Change photo", "ছবি বদলান")
                                : L("Add photo", "ছবি যোগ করুন")}
                            </Button>
                            {photo && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setPhoto("");
                                  setPhotoError("");
                                }}
                              >
                                <X className="h-3.5 w-3.5" />
                                {L("Remove", "সরান")}
                              </Button>
                            )}
                          </div>
                          {photoError && (
                            <div className="mt-2 flex items-center gap-2">
                              <p className={`text-xs ${isDark ? "text-red-400" : "text-red-600"}`}>
                                {photoError}
                              </p>
                              <button
                                type="button"
                                onClick={() => setPhotoError("")}
                                className={`text-[11px] underline ${isDark ? "text-zinc-500 hover:text-zinc-300" : "text-gray-400 hover:text-gray-600"}`}
                              >
                                {L("Dismiss", "বাতিল")}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      <input
                        ref={photoInputRef}
                        id="apply-photo"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handlePhotoChange}
                      />
                    </div>
                  </div>
                )}

                {/* ---------- Step 3: review ---------- */}
                {step === 3 && (
                  <div className="space-y-4">
                    {photo && (
                      <div className={`flex items-center gap-3 rounded-lg border p-3 ${isDark ? "border-white/10 bg-white/5" : "border-gray-200 bg-gray-50"}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={photo}
                          alt={L("Student photo", "শিক্ষার্থীর ছবি")}
                          className={`h-16 w-16 shrink-0 rounded-lg object-cover ring-1 ${isDark ? "ring-white/15" : "ring-black/10"}`}
                        />
                        <div className="min-w-0">
                          <span className={`text-[10px] uppercase tracking-wider ${isDark ? "text-zinc-500" : "text-gray-400"}`}>
                            {L("Student Photo", "শিক্ষার্থীর ছবি")}
                          </span>
                          <p className={`text-sm ${isDark ? "text-zinc-200" : "text-gray-800"}`}>
                            {L("Attached with this application", "আবেদনের সাথে যুক্ত হয়েছে")}
                          </p>
                        </div>
                      </div>
                    )}
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
                        <div
                          key={item.label}
                          className={`rounded-lg border px-3 py-2.5 ${isDark ? "border-white/[0.08] bg-white/[0.03]" : "border-gray-200 bg-white"}`}
                        >
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
                          <span>{L("Submitting…", "জমা হচ্ছে…")}</span>
                        </>
                      ) : (
                        <>
                          <UserPlus className="h-4 w-4 mr-2" />
                          {/* Label wrapped in a real element: Firefox can leave a
                              raw text node swapped into this already-laid-out flex
                              button without line boxes (button renders icon-only
                              until something forces a reflow). A <span> is a flex
                              item of its own, so it always gets a box. */}
                          <span>{L("Submit Application", "আবেদন জমা দিন")}</span>
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
