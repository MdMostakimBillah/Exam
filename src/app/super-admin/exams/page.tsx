"use client";
import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { getExams } from "@/lib/storage/exams";
import { getRegistrations } from "@/lib/storage/registrations";
import { FileText, Search, Calendar, Users, CreditCard, MoreVertical } from "lucide-react";
import { formatDate } from "@/lib/storage/storage";
import { useTheme } from "@/contexts/theme-context";
import { useLang } from "@/contexts/language-context";

export default function ExamsPage() {
  const { theme } = useTheme();
  const { lang: language, t } = useLang();
  const isDark = theme === "dark";
  const isBn = language === "bn";

  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => { setMounted(true); }, []);

  if (!mounted) return <ExamsSkeleton isDark={isDark} />;

  const exams = getExams();
  const registrations = getRegistrations();
  const filtered = exams.filter(e => {
    const matchesSearch = e.name.toLowerCase().includes(search.toLowerCase()) || e.code.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = !statusFilter || e.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusCounts = {
    all: exams.length,
    OPEN: exams.filter(e => e.status === 'OPEN').length,
    PUBLISHED: exams.filter(e => e.status === 'PUBLISHED').length,
    CLOSED: exams.filter(e => e.status === 'CLOSED').length,
  };

  const card = isDark
    ? "bg-[#141416] border border-white/[0.06] rounded-2xl"
    : "bg-white border border-zinc-200 rounded-2xl shadow-sm";
  const iconBg = isDark ? "bg-white/[0.06]" : "bg-zinc-100";
  const iconColor = isDark ? "text-white" : "text-zinc-900";

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0a0a0b]" : "bg-zinc-50"}`}>
      <div className="p-6 lg:p-8">
        {/* Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { label: isBn ? 'মোট পরীক্ষা' : 'Total Exams', value: statusCounts.all },
            { label: isBn ? 'ওপেন' : 'Open', value: statusCounts.OPEN },
            { label: isBn ? 'প্রকাশিত' : 'Published', value: statusCounts.PUBLISHED },
            { label: isBn ? 'বন্ধ' : 'Closed', value: statusCounts.CLOSED },
          ].map((s) => (
            <div key={s.label} className={`${card} px-4 py-3 flex items-center gap-3`}>
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
                <FileText className={`h-5 w-5 ${iconColor}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-lg font-bold tracking-tight leading-tight ${isDark ? "text-white" : "text-zinc-900"}`}>{s.value}</p>
                <p className={`text-[11px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className={`${card} p-4 mb-6`}>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${isDark ? "text-zinc-600" : "text-zinc-400"}`} />
              <Input
                placeholder={isBn ? "নাম বা কোড দিয়ে অনুসন্ধান..." : "Search by name or code..."}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={`pl-10 ${isDark ? "bg-white/[0.04] border-white/[0.06]" : "bg-zinc-50 border-zinc-200"}`}
              />
            </div>
            <Select
              options={[
                { label: isBn ? 'সব স্ট্যাটাস' : 'All Status', value: '' },
                { label: isBn ? 'ওপেন' : 'Open', value: 'OPEN' },
                { label: isBn ? 'প্রকাশিত' : 'Published', value: 'PUBLISHED' },
                { label: isBn ? 'বন্ধ' : 'Closed', value: 'CLOSED' },
              ]}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={`w-full sm:w-40 ${isDark ? "bg-white/[0.04] border-white/[0.06]" : "bg-zinc-50 border-zinc-200"}`}
            />
          </div>
        </div>

        {/* Exams Grid */}
        <div className={`${card}`}>
          <div className={`px-5 py-4 border-b ${isDark ? "border-white/[0.06]" : "border-zinc-100"}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className={`h-4 w-4 ${isDark ? "text-zinc-500" : "text-zinc-400"}`} />
                <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>
                  {isBn ? 'পরীক্ষার তালিকা' : 'Exams List'}
                </h3>
                <span className={`text-[11px] ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>({filtered.length})</span>
              </div>
            </div>
          </div>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className={`h-14 w-14 rounded-2xl flex items-center justify-center mb-4 ${isDark ? 'bg-white/[0.06]' : 'bg-zinc-100'}`}>
                <FileText className={`h-7 w-7 ${iconColor}`} />
              </div>
              <p className={`text-sm font-medium ${isDark ? "text-white" : "text-zinc-900"}`}>{isBn ? 'কোনো পরীক্ষা পাওয়া যায়নি' : 'No exams found'}</p>
              <p className={`text-xs mt-1 ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>{isBn ? 'অনুসন্ধান বা ফিল্টার পরিবর্তন করুন' : 'Try adjusting your search or filters'}</p>
            </div>
          ) : (
            <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filtered.map((exam) => {
                const examRegs = registrations.filter(r => r.examId === exam.id);
                return (
                  <div key={exam.id} className={`group rounded-xl border p-4 transition-all ${isDark ? "border-white/[0.04] hover:border-white/[0.08] bg-white/[0.02]" : "border-zinc-100 hover:border-zinc-200 bg-zinc-50/50"}`}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
                          <FileText className={`h-4 w-4 ${iconColor}`} />
                        </div>
                        <div>
                          <h3 className={`text-sm font-medium ${isDark ? "text-zinc-200" : "text-zinc-700"}`}>{exam.name}</h3>
                          <p className={`text-[10px] font-mono ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>{exam.code}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge status={exam.status} />
                        <button className={`h-6 w-6 rounded-md flex items-center justify-center transition-colors ${isDark ? "text-zinc-600 hover:text-zinc-400 hover:bg-white/[0.05]" : "text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100"}`}>
                          <MoreVertical className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <p className={`text-[11px] mb-3 line-clamp-2 ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>{exam.description}</p>

                    <div className="grid grid-cols-3 gap-2 mb-3">
                      <div className={`rounded-lg p-2 text-center ${isDark ? "bg-white/[0.03]" : "bg-white"}`}>
                        <Calendar className={`h-3.5 w-3.5 mx-auto mb-1 ${isDark ? "text-zinc-600" : "text-zinc-400"}`} />
                        <p className={`text-[10px] ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>{formatDate(exam.examDate).split(',')[0]}</p>
                      </div>
                      <div className={`rounded-lg p-2 text-center ${isDark ? "bg-white/[0.03]" : "bg-white"}`}>
                        <Users className={`h-3.5 w-3.5 mx-auto mb-1 ${isDark ? "text-zinc-600" : "text-zinc-400"}`} />
                        <p className={`text-[10px] ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>{examRegs.length} {isBn ? 'নিবন্ধন' : 'regs'}</p>
                      </div>
                      <div className={`rounded-lg p-2 text-center ${isDark ? "bg-white/[0.03]" : "bg-white"}`}>
                        <CreditCard className={`h-3.5 w-3.5 mx-auto mb-1 ${isDark ? "text-zinc-600" : "text-zinc-400"}`} />
                        <p className={`text-[10px] ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>৳{exam.registrationFee}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-[10px] ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>{isBn ? 'শ্রেণী:' : 'Classes:'}</span>
                      {exam.classes.slice(0, 3).map(cls => (
                        <span key={cls} className={`px-1.5 py-0.5 rounded text-[9px] ${isDark ? "bg-white/[0.04] text-zinc-500" : "bg-zinc-100 text-zinc-600"}`}>{cls}</span>
                      ))}
                      {exam.classes.length > 3 && (
                        <span className={`px-1.5 py-0.5 rounded text-[9px] ${isDark ? "bg-white/[0.04] text-zinc-500" : "bg-zinc-100 text-zinc-600"}`}>+{exam.classes.length - 3}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ExamsSkeleton({ isDark }: { isDark: boolean }) {
  const card = isDark ? "bg-[#141416] border border-white/[0.06]" : "bg-white border border-zinc-200 shadow-sm";

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0a0a0b]" : "bg-zinc-50"}`}>
      <div className="p-6 lg:p-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className={`${card} rounded-2xl h-[52px]`} />
          ))}
        </div>
        <div className={`${card} rounded-2xl h-12 mb-6`} />
        <div className={`${card} rounded-2xl h-64`} />
      </div>
    </div>
  );
}
