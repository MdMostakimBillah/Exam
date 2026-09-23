"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Table, TableBody, TableCell, TableHeader, TableRow, TableHead } from "@/components/ui/table";
import { TableCheckbox } from "@/components/ui/table-checkbox";
import { useTableSelection } from "@/hooks/use-table-selection";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { useTheme } from "@/contexts/theme-context";
import { useLang } from "@/contexts/language-context";
import { cn } from "@/lib/utils/helpers";
import { LoadingBar } from "@/components/ui/loading-bar";
import { useAdmitCards, useGenerateAdmitCards, DEFAULT_INSTRUCTIONS } from "@/lib/storage/admit-cards";
import { useExams } from "@/lib/storage/exams";
import { useClasses } from "@/lib/storage/classes";
import { useCurrentSession } from "@/lib/storage/sessions";
import { useAllRegistrations, normalizeRegistrationStatus } from "@/lib/storage/registrations";
import { useStudentsByClass, fetchStudentById } from "@/lib/storage/students";
import { useExamCenters } from "@/lib/storage/exam-centers";
import { useInstitutions } from "@/lib/storage/institutions";
import { formatDate } from "@/lib/storage/storage";
import {
  AdmitCardTemplate,
  CardView,
  CardSubject,
} from "@/components/admit-card/admit-card-template";
import {
  exportAdmitCardsPdf,
  waitForImages,
  openPrintWindow,
  printAdmitCards,
} from "@/lib/pdf/admit-card-pdf";
import QRCode from "qrcode";
import {
  FileCheck,
  Download,
  Printer,
  Eye,
  FileDown,
  AlertTriangle,
  Search,
  Sparkles,
  Loader2,
} from "lucide-react";
import type { AdmitCard } from "@/lib/types";

type Staging = {
  views: CardView[];
  action: "pdf" | "print";
  filename: string;
  win?: Window | null;
};

export default function AdmitCardsPage() {
  const { theme } = useTheme();
  const { lang: language } = useLang();
  const { toast } = useToast();
  const isDark = theme === "dark";
  const isBn = language === "bn";
  /** Single-language copy helper — matches every other page's isBn ? বাংলা : English. */
  const bi = (en: string, bn: string) => (isBn ? bn : en);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [examId, setExamId] = useState("");
  const [className, setClassName] = useState("");
  const [search, setSearch] = useState("");
  const [preview, setPreview] = useState<CardView | null>(null);
  const lang = isBn ? "bn" : "en";
  const [staging, setStaging] = useState<Staging | null>(null);
  const stagingRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const generateMutation = useGenerateAdmitCards();

  const { data: currentSession } = useCurrentSession();
  const sessionId = currentSession?.id;

  // Session-scoped data
  const { data: cards = [] } = useAdmitCards(sessionId, 1, 1000);
  const { data: exams = [] } = useExams(sessionId, 1, 100);
  const { data: classes = [] } = useClasses();
  const { data: registrations = [] } = useAllRegistrations(sessionId);
  const { data: centers = [] } = useExamCenters(sessionId, 1, 100);
  const { data: institutions = [] } = useInstitutions();
  const {
    data: students = [],
    error: studentsError,
    isLoading: studentsLoading,
  } = useStudentsByClass(sessionId, className || undefined);

  const exam = exams.find((e) => e.id === examId);
  const classMap = useMemo(
    () => new Map(classes.map((c) => [c.id, c.name])),
    [classes]
  );
  const classOptions = exam
    ? exam.classes.map((id) => classMap.get(id) || "").filter(Boolean)
    : [];

  const studentsById = useMemo(
    () => new Map(students.map((s) => [s.id, s])),
    [students]
  );

  // APPROVED registrations for the selected exam (+ class when chosen)
  const eligible = useMemo(() => {
    if (!exam) return [];
    return registrations.filter(
      (r) =>
        r.examId === exam.id &&
        (!className || r.className === className) &&
        normalizeRegistrationStatus(r.status) === "APPROVED"
    );
  }, [registrations, exam, className]);

  const filteredCards = useMemo(() => {
    const q = search.trim().toLowerCase();
    return cards.filter((c) => {
      if (exam && c.examName !== exam.name) return false;
      if (className && c.className !== className) return false;
      if (!q) return true;
      return `${c.studentName} ${c.registrationNumber} ${c.roll} ${c.examCenter} ${c.examName} ${c.className}`
        .toLowerCase()
        .includes(q);
    });
  }, [cards, exam, className, search]);

  const missingRolls =
    className && !studentsLoading && !studentsError
      ? eligible.filter((r) => !studentsById.get(r.studentId)?.examRoll).length
      : 0;

  const selection = useTableSelection(filteredCards);
  const selectedCards = filteredCards.filter((c) => selection.isSelected(c.id));

  // Oldest center first → stable "(001)" numbering in the card
  const sortedCenters = useMemo(
    () => [...centers].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [centers]
  );

  // ── Assemble everything a card needs, on demand ──────────────────────
  const buildView = async (card: AdmitCard): Promise<CardView | null> => {
    const cardExam = exams.find((e) => e.name === card.examName);
    const classId =
      classes.find((c) => c.name === card.className)?.id || "";

    // Subject codes auto-number 101, 102… in routine order; times from routine
    const subjects: CardSubject[] = [];
    if (cardExam) {
      const subs = cardExam.subjects.filter(
        (s) =>
          (s.classId || "") === classId ||
          (!s.classId && cardExam.classes[0] === classId)
      );
      const slotBySubject = new Map<
        string,
        { date: string; startTime?: string; endTime?: string }
      >();
      (cardExam.routine || [])
        .filter((r) => (r.classId || "") === classId)
        .forEach((r) =>
          slotBySubject.set(r.subjectId, {
            date: r.date,
            startTime: r.startTime,
            endTime: r.endTime,
          })
        );
      subs.forEach((s, i) => {
        const slot = slotBySubject.get(s.id);
        subjects.push({
          code: String(101 + i),
          name: s.name,
          date: slot?.date,
          startTime: slot?.startTime,
          endTime: slot?.endTime,
        });
      });
    }

    const student = await fetchStudentById(card.studentId).catch(
      () => undefined
    );
    const inst =
      (student && institutions.find((i) => i.id === student.institutionId)) ||
      institutions.find((i) => i.name === card.institutionName);

    const centerIdx = sortedCenters.findIndex(
      (c) =>
        (c.address ? `${c.name} – ${c.address}` : c.name) === card.examCenter ||
        c.name === card.examCenter
    );

    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const qrText = card.qrCode?.startsWith("/")
      ? `${origin}${card.qrCode}`
      : card.qrCode || `${origin}/result?reg=${card.registrationNumber}`;
    let qrDataUrl = "";
    try {
      qrDataUrl = await QRCode.toDataURL(qrText, {
        margin: 1,
        width: 256,
        color: { dark: "#000000", light: "#ffffff" },
      });
    } catch {
      qrDataUrl = "";
    }

    // Exam period for the card's "Exam Period" field (start – end, or single date)
    const periodParts = [
      cardExam?.examStartDate,
      cardExam?.examEndDate,
    ].filter(Boolean) as string[];
    const examPeriod =
      periodParts.length > 0
        ? periodParts
            .map((d) => {
              try {
                return formatDate(d);
              } catch {
                return d;
              }
            })
            .join(" – ")
        : formatDate(card.examDate);

    return {
      key: card.id,
      lang,
      institutionName: card.institutionName,
      institutionCode: inst?.code || "",
      institutionLogo: inst?.logo,
      examName: card.examName,
      examCode: cardExam?.code || "",
      examPeriod,
      academicYear: cardExam?.academicYear,
      sessionName: currentSession?.name || "",
      studentName: student
        ? `${student.firstName} ${student.lastName}`
        : card.studentName,
      photo: student?.photo,
      fatherName: student?.fatherName || "—",
      motherName: student?.motherName || "—",
      dob: student?.dateOfBirth || "",
      className: card.className,
      section: student?.section || "—",
      classRoll: student?.roll || "—",
      examRoll: card.roll,
      registrationNumber: card.registrationNumber,
      centerName: card.examCenter,
      centerCode:
        centerIdx >= 0 ? String(centerIdx + 1).padStart(3, "0") : "",
      subjects,
      qrDataUrl,
      instructions: card.instructions || DEFAULT_INSTRUCTIONS,
      createdAt: card.createdAt,
    };
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps

  // ── Export orchestration (staging container renders the cards first) ──
  const startExport = (
    action: "pdf" | "print",
    views: CardView[],
    filename: string,
    existingWin?: Window | null
  ) => {
    if (views.length === 0) return;
    let win: Window | null = existingWin ?? null;
    if (action === "print" && !win) {
      win = openPrintWindow(); // must happen inside the click gesture
      if (!win) {
        toast("error", bi("পপ-আপ ব্লক হয়েছে — প্রিন্টের জন্য অনুমতি দিন", "Popup blocked — allow popups to print"));
        return;
      }
    }
    stagingRefs.current.clear();
    setStaging({ views, action, filename, win });
    if (action === "pdf") {
      toast("info", bi(`${views.length} টি কার্ডের পিডিএফ তৈরি হচ্ছে...`, `Preparing PDF for ${views.length} card(s)...`));
    }
  };

  useEffect(() => {
    if (!staging) return;
    const els = staging.views
      .map((v) => stagingRefs.current.get(v.key) || null)
      .filter(Boolean) as HTMLElement[];
    if (els.length !== staging.views.length) return; // refs not attached yet

    let cancelled = false;
    (async () => {
      try {
        await waitForImages(els);
        if (cancelled) return;
        if (staging.action === "pdf") {
          await exportAdmitCardsPdf(els, staging.filename);
          toast("success", bi("পিডিএফ ডাউনলোড হয়েছে", "PDF downloaded"));
        } else if (staging.win) {
          await printAdmitCards(staging.win, els);
        }
      } catch (err) {
        toast(
          "error",
          err instanceof Error
            ? bi(`এক্সপোর্ট ব্যর্থ: ${err.message}`, `Export failed: ${err.message}`)
            : bi("এক্সপোর্ট ব্যর্থ", "Export failed")
        );
        staging.win?.close?.();
      } finally {
        if (!cancelled) setStaging(null);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staging, toast]);

  // ── Row actions ──────────────────────────────────────────────────────
  const withView = async (card: AdmitCard, fn: (view: CardView) => void) => {
    try {
      const view = await buildView(card);
      if (view) fn(view);
    } catch {
      toast("error", bi("কার্ড তৈরি করা যায়নি", "Could not build card"));
    }
  };

  const handlePreview = (card: AdmitCard) =>
    withView(card, (v) => setPreview(v));

  const handleDownloadOne = (card: AdmitCard) =>
    withView(card, (v) =>
      startExport("pdf", [v], `admit-card-${v.registrationNumber || v.key}.pdf`)
    );

  const handlePrintOne = (card: AdmitCard) => {
    const win = openPrintWindow(); // synchronous, inside the click gesture
    if (!win) {
      toast("error", bi("পপ-আপ ব্লক হয়েছে — প্রিন্টের জন্য অনুমতি দিন", "Popup blocked — allow popups to print"));
      return;
    }
    withView(card, (v) => startExport("print", [v], "", win));
  };

  const handleBulkDownload = async () => {
    if (selectedCards.length === 0) return;
    try {
      const views = (
        await Promise.all(selectedCards.map((c) => buildView(c)))
      ).filter(Boolean) as CardView[];
      const name = `admit-cards-${exam?.code || "all"}-${views.length}.pdf`.replace(
        /[^\w.-]+/g,
        "-"
      );
      startExport("pdf", views, name);
      selection.clear();
    } catch {
      toast("error", bi("কার্ড তৈরি করা যায়নি", "Could not build cards"));
    }
  };

  // ── Generate ─────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!exam || !className || !sessionId) return;
    const examDate = exam.examStartDate || exam.examDate;
    if (!examDate) {
      toast("error", bi("আগে পরীক্ষার শুরু তারিখ সেট করুন (পরীক্ষা → সম্পাদনা)", "Set the exam start date first (Exams → Edit)"));
      return;
    }
    if (eligible.length === 0) {
      toast("warning", bi("এই শ্রেণীর জন্য কোনো অনুমোদিত নিবন্ধন নেই", "No APPROVED registrations for this class"));
      return;
    }
    if (studentsLoading) {
      toast("info", bi("শিক্ষার্থী লোড হচ্ছে...", "Loading students..."));
      return;
    }
    try {
      const res = await generateMutation.mutateAsync({
        sessionId,
        examName: exam.name,
        examDate,
        className,
        regs: eligible,
        students,
        centers,
      });
      if (res.created > 0)
        toast("success", bi(`${res.created} টি প্রবেশপত্র তৈরি হয়েছে`, `${res.created} admit card(s) generated`));
      if (res.existing > 0)
        toast("info", bi(`${res.existing} টি আগেই আছে — বাদ দেওয়া হয়েছে`, `${res.existing} already existed — skipped`));
      if (res.noRoll > 0)
        toast("warning", bi(`${res.noRoll} জন বাদ — আগে রোল নম্বর পাতায় পরীক্ষার রোল তৈরি করুন`, `${res.noRoll} skipped — generate exam rolls first (Roll Numbers)`));
      if (res.noCenters)
        toast("warning", bi('কোনো পরীক্ষা কেন্দ্র নেই — কেন্দ্র "TBD" দেখানো হবে', 'No exam centers configured — center shows "TBD"'));
      if (res.fallbackToFirst > 0)
        toast("warning", bi(`সব কেন্দ্র পূর্ণ — ${res.fallbackToFirst} জন প্রথম কেন্দ্রে দেওয়া হয়েছে`, `All centers full — ${res.fallbackToFirst} routed to the first center`));
      if (res.overCapacity.length > 0)
        toast("warning", bi(`ধারণক্ষমতা ছাড়বে: ${res.overCapacity.join(", ")}`, `Will exceed capacity: ${res.overCapacity.join(", ")}`));
      if (res.created === 0 && res.existing === 0 && res.noRoll === 0)
        toast("info", bi("তৈরি করার কিছু নেই", "Nothing to generate"));
    } catch (err) {
      toast(
        "error",
        err instanceof Error
          ? bi(`তৈরি করা যায়নি: ${err.message}`, `Generation failed: ${err.message}`)
          : bi("তৈরি করা যায়নি", "Generation failed")
      );
    }
  };

  if (!mounted) return <AdmitCardsSkeleton isDark={isDark} />;

  // ── Presentation helpers (explicit theme classes — the app has no CSS vars) ──
  const card = isDark
    ? "bg-[#141416] border border-white/[0.06] rounded-md"
    : "bg-white border border-zinc-200 rounded-md shadow-sm";
  const iconBg = isDark ? "bg-white/[0.06]" : "bg-zinc-100";
  const iconColor = isDark ? "text-white" : "text-zinc-900";
  const labelCls = isDark ? "text-zinc-400" : "text-zinc-600";
  const inputCls = isDark
    ? "bg-white/[0.04] border-white/[0.08] text-white placeholder:text-zinc-600"
    : "bg-zinc-50 border-zinc-200 text-zinc-900 placeholder:text-zinc-400";
  const subtext = isDark ? "text-zinc-500" : "text-zinc-400";
  const headCls = `text-[10px] font-medium uppercase tracking-wider whitespace-nowrap ${isDark ? "text-zinc-400" : "text-zinc-500"}`;
  const actionBtn = `p-1.5 rounded-md transition-colors ${isDark ? "text-zinc-400 hover:text-white hover:bg-white/[0.06]" : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100"}`;
  const warnBox = (tone: "amber" | "red") =>
    cn(
      "flex items-center gap-2 px-3 py-2 rounded-md border text-[12px]",
      tone === "amber"
        ? isDark
          ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
          : "border-amber-200 bg-amber-50 text-amber-700"
        : isDark
          ? "border-red-500/30 bg-red-500/10 text-red-400"
          : "border-red-200 bg-red-50 text-red-600"
    );

  const warnings: { tone: "amber" | "red"; text: string }[] = [];
  if (exam && className) {
    if (studentsError)
      warnings.push({
        tone: "red",
        text: bi(
          "রোল ডেটা আনা যায়নি — Supabase SQL Editor এ 0013 ও 0016 মাইগ্রেশন চালান",
          "Roll data unavailable — run migrations 0013 & 0016 in the Supabase SQL Editor"
        ),
      });
    if (missingRolls > 0)
      warnings.push({
        tone: "amber",
        text: bi(
          `${missingRolls} জনের পরীক্ষার রোল নেই — আগে Roll Numbers পাতায় রোল তৈরি করুন`,
          `${missingRolls} student(s) have no exam roll — generate rolls on the Roll Numbers page first`
        ),
      });
    if ((exam.routine?.length ?? 0) === 0)
      warnings.push({
        tone: "amber",
        text: bi(
          "রুটিন তৈরি করা হয়নি — কার্ডে বিষয়ের তারিখ ও সময় দেখাবে না (Routine পাতা)",
          "No routine built — subject dates/times won't show on the card (Routine page)"
        ),
      });
    if (!exam.examStartDate && !exam.examDate)
      warnings.push({
        tone: "red",
        text: bi(
          "পরীক্ষার কোনো শুরু তারিখ নেই — আগে পরীক্ষা সম্পাদনা করুন",
          "Exam has no start date — edit the exam first"
        ),
      });
  }

  const metrics = [
    { label: bi("মোট কার্ড", "Total Cards"), value: cards.length },
    { label: bi("তৈরি হয়েছে", "Generated (filter)"), value: exam ? filteredCards.length : "—" },
    { label: bi("যোগ্য অনুমোদিত", "Eligible APPROVED"), value: exam && className ? eligible.length : "—" },
    { label: bi("রোল বাকি", "Without exam roll"), value: className ? missingRolls : "—" },
  ];

  const emptyTitle =
    !exam || !className
      ? bi("পরীক্ষা ও শ্রেণী নির্বাচন করুন", "Select an exam and class")
      : search.trim()
        ? bi("কোনো প্রবেশপত্র পাওয়া যায়নি", "No admit cards found")
        : bi("এখনো কোনো প্রবেশপত্র তৈরি করা হয়নি", "No admit cards generated yet");
  const emptySub =
    !exam || !className
      ? bi("নির্বাচন করলে তৈরি করা প্রবেশপত্র দেখা যাবে", "Generated admit cards will appear here")
      : search.trim()
        ? bi("অনুসন্ধান পরিবর্তন করুন", "Try a different search")
        : bi('উপরের "প্রবেশপত্র তৈরি করুন" বোতামে চাপ দিন', 'Click "Generate Admit Cards" above to create them');

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0a0a0b]" : "bg-zinc-50"}`}>
      <LoadingBar isLoading={generateMutation.isPending || !!staging} />
      <div className="max-w-[1600px] mx-auto p-6 lg:p-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className={`text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-zinc-900"}`}>
            {bi("প্রবেশপত্র", "Admit Cards")}
          </h1>
          <p className="text-sm mt-1 text-zinc-500">
            {bi(
              "পরীক্ষা ও শ্রেণী নির্বাচন করে প্রবেশপত্র তৈরি করুন — একটি করে ডাউনলোড করুন বা একসাথে একাধিক A4 পিডিএফ নিন",
              "Select an exam and class to generate admit cards — download one by one or select many for a multi-page A4 PDF"
            )}
          </p>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {metrics.map((s) => (
            <div key={s.label} className={`${card} px-4 py-3 flex items-center gap-3`}>
              <div className={`h-10 w-10 rounded-md flex items-center justify-center shrink-0 ${iconBg}`}>
                <FileCheck className={`h-5 w-5 ${iconColor}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-lg font-bold tracking-tight leading-tight ${isDark ? "text-white" : "text-zinc-900"}`}>
                  {s.value}
                </p>
                <p className={`text-[11px] truncate ${labelCls}`}>{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Controls */}
        <div className={`${card} p-4 mb-6`}>
          <div className="flex flex-col lg:flex-row gap-3 lg:items-end">
            <div className="flex-1 min-w-0">
              <label className={`block text-[11px] mb-1.5 font-medium ${labelCls}`}>
                {bi("পরীক্ষা নির্বাচন", "Select Exam")}
              </label>
              <Select
                value={examId}
                onChange={(e) => {
                  setExamId(e.target.value);
                  setClassName("");
                  setSearch("");
                }}
                placeholder={bi("পরীক্ষা নির্বাচন করুন...", "Select an exam...")}
                options={exams.map((e) => ({
                  value: e.id,
                  label: `${e.name} (${e.code})`,
                }))}
                className={inputCls}
              />
            </div>
            <div className="flex-1 min-w-0">
              <label className={`block text-[11px] mb-1.5 font-medium ${labelCls}`}>
                {bi("শ্রেণী নির্বাচন", "Select Class")}
              </label>
              <Select
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                disabled={!exam}
                placeholder={bi("শ্রেণী নির্বাচন করুন...", "Select a class...")}
                options={classOptions.map((n) => ({ value: n, label: n }))}
                className={inputCls}
              />
            </div>
            <button
              onClick={handleGenerate}
              disabled={!exam || !className || generateMutation.isPending}
              className={cn(
                "flex items-center justify-center gap-2 px-5 h-10 rounded-md text-[13px] font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0",
                isDark
                  ? "bg-white text-black hover:bg-zinc-200"
                  : "bg-black text-white hover:bg-zinc-800"
              )}
            >
              {generateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {generateMutation.isPending
                ? bi("তৈরি হচ্ছে...", "Generating...")
                : bi("প্রবেশপত্র তৈরি করুন", "Generate Admit Cards")}
            </button>
          </div>

          {/* Search */}
          {cards.length > 0 && (
            <div className="relative mt-3 max-w-xs">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${isDark ? "text-zinc-600" : "text-zinc-400"}`} />
              <Input
                placeholder={bi("নাম, রেজি নং, রোল বা কেন্দ্র দিয়ে খুঁজুন...", "Search by name, reg no, roll or center...")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={cn("pl-9", inputCls)}
              />
            </div>
          )}

          {/* Counts */}
          {exam && className && (
            <p className={`text-[11px] mt-2.5 ${subtext}`}>
              {bi(
                `অনুমোদিত: ${eligible.length} · তৈরি: ${filteredCards.length} · রোল বাকি: ${missingRolls}`,
                `APPROVED: ${eligible.length} · Generated: ${filteredCards.length} · Missing rolls: ${missingRolls}`
              )}
            </p>
          )}

          {/* Warnings */}
          {warnings.length > 0 && (
            <div className="mt-3 space-y-2">
              {warnings.map((w, i) => (
                <div key={i} className={warnBox(w.tone)}>
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  <span>{w.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Admit card list */}
        <div className={card}>
          <div className={`px-5 py-4 border-b ${isDark ? "border-white/[0.06]" : "border-zinc-100"}`}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <FileCheck className={`h-4 w-4 ${isDark ? "text-zinc-400" : "text-zinc-500"}`} />
                <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>
                  {bi("প্রবেশপত্র তালিকা", "Admit Card List")}
                </h3>
                <span className={`text-[11px] ${subtext}`}>({filteredCards.length})</span>
              </div>
              <span className={`text-[11px] hidden sm:block ${subtext}`}>
                {bi("প্রিভিউর জন্য Eye চাপুন — বা একাধিক নির্বাচন করে পিডিএফ নিন", "Press Eye to preview — or select many for one PDF")}
              </span>
            </div>
          </div>

          {filteredCards.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6">
              <div className={`h-14 w-14 rounded-md flex items-center justify-center mb-4 ${isDark ? "bg-white/[0.08]" : "bg-zinc-100"}`}>
                <FileCheck className={`h-7 w-7 ${iconColor}`} />
              </div>
              <p className={`text-sm font-medium ${isDark ? "text-white" : "text-zinc-900"}`}>{emptyTitle}</p>
              <p className={`text-xs mt-1 text-center ${subtext}`}>{emptySub}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className={isDark ? "border-white/[0.04] hover:bg-transparent" : "border-zinc-100 hover:bg-transparent"}>
                  <TableHead className="w-10">
                    <TableCheckbox
                      checked={selection.allSelected}
                      indeterminate={selection.someSelected}
                      onChange={selection.toggleAll}
                    />
                  </TableHead>
                  <TableHead className={headCls}>{bi("শিক্ষার্থী", "Student")}</TableHead>
                  <TableHead className={cn(headCls, "hidden md:table-cell")}>{bi("রেজি নং", "Reg No")}</TableHead>
                  <TableHead className={cn(headCls, "hidden lg:table-cell")}>{bi("পরীক্ষা", "Exam")}</TableHead>
                  <TableHead className={headCls}>{bi("শ্রেণী", "Class")}</TableHead>
                  <TableHead className={headCls}>{bi("রোল", "Roll")}</TableHead>
                  <TableHead className={cn(headCls, "hidden xl:table-cell")}>{bi("কেন্দ্র", "Center")}</TableHead>
                  <TableHead className={cn(headCls, "hidden lg:table-cell")}>{bi("তারিখ", "Date")}</TableHead>
                  <TableHead className={cn(headCls, "text-right")}>{bi("অ্যাকশন", "Actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCards.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <TableCheckbox
                        checked={selection.isSelected(c.id)}
                        onChange={() => selection.toggle(c.id)}
                      />
                    </TableCell>
                    <TableCell className={`font-medium ${isDark ? "text-zinc-100" : "text-zinc-800"}`}>
                      {c.studentName}
                    </TableCell>
                    <TableCell className="hidden md:table-cell font-mono text-xs">
                      {c.registrationNumber}
                    </TableCell>
                    <TableCell className={`hidden lg:table-cell max-w-[170px] truncate text-xs ${subtext}`}>
                      {c.examName}
                    </TableCell>
                    <TableCell className="text-xs">{c.className}</TableCell>
                    <TableCell>
                      <span className={`inline-block border px-2 py-0.5 text-xs font-bold font-mono ${isDark ? "border-white/15" : "border-zinc-300"}`}>
                        {c.roll}
                      </span>
                    </TableCell>
                    <TableCell className={`hidden xl:table-cell max-w-[170px] truncate text-xs ${subtext}`}>
                      {c.examCenter}
                    </TableCell>
                    <TableCell className={`hidden lg:table-cell text-xs ${subtext}`}>
                      {formatDate(c.examDate)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end space-x-1">
                        <button
                          className={actionBtn}
                          title={bi("প্রিভিউ", "Preview")}
                          onClick={() => handlePreview(c)}
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          className={actionBtn}
                          title="Download PDF"
                          onClick={() => handleDownloadOne(c)}
                        >
                          <Download className="h-4 w-4" />
                        </button>
                        <button
                          className={actionBtn}
                          title={bi("প্রিন্ট", "Print")}
                          onClick={() => handlePrintOne(c)}
                        >
                          <Printer className="h-4 w-4" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Floating selection bar */}
        {selection.selectedCount > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 animate-slideUp">
            <div className={`flex items-center gap-3 px-5 py-3 rounded-md shadow-2xl ${isDark ? "bg-[#1a1a1c] border border-white/[0.1]" : "bg-white border border-zinc-200"}`}>
              <span className={`text-[11px] font-medium ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
                {selection.selectedCount} {bi("টি নির্বাচিত", "selected")}
              </span>
              <button
                onClick={handleBulkDownload}
                className="flex items-center gap-2 px-4 py-2 rounded-md text-[11px] font-medium bg-[#9333ea] text-white hover:bg-[#7e22ce] transition-colors"
              >
                <FileDown className="h-3.5 w-3.5" /> {bi("পিডিএফ ডাউনলোড", "Download PDF")}
              </button>
            </div>
          </div>
        )}

        {/* Preview modal */}
        {preview && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setPreview(null)}
            />
            <div className="relative z-50 w-full max-w-[860px] max-h-[92vh] flex flex-col rounded-md shadow-2xl bg-white overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-black/10 bg-black text-white">
                <span className="text-sm font-semibold">
                  {bi("প্রবেশপত্র প্রিভিউ", "Admit Card Preview")} — {preview.studentName}
                </span>
                <button
                  className="p-1 rounded hover:bg-white/10"
                  onClick={() => setPreview(null)}
                >
                  ✕
                </button>
              </div>

              <div className="flex-1 overflow-auto bg-zinc-200 p-4 flex justify-center">
                <div
                  style={{
                    width: "calc(210mm * 0.72)",
                    height: "calc(297mm * 0.72)",
                    overflow: "hidden",
                    boxShadow: "0 6px 30px rgba(0,0,0,.35)",
                    background: "#fff",
                  }}
                >
                  <div style={{ transform: "scale(0.72)", transformOrigin: "top left" }}>
                    <AdmitCardTemplate view={preview} />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-zinc-200 bg-white">
                <button
                  className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md text-sm font-medium bg-black text-white hover:bg-zinc-800 transition-colors"
                  onClick={() =>
                    startExport(
                      "pdf",
                      [preview],
                      `admit-card-${preview.registrationNumber || preview.key}.pdf`
                    )
                  }
                >
                  <Download className="h-4 w-4" /> {bi("ডাউনলোড", "Download PDF")}
                </button>
                <button
                  className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md border border-zinc-300 text-zinc-700 text-sm font-medium hover:bg-zinc-50 transition-colors"
                  onClick={() => startExport("print", [preview], "")}
                >
                  <Printer className="h-4 w-4" /> {bi("প্রিন্ট", "Print")}
                </button>
                <button
                  className="h-9 px-4 rounded-md border border-zinc-300 text-zinc-700 text-sm font-medium hover:bg-zinc-50 transition-colors"
                  onClick={() => setPreview(null)}
                >
                  {bi("বন্ধ", "Close")}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Hidden staging area — html2canvas reads these nodes */}
        {staging && (
          <div
            aria-hidden
            style={{
              position: "fixed",
              left: -10000,
              top: 0,
              background: "#fff",
              zIndex: -1,
            }}
          >
            {staging.views.map((v) => (
              <div
                key={v.key}
                ref={(el) => {
                  if (el) stagingRefs.current.set(v.key, el);
                  else stagingRefs.current.delete(v.key);
                }}
              >
                <AdmitCardTemplate view={v} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AdmitCardsSkeleton({ isDark }: { isDark: boolean }) {
  const sk = isDark ? "bg-white/[0.05]" : "bg-zinc-200/70";
  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0a0a0b]" : "bg-zinc-50"}`}>
      <div className="max-w-[1600px] mx-auto p-6 lg:p-8 animate-pulse">
        <div className={`h-7 w-48 rounded-md ${sk} mb-2.5`} />
        <div className={`h-4 w-96 max-w-full rounded-md ${sk} mb-8`} />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={`h-[66px] rounded-md ${sk}`} />
          ))}
        </div>
        <div className={`h-32 rounded-md ${sk} mb-6`} />
        <div className={`h-80 rounded-md ${sk}`} />
      </div>
    </div>
  );
}
