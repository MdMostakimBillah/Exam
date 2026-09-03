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
import { getRegistrationsByInstitution } from "@/lib/storage/registrations";
import { getExams } from "@/lib/storage/exams";
import { ClipboardList, Search, CheckCircle, Clock, XCircle, Download } from "lucide-react";
import { formatDate } from "@/lib/storage/storage";

export default function InstitutionRegistrationsPage() {
  const params = useParams();
  const slug = params.institutionSlug as string;
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [examFilter, setExamFilter] = useState("");

  useEffect(() => { setMounted(true); }, []);

  if (!mounted) return <RegistrationsSkeleton />;

  const inst = getInstitutionBySlug(slug);
  if (!inst) return null;

  const registrations = getRegistrationsByInstitution(inst.id);
  const exams = getExams();

  const filtered = registrations.filter(r => {
    const matchesSearch = r.studentName.toLowerCase().includes(search.toLowerCase()) || r.applicationId.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = !statusFilter || r.status === statusFilter;
    const matchesExam = !examFilter || r.examId === examFilter;
    return matchesSearch && matchesStatus && matchesExam;
  });

  const statusCounts = {
    all: registrations.length,
    APPROVED: registrations.filter(r => r.status === 'APPROVED').length,
    VERIFIED: registrations.filter(r => r.status === 'VERIFIED').length,
    PENDING: registrations.filter(r => r.status === 'PENDING').length,
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Registrations" description="Manage student registrations for scholarship exams." />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: statusCounts.all },
          { label: 'Approved', value: statusCounts.APPROVED, color: 'text-emerald-400' },
          { label: 'Verified', value: statusCounts.VERIFIED, color: 'text-blue-400' },
          { label: 'Pending', value: statusCounts.PENDING, color: 'text-amber-400' },
        ].map(stat => (
          <Card key={stat.label}>
            <CardContent className="p-5">
              <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">{stat.label}</p>
              <p className={`text-3xl font-bold mt-2 ${stat.color || 'text-zinc-100'}`}>{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600" />
          <Input
            placeholder="Search by student or application ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select
          options={[{ label: 'All Exams', value: '' }, ...exams.map(e => ({ label: e.name, value: e.id }))]}
          value={examFilter}
          onChange={(e) => setExamFilter(e.target.value)}
          className="w-full sm:w-48"
        />
        <Select
          options={[
            { label: 'All Status', value: '' },
            { label: 'Approved', value: 'APPROVED' },
            { label: 'Verified', value: 'VERIFIED' },
            { label: 'Pending', value: 'PENDING' },
          ]}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-full sm:w-40"
        />
        <Button variant="outline" className="gap-2">
          <Download className="h-4 w-4" /> Export
        </Button>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="h-6 w-6 text-zinc-600" />}
          title="No registrations found"
          description="Register students for available exams to get started."
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Application ID</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Exam</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(reg => (
                <TableRow key={reg.id} className="group">
                  <TableCell className="text-xs font-mono text-zinc-500">{reg.applicationId}</TableCell>
                  <TableCell className="text-sm text-zinc-200 group-hover:text-white transition-colors">{reg.studentName}</TableCell>
                  <TableCell className="text-xs text-zinc-400">{reg.examName}</TableCell>
                  <TableCell className="text-xs text-zinc-500">{formatDate(reg.createdAt)}</TableCell>
                  <TableCell><Badge status={reg.paymentStatus} /></TableCell>
                  <TableCell><Badge status={reg.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

function RegistrationsSkeleton() {
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
