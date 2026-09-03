"use client";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { getInstitutionBySlug } from "@/lib/storage/institutions";
import { getExams } from "@/lib/storage/exams";
import { getRegistrationsByInstitution } from "@/lib/storage/registrations";
import { FileText, Calendar, Users, CreditCard, ArrowRight } from "lucide-react";
import Link from "next/link";
import { formatDate } from "@/lib/storage/storage";
import { useTheme } from "@/contexts/theme-context";

export default function InstitutionExamsPage() {
  const params = useParams();
  const slug = params.institutionSlug as string;
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [mounted, setMounted] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => { setMounted(true); }, []);

  if (!mounted) return <ExamsSkeleton />;

  const inst = getInstitutionBySlug(slug);
  if (!inst) return null;

  const exams = getExams();
  const registrations = getRegistrationsByInstitution(inst.id);

  const filtered = exams.filter(e => {
    if (statusFilter && e.status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Examinations" description="View available scholarship exams for registration." />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Available Exams</p>
            <p className={`text-3xl font-bold mt-2 ${isDark ? "text-zinc-100" : "text-zinc-900"}`}>{exams.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Open</p>
            <p className={`text-3xl font-bold mt-2 ${isDark ? "text-emerald-400" : "text-emerald-600"}`}>{exams.filter(e => e.status === 'OPEN').length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Published</p>
            <p className={`text-3xl font-bold mt-2 ${isDark ? "text-blue-400" : "text-blue-600"}`}>{exams.filter(e => e.status === 'PUBLISHED').length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">My Registrations</p>
            <p className={`text-3xl font-bold mt-2 ${isDark ? "text-zinc-100" : "text-zinc-900"}`}>{registrations.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
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
      </div>

      {/* Exams Grid */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<FileText className={`h-6 w-6 ${isDark ? "text-zinc-600" : "text-zinc-400"}`} />}
          title="No exams available"
          description="Check back later for new scholarship examinations."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((exam) => {
            const examRegs = registrations.filter(r => r.examId === exam.id);
            return (
              <Card key={exam.id} className={`group ${isDark ? "hover:border-white/[0.08]" : "hover:border-zinc-300"} transition-all duration-300`}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/10 flex items-center justify-center border border-blue-500/20">
                        <FileText className={`h-5 w-5 ${isDark ? "text-blue-400" : "text-blue-600"}`} />
                      </div>
                      <div>
                        <h3 className={`text-sm font-medium ${isDark ? "text-zinc-100 group-hover:text-white" : "text-zinc-900 group-hover:text-zinc-900"} transition-colors`}>{exam.name}</h3>
                        <p className={`text-xs font-mono ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>{exam.code}</p>
                      </div>
                    </div>
                    <Badge status={exam.status} />
                  </div>

                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className={`rounded-lg ${isDark ? "bg-white/[0.02]" : "bg-zinc-50"} p-3 text-center`}>
                      <Calendar className={`h-4 w-4 ${isDark ? "text-zinc-600" : "text-zinc-400"} mx-auto mb-1`} />
                      <p className={`text-xs ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>{formatDate(exam.examDate).split(',')[0]}</p>
                    </div>
                    <div className={`rounded-lg ${isDark ? "bg-white/[0.02]" : "bg-zinc-50"} p-3 text-center`}>
                      <Users className={`h-4 w-4 ${isDark ? "text-zinc-600" : "text-zinc-400"} mx-auto mb-1`} />
                      <p className={`text-xs ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>{examRegs.length} regs</p>
                    </div>
                    <div className={`rounded-lg ${isDark ? "bg-white/[0.02]" : "bg-zinc-50"} p-3 text-center`}>
                      <CreditCard className={`h-4 w-4 ${isDark ? "text-zinc-600" : "text-zinc-400"} mx-auto mb-1`} />
                      <p className={`text-xs ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>৳{exam.registrationFee}</p>
                    </div>
                  </div>

                  <Link href={`/i/${slug}/registrations`}>
                    <Button variant="outline" size="sm" className="w-full gap-2">
                      Register Students <ArrowRight className="h-3 w-3" />
                    </Button>
                  </Link>
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
