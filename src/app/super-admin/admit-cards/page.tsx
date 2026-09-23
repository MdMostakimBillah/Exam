"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Table, TableBody, TableCell, TableHeader, TableRow, TableHead } from "@/components/ui/table";
import { TableCheckbox } from "@/components/ui/table-checkbox";
import { useTableSelection } from "@/hooks/use-table-selection";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { useAdmitCards, useGenerateAdmitCards, DEFAULT_INSTRUCTIONS } from "@/lib/storage/admit-cards";
import { useExams } from "@/lib/storage/exams";
import { useClasses } from "@/lib/storage/classes";
import { useCurrentSession } from "@/lib/storage/sessions";
import { useAllRegistrations, normalizeRegistrationStatus } from "@/lib/storage/registrations";
import { useStudentsByClass, fetchStudentById } from "@/lib/storage/students";
import { useExamCenters } from "@/lib/storage/exam-centers";
import { useInstitutions } from "@/lib/storage/institutions";
import { useLang } from "@/contexts/language-context";
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
} from "lucide-react";
import type { AdmitCard } from "@/lib/types";

type Staging = {
  views: CardView[];
  action: "pdf" | "print";
  filename: string;
  win?: Window | null;
};

export default function AdmitCardsPage() {
  const { toast } = useToast();
  const { lang } = useLang();
  const isBn = lang === "bn";
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [examId, setExamId] = useState("");
  const [className, setClassName] = useState("");
  const [preview, setPreview] = useState<CardView | null>(null);
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

  const filteredCards = useMemo(
    () =>
      cards.filter(
        (c) =>
          (!exam || c.examName === exam.name) &&
          (!className || c.className === className)
      ),
    [cards, exam, className]
  );

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

    return {
      key: card.id,
      institutionName: card.institutionName,
      institutionCode: inst?.code || "",
      institutionLogo: inst?.logo,
      examName: card.examName,
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
    };
  };

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
        toast(
          "error",
          "Popup blocked — allow popups to print / পপ-আপ ব্লক হয়েছে — প্রিন্টের জন্য অনুমতি দিন"
        );
        return;
      }
    }
    stagingRefs.current.clear();
    setStaging({ views, action, filename, win });
    if (action === "pdf") {
      toast(
        "info",
        `Preparing PDF for ${views.length} card(s)… / ${views.length} টি কার্ডের পিডিএফ তৈরি হচ্ছে…`
      );
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
          toast("success", "PDF downloaded / পিডিএফ ডাউনলোড হয়েছে");
        } else if (staging.win) {
          await printAdmitCards(staging.win, els);
        }
      } catch (err) {
        toast(
          "error",
          err instanceof Error
            ? `Export failed / এক্সপোর্ট ব্যর্থ: ${err.message}`
            : "Export failed / এক্সপোর্ট ব্যর্থ"
        );
        staging.win?.close?.();
      } finally {
        if (!cancelled) setStaging(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [staging, toast]);

  // ── Row actions ──────────────────────────────────────────────────────
  const withView = async (
    card: AdmitCard,
    fn: (view: CardView) => void
  ) => {
    try {
      const view = await buildView(card);
      if (view) fn(view);
    } catch {
      toast("error", "Could not build card / কার্ড তৈরি করা যায়নি");
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
      toast(
        "error",
        "Popup blocked — allow popups to print / পপ-আপ ব্লক হয়েছে — প্রিন্টের জন্য অনুমতি দিন"
      );
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
      toast("error", "Could not build cards / কার্ড তৈরি করা যায়নি");
    }
  };

  // ── Generate ─────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!exam || !className || !sessionId) return;
    const examDate = exam.examStartDate || exam.examDate;
    if (!examDate) {
      toast(
        "error",
        "Set the exam start date first (Exams → Edit) / আগে পরীক্ষার শুরু তারিখ সেট করুন"
      );
      return;
    }
    if (eligible.length === 0) {
      toast(
        "warning",
        "No APPROVED registrations for this class / এই শ্রেণীর জন্য কোনো অনুমোদিত নিবন্ধন নেই"
      );
      return;
    }
    if (studentsLoading) {
      toast("info", "Loading students… / শিক্ষার্থী লোড হচ্ছে…");
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
        toast(
          "success",
          `${res.created} admit card(s) generated / ${res.created} টি প্রবেশপত্র তৈরি হয়েছে`
        );
      if (res.existing > 0)
        toast(
          "info",
          `${res.existing} already existed — skipped / ${res.existing} টি আগেই আছে — বাদ দেওয়া হয়েছে`
        );
      if (res.noRoll > 0)
        toast(
          "warning",
          `${res.noRoll} skipped — generate exam rolls first (Roll Numbers) / ${res.noRoll} জন বাদ — আগে রোল নম্বর পাতায় পরীক্ষার রোল তৈরি করুন`
        );
      if (res.noCenters)
        toast(
          "warning",
          'No exam centers configured — center shows "TBD" / কোনো পরীক্ষা কেন্দ্র নেই — কেন্দ্র "TBD" দেখানো হবে'
        );
      if (res.fallbackToFirst > 0)
        toast(
          "warning",
          `All centers full — ${res.fallbackToFirst} routed to the first center / সব কেন্দ্র পূর্ণ — ${res.fallbackToFirst} জন প্রথম কেন্দ্রে`
        );
      if (res.overCapacity.length > 0)
        toast(
          "warning",
          `Will exceed capacity: ${res.overCapacity.join(", ")} / ধারণক্ষমতা ছাড়বে: ${res.overCapacity.join(", ")}`
        );
      if (res.created === 0 && res.existing === 0 && res.noRoll === 0)
        toast("info", "Nothing to generate / তৈরি করার কিছু নেই");
    } catch (err) {
      toast(
        "error",
        err instanceof Error
          ? `Generation failed / তৈরি করা যায়নি: ${err.message}`
          : "Generation failed / তৈরি করা যায়নি"
      );
    }
  };

  const getSubjectNames = (examName: string, classNameVal: string): string => {
    const e = exams.find((x) => x.name === examName);
    if (!e) return "—";
    const classId = classes.find((c) => c.name === classNameVal)?.id || "";
    const subs = e.subjects.filter(
      (s) => (s.classId || "") === classId || (!s.classId && e.classes[0] === classId)
    );
    if (subs.length === 0) return "—";
    return subs
      .map((s) => {
        const bn = (s as { nameBn?: string }).nameBn;
        return isBn && bn ? bn : s.name;
      })
      .join(", ");
  };

  const metrics = [
    {
      label: "Total Cards / মোট কার্ড",
      value: mounted ? cards.length : "--",
      icon: FileCheck,
      color: "text-muted-foreground",
    },
    {
      label: "Generated (filter) / তৈরি হয়েছে",
      value: mounted ? (exam ? filteredCards.length : "--") : "--",
      icon: Download,
      color: "text-muted-foreground",
    },
    {
      label: "Eligible APPROVED / যোগ্য অনুমোদিত",
      value: mounted ? (exam && className ? eligible.length : "--") : "--",
      icon: FileCheck,
      color: "text-muted-foreground",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Admit Cards / প্রবেশপত্র
          </h1>
          <p className="text-muted-foreground mt-1">
            Select exam → class → generate. Download one by one or select many
            for a multi-page A4 PDF.
          </p>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid gap-4 md:grid-cols-3">
        {metrics.map((m) => (
          <div key={m.label} className="rounded-lg border bg-card p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">
                {m.label}
              </span>
              <m.icon className={`h-4 w-4 ${m.color}`} />
            </div>
            <div className="text-2xl font-bold mt-2">{m.value}</div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="rounded-lg border bg-card p-4">
        <div className="flex flex-col lg:flex-row gap-3 lg:items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1.5">
              Exam / পরীক্ষা
            </label>
            <Select
              value={examId}
              onChange={(e) => {
                setExamId(e.target.value);
                setClassName("");
              }}
              options={[
                { value: "", label: "Select exam / পরীক্ষা নির্বাচন করুন" },
                ...exams.map((e) => ({
                  value: e.id,
                  label: `${e.name} (${e.code})`,
                })),
              ]}
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1.5">
              Class / শ্রেণী
            </label>
            <Select
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              disabled={!exam}
              options={[
                { value: "", label: "Select class / শ্রেণী নির্বাচন করুন" },
                ...classOptions.map((n) => ({ value: n, label: n })),
              ]}
            />
          </div>
          <button
            className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleGenerate}
            disabled={!exam || !className || generateMutation.isPending}
          >
            {generateMutation.isPending
              ? "Generating… / তৈরি হচ্ছে…"
              : "Generate Admit Cards / প্রবেশপত্র তৈরি করুন"}
          </button>
        </div>

        {/* Status chips */}
        {exam && (
          <div className="flex flex-wrap gap-2 mt-3">
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
              APPROVED: {className ? eligible.length : "—"}
            </span>
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
              Generated: {filteredCards.length}
            </span>
            {missingRolls > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/15 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-3 w-3" />
                {missingRolls} without exam roll — run Roll Numbers first
              </span>
            )}
            {studentsError && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/15 text-red-600">
                <AlertTriangle className="h-3 w-3" />
                Students table not ready — run migrations 0013 &amp; 0016
              </span>
            )}
            {className && (exam.routine?.length ?? 0) === 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/15 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-3 w-3" />
                No routine — subject dates/times won&apos;t show (Routine page)
              </span>
            )}
            {className && !exam.examStartDate && !exam.examDate && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/15 text-red-600">
                <AlertTriangle className="h-3 w-3" />
                Exam has no start date — edit the exam first
              </span>
            )}
          </div>
        )}
      </div>

      {/* Table */}
      {filteredCards.length > 0 ? (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <TableCheckbox
                    checked={selection.allSelected}
                    indeterminate={selection.someSelected}
                    onChange={selection.toggleAll}
                  />
                </TableHead>
                <TableHead>Student / শিক্ষার্থী</TableHead>
                <TableHead className="hidden md:table-cell">
                  Reg No / নিবন্ধন
                </TableHead>
                <TableHead className="hidden lg:table-cell">
                  Exam / পরীক্ষা
                </TableHead>
                <TableHead className="hidden lg:table-cell">
                  Class / শ্রেণী
                </TableHead>
                <TableHead className="hidden xl:table-cell">
                  Subjects / বিষয়
                </TableHead>
                <TableHead>Roll / রোল</TableHead>
                <TableHead className="hidden xl:table-cell">
                  Center / কেন্দ্র
                </TableHead>
                <TableHead className="hidden xl:table-cell">Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCards.map((card) => (
                <TableRow key={card.id}>
                  <TableCell>
                    <TableCheckbox
                      checked={selection.isSelected(card.id)}
                      onChange={() => selection.toggle(card.id)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    {card.studentName}
                  </TableCell>
                  <TableCell className="hidden md:table-cell font-mono text-xs">
                    {card.registrationNumber}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell max-w-[180px] truncate">
                    {card.examName}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {card.className}
                  </TableCell>
                  <TableCell className="hidden xl:table-cell max-w-[260px] truncate text-xs text-muted-foreground">
                    {getSubjectNames(card.examName, card.className)}
                  </TableCell>
                  <TableCell>
                    <span className="inline-block border border-border px-2 py-0.5 text-xs font-bold font-mono">
                      {card.roll}
                    </span>
                  </TableCell>
                  <TableCell className="hidden xl:table-cell max-w-[160px] truncate text-xs">
                    {card.examCenter}
                  </TableCell>
                  <TableCell className="hidden xl:table-cell text-xs text-muted-foreground">
                    {new Date(card.examDate).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end space-x-1">
                      <button
                        className="p-1.5 rounded-md hover:bg-accent transition-colors"
                        title="Preview / প্রিভিউ"
                        onClick={() => handlePreview(card)}
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        className="p-1.5 rounded-md hover:bg-accent transition-colors"
                        title="Download PDF"
                        onClick={() => handleDownloadOne(card)}
                      >
                        <Download className="h-4 w-4" />
                      </button>
                      <button
                        className="p-1.5 rounded-md hover:bg-accent transition-colors"
                        title="Print / প্রিন্ট"
                        onClick={() => handlePrintOne(card)}
                      >
                        <Printer className="h-4 w-4" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="rounded-lg border bg-card p-10 text-center">
          <FileCheck className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="font-medium">
            No admit cards yet / এখনো কোনো প্রবেশপত্র নেই
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {exam && className
              ? "No cards for this exam + class yet — click Generate."
              : "Select an exam and class above, then click Generate."}
          </p>
        </div>
      )}

      {/* Bulk download bar */}
      {selection.selectedCount > 0 && (
        <div className="fixed bottom-6 right-6 z-40 flex items-center gap-3 rounded-lg border border-white/10 bg-purple-600 text-white px-4 py-3 shadow-2xl">
          <span className="text-sm font-medium">
            {selection.selectedCount} selected / নির্বাচিত
          </span>
          <button
            className="inline-flex items-center gap-1.5 rounded-md bg-white text-purple-700 px-3 py-1.5 text-sm font-semibold hover:bg-purple-50 transition-colors"
            onClick={handleBulkDownload}
          >
            <FileDown className="h-4 w-4" />
            Download PDF / পিডিএফ
          </button>
        </div>
      )}

      {/* Preview modal */}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setPreview(null)}
          />
          <div className="relative z-50 w-full max-w-[860px] max-h-[92vh] flex flex-col rounded-md shadow-2xl bg-white border border-white/[0.06] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-black/10 bg-black text-white rounded-t-md">
              <span className="text-sm font-semibold">
                Admit Card Preview — {preview.studentName}
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
                <div
                  style={{
                    transform: "scale(0.72)",
                    transformOrigin: "top left",
                  }}
                >
                  <AdmitCardTemplate view={preview} />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-black/10 bg-white rounded-b-md">
              <button
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
                onClick={() =>
                  startExport(
                    "pdf",
                    [preview],
                    `admit-card-${preview.registrationNumber || preview.key}.pdf`
                  )
                }
              >
                <Download className="h-4 w-4" /> Download PDF
              </button>
              <button
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md border text-sm font-medium hover:bg-accent"
                onClick={() => startExport("print", [preview], "")}
              >
                <Printer className="h-4 w-4" /> Print / প্রিন্ট
              </button>
              <button
                className="h-9 px-4 rounded-md border text-sm font-medium hover:bg-accent"
                onClick={() => setPreview(null)}
              >
                Close / বন্ধ
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
  );
}
