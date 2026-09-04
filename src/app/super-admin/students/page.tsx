"use client";
import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getStudents } from "@/lib/storage/students";
import { getInstitutions } from "@/lib/storage/institutions";
import { Users, Search, Download, GraduationCap, Building2, UserCheck } from "lucide-react";
import { useTheme } from "@/contexts/theme-context";
import { useLang } from "@/contexts/language-context";

export default function StudentsPage() {
  const { theme } = useTheme();
  const { lang: language, t } = useLang();
  const isDark = theme === "dark";
  const isBn = language === "bn";
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [institutionFilter, setInstitutionFilter] = useState("");

  useEffect(() => { setMounted(true); }, []);

  if (!mounted) return <StudentsSkeleton isDark={isDark} />;

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
  const activeStudents = students.filter(s => s.status === 'ACTIVE').length;

  const card = isDark
    ? "bg-[#141416] border border-white/[0.06] rounded-2xl"
    : "bg-white border border-zinc-200 rounded-2xl shadow-sm";
  const iconBg = isDark ? "bg-white/[0.06]" : "bg-zinc-100";
  const iconColor = isDark ? "text-white" : "text-zinc-900";

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0a0a0b]" : "bg-zinc-50"}`}>
      <div className="p-6 lg:p-8">
        {/* Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {[
            { icon: Users, label: isBn ? 'মোট শিক্ষার্থী' : 'Total Students', value: students.length },
            { icon: UserCheck, label: isBn ? 'সক্রিয়' : 'Active', value: activeStudents },
            { icon: Building2, label: isBn ? 'প্রতিষ্ঠান' : 'Institutions', value: institutions.length },
          ].map((s) => (
            <div key={s.label} className={`${card} px-4 py-3 flex items-center gap-3`}>
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
                <s.icon className={`h-5 w-5 ${iconColor}`} />
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
                placeholder={isBn ? "নাম বা আইডি দিয়ে অনুসন্ধান..." : "Search by name or ID..."}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={`pl-10 ${isDark ? "bg-white/[0.04] border-white/[0.06]" : "bg-zinc-50 border-zinc-200"}`}
              />
            </div>
            <Select
              options={[{ label: isBn ? 'সব শ্রেণী' : 'All Classes', value: '' }, ...classes.map(c => ({ label: c, value: c }))]}
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className={`w-full sm:w-36 ${isDark ? "bg-white/[0.04] border-white/[0.06]" : "bg-zinc-50 border-zinc-200"}`}
            />
            <Select
              options={[{ label: isBn ? 'সব প্রতিষ্ঠান' : 'All Institutions', value: '' }, ...institutions.map(i => ({ label: i.name, value: i.id }))]}
              value={institutionFilter}
              onChange={(e) => setInstitutionFilter(e.target.value)}
              className={`w-full sm:w-48 ${isDark ? "bg-white/[0.04] border-white/[0.06]" : "bg-zinc-50 border-zinc-200"}`}
            />
            <button className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-[11px] font-medium transition-colors ${isDark ? "bg-white/[0.06] text-zinc-400 hover:text-white hover:bg-white/[0.1]" : "bg-zinc-100 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200"}`}>
              <Download className="h-3.5 w-3.5" /> {isBn ? 'এক্সপোর্ট' : 'Export'}
            </button>
          </div>
        </div>

        {/* Table */}
        <div className={`${card}`}>
          <div className={`px-5 py-4 border-b ${isDark ? "border-white/[0.06]" : "border-zinc-100"}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GraduationCap className={`h-4 w-4 ${isDark ? "text-zinc-500" : "text-zinc-400"}`} />
                <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>
                  {isBn ? 'শিক্ষার্থী তালিকা' : 'Students List'}
                </h3>
                <span className={`text-[11px] ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>({filtered.length})</span>
              </div>
            </div>
          </div>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className={`h-14 w-14 rounded-2xl flex items-center justify-center mb-4 ${isDark ? 'bg-white/[0.06]' : 'bg-zinc-100'}`}>
                <Users className={`h-7 w-7 ${iconColor}`} />
              </div>
              <p className={`text-sm font-medium ${isDark ? "text-white" : "text-zinc-900"}`}>{isBn ? 'কোনো শিক্ষার্থী পাওয়া যায়নি' : 'No students found'}</p>
              <p className={`text-xs mt-1 ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>{isBn ? 'অনুসন্ধান বা ফিল্টার পরিবর্তন করুন' : 'Try adjusting your search or filters'}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className={isDark ? 'border-white/[0.04] hover:bg-transparent' : 'border-zinc-100 hover:bg-transparent'}>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>{isBn ? 'শিক্ষার্থী' : 'Student'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>ID</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider hidden md:table-cell ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>{isBn ? 'প্রতিষ্ঠান' : 'Institution'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>{isBn ? 'শ্রেণী' : 'Class'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>{isBn ? 'রোল' : 'Roll'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>{isBn ? 'স্থিতি' : 'Status'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.slice(0, 20).map(student => (
                  <TableRow key={student.id} className={`${isDark ? 'border-white/[0.04] hover:bg-white/[0.02]' : 'border-zinc-100 hover:bg-zinc-50/50'}`}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <div className={`h-8 w-8 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 ${isDark ? 'bg-white/[0.06] text-zinc-400' : 'bg-zinc-100 text-zinc-500'}`}>
                          {student.firstName.charAt(0)}
                        </div>
                        <span className={`text-sm font-medium ${isDark ? "text-zinc-200" : "text-zinc-700"}`}>
                          {student.firstName} {student.lastName}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className={`text-[11px] font-mono ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>{student.studentId}</TableCell>
                    <TableCell className={`text-[11px] hidden md:table-cell ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>{getInstitutionName(student.institutionId)}</TableCell>
                    <TableCell className={`text-[11px] ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>{student.class}</TableCell>
                    <TableCell className={`text-[11px] ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>{student.roll}</TableCell>
                    <TableCell><Badge status={student.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </div>
  );
}

function StudentsSkeleton({ isDark }: { isDark: boolean }) {
  const shimmer = isDark ? "bg-white/[0.04]" : "bg-zinc-200/60";
  const card = isDark ? "bg-[#141416] border border-white/[0.06]" : "bg-white border border-zinc-200 shadow-sm";

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0a0a0b]" : "bg-zinc-50"}`}>
      <div className="p-6 lg:p-8">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className={`${card} rounded-2xl h-[52px]`} />
          ))}
        </div>
        <div className={`${card} rounded-2xl h-12 mb-6`} />
        <div className={`${card} rounded-2xl h-64`} />
      </div>
    </div>
  );
}
