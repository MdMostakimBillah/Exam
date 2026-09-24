"use client";
import { useState, useEffect, useMemo } from "react";
import { Table, TableBody, TableCell, TableHeader, TableRow, TableHead } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { useTheme } from "@/contexts/theme-context";
import { useLang } from "@/contexts/language-context";
import { cn } from "@/lib/utils/helpers";
import { useCurrentSession } from "@/lib/storage/sessions";
import { useStudentsByClass } from "@/lib/storage/students";
import { useClassRollSummaries, useGenerateExamRolls, getRollPrefix, type ClassRollSummary } from "@/lib/storage/exam-rolls";
import { useInstitutions } from "@/lib/storage/institutions";
import { useClasses } from "@/lib/storage/classes";
import { useAllRegistrations } from "@/lib/storage/registrations";
import { formatDate } from "@/lib/storage/storage";
import { Registration } from "@/lib/types";
import { Hash, Search, Sparkles, Loader2, ChevronLeft, ChevronRight, AlertTriangle, Users } from "lucide-react";
import { LoadingBar } from "@/components/ui/loading-bar";

const PAGE_SIZE = 20;

export default function RollNumbersPage() {
  const { theme } = useTheme();
  const { lang: language } = useLang();
  const { toast } = useToast();
  const isDark = theme === "dark";
  const isBn = language === "bn";
  const [mounted, setMounted] = useState(false);
  const [selectedClass, setSelectedClass] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { setPage(1); }, [selectedClass, search]);

  // ---- Data ----
  const { data: currentSession } = useCurrentSession();
  const sessionId = currentSession?.id;
  const summariesQuery = useClassRollSummaries(sessionId);
  const summaries = useMemo(() => summariesQuery.data ?? [], [summariesQuery.data]);
  const studentsQuery = useStudentsByClass(sessionId, selectedClass);
  const students = useMemo(() => studentsQuery.data ?? [], [studentsQuery.data]);
  const { data: institutions = [] } = useInstitutions();
  const { data: allClasses = [] } = useClasses();
  const { data: regs = [] } = useAllRegistrations(sessionId);
  const generateMutation = useGenerateExamRolls();

  // Fallback: map a class name to its classes.code (e.g. 'Five' -> 'CLS-05'
  // or '5') so the prefix can still be derived when the name has no digits.
  const classCodeByName = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of allClasses) map.set(c.name.toLowerCase().trim(), c.code);
    return map;
  }, [allClasses]);

  const institutionMap = useMemo(
    () => new Map(institutions.map(i => [i.id, i.name])),
    [institutions]
  );

  // Earliest registration per student — the exact order the generator
  // assigns numbers in (first registered student = first roll number).
  const firstReg = useMemo(() => {
    const map = new Map<string, Registration>();
    for (const r of regs) {
      if (!r.studentId) continue;
      const existing = map.get(r.studentId);
      if (!existing || new Date(r.createdAt || 0) < new Date(existing.createdAt || 0)) {
        map.set(r.studentId, r);
      }
    }
    return map;
  }, [regs]);

  const summary: ClassRollSummary | undefined = summaries.find(s => s.className === selectedClass);
  const total = summary?.total ?? students.length;
  const rolled = summary?.rolled ?? students.filter(s => s.examRoll).length;
  const pending = Math.max(total - rolled, 0);
  const prefix = selectedClass
    ? getRollPrefix(selectedClass, classCodeByName.get(selectedClass.toLowerCase().trim()))
    : null;

  const rollRange = useMemo(() => {
    const rolls = students.map(s => s.examRoll).filter((r): r is string => !!r).sort();
    return rolls.length ? `${rolls[0]} – ${rolls[rolls.length - 1]}` : null;
  }, [students]);

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

  // Display order mirrors the assignment order: registration date first,
  // unregistered after, then student creation date.
  const sorted = useMemo(() => {
    const time = (id: string) => {
      const reg = firstReg.get(id);
      return reg ? new Date(reg.createdAt || 0).getTime() : null;
    };
    return [...students].sort((a, b) => {
      const ta = time(a.id);
      const tb = time(b.id);
      if (ta !== null && tb !== null && ta !== tb) return ta - tb;
      if (ta !== null && tb === null) return -1;
      if (ta === null && tb !== null) return 1;
      return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
    });
  }, [students, firstReg]);

  const filtered = useMemo(() => sorted.filter(s => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const reg = firstReg.get(s.id);
    return `${s.firstName} ${s.lastName}`.toLowerCase().includes(q)
      || s.studentId.toLowerCase().includes(q)
      || (reg?.registrationNumber || "").toLowerCase().includes(q)
      || (s.examRoll || "").includes(q);
  }), [sorted, search, firstReg]);

  const pageCount = Math.max(Math.ceil(filtered.length / PAGE_SIZE), 1);
  const currentPage = Math.min(page, pageCount);
  const rows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const classOptions = useMemo(() => summaries.map(s => ({
    label: `${s.className} (${s.total}${s.rolled ? ` · ${s.rolled} ${isBn ? 'রোল' : 'rolled'}` : ''})`,
    value: s.className,
  })), [summaries, isBn]);

  // ---- Generate ----
  const handleGenerate = async () => {
    if (!sessionId || !selectedClass) return;
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
    if (pending === 0) {
      toast("info", isBn
        ? `এই শ্রেণীর সব শিক্ষার্থীর রোল নম্বর আছে`
        : `Every student in this class already has a roll number`);
      return;
    }
    const ok = confirm(isBn
      ? `"${selectedClass}" শ্রেণীর ${total} জন শিক্ষার্থীর পরীক্ষার রোল নম্বর তৈরি হবে।\n\nপ্রিফিক্স: ${prefix} · পরবর্তী নম্বর: ${nextStart}\nপ্রথমে নিবন্ধিত শিক্ষার্থীই প্রথম রোল পাবেন। যাদের আগে থেকেই রোল আছে তাদের নম্বর অপরিবর্তিত থাকবে।\n\nচালিয়ে যিয়ে?`
      : `Generate exam rolls for ${total} students of "${selectedClass}"?\n\nPrefix: ${prefix} · Next number: ${nextStart}\nThe earliest-registered student gets the first number. Existing rolls are never changed.\n\nContinue?`);
    if (!ok) return;
    try {
      const res = await generateMutation.mutateAsync({ sessionId, className: selectedClass });
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
              ? 'শ্রেণী নির্বাচন করে পরীক্ষার রোল নম্বর তৈরি করুন — প্রথমে নিবন্ধিত শিক্ষার্থী প্রথম রোল পাবেন'
              : 'Select a class to generate exam roll numbers — the earliest-registered student gets the first number'}
          </p>
        </div>

        {/* Migration hint */}
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
            { label: isBn ? 'শ্রেণীর শিক্ষার্থী' : 'Class Students', value: selectedClass ? total : '—' },
            { label: isBn ? 'রোল তৈরি' : 'Rolls Generated', value: selectedClass ? rolled : '—' },
            { label: isBn ? 'বাকি' : 'Pending', value: selectedClass ? pending : '—' },
            { label: isBn ? 'রোল প্রিফিক্স' : 'Roll Prefix', value: prefix || '—' },
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
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
            <div className="flex-1 min-w-[220px]">
              <label className={`block text-[11px] mb-1.5 font-medium ${labelCls}`}>
                {isBn ? 'শ্রেণী নির্বাচন' : 'Select Class'}
              </label>
              <Select
                options={classOptions}
                placeholder={isBn ? 'শ্রেণী নির্বাচন করুন' : 'Select a class'}
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className={inputCls}
              />
            </div>
            <button
              onClick={handleGenerate}
              disabled={!selectedClass || generateMutation.isPending || pending === 0}
              className={cn(
                "flex items-center gap-2 px-5 h-10 rounded-md text-[13px] font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed",
                "bg-brand-accent text-brand-accent-fg hover:opacity-90"
              )}
            >
              {generateMutation.isPending
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Sparkles className="h-4 w-4" />}
              {isBn ? 'রোল তৈরি করুন' : 'Generate Roll'}
            </button>
          </div>
          {selectedClass && (
            <p className={`text-[11px] mt-2.5 ${subtext}`}>
              {prefix
                ? (isBn
                  ? `প্রিফিক্স ${prefix} · ${total} জন শিক্ষার্থী · ${rolled} টি রোল তৈরি · পরবর্তী: ${pending > 0 ? nextStart : '—'}${rollRange ? ` · সীমা: ${rollRange}` : ''}`
                  : `Prefix ${prefix} · ${total} students · ${rolled} rolled · Next: ${pending > 0 ? nextStart : '—'}${rollRange ? ` · Range: ${rollRange}` : ''}`)
                : (isBn
                  ? `"${selectedClass}" থেকে শ্রেণী নম্বর বোঝা যায়নি — রোল তৈরি করা যাবে না`
                  : `Cannot determine a class number from "${selectedClass}" — rolls cannot be generated`)}
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
            <div className={`px-5 py-4 border-b flex items-center justify-between ${isDark ? "border-white/[0.06]" : "border-zinc-100"}`}>
              <div className="flex items-center gap-2">
                <Users className={`h-4 w-4 ${isDark ? "text-zinc-400" : "text-zinc-500"}`} />
                <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>
                  {isBn ? 'রোল নম্বর তালিকা' : 'Roll Number List'}
                </h3>
                <span className={`text-[11px] ${subtext}`}>({filtered.length})</span>
              </div>
              <span className={`text-[11px] ${subtext}`}>
                {isBn ? 'সাজানো: নিবন্ধনের ক্রমিক' : 'Sorted by registration order'}
              </span>
            </div>

            {studentsQuery.isPending ? (
              <div className="animate-pulse p-5 space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className={`h-5 rounded ${isDark ? "bg-white/[0.05]" : "bg-zinc-200/70"}`} />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className={`h-14 w-14 rounded-md flex items-center justify-center mb-4 ${iconBg}`}>
                  <Users className={`h-7 w-7 ${iconColor}`} />
                </div>
                <p className={`text-sm font-medium ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>
                  {search
                    ? (isBn ? 'কোনো শিক্ষার্থী পাওয়া যায়নি' : 'No students found')
                    : (isBn ? `এই শ্রেণীতে কোনো শিক্ষার্থী নেই` : 'No students in this class')}
                </p>
                <p className={`text-xs mt-1 ${subtext}`}>
                  {search
                    ? (isBn ? 'অনুসন্ধান পরিবর্তন করুন' : 'Try a different search')
                    : (isBn ? 'নিবন্ধন পেজ থেকে শিক্ষার্থী যোগ করুন' : 'Add students from the registrations page')}
                </p>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow className={isDark ? 'border-white/[0.04] hover:bg-transparent' : 'border-zinc-100 hover:bg-transparent'}>
                      <TableHead className={headCls}>{isBn ? 'ক্রম' : '#'}</TableHead>
                      <TableHead className={headCls}>{isBn ? 'শিক্ষার্থী' : 'Student'}</TableHead>
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
                      const seq = (currentPage - 1) * PAGE_SIZE + idx + 1;
                      return (
                        <TableRow key={s.id} className={isDark ? 'border-white/[0.04] hover:bg-white/[0.02]' : 'border-zinc-100 hover:bg-zinc-50'}>
                          <TableCell className={`text-[11px] ${subtext}`}>{seq}</TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className={`text-sm font-medium ${isDark ? "text-zinc-100" : "text-zinc-800"}`}>
                                {s.firstName} {s.lastName}
                              </span>
                              <span className={`text-[10px] font-mono ${subtext}`}>{s.studentId}</span>
                            </div>
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
                {pageCount > 1 && (
                  <div className={`px-5 py-3 border-t flex items-center justify-between ${isDark ? "border-white/[0.06]" : "border-zinc-100"}`}>
                    <span className={`text-[11px] ${subtext}`}>
                      {isBn
                        ? `পৃষ্ঠা ${currentPage} / ${pageCount}`
                        : `Page ${currentPage} of ${pageCount}`}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setPage(p => Math.max(p - 1, 1))}
                        disabled={currentPage <= 1}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-[11px] font-medium transition-all disabled:opacity-40 ${isDark ? "bg-white/[0.06] hover:bg-white/[0.1] text-zinc-300" : "bg-zinc-100 hover:bg-zinc-200 text-zinc-700"}`}
                      >
                        <ChevronLeft className="h-3.5 w-3.5" /> {isBn ? 'আগে' : 'Prev'}
                      </button>
                      <button
                        onClick={() => setPage(p => Math.min(p + 1, pageCount))}
                        disabled={currentPage >= pageCount}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-[11px] font-medium transition-all disabled:opacity-40 ${isDark ? "bg-white/[0.06] hover:bg-white/[0.1] text-zinc-300" : "bg-zinc-100 hover:bg-zinc-200 text-zinc-700"}`}
                      >
                        {isBn ? 'পরে' : 'Next'} <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
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
