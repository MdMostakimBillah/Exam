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
import { getRegistrations } from "@/lib/storage/registrations";
import { ClipboardList, Search, Download, CheckCircle, Clock, XCircle } from "lucide-react";
import { formatDate } from "@/lib/storage/storage";

export default function RegistrationsPage() {
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => { setMounted(true); }, []);

  if (!mounted) return <RegistrationsSkeleton />;

  const registrations = getRegistrations();
  const filtered = registrations.filter(r => {
    const matchesSearch = r.studentName.toLowerCase().includes(search.toLowerCase()) || r.applicationId.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = !statusFilter || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusCounts = {
    all: registrations.length,
    APPROVED: registrations.filter(r => r.status === 'APPROVED').length,
    VERIFIED: registrations.filter(r => r.status === 'VERIFIED').length,
    PENDING: registrations.filter(r => r.status === 'PENDING').length,
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Registrations" description="View and manage student registrations for exams." />

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
          options={[
            { label: 'All Status', value: '' },
            { label: 'Approved', value: 'APPROVED' },
            { label: 'Verified', value: 'VERIFIED' },
            { label: 'Pending', value: 'PENDING' },
            { label: 'Rejected', value: 'REJECTED' },
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
          description="Try adjusting your search or filters."
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Application ID</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Institution</TableHead>
                <TableHead>Exam</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.slice(0, 20).map(reg => (
                <TableRow key={reg.id} className="group">
                  <TableCell className="text-xs font-mono text-zinc-500">{reg.applicationId}</TableCell>
                  <TableCell className="text-sm text-zinc-200 group-hover:text-white transition-colors">{reg.studentName}</TableCell>
                  <TableCell className="text-xs text-zinc-400">{reg.institutionName}</TableCell>
                  <TableCell className="text-xs text-zinc-400">{reg.examName}</TableCell>
                  <TableCell className="text-xs text-zinc-500">{formatDate(reg.createdAt)}</TableCell>
                  <TableCell>
                    <Badge status={reg.paymentStatus} />
                  </TableCell>
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
