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
import { getCertificatesByInstitution } from "@/lib/storage/certificates";
import { Award, Search, Download, QrCode, Eye } from "lucide-react";
import { formatDate } from "@/lib/storage/storage";

export default function InstitutionCertificatesPage() {
  const params = useParams();
  const slug = params.institutionSlug as string;
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState("");
  const [yearFilter, setYearFilter] = useState("");

  useEffect(() => { setMounted(true); }, []);

  if (!mounted) return <CertificatesSkeleton />;

  const inst = getInstitutionBySlug(slug);
  if (!inst) return null;

  const certificates = getCertificatesByInstitution(inst.id);
  const years = [...new Set(certificates.map(c => c.examYear))];

  const filtered = certificates.filter(c => {
    const matchesSearch = c.studentName.toLowerCase().includes(search.toLowerCase()) || c.certificateNumber.toLowerCase().includes(search.toLowerCase());
    const matchesYear = !yearFilter || c.examYear === yearFilter;
    return matchesSearch && matchesYear;
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Certificates" description="View and download student certificates." />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Total Generated</p>
            <p className="text-3xl font-bold text-zinc-100 mt-2">{certificates.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Verified</p>
            <p className="text-3xl font-bold text-emerald-400 mt-2">{certificates.filter(c => c.status === 'VERIFIED').length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">2026</p>
            <p className="text-3xl font-bold text-zinc-100 mt-2">{certificates.filter(c => c.examYear === '2026').length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600" />
          <Input
            placeholder="Search by student or certificate number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select
          options={[{ label: 'All Years', value: '' }, ...years.map(y => ({ label: y, value: y }))]}
          value={yearFilter}
          onChange={(e) => setYearFilter(e.target.value)}
          className="w-full sm:w-36"
        />
        <Button variant="outline" className="gap-2">
          <Download className="h-4 w-4" /> Export
        </Button>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Award className="h-6 w-6 text-zinc-600" />}
          title="No certificates found"
          description="Certificates will appear here once results are published."
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Certificate No</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Exam</TableHead>
                <TableHead>Position</TableHead>
                <TableHead>Issue Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(cert => (
                <TableRow key={cert.id} className="group">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <QrCode className="h-4 w-4 text-zinc-600" />
                      <span className="text-xs font-mono text-zinc-500">{cert.certificateNumber}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-zinc-200 group-hover:text-white transition-colors">{cert.studentName}</TableCell>
                  <TableCell className="text-xs text-zinc-400">{cert.examName}</TableCell>
                  <TableCell>
                    <span className="text-xs font-bold text-amber-400">#{cert.position}</span>
                  </TableCell>
                  <TableCell className="text-xs text-zinc-500">{formatDate(cert.issueDate)}</TableCell>
                  <TableCell><Badge status={cert.status} /></TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

function CertificatesSkeleton() {
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
