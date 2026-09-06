"use client";
import { useState, useEffect } from "react";
import { Select } from "@/components/ui/select";
import { getExams } from "@/lib/storage/exams";
import { getStudents } from "@/lib/storage/students";
import { getInstitutions } from "@/lib/storage/institutions";
import { getResults } from "@/lib/storage/results";
import { BarChart3, Users, Building2, Trophy, TrendingUp } from "lucide-react";
import { useTheme } from "@/contexts/theme-context";
import { useLang } from "@/contexts/language-context";

export default function ReportsPage() {
  const { theme } = useTheme();
  const { lang: language } = useLang();
  const isDark = theme === "dark";
  const isBn = language === "bn";
  const [mounted, setMounted] = useState(false);
  const [examFilter, setExamFilter] = useState("");

  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return <ReportsSkeleton isDark={isDark} />;

  const exams = getExams();
  const students = getStudents();
  const institutions = getInstitutions();
  const allResults = getResults();

  const filteredResults = examFilter ? allResults.filter(r => r.examId === examFilter) : allResults;

  const totalStudents = students.length;
  const totalInstitutions = institutions.length;
  const totalExams = exams.length;
  const totalResults = filteredResults.length;

  const card = isDark ? "bg-[#141416] border border-white/[0.06] rounded-2xl" : "bg-white border border-zinc-200 rounded-2xl shadow-sm";
  const iconBg = isDark ? "bg-white/[0.08]" : "bg-zinc-100";
  const iconColor = isDark ? "text-zinc-300" : "text-zinc-600";

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0a0a0b]" : "bg-zinc-50"}`}>
      <div className="max-w-[1600px] mx-auto p-6 lg:p-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className={`text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-zinc-900"}`}>
            {isBn ? 'রিপোর্ট' : 'Reports'}
          </h1>
          <p className={`text-sm mt-1 ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>
            {isBn ? 'প্ল্যাটফর্ম বিশ্লেষণ এবং পরিসংখ্যান' : 'Platform analytics and statistics'}
          </p>
        </div>
        {/* Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { label: isBn ? 'মোট শিক্ষার্থী' : 'Total Students', value: totalStudents },
            { label: isBn ? 'মোট প্রতিষ্ঠান' : 'Total Institutions', value: totalInstitutions },
            { label: isBn ? 'মোট পরীক্ষা' : 'Total Exams', value: totalExams },
            { label: isBn ? 'মোট ফলাফল' : 'Total Results', value: totalResults },
          ].map((s) => (
            <div key={s.label} className={`${card} px-4 py-3 flex items-center gap-3`}>
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
                <BarChart3 className={`h-5 w-5 ${iconColor}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-lg font-bold tracking-tight leading-tight ${isDark ? "text-white" : "text-zinc-900"}`}>{s.value}</p>
                <p className={`text-[11px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Filter */}
        <div className={`${card} p-4 mb-6`}>
          <div className="flex flex-col sm:flex-row gap-3">
            <Select options={[{ label: isBn ? 'সব পরীক্ষা' : 'All Exams', value: '' }, ...exams.map(e => ({ label: e.name, value: e.id }))]} value={examFilter} onChange={(e) => setExamFilter(e.target.value)}
              className={`w-full sm:w-64 ${isDark ? "bg-white/[0.04] border-white/[0.06]" : "bg-zinc-50 border-zinc-200"}`} />
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Students */}
          <div className={`${card} p-5`}>
            <div className="flex items-center gap-2 mb-4">
              <Users className={`h-4 w-4 ${isDark ? "text-zinc-400" : "text-zinc-500"}`} />
              <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>{isBn ? 'শিক্ষার্থী পরিসংখ্যান' : 'Student Statistics'}</h3>
            </div>
            <div className="space-y-3">
              {[
                { label: isBn ? 'মোট শিক্ষার্থী' : 'Total Students', value: totalStudents },
                { label: isBn ? 'পুরুষ' : 'Male', value: students.filter(s => s.gender === 'MALE').length },
                { label: isBn ? 'মহিলা' : 'Female', value: students.filter(s => s.gender === 'FEMALE').length },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <span className={`text-[11px] ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>{item.label}</span>
                  <span className={`text-sm font-bold ${isDark ? "text-white" : "text-zinc-900"}`}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Institutions */}
          <div className={`${card} p-5`}>
            <div className="flex items-center gap-2 mb-4">
              <Building2 className={`h-4 w-4 ${isDark ? "text-zinc-400" : "text-zinc-500"}`} />
              <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>{isBn ? 'প্রতিষ্ঠান পরিসংখ্যান' : 'Institution Statistics'}</h3>
            </div>
            <div className="space-y-3">
              {[
                { label: isBn ? 'মোট প্রতিষ্ঠান' : 'Total Institutions', value: totalInstitutions },
                { label: isBn ? 'সক্রিয়' : 'Active', value: institutions.filter(i => i.status === 'ACTIVE').length },
                { label: isBn ? 'অপেক্ষমাণ' : 'Pending', value: institutions.filter(i => i.status === 'PENDING').length },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <span className={`text-[11px] ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>{item.label}</span>
                  <span className={`text-sm font-bold ${isDark ? "text-white" : "text-zinc-900"}`}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Exams */}
          <div className={`${card} p-5`}>
            <div className="flex items-center gap-2 mb-4">
              <Trophy className={`h-4 w-4 ${isDark ? "text-zinc-400" : "text-zinc-500"}`} />
              <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>{isBn ? 'পরীক্ষা সারসংক্ষেপ' : 'Exam Summary'}</h3>
            </div>
            <div className="space-y-3">
              {[
                { label: isBn ? 'মোট পরীক্ষা' : 'Total Exams', value: totalExams },
                { label: isBn ? 'খোলা' : 'Open', value: exams.filter(e => e.status === 'OPEN').length },
                { label: isBn ? 'সম্পন্ন' : 'Completed', value: exams.filter(e => e.status === 'EXAM_COMPLETED').length },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <span className={`text-[11px] ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>{item.label}</span>
                  <span className={`text-sm font-bold ${isDark ? "text-white" : "text-zinc-900"}`}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Results */}
          <div className={`${card} p-5`}>
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className={`h-4 w-4 ${isDark ? "text-zinc-400" : "text-zinc-500"}`} />
              <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>{isBn ? 'ফলাফল সারসংক্ষেপ' : 'Results Summary'}</h3>
            </div>
            <div className="space-y-3">
              {[
                { label: isBn ? 'মোট ফলাফল' : 'Total Results', value: totalResults },
                { label: isBn ? 'প্রকাশিত' : 'Published', value: filteredResults.filter(r => r.status === 'PUBLISHED').length },
                { label: isBn ? 'অনুমোদিত' : 'Approved', value: filteredResults.filter(r => r.status === 'APPROVED').length },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <span className={`text-[11px] ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>{item.label}</span>
                  <span className={`text-sm font-bold ${isDark ? "text-white" : "text-zinc-900"}`}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReportsSkeleton({ isDark }: { isDark: boolean }) {
  const card = isDark ? "bg-[#141416] border border-white/[0.06]" : "bg-white border border-zinc-200 shadow-sm";
  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0a0a0b]" : "bg-zinc-50"}`}>
      <div className="max-w-[1600px] mx-auto p-6 lg:p-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className={`${card} rounded-2xl h-[52px]`} />
          ))}
        </div>
        <div className={`${card} rounded-2xl h-12 mb-6`} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className={`${card} rounded-2xl h-48`} />
          ))}
        </div>
      </div>
    </div>
  );
}
