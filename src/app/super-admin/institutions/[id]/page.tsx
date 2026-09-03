"use client";
import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getInstitutionById } from "@/lib/storage/institutions";
import { getStudentsByInstitution } from "@/lib/storage/students";
import { getRegistrationsByInstitution } from "@/lib/storage/registrations";
import { getPaymentsByInstitution } from "@/lib/storage/payments";
import { getResultsByInstitution } from "@/lib/storage/results";
import { getCertificatesByInstitution } from "@/lib/storage/certificates";
import { Building2, Users, CreditCard, Award, ArrowLeft, Mail, Phone, MapPin, Calendar } from "lucide-react";
import { useTheme } from "@/contexts/theme-context";
import { useLang } from "@/contexts/language-context";

export default function InstitutionDetailPage() {
  const router = useRouter();
  const params = useParams();
  const [mounted, setMounted] = useState(false);
  const { theme } = useTheme();
  const { lang: language, t } = useLang();
  
  useEffect(() => { setMounted(true); }, []);

  const isDark = theme === "dark";
  const isBn = language === "bn";

  if (!mounted) return <InstitutionSkeleton isDark={isDark} />;

  const inst = getInstitutionById(params.id as string);
  if (!inst) return <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-[#0a0a0b]' : 'bg-zinc-50'}`}><p className="text-zinc-500">Institution not found</p></div>;

  const students = getStudentsByInstitution(inst.id);
  const regs = getRegistrationsByInstitution(inst.id);
  const payments = getPaymentsByInstitution(inst.id);
  const results = getResultsByInstitution(inst.id);
  const certs = getCertificatesByInstitution(inst.id);

  const totalPaid = payments.reduce((s, p) => s + (p.status === 'PAID' ? p.amount : 0), 0);
  const totalDue = payments.reduce((s, p) => s + (p.status === 'PENDING' ? p.amount : 0), 0);

  const bg = isDark ? "bg-[#0a0a0b]" : "bg-zinc-50";
  const text = isDark ? "text-zinc-100" : "text-zinc-900";
  const textSec = isDark ? "text-zinc-400" : "text-zinc-500";
  const border = isDark ? "border-white/[0.06]" : "border-zinc-200/50";
  const glassCard = isDark 
    ? "bg-white/[0.03] backdrop-blur-2xl border border-white/[0.08]" 
    : "bg-white/70 backdrop-blur-xl border border-white/80";

  const stats = [
    { label: isBn ? 'শিক্ষার্থী' : 'Students', value: students.length, icon: Users },
    { label: isBn ? 'আবেদন' : 'Applications', value: regs.length, icon: Building2 },
    { label: isBn ? 'সংগ্রহিত' : 'Collected', value: '৳' + totalPaid.toLocaleString(), icon: CreditCard },
    { label: isBn ? 'সার্টিফিকেট' : 'Certificates', value: certs.length, icon: Award },
  ];

  return (
    <div className={`min-h-screen ${bg}`}>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-blue-500/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-purple-500/5 rounded-full blur-[120px]" />
      </div>

      <div className="p-6 lg:p-8 relative z-10">
        <div className="flex items-center gap-3 mb-8">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className={isDark ? 'text-zinc-400 hover:text-white hover:bg-white/5' : 'text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100'}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className={`text-2xl font-bold ${text}`}>{inst.name}</h1>
              <Badge status={inst.status} />
            </div>
            <p className={`text-sm ${textSec}`}>{inst.code} · {inst.city}, {inst.district}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {stats.map((stat) => (
            <Card key={stat.label} className={glassCard}>
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

        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 lg:col-span-8">
            <Card className={glassCard}>
              <CardContent className="p-6">
                <Tabs defaultValue="students">
                  <TabsList className={`mb-6 ${isDark ? 'bg-white/5' : 'bg-zinc-100'}`}>
                    <TabsTrigger value="students" className={isDark ? 'data-[state=active]:bg-white/10' : 'data-[state=active]:bg-white'}>
                      {isBn ? 'শিক্ষার্থী' : 'Students'}
                    </TabsTrigger>
                    <TabsTrigger value="applications" className={isDark ? 'data-[state=active]:bg-white/10' : 'data-[state=active]:bg-white'}>
                      {isBn ? 'আবেদন' : 'Applications'}
                    </TabsTrigger>
                    <TabsTrigger value="results" className={isDark ? 'data-[state=active]:bg-white/10' : 'data-[state=active]:bg-white'}>
                      {isBn ? 'ফলাফল' : 'Results'}
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="students">
                    <Table>
                      <TableHeader>
                        <TableRow className={border}>
                          <TableHead className={textSec}>{isBn ? 'নাম' : 'Name'}</TableHead>
                          <TableHead className={textSec}>ID</TableHead>
                          <TableHead className={textSec}>{isBn ? 'শ্রেণী' : 'Class'}</TableHead>
                          <TableHead className={textSec}>{isBn ? 'স্থিতি' : 'Status'}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {students.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className={`text-center py-8 ${textSec}`}>
                              {isBn ? 'কোনো শিক্ষার্থী পাওয়া যায়নি' : 'No students found'}
                            </TableCell>
                          </TableRow>
                        ) : (
                          students.slice(0, 10).map(s => (
                            <TableRow key={s.id} className={isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-zinc-50'}>
                              <TableCell className={`text-sm font-medium ${text}`}>{s.firstName} {s.lastName}</TableCell>
                              <TableCell className={`text-sm font-mono ${textSec}`}>{s.studentId}</TableCell>
                              <TableCell className={`text-sm ${textSec}`}>{s.class}</TableCell>
                              <TableCell><Badge status={s.status} /></TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </TabsContent>

                  <TabsContent value="applications">
                    <Table>
                      <TableHeader>
                        <TableRow className={border}>
                          <TableHead className={textSec}>App ID</TableHead>
                          <TableHead className={textSec}>{isBn ? 'শিক্ষার্থী' : 'Student'}</TableHead>
                          <TableHead className={textSec}>{isBn ? 'পরীক্ষা' : 'Exam'}</TableHead>
                          <TableHead className={textSec}>{isBn ? 'স্থিতি' : 'Status'}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {regs.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className={`text-center py-8 ${textSec}`}>
                              {isBn ? 'কোনো আবেদন পাওয়া যায়নি' : 'No applications found'}
                            </TableCell>
                          </TableRow>
                        ) : (
                          regs.slice(0, 10).map(r => (
                            <TableRow key={r.id} className={isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-zinc-50'}>
                              <TableCell className={`text-sm font-mono ${textSec}`}>{r.applicationId}</TableCell>
                              <TableCell className={`text-sm font-medium ${text}`}>{r.studentName}</TableCell>
                              <TableCell className={`text-sm ${textSec}`}>{r.examName}</TableCell>
                              <TableCell><Badge status={r.status} /></TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </TabsContent>

                  <TabsContent value="results">
                    <Table>
                      <TableHeader>
                        <TableRow className={border}>
                          <TableHead className={textSec}>{isBn ? 'শিক্ষার্থী' : 'Student'}</TableHead>
                          <TableHead className={textSec}>{isBn ? 'শ্রেণী' : 'Class'}</TableHead>
                          <TableHead className={textSec}>{isBn ? 'মোট' : 'Total'}</TableHead>
                          <TableHead className={textSec}>{isBn ? 'গ্রেড' : 'Grade'}</TableHead>
                          <TableHead className={textSec}>{isBn ? 'বৃত্তি' : 'Scholarship'}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {results.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className={`text-center py-8 ${textSec}`}>
                              {isBn ? 'কোনো ফলাফল পাওয়া যায়নি' : 'No results found'}
                            </TableCell>
                          </TableRow>
                        ) : (
                          results.slice(0, 10).map(r => (
                            <TableRow key={r.id} className={isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-zinc-50'}>
                              <TableCell className={`text-sm font-medium ${text}`}>{r.studentName}</TableCell>
                              <TableCell className={`text-sm ${textSec}`}>{r.className}</TableCell>
                              <TableCell className={`text-sm ${textSec}`}>{r.totalMarks}/{r.totalFullMarks}</TableCell>
                              <TableCell className={`text-sm font-medium ${text}`}>{r.grade}</TableCell>
                              <TableCell><Badge status={r.scholarshipStatus === 'ELIGIBLE' ? 'ACTIVE' : r.scholarshipStatus === 'PENDING' ? 'PENDING' : 'REJECTED'} /></TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>

          <div className="col-span-12 lg:col-span-4">
            <Card className={glassCard}>
              <CardContent className="p-6">
                <h3 className={`text-sm font-semibold mb-4 ${text}`}>{isBn ? 'প্রতিষ্ঠান তথ্য' : 'Institution Details'}</h3>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <Mail className={`h-4 w-4 ${textSec} mt-0.5`} />
                    <div>
                      <p className={`text-xs ${textSec}`}>{isBn ? 'ইমেইল' : 'Email'}</p>
                      <p className={`text-sm ${text}`}>{inst.email}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Phone className={`h-4 w-4 ${textSec} mt-0.5`} />
                    <div>
                      <p className={`text-xs ${textSec}`}>{isBn ? 'ফোন' : 'Phone'}</p>
                      <p className={`text-sm ${text}`}>{inst.phone}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <MapPin className={`h-4 w-4 ${textSec} mt-0.5`} />
                    <div>
                      <p className={`text-xs ${textSec}`}>{isBn ? 'ঠিকানা' : 'Address'}</p>
                      <p className={`text-sm ${text}`}>{inst.address}, {inst.city}, {inst.district}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Calendar className={`h-4 w-4 ${textSec} mt-0.5`} />
                    <div>
                      <p className={`text-xs ${textSec}`}>{isBn ? 'যোগাযোগ ব্যক্তি' : 'Contact Person'}</p>
                      <p className={`text-sm ${text}`}>{inst.contactPerson}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className={`${glassCard} mt-6`}>
              <CardContent className="p-6">
                <h3 className={`text-sm font-semibold mb-4 ${text}`}>{isBn ? 'পরিসংখ্যান' : 'Statistics'}</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className={`text-sm ${textSec}`}>{isBn ? 'মোট শিক্ষার্থী' : 'Total Students'}</span>
                    <span className={`text-sm font-medium ${text}`}>{students.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={`text-sm ${textSec}`}>{isBn ? 'সক্রিয় শিক্ষার্থী' : 'Active Students'}</span>
                    <span className={`text-sm font-medium ${text}`}>{students.filter(s => s.status === 'ACTIVE').length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={`text-sm ${textSec}`}>{isBn ? 'অনুমোদিত আবেদন' : 'Approved Applications'}</span>
                    <span className={`text-sm font-medium ${text}`}>{regs.filter(r => r.status === 'APPROVED').length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={`text-sm ${textSec}`}>{isBn ? 'বকেয়া' : 'Due Amount'}</span>
                    <span className={`text-sm font-medium ${text}`}>৳{totalDue.toLocaleString()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function InstitutionSkeleton({ isDark }: { isDark: boolean }) {
  const bg = isDark ? "bg-[#0a0a0b]" : "bg-zinc-50";
  const cardBg = isDark ? "bg-white/[0.03]" : "bg-white";
  
  return (
    <div className={`min-h-screen ${bg}`}>
      <div className="p-6 lg:p-8">
        <div className={`h-8 w-48 rounded mb-8 ${isDark ? 'bg-zinc-800' : 'bg-zinc-200'}`} />
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className={`h-20 rounded-lg ${cardBg}`} />
          ))}
        </div>
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-4">
            <div className={`h-64 rounded-lg ${cardBg}`} />
          </div>
          <div className="col-span-8">
            <div className={`h-64 rounded-lg ${cardBg}`} />
          </div>
        </div>
      </div>
    </div>
  );
}
