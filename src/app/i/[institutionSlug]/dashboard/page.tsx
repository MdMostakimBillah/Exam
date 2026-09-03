"use client";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getInstitutionBySlug } from "@/lib/storage/institutions";
import { getStudentsByInstitution } from "@/lib/storage/students";
import { getRegistrationsByInstitution } from "@/lib/storage/registrations";
import { getExams } from "@/lib/storage/exams";
import { getResultsByInstitution } from "@/lib/storage/results";
import { getPaymentsByInstitution } from "@/lib/storage/payments";
import { Users, FileText, ClipboardList, ArrowRight, Clock, CheckCircle, XCircle, DollarSign, Wallet, Activity, Inbox } from "lucide-react";
import Link from "next/link";
import { useTheme } from "@/contexts/theme-context";
import { useLang } from "@/contexts/language-context";

export default function InstitutionDashboardPage() {
  const params = useParams();
  const slug = params.institutionSlug as string;
  const [mounted, setMounted] = useState(false);
  const { theme } = useTheme();
  const { lang: language, t } = useLang();
  
  useEffect(() => { setMounted(true); }, []);

  const isDark = theme === "dark";
  const isBn = language === "bn";

  if (!mounted) return <DashboardSkeleton isDark={isDark} />;

  const inst = getInstitutionBySlug(slug);
  if (!inst) return null;

  const students = getStudentsByInstitution(inst.id);
  const registrations = getRegistrationsByInstitution(inst.id);
  const exams = getExams();
  const results = getResultsByInstitution(inst.id);
  const payments = getPaymentsByInstitution(inst.id);

  const totalCollected = payments.reduce((sum, p) => sum + (p.status === 'PAID' ? p.amount : 0), 0);
  const totalDue = payments.reduce((sum, p) => sum + (p.status === 'PENDING' ? p.amount : 0), 0);
  const pendingStudents = registrations.filter(r => r.status === 'PENDING').length;
  const approvedStudents = registrations.filter(r => r.status === 'APPROVED' || r.status === 'VERIFIED').length;
  const rejectedStudents = registrations.filter(r => r.status === 'REJECTED').length;
  const activeExams = exams.filter(e => e.status === 'OPEN' || e.status === 'PUBLISHED').length;
  const inactiveExams = exams.filter(e => e.status === 'DRAFT' || e.status === 'CLOSED').length;

  const bg = isDark ? "bg-[#0a0a0b]" : "bg-zinc-50";
  const text = isDark ? "text-zinc-100" : "text-zinc-900";
  const textSec = isDark ? "text-zinc-400" : "text-zinc-500";
  const border = isDark ? "border-white/[0.06]" : "border-zinc-200/50";
  const glassCard = isDark 
    ? "bg-white/[0.03] backdrop-blur-2xl border border-white/[0.08]" 
    : "bg-white/60 backdrop-blur-xl border border-white/80";

  const stats = [
    { label: isBn ? 'মোট শিক্ষার্থী' : 'Total Students', value: students.length, icon: Users },
    { label: isBn ? 'সক্রিয় পরীক্ষা' : 'Active', value: activeExams, icon: Activity },
    { label: isBn ? 'নিষ্ক্রিয়' : 'Inactive', value: inactiveExams, icon: Inbox },
    { label: isBn ? 'আবেদন প্রতীক্ষা' : 'Pending', value: pendingStudents, icon: Clock },
    { label: isBn ? 'অনুমোদিত' : 'Approved', value: approvedStudents, icon: CheckCircle },
    { label: isBn ? 'সংগ্রহিত' : 'Paid', value: '৳' + totalCollected.toLocaleString(), icon: DollarSign },
    { label: isBn ? 'বকেয়া' : 'Due', value: '৳' + totalDue.toLocaleString(), icon: Wallet },
  ];

  return (
    <div className={`min-h-screen ${bg}`}>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-blue-500/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-purple-500/5 rounded-full blur-[120px]" />
      </div>

      <div className="p-6 lg:p-8 relative z-10">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <h1 className={`text-2xl lg:text-3xl font-bold tracking-tight ${text}`}>{t("brand")}</h1>
            <Badge status={inst.status} />
          </div>
          <Link href={`/i/${slug}/registrations`}>
            <Button size="sm" className="gap-2">
              {isBn ? 'শিক্ষার্থী নিবন্ধন' : 'Register Students'} <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-4 mb-8">
          {stats.map((stat) => (
            <Card key={stat.label} className={`${glassCard} hover:-translate-y-0.5 transition-all duration-200`}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${isDark ? 'bg-white/10' : 'bg-zinc-100'}`}>
                    <stat.icon className={`h-5 w-5 ${textSec}`} />
                  </div>
                  <div className="min-w-0">
                    <p className={`text-xl font-semibold ${text}`}>{stat.value}</p>
                    <p className={`text-xs ${textSec} truncate`}>{stat.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-12 gap-6 mb-6">
          <div className="col-span-12 lg:col-span-8">
            <Card className={`${glassCard}`}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-5">
                  <h3 className={`text-sm font-semibold ${text}`}>
                    {isBn ? 'উপলব্ধ পরীক্ষা' : 'Available Exams'}
                  </h3>
                  <Link href={`/i/${slug}/exams`} className={`text-xs ${isDark ? 'text-zinc-400 hover:text-zinc-200' : 'text-zinc-500 hover:text-zinc-700'} transition-colors`}>
                    {isBn ? 'সব দেখুন' : 'View all'} <ArrowRight className="h-3 w-3 inline" />
                  </Link>
                </div>
                {exams.length === 0 ? (
                  <div className={`flex items-center justify-center py-10 ${textSec}`}>
                    <div className="text-center">
                      <FileText className={`h-10 w-10 mx-auto mb-3 ${isDark ? 'text-zinc-700' : 'text-gray-300'}`} />
                      <p className="text-sm">{isBn ? 'কোনো সক্রিয় পরীক্ষা নেই' : 'No active exams available'}</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {exams.slice(0, 3).map(exam => (
                      <div key={exam.id} className={`flex items-center justify-between p-3 rounded-lg ${isDark ? 'bg-white/[0.02]' : 'bg-zinc-50'}`}>
                        <div>
                          <p className={`text-sm font-medium ${text}`}>{exam.name}</p>
                          <p className={`text-xs mt-0.5 ${textSec}`}>{exam.code} · {exam.academicYear}</p>
                        </div>
                        <Badge status={exam.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT'} />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="col-span-12 lg:col-span-4">
            <Card className={`${glassCard}`}>
              <CardContent className="p-6">
                <h3 className={`text-sm font-semibold mb-4 ${text}`}>
                  {isBn ? 'নিবন্ধন পরিসংখ্যান' : 'Registration Stats'}
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className={`h-4 w-4 ${textSec}`} />
                      <span className={`text-sm ${textSec}`}>{isBn ? 'বিচারাধীন' : 'Pending'}</span>
                    </div>
                    <span className={`text-sm font-medium ${text}`}>{pendingStudents}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle className={`h-4 w-4 ${textSec}`} />
                      <span className={`text-sm ${textSec}`}>{isBn ? 'অনুমোদিত' : 'Approved'}</span>
                    </div>
                    <span className={`text-sm font-medium ${text}`}>{approvedStudents}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <XCircle className={`h-4 w-4 ${textSec}`} />
                      <span className={`text-sm ${textSec}`}>{isBn ? 'প্রত্যাখ্যান' : 'Rejected'}</span>
                    </div>
                    <span className={`text-sm font-medium ${text}`}>{rejectedStudents}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <Card className={`${glassCard}`}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-sm font-semibold ${text}`}>
                {isBn ? 'সাম্প্রতিক শিক্ষার্থী' : 'Recent Students'}
              </h3>
              <Link href={`/i/${slug}/students`} className={`text-xs ${isDark ? 'text-zinc-400 hover:text-zinc-200' : 'text-zinc-500 hover:text-zinc-700'} transition-colors`}>
                {isBn ? 'সব দেখুন' : 'View all'} <ArrowRight className="h-3 w-3 inline" />
              </Link>
            </div>
            <Table>
              <TableHeader>
                <TableRow className={border}>
                  <TableHead className={textSec}>{isBn ? 'নাম' : 'Name'}</TableHead>
                  <TableHead className={textSec}>Student ID</TableHead>
                  <TableHead className={textSec}>{isBn ? 'শ্রেণী' : 'Class'}</TableHead>
                  <TableHead className={textSec}>{isBn ? 'স্থিতি' : 'Status'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.slice(0, 5).map(s => (
                  <TableRow key={s.id} className={`${isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-zinc-50'}`}>
                    <TableCell className={`text-sm font-medium ${text}`}>{s.firstName} {s.lastName}</TableCell>
                    <TableCell className={`text-sm font-mono ${textSec}`}>{s.studentId}</TableCell>
                    <TableCell className={`text-sm ${textSec}`}>{s.class}</TableCell>
                    <TableCell><Badge status={s.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DashboardSkeleton({ isDark }: { isDark: boolean }) {
  const bg = isDark ? "bg-[#0a0a0b]" : "bg-zinc-50";
  const cardBg = isDark ? "bg-white/[0.03]" : "bg-white";
  
  return (
    <div className={`min-h-screen ${bg}`}>
      <div className="p-6 lg:p-8">
        <div className={`h-8 w-48 rounded mb-8 ${isDark ? 'bg-zinc-800' : 'bg-zinc-200'}`} />
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[...Array(7)].map((_, i) => (
            <div key={i} className={`h-20 rounded-lg ${cardBg}`} />
          ))}
        </div>
      </div>
    </div>
  );
}
