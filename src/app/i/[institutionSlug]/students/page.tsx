"use client";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { getInstitutionBySlug } from "@/lib/storage/institutions";
import { getStudentsByInstitution } from "@/lib/storage/students";
import { Users, Search, UserPlus, Download, GraduationCap } from "lucide-react";
import { useTheme } from "@/contexts/theme-context";

export default function InstitutionStudentsPage() {
  const params = useParams();
  const slug = params.institutionSlug as string;
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("");

  useEffect(() => { setMounted(true); }, []);

  if (!mounted) return <StudentsSkeleton />;

  const inst = getInstitutionBySlug(slug);
  if (!inst) return null;

  const students = getStudentsByInstitution(inst.id);
  const classes = [...new Set(students.map(s => s.class))];

  const filtered = students.filter(s => {
    const matchesSearch = `${s.firstName} ${s.lastName}`.toLowerCase().includes(search.toLowerCase()) || s.studentId.toLowerCase().includes(search.toLowerCase());
    const matchesClass = !classFilter || s.class === classFilter;
    return matchesSearch && matchesClass;
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Students" description="Manage students registered under this institution." />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <Users className={`h-4 w-4 ${isDark ? "text-blue-400" : "text-blue-600"}`} />
              <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Total Students</p>
            </div>
            <p className={`text-3xl font-bold ${isDark ? "text-zinc-100" : "text-zinc-900"}`}>{students.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <GraduationCap className={`h-4 w-4 ${isDark ? "text-emerald-400" : "text-emerald-600"}`} />
              <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Active</p>
            </div>
            <p className={`text-3xl font-bold ${isDark ? "text-emerald-400" : "text-emerald-600"}`}>{students.filter(s => s.status === 'ACTIVE').length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <Users className={`h-4 w-4 ${isDark ? "text-zinc-400" : "text-zinc-500"}`} />
              <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Classes</p>
            </div>
            <p className={`text-3xl font-bold ${isDark ? "text-zinc-100" : "text-zinc-900"}`}>{classes.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${isDark ? "text-zinc-600" : "text-zinc-400"}`} />
          <Input
            placeholder="Search by name or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select
          options={[{ label: 'All Classes', value: '' }, ...classes.map(c => ({ label: c, value: c }))]}
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
          className="w-full sm:w-36"
        />
        <Button className="gap-2">
          <UserPlus className="h-4 w-4" /> Add Student
        </Button>
        <Button variant="outline" className="gap-2">
          <Download className="h-4 w-4" /> Export
        </Button>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Users className={`h-6 w-6 ${isDark ? "text-zinc-600" : "text-zinc-400"}`} />}
          title="No students found"
          description="Add students to get started or try adjusting your filters."
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>ID</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Section</TableHead>
                <TableHead>Roll</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(student => (
                <TableRow key={student.id} className="group">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className={`h-8 w-8 rounded-lg bg-gradient-to-br ${isDark ? "from-zinc-800 to-zinc-900" : "from-zinc-200 to-zinc-300"} flex items-center justify-center text-[10px] font-semibold ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
                        {student.firstName.charAt(0)}
                      </div>
                      <span className={`text-sm ${isDark ? "text-zinc-200 group-hover:text-white" : "text-zinc-700 group-hover:text-zinc-900"} transition-colors`}>
                        {student.firstName} {student.lastName}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs font-mono text-zinc-500">{student.studentId}</TableCell>
                  <TableCell className={`text-xs ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>{student.class}</TableCell>
                  <TableCell className={`text-xs ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>{student.section}</TableCell>
                  <TableCell className={`text-xs ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>{student.roll}</TableCell>
                  <TableCell><Badge status={student.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

function StudentsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-48 skeleton rounded" />
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-24 skeleton rounded-2xl" />
        ))}
      </div>
      <div className="h-10 w-full skeleton rounded-xl" />
      <div className="h-96 skeleton rounded-2xl" />
    </div>
  );
}
