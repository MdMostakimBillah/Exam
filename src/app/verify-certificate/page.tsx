"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { initializeDemoData } from "@/lib/storage/seed";
import { getCertificateByNumber } from "@/lib/storage/certificates";
import { Certificate } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Search, CheckCircle, ShieldCheck, XCircle } from "lucide-react";
import { useTheme } from "@/contexts/theme-context";
import { useLang } from "@/contexts/language-context";

export default function VerifyCertificatePage() {
  const { theme } = useTheme();
  const { t } = useLang();
  const isDark = theme === "dark";
  const [certNumber, setCertNumber] = useState("");
  const [certificate, setCertificate] = useState<Certificate | null>(null);
  const [searched, setSearched] = useState(false);

  useEffect(() => { initializeDemoData(); }, []);

  const handleSearch = () => {
    const found = getCertificateByNumber(certNumber);
    setCertificate(found || null);
    setSearched(true);
  };

  const bg = isDark ? "bg-[#080808]" : "bg-gray-50";
  const text = isDark ? "text-zinc-100" : "text-gray-900";
  const textSec = isDark ? "text-zinc-500" : "text-gray-500";

  return (
    <div className={`min-h-screen ${bg}`}>
      <header className={`border-b backdrop-blur-xl ${isDark ? "border-white/[0.06] bg-[#080808]/80" : "border-gray-200 bg-white/80"}`}>
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg font-bold text-sm ${isDark ? "bg-white text-black" : "bg-black text-white"}`}>B</div>
            <span className={`text-sm font-semibold ${text}`}>{t("brand")}</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/result" className={`text-xs ${isDark ? "text-zinc-500 hover:text-zinc-300" : "text-gray-500 hover:text-gray-900"}`}>{t("nav.checkResult")}</Link>
            <Link href="/login" className={`text-xs ${isDark ? "text-zinc-500 hover:text-zinc-300" : "text-gray-500 hover:text-gray-900"}`}>{t("nav.signIn")}</Link>
          </div>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-6 py-16">
        <div className="text-center mb-8">
          <div className="rounded-full bg-emerald-500/10 p-3 w-fit mx-auto mb-4">
            <ShieldCheck className="h-6 w-6 text-emerald-400" />
          </div>
          <h1 className={`text-2xl font-bold tracking-tight mb-2 ${isDark ? "text-zinc-100" : "text-gray-900"}`}>Verify Certificate</h1>
          <p className={`text-sm ${isDark ? "text-zinc-500" : "text-gray-500"}`}>Enter a certificate number to verify its authenticity.</p>
        </div>

        <Card>
          <CardContent className="p-6">
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Certificate Number</label>
                <Input
                  value={certNumber}
                  onChange={(e) => setCertNumber(e.target.value)}
                  placeholder="e.g. SCX-2026-000001"
                />
              </div>
              <Button onClick={handleSearch} className="w-full">
                <Search className="h-4 w-4 mr-2" /> Verify Certificate
              </Button>
            </div>
          </CardContent>
        </Card>

        {searched && !certificate && (
          <div className="mt-6 text-center py-8">
            <XCircle className="h-10 w-10 text-zinc-700 mx-auto mb-3" />
            <p className="text-sm text-zinc-500">Certificate not found. Please check the certificate number.</p>
          </div>
        )}

        {certificate && (
          <Card className="mt-6 border-emerald-500/20">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-4 mb-6">
                <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-emerald-300">Certificate Verified</p>
                  <p className="text-xs text-emerald-400/60">This certificate is authentic and issued by ScholarX.</p>
                </div>
              </div>
              <div className="space-y-3">
                {[
                  { label: 'Student', value: certificate.studentName },
                  { label: 'Institution', value: certificate.institutionName },
                  { label: 'Exam', value: certificate.examName },
                  { label: 'Year', value: certificate.examYear },
                  { label: 'Position', value: `#${certificate.position}` },
                  { label: 'Certificate Number', value: certificate.certificateNumber },
                  { label: 'Issue Date', value: new Date(certificate.issueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
                    <span className="text-xs text-zinc-500">{item.label}</span>
                    <span className="text-sm text-zinc-200">{item.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
