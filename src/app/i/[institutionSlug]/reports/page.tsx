"use client";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { getInstitutionBySlug } from "@/lib/storage/institutions";
import { BarChart3, FileText, Download, Users, GraduationCap, CreditCard } from "lucide-react";
import { useTheme } from "@/contexts/theme-context";
import { useLang } from "@/contexts/language-context";

export default function InstitutionReportsPage() {
  const params = useParams();
  const slug = params.institutionSlug as string;
  const { theme } = useTheme();
  const { lang: language, t } = useLang();
  const isDark = theme === "dark";
  const isBn = language === "bn";
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return <ReportsSkeleton isDark={isDark} />;

  const inst = getInstitutionBySlug(slug);
  if (!inst) return null;

  const reports = [
    {
      id: 'student-roster',
      title: isBn ? 'শিক্ষার্থী তালিকা' : 'Student Roster',
      description: isBn ? 'শ্রেণী এবং সেকশন বিবরণ সহ সম্পূর্ণ শিক্ষার্থী তালিকা।' : 'Complete student roster with class and section details.',
      icon: Users,
      iconBg: isDark ? "bg-blue-500/20" : "bg-blue-100",
      iconColor: isDark ? "text-blue-400" : "text-blue-600",
    },
    {
      id: 'registration-summary',
      title: isBn ? 'নিবন্ধন সারসংক্ষেপ' : 'Registration Summary',
      description: isBn ? 'স্ট্যাটাস এবং পেমেন্ট বিবরণ সহ সব নিবন্ধন।' : 'All registrations with status and payment details.',
      icon: FileText,
      iconBg: isDark ? "bg-emerald-500/20" : "bg-emerald-100",
      iconColor: isDark ? "text-emerald-400" : "text-emerald-600",
    },
    {
      id: 'result-analysis',
      title: isBn ? 'ফলাফল বিশ্লেষণ' : 'Result Analysis',
      description: isBn ? 'গ্রেড এবং বৃত্তির স্ট্যাটাস সহ পরীক্ষার ফলাফল।' : 'Examination results with grades and scholarship status.',
      icon: GraduationCap,
      iconBg: isDark ? "bg-amber-500/20" : "bg-amber-100",
      iconColor: "text-amber-400",
    },
    {
      id: 'payment-summary',
      title: isBn ? 'পেমেন্ট সারসংক্ষেপ' : 'Payment Summary',
      description: isBn ? 'পেমেন্ট ইতিহাস এবং লেনদেনের বিবরণ।' : 'Payment history and transaction details.',
      icon: CreditCard,
      iconBg: isDark ? "bg-green-500/20" : "bg-green-100",
      iconColor: isDark ? "text-green-400" : "text-green-600",
    },
  ];

  const card = isDark
    ? "bg-[#141416] border border-white/[0.06] rounded-2xl"
    : "bg-white border border-zinc-200 rounded-2xl shadow-sm";
  const iconBg = isDark ? "bg-white/[0.08]" : "bg-zinc-100";
  const iconColor = isDark ? "text-zinc-300" : "text-zinc-600";

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0a0a0b]" : "bg-zinc-50"}`}>
      <div className="max-w-[1600px] mx-auto p-6 lg:p-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className={`text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-zinc-900"}`}>
            {isBn ? 'রিপোর্ট' : 'Reports'}
          </h1>
          <p className={`text-sm mt-1 ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>
            {isBn ? 'আপনার প্রতিষ্ঠানের জন্য রিপোর্ট তৈরি এবং ডাউনলোড করুন' : 'Generate and download reports for your institution'}
          </p>
        </div>

        {/* Report Cards */}
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
              <div className="flex gap-2 mt-5">
                <button className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${isDark ? "bg-white/[0.06] text-zinc-400 hover:text-white hover:bg-white/[0.1]" : "bg-zinc-100 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200"}`}>
                  <FileText className="h-3.5 w-3.5" /> {isBn ? 'পূর্বরূপ' : 'Preview'}
                </button>
                <button className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${isDark ? "bg-white/[0.06] text-zinc-400 hover:text-white hover:bg-white/[0.1]" : "bg-zinc-100 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200"}`}>
                  <Download className="h-3.5 w-3.5" /> PDF
                </button>
                <button className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${isDark ? "bg-white/[0.06] text-zinc-400 hover:text-white hover:bg-white/[0.1]" : "bg-zinc-100 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200"}`}>
                  <Download className="h-3.5 w-3.5" /> CSV
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
          <div className={`h-8 w-48 rounded-lg ${isDark ? 'bg-white/[0.06]' : 'bg-zinc-200'}`} />
          <div className={`h-4 w-64 rounded mt-2 ${isDark ? 'bg-white/[0.04]' : 'bg-zinc-200/60'}`} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {[1, 2, 3, 4].map((i) => (<div key={i} className={`${card} rounded-2xl h-48`} />))}
        </div>
      </div>
    </div>
  );
}
