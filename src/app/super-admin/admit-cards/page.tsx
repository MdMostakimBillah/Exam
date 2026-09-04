"use client";
import { useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHeader, TableRow, TableHead } from "@/components/ui/table";
import { getAdmitCards } from "@/lib/storage/admit-cards";
import { FileCheck, Download, Printer, Eye } from "lucide-react";
import { useTheme } from "@/contexts/theme-context";
import { useLang } from "@/contexts/language-context";

export default function AdmitCardsPage() {
  const { theme } = useTheme();
  const { lang: language, t } = useLang();
  const isDark = theme === "dark";
  const isBn = language === "bn";
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return <AdmitCardsSkeleton isDark={isDark} />;

  const cards = getAdmitCards();

  const card = isDark
    ? "bg-[#141416] border border-white/[0.06] rounded-2xl"
    : "bg-white border border-zinc-200 rounded-2xl shadow-sm";
  const iconBg = isDark ? "bg-white/[0.06]" : "bg-zinc-100";
  const iconColor = isDark ? "text-white" : "text-zinc-900";

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0a0a0b]" : "bg-zinc-50"}`}>
      <div className="p-6 lg:p-8">
        {/* Metric Card */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {[
            { label: isBn ? 'মোট প্রবেশপত্র' : 'Total Cards', value: cards.length },
            { label: isBn ? 'ইস্যুকৃত' : 'Issued', value: cards.length },
            { label: isBn ? 'ডাউনলোড' : 'Downloaded', value: 0 },
          ].map((s) => (
            <div key={s.label} className={`${card} px-4 py-3 flex items-center gap-3`}>
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
                <FileCheck className={`h-5 w-5 ${iconColor}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-lg font-bold tracking-tight leading-tight ${isDark ? "text-white" : "text-zinc-900"}`}>{s.value}</p>
                <p className={`text-[11px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className={`${card}`}>
          <div className={`px-5 py-4 border-b ${isDark ? "border-white/[0.06]" : "border-zinc-100"}`}>
            <div className="flex items-center gap-2">
              <FileCheck className={`h-4 w-4 ${isDark ? "text-zinc-500" : "text-zinc-400"}`} />
              <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>
                {isBn ? 'প্রবেশপত্র তালিকা' : 'Admit Cards'}
              </h3>
              <span className={`text-[11px] ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>({cards.length})</span>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow className={isDark ? 'border-white/[0.04] hover:bg-transparent' : 'border-zinc-100 hover:bg-transparent'}>
                <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>{isBn ? 'শিক্ষার্থী' : 'Student'}</TableHead>
                <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>{isBn ? 'রেজি নং' : 'Reg No'}</TableHead>
                <TableHead className={`text-[10px] font-medium uppercase tracking-wider hidden md:table-cell ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>{isBn ? 'পরীক্ষা' : 'Exam'}</TableHead>
                <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>{isBn ? 'শ্রেণী' : 'Class'}</TableHead>
                <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>{isBn ? 'রোল' : 'Roll'}</TableHead>
                <TableHead className={`text-[10px] font-medium uppercase tracking-wider hidden lg:table-cell ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>{isBn ? 'কেন্দ্র' : 'Center'}</TableHead>
                <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>{isBn ? 'তারিখ' : 'Date'}</TableHead>
                <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>{isBn ? 'কার্য' : 'Actions'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cards.map(card => (
                <TableRow key={card.id} className={`${isDark ? 'border-white/[0.04] hover:bg-white/[0.02]' : 'border-zinc-100 hover:bg-zinc-50/50'}`}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <div className={`h-8 w-8 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 ${isDark ? 'bg-white/[0.06] text-zinc-400' : 'bg-zinc-100 text-zinc-500'}`}>
                        {card.studentName.charAt(0)}
                      </div>
                      <div>
                        <p className={`text-sm font-medium ${isDark ? 'text-zinc-200' : 'text-zinc-700'}`}>{card.studentName}</p>
                        <p className={`text-[10px] ${isDark ? 'text-zinc-600' : 'text-zinc-400'}`}>{card.institutionName}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className={`text-[11px] font-mono ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>{card.registrationNumber}</TableCell>
                  <TableCell className={`text-[11px] hidden md:table-cell ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{card.examName}</TableCell>
                  <TableCell className={`text-[11px] ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{card.className}</TableCell>
                  <TableCell className={`text-[11px] ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{card.roll}</TableCell>
                  <TableCell className={`text-[11px] hidden lg:table-cell ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{card.examCenter}</TableCell>
                  <TableCell className={`text-[11px] ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>{new Date(card.examDate).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <button className={`h-7 w-7 rounded-lg flex items-center justify-center transition-colors ${isDark ? 'hover:bg-white/[0.06] text-zinc-500' : 'hover:bg-zinc-100 text-zinc-400'}`}><Eye className="h-3.5 w-3.5" /></button>
                      <button className={`h-7 w-7 rounded-lg flex items-center justify-center transition-colors ${isDark ? 'hover:bg-white/[0.06] text-zinc-500' : 'hover:bg-zinc-100 text-zinc-400'}`}><Download className="h-3.5 w-3.5" /></button>
                      <button className={`h-7 w-7 rounded-lg flex items-center justify-center transition-colors ${isDark ? 'hover:bg-white/[0.06] text-zinc-500' : 'hover:bg-zinc-100 text-zinc-400'}`}><Printer className="h-3.5 w-3.5" /></button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

function AdmitCardsSkeleton({ isDark }: { isDark: boolean }) {
  const card = isDark ? "bg-[#141416] border border-white/[0.06]" : "bg-white border border-zinc-200 shadow-sm";

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0a0a0b]" : "bg-zinc-50"}`}>
      <div className="p-6 lg:p-8">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className={`${card} rounded-2xl h-[52px]`} />
          ))}
        </div>
        <div className={`${card} rounded-2xl h-64`} />
      </div>
    </div>
  );
}
