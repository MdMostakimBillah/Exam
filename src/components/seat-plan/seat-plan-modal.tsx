"use client";

import { useState, useMemo, useEffect } from "react";
import { X, FileDown, Loader2, Users, AlertCircle, CheckCircle2, ShieldAlert, ChevronLeft, ChevronRight } from "lucide-react";
import { useTheme } from "@/contexts/theme-context";
import { useLang } from "@/contexts/language-context";
import { useToast } from "@/components/ui/toast";
import { useBranding, BRANDING_DEFAULTS } from "@/lib/storage/branding";
import { useStudentPhotos } from "@/lib/storage/students";
import { Student, Registration } from "@/lib/types";
import { exportSeatPlanPdf, SeatPlanStudent } from "@/lib/pdf/seat-plan-pdf";

interface SeatPlanModalProps {
  open: boolean;
  onClose: () => void;
  className: string;
  sessionName?: string;
  students: Student[];
  firstReg: Map<string, { registrationNumber?: string; createdAt?: string } | Registration>;
  institutionMap: Map<string, string>;
  initialGender?: string;
}

function genderText(g: string | undefined, isBn: boolean): string {
  if (!g) return isBn ? "শিক্ষার্থী" : "Student";
  const up = g.trim().toUpperCase();
  if (up === "MALE") return isBn ? "ছাত্র (পুরুষ)" : "Male";
  if (up === "FEMALE") return isBn ? "ছাত্রী (মহিলা)" : "Female";
  if (up === "OTHER") return isBn ? "অন্যান্য" : "Other";
  return g;
}

function SeatPreviewPhoto({ src, alt }: { src?: string; alt: string }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (src && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        onError={() => setFailed(true)}
        className="w-12 h-[58px] rounded border border-zinc-200 dark:border-zinc-700 object-cover bg-white shrink-0"
      />
    );
  }

  return (
    <div className="w-12 h-[58px] rounded border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 flex flex-col items-center justify-center shrink-0">
      <Users className="h-4 w-4 text-zinc-400 mb-0.5" />
      <span className="text-[7px] text-zinc-400 uppercase font-mono">PHOTO</span>
    </div>
  );
}

export function SeatPlanModal({
  open,
  onClose,
  className,
  sessionName,
  students,
  firstReg,
  institutionMap,
  initialGender = "",
}: SeatPlanModalProps) {
  const { theme } = useTheme();
  const { lang } = useLang();
  const { toast } = useToast();
  const isDark = theme === "dark";
  const isBn = lang === "bn";

  const { data: branding } = useBranding();
  const brand = useMemo(() => ({ ...BRANDING_DEFAULTS, ...(branding ?? {}) }), [branding]);

  const [selectedGender, setSelectedGender] = useState<string>(initialGender);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [previewPage, setPreviewPage] = useState<number>(1);

  useEffect(() => {
    setSelectedGender(initialGender);
    setPreviewPage(1);
  }, [initialGender, open]);

  // Compute gender options with counts of students who actually have an exam roll
  const genderStats = useMemo(() => {
    let maleWithRoll = 0, maleTotal = 0;
    let femaleWithRoll = 0, femaleTotal = 0;
    let otherWithRoll = 0, otherTotal = 0;
    let unassignedWithRoll = 0, unassignedTotal = 0;
    let totalWithRoll = 0;

    for (const s of students) {
      const up = (s.gender || "").trim().toUpperCase();
      const hasRoll = Boolean(s.examRoll && s.examRoll.trim());
      if (hasRoll) totalWithRoll++;

      if (up === "MALE") {
        maleTotal++;
        if (hasRoll) maleWithRoll++;
      } else if (up === "FEMALE") {
        femaleTotal++;
        if (hasRoll) femaleWithRoll++;
      } else if (up === "OTHER") {
        otherTotal++;
        if (hasRoll) otherWithRoll++;
      } else {
        unassignedTotal++;
        if (hasRoll) unassignedWithRoll++;
      }
    }

    return {
      all: { total: students.length, withRoll: totalWithRoll },
      male: { total: maleTotal, withRoll: maleWithRoll },
      female: { total: femaleTotal, withRoll: femaleWithRoll },
      other: { total: otherTotal, withRoll: otherWithRoll },
      unassigned: { total: unassignedTotal, withRoll: unassignedWithRoll },
    };
  }, [students]);

  // Filter students by selected gender and ensure they have an exam roll
  const targetStudents = useMemo(() => {
    let filtered = students;
    if (selectedGender) {
      const up = selectedGender.toUpperCase();
      if (up === "UNASSIGNED") {
        filtered = filtered.filter(
          (s) => !s.gender || !["MALE", "FEMALE", "OTHER"].includes(s.gender.trim().toUpperCase())
        );
      } else {
        filtered = filtered.filter((s) => (s.gender || "").trim().toUpperCase() === up);
      }
    }
    return filtered;
  }, [students, selectedGender]);

  // Sort strictly in numerical exam roll order (priority order for fetching & preview)
  const eligibleStudents = useMemo(() => {
    return targetStudents
      .filter((s) => Boolean(s.examRoll && s.examRoll.trim()))
      .sort((a, b) => (a.examRoll || "").localeCompare(b.examRoll || "", undefined, { numeric: true }));
  }, [targetStudents]);

  const pendingCount = targetStudents.length - eligibleStudents.length;

  const eligibleIds = useMemo(() => eligibleStudents.map((s) => s.id), [eligibleStudents]);

  const { data: photoMap = {}, isFetching: isPhotosFetching } = useStudentPhotos(eligibleIds, {
    variant: "card",
    enabled: open && eligibleIds.length > 0,
  });

  const rollRange = useMemo(() => {
    const rolls = eligibleStudents.map((s) => s.examRoll as string);
    return rolls.length ? `${rolls[0]} – ${rolls[rolls.length - 1]}` : null;
  }, [eligibleStudents]);

  const CARDS_PER_PAGE = 21; // 3 columns x 7 rows
  const pageCount = Math.max(1, Math.ceil(eligibleStudents.length / CARDS_PER_PAGE));

  const PREVIEW_SIZE = 6; // 3 columns x 2 rows in modal preview
  const previewTotalPages = Math.max(1, Math.ceil(eligibleStudents.length / PREVIEW_SIZE));
  const safePreviewPage = Math.min(Math.max(1, previewPage), previewTotalPages);
  const previewCards = useMemo(() => {
    const start = (safePreviewPage - 1) * PREVIEW_SIZE;
    return eligibleStudents.slice(start, start + PREVIEW_SIZE);
  }, [eligibleStudents, safePreviewPage]);

  const handleDownload = async () => {
    if (eligibleStudents.length === 0) {
      toast("error", isBn
        ? "আসন বিন্যাস তৈরি করার জন্য কোনো রোল নম্বর পাওয়া যায়নি"
        : "No students with roll numbers found for this selection");
      return;
    }

    setIsExporting(true);
    try {
      // Map to SeatPlanStudent with resolved student photos
      const seatPlanList: SeatPlanStudent[] = eligibleStudents.map((s) => {
        const reg = firstReg.get(s.id);
        const nameBn = [s.firstNameBn, s.lastNameBn].filter(Boolean).join(" ");
        const nameEn = [s.firstName, s.lastName].filter(Boolean).join(" ");
        const resolvedName = isBn ? (nameBn || nameEn) : (nameEn || nameBn);

        return {
          id: s.id,
          roll: s.examRoll || "",
          regNumber: reg?.registrationNumber || "-",
          name: resolvedName,
          institution: institutionMap.get(s.institutionId) || "Madrasah",
          photo: photoMap[s.id] || s.photo,
          gender: s.gender,
          className: s.class || className,
          studentId: s.studentId,
          classRoll: s.roll,
        };
      });

      const resolvedCompany = isBn
        ? (brand.brandNameBn || brand.brandName || "বাংলাদেশ মাদ্রাসা এসোসিয়েশন")
        : (brand.brandName || brand.brandNameBn || "Bangladesh Madrasah Association");

      const resolvedSubtitle = isBn
        ? (brand.brandName || "Bangladesh Madrasah Association")
        : (brand.brandNameBn || "বাংলাদেশ মাদ্রাসা এসোসিয়েশন");

      await exportSeatPlanPdf({
        students: seatPlanList,
        className,
        sessionName,
        genderFilter: selectedGender,
        companyName: resolvedCompany,
        companySubtitle: resolvedSubtitle,
        logo: brand.brandLogo || undefined,
        logoText: brand.brandShort || "BMA",
        accent: brand.accentColor || undefined,
        watermark: brand.brandWatermark || undefined,
        watermarkText: brand.brandShort || "BMA",
        lang: isBn ? "bn" : "en",
      });

      toast("success", isBn
        ? `আসন বিন্যাস পিডিএফ ডাউনলোড সম্পন্ন হয়েছে (${eligibleStudents.length} জন শিক্ষার্থী)`
        : `Seat plan PDF downloaded successfully (${eligibleStudents.length} students)`);

      onClose();
    } catch (err) {
      toast("error", `${isBn ? "পিডিএফ তৈরিতে ত্রুটি হয়েছে" : "Failed to generate PDF"}: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsExporting(false);
    }
  };

  if (!open) return null;

  const cardCls = isDark
    ? "bg-[#141416] border border-white/[0.08] text-white"
    : "bg-white border border-zinc-200 text-zinc-900";
  const borderCls = isDark ? "border-white/[0.08]" : "border-zinc-200";
  const subtleCls = isDark ? "bg-white/[0.03]" : "bg-zinc-50";
  const mutedText = isDark ? "text-zinc-400" : "text-zinc-500";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
        onClick={() => !isExporting && onClose()}
      />

      {/* Modal Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        className={`relative z-50 w-full max-w-3xl max-h-[92vh] flex flex-col rounded-lg shadow-2xl overflow-hidden ${cardCls}`}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${borderCls}`}>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-md bg-brand-accent-soft flex items-center justify-center shrink-0">
              <FileDown className="h-5 w-5 text-brand-accent" />
            </div>
            <div>
              <h2 className="text-base font-semibold leading-snug">
                {isBn ? "আসন বিন্যাস ডাউনলোড (Seat Plan PDF)" : "Download Seat Plan (PDF)"}
              </h2>
              <p className={`text-xs mt-0.5 ${mutedText}`}>
                {isBn ? `শ্রেণী: ${className}` : `Class: ${className}`}
                {sessionName ? ` · ${sessionName}` : ""}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isExporting}
            aria-label={isBn ? "বন্ধ করুন" : "Close"}
            className={`rounded-md p-1.5 transition-colors disabled:opacity-40 ${
              isDark
                ? "text-zinc-400 hover:text-white hover:bg-white/[0.08]"
                : "text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100"
            }`}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {/* 1. Gender Filter Selector */}
          <div>
            <label className={`block text-xs font-semibold uppercase tracking-wider mb-2 ${mutedText}`}>
              {isBn ? "১. লিঙ্গ ফিল্টার নির্বাচন করুন" : "1. Filter by Gender"}
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                {
                  id: "",
                  label: isBn ? "সকল লিঙ্গ" : "All Genders",
                  withRoll: genderStats.all.withRoll,
                  total: genderStats.all.total,
                },
                {
                  id: "MALE",
                  label: isBn ? "ছাত্র (পুরুষ)" : "Male",
                  withRoll: genderStats.male.withRoll,
                  total: genderStats.male.total,
                },
                {
                  id: "FEMALE",
                  label: isBn ? "ছাত্রী (মহিলা)" : "Female",
                  withRoll: genderStats.female.withRoll,
                  total: genderStats.female.total,
                },
                ...(genderStats.other.total > 0
                  ? [{
                      id: "OTHER",
                      label: isBn ? "অন্যান্য" : "Other",
                      withRoll: genderStats.other.withRoll,
                      total: genderStats.other.total,
                    }]
                  : []),
                ...(genderStats.unassigned.total > 0
                  ? [{
                      id: "UNASSIGNED",
                      label: isBn ? "অনির্ধারিত" : "Not Specified",
                      withRoll: genderStats.unassigned.withRoll,
                      total: genderStats.unassigned.total,
                    }]
                  : []),
              ].map((opt) => {
                const isSelected = selectedGender.toUpperCase() === opt.id.toUpperCase();
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setSelectedGender(opt.id);
                      setPreviewPage(1);
                    }}
                    className={`flex flex-col items-start px-3 py-2.5 rounded-md border text-left transition-all ${
                      isSelected
                        ? "border-brand-accent bg-brand-accent-soft text-brand-accent shadow-sm"
                        : `${borderCls} ${isDark ? "hover:bg-white/[0.04]" : "hover:bg-zinc-50"}`
                    }`}
                  >
                    <span className="text-xs font-medium">{opt.label}</span>
                    <span className={`text-[11px] mt-0.5 ${isSelected ? "text-brand-accent font-semibold" : mutedText}`}>
                      {opt.withRoll} {isBn ? "রোল তৈরি" : "with roll"}
                      {opt.total !== opt.withRoll && (
                        <span className="opacity-70"> ({opt.total})</span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Format & Layout Highlights */}
          <div className={`p-4 rounded-md border ${borderCls} ${subtleCls} space-y-2.5`}>
            <div className="flex items-center justify-between">
              <span className={`text-xs font-medium ${mutedText}`}>
                {isBn ? "লেআউট স্পেসিফিকেশন" : "Layout Specification"}
              </span>
              <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-brand-accent-soft text-brand-accent">
                A4 Portrait · 3 Cols × 7 Rows
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3 pt-2 border-t border-dashed border-zinc-300 dark:border-zinc-700">
              <div>
                <p className={`text-[10px] uppercase ${mutedText}`}>
                  {isBn ? "যোগ্য শিক্ষার্থী" : "Total Students"}
                </p>
                <p className="text-lg font-bold text-brand-accent">
                  {eligibleStudents.length}
                </p>
              </div>

              <div>
                <p className={`text-[10px] uppercase ${mutedText}`}>
                  {isBn ? "পৃষ্ঠা সংখ্যা" : "Estimated Pages"}
                </p>
                <p className="text-lg font-bold">
                  {pageCount} {isBn ? "টি" : "pages"}
                </p>
              </div>

              <div>
                <p className={`text-[10px] uppercase ${mutedText}`}>
                  {isBn ? "রোল নম্বর সীমা" : "Roll Range"}
                </p>
                <p className="text-xs font-mono font-semibold truncate mt-1">
                  {rollRange || "—"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              <span>
                {isBn
                  ? "প্রতি পৃষ্ঠায় ন্যূনতম ২০ জন (৩ কলামে ২১ জন) শিক্ষার্থীর আসন কার্ড থাকবে"
                  : "Covers minimum 20 students (exactly 21 in 3 columns) per A4 page"}
              </span>
            </div>
          </div>

          {/* 3. Warning if students are missing rolls or 0 eligible */}
          {eligibleStudents.length === 0 ? (
            <div className={`p-3.5 rounded-md border flex items-start gap-2.5 ${
              isDark ? "bg-amber-950/20 border-amber-800/40 text-amber-300" : "bg-amber-50 border-amber-200 text-amber-800"
            }`}>
              <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5 text-amber-500" />
              <div className="text-xs">
                <p className="font-semibold">
                  {isBn ? "কোনো রোল নম্বর তৈরি করা হয়নি" : "No Roll Numbers Generated"}
                </p>
                <p className="mt-0.5 opacity-90">
                  {isBn
                    ? "আসন বিন্যাস তৈরি করার পূর্বে এই শ্রেণীর শিক্ষার্থীদের পরীক্ষার রোল নম্বর তৈরি করুন।"
                    : "Please generate exam rolls for this class before downloading the seat plan."}
                </p>
              </div>
            </div>
          ) : pendingCount > 0 ? (
            <div className={`p-3 rounded-md border flex items-center gap-2 text-xs ${
              isDark ? "bg-blue-950/20 border-blue-800/40 text-blue-300" : "bg-blue-50 border-blue-200 text-blue-800"
            }`}>
              <AlertCircle className="h-4 w-4 shrink-0 text-blue-500" />
              <span>
                {isBn
                  ? `চিহ্নিত ${targetStudents.length} জনের মধ্যে ${eligibleStudents.length} জনের রোল তৈরি হয়েছে (${pendingCount} জনের বাকি)। শুধুমাত্র রোলপ্রাপ্ত শিক্ষার্থীরা আসন বিন্যাসে যুক্ত হবে।`
                  : `${eligibleStudents.length} of ${targetStudents.length} students have rolls (${pendingCount} pending). Only rolled students appear in the seat plan.`}
              </span>
            </div>
          ) : null}

          {/* 4. Live visual seat plan card preview with real photos */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={`block text-[10px] font-semibold uppercase tracking-wider ${mutedText}`}>
                {isBn ? "আসন কার্ডের লাইভ প্রিভিউ" : "Live Seat Card Preview"}
              </label>
              <div className="flex items-center gap-2">
                {isPhotosFetching && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-brand-accent font-medium">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    {isBn ? "ছবি লোড হচ্ছে..." : "Loading photos..."}
                  </span>
                )}
                {eligibleStudents.length > PREVIEW_SIZE && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setPreviewPage((p) => Math.max(1, p - 1))}
                      disabled={safePreviewPage <= 1}
                      aria-label="Previous preview page"
                      className={`p-1 rounded border ${borderCls} disabled:opacity-40`}
                    >
                      <ChevronLeft className="h-3 w-3" />
                    </button>
                    <span className={`text-[10px] font-mono px-1 ${mutedText}`}>
                      {safePreviewPage}/{previewTotalPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPreviewPage((p) => Math.min(previewTotalPages, p + 1))}
                      disabled={safePreviewPage >= previewTotalPages}
                      aria-label="Next preview page"
                      className={`p-1 rounded border ${borderCls} disabled:opacity-40`}
                    >
                      <ChevronRight className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {previewCards.length > 0 ? (
              <div className={`p-3 rounded-md border ${borderCls} ${subtleCls} grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5`}>
                {previewCards.map((s) => {
                  const reg = firstReg.get(s.id);
                  const nameBn = [s.firstNameBn, s.lastNameBn].filter(Boolean).join(" ");
                  const nameEn = [s.firstName, s.lastName].filter(Boolean).join(" ");
                  const resolvedName = (isBn ? (nameBn || nameEn) : (nameEn || nameBn)) || "—";
                  const photoSrc = photoMap[s.id] || s.photo;
                  const instLabel = institutionMap.get(s.institutionId) || "Madrasah";

                  return (
                    <div
                      key={s.id}
                      className="rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 overflow-hidden shadow-sm"
                    >
                      <div className="px-2 py-1 bg-zinc-50 dark:bg-zinc-800/80 border-b border-zinc-200 dark:border-zinc-700 flex items-center justify-between text-[9px]">
                        <span className="font-bold text-zinc-700 dark:text-zinc-300 truncate">
                          {isBn ? `শ্রেণী: ${s.class || className}` : `Class: ${s.class || className}`}
                        </span>
                        <span className="text-zinc-500 dark:text-zinc-400 shrink-0 ml-1">
                          {genderText(s.gender, isBn)}
                        </span>
                      </div>
                      <div className="p-2 flex items-start gap-2">
                        <div className="flex flex-col items-center shrink-0">
                          <SeatPreviewPhoto src={photoSrc} alt={resolvedName} />
                          {s.studentId && (
                            <span className="text-[7px] font-mono text-zinc-400 mt-0.5 truncate max-w-[48px]">
                              {s.studentId}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0 space-y-0.5">
                          <div className="flex items-baseline gap-1">
                            <span className="text-[9px] font-semibold text-zinc-500 dark:text-zinc-400">
                              {isBn ? "রোল:" : "ROLL:"}
                            </span>
                            <span className="text-xs font-mono font-bold text-zinc-900 dark:text-white">
                              {s.examRoll}
                            </span>
                          </div>
                          <p className="text-[9px] font-mono text-zinc-600 dark:text-zinc-400 truncate">
                            {isBn ? "রেজি:" : "Reg:"} {reg?.registrationNumber || "-"}
                          </p>
                          <p className="text-[10px] font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                            {resolvedName}
                          </p>
                          <p className="text-[9px] text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-tight">
                            {instLabel}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className={`p-3 rounded-md border ${borderCls} bg-white dark:bg-zinc-900 flex items-center gap-3 shadow-inner`}>
                <SeatPreviewPhoto alt="Sample student" />
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-zinc-700 dark:text-zinc-300">
                      {isBn ? `শ্রেণী: ${className}` : `Class: ${className}`}
                    </span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                      {selectedGender ? selectedGender : (isBn ? "সকল" : "All")}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400">
                      {isBn ? "রোল:" : "ROLL:"}
                    </span>
                    <span className="text-sm font-mono font-bold text-zinc-900 dark:text-white">
                      10001
                    </span>
                    <span className="text-[9px] text-zinc-400 ml-auto font-mono">
                      Reg: 2026000001
                    </span>
                  </div>
                  <p className="text-[11px] font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                    {isBn ? "মোহাম্মদ আব্দুল্লাহ" : "MD. ABDULLAH AL MAHMUD"}
                  </p>
                  <p className="text-[9px] text-zinc-500 dark:text-zinc-400 truncate">
                    {brand.brandName || "Darul Uloom Kamil Madrasah"}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className={`px-6 py-4 border-t ${borderCls} flex items-center justify-between gap-3 ${subtleCls}`}>
          <button
            type="button"
            onClick={onClose}
            disabled={isExporting}
            className={`px-4 py-2 rounded-md text-xs font-medium border transition-colors ${
              isDark
                ? "border-white/10 hover:bg-white/[0.05] text-zinc-300"
                : "border-zinc-300 hover:bg-zinc-100 text-zinc-700"
            }`}
          >
            {isBn ? "বন্ধ করুন" : "Close"}
          </button>

          <button
            type="button"
            onClick={handleDownload}
            disabled={isExporting || isPhotosFetching || eligibleStudents.length === 0}
            className="flex items-center gap-2 px-5 py-2.5 rounded-md text-xs font-semibold bg-brand-accent text-brand-accent-fg hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed shadow transition-all"
          >
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{isBn ? "পিডিএফ প্রস্তুত হচ্ছে..." : "Generating PDF..."}</span>
              </>
            ) : isPhotosFetching ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{isBn ? "ছবি লোড হচ্ছে..." : "Loading Photos..."}</span>
              </>
            ) : (
              <>
                <FileDown className="h-4 w-4" />
                <span>
                  {isBn
                    ? `আসন বিন্যাস ডাউনলোড (${eligibleStudents.length})`
                    : `Download Seat Plan (${eligibleStudents.length})`}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
