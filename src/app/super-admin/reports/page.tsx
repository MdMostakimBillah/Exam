"use client";
import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { BarChart3, FileText, Download, Users, GraduationCap, TrendingUp } from "lucide-react";

export default function ReportsPage() {
  const [mounted, setMounted] = useState(false);
  const [selectedReport, setSelectedReport] = useState("");

  useEffect(() => { setMounted(true); }, []);

  if (!mounted) return <ReportsSkeleton />;

  const reports = [
    {
      id: 'student-roster',
      title: 'Student Roster',
      description: 'Complete student roster with class and section details.',
      icon: Users,
      color: 'blue',
    },
    {
      id: 'registration-summary',
      title: 'Registration Summary',
      description: 'All registrations with status and payment details.',
      icon: FileText,
      color: 'emerald',
    },
    {
      id: 'result-analysis',
      title: 'Result Analysis',
      description: 'Examination results with grades and scholarship status.',
      icon: GraduationCap,
      color: 'amber',
    },
    {
      id: 'payment-summary',
      title: 'Payment Summary',
      description: 'Payment history and transaction details.',
      icon: TrendingUp,
      color: 'green',
    },
  ];

  const colorMap: Record<string, string> = {
    blue: 'from-blue-500/20 to-blue-600/10 border-blue-500/20',
    emerald: 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/20',
    amber: 'from-amber-500/20 to-amber-600/10 border-amber-500/20',
    green: 'from-green-500/20 to-green-600/10 border-green-500/20',
  };

  const iconColorMap: Record<string, string> = {
    blue: 'text-blue-400',
    emerald: 'text-emerald-400',
    amber: 'text-amber-400',
    green: 'text-green-400',
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" description="Generate and download comprehensive reports." />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {reports.map((report) => (
          <Card key={report.id} className="group hover:border-white/[0.08] transition-all duration-300 cursor-pointer">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${colorMap[report.color]} flex items-center justify-center border`}>
                  <report.icon className={`h-6 w-6 ${iconColorMap[report.color]}`} />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-zinc-100 mb-1">{report.title}</h3>
                  <p className="text-xs text-zinc-500 leading-relaxed">{report.description}</p>
                </div>
              </div>
              <div className="flex gap-2 mt-5">
                <Button variant="outline" size="sm" className="gap-1.5 flex-1">
                  <FileText className="h-3.5 w-3.5" /> Preview
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5 flex-1">
                  <Download className="h-3.5 w-3.5" /> PDF
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5 flex-1">
                  <Download className="h-3.5 w-3.5" /> CSV
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function ReportsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-48 skeleton rounded" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-48 skeleton rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
