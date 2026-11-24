"use client";

import { useState, useMemo, useEffect } from "react";
import { X, FileDown, Loader2, Users, AlertCircle, CheckCircle2, ShieldAlert } from "lucide-react";
import { useTheme } from "@/contexts/theme-context";
import { useLang } from "@/contexts/language-context";
import { useToast } from "@/components/ui/toast";
import { useBranding, BRANDING_DEFAULTS } from "@/lib/storage/branding";
import { Student, Registration } from "@/lib/types";
import { exportSeatPlanPdf, SeatPlanStudent } from "@/lib/pdf/seat-plan-pdf";

interface SeatPlanModalProps {
  open: boolean;
  onClose: () => void;
  className: string;
  sessionName?: string;
  students: Student[];
  firstReg: Map<string, Registration>;
  institutionMap: Map<string, string>;
  initialGender?: string;
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

  useEffect(() => {
    setSelectedGender(initialGender);
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

  const eligibleStudents = useMemo(() => {
    return targetStudents.filter((s) => Boolean(s.examRoll && s.examRoll.trim()));
  }, [targetStudents]);

  const pendingCount = targetStudents.length - eligibleStudents.length;

  const rollRange = useMemo(() => {
    const rolls = eligibleStudents
      .map((s) => s.examRoll as string)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    return rolls.length ? `${rolls[0]} – ${rolls[rolls.length - 1]}` : null;
  }, [eligibleStudents]);

  const CARDS_PER_PAGE = 21; // 3 columns x 7 rows
  const pageCount = Math.max(1, Math.ceil(eligibleStudents.length / CARDS_PER_PAGE));

  const handleDownload = async () => {
    if (eligibleStudents.length === 0) {
      toast("error", isBn
        ? "আসন বিন্যাস তৈরি করার জন্য কোনো রোল নম্বর পাওয়া যায়নি"
        : "No students with roll numbers found for this selection");
      return;
    }

    setIsExporting(true);
    try {
      // Map to SeatPlanStudent
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
          photo: s.photo,
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
        className={`relative z-50 w-full max-w-xl max-h-[92vh] flex flex-col rounded-lg shadow-2xl overflow-hidden ${cardCls}`}
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
            onClick={onClose}
            disabled={isExporting}
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
                    onClick={() => setSelectedGender(opt.id)}
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

          {/* 4. Mini visual card layout preview */}
          <div>
            <label className={`block text-[10px] font-semibold uppercase tracking-wider mb-2 ${mutedText}`}>
              {isBn ? "আসন কার্ডের নমুনা প্রিভিউ" : "Card Layout Preview"}
            </label>
            <div className={`p-3 rounded-md border ${borderCls} bg-white dark:bg-zinc-900 flex items-center gap-3 shadow-inner`}>
              {/* Photo Box */}
              <div className="w-12 h-14 rounded border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 flex flex-col items-center justify-center shrink-0">
                <Users className="h-4 w-4 text-zinc-400 mb-1" />
                <span className="text-[8px] text-zinc-400 uppercase font-mono">PHOTO</span>
              </div>

              {/* Text Info */}
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
                    {rollRange ? rollRange.split(" ")[0] : "10001"}
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
            disabled={isExporting || eligibleStudents.length === 0}
            className="flex items-center gap-2 px-5 py-2.5 rounded-md text-xs font-semibold bg-brand-accent text-brand-accent-fg hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed shadow transition-all"
          >
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{isBn ? "পিডিএফ প্রস্তুত হচ্ছে..." : "Generating PDF..."}</span>
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
