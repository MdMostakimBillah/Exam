"use client";
import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { getResults } from "@/lib/storage/results";
import { getExams } from "@/lib/storage/exams";
import { Award, Search, Download, Trophy, TrendingUp } from "lucide-react";
import { useTheme } from "@/contexts/theme-context";
import { useLang } from "@/contexts/language-context";

export default function ResultsPage() {
  const { theme } = useTheme();
  const { lang: language, t } = useLang();
  const isDark = theme === "dark";
  const [mounted, setMounted] = useState(false);
  const [examFilter, setExamFilter] = useState("");

  useEffect(() => { setMounted(true); }, []);

  if (!mounted) return <ResultsSkeleton />;

  const results = getResults();
  const exams = getExams();

  const filtered = examFilter ? results.filter(r => r.examId === examFilter) : results;

  const totalCandidates = filtered.length;
  const passed = filtered.filter(r => r.pass).length;
  const scholarshipWinners = filtered.filter(r => r.scholarshipStatus === 'ELIGIBLE').length;
  const avgScore = filtered.length > 0 ? Math.round(filtered.reduce((sum, r) => sum + r.percentage, 0) / filtered.length) : 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Results" description="View and publish examination results." />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <Trophy className={`h-4 w-4 ${isDark ? "text-amber-400" : "text-amber-600"}`} />
              <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Total Candidates</p>
            </div>
            <p className={`text-3xl font-bold ${isDark ? "text-zinc-100" : "text-zinc-900"}`}>{totalCandidates}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className={`h-4 w-4 ${isDark ? "text-emerald-400" : "text-emerald-600"}`} />
              <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Pass Rate</p>
            </div>
            <p className={`text-3xl font-bold ${isDark ? "text-emerald-400" : "text-emerald-600"}`}>{totalCandidates > 0 ? Math.round((passed / totalCandidates) * 100) : 0}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <Award className="h-4 w-4 text-yellow-400" />
              <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Scholarship Winners</p>
            </div>
            <p className="text-3xl font-bold text-yellow-400">{scholarshipWinners}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className={`h-4 w-4 ${isDark ? "text-blue-400" : "text-blue-600"}`} />
              <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Average Score</p>
            </div>
            <p className={`text-3xl font-bold ${isDark ? "text-blue-400" : "text-blue-600"}`}>{avgScore}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Select
          options={[{ label: 'All Exams', value: '' }, ...exams.map(e => ({ label: e.name, value: e.id }))]}
          value={examFilter}
          onChange={(e) => setExamFilter(e.target.value)}
          className="w-full sm:w-64"
        />
        <Button variant="outline" className="gap-2 ml-auto">
          <Download className="h-4 w-4" /> Export Results
        </Button>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Award className={`h-6 w-6 ${isDark ? "text-zinc-600" : "text-zinc-400"}`} />}
          title="No results found"
          description="Results will appear here once exams are published."
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Position</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Institution</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Total Marks</TableHead>
                <TableHead>Percentage</TableHead>
                <TableHead>Grade</TableHead>
                <TableHead>Scholarship</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.slice(0, 20).map(result => (
                <TableRow key={result.id} className="group">
                  <TableCell>
                    <span className={`text-sm font-bold ${result.position <= 3 ? (isDark ? "text-amber-400" : "text-amber-600") : (isDark ? "text-zinc-400" : "text-zinc-500")}`}>
                      #{result.position}
                    </span>
                  </TableCell>
                  <TableCell className={`text-sm ${isDark ? "text-zinc-200" : "text-zinc-700"} group-hover:text-white transition-colors`}>{result.studentName}</TableCell>
                  <TableCell className={`text-xs ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>{result.institutionName}</TableCell>
                  <TableCell className={`text-xs ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>{result.className}</TableCell>
                  <TableCell className={`text-xs ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>{result.totalMarks}/{result.totalFullMarks}</TableCell>
                  <TableCell className={`text-xs ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>{result.percentage.toFixed(1)}%</TableCell>
                  <TableCell>
                    <span className={`text-xs font-bold ${result.grade === 'F' ? (isDark ? "text-red-400" : "text-red-600") : (isDark ? "text-emerald-400" : "text-emerald-600")}`}>
                      {result.grade}
                    </span>
                  </TableCell>
                  <TableCell><Badge status={result.scholarshipStatus} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

function ResultsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-48 skeleton rounded" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 skeleton rounded-2xl" />
        ))}
      </div>
      <div className="h-10 w-full skeleton rounded-xl" />
      <div className="h-96 skeleton rounded-2xl" />
    </div>
  );
}
