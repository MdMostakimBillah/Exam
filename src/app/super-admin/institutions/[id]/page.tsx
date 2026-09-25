"use client";
import { useState, useEffect, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useInstitutionById } from "@/lib/storage/institutions";
import { useStudentsByInstitution } from "@/lib/storage/students";
import { useRegistrationsByInstitution } from "@/lib/storage/registrations";
import { usePaymentsByInstitution } from "@/lib/storage/payments";
import { useResultsByInstitution } from "@/lib/storage/results";
import { useCertificatesByInstitution } from "@/lib/storage/certificates";
import { Student, Registration } from "@/lib/types";
import { Building2, Users, CreditCard, Award, ArrowLeft, Mail, Phone, MapPin, Calendar } from "lucide-react";
import { useTheme } from "@/contexts/theme-context";
import { useLang } from "@/contexts/language-context";

export default function InstitutionDetailPage() {
  const router = useRouter();
  const params = useParams();
  const [mounted, setMounted] = useState(false);
  const { theme } = useTheme();
  const { lang: language, t } = useLang();
  const isDark = theme === "dark";
  const isBn = language === "bn";

  useEffect(() => { setMounted(true); }, []);

  const { data: inst } = useInstitutionById(params.id as string);
  const { data: students = [] } = useStudentsByInstitution(inst?.id || '');
  // Fetch enough registrations (newest first) to derive each student's
  // actual status from their latest application
  const { data: regs = [] } = useRegistrationsByInstitution(inst?.id || '', undefined, 1, 200);
  const { data: payments = [] } = usePaymentsByInstitution(inst?.id || '');
  const { data: results = [] } = useResultsByInstitution(inst?.id || '');
  const { data: certs = [] } = useCertificatesByInstitution(inst?.id || '');

  // studentId -> their newest registration
  const regByStudent = useMemo(() => {
    const map = new Map<string, Registration>();
    for (const r of regs) {
      const cur = map.get(r.studentId);
      if (!cur || new Date(r.createdAt) >= new Date(cur.createdAt)) {
        map.set(r.studentId, r);
      }
    }
    return map;
  }, [regs]);

  /**
   * The student's ACTUAL status on this page:
   *  - SUSPENDED/INACTIVE student → stays suspended regardless of applications
   *  - otherwise the latest application decides: APPROVED/VERIFIED (green),
   *    PENDING/PAYMENT_PENDING (amber), REJECTED (red)
   *  - no application yet → the student's own status (ACTIVE/PENDING)
   */
  const deriveStudentStatus = (s: Student): string => {
    if (s.status === 'SUSPENDED' || s.status === 'INACTIVE') return s.status;
    return regByStudent.get(s.id)?.status ?? s.status;
  };

  if (!mounted) return <InstitutionSkeleton isDark={isDark} />;
  if (!inst) return <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-[#0a0a0b]' : 'bg-zinc-50'}`}><p className={isDark ? 'text-zinc-400' : 'text-zinc-500'}>Institution not found</p></div>;

  const totalPaid = payments.reduce((s, p) => s + (p.status === 'PAID' ? p.amount : 0), 0);
  const totalDue = payments.reduce((s, p) => s + (p.status === 'PENDING' ? p.amount : 0), 0);

  const card = isDark
    ? "bg-[#141416] border border-white/[0.06] rounded-md"
    : "bg-white border border-zinc-200 rounded-md shadow-sm";
  const iconBg = "bg-brand-accent-soft";
  const iconColor = "text-brand-accent";

  const stats = [
    { label: isBn ? 'শিক্ষার্থী' : 'Students', value: students.length, icon: Users },
    { label: isBn ? 'আবেদন' : 'Applications', value: regs.length, icon: Building2 },
    { label: isBn ? 'সংগ্রহিত' : 'Collected', value: '৳' + totalPaid.toLocaleString(), icon: CreditCard },
    { label: isBn ? 'সার্টিফিকেট' : 'Certificates', value: certs.length, icon: Award },
  ];

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0a0a0b]" : "bg-zinc-50"}`}>
      <div className="p-6 lg:p-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.back()}
            className={`h-8 w-8 rounded-md flex items-center justify-center transition-colors ${isDark ? 'hover:bg-white/[0.08] text-zinc-400' : 'hover:bg-zinc-100 text-zinc-500'}`}
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-zinc-900'}`}>{inst.name}</h1>
              <Badge status={inst.status} />
            </div>
            <p className={`text-[11px] ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>{inst.code} · {inst.city}, {inst.district}</p>
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {stats.map((s) => (
            <div key={s.label} className={`${card} px-4 py-3 flex items-center gap-3`}>
              <div className={`h-10 w-10 rounded-md flex items-center justify-center shrink-0 ${iconBg}`}>
                <s.icon className={`h-5 w-5 ${iconColor}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-lg font-bold tracking-tight leading-tight ${isDark ? "text-white" : "text-zinc-900"}`}>{s.value}</p>
                <p className={`text-[11px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-12 gap-6">
          {/* Main Content */}
          <div className="col-span-12 lg:col-span-8">
            <div className={`${card}`}>
              <div className={`px-5 py-4 border-b ${isDark ? "border-white/[0.06]" : "border-zinc-100"}`}>
                <Tabs defaultValue="students">
                  <TabsList className={isDark ? 'bg-white/[0.04]' : 'bg-zinc-100'}>
                    <TabsTrigger value="students" className={isDark ? 'data-[state=active]:bg-white/[0.08]' : 'data-[state=active]:bg-white'}>
                      {isBn ? 'শিক্ষার্থী' : 'Students'}
                    </TabsTrigger>
                    <TabsTrigger value="applications" className={isDark ? 'data-[state=active]:bg-white/[0.08]' : 'data-[state=active]:bg-white'}>
                      {isBn ? 'আবেদন' : 'Applications'}
                    </TabsTrigger>
                    <TabsTrigger value="results" className={isDark ? 'data-[state=active]:bg-white/[0.08]' : 'data-[state=active]:bg-white'}>
                      {isBn ? 'ফলাফল' : 'Results'}
                    </TabsTrigger>
                  </TabsList>

                  <div className="p-5">
                    <TabsContent value="students">
                      <Table>
                        <TableHeader>
                          <TableRow className={isDark ? 'border-white/[0.04] hover:bg-transparent' : 'border-zinc-100 hover:bg-transparent'}>
                            <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'নাম' : 'Name'}</TableHead>
                            <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>ID</TableHead>
                            <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'শ্রেণী' : 'Class'}</TableHead>
                            <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'স্ট্যাটাস' : 'Status'}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {students.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={4} className={`text-center py-8 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                                {isBn ? 'কোনো শিক্ষার্থী পাওয়া যায়নি' : 'No students found'}
                              </TableCell>
                            </TableRow>
                          ) : (
                            students.slice(0, 10).map(s => (
                              <TableRow key={s.id} className={isDark ? 'border-white/[0.04] hover:bg-white/[0.02]' : 'border-zinc-100 hover:bg-zinc-50/50'}>
                                <TableCell className={`text-sm font-medium ${isDark ? 'text-zinc-100' : 'text-zinc-800'}`}>{s.firstName} {s.lastName}</TableCell>
                                <TableCell className={`text-[11px] font-mono ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>{s.studentId}</TableCell>
                                <TableCell className={`text-[11px] ${isDark ? 'text-zinc-300' : 'text-zinc-600'}`}>{s.class}</TableCell>
                                <TableCell><Badge status={deriveStudentStatus(s)} /></TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </TabsContent>

                    <TabsContent value="applications">
                      <Table>
                        <TableHeader>
                          <TableRow className={isDark ? 'border-white/[0.04] hover:bg-transparent' : 'border-zinc-100 hover:bg-transparent'}>
                            <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>App ID</TableHead>
                            <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'শিক্ষার্থী' : 'Student'}</TableHead>
                            <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'পরীক্ষা' : 'Exam'}</TableHead>
                            <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'স্ট্যাটাস' : 'Status'}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {regs.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={4} className={`text-center py-8 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                                {isBn ? 'কোনো আবেদন পাওয়া যায়নি' : 'No applications found'}
                              </TableCell>
                            </TableRow>
                          ) : (
                            regs.slice(0, 10).map(r => (
                              <TableRow key={r.id} className={isDark ? 'border-white/[0.04] hover:bg-white/[0.02]' : 'border-zinc-100 hover:bg-zinc-50/50'}>
                                <TableCell className={`text-[11px] font-mono ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>{r.registrationNumber}</TableCell>
                                <TableCell className={`text-sm font-medium ${isDark ? 'text-zinc-100' : 'text-zinc-800'}`}>{r.studentName}</TableCell>
                                <TableCell className={`text-[11px] ${isDark ? 'text-zinc-300' : 'text-zinc-600'}`}>{r.examName}</TableCell>
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
                          <TableRow className={isDark ? 'border-white/[0.04] hover:bg-transparent' : 'border-zinc-100 hover:bg-transparent'}>
                            <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'শিক্ষার্থী' : 'Student'}</TableHead>
                            <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'শ্রেণী' : 'Class'}</TableHead>
                            <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'মোট' : 'Total'}</TableHead>
                            <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'গ্রেড' : 'Grade'}</TableHead>
                            <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'বৃত্তি' : 'Scholarship'}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {results.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={5} className={`text-center py-8 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                                {isBn ? 'কোনো ফলাফল পাওয়া যায়নি' : 'No results found'}
                              </TableCell>
                            </TableRow>
                          ) : (
                            results.slice(0, 10).map(r => (
                              <TableRow key={r.id} className={isDark ? 'border-white/[0.04] hover:bg-white/[0.02]' : 'border-zinc-100 hover:bg-zinc-50/50'}>
                                <TableCell className={`text-sm font-medium ${isDark ? 'text-zinc-100' : 'text-zinc-800'}`}>{r.studentName}</TableCell>
                                <TableCell className={`text-[11px] ${isDark ? 'text-zinc-300' : 'text-zinc-600'}`}>{r.className}</TableCell>
                                <TableCell className={`text-[11px] ${isDark ? 'text-zinc-300' : 'text-zinc-600'}`}>{r.totalMarks}/{r.totalFullMarks}</TableCell>
                                <TableCell className={`text-[11px] font-medium ${isDark ? 'text-zinc-100' : 'text-zinc-800'}`}>{r.grade}</TableCell>
                                    <TableCell><Badge status={r.scholarshipStatus}>{r.scholarshipStatus}</Badge></TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </TabsContent>
                  </div>
                </Tabs>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="col-span-12 lg:col-span-4 space-y-6">
            {/* Institution Info */}
            <div className={`${card}`}>
              <div className={`px-5 py-4 border-b ${isDark ? "border-white/[0.06]" : "border-zinc-100"}`}>
                <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>{isBn ? 'প্রতিষ্ঠান তথ্য' : 'Institution Details'}</h3>
              </div>
              <div className="p-5 space-y-4">
                <div className="flex items-start gap-3">
                  <Mail className={`h-4 w-4 ${iconColor} mt-0.5`} />
                  <div>
                    <p className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>{isBn ? 'ইমেইল' : 'Email'}</p>
                    <p className={`text-[11px] ${isDark ? 'text-zinc-300' : 'text-zinc-600'}`}>{inst.email}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Phone className={`h-4 w-4 ${iconColor} mt-0.5`} />
                  <div>
                    <p className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>{isBn ? 'ফোন' : 'Phone'}</p>
                    <p className={`text-[11px] ${isDark ? 'text-zinc-300' : 'text-zinc-600'}`}>{inst.phone}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <MapPin className={`h-4 w-4 ${iconColor} mt-0.5`} />
                  <div>
                    <p className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>{isBn ? 'ঠিকানা' : 'Address'}</p>
                    <p className={`text-[11px] ${isDark ? 'text-zinc-300' : 'text-zinc-600'}`}>{inst.address}, {inst.city}, {inst.district}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Calendar className={`h-4 w-4 ${iconColor} mt-0.5`} />
                  <div>
                    <p className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>{isBn ? 'যোগাযোগ ব্যক্তি' : 'Contact Person'}</p>
                    <p className={`text-[11px] ${isDark ? 'text-zinc-300' : 'text-zinc-600'}`}>{inst.contactPerson}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Statistics */}
            <div className={`${card}`}>
              <div className={`px-5 py-4 border-b ${isDark ? "border-white/[0.06]" : "border-zinc-100"}`}>
                <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>{isBn ? 'পরিসংখ্যান' : 'Statistics'}</h3>
              </div>
              <div className="p-5 space-y-3">
                <div className="flex justify-between">
                  <span className={`text-[11px] ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'মোট শিক্ষার্থী' : 'Total Students'}</span>
                  <span className={`text-[11px] font-medium ${isDark ? 'text-zinc-200' : 'text-zinc-700'}`}>{students.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className={`text-[11px] ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'সক্রিয় শিক্ষার্থী' : 'Active Students'}</span>
                  <span className={`text-[11px] font-medium ${isDark ? 'text-zinc-200' : 'text-zinc-700'}`}>{students.filter(s => s.status === 'ACTIVE').length}</span>
                </div>
                <div className="flex justify-between">
                  <span className={`text-[11px] ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'অনুমোদিত আবেদন' : 'Approved Applications'}</span>
                  <span className={`text-[11px] font-medium ${isDark ? 'text-zinc-200' : 'text-zinc-700'}`}>{regs.filter(r => r.status === 'APPROVED').length}</span>
                </div>
                <div className="flex justify-between">
                  <span className={`text-[11px] ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'বকেয়া' : 'Due Amount'}</span>
                  <span className={`text-[11px] font-medium ${isDark ? 'text-zinc-200' : 'text-zinc-700'}`}>৳{totalDue.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InstitutionSkeleton({ isDark }: { isDark: boolean }) {
  const card = isDark ? "bg-[#141416] border border-white/[0.06]" : "bg-white border border-zinc-200 shadow-sm";

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0a0a0b]" : "bg-zinc-50"}`}>
      <div className="p-6 lg:p-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className={`${card} rounded-md h-[52px]`} />
          ))}
        </div>
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-8">
            <div className={`${card} rounded-md h-64`} />
          </div>
          <div className="col-span-4 space-y-6">
            <div className={`${card} rounded-md h-48`} />
            <div className={`${card} rounded-md h-48`} />
          </div>
        </div>
      </div>
    </div>
  );
}
