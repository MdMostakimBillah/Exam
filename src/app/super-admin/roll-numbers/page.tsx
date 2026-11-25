"use client";
import { useState, useEffect, useMemo } from "react";
import { Table, TableBody, TableCell, TableHeader, TableRow, TableHead } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Pagination } from "@/components/ui/pagination";
import { useToast } from "@/components/ui/toast";
import { useTheme } from "@/contexts/theme-context";
import { useLang } from "@/contexts/language-context";
import { cn } from "@/lib/utils/helpers";
import { useCurrentSession } from "@/lib/storage/sessions";
import { useStudentsByClass, useStudentPhotos } from "@/lib/storage/students";
import { useClassRollSummaries, useGenerateExamRolls, getRollPrefix, type ClassRollSummary } from "@/lib/storage/exam-rolls";
import { useInstitutions, useInstitutionName } from "@/lib/storage/institutions";
import { useClasses } from "@/lib/storage/classes";
import { useStudentRegistrationMeta, type StudentRegistrationMeta } from "@/lib/storage/registrations";
import { formatDate } from "@/lib/storage/storage";
import { Registration } from "@/lib/types";
import { Hash, Search, Sparkles, Loader2, AlertTriangle, Users, FileDown, LayoutGrid, List } from "lucide-react";
import { LoadingBar } from "@/components/ui/loading-bar";
import { SeatPlanModal } from "@/components/seat-plan/seat-plan-modal";

function StudentPhotoThumb({
  src,
  alt,
  fallbackText,
  sizeClass,
  isDark,
  placeholderLabel,
}: {
  src?: string;
  alt: string;
  fallbackText: string;
  sizeClass: string;
  isDark: boolean;
  placeholderLabel?: string;
}) {
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
        className={`${sizeClass} rounded-md object-cover shrink-0 bg-white border ${isDark ? "border-white/10" : "border-zinc-200"}`}
      />
    );
  }

  if (placeholderLabel) {
    return (
      <div className={`${sizeClass} rounded-md border flex flex-col items-center justify-center shrink-0 ${isDark ? "border-white/10 bg-white/[0.04]" : "border-zinc-200 bg-zinc-100"}`}>
        <Users className="h-4 w-4 text-zinc-400 mb-0.5" />
        <span className="text-[7px] text-zinc-400 uppercase font-mono">{placeholderLabel}</span>
      </div>
    );
  }

  return (
    <div className={`${sizeClass} rounded-md flex items-center justify-center text-[10px] font-bold shrink-0 ${isDark ? "bg-white/[0.08] text-zinc-300" : "bg-zinc-100 text-zinc-600"}`}>
      {fallbackText}
    </div>
  );
}

function genderLabel(g: string | undefined, isBn: boolean): string {
  if (!g) return '-';
  const up = g.trim().toUpperCase();
  if (up === 'MALE') return isBn ? 'পুরুষ' : 'Male';
  if (up === 'FEMALE') return isBn ? 'মহিলা' : 'Female';
  if (up === 'OTHER') return isBn ? 'অন্যান্য' : 'Other';
  return g;
}

export default function RollNumbersPage() {
  const { theme } = useTheme();
  const { lang: language } = useLang();
  const { toast } = useToast();
  const isDark = theme === "dark";
  const isBn = language === "bn";
  const [mounted, setMounted] = useState(false);
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedGender, setSelectedGender] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(30);
  const [viewMode, setViewMode] = useState<'list' | 'seat-plan'>('list');
  const [seatPage, setSeatPage] = useState(1);
  const [isSeatPlanOpen, setIsSeatPlanOpen] = useState(false);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { setPage(1); setSeatPage(1); }, [selectedClass, selectedGender, search, pageSize]);

  // ---- Data ----
  const sessionQuery = useCurrentSession();
  const currentSession = sessionQuery.data;
  const sessionId = currentSession?.id;
  const summariesQuery = useClassRollSummaries(sessionId);
  const summaries = useMemo(() => summariesQuery.data ?? [], [summariesQuery.data]);
  const studentsQuery = useStudentsByClass(sessionId, selectedClass);
  const students = useMemo(() => studentsQuery.data ?? [], [studentsQuery.data]);
  const { data: institutions = [] } = useInstitutions();
  const { data: allClasses = [] } = useClasses();
  const { data: regMeta = [] } = useStudentRegistrationMeta(sessionId);
  const generateMutation = useGenerateExamRolls();

  // Fallback: map a class name to its classes.code (e.g. 'Five' -> 'CLS-05'
  // or '5') so the prefix can still be derived when the name has no digits.
  const classCodeByName = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of allClasses) map.set(c.name.toLowerCase().trim(), c.code);
    return map;
  }, [allClasses]);

  const instName = useInstitutionName();
  const institutionMap = useMemo(
    () => new Map(institutions.map(i => [i.id, instName(i.name, i.id)])),
    [institutions, instName]
  );

  // Earliest registration per student — the exact order the generator
  // assigns numbers in (first registered student = first roll number).
  const firstReg = useMemo(() => {
    const map = new Map<string, StudentRegistrationMeta>();
    for (const r of regMeta) {
      if (!r.studentId) continue;
      const existing = map.get(r.studentId);
      if (!existing || new Date(r.createdAt || 0) < new Date(existing.createdAt || 0)) {
        map.set(r.studentId, r);
      }
    }
    return map;
  }, [regMeta]);

  const summary: ClassRollSummary | undefined = summaries.find(s => s.className === selectedClass);
  const total = summary?.total ?? students.length;
  const rolled = summary?.rolled ?? students.filter(s => s.examRoll).length;
  const pending = Math.max(total - rolled, 0);
  const prefix = selectedClass
    ? getRollPrefix(selectedClass, classCodeByName.get(selectedClass.toLowerCase().trim()))
    : null;

  // Gender options with live student counts
  const genderOptions = useMemo(() => {
    const maleCount = students.filter(s => (s.gender || '').trim().toUpperCase() === 'MALE').length;
    const femaleCount = students.filter(s => (s.gender || '').trim().toUpperCase() === 'FEMALE').length;
    const otherCount = students.filter(s => (s.gender || '').trim().toUpperCase() === 'OTHER').length;
    const unassignedCount = students.filter(s => !s.gender || !['MALE', 'FEMALE', 'OTHER'].includes(s.gender.trim().toUpperCase())).length;
    return [
      {
        label: selectedClass
          ? `${isBn ? "সকল লিঙ্গ" : "All Genders"} (${students.length})`
          : (isBn ? "সকল লিঙ্গ" : "All Genders"),
        value: "",
      },
      {
        label: selectedClass
          ? `${isBn ? "ছাত্র (পুরুষ)" : "Male"} (${maleCount})`
          : (isBn ? "ছাত্র (পুরুষ)" : "Male"),
        value: "MALE",
      },
      {
        label: selectedClass
          ? `${isBn ? "ছাত্রী (মহিলা)" : "Female"} (${femaleCount})`
          : (isBn ? "ছাত্রী (মহিলা)" : "Female"),
        value: "FEMALE",
      },
      ...(otherCount > 0 ? [{
        label: selectedClass
          ? `${isBn ? "অন্যান্য" : "Other"} (${otherCount})`
          : (isBn ? "অন্যান্য" : "Other"),
        value: "OTHER",
      }] : []),
      ...(unassignedCount > 0 ? [{
        label: selectedClass
          ? `${isBn ? "অনির্ধারিত" : "Not Specified"} (${unassignedCount})`
          : (isBn ? "অনির্ধারিত" : "Not Specified"),
        value: "UNASSIGNED",
      }] : []),
    ];
  }, [students, selectedClass, isBn]);

  // Target students based on selected gender
  const targetStudents = useMemo(() => {
    if (!selectedGender) return students;
    if (selectedGender === 'UNASSIGNED') {
      return students.filter(s => !s.gender || !['MALE', 'FEMALE', 'OTHER'].includes(s.gender.trim().toUpperCase()));
    }
    return students.filter(s => (s.gender || '').trim().toUpperCase() === selectedGender.toUpperCase());
  }, [students, selectedGender]);

  const targetTotal = targetStudents.length;
  const targetRolled = targetStudents.filter(s => s.examRoll).length;
  const targetPending = Math.max(targetTotal - targetRolled, 0);

  const rollRange = useMemo(() => {
    const rolls = students.map(s => s.examRoll).filter((r): r is string => !!r).sort();
    return rolls.length ? `${rolls[0]} – ${rolls[rolls.length - 1]}` : null;
  }, [students]);

  // The next roll number to be assigned across this class prefix
  // Always continues after the highest existing roll sequence in this session
  const nextStart = useMemo(() => {
    if (!prefix) return null;
    let maxSeq = 0;
    for (const s of students) {
      if (s.examRoll && s.examRoll.startsWith(prefix)) {
        const seq = parseInt(s.examRoll.slice(2), 10);
        if (!Number.isNaN(seq) && seq > maxSeq) maxSeq = seq;
      }
    }
    return `${prefix}${String(maxSeq + 1).padStart(4, "0")}`;
  }, [students, prefix]);

  // Sorting: students with examRoll first (numerical order), then pending students (registration order)
  const sorted = useMemo(() => {
    const time = (id: string) => {
      const reg = firstReg.get(id);
      return reg ? new Date(reg.createdAt || 0).getTime() : null;
    };
    return [...students].sort((a, b) => {
      if (a.examRoll && b.examRoll) {
        return a.examRoll.localeCompare(b.examRoll, undefined, { numeric: true });
      }
      if (a.examRoll && !b.examRoll) return -1;
      if (!a.examRoll && b.examRoll) return 1;
      const ta = time(a.id);
      const tb = time(b.id);
      if (ta !== null && tb !== null && ta !== tb) return ta - tb;
      if (ta !== null && tb === null) return -1;
      if (ta === null && tb !== null) return 1;
      return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
    });
  }, [students, firstReg]);

  const filtered = useMemo(() => sorted.filter(s => {
    if (selectedGender) {
      const up = (s.gender || '').trim().toUpperCase();
      if (selectedGender === 'UNASSIGNED') {
        if (['MALE', 'FEMALE', 'OTHER'].includes(up)) return false;
      } else if (up !== selectedGender.toUpperCase()) {
        return false;
      }
    }
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const reg = firstReg.get(s.id);
    return `${s.firstName} ${s.lastName}`.toLowerCase().includes(q)
      || s.studentId.toLowerCase().includes(q)
      || (reg?.registrationNumber || "").toLowerCase().includes(q)
      || (s.examRoll || "").includes(q);
  }), [sorted, selectedGender, search, firstReg]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const rows = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safePage, pageSize]);

  const SEAT_PLAN_PAGE_SIZE = 21; // 3 columns x 7 rows (matches A4 Seat Plan PDF)
  const seatPlanStudents = useMemo(
    () => filtered.filter((s) => Boolean(s.examRoll && s.examRoll.trim())),
    [filtered]
  );
  const seatTotalPages = Math.max(1, Math.ceil(seatPlanStudents.length / SEAT_PLAN_PAGE_SIZE));
  const safeSeatPage = Math.min(Math.max(1, seatPage), seatTotalPages);
  const seatPageStudents = useMemo(() => {
    const start = (safeSeatPage - 1) * SEAT_PLAN_PAGE_SIZE;
    return seatPlanStudents.slice(start, start + SEAT_PLAN_PAGE_SIZE);
  }, [seatPlanStudents, safeSeatPage]);

  const visiblePhotoIds = useMemo(
    () => (viewMode === 'seat-plan' ? seatPageStudents : rows).map((s) => s.id),
    [viewMode, seatPageStudents, rows]
  );
  const { data: photoMap = {}, isFetching: isPhotosFetching } = useStudentPhotos(visiblePhotoIds, {
    variant: viewMode === 'seat-plan' ? 'card' : 'thumb',
    enabled: Boolean(selectedClass) && visiblePhotoIds.length > 0,
  });

  const classOptions = useMemo(() => summaries.map(s => ({
    label: `${s.className} (${s.total}${s.rolled ? ` · ${s.rolled} ${isBn ? 'রোল' : 'rolled'}` : ''})`,
    value: s.className,
  })), [summaries, isBn]);

  // ---- Generate ----
  const handleGenerate = async () => {
    if (!sessionId) {
      toast("error", isBn
        ? 'বর্তমান একাডেমিক সেশন পাওয়া যায়নি — পেজ রিফ্রেশ করুন'
        : 'No academic session loaded — refresh the page');
      return;
    }
    if (!selectedClass) {
      toast("warning", isBn ? 'আগে একটি শ্রেণী নির্বাচন করুন' : 'Select a class first');
      return;
    }
    if (!summary || summary.total === 0) {
      toast("error", isBn ? 'এই শ্রেণীতে কোনো শিক্ষার্থী নেই' : 'No students in this class');
      return;
    }
    if (!prefix) {
      toast("error", isBn
        ? `শ্রেণী নম্বর বোঝা যায়নি "${selectedClass}" — রোল প্রিফিক্স তৈরি করা যায়নি`
        : `Cannot determine a class number from "${selectedClass}"`);
      return;
    }
    if (targetTotal === 0) {
      const gLabel = selectedGender ? genderLabel(selectedGender, isBn) : '';
      toast("error", isBn
        ? `এই শ্রেণীতে কোনো ${gLabel} শিক্ষার্থী নেই`
        : `No ${gLabel} students in this class`);
      return;
    }
    if (targetPending === 0) {
      const gLabel = selectedGender ? genderLabel(selectedGender, isBn) : '';
      toast("info", isBn
        ? `এই শ্রেণীর ${gLabel ? gLabel + ' ' : ''}সব শিক্ষার্থীর রোল নম্বর ইতিমধ্যে আছে`
        : `Every ${gLabel ? gLabel + ' ' : ''}student in this class already has a roll number`);
      return;
    }

    const gLabel = selectedGender ? genderLabel(selectedGender, isBn) : '';
    const ok = confirm(isBn
      ? `"${selectedClass}" শ্রেণীর ${gLabel ? gLabel + ' ' : ''}${targetPending} জন শিক্ষার্থীর পরীক্ষার রোল নম্বর তৈরি হবে।\n\nপ্রিফিক্স: ${prefix} · পরবর্তী শুরুর নম্বর: ${nextStart}\nপ্রথমে নিবন্ধিত শিক্ষার্থীই প্রথম রোল পাবেন। যাদের আগে থেকেই রোল আছে তাদের নম্বর অপরিবর্তিত থাকবে।\n\nচালিয়ে যাবেন?`
      : `Generate exam rolls for ${targetPending} ${gLabel ? gLabel + ' ' : ''}students of "${selectedClass}"?\n\nPrefix: ${prefix} · Next number: ${nextStart}\nThe earliest-registered student gets the first number. Existing rolls are never changed.\n\nContinue?`);
    if (!ok) return;

    try {
      const res = await generateMutation.mutateAsync({
        sessionId,
        className: selectedClass,
        gender: selectedGender || undefined,
      });
      if (res.assigned === 0) {
        toast("info", isBn ? 'সব শিক্ষার্থীর রোল নম্বর আগে থেকেই আছে' : 'All students already have roll numbers');
      } else {
        toast("success", isBn
          ? `${res.assigned} টি রোল তৈরি হয়েছে: ${res.start} – ${res.end}`
          : `Generated ${res.assigned} rolls: ${res.start} – ${res.end}`);
      }
    } catch (err) {
      toast("error", `${isBn ? 'রোল তৈরি করা যায়নি' : 'Could not generate rolls'}: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  if (!mounted) return <RollNumbersSkeleton isDark={isDark} />;

  const card = isDark
    ? "bg-[#141416] border border-white/[0.06] rounded-md"
    : "bg-white border border-zinc-200 rounded-md shadow-sm";
  const iconBg = "bg-brand-accent-soft";
  const iconColor = "text-brand-accent";
  const labelCls = isDark ? "text-zinc-400" : "text-zinc-600";
  const inputCls = isDark
    ? "bg-white/[0.04] border-white/[0.08] text-white placeholder:text-zinc-500"
    : "bg-white border-zinc-200 text-zinc-900";
  const subtext = isDark ? "text-zinc-500" : "text-zinc-400";
  const headCls = `text-[10px] font-medium uppercase tracking-wider ${isDark ? "text-zinc-400" : "text-zinc-500"}`;
  const queryError = studentsQuery.isError || summariesQuery.isError;

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0a0a0b]" : "bg-zinc-50"}`}>
      <LoadingBar isLoading={generateMutation.isPending} />
      <div className="max-w-[1600px] mx-auto p-6 lg:p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className={`text-2xl lg:text-3xl font-bold tracking-tight ${isDark ? "text-white" : "text-zinc-900"}`}>
            {isBn ? 'রোল নম্বর' : 'Roll Numbers'}
          </h1>
          <p className={`text-sm mt-1 ${subtext}`}>
            {isBn
              ? 'শ্রেণী ও লিঙ্গ নির্বাচন করে পরীক্ষার রোল নম্বর তৈরি করুন — ধারাবাহিকতা বজায় রেখে রোল নম্বর তৈরি হবে'
              : 'Select class and gender to generate exam rolls sequentially — rolls continue after previously generated numbers'}
          </p>
        </div>

        {/* Session / migration problem */}
        {sessionQuery.isError || (!sessionQuery.isPending && !currentSession) ? (
          <div className={`mb-6 flex items-center gap-2.5 px-4 py-3 rounded-md border text-[13px] ${isDark ? "border-red-500/30 bg-red-500/10 text-red-400" : "border-red-200 bg-red-50 text-red-600"}`}>
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {isBn
              ? 'বর্তমান একাডেমিক সেশন পাওয়া যায়নি — পেজ রিফ্রেশ করুন অথবা Sessions থেকে একটি সেশন সেট করুন'
              : 'Current academic session not found — refresh the page or set one from Sessions'}
          </div>
        ) : null}

        {queryError && (
          <div className={`mb-6 flex items-center gap-2.5 px-4 py-3 rounded-md border text-[13px] ${isDark ? "border-red-500/30 bg-red-500/10 text-red-400" : "border-red-200 bg-red-50 text-red-600"}`}>
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {isBn
              ? 'রোল ডেটা আনা যায়নি — Supabase SQL Editor এ 0013 মাইগ্রেশন চালান'
              : 'Roll data unavailable — run migration 0013 in the Supabase SQL Editor'}
          </div>
        )}

        {/* Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            {
              label: selectedClass && selectedGender
                ? (isBn ? `${genderLabel(selectedGender, isBn)} শিক্ষার্থী` : `${genderLabel(selectedGender, false)} Students`)
                : (isBn ? 'শ্রেণীর শিক্ষার্থী' : 'Class Students'),
              value: selectedClass ? (selectedGender ? `${targetTotal} (${genderLabel(selectedGender, isBn)})` : total) : '—'
            },
            {
              label: selectedClass && selectedGender
                ? (isBn ? `${genderLabel(selectedGender, isBn)} রোল তৈরি` : `${genderLabel(selectedGender, false)} Rolled`)
                : (isBn ? 'রোল তৈরি' : 'Rolls Generated'),
              value: selectedClass ? (selectedGender ? `${targetRolled} / ${targetTotal}` : `${rolled} / ${total}`) : '—'
            },
            {
              label: selectedClass && selectedGender
                ? (isBn ? `${genderLabel(selectedGender, isBn)} বাকি` : `${genderLabel(selectedGender, false)} Pending`)
                : (isBn ? 'বাকি' : 'Pending'),
              value: selectedClass ? (selectedGender ? targetPending : pending) : '—'
            },
            {
              label: isBn ? 'রোল প্রিফিক্স' : 'Roll Prefix',
              value: prefix ? `${prefix} · ${pending > 0 ? nextStart : '—'}` : '—'
            },
          ].map((s) => (
            <div key={s.label} className={`${card} px-4 py-3 flex items-center gap-3`}>
              <div className={`h-10 w-10 rounded-md flex items-center justify-center shrink-0 ${iconBg}`}>
                <Hash className={`h-5 w-5 ${iconColor}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-lg font-bold tracking-tight leading-tight ${isDark ? "text-white" : "text-zinc-900"}`}>{s.value}</p>
                <p className={`text-[11px] ${labelCls}`}>{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Controls */}
        <div className={`${card} p-4 mb-6`}>
          <div className="flex flex-col md:flex-row gap-3 items-start md:items-end">
            <div className="flex-1 min-w-[200px] w-full md:w-auto">
              <label className={`block text-[11px] mb-1.5 font-medium ${labelCls}`}>
                {isBn ? 'শ্রেণী নির্বাচন' : 'Select Class'}
              </label>
              <Select
                options={classOptions}
                placeholder={isBn ? 'শ্রেণী নির্বাচন করুন' : 'Select a class'}
                value={selectedClass}
                onChange={(e) => {
                  setSelectedClass(e.target.value);
                  setSelectedGender("");
                }}
                className={inputCls}
              />
              {!summariesQuery.isPending && classOptions.length === 0 && !queryError && !!currentSession && (
                <p className={`text-[11px] mt-1.5 ${isDark ? "text-amber-400" : "text-amber-600"}`}>
                  {isBn
                    ? `এই সেশনে (${currentSession.name}) কোনো শিক্ষার্থী নেই — রোল তৈরি করা যাবে না`
                    : `No students in session ${currentSession.name} — there is nothing to generate`}
                </p>
              )}
            </div>

            <div className="w-full md:w-[220px]">
              <label className={`block text-[11px] mb-1.5 font-medium ${labelCls}`}>
                {isBn ? 'লিঙ্গ নির্বাচন' : 'Select Gender'}
              </label>
              <Select
                options={genderOptions}
                value={selectedGender}
                onChange={(e) => setSelectedGender(e.target.value)}
                className={inputCls}
                disabled={!selectedClass}
              />
            </div>

            <button
              onClick={handleGenerate}
              disabled={generateMutation.isPending || !selectedClass}
              className={cn(
                "flex items-center justify-center gap-2 px-5 h-10 rounded-md text-[13px] font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed w-full md:w-auto shrink-0",
                "bg-brand-accent text-brand-accent-fg hover:opacity-90"
              )}
            >
              {generateMutation.isPending
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Sparkles className="h-4 w-4" />}
              {selectedGender
                ? (isBn ? `${genderLabel(selectedGender, isBn)} রোল তৈরি করুন` : `Generate ${genderLabel(selectedGender, false)} Roll`)
                : (isBn ? 'রোল তৈরি করুন' : 'Generate Roll')}
            </button>

            <button
              type="button"
              onClick={() => setIsSeatPlanOpen(true)}
              disabled={!selectedClass}
              className={cn(
                "flex items-center justify-center gap-2 px-4 h-10 rounded-md text-[13px] font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed w-full md:w-auto shrink-0 border",
                isDark
                  ? "border-white/10 bg-white/[0.05] text-white hover:bg-white/[0.08]"
                  : "border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50 shadow-sm"
              )}
              title={isBn ? "আসন বিন্যাস পিডিএফ তৈরি ও ডাউনলোড করুন" : "Generate & download seat plan PDF"}
            >
              <FileDown className="h-4 w-4 text-brand-accent" />
              {isBn ? 'আসন বিন্যাস (PDF)' : 'Seat Plan (PDF)'}
            </button>
          </div>

          {selectedClass && (
            <p className={`text-[11px] mt-3 ${subtext}`}>
              {prefix
                ? (isBn
                  ? `প্রিফিক্স ${prefix} · ${selectedGender ? genderLabel(selectedGender, isBn) + ': ' : ''}${targetTotal} জন শিক্ষার্থী · ${targetRolled} টি রোল তৈরি · বাকি: ${targetPending} · পরবর্তী শুরুর রোল: ${targetPending > 0 ? nextStart : '—'}${rollRange ? ` · বর্তমান রোল সীমা: ${rollRange}` : ''}`
                  : `Prefix ${prefix} · ${selectedGender ? genderLabel(selectedGender, false) + ': ' : ''}${targetTotal} students · ${targetRolled} rolled · Pending: ${targetPending} · Next roll: ${targetPending > 0 ? nextStart : '—'}${rollRange ? ` · Current range: ${rollRange}` : ''}`)
                : (isBn
                  ? `"${selectedClass}" থেকে শ্রেণী নম্বর বোঝা যায়নি — রোল তৈরি করা যাবে না`
                  : `Cannot determine a class number from "${selectedClass}" — rolls cannot be generated`)}
            </p>
          )}

          {selectedClass && targetPending === 0 && targetTotal > 0 && (
            <p className={`text-[11px] mt-1.5 ${isDark ? "text-emerald-400" : "text-emerald-600"}`}>
              {isBn
                ? `এই শ্রেণীর ${selectedGender ? genderLabel(selectedGender, isBn) + ' ' : ''}সব ${targetTotal} জন শিক্ষার্থীর রোল নম্বর ইতিমধ্যে আছে`
                : `All ${targetTotal} ${selectedGender ? genderLabel(selectedGender, false) + ' ' : ''}students in this class already have a roll number`}
            </p>
          )}
        </div>

        {/* Search */}
        {selectedClass && (
          <div className="relative mb-4 max-w-md">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${isDark ? "text-zinc-500" : "text-zinc-400"}`} />
            <Input
              placeholder={isBn ? 'নাম, শিক্ষার্থী আইডি, রোল বা রেজি নং দিয়ে খুঁজুন...' : 'Search by name, student ID, roll or reg no...'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={cn("pl-10", inputCls)}
            />
          </div>
        )}

        {/* Table / empty states */}
        {!selectedClass ? (
          <div className={`${card} flex flex-col items-center justify-center py-20`}>
            <div className={`h-14 w-14 rounded-md flex items-center justify-center mb-4 ${iconBg}`}>
              <Hash className={`h-7 w-7 ${iconColor}`} />
            </div>
            <p className={`text-sm font-medium ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>
              {isBn ? 'একটি শ্রেণী নির্বাচন করুন' : 'Select a class'}
            </p>
            <p className={`text-xs mt-1 ${subtext}`}>
              {isBn ? 'শ্রেণী নির্বাচন করলে শিক্ষার্থী ও রোল তালিকা দেখাবে' : 'Students and their roll numbers will appear here'}
            </p>
          </div>
        ) : (
          <div className={`${card}`}>
            <div className={`px-5 py-4 border-b flex flex-wrap items-center justify-between gap-3 ${isDark ? "border-white/[0.06]" : "border-zinc-100"}`}>
              <div className="flex items-center gap-2">
                {viewMode === 'seat-plan'
                  ? <LayoutGrid className={`h-4 w-4 ${isDark ? "text-zinc-400" : "text-zinc-500"}`} />
                  : <Users className={`h-4 w-4 ${isDark ? "text-zinc-400" : "text-zinc-500"}`} />}
                <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>
                  {viewMode === 'seat-plan'
                    ? (isBn ? 'আসন বিন্যাস (Seat Plan)' : 'Seat Plan')
                    : (isBn ? 'রোল নম্বর তালিকা' : 'Roll Number List')}
                </h3>
                <span className={`text-[11px] ${subtext}`}>
                  ({viewMode === 'seat-plan' ? seatPlanStudents.length : filtered.length})
                </span>
                {isPhotosFetching && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-brand-accent ml-2">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    {isBn ? 'ছবি লোড হচ্ছে...' : 'Loading photos...'}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {/* View Mode Toggle: Roll List vs Seat Plan */}
                <div className={`inline-flex rounded-md p-0.5 border ${isDark ? "border-white/10 bg-white/[0.03]" : "border-zinc-200 bg-zinc-100"}`}>
                  <button
                    type="button"
                    onClick={() => setViewMode('list')}
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium transition-colors",
                      viewMode === 'list'
                        ? "bg-brand-accent text-brand-accent-fg shadow-sm"
                        : isDark ? "text-zinc-400 hover:text-white" : "text-zinc-600 hover:text-zinc-900"
                    )}
                  >
                    <List className="h-3.5 w-3.5" />
                    {isBn ? 'রোল তালিকা' : 'Roll List'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('seat-plan')}
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium transition-colors",
                      viewMode === 'seat-plan'
                        ? "bg-brand-accent text-brand-accent-fg shadow-sm"
                        : isDark ? "text-zinc-400 hover:text-white" : "text-zinc-600 hover:text-zinc-900"
                    )}
                  >
                    <LayoutGrid className="h-3.5 w-3.5" />
                    {isBn ? 'আসন বিন্যাস' : 'Seat Plan'}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setIsSeatPlanOpen(true)}
                  disabled={!selectedClass}
                  className="flex items-center gap-1.5 text-xs text-brand-accent hover:underline font-medium transition-colors disabled:opacity-40 disabled:no-underline"
                >
                  <FileDown className="h-3.5 w-3.5" />
                  {isBn ? 'আসন বিন্যাস ডাউনলোড' : 'Download Seat Plan'}
                </button>
                <span className={`text-[11px] hidden lg:inline ${subtext}`}>
                  {isBn ? 'সাজানো: রোল নম্বর ও নিবন্ধনের ক্রমিক' : 'Sorted by exam roll and registration order'}
                </span>
              </div>
            </div>

            {studentsQuery.isPending ? (
              <div className="animate-pulse p-5 space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className={`h-5 rounded ${isDark ? "bg-white/[0.05]" : "bg-zinc-200/70"}`} />
                ))}
              </div>
            ) : (viewMode === 'seat-plan' ? seatPlanStudents.length === 0 : filtered.length === 0) ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className={`h-14 w-14 rounded-md flex items-center justify-center mb-4 ${iconBg}`}>
                  <Users className={`h-7 w-7 ${iconColor}`} />
                </div>
                <p className={`text-sm font-medium ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>
                  {viewMode === 'seat-plan'
                    ? (isBn ? 'আসন বিন্যাসের জন্য কোনো রোলপ্রাপ্ত শিক্ষার্থী নেই' : 'No rolled students for seat plan')
                    : search
                      ? (isBn ? 'কোনো শিক্ষার্থী পাওয়া যায়নি' : 'No students found')
                      : (isBn ? `এই শ্রেণীতে কোনো শিক্ষার্থী নেই` : 'No students in this class')}
                </p>
                <p className={`text-xs mt-1 ${subtext}`}>
                  {viewMode === 'seat-plan'
                    ? (isBn ? 'প্রথমে এই শ্রেণীর পরীক্ষার রোল নম্বর তৈরি করুন' : 'Generate exam rolls for this class first')
                    : search
                      ? (isBn ? 'অনুসন্ধান পরিবর্তন করুন' : 'Try a different search')
                      : (isBn ? 'নিবন্ধন পেজ থেকে শিক্ষার্থী যোগ করুন' : 'Add students from the registrations page')}
                </p>
              </div>
            ) : viewMode === 'seat-plan' ? (
              <>
                <div className="p-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
                  {seatPageStudents.map((s) => {
                    const reg = firstReg.get(s.id);
                    const nameBn = [s.firstNameBn, s.lastNameBn].filter(Boolean).join(" ");
                    const nameEn = [s.firstName, s.lastName].filter(Boolean).join(" ");
                    const displayName = (isBn ? (nameBn || nameEn) : (nameEn || nameBn)) || "-";
                    const photoUrl = photoMap[s.id] || s.photo;
                    const instLabel = institutionMap.get(s.institutionId) || 'Unknown';
                    const initials = (s.firstName || s.lastName || '?').charAt(0).toUpperCase();

                    return (
                      <div
                        key={s.id}
                        className={cn(
                          "rounded-md border overflow-hidden transition-shadow",
                          isDark ? "border-white/[0.08] bg-white/[0.02]" : "border-zinc-200 bg-white shadow-sm"
                        )}
                      >
                        <div className={cn(
                          "px-3 py-1.5 border-b flex items-center justify-between text-[10px]",
                          isDark ? "border-white/[0.06] bg-white/[0.03]" : "border-zinc-100 bg-zinc-50"
                        )}>
                          <span className={`font-semibold ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
                            {isBn ? `শ্রেণী: ${s.class || selectedClass}` : `Class: ${s.class || selectedClass}`}
                          </span>
                          <span className={subtext}>{genderLabel(s.gender, isBn)}</span>
                        </div>
                        <div className="p-3 flex items-start gap-3">
                          <div className="flex flex-col items-center shrink-0">
                            <StudentPhotoThumb
                              src={photoUrl}
                              alt={displayName}
                              fallbackText={initials}
                              sizeClass="w-[54px] h-[66px]"
                              isDark={isDark}
                              placeholderLabel="PHOTO"
                            />
                            {s.studentId && (
                              <span className={`text-[9px] font-mono mt-1 ${subtext}`}>
                                {s.studentId}
                              </span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-baseline gap-1.5">
                              <span className={`text-[10px] font-semibold uppercase ${subtext}`}>
                                {isBn ? 'রোল:' : 'ROLL:'}
                              </span>
                              <span className={`text-base font-mono font-bold leading-none ${isDark ? "text-white" : "text-zinc-900"}`}>
                                {s.examRoll}
                              </span>
                            </div>
                            <p className={`text-[11px] font-mono ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
                              {isBn ? 'রেজি:' : 'Reg:'} {reg?.registrationNumber || '-'}
                            </p>
                            <p className={`text-xs font-semibold truncate ${isDark ? "text-zinc-100" : "text-zinc-900"}`}>
                              {displayName}
                            </p>
                            <p className={`text-[11px] line-clamp-2 leading-snug ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
                              {instLabel}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className={`px-5 py-3 border-t flex flex-col sm:flex-row items-center justify-between gap-4 ${isDark ? "border-white/[0.06]" : "border-zinc-100"}`}>
                  <span className={`text-xs ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
                    {isBn
                      ? `${(safeSeatPage - 1) * SEAT_PLAN_PAGE_SIZE + 1}–${Math.min(safeSeatPage * SEAT_PLAN_PAGE_SIZE, seatPlanStudents.length)} / ${seatPlanStudents.length} শিক্ষার্থী (প্রতি পৃষ্ঠায় ২১টি কার্ড)`
                      : `Showing ${(safeSeatPage - 1) * SEAT_PLAN_PAGE_SIZE + 1}–${Math.min(safeSeatPage * SEAT_PLAN_PAGE_SIZE, seatPlanStudents.length)} of ${seatPlanStudents.length} students (21 cards / page)`}
                  </span>
                  <Pagination currentPage={safeSeatPage} totalPages={seatTotalPages} onPageChange={setSeatPage} className="py-0" />
                </div>
              </>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow className={isDark ? 'border-white/[0.04] hover:bg-transparent' : 'border-zinc-100 hover:bg-transparent'}>
                      <TableHead className={headCls}>{isBn ? 'ক্রম' : '#'}</TableHead>
                      <TableHead className={headCls}>{isBn ? 'শিক্ষার্থী' : 'Student'}</TableHead>
                      <TableHead className={headCls}>{isBn ? 'লিঙ্গ' : 'Gender'}</TableHead>
                      <TableHead className={headCls}>{isBn ? 'প্রতিষ্ঠান' : 'Institution'}</TableHead>
                      <TableHead className={headCls}>{isBn ? 'রেজি নং' : 'Reg No'}</TableHead>
                      <TableHead className={headCls}>{isBn ? 'নিবন্ধনের তারিখ' : 'Registered On'}</TableHead>
                      <TableHead className={headCls}>{isBn ? 'পরীক্ষার রোল' : 'Exam Roll'}</TableHead>
                      <TableHead className={headCls}>{isBn ? 'শ্রেণী রোল' : 'Class Roll'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((s, idx) => {
                      const reg = firstReg.get(s.id);
                      const seq = (safePage - 1) * pageSize + idx + 1;
                      const photoUrl = photoMap[s.id] || s.photo;
                      const fullName = `${s.firstName} ${s.lastName}`.trim();
                      const initials = (s.firstName || s.lastName || '?').charAt(0).toUpperCase();
                      return (
                        <TableRow key={s.id} className={isDark ? 'border-white/[0.04] hover:bg-white/[0.02]' : 'border-zinc-100 hover:bg-zinc-50'}>
                          <TableCell className={`text-[11px] ${subtext}`}>{seq}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2.5">
                              <StudentPhotoThumb
                                src={photoUrl}
                                alt={fullName}
                                fallbackText={initials}
                                sizeClass="h-8 w-8"
                                isDark={isDark}
                              />
                              <div className="flex flex-col">
                                <span className={`text-sm font-medium ${isDark ? "text-zinc-100" : "text-zinc-800"}`}>
                                  {fullName}
                                </span>
                                <span className={`text-[10px] font-mono ${subtext}`}>{s.studentId}</span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className={`text-[11px] ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>
                            {genderLabel(s.gender, isBn)}
                          </TableCell>
                          <TableCell className={`text-[11px] max-w-[180px] truncate ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>
                            {institutionMap.get(s.institutionId) || 'Unknown'}
                          </TableCell>
                          <TableCell className={`text-[11px] font-mono ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
                            {reg?.registrationNumber || '-'}
                          </TableCell>
                          <TableCell className={`text-[11px] ${subtext}`}>
                            {reg ? formatDate(reg.createdAt) : '-'}
                          </TableCell>
                          <TableCell>
                            {s.examRoll ? (
                              <span className={`text-[13px] font-mono font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>
                                {s.examRoll}
                              </span>
                            ) : (
                              <span className={`text-[11px] px-1.5 py-0.5 rounded ${isDark ? "bg-white/[0.06] text-zinc-500" : "bg-zinc-100 text-zinc-400"}`}>
                                {isBn ? 'বাকি' : 'Pending'}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className={`text-[11px] ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
                            {s.roll || '-'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                {/* Pagination */}
                <div className={`px-5 py-3 border-t flex flex-col sm:flex-row items-center justify-between gap-4 ${isDark ? "border-white/[0.06]" : "border-zinc-100"}`}>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className={`text-xs ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
                      {isBn ? "প্রতি পৃষ্ঠায়:" : "Per page:"}
                    </span>
                    <Select
                      options={[
                        { label: "30", value: "30" },
                        { label: "50", value: "50" },
                        { label: "70", value: "70" },
                        { label: "100", value: "100" },
                        { label: "200", value: "200" },
                        { label: "500", value: "500" },
                      ]}
                      value={String(pageSize)}
                      onChange={(e) => setPageSize(Number(e.target.value))}
                      className={`h-8 w-20 text-xs ${inputCls}`}
                    />
                    <span className={`text-xs ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
                      {isBn
                        ? `${(safePage - 1) * pageSize + 1}–${Math.min(safePage * pageSize, filtered.length)} / ${filtered.length} শিক্ষার্থী দেখানো হচ্ছে`
                        : `Showing ${(safePage - 1) * pageSize + 1}–${Math.min(safePage * pageSize, filtered.length)} of ${filtered.length} students`}
                    </span>
                  </div>
                  <Pagination currentPage={safePage} totalPages={totalPages} onPageChange={setPage} className="py-0" />
                </div>
              </>
            )}
          </div>
        )}
        {/* Seat Plan Modal */}
        <SeatPlanModal
          open={isSeatPlanOpen}
          onClose={() => setIsSeatPlanOpen(false)}
          className={selectedClass}
          sessionName={currentSession?.name}
          students={students}
          firstReg={firstReg}
          institutionMap={institutionMap}
          initialGender={selectedGender}
        />
      </div>
    </div>
  );
}

function RollNumbersSkeleton({ isDark }: { isDark: boolean }) {
  const sk = isDark ? "bg-white/[0.05]" : "bg-zinc-200/70";
  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0a0a0b]" : "bg-zinc-50"}`}>
      <div className="max-w-[1600px] mx-auto p-6 lg:p-8 animate-pulse">
        <div className={`h-7 w-56 rounded-md ${sk} mb-2.5`} />
        <div className={`h-4 w-96 max-w-full rounded-md ${sk} mb-8`} />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={`h-[66px] rounded-md ${sk}`} />
          ))}
        </div>
        <div className={`h-24 rounded-md ${sk} mb-6`} />
        <div className={`h-96 rounded-md ${sk}`} />
      </div>
    </div>
  );
}
