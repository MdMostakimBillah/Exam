"use client";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { getInstitutionBySlug } from "@/lib/storage/institutions";
import { getStudentsByInstitution } from "@/lib/storage/students";
import { getRegistrationsByInstitution } from "@/lib/storage/registrations";
import { getResultsByInstitution } from "@/lib/storage/results";
import { getPaymentsByInstitution } from "@/lib/storage/payments";
import { getExams } from "@/lib/storage/exams";
import { useTheme } from "@/contexts/theme-context";
import { useLang } from "@/contexts/language-context";
import { BarChart3, Download, FileText, Users, GraduationCap, CreditCard, TrendingUp } from "lucide-react";

export default function InstitutionReportsPage() {
  const params = useParams();
  const slug = params.institutionSlug as string;
  const { theme } = useTheme();
  const { lang: language, t } = useLang();
  const isDark = theme === "dark";
  const isBn = language === "bn";
  const [mounted, setMounted] = useState(false);
  const [generating, setGenerating] = useState<string | null>(null);

  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return <ReportsSkeleton isDark={isDark} />;

  const inst = getInstitutionBySlug(slug);
  if (!inst) return null;

  const students = getStudentsByInstitution(inst.id);
  const registrations = getRegistrationsByInstitution(inst.id);
  const results = getResultsByInstitution(inst.id);
  const payments = getPaymentsByInstitution(inst.id);
  const exams = getExams();

  const classBreakdown = students.reduce<Record<string, number>>((acc, s) => {
    acc[s.class] = (acc[s.class] || 0) + 1;
    return acc;
  }, {});
  const classCount = Object.keys(classBreakdown).length;

  const passedResults = results.filter(r => r.pass);
  const passRate = results.length > 0 ? Math.round((passedResults.length / results.length) * 100) : 0;
  const avgGrade = results.length > 0
    ? Math.round(results.reduce((sum, r) => sum + r.percentage, 0) / results.length)
    : 0;

  const totalPaid = payments.reduce((sum, p) => sum + (p.status === "PAID" || p.status === "CONFIRMED" ? p.amount : 0), 0);
  const totalPending = payments.reduce((sum, p) => sum + (p.status === "PENDING" ? p.amount : 0), 0);

  const registrationsByExam = registrations.reduce<Record<string, number>>((acc, r) => {
    acc[r.examName] = (acc[r.examName] || 0) + 1;
    return acc;
  }, {});

  const card = isDark
    ? "bg-[#141416] border border-white/[0.06] rounded-2xl"
    : "bg-white border border-zinc-200 rounded-2xl shadow-sm";
  const iconBg = isDark ? "bg-white/[0.08]" : "bg-zinc-100";
  const iconColor = isDark ? "text-zinc-300" : "text-zinc-600";

  const handleGenerate = (reportId: string) => {
    setGenerating(reportId);
    setTimeout(() => {
      setGenerating(null);
      alert(isBn ? "রিপোর্ট তৈরি হয়েছে!" : "Report generated!");
    }, 800);
  };

  const reports = [
    {
      id: "student-enrollment",
      title: isBn ? "শিক্ষার্থী ভর্তি রিপোর্ট" : "Student Enrollment Report",
      description: isBn ? "শ্রেণী অনুযায়ী সম্পূর্ণ শিক্ষার্থী তালিকা এবং ভর্তি পরিসংখ্যান।" : "Complete student list with class-wise breakdown and enrollment statistics.",
      icon: Users,
      iconBg: isDark ? "bg-blue-500/20" : "bg-blue-100",
      iconColor: isDark ? "text-blue-400" : "text-blue-600",
      metric: students.length,
      metricLabel: isBn ? "মোট শিক্ষার্থী" : "Total Students",
      breakdown: classCount > 0
        ? isBn ? `${classCount}টি শ্রেণী, ${students.length} জন শিক্ষার্থী` : `${classCount} classes, ${students.length} students`
        : isBn ? "কোনো শিক্ষার্থী নেই" : "No students enrolled",
    },
    {
      id: "exam-performance",
      title: isBn ? "পরীক্ষার ফলাফল রিপোর্ট" : "Exam Performance Report",
      description: isBn ? "পাশের হার, গড় নম্বর এবং গ্রেড বিতরণ সহ পরীক্ষার ফলাফল বিশ্লেষণ।" : "Exam performance analysis with pass rate, average marks, and grade distribution.",
      icon: GraduationCap,
      iconBg: isDark ? "bg-amber-500/20" : "bg-amber-100",
      iconColor: isDark ? "text-amber-400" : "text-amber-600",
      metric: `${passRate}%`,
      metricLabel: isBn ? "পাশের হার" : "Pass Rate",
      breakdown: results.length > 0
        ? isBn ? `${results.length}টি ফলাফল, গড় ${avgGrade}%` : `${results.length} results, avg ${avgGrade}%`
        : isBn ? "কোনো ফলাফল নেই" : "No results yet",
    },
    {
      id: "financial",
      title: isBn ? "আর্থিক রিপোর্ট" : "Financial Report",
      description: isBn ? "পেমেন্ট সারসংক্ষেপ, সংগ্রহিত এবং বকেয়া পরিমাণ।" : "Payment summary with collected and outstanding amounts.",
      icon: CreditCard,
      iconBg: isDark ? "bg-green-500/20" : "bg-green-100",
      iconColor: isDark ? "text-green-400" : "text-green-600",
      metric: `৳${totalPaid.toLocaleString()}`,
      metricLabel: isBn ? "সংগ্রহিত" : "Collected",
      breakdown: totalPending > 0
        ? isBn ? `৳${totalPending.toLocaleString()} বকেয়া` : `৳${totalPending.toLocaleString()} pending`
        : isBn ? "কোনো বকেয়া নেই" : "No pending payments",
    },
    {
      id: "registration",
      title: isBn ? "নিবন্ধন রিপোর্ট" : "Registration Report",
      description: isBn ? "পরীক্ষা অনুযায়ী নিবন্ধন পরিসংখ্যান এবং আবেদন অবস্থা।" : "Registration statistics per exam with application status breakdown.",
      icon: FileText,
      iconBg: isDark ? "bg-emerald-500/20" : "bg-emerald-100",
      iconColor: isDark ? "text-emerald-400" : "text-emerald-600",
      metric: registrations.length,
      metricLabel: isBn ? "মোট নিবন্ধন" : "Total Registrations",
      breakdown: registrations.length > 0
        ? isBn ? `${Object.keys(registrationsByExam).length}টি পরীক্ষায় নিবন্ধিত` : `Registered for ${Object.keys(registrationsByExam).length} exams`
        : isBn ? "কোনো নিবন্ধন নেই" : "No registrations",
    },
    {
      id: "attendance",
      title: isBn ? "উপস্থিতি রিপোর্ট" : "Attendance Report",
      description: isBn ? "শিক্ষার্থীদের উপস্থিতি এবং অনুপস্থিতির হিসাব।" : "Student attendance and absence tracking report.",
      icon: BarChart3,
      iconBg: isDark ? "bg-purple-500/20" : "bg-purple-100",
      iconColor: isDark ? "text-purple-400" : "text-purple-600",
      metric: "—",
      metricLabel: isBn ? "উপস্থিতি" : "Attendance",
      breakdown: isBn ? "শীঘ্রই আসছে" : "Coming soon",
    },
  ];

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0a0a0b]" : "bg-zinc-50"}`}>
      <div className="max-w-[1600px] mx-auto p-6 lg:p-8">
        <div className="mb-8">
          <h1 className={`text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-zinc-900"}`}>
            {isBn ? "রিপোর্ট" : "Reports"}
          </h1>
          <p className={`text-sm mt-1 ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>
            {isBn ? "আপনার প্রতিষ্ঠানের জন্য রিপোর্ট তৈরি এবং ডাউনলোড করুন" : "Generate and download reports for your institution"}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {reports.map((report) => (
            <div key={report.id} className={`${card} p-6`}>
              <div className="flex items-start gap-4">
                <div className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 ${report.iconBg}`}>
                  <report.icon className={`h-6 w-6 ${report.iconColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className={`text-sm font-medium mb-1 ${isDark ? "text-zinc-100" : "text-zinc-900"}`}>{report.title}</h3>
                  <p className={`text-xs ${isDark ? "text-zinc-500" : "text-zinc-500"} leading-relaxed`}>{report.description}</p>
                </div>
              </div>

              <div className="mt-4 ml-16">
                <div className="flex items-baseline gap-2 mb-1">
                  <span className={`text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-zinc-900"}`}>{report.metric}</span>
                  <span className={`text-[11px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>{report.metricLabel}</span>
                </div>
                <p className={`text-[11px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>{report.breakdown}</p>
              </div>

              <div className="flex gap-2 mt-5">
                <button
                  onClick={() => handleGenerate(report.id)}
                  disabled={generating === report.id}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
                    generating === report.id
                      ? isDark ? "bg-white/[0.04] text-zinc-600 cursor-wait" : "bg-zinc-50 text-zinc-400 cursor-wait"
                      : isDark ? "bg-white/[0.06] text-zinc-400 hover:text-white hover:bg-white/[0.1]" : "bg-zinc-100 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200"
                  }`}
                >
                  <BarChart3 className="h-3.5 w-3.5" />
                  {generating === report.id
                    ? (isBn ? "তৈরি হচ্ছে..." : "Generating...")
                    : (isBn ? "রিপোর্ট তৈরি করুন" : "Generate Report")
                  }
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ReportsSkeleton({ isDark }: { isDark: boolean }) {
  const card = isDark ? "bg-[#141416] border border-white/[0.06]" : "bg-white border border-zinc-200 shadow-sm";

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0a0a0b]" : "bg-zinc-50"}`}>
      <div className="max-w-[1600px] mx-auto p-6 lg:p-8">
        <div className="mb-8">
          <div className={`h-8 w-48 rounded-lg ${isDark ? "bg-white/[0.06]" : "bg-zinc-200"}`} />
          <div className={`h-4 w-64 rounded mt-2 ${isDark ? "bg-white/[0.04]" : "bg-zinc-200/60"}`} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className={`${card} rounded-2xl h-48`} />
          ))}
        </div>
      </div>
    </div>
  );
}
