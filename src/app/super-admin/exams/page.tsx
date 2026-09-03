"use client";
import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { getExams } from "@/lib/storage/exams";
import { getRegistrations } from "@/lib/storage/registrations";
import { FileText, Search, Plus, Calendar, Users, CreditCard, MoreHorizontal } from "lucide-react";
import { formatDate } from "@/lib/storage/storage";
import { useTheme } from "@/contexts/theme-context";
import { useLang } from "@/contexts/language-context";

export default function ExamsPage() {
  const { theme } = useTheme();
  const { lang: language, t } = useLang();
  const isDark = theme === "dark";

  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => { setMounted(true); }, []);

  if (!mounted) return <ExamsSkeleton />;

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

  return (
    <div className="space-y-6">
      <PageHeader title="Examinations" description="Manage scholarship examinations across the platform." />

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Exams', value: statusCounts.all },
          { label: 'Open', value: statusCounts.OPEN },
          { label: 'Published', value: statusCounts.PUBLISHED },
          { label: 'Closed', value: statusCounts.CLOSED },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-5">
              <p className={`text-xs font-medium uppercase tracking-wider ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>{stat.label}</p>
              <p className={`text-3xl font-bold mt-2 ${isDark ? "text-zinc-100" : "text-zinc-900"}`}>{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${isDark ? "text-zinc-600" : "text-zinc-400"}`} />
          <Input
            placeholder="Search by name or code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select
          options={[
            { label: 'All Status', value: '' },
            { label: 'Open', value: 'OPEN' },
            { label: 'Published', value: 'PUBLISHED' },
            { label: 'Closed', value: 'CLOSED' },
          ]}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-full sm:w-40"
        />
        <Button className="gap-2">
          <Plus className="h-4 w-4" /> Create Exam
        </Button>
      </div>

      {/* Exams Grid */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<FileText className={`h-6 w-6 ${isDark ? "text-zinc-600" : "text-zinc-400"}`} />}
          title="No exams found"
          description="Try adjusting your search or filters to find what you're looking for."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((exam) => {
            const examRegs = registrations.filter(r => r.examId === exam.id);
            return (
              <Card key={exam.id} className={`group transition-all duration-300 ${isDark ? "hover:border-white/[0.08]" : "hover:border-zinc-300"}`}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${isDark ? "bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/20" : "bg-gradient-to-br from-blue-50 to-blue-100/50 border border-blue-200"}`}>
                        <FileText className={`h-5 w-5 ${isDark ? "text-blue-400" : "text-blue-600"}`} />
                      </div>
                      <div>
                        <h3 className={`text-sm font-medium transition-colors ${isDark ? "text-zinc-200 group-hover:text-white" : "text-zinc-700 group-hover:text-zinc-900"}`}>{exam.name}</h3>
                        <p className={`text-xs font-mono ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>{exam.code}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge status={exam.status} />
                      <button className={`h-8 w-8 rounded-lg flex items-center justify-center transition-all ${isDark ? "text-zinc-600 hover:text-zinc-400 hover:bg-white/[0.05]" : "text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100"}`}>
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-zinc-500 mb-4 line-clamp-2">{exam.description}</p>

                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className={`rounded-lg p-3 text-center ${isDark ? "bg-white/[0.02]" : "bg-zinc-50"}`}>
                      <Calendar className={`h-4 w-4 mx-auto mb-1 ${isDark ? "text-zinc-600" : "text-zinc-400"}`} />
                      <p className={`text-xs ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>{formatDate(exam.examDate).split(',')[0]}</p>
                    </div>
                    <div className={`rounded-lg p-3 text-center ${isDark ? "bg-white/[0.02]" : "bg-zinc-50"}`}>
                      <Users className={`h-4 w-4 mx-auto mb-1 ${isDark ? "text-zinc-600" : "text-zinc-400"}`} />
                      <p className={`text-xs ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>{examRegs.length} regs</p>
                    </div>
                    <div className={`rounded-lg p-3 text-center ${isDark ? "bg-white/[0.02]" : "bg-zinc-50"}`}>
                      <CreditCard className={`h-4 w-4 mx-auto mb-1 ${isDark ? "text-zinc-600" : "text-zinc-400"}`} />
                      <p className={`text-xs ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>৳{exam.registrationFee}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`text-xs ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>Classes:</span>
                    <div className="flex flex-wrap gap-1">
                      {exam.classes.slice(0, 3).map(cls => (
                        <span key={cls} className={`px-2 py-0.5 rounded-md text-[10px] ${isDark ? "bg-white/[0.03] text-zinc-500" : "bg-zinc-100 text-zinc-600"}`}>{cls}</span>
                      ))}
                      {exam.classes.length > 3 && (
                        <span className={`px-2 py-0.5 rounded-md text-[10px] ${isDark ? "bg-white/[0.03] text-zinc-500" : "bg-zinc-100 text-zinc-600"}`}>+{exam.classes.length - 3}</span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ExamsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-48 skeleton rounded" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 skeleton rounded-2xl" />
        ))}
      </div>
      <div className="h-10 w-full skeleton rounded-xl" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-48 skeleton rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
