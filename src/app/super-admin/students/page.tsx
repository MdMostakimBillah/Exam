"use client";
import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { getStudents } from "@/lib/storage/students";
import { getInstitutions } from "@/lib/storage/institutions";
import { Users, Search, Download, UserPlus } from "lucide-react";

export default function StudentsPage() {
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [institutionFilter, setInstitutionFilter] = useState("");

  useEffect(() => { setMounted(true); }, []);

  if (!mounted) return <StudentsSkeleton />;

  const students = getStudents();
  const institutions = getInstitutions();
  const classes = [...new Set(students.map(s => s.class))];

  const filtered = students.filter(s => {
    const matchesSearch = `${s.firstName} ${s.lastName}`.toLowerCase().includes(search.toLowerCase()) || s.studentId.toLowerCase().includes(search.toLowerCase());
    const matchesClass = !classFilter || s.class === classFilter;
    const matchesInst = !institutionFilter || s.institutionId === institutionFilter;
    return matchesSearch && matchesClass && matchesInst;
  });

  const getInstitutionName = (id: string) => institutions.find(i => i.id === id)?.name || 'Unknown';

  return (
    <div className="space-y-6">
      <PageHeader title="Students" description="View and manage all students across institutions." />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Total Students</p>
            <p className="text-3xl font-bold text-zinc-100 mt-2">{students.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Active</p>
            <p className="text-3xl font-bold text-emerald-400 mt-2">{students.filter(s => s.status === 'ACTIVE').length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Institutions</p>
            <p className="text-3xl font-bold text-zinc-100 mt-2">{institutions.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600" />
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
        <Select
          options={[{ label: 'All Institutions', value: '' }, ...institutions.map(i => ({ label: i.name, value: i.id }))]}
          value={institutionFilter}
          onChange={(e) => setInstitutionFilter(e.target.value)}
          className="w-full sm:w-48"
        />
        <Button variant="outline" className="gap-2">
          <Download className="h-4 w-4" /> Export
        </Button>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Users className="h-6 w-6 text-zinc-600" />}
          title="No students found"
          description="Try adjusting your search or filters."
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>ID</TableHead>
                <TableHead>Institution</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Roll</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.slice(0, 20).map(student => (
                <TableRow key={student.id} className="group">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-zinc-800 to-zinc-900 flex items-center justify-center text-[10px] font-semibold text-zinc-400">
                        {student.firstName.charAt(0)}
                      </div>
                      <span className="text-sm text-zinc-200 group-hover:text-white transition-colors">
                        {student.firstName} {student.lastName}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-zinc-500 font-mono">{student.studentId}</TableCell>
                  <TableCell className="text-xs text-zinc-400">{getInstitutionName(student.institutionId)}</TableCell>
                  <TableCell className="text-xs text-zinc-400">{student.class}</TableCell>
                  <TableCell className="text-xs text-zinc-400">{student.roll}</TableCell>
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
