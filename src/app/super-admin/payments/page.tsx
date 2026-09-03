"use client";
import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { getPayments } from "@/lib/storage/payments";
import { CreditCard, Search, Download, Wallet, CheckCircle } from "lucide-react";
import { formatDate, formatCurrency } from "@/lib/storage/storage";

export default function PaymentsPage() {
  const [mounted, setMounted] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => { setMounted(true); }, []);

  if (!mounted) return <PaymentsSkeleton />;

  const payments = getPayments();
  const filtered = statusFilter ? payments.filter(p => p.status === statusFilter) : payments;

  const totalRevenue = payments.filter(p => p.status === 'PAID').reduce((sum, p) => sum + p.amount, 0);
  const pendingAmount = payments.filter(p => p.status === 'PENDING').reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Payments" description="Track and manage registration payments across institutions." />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <Wallet className="h-4 w-4 text-emerald-400" />
              <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Total Revenue</p>
            </div>
            <p className="text-2xl font-bold text-emerald-400">{formatCurrency(totalRevenue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-4 w-4 text-blue-400" />
              <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Paid</p>
            </div>
            <p className="text-2xl font-bold text-zinc-100">{payments.filter(p => p.status === 'PAID').length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <CreditCard className="h-4 w-4 text-amber-400" />
              <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Pending</p>
            </div>
            <p className="text-2xl font-bold text-amber-400">{payments.filter(p => p.status === 'PENDING').length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <CreditCard className="h-4 w-4 text-zinc-400" />
              <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Pending Amount</p>
            </div>
            <p className="text-2xl font-bold text-amber-400">{formatCurrency(pendingAmount)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Select
          options={[
            { label: 'All Status', value: '' },
            { label: 'Paid', value: 'PAID' },
            { label: 'Pending', value: 'PENDING' },
            { label: 'Refunded', value: 'REFUNDED' },
          ]}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-full sm:w-40"
        />
        <Button variant="outline" className="gap-2 ml-auto">
          <Download className="h-4 w-4" /> Export
        </Button>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<CreditCard className="h-6 w-6 text-zinc-600" />}
          title="No payments found"
          description="Payment records will appear here."
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Transaction ID</TableHead>
                <TableHead>Institution</TableHead>
                <TableHead>Exam</TableHead>
                <TableHead>Students</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(payment => (
                <TableRow key={payment.id} className="group">
                  <TableCell className="text-xs font-mono text-zinc-500">{payment.transactionId}</TableCell>
                  <TableCell className="text-sm text-zinc-200 group-hover:text-white transition-colors">{payment.institutionName}</TableCell>
                  <TableCell className="text-xs text-zinc-400">{payment.examName}</TableCell>
                  <TableCell className="text-xs text-zinc-400">{payment.studentCount}</TableCell>
                  <TableCell className="text-sm font-medium text-emerald-400">{formatCurrency(payment.amount)}</TableCell>
                  <TableCell className="text-xs text-zinc-400">{payment.paymentMethod}</TableCell>
                  <TableCell className="text-xs text-zinc-500">{formatDate(payment.date)}</TableCell>
                  <TableCell><Badge status={payment.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

function PaymentsSkeleton() {
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
